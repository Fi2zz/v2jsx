# Vue Tempalte to JSX

Transform Vue 2 SFC template part to JSX,

Inspired by `vue-template-compiler`

## Install

```bash

        npm install v2jsx
        # or
        yarn add v2jsx
```

## Use

```js
const v2jsx = require("v2jsx");
const vueTemplate = `
   <div class="root" v-show="rootShow">
		<div id="hello" :class="{ test: true }" class="core">
			{{ some.text }}
		</div>
		<some-component v-bind="someProps" />

		<template v-slot:some-sloe>

			v-slot 

		</template>
		<div v-show="visible" style="display: flex"></div>
		<div>
			<h3>v-model</h3>
			<input v-model="vmodel" />
		</div>
		<div>
			<h3>v-html</h3>
			<div v-html="someHTML"></div>
		</div>

		<div>
			<h3>v-text</h3>
			<div v-text="someText"></div>
		</div>
		<div>
			<h3>v-if</h3>
			<div v-if="ifCondition">v-if directive</div>
		</div>
		<div>
			<h3>v-if & v-else</h3>

			<div v-if="ifC2">v-if</div>
			<div v-else>v-else</div>
		</div>
		<div>
			<h3>v-if & v-else-if & v-else</h3>
			<div v-if="ifCondition2">v-if directive 2</div>
			<div v-else-if="ifCondition3">v-else-if directive 3</div>
			<div v-else>v-else</div>
		</div>
	</div>
`;
const result = v2jsx(vueTemplate);
console.log(result.code);

// <div style={[{ display: rootShow ? "" : "none" }]} class={["root"]}>
//   <div class={[{ test: true }, "core"]} id="hello">
//     {some.text}
//   </div>
//   <SomeComponent props={someProps} />
//   "v-slot"
//   <div style={["display: flex", { display: visible ? "" : "none" }]} />
//   <div>
//     <h3>v-model</h3>
//     <input vModel={vmodel} />
//   </div>
//   <div>
//     <h3>v-html</h3>
//     <div domProps={{ innerHTML: someHTML }} />
//   </div>
//   <div>
//     <h3>v-text</h3>
//     <div domProps={{ textContent: someText }} />
//   </div>
//   <div>
//     <h3>v-if</h3>
//     {ifCondition ? <div>v-if directive</div> : null}
//   </div>
//   <div>
//     <h3>v-if & v-else</h3>
//     {ifC2 ? <div>v-if</div> : <div>v-else</div>}
//   </div>
//   <div>
//     <h3>v-if & v-else-if & v-else</h3>
//     {ifCondition2 ? (
//       <div>v-if directive 2</div>
//     ) : ifCondition3 ? (
//       <div>v-else-if directive 3</div>
//     ) : (
//       <div>v-else</div>
//     )}
//   </div>
// </div>;
```

## Where is `this` binding

Unfortunately, we cannot determine `this` binding from the template,

you should manually to handle it after transform to jsx
