// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
function makeMap(str) {
	const map = str.split(",").reduce((acc, item) => {
		acc[item.toLowerCase()] = true;
		return acc;
	}, Object.create(null));

	return function (val) {
		return map[val.toLowerCase()];
	};
}
exports.makeMap = makeMap;

const isHTMLTag = makeMap(
	"html,body,base,head,link,meta,style,title," +
		"address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section," +
		"div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul," +
		"a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby," +
		"s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video," +
		"embed,object,param,source,canvas,script,noscript,del,ins," +
		"caption,col,colgroup,table,thead,tbody,td,th,tr," +
		"button,datalist,fieldset,form,input,label,legend,meter,optgroup,option," +
		"output,progress,select,textarea," +
		"details,dialog,menu,menuitem,summary," +
		"content,element,shadow,template,blockquote,iframe,tfoot"
);

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
const isSVG = makeMap(
	"svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face," +
		"foreignobject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern," +
		"polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view",
	true
);
const isReservedTag = function (tag) {
	if (!tag || typeof tag != "string") return false;
	tag = tag.toLowerCase();
	return isHTMLTag(tag) || isSVG(tag) || isUnaryTag(tag);
};
const isUnaryTag = makeMap(
	"area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr",
	true
);

function camelize(string, capitalize = true) {
	if (typeof string != "string") return "";
	string = string.replace(/-(\w)/g, (_, $2) => ($2 ? $2.toUpperCase() : ""));
	return capitalize ? string.charAt(0).toUpperCase() + string.slice(1) : string;
}
function isEmptyText(text) {
	text = text.trim();
	if (text == "") return true;
	return /["'](\s+)?["']/.test(text);
}
const isPlainTextElement = makeMap("script,style,textarea,pre", true);
exports.isSVG = isSVG;
exports.isHTMLTag = isHTMLTag;
exports.isReservedTag = isReservedTag;
exports.isUnaryTag = isUnaryTag;
exports.isPlainTextElement = isPlainTextElement;
exports.camelize = camelize;
exports.isEmptyText = isEmptyText;
