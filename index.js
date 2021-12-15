const prettier = require("prettier");
const {
	isUnaryTag,
	camelize,
	parseText,
	removeTextTag,
	parse,
} = require("./parser");
const dJSON = require("dirty-json");
const assign = `
	function assign(target, ...source) {
	const _source = [...source];
	if(_source.length<=1) return target
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

module.exports = (template) => {
	template = template?.trim();
	template = template
		.replace(/^(\<template(.*))/, "")
		.replace(/(\<\/template\>)$/g, "");

	const root = parse(template);
	function getProps(node) {
		const state = {
			directives: [],
			class: [],
			props: {},
			domProps: {},
			attrs: {},
			scopedSlots: {},
			style: [],
		};
		if (!node) return state;
		(node.props || []).forEach((prop) => {
			const { name } = prop;
			const attrName = prop.name
				.replace("v-bind:", "")
				.replace("v-on:", "")
				.trim();
			const value =
				typeof prop.value == "string" ? dJSON.parse(prop.value) : prop.value;
			if (/v-on:/.test(prop.name)) {
				const event = attrName.replace(/^[a-z]/, (t) => `on${t.toUpperCase()}`);
				state.props[event] = value;
			} else if (/v-bind:/.test(prop.name)) {
				//  v-bind:style
				//  v-bind:class
				if (attrName == "style" || attrName == "class") {
					state[attrName].push(value);
				} else if (attrName == "ref") {
					state.props.ref = JSON.parse(value.ref);
					if (value.refInFor) state.props.refInFor = true;
				}
				//  v-bind:id ...
				else {
					state.props[attrName] = value;
				}
			}
			//  v-bind="xx"
			else if (/v-bind/.test(prop.name)) {
				const json = dJSON.parse(value);
				for (let key in json) {
					state.props[key] = JSON.stringify(json[key]);
				}
			} else if (/v-html/.test(name)) {
				state.domProps.innerHTML = value;
			} else if (/v-text/.test(name)) {
				state.domProps.textContent = value;
			} else if (/v-show/.test(name)) {
				state.style.push("{ display: " + value + " ? '' : 'none' }");
			} else if (/v-model/.test(name)) {
				state.directives.push({ name: "vModel", value });
			}
			//  directive
			else if (/v-[a-zA-Z]/.test(name)) {
				state.directives.push({ name, value });
			} else if (name == "class") {
				state.class.push(prop.value);
			} else if (name == "style") {
				state.style.push(prop.value);
			} else {
				state.attrs[name] = value;
			}
		});
		const scopes = node.scopedSlots || {};
		for (let key in scopes) {
			const slot = scopes[key];
			const slotScope = dJSON.parse(slot.slotScope || '"_"');
			let nodes = transformChildren(slot, false, false);
			if (nodes.length <= 0) {
				nodes = null;
			} else {
				nodes = `[${nodes.map(parseText)}]`;
			}
			state.scopedSlots[key] = `(${slotScope})=>(${nodes})`;
		}
		return state;
	}
	function getAttributes(node) {
		if (!node) return "";
		const state = getProps(node);
		const attributes = [];
		let scopedSlots = "";
		for (let key in state.scopedSlots) {
			const slot = state.scopedSlots[key];
			scopedSlots += `${key}:${slot},`;
		}
		if (scopedSlots) attributes.push(`scopedSlots= {{${scopedSlots}}}`);
		if (state.style.length) attributes.push(`style={assign(${state.style})}`);
		if (state.class.length) attributes.push(`class={assign(${state.class})}`);
		//  props
		if (Object.values(state.props).length) {
			attributes.push(`props={${JSON.stringify(state.props)}}`);
		}
		//  attrs
		for (const key in state.attrs) {
			let value = state.attrs[key];
			if (value == '""') {
				value = true;
			}
			if (value != true) {
				attributes.push(`${key}='${value}'`);
			} else {
				attributes.push(key);
			}
		}
		if (Object.values(state.domProps).length > 0) {
			attributes.push(`domProps={${JSON.stringify(state.domProps)}}`);
		}
		for (const { name, value } of state.directives) {
			attributes.push(`${name}={${value}}`);
		}
		return attributes.join(" ");
	}
	function transformFor(node) {
		const noIterator2 = node.iterator2 == undefined;
		const noIterator1 = node.iterator1 == undefined;
		const template = `{{for}.map((props,index)=>{{callback}})}`;
		const alias = `var ${node.alias}  = props;`;
		const iterator2 = (!noIterator2 && `var ${node.iterator2} = index;`) || "";
		const iterator1 = (!noIterator1 && `var ${node.iterator1} = index;`) || "";
		const tag = node.if ? transformIf(node, true) : generateJSXElement(node);
		const fn = `{alias}\n{iterator1}\n{iterator2}\nreturn({tag})`
			.replace("{alias}", alias)
			.replace("{iterator1}", iterator1)
			.replace("{iterator2}", iterator2)
			.replace("{tag}", tag);
		return template.replace(/\{for\}/g, node.for).replace(/\{callback\}/, fn);
	}
	function transformIf(node, ifInfor) {
		const element = node.ifConditions
			.map(({ block }) => block)
			.map((block) => {
				let cond = "";
				if (block.if != null) cond = JSON.parse(block.if) + "?";
				if (block.elseif != null) cond = ":" + JSON.parse(block.elseif) + "?";
				if (block.else != null) cond = ":";
				return cond + generateJSXElement(block);
			})
			.join("");
		const children = node.ifConditions.length > 1 ? element : element + ":null";
		return ifInfor ? children : `{${children}}`;
	}
	function generateJSXElement(node) {
		if (node.tag != "template") {
			const tag = camelize(node.tag);
			const attributes = getAttributes(node);
			const left = attributes ? `<${tag} ${attributes}>` : `<${tag}>`;
			if (isUnaryTag(tag)) return left.replace(">", "/>");
			const children = transformChildren(node);
			return `${left}${children || ""}</${tag}>`;
		}
		return transformChildren(node);
	}
	function transformNode(node) {
		if (!node) return null;
		if (typeof node == "string") return removeTextTag(node);
		if (node.type == 1) {
			if (!node.tag) return null;
			if (node.tag == "slot") return transformSlot(node);
			if (node.tag == "template" && !node.if) return transformChildren(node);
		}
		if (node.type == 2) return removeTextTag(node.text);
		if (node.type == 3) return removeTextTag(node.text);
		if (node.for) return transformFor(node);
		if (node.if) return transformIf(node);
		return generateJSXElement(node);
	}
	function transformChildren(node, root = false, toString = true) {
		const children = ((root ? [node] : node.children) || []).map(transformNode);
		if (!toString) return children.filter(Boolean);
		return children.join("") || null;
	}
	function transformSlot(node) {
		const { props } = getProps(node);
		const name = props.name ?? '"default"';
		delete props.name;
		const children = transformChildren(node);
		const stringifyProps = JSON.stringify(props);
		return `{$scopedSlots[${name}](${stringifyProps})||${children}}`.trim();
	}
	const string = transformChildren(root, true);
	const code = `${assign}\n ${string}`;
	const jsx = prettier.format(code, { parser: "babel" });
	return { code: jsx, template: template };
};
