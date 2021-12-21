const { isReservedTag } = require("./helpers");

const HTMLLikeTagRE = /\<(.*\>)/g;
const defaultTagRE = /\{((?:.|\r?\n)+?)\}/g;
function trimSpace(text) {
	return text.trim().replace(/(\n+)?(\t+)?/g, "");
}
function stringifyValue(value) {
	if (value == " ") value = "";
	return JSON.stringify(trimSpace(value));
}
function parseText(text, delimiters = ",", parent) {
	if (HTMLLikeTagRE.test(text)) {
		return text;
	}
	if (!defaultTagRE.test(text)) {
		if (
			parent == "template" ||
			parent == "slot" ||
			!parent ||
			isReservedTag(parent)
		)
			return trimSpace(text);
		return stringifyValue(text);
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
	return tokens.filter(Boolean).join(delimiters);
}

exports.parseText = parseText;
