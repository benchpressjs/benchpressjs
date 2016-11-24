'use strict';

/* global describe, it */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const prepare = require('./prepare');
const Handlebars = require('handlebars');
const mainData = require('./../data.json');

const logDir = path.join(__dirname, '../logs/');
const collapseWhitespace = str => str
	.replace(/[\r\n]+/g, '\n')
	.replace(/[\t ]+/g, ' ')
	.replace(/ (<)|(>) /g, '$1$2')
	.trim();

function test([source, expected, missing]) {
	describe('handlebars', () => {
		const keys = Object.keys(source);

		keys.forEach(key => {
			it(key, () => {
				const parsed = collapseWhitespace(Handlebars.compile(source[key])(mainData));
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
				winston.warn(`[handlebars] Missing expected files: ${JSON.stringify(missing, null, 2)}`);
			}, 200);
		}
	});
}

const templatesDir = path.join(__dirname, '../templates/');
const hbsDir = path.join(templatesDir, 'handlebars');
// const sourceDir = path.join(templatesDir, 'source');
const expectedDir = path.join(templatesDir, 'expected');

test(prepare(hbsDir, expectedDir));
// test(prepare(sourceDir, expectedDir));
