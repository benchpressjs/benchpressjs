'use strict';

/* global describe, it */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const prepare = require('./prepare');
const transpile = require('./../../lib/transpile');

const logDir = path.join(__dirname, '../logs/');

function test([source, expected, missing]) {
	describe('transpile to handlebars', () => {
		const keys = Object.keys(source);

		keys.forEach(key => {
			it(key, () => {
				const transpiled = transpile(source[key]).replace(/\r\n/g, '\n');
				const expect = expected[key].replace(/\r\n/g, '\n');

				if (transpiled !== expect) {
					fs.writeFile(path.join(logDir, `${key}.log`), transpiled);
				} else {
					fs.unlink(path.join(logDir, `${key}.log`), () => {});
				}

				assert.equal(transpiled, expect);
			});
		});

		if (missing.length) {
			setTimeout(() => {
				winston.warn(`[transpile to handlebars] Missing expected files: [  ${missing.join(', \t')}  ]`);
			}, 200);
		}
	});
}

const templatesDir = path.join(__dirname, '../templates/');
const sourceDir = path.join(templatesDir, 'source');
const expectedDir = path.join(templatesDir, 'handlebars');

test(prepare(sourceDir, expectedDir));
