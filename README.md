# Vue Tempalte to JSX

Transform Vue 2 SFC template part to JSX,

Inspired by `vue-tepmlate-compiler`

## Where is `this` binding

Unfortunately, we cannot determine `this` binding from the template,

you should manually to handle it after transform to jsx

## Example

```vue
<template>
	<div class="test" :class="{ testComponent: true }">
		<img alt="Vue logo" src="../assets/logo.png" />
		<HelloWorld msg="Hello Vue 3 + Vite">
			<template v-slot:hello="{ hello }">
				<div>
					slotData:
					{{ hello }}
				</div>
			</template>
			<div v-bind:slot="jello" slot-scope="{ jello }">
				{{ jello }} {{ slotdata.name }}
			</div>
			<template v-slot:[jello]>{{ jello }}</template>
		</HelloWorld>

		<template v-if="ifCondition">ifCondition</template>
		<div id="123" :class="hello" v-else-if="elseIfCondition">
			elseIfCondition
		</div>
		<div v-else>velse</div>
		<ul>
			<li
				class="list-node"
				v-for="(alias, iterator2) in object"
				:key="iterator2"
			>
				<div v-if="456">456</div>
				alias: {{ alias.name }} iterator1: {{ iterator2 }} iterator2:
				{{ iterator2 }}
			</li>
		</ul>
		<component :props="{ a: 'b' }" :is="'div'"></component>
		<TestComponent></TestComponent>
		<HelloWorldJSX>
			hello default slot
			<div>div tag</div>
		</HelloWorldJSX>
	</div>
</template>
```

into

```javascript
function assign(target, ...source) {
	const _source = [...source];
	if (_source.length <= 1) return target;
	for (const item of _source) {
		if (typeof item != "object") continue;
		if (Array.isArray(item)) {
			assign(target, ...item);
		} else {
			Object.assign(target, item);
		}
	}
	return target;
}
<div class={assign("test", { testComponent: true })}>
	<img alt={'"Vue logo"'} src={"../assets/logo.png"} />
	<HelloWorld
		scopedSlots={{
			hello: ({ hello }) => [
				<div>
					slotData:
					{hello}
				</div>,
			],
			jello: () => [jello],
		}}
		msg={'"Hello Vue 3 + Vite"'}>
		<div scopedSlots={{ jello: ({ jello }) => null }}>
			{jello} {slotdata.name}
		</div>
	</HelloWorld>
	{ifCondition ? (
		ifCondition
	) : elseIfCondition ? (
		<div class={assign(hello)} id={'"123"'}>
			elseIfCondition
		</div>
	) : (
		<div>velse</div>
	)}
	<ul>
		{object.map((props, index) => {
			var alias = props;
			var iterator2 = index;

			return (
				<li class={assign("list-node")} key={iterator2}>
					{456 ? <div>456</div> : null}alias: {alias.name} iterator1:{" "}
					{iterator2} iterator2:
					{iterator2}
				</li>
			);
		})}
	</ul>
	<component props={{ a: "b" }} is={"div"}></component>
	<TestComponent></TestComponent>
	<HelloWorldJSX>
		hello default slot<div>div tag</div>
	</HelloWorldJSX>
</div>;
```
