'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const benchpress = require('../../build/lib/benchpress');
const { collapseWhitespace } = require('./utils');
const mainData = require('../data.json');

describe('compileParse', () => {
	it('should work', (done) => {
		const source = fs.readFileSync(path.join(__dirname, '../templates/source/loop-inside-if-else.tpl'));
		const expected = fs.readFileSync(path.join(__dirname, '../templates/expected/loop-inside-if-else.html'));

		benchpress.compileParse(source.toString(), mainData, (err, output) => {
			assert.ifError(err);

			assert.equal(collapseWhitespace(expected.toString()), collapseWhitespace(output));
			done();
		});
	});

	it('blocks should work', (done) => {
		const source = fs.readFileSync(path.join(__dirname, '../templates/source/loop-inside-if-else.tpl'));
		const expected = fs.readFileSync(path.join(__dirname, '../templates/expected/loop-inside-if-else.html'));

		benchpress.compileParse(source.toString(), 'rooms', mainData, (err, output) => {
			assert.ifError(err);

			assert.equal(collapseWhitespace(expected.toString()), collapseWhitespace(output));
			done();
		});
	});
});
