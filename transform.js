const { source } = require("./parse");
const compile = require("./parser");
const root = compile(source);
const capitalize = (string) => {
	return `${string}`.replace(/[A-Za-z]/, (partial, index) =>
		index === 0 ? partial?.toUpperCase() : partial
	);
};
function hyphenate(str) {
	return str.replace(hyphenate, "-$1").toLowerCase();
}
function normalizeStyle(value) {
	return value.replace(/[^a-zA-Z0-9%]/g, "");
}
function nornmalizeJSONLike(raw) {
	if (typeof raw != "string") return raw;
	let out = [];
	raw
		.trim()
		.replace(/^(\")/, "")
		.replace(/(\")$/, "")
		.replace(/^(\')/, "")
		.replace(/(\")$/, "")
		.replace(/^([\{\[])/, "")
		.replace(/([\{\[])$/, "")
		.replace(/\}$/, "")
		.trim()
		.split(",")
		.forEach((raw) => {
			const [name, value] = raw.trim().replace(":", "_split_").split("_split_");
			out.push({ name: name.trim(), value: value?.trim() || "" });
		});
	return out;
}

function jsonLikeToObject(string) {
	return eval("(function(){return " + string + ";})()");
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
var isUnaryTag = makeMap(
	"area,base,br,col,embed,frame,hr,img,input,isindex,keygen," +
		"link,meta,param,source,track,wbr"
);

function transformASTToJSXString(root) {
	const assign = `
	function assign(target, ...source) {
	const _source = [...source];
	if (_source.length <= 0) return target;
	for (const item of _source) {
		if (typeof item != "object") continue;
		if (Array.isArray(item)) {
			assign(target, ...item);
		} else {
			Object.assign(target, item);
		}
	}
	return target;
}`;

	const defaultTagRE = /\{((?:.|\r?\n)+?)\}/g;
	const htmlTagRE = /\<(\/)?(.*>)/g;
	function removeDelimiters(text) {
		const result = text.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
		return result;
	}

	function parseText(text) {
		if (typeof text == "undefined") return null;
		if (htmlTagRE.test(text)) return text;
		if (!defaultTagRE.test(text)) return JSON.stringify(text);
		var tokens = [];
		var rawTokens = [];
		var lastIndex = (defaultTagRE.lastIndex = 0);
		var match, index, tokenValue;
		while ((match = defaultTagRE.exec(text))) {
			index = match.index;
			// push text token
			if (index > lastIndex) {
				rawTokens.push((tokenValue = text.slice(lastIndex, index)));
				tokens.push(JSON.stringify(tokenValue));
			}
			// tag token
			const exp = match[1].trim();
			if (exp.includes(".")) {
				tokens.push(exp);
			} else {
				tokens.push("{" + exp + "}");
			}
			rawTokens.push(exp);
			lastIndex = index + match[0].length;
		}
		if (lastIndex < text.length) {
			rawTokens.push((tokenValue = text.slice(lastIndex)));
			tokens.push(JSON.stringify(tokenValue));
		}
		return tokens.join(",");
	}

	function cssToJSON(css) {
		if (!css) return {};
		if (!css.includes("{")) {
			css = `{${css}`;
		}
		if (!css.includes("}")) {
			css = `${css}}`;
		}
		css = css.replace(/\;/g, '","').replace(/\:(\s+)?/g, '":"');
		return css;
	}

	function propsToString(node) {
		if (!node) return "";
		const state = {
			events: {},
			directives: {},
			class: [],
			props: {},
			ref: null,
			domPropsInnerHTML: "",
			children: node.children || [],
			slot: null,
			key: null,
			refInfor: false,
			domProps: {},
			attrs: {},
			scopedSlots: {},
			variableStyle: [],
			style: [],
		};
		// (node.staticProps || []).forEach((props) => {
		// 	const { name, value } = props;
		// 	if (name == "class") {
		// 		value.split(/\s/).forEach((name) => {
		// 			name = name.replace(/[^a-z0-9A-Z\-]/g, "");
		// 			state.class[name] = true;
		// 		});
		// 	} else if (name == "style") {
		// 		state.styles.push(cssToJSON(value));
		// 	} else if (name == "ref") {
		// 		state.ref = value;
		// 	} else {
		// 		state.attrs[name] = value;
		// 	}
		// });
		(node.props || []).forEach((prop) => {
			const { name, raw } = prop;

			const value =
				typeof prop.value == "string" ? JSON.parse(prop.value) : prop.value;
			const nornmalized = nornmalizeJSONLike(value);
			if (/v-on:/.test(name)) {
				const event = name.replace(
					/v-on:[a-z]/,
					(t) => `on${t.slice(5).toUpperCase()}`
				);
				state.props[event] = value;
			} else if (/v-bind:/.test(name)) {
				let _name = name.replace("v-bind:", "").trim();
				if (/v-bind:class/.test(name)) {
					state.class.push(value);
				}
				//  v-bind:style
				else if (/v-bind:style/.test(name)) {
					state.style.push(value);
				}
				//  v-bind:id ...
				else if (/v-bind:/.test(name)) {
					state.props[_name] = value;
				}
				//  v-bind="xx"
				else {
					nornmalized.forEach(({ name, value }) => {
						state.props[name] = value;
					});
				}
			} else if (/v-html/.test(name)) {
				state.domProps.innerHTML = value;
			} else if (/v-text/.test(name)) {
				children.push({ type: 3, text: value });
			} else if (/v-show/.test(name)) {
				state.style.push("{ display: " + value + " ? '' : 'none' }");
			} else if (/v-model/.test(name)) {
				state.props.value = value;
				state.props.onInput = `(event)=>{ ${value}  = event.target.value }`;
			}
			//  directive
			else if (/v-[a-zA-Z]/.test(name)) {
			} else if (name == "class") {
				state.class.push(prop.value);
			} else if (name == "style") {
				state.style.push(prop.value);
			} else {
				state.attrs[name] =
					typeof value == "string" ? value : JSON.stringify(props.value);
			}
		});

		Object.values(node.scopedSlots || {}).forEach((props) => {
			const scope = JSON.parse(props.slotScope);
			const children = props.children;
			let jsx = children.map(transformNode);
			const slotTarget = props.slotTarget;
			if (jsx.length > 1) {
				jsx = jsx.map(parseText).filter(Boolean).join(",");
				jsx = `[${jsx}]`;
			} else {
				jsx = parseText(jsx[0]);
			}
			console.log({ jsx });

			const slotScope = scope || scope.length ? scope : "_";
			state.scopedSlots[slotTarget] = `(${slotScope})=>(${jsx})`;
		});

		const attributes = [];
		attrsToString(state, attributes);
		styleToString(state, attributes);
		domPropsToString(state, attributes);
		scopedSlotsToString(state, attributes);
		// directivesToString(state, attributes);
		eventsToString(state, attributes);
		classNameToString(state, attributes);
		return attributes.join(" ");
	}

	function eventsToString(state, attributes) {
		for (const name in state.events) {
			attributes.push(`${name}={${state.events[name]}}`);
		}
	}
	function classNameToString(state, attributes) {
		if (state.class.length <= 0) return;
		attributes.push(`class={assign(${state.class})}`);
	}
	function attrsToString(state, attributes) {
		for (const key in state.props) {
			let value = state.props[key];
			if (value == '""') {
				value = true;
			}
			if (value != true) {
				attributes.push(`${key}={${value}}`);
			} else {
				attributes.push(key);
			}
		}
		for (const key in state.attrs) {
			let value = state.attrs[key];
			if (value == '""') {
				value = true;
			}
			if (value != true) {
				attributes.push(`${key}={${value}}`);
			} else {
				attributes.push(key);
			}
		}
	}
	function styleToString(state, attributes) {
		if (!state.styles) return;
		const out = [];
		for (let string of state.styles) {
			string = string.replace(/\(/g, "").replace(/\)$/g, "");
			out.push(string);
		}
		if (out.length <= 0) return;
		attributes.push(`style={assign({},${state.styles.join(",")})}`);
	}

	function domPropsToString(state, attributes) {
		const domProps = JSON.stringify(state.domProps);
		if (domProps != "{}") attributes.push(`domProps={${domProps}}`);
	}
	function scopedSlotsToString(state, attributes) {
		let slotstring = "";
		for (const key in state.scopedSlots) {
			slotstring += `${key}:${state.scopedSlots[key]},`;
		}
		if (slotstring) attributes.push(`scopedSlots= {{${slotstring}}}`);
	}
	function directivesToString(state, attributes) {
		if (!state.directives) return;
		for (let directive in state.directives) {
			let value = state.directives[directive];
			if (typeof value != "undefined" && value.length) {
				attributes.push(`${directive}={${value}}`);
			} else {
				attributes.push(directive);
			}
		}
	}
	function transformFor(node) {
		const noIterator2 = node.iterator2 == undefined;
		const noIterator1 = node.iterator1 == undefined;
		const template = `{{for}.map((props,index)=>{{fn}})}`;
		const alias = `var ${node.alias}  = props;`;
		const iterator2 = (!noIterator2 && `var ${node.iterator2} = index;`) || "";
		const iterator1 = (!noIterator1 && `var ${node.iterator1} = index;`) || "";
		const tag = generate(node);
		const fn = `{alias}{iterator1}{iterator2}return({tag})`
			.replace("{alias}", alias)
			.replace("{iterator1}", iterator1)
			.replace("{iterator2}", iterator2)
			.replace("{tag}", tag);
		return template.replace(/\{for\}/g, node.for).replace(/\{fn\}/, fn);
	}
	function transformIf(child) {
		const element = child.ifConditions
			.map(({ block }) => block)
			.map((block) => {
				let cond = "";
				if (block.if != null) cond = JSON.parse(block.if) + "?";
				if (block.elseif != null) cond = ":" + JSON.parse(block.elseif) + "?";
				if (block.else != null) cond = ":";
				return cond + generate(block);
			})
			.join("");
		//  just v-if
		if (child.ifConditions.length === 1) return "{" + element + ":null }";
		return "{" + element + "}";
	}

	function camelize(string) {
		if (/^[A-Z]/.test(string) || !/^[a-zA-Z]{1,}\-/.test(string)) return string;
		const result = string.replace(/-(\w)/g, function (_, c) {
			return c ? c.toUpperCase() : "";
		});
		if (/^[A-Z]/.test(result)) return result;
		return capitalize(result);
	}

	function generate(node) {
		const tag = camelize(node.tag);
		const attributes = propsToString(node);
		if (isUnaryTag(tag.toLowerCase)) return `<${tag} ${attributes}/>`;
		const children = nodesToString(node);

		let left = attributes ? `<${tag} ${attributes}` : `<${tag}`;
		if (!children) return `${left}/>`;
		return `${left}>${children}</${tag}>`;
	}
	function nodesToString(node, root = false) {
		const nodes = (root ? node : node.children || []).filter(Boolean);
		const children = nodes.map(transformNode);
		return children.length ? children.join("") : null;
	}
	function transformNode(node) {
		if (!node) return null;
		if (typeof node == "string") return removeDelimiters(node);
		// if (node.type == 1 && node.tag == "template") return transformNode(node.children);
		if (node.type == 1 && !node.tag) return null;
		if (node.type == 2) return removeDelimiters(node.text);
		if (node.type == 3) return removeDelimiters(node.text);
		if (node.for) return transformFor(node);
		if (node.if) return transformIf(node);
		return generate(node);
	}
	const string = nodesToString([root], true);
	return string;
	return `
		${assign}
		${string}
	`;
}

// process.stdout.write("\x1B[2J\x1B[3J\x1B[H");

const prettier = require("prettier");
const string = transformASTToJSXString(root);

const jsx = prettier.format(string, { parser: "babel" });
// console.log(root);

console.log(jsx);
