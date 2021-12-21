const { makeMap } = require("./helpers");

const unicodeRegExp =
	/a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/;
const attribute =
	/^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const dynamicArgAttribute =
	/^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<%=tag>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;
const startTagOpen = new RegExp(`^<${qnameCapture}`);
const startTagClose = /^\s*(\/?)>/;
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
const comment = /^<!\--/;
const isPlainTextElement = makeMap("script,style,textarea", true);
const isUnaryTag = makeMap(
	"area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr",
	true
);
exports.parseHTML = function parseHTML(options) {
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
			const rest = html.replace(reStackedTag, function (_all, text, endTag2) {
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
		const unary = isUnaryTag(tagName) || !!unarySlash;
		const l = match.attrs.length;
		const attrs = new Array(l);
		for (let i = 0; i < l; i++) {
			const args = match.attrs[i];
			const value = args[3] || args[4] || args[5] || "";
			attrs[i] = {
				name: args[1],
				value,
			};
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
		options.start(tagName, attrs, unary);
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
				options.end();
			}
			stack.length = pos;
			lastTag = pos && stack[pos - 1].tag;
		} else if (isUnaryTag(lowerCasedTagName)) {
			options.start(tagName, [], true, start, end);
		}
	}
};
