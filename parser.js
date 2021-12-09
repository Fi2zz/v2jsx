// compiler/helpers.js
var emptyObject = Object.freeze({});
var onRE = /^@|^v-on:/;
var dirRE = /^v-|^@|^:|^\.|^#/;
var bindRE = /^:|^\.|^v-bind:/;
var warn = function (msg) {
	console.error(`[Vue compiler]: ${msg}`);
};
function createText(type, text) {
	return { type, text };
}
function createElement(tag, attrs, parent) {
	const props = [];
	for (let attr of attrs) {
		let raw = `${attr.name}=${JSON.stringify(attr.value)}`;
		let name = attr.name;
		let value = attr.value;
		name = name.replace(bindRE, "v-bind:").replace(onRE, "v-on:");
		if (!dirRE.test(value)) value = JSON.stringify(value);
		props.push({ name, value, raw });
	}
	return {
		type: 1,
		tag,
		parent,
		children: [],
		props,
		forbiden: tag == "script" || tag == "style",
		ifConditions: [],
	};
}
function makeMap(str, expectsLowerCase) {
	var map = Object.create(null);
	var list = str.split(",");
	for (var i = 0; i < list.length; i++) {
		map[list[i]] = true;
	}
	return expectsLowerCase
		? function (val) {
				return map[val.toLowerCase()];
		  }
		: function (val) {
				return map[val];
		  };
}
var forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
var forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
var stripParensRE = /^\(|\)$/g;
function parseFor(exp) {
	const inMatch = exp.match(forAliasRE);
	if (!inMatch) return;
	const res = {};
	res.for = inMatch[2].trim();
	const alias = inMatch[1].trim().replace(stripParensRE, "");
	const iteratorMatch = alias.match(forIteratorRE);
	if (iteratorMatch) {
		res.alias = alias.replace(forIteratorRE, "").trim();
		res.iterator1 = iteratorMatch[1].trim();
		if (iteratorMatch[2]) {
			res.iterator2 = iteratorMatch[2].trim();
		}
	} else {
		res.alias = alias;
	}
	return res;
}
function findProp(el, nameOrRE, remove) {
	const fn = (prop) =>
		typeof nameOrRE == "string"
			? prop.name == nameOrRE
			: nameOrRE.test(prop.name);
	const { value, name, raw } = el.props.find(fn) || {};
	if (remove && raw) {
		el.props = el.props.filter((prop) => !fn(prop));
	}
	return raw ? { raw, value, name } : null;
}

// compiler/html.js
var unicodeRegExp =
	/a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/;
var attribute =
	/^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
var dynamicArgAttribute =
	/^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
var ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;
var qnameCapture = `((?:${ncname}\\:)?${ncname})`;
var startTagOpen = new RegExp(`^<${qnameCapture}`);
var startTagClose = /^\s*(\/?)>/;
var endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
var comment = /^<!\--/;
var isPlainTextElement = makeMap("script,style,textarea", true);
var reCache = {};
function parseHTML(options) {
	const stack = [];
	let index = 0;
	let last, lastTag;
	let html = options.template;
	while (html) {
		last = html;
		if (!lastTag || !isPlainTextElement(lastTag)) {
			let textEnd = html.indexOf("<");
			if (textEnd === 0) {
				if (comment.test(html)) {
					const commentEnd = html.indexOf("-->");
					if (commentEnd >= 0) {
						advance(commentEnd + 3);
						continue;
					}
				}
				const endTagMatch = html.match(endTag);
				if (endTagMatch) {
					const curIndex = index;
					advance(endTagMatch[0].length);
					parseEndTag(endTagMatch[1], curIndex, index);
					continue;
				}
				const startTagMatch = parseStartTag();
				if (startTagMatch) {
					handleStartTag(startTagMatch);
					continue;
				}
			}
			let text, rest, next;
			if (textEnd >= 0) {
				rest = html.slice(textEnd);
				while (
					!endTag.test(rest) &&
					!startTagOpen.test(rest) &&
					!comment.test(rest)
				) {
					next = rest.indexOf("<", 1);
					if (next < 0) break;
					textEnd += next;
					rest = html.slice(textEnd);
				}
				text = html.substring(0, textEnd);
			}
			if (textEnd < 0) {
				text = html;
			}
			if (text) {
				advance(text.length);
				options.chars(text);
			}
		} else {
			let endTagLength = 0;
			const stackedTag = lastTag.toLowerCase();
			const reStackedTag =
				reCache[stackedTag] ||
				(reCache[stackedTag] = new RegExp(
					"([\\s\\S]*?)(</" + stackedTag + "[^>]*>)",
					"i"
				));
			const rest = html.replace(reStackedTag, function (all, text, endTag2) {
				endTagLength = endTag2.length;
				options.chars(text);
				return "";
			});
			index += html.length - rest.length;
			html = rest;
			parseEndTag(stackedTag, index - endTagLength, index);
		}
		if (html === last) {
			options.chars && options.chars(html);
			if (!stack.length && options.warn) {
				options.warn(`Mal-formatted tag at end of template: "${html}"`, {
					start: index + html.length,
				});
			}
			break;
		}
	}
	parseEndTag();
	function advance(n) {
		index += n;
		html = html.substring(n);
	}
	function parseStartTag() {
		const start = html.match(startTagOpen);
		if (start) {
			const match = {
				tagName: start[1],
				attrs: [],
				start: index,
			};
			advance(start[0].length);
			let end, attr;
			while (
				!(end = html.match(startTagClose)) &&
				(attr = html.match(dynamicArgAttribute) || html.match(attribute))
			) {
				attr.start = index;
				advance(attr[0].length);
				attr.end = index;
				match.attrs.push(attr);
			}
			if (end) {
				match.unarySlash = end[1];
				advance(end[0].length);
				match.end = index;
				return match;
			}
		}
	}
	function handleStartTag(match) {
		const tagName = match.tagName;
		const unarySlash = match.unarySlash;
		const unary = !!unarySlash;
		const l = match.attrs.length;
		const attrs = new Array(l);
		for (let i = 0; i < l; i++) {
			const args = match.attrs[i];
			const value = args[3] || args[4] || args[5] || "";
			attrs[i] = {
				name: args[1],
				value,
			};
			if (options.outputSourceRange) {
				attrs[i].start = args.start + args[0].match(/^\s*/).length;
				attrs[i].end = args.end;
			}
		}
		if (!unary) {
			stack.push({
				tag: tagName,
				lowerCasedTag: tagName.toLowerCase(),
				attrs,
				start: match.start,
				end: match.end,
			});
			lastTag = tagName;
		}
		if (options.start) {
			options.start(tagName, attrs, unary, match.start, match.end);
		}
	}
	function parseEndTag(tagName, start, end) {
		let pos, lowerCasedTagName;
		if (start == null) start = index;
		if (end == null) end = index;
		if (tagName) {
			lowerCasedTagName = tagName.toLowerCase();
			for (pos = stack.length - 1; pos >= 0; pos--) {
				if (stack[pos].lowerCasedTag === lowerCasedTagName) {
					break;
				}
			}
		} else {
			pos = 0;
		}
		if (pos >= 0) {
			for (let i = stack.length - 1; i >= pos; i--) {
				if ((i > pos || !tagName) && options.warn) {
					options.warn(`tag <${stack[i].tag}> has no matching end tag.`, {
						start: stack[i].start,
						end: stack[i].end,
					});
				}
				if (options.end) {
					options.end(stack[i].tag, start, end);
				}
			}
			stack.length = pos;
			lastTag = pos && stack[pos - 1].tag;
		} else if (lowerCasedTagName === "br") {
			if (options.start) {
				options.start(tagName, [], true, start, end);
			}
		} else if (lowerCasedTagName === "p") {
			if (options.start) {
				options.start(tagName, [], false, start, end);
			}
			if (options.end) {
				options.end(tagName, start, end);
			}
		}
	}
}

// compiler/index.js
var defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g;
var slotRE = /^v-slot(:|$)|^#/;
var dynamicArgRE = /^\[.*\]$/;
var emptySlotScopeToken = `_empty_`;
function processElement(element) {
	processIf(element);
	processSlotContent(element);
	processSlotOutlet(element);
	return element;
}
function processIf(el) {
	var exp = findProp(el, "v-if", true);
	if (exp) {
		el.if = exp.value;
		el.ifConditions.push({
			exp: exp.value,
			block: el,
		});
	} else {
		if (findProp(el, "v-else", true)) el.else = true;
		const elseif = findProp(el, "v-else-if", true);
		if (elseif) el.elseif = elseif.value;
	}
}
function processIfConditions(el, parent) {
	var prev = findPrevElement(parent.children);
	if (prev && prev.if) {
		prev.ifConditions.push({
			exp: el.elseif,
			block: el,
		});
	}
}
function findPrevElement(children) {
	let i = children.length;
	while (i--) {
		if (children[i].type === 1) {
			return children[i];
		} else {
			if (children[i].text !== " ") {
				warn(
					`text "${children[
						i
					].text.trim()}" between v-if and v-else(-if) will be ignored.`,
					children[i]
				);
			}
			children.pop();
		}
	}
}
function processSlotContent(el) {
	const attrSlot = findProp(el, "slot", true);
	const attrSlotScope = findProp(el, "slot-scope", true);
	if (attrSlot) {
		const msg =
			`<${el.tag} ${attrSlot.raw} slot-scope/>, is deprecated, use <${el.tag} v-slot:${attrSlot.value}{scope} />`
				.replace("slot-scope", !attrSlotScope ? "" : attrSlotScope.raw)
				.replace(
					"{scope}",
					!attrSlotScope ? "" : "={" + attrSlotScope.value + "}"
				);
		warn(msg);
		return;
	}
	const bound = findProp(el, "v-bind:slot", true);
	if (bound) {
		const msg = `<${el.tag} ${bound.raw}/>  is deprecated`;
		warn(msg);
		return;
	}
	const slotBinding = findProp(el, slotRE);
	if (!slotBinding) return;
	const { name } = getSlotName(slotBinding);
	if (el.tag === "template") {
		el.slotTarget = name;
		el.slotScope = slotBinding.value || emptySlotScopeToken;
	} else {
		if (true) {
			if (el.slotScope || el.slotTarget) {
				warn(`Unexpected mixed usage of different slot syntaxes.`, el);
			}
			if (el.scopedSlots) {
				warn(
					`To avoid scope ambiguity, the default slot should also use <template> syntax when there are other named slots.`,
					slotBinding
				);
			}
		}
		const slots = el.scopedSlots || (el.scopedSlots = {});
		const { name: name2, dynamic } = getSlotName(slotBinding);
		const slotContainer = (slots[name2] = createElement("template", [], el));
		slotContainer.slotTarget = name2;
		slotContainer.slotTargetDynamic = dynamic;
		slotContainer.children = el.children.filter((child) => {
			if (!child.slotScope) {
				child.parent = slotContainer;
				return true;
			}
		});
		slotContainer.slotScope = slotBinding.value || emptySlotScopeToken;
		el.children = [];
	}
}
function getSlotName(binding) {
	let name = binding.name.replace(slotRE, "");
	if (!name) {
		if (binding.name[0] !== "#") {
			name = "default";
		} else if (true) {
			warn(`v-slot shorthand syntax requires a slot name.`, binding);
		}
	}
	return dynamicArgRE.test(name)
		? { name: name.slice(1, -1), dynamic: true }
		: { name: `"${name}"`, dynamic: false };
}
function processSlotOutlet(el) {
	if (el.tag === "slot") {
		const prop = findProp(el, "name");
		el.slotName = prop.value || "default";
	}
}
function processFor(el) {
	var exp = findProp(el, "v-for", true);
	if (exp) {
		var res = parseFor(JSON.parse(exp.value));
		if (res) {
			Object.assign(el, res);
		} else if (true) {
		}
	}
}
module.exports = function parse(template, options = {}) {
	const stack = [];
	let root;
	let currentParent;
	function closeElement(element) {
		trimEndingWhitespace(element);
		if (!element.processed) element = processElement(element, options);
		if (!stack.length && element !== root) {
			if (root.if && (element.elseif || element.else)) {
				root.ifConditions.push({
					exp: element.elseif,
					block: element,
				});
			}
		}
		if (currentParent && !element.forbidden) {
			if (element.elseif || element.else) {
				processIfConditions(element, currentParent);
			} else {
				if (element.slotScope) {
					const name = element.slotTarget || '"default"';
					(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[
						name
					] = element;
				}
				currentParent.children.push(element);
				element.parent = currentParent;
			}
		}
		element.children = element.children.filter(
			(child) => child && !child.slotScope
		);
		trimEndingWhitespace(element);
	}
	function trimEndingWhitespace(el) {
		let lastNode;
		while (
			(lastNode = el.children[el.children.length - 1]) &&
			lastNode.type === 3 &&
			(lastNode.text === " " || lastNode.text === "")
		) {
			el.children.pop();
		}
	}
	function onStart(tag, attrs, unary) {
		const element = createElement(tag, attrs, currentParent);
		if (!element.processed) {
			processIf(element);
			processFor(element);
		}
		if (!root) root = element;
		if (!unary) {
			currentParent = element;
			stack.push(element);
		} else {
			closeElement(element);
		}
	}
	const onEnd = () => {
		var element = stack[stack.length - 1];
		stack.length -= 1;
		currentParent = stack[stack.length - 1];
		closeElement(element);
	};
	const onChars = (text) => {
		if (!currentParent) return;
		var children = currentParent.children;
		text = text.trim();
		if (text) {
		} else if (!children.length) {
			text = void 0;
		}
		if (text && text != " ") {
			if (defaultTagRE.test(text)) {
				children.push(createText(2, text));
			} else if (
				!children.length ||
				children[children.length - 1].text !== " "
			) {
				children.push(createText(3, text));
			}
		}
	};
	parseHTML({
		template: template.trim(),
		start: onStart,
		end: onEnd,
		chars: onChars,
		comment() {},
	});
	return root;
};
