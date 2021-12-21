const prettier = require("prettier");
const { parseTemplate } = require("./parseTemplate");
const { parseText } = require("./parseText");
const { isReservedTag, camelize } = require("./helpers");
function stringifyAttributes(object, attributesType = "string", wrap = true) {
	if (!object) return null;
	const entries = Object.entries(object).filter((x) => x.length);
	if (!entries.length) return null;
	let joiner = " ";
	let sep = "=";
	if (attributesType == "object") {
		sep = ":";
		joiner = ",";
		wrap = false;
	}
	function genExpression([key, value]) {
		return `{key}{sep}{value}`
			.replace("{key}", key)
			.replace("{sep}", value ? sep : "")
			.replace("{value}", value ? (wrap ? `{${value}}` : value) : "");
	}
	return entries.map(genExpression).join(joiner);
}
function generateAttributes(node) {
	if (!node || !node.tag) return "";

	const attributes = [];
	const events = stringifyAttributes(node.events);
	const props = stringifyAttributes(node.props);
	const attrs = stringifyAttributes(node.attrs, "string", false);
	const domProps = stringifyAttributes(node.domProps, "object");
	const directives = stringifyAttributes(node.directives);
	const scopedSlots = transformScopedSlots(node);
	if (node.style.length) attributes.push(`style={[${node.style}]}`);
	if (node.class.length) attributes.push(`class={[${node.class}]}`);
	if (events) attributes.push(events);
	if (attrs) attributes.push(attrs);
	if (props) attributes.push(props);
	if (domProps) attributes.push(`domProps={{${domProps}}}`);
	if (node.ref) attributes.push(`ref={${node.ref}}`);
	if (node.refInFor) attributes.push("refInfor");
	if (node.key) attributes.push(`key={${node.key}}`);
	if (node.slot) attributes.push(`slot={${node.slot}}`);
	if (node.boundProps) attributes.push(`props={${node.boundProps}}`);
	if (directives) attributes.push(directives);
	if (scopedSlots) attributes.push(`scopedSlots={{${scopedSlots}}}`);
	return attributes.join(" ");
}

function transformFor(node) {
	const noIterator2 = node.iterator2 == undefined;
	const noIterator1 = node.iterator1 == undefined;
	const template = `{for}.map((props,$_index)=>{{callback}})`;
	const alias = `var ${node.alias}  = props;`;
	const iterator2 = (!noIterator2 && `var ${node.iterator2} = $_index;`) || "";
	const iterator1 = (!noIterator1 && `var ${node.iterator1} = $_index;`) || "";
	const fn = `{alias}\n{iterator1}\n{iterator2}\nreturn({tag})`
		.replace("{alias}", alias)
		.replace("{iterator1}", iterator1)
		.replace("{iterator2}", iterator2)
		.replace("{tag}", jsxify(node));
	return template.replace(/\{for\}/g, node.for).replace(/\{callback\}/, fn);
}
function transformIf(node) {
	let hasElse = false;
	const condtions = [];
	for (let block of node.ifConditions) {
		const el = jsxify(block);
		const text = parseText(el, "+", null);
		if (block.if != null) {
			condtions.push(block.if, "?", text);
		} else if (block.elseif != null) {
			condtions.push(":", block.elseif, "?", text);
		} else if (block.else != null) {
			condtions.push(":", text);
		}
		hasElse = block.else != null;
	}
	// v-if && v-else  |  v-if
	if (!hasElse || condtions.length == 1) condtions.push(":", "null");
	return condtions.join("");
}
function transform(node, stringify = true) {
	const children = ((Array.isArray(node) ? node : node.children) || [])
		.map((node) => {
			if (!node) return null;
			if (typeof node == "string") return node;
			if (node.type == 1 && !node.tag) return null;
			if (node.type == 1 && node.tag == "slot") return transformSlot(node);
			//  vue@2x don't have fragment syntax
			if (node.type == 1 && node.tag == "template" && !node.if) {
				return jsxify(node, stringify);
			}
			if (node.type == 2) return node.text;
			if (node.type == 3) return parseText(node.text, ",", node.parent?.tag);
			if (node.for) return `{${transformFor(node)}}`;
			if (node.if) return `{${transformIf(node)}}`;
			return jsxify(node);
		})
		.filter(Boolean);
	return stringify ? children.join("\n") || null : children;
}
function transformSlot(node) {
	const { slotName, props, attrs } = node;
	if (!slotName) return "";
	const _scope = stringifyAttributes({ ...props, ...attrs }, "object");
	const scope = _scope ? `{${_scope}}` : null;
	const slot = !scope
		? `$slots[${slotName}]`
		: `$scopedSlots[${slotName}](${scope})`;
	const children = jsxify(node, false).map((node) =>
		parseText(node, ",", true)
	);
	if (!children.length) return `{${slot}}`;
	const code = `{${slot} || [${children}]}`;
	return code.trim();
}
function transformScopedSlots(node) {
	if (!node.scopedSlots) return null;
	if (node.scopedSlots?.default) node.children = [];
	const entries = Object.entries(node.scopedSlots);
	if (!entries.length) return null;
	function jsx(slot) {
		const element = jsxify(slot, false);
		return typeof element == "string"
			? element
			: element.map((x) => x.replace(/^\{/, "").replace(/\}$/, ""));
	}
	return entries.map(
		([name, slot]) => `${name}:(${slot.slotScope})=>([${jsx(slot)}])`
	);
}

function jsxify(node, stringify = true) {
	if (node.tag != "template" && node.tag != "slot") {
		const tag = isReservedTag(node.tag) ? node.tag : camelize(node.tag);
		const attrs = generateAttributes(node);
		const children = transform(node, stringify);
		const text = `<tag%attrs%/tag%>`
			.replace("attrs%", attrs ? ` ${attrs}` : "")
			.replace("tag%", tag);
		if (!children) return text.replace("tag%", "");
		return text.replace("/tag%", ">" + children + "</" + tag);
	}
	return transform(node, stringify);
}

module.exports = (template) => {
	template = template
		.trim()
		.replace(/^(\<template(.*))/, "")
		.replace(/(\<\/template\>)$/g, "");
	const root = parseTemplate(template);
	const result = jsxify(root);
	if (!result) {
		return {
			error: "Cannot transform template to JSX, please check your template",
			code: null,
		};
	}
	const code = prettier.format(result, { parser: "babel" });
	return { code: code, error: null };
};
