'use strict';

/* eslint no-debugger: off, no-unused-vars: off, no-eval: off, no-undef: off */

/**
 * This file is for debugging failing tests. It lets you inspect each step of compilation easily.
 */

// const fs = require('fs');
// const path = require('path');

const prefixer = require('./prefixer');
const tokenizer = require('./tokenizer');
const parser = require('./parser');
const compiler = require('./compiler');
const blocks = require('./blocks');
const codegen = require('./codegen');
const runtime = require('./runtime');

const collapseWhitespace = str => str
	.replace(/(?:[ \t]*[\r\n]+[ \t]*)+/g, '\n')
	.replace(/[\t ]+/g, ' ')
	.replace(/ (<)|(>) /g, '$1$2')
	.trim();

const testTemplate = `
<!-- IF rooms.length -->
	<!-- BEGIN rooms -->
		<!-- IF !rooms.private -->
			<a data-func="webrtc.joinRoom" data-room="{rooms.slug}" href="#" class="list-group-item">
				<h4 class="list-group-item-heading">{rooms.name}</h4>
				<p class="list-group-item-text">{rooms.description}</p>
			</a>
		<!-- ENDIF !rooms.private -->
	<!-- END rooms -->
<!-- ELSE -->
	<a data-func="webrtc.newRoom" href="#" class="list-group-item">
		<h4 class="list-group-item-heading">No rooms currently available!</h4>
		<p class="list-group-item-text">Click here to create one!</p>
	</a>
<!-- ENDIF rooms.length -->
`;

const testData = require('../../tests/data.json');

const testHelpers = {
	canspeak(data) {
		return (data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak';
	},
	test(data) {
		return data.forum && !data.double;
	},
	isHuman(data, iterator) {
		return data.animals[iterator].isHuman;
	},
};

function everything(template, data, helpers) {
	const prefixed = prefixer(template);
	const tokens = tokenizer(prefixed);
	const parsed = parser(tokens);
	const fnAst = compiler(parsed);
	const ast = blocks(fnAst);
	const code = codegen(ast);
	eval(code);
	// const output = runtime(helpers, data, compiled);
	const output = runtime(helpers, data, compiled.blocks.rooms);

	return output;
}

const out = collapseWhitespace(everything(testTemplate, testData, testHelpers));

debugger;
