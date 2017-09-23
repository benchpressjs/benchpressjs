'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const benchpress = require('../build/lib/benchpress');
const { equalsIgnoreWhitespace } = require('./lib/utils');
const mainData = require('./data.json');

describe('unsafe', () => {
	before(() => {
		benchpress.precompile.defaults.unsafe = true;
	});

	it('should throw if property does not exist', () => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/conditional-inside-loop.tpl')).toString();

		return benchpress.compileRender(source, mainData)
			.catch(err => assert(err));
	});

	it('should throw if helper does not exist', () => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/missing-helper.tpl')).toString();

		return benchpress.compileRender(source, mainData)
			.catch(err => assert(err));
	});

	it('should not throw if properties exist', () => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/object-conditional.tpl')).toString();
		const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/object-conditional.html')).toString();

		return benchpress.compileRender(source, mainData)
			.then(output => equalsIgnoreWhitespace(expected, output));
	});

	it('should work without the runtime', () => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/loop-nested-with-conditional.tpl')).toString();
		const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/loop-nested-with-conditional.html')).toString();

		return benchpress.precompile(source, {}).then((compiled) => {
			const template = benchpress.evaluate(compiled);
			const output = template(benchpress.helpers, mainData);

			equalsIgnoreWhitespace(expected, output);
		});
	});

	after(() => {
		benchpress.precompile.defaults.unsafe = false;
	});
});
