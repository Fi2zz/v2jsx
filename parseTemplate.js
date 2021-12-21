const { isPlainTextElement, isEmptyText } = require("./helpers");
const { createElement, createText } = require("./createElement");
const { parseHTML } = require("./parseHTML");
const { parseFor } = require("./parseFor");
function processIfConditions(el, parent) {
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
	const prev = findPrevElement(parent.children);
	if (prev && prev.if) prev.ifConditions.push(el);
}
function checkRefInFor(el) {
	var parent = el;
	while (parent) {
		if (parent.for !== undefined) {
			return true;
		}
		parent = parent.parent;
	}
	return false;
}

exports.parseTemplate = function parseTemplate(template) {
	const stack = [];
	let root;
	let currentParent;

	function trimEndingWhitespace(el) {
		// remove trailing whitespace node
		var lastNode;
		while (
			(lastNode = el.children[el.children.length - 1]) &&
			lastNode.type === 3 &&
			lastNode.text === " "
		) {
			el.children.pop();
		}
	}
	function closeElement(element) {
		if (isPlainTextElement(element.tag)) return;
		trimEndingWhitespace(element);
		if (!element.processed) {
			if (element.if) element.ifConditions.push(element);
			if (element.ref) element.refInFor = checkRefInFor(element);
			element.processed = true;
		}
		if (!stack.length && element !== root) {
			if (root.if && (element.elseif || element.else)) {
				root.ifConditions.push(element);
			}
		}
		if (currentParent && !isPlainTextElement(element.tag)) {
			if (element.elseif || element.else) {
				processIfConditions(element, currentParent);
			} else {
				currentParent.children.push(element);
				element.parent = currentParent;
			}
		}
		element.children = element.children.filter(
			(child) => child && !child.slotScope
		);
		trimEndingWhitespace(element);
	}
	parseHTML({
		template,
		start(tag, attrs, unary) {
			const element = createElement(tag, attrs, currentParent);
			if (!element.processed) {
				if (element.if) element.ifConditions.push(element);
				if (element.for) Object.assign(element, parseFor(element.for) || {});
				element.processed = true;
			}
			if (!root) root = element;
			if (!unary) {
				currentParent = element;
				stack.push(element);
			} else {
				closeElement(element);
			}
		},
		end() {
			const element = stack[stack.length - 1];
			stack.length -= 1;
			currentParent = stack[stack.length - 1];
			closeElement(element);
		},
		chars(text) {
			const parent = currentParent;
			if (!parent) return;
			const children = parent.children;
			if ((!children.length && isEmptyText(text)) || isEmptyText(text)) {
				text = "";
			}
			if (text) {
				const shouldStringify = parent.type !== 1 || parent.tag == "template";
				const node = createText(text, shouldStringify);
				children.push(node);
			}
		},
	});
	return root;
};
