const source = `
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

const transform = require("./index");
const jsx2 = transform(source);
console.log(jsx2.code);
