'use strict';

/* global describe, it */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const prepare = require('./prepare');
const templates = require('../../lib/shim');
const mainData = require('../data.json');

const logDir = path.join(__dirname, '../logs/');
const collapseWhitespace = str => str
	.replace(/[\r\n]+/g, '\n')
	.replace(/[\t ]+/g, ' ')
	.replace(/ (<)|(>) /g, '$1$2')
	.trim();

function test([source, expected, missing]) {
	describe('templates.js', () => {
		const keys = Object.keys(source);

		keys.forEach(key => {
			it(key, () => {
				const parsed = collapseWhitespace(templates.parse(source[key], mainData));
				const expect = collapseWhitespace(expected[key]);

				if (parsed !== expect) {
					fs.writeFile(path.join(logDir, `${key}.log`), parsed);
				} else {
					fs.unlink(path.join(logDir, `${key}.log`), () => {});
				}

				assert.equal(parsed, expect);
			});
		});

		if (missing.length) {
			setTimeout(() => {
				winston.warn(`[templates.js] Missing expected files: ${JSON.stringify(missing, null, 2)}`);
			}, 200);
		}
	});
}


templates.registerHelper('canspeak', (data /* , iterator, numblocks */) => 
	((data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak'));

templates.registerHelper('test', data => (data.forum && !data.double));

templates.registerHelper('isHuman', (data, iterator) => 
	data.animals[iterator].isHuman);

const templatesDir = path.join(__dirname, '../templates/');
const sourceDir = path.join(templatesDir, 'source');
const expectedDir = path.join(templatesDir, 'expected');

test(prepare(sourceDir, expectedDir));
