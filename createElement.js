const { camelize, isReservedTag } = require("./helpers");

const onRE = /^@|^v-on:/;
const dirRE = /^v-|^@|^:|^\.|^#/;
const bindRE = /^:|^\.|^v-bind:/;
const vSlotSyntaxRE = /^v-slot(:|$)|^#/;
const slotScopeRE = /(^slot-)?scope/;
exports.createElement = function createElement(tag, attrs, parent) {
	let scopedSlot = null;
	let slotScope = null;
	const node = {
		type: 1,
		tag,
		parent,
		children: [],
		props: {},
		ifConditions: [],
		scopedSlots: {},
		ref: null,
		refInFor: false,
		slotName: null,
		elseif: null,
		else: null,
		if: null,
		for: null,
		class: [],
		style: [],
		events: {},
		attrs: {},
		directives: {},
		domProps: {},
	};

	let slotName;

	let vShow = null;

	for (let attr of attrs) {
		const name = attr.name.replace(bindRE, "v-bind:").replace(onRE, "v-on:");
		const value = !dirRE.test(name) ? JSON.stringify(attr.value) : attr.value;
		if (tag == "slot" && /name/.test(name)) {
			slotName = attr.value ? value : undefined;
			continue;
		}
		let vSlotFromBind = false;
		if (slotScopeRE.test(attr.name)) {
			slotScope = attr.value;
			continue;
		}
		if (name.startsWith("v-bind:slot")) {
			attr.name = attr.name.replace("v-bind:", "v-");
			if (attr.value) attr.name += `:${attr.value}`;
			vSlotFromBind = true;
		}
		if (vSlotSyntaxRE.test(attr.name)) {
			scopedSlot = {
				name: getSlotName(attr),
				value: vSlotFromBind ? slotScope : value,
			};
			slotScope = null;
			continue;
		}
		if (name == "slot") {
			scopedSlot = { name: value };
			continue;
		}
		if (/(v-bind:)?ref/.test(name)) {
			node.ref = value;
			continue;
		}
		if (/v-for/.test(name)) {
			node.for = value;
			continue;
		}
		if (/v-if/.test(name)) {
			node.if = value;
			continue;
		}
		if (/v-else-if/.test(name)) {
			node.elseif = value;
			continue;
		}
		if (/v-else/.test(name)) {
			node.else = true;
			continue;
		}
		if (/v-html/.test(name)) {
			node.domProps.innerHTML = attr.value;

			console.log(
				`[Vue] children of <${tag} v-html="${attr.value}"/> which has diretive:v-html will be cleaned `
			);
			if (attr.value) node.children = [];
			continue;
		}
		if (/v-text/.test(name)) {
			node.domProps.textContent = attr.value;
			if (attr.value) {
				console.log(
					`[Vue] children of <${tag} v-text="${attr.value}"/> which has diretive:v-text will be cleaned `
				);
				node.children = [];
			}
			continue;
		}
		if (/v-show/.test(name)) {
			vShow = "{ display: " + attr.value + " ? '' : 'none' }";
			continue;
		}
		if (/v-model/.test(name)) {
			node.directives.vModel = attr.value;
			continue;
		}
		if (/v-bind:class/.test(name) || /class/.test(name)) {
			node.class.push(value);
			continue;
		}
		if (/v-bind:style/.test(name) || /style/.test(name)) {
			node.style.push(value);
			continue;
		}
		if (/v-bind:key/.test(name) || name == "key") {
			node.key = attr.value;
			continue;
		}
		if (/^v-bind$/.test(name)) {
			node.boundProps = value;
			continue;
		}
		if (/v-on:/.test(name)) {
			let eventName = name
				.replace(/v-on:/, "")
				.trim()
				.replace(/\.(.*)/, "");
			eventName = "on" + camelize(eventName);
			node.events[eventName] = attr.value || `(event)=>event`;
			continue;
		}

		if (!dirRE.test(name)) {
			node.attrs[name] = attr.value ? value : undefined;
			continue;
		}
		if (!bindRE.test(name)) {
			node.directives[name] = value;
			continue;
		}
		node.props[name.replace(/v-bind:/, "")] = value;
	}
	if (vShow) node.style.push(vShow);
	if (tag == "slot") {
		node.slotName = slotName || `"default"`;
	}
	if (scopedSlot) {
		if (node.parent) {
			if (!isReservedTag(node.parent.tag)) {
				scopedSlot.value = scopedSlot.value || slotScope || "_";
				node.slotScope = scopedSlot.value;
				node.slotTarget = scopedSlot.name;
				node.parent.scopedSlots[scopedSlot.name] = node;
			} else {
				console.log(
					`\n\n[Vue]  cannoot apply scoped-slots:${scopedSlot.name} to reversed tag:<${node.parent.tag}/>\n\n`
				);
			}
		}
	}
	return node;
};
function getSlotName(binding) {
	const vSlotSyntaxRE = /^v-slot(:|$)|^#/;
	let name = binding.name.replace(vSlotSyntaxRE, "");
	if (!name || name == "#") return "default";
	return JSON.stringify(name);
}
function isTagText(text) {
	return buildTagTextRE().test(text);
}

function buildTagTextRE() {
	return /\{\{(\s+)?((?:.|\r?\n)+?)(\s+)?\}\}/g;
}

function createText(text, stringify = true) {
	text = text.trim();
	if (isTagText(text)) {
		//  {{vars}} => {vars}
		return {
			type: 2,
			text: text.replace(/\{\{/g, "{").replace(/\}\}/g, "}"),
		};
	}
	text = stringify ? JSON.stringify(text) : text;
	return { type: 3, text };
}

exports.createText = createText;
