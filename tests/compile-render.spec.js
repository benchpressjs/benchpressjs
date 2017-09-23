'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const Benchpress = require('../build/lib/benchpress');
const { equalsIgnoreWhitespace } = require('./lib/utils');
const mainData = require('./data.json');

const source = fs.readFileSync(path.join(__dirname, 'templates/source/loop-inside-if-else.tpl')).toString();
const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/loop-inside-if-else.html')).toString();

describe('compileRender', () => {
	it('should work', () =>
		Benchpress.compileRender(source, mainData)
			.then(output => equalsIgnoreWhitespace(expected, output))
	);

	it('should work with block', () =>
		Benchpress.compileRender(source, mainData, 'rooms')
			.then(output => equalsIgnoreWhitespace(expected, output))
	);
});

describe('compileParse', () => {
	it('should work', (done) => {
		Benchpress.compileParse(source, mainData, (err, output) => {
			assert.ifError(err);

			equalsIgnoreWhitespace(expected, output);
			done();
		});
	});

	it('should work with block', (done) => {
		Benchpress.compileParse(source, 'rooms', mainData, (err, output) => {
			assert.ifError(err);

			equalsIgnoreWhitespace(expected, output);
			done();
		});
	});
});
