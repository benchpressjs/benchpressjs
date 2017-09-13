'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const benchpress = require('../build/lib/benchpress');
const { equalsIgnoreWhitespace } = require('./lib/utils');
const mainData = require('./data.json');

describe('each Object.keys("")', () => {
	const keys = Object.keys;

	before(() => {
		Object.keys = (obj) => {
			assert.equal(typeof obj, 'object');
			return keys(obj);
		};
	});

	it('ES5 behavior is correct', () => {
		assert.throws(() => {
			Object.keys('');
		});
	});

	it('should work with ES5 behavior', (done) => {
		const source = fs.readFileSync(path.join(__dirname, 'templates/source/object-keys-error.tpl'));
		const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/object-keys-error.html'));

		benchpress.compileParse(source.toString(), mainData, (err, output) => {
			assert.ifError(err);

			equalsIgnoreWhitespace(expected.toString(), output);
			done();
		});
	});

	after(() => {
		Object.keys = keys;
	});
});
