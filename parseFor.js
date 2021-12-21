const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
const stripParensRE = /^\(|\)$/g;
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
exports.parseFor = parseFor;
