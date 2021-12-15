const onRE = /^@|^v-on:/;
const dirRE = /^v-|^@|^:|^\.|^#/;
const bindRE = /^:|^\.|^v-bind:/;
const unicodeRegExp =
	/a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/;
const attribute =
	/^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const dynamicArgAttribute =
	/^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;
const startTagOpen = new RegExp(`^<${qnameCapture}`);
const startTagClose = /^\s*(\/?)>/;
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
const comment = /^<!\--/;
const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g;
const newSlotRE = /^v-slot(:|$)|^#/;
const htmlTagRE = /\<(.*\>)/g;
const oldSlotRE = /:slot|v-bind:slot|^slot$/;
const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
const stripParensRE = /^\(|\)$/g;

const isPlainTextElement = makeMap("script,style,textarea", true);
const isUnaryTag = makeMap(
	"area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr",
	true
);
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
		ifConditions: [],
		scopedSlots: {},
	};
}
function makeMap(str) {
	const map = str.split(",").reduce((acc, item) => {
		acc[item.toLowerCase()] = true;
		return acc;
	}, Object.create(null));

	return function (val) {
		return map[val.toLowerCase()];
	};
}

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

function processProp(el, name, next) {
	for (let index = 0; index < el.props.length; index++) {
		let prop = el.props[index];
		if (name == prop.name) {
			if (typeof next == "function" && prop.value) {
				const result = next(prop.value, prop.raw, el);
				if (result) {
					el.props[index] = { ...prop, ...result, name };
				}
			}
		}
	}
}

function parseHTML(options) {
	const stack = [];
	let index = 0;
	let last, lastTag;
	let html = options.template.trim();
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
			const reStackedTag = new RegExp(
				"([\\s\\S]*?)(</" + stackedTag + "[^>]*>)",
				"i"
			);
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
			options.chars(html);
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
				options.end(stack[i].tag, start, end);
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
function processElement(element) {
	processProp(element, "v-bind:ref", (ref) => ({
		value: { ref, refInFor: checkInFor(element) },
	}));
	processIf(element);
	processSlotContent(element);
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
			children.pop();
		}
	}
}

function checkInFor(el) {
	var parent = el;
	while (parent) {
		if (parent.for !== undefined) return true;
		parent = parent.parent;
	}
	return false;
}

function processSlotContent(el) {
	let oldSlotSyntax = findProp(el, oldSlotRE, true);
	const attrSlotScope = findProp(el, /slot-scope/, true);
	const scope = attrSlotScope?.value ?? "";
	if (scope && !oldSlotSyntax) {
		oldSlotSyntax = {
			value: '"default"',
		};
	}
	if (oldSlotSyntax) {
		const name = oldSlotSyntax.value || "default";
		if (el.tag != "template") {
			const slots = el.scopedSlots;
			slots[name] = createElement("template", [], el);
			const slotContainer = slots[name];
			slotContainer.slotTarget = name;
			slotContainer.slotScope = scope;
		} else {
			el.slotTarget = name;
			el.slotScope = scope;
		}
		return;
	}
	const slotBinding = findProp(el, newSlotRE);
	if (!slotBinding) return;
	const slotName = getSlotName(slotBinding);
	if (el.tag === "template") {
		el.slotTarget = slotName;
		el.slotScope = slotBinding.value;
	} else {
		const slots = el.scopedSlots;
		slots[slotName] = createElement("template", [], el);
		const slotContainer = slots[slotName];
		slotContainer.slotTarget = slotName;
		slotContainer.children = el.children.filter((child) => {
			if (!child.slotScope) {
				child.parent = slotContainer;
				return true;
			}
		});
		slotContainer.slotScope = slotBinding.value;
		el.children = [];
	}
}
function getSlotName(binding) {
	let name = binding.name.replace(newSlotRE, "");
	if (!name && binding.name[0] !== "#") name = "default";
	name = name.replace(/^(\[)/, "").replace(/(\])$/, "");
	return JSON.stringify(name);
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
exports.parse = function parse(template, options = {}) {
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
		if (currentParent && !["style", "script"].includes(element.tag)) {
			if (element.elseif || element.else) {
				processIfConditions(element, currentParent);
			} else {
				if (element.slotScope) {
					const name = element.slotTarget || '"default"';

					if (!currentParent.scopedSlots) {
						currentParent.scopedSlots = {};
					}
					currentParent.scopedSlots[name] = element;
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
		template,
		start: onStart,
		end: onEnd,
		chars: onChars,
	});
	return root;
};

function capitalize(string) {
	return `${string}`.replace(/[A-Za-z]/, (partial, index) =>
		index === 0 ? partial?.toUpperCase() : partial
	);
}

exports.capitalize = capitalize;
exports.isUnaryTag = isUnaryTag;
exports.camelize = function camelize(string) {
	if (!/^[a-zA-Z]{1,}\-/.test(string)) return string;
	const result = string.replace(/-(\w)/g, function (_, c) {
		return c ? c.toUpperCase() : "";
	});
	return capitalize(result);
};
exports.parseText = function parseText(text) {
	if (htmlTagRE.test(text)) return text;
	const defaultTagRE = /\{((?:.|\r?\n)+?)\}/g;
	if (!defaultTagRE.test(text)) return text;
	const delimiters = ",";
	function stringifyValue(value) {
		if (value == " ") value = "";
		return JSON.stringify(value.replace(/(\n+)?(\t+)?/, ""));
	}
	const tokens = [];
	let lastIndex = (defaultTagRE.lastIndex = 0);
	let match, index, tokenValue;
	while ((match = defaultTagRE.exec(text))) {
		index = match.index;
		// push text token
		if (index > lastIndex) {
			tokenValue = text.slice(lastIndex, index);
			tokens.push(stringifyValue(tokenValue));
		}
		// tag token
		const exp = match[1].trim();
		tokens.push(exp);
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) {
		tokenValue = text.slice(lastIndex);
		tokens.push(stringifyValue(tokenValue));
	}
	return typeof delimiters != "undefined"
		? tokens.filter((x) => x.length).join(delimiters)
		: tokens;
};

exports.removeTextTag = function removeTag(text) {
	//  {{vars}} => {vars}
	return text.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
};
