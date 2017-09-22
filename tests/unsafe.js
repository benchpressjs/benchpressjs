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

	it('should throw if property does not exist', (done) => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/conditional-inside-loop.tpl'));

		benchpress.compileParse(source.toString(), mainData, (err) => {
			assert(err);
			done();
		});
	});

	it('should throw if helper does not exist', (done) => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/missing-helper.tpl'));

		benchpress.compileParse(source.toString(), mainData, (err) => {
			assert(err);
			done();
		});
	});

	it('should not throw if properties exist', (done) => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/object-conditional.tpl'));
		const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/object-conditional.html'));

		benchpress.compileParse(source.toString(), mainData, (err, output) => {
			assert.ifError(err);

			equalsIgnoreWhitespace(expected.toString(), output);
			done();
		});
	});

	it('should work without the runtime', (done) => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/loop-nested-with-conditional.tpl'));
		const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/loop-nested-with-conditional.html'));

		benchpress.precompile({ source: source.toString() }, (err, compiled) => {
			assert.ifError(err);

			const template = benchpress.evaluate(compiled);
			const output = template(benchpress.helpers, mainData);

			equalsIgnoreWhitespace(expected.toString(), output);
			done();
		});
	});

	after(() => {
		benchpress.precompile.defaults.unsafe = false;
	});
});
