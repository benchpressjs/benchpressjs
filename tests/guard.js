'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const benchpress = require('../build/lib/benchpress');
const { equalsIgnoreWhitespace } = require('./lib/utils');
const mainData = require('./data.json');

describe('guarding', () => {
	before(() => {
		benchpress.precompile.defaults.guard = false;
	});

	it('should throw if guarding is off and property doesn\'t exist', (done) => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/conditional-inside-loop.tpl'));

		benchpress.compileParse(source.toString(), mainData, (err) => {
			assert(err);
			done();
		});
	});

	it('should not throw if guarding is off and properties exist', (done) => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/object-conditional.tpl'));
		const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/object-conditional.html'));

		benchpress.compileParse(source.toString(), mainData, (err, output) => {
			assert.ifError(err);

			equalsIgnoreWhitespace(expected.toString(), output);
			done();
		});
	});

	after(() => {
		benchpress.precompile.defaults.guard = true;
	});
});
