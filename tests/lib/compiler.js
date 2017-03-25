'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const { prepare, collapseWhitespace } = require('./utils');
const benchpress = require('../../build/lib/benchpress');
const mainData = require('../data.json');

const logDir = path.join(__dirname, '../logs/');

function logFailure({ name, source, code, expected, output }) {
	if (output !== expected) {
		fs.writeFile(path.join(logDir, `${name}.log`), `
==== source ====
${source}


==== code ====
${code || 'PRECOMPILE FAILED'}


==== output ====
${output || 'PRECOMPILE FAILED'}


==== expected ====
${expected}
		`, () => {});
	} else {
		fs.unlink(path.join(logDir, `${name}.log`), () => {});
	}
}

const cache = {};

benchpress.registerLoader((name, callback) => {
	callback(cache[name]);
});

function test([source, expected, missing]) {
	describe('compiler', () => {
		const keys = Object.keys(source);

		keys.forEach((key) => {
			it(key, (done) => {
				benchpress.precompile({ source: source[key] }, (err, code) => {
					if (err) {
						logFailure({
							source: source[key],
							expected: expected[key],
							name: key,
						});
						done(err);
						return;
					}

					cache[key] = benchpress.evaluate(code);

					benchpress.parse(key, mainData, (parsed) => {
						const output = collapseWhitespace(parsed);
						const expect = collapseWhitespace(expected[key]);

						logFailure({
							source: source[key],
							expected: expect,
							code,
							output,
							name: key,
						});

						assert.equal(output, expect);
						done();
					});
				});
			});
		});

		if (missing.length) {
			setTimeout(() => {
				winston.warn(`[templates.js] Missing expected files: ${JSON.stringify(missing, null, 2)}`);
			}, 200);
		}
	});

	describe('named-blocks', () => {
		it('should work', (done) => {
			const name = 'loop-inside-if-else';
			const blockName = 'rooms';
			benchpress.precompile({ source: source[name] }, (err, code) => {
				if (err) {
					done(err);
					return;
				}

				cache[name] = benchpress.evaluate(code);

				benchpress.parse(name, blockName, mainData, (parsed) => {
					const output = collapseWhitespace(parsed);
					const expect = collapseWhitespace(expected[name]);

					logFailure({
						name,
						source: source[name],
						code,
						expected: expect,
						output,
					});

					assert.equal(output, expect);
					done();
				});
			});
		});
	});
}


benchpress.registerHelper('canspeak', data /* , iterator, numblocks )*/ =>
	((data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak'));

benchpress.registerHelper('test', data => (data.forum && !data.double));

benchpress.registerHelper('isHuman', (data, iterator) => data.animals[iterator].isHuman);

const templatesDir = path.join(__dirname, '../templates');
const sourceDir = path.join(templatesDir, 'source');
const expectedDir = path.join(templatesDir, 'expected');

test(prepare(sourceDir, expectedDir));
