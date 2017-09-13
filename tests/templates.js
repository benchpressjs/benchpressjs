'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');

const { prepare, equalsIgnoreWhitespace } = require('./lib/utils');
const benchpress = require('../build/lib/benchpress');
const mainData = require('./data.json');

const logDir = path.join(__dirname, 'logs');

function logFailure({ name, source, code, expected, output, err }) {
	if (output !== expected) {
		fs.writeFileSync(path.join(logDir, `${name}.log`), `
			==== source ====
			${source}

			==== code ====
			${code == null ? `PRECOMPILE FAILED: ${err}` : code}

			==== output ====
			${output == null ? `PRECOMPILE FAILED: ${err}` : output}

			==== expected ====
			${expected}
		`);
	} else {
		try {
			fs.unlinkSync(path.join(logDir, `${name}.log`));
		} catch (e) {
			if (e.code !== 'ENOENT') {
				throw e;
			}
			// ignore error
		}
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
							err: err.message,
						});
						done(err);
						return;
					}

					cache[key] = benchpress.evaluate(code);

					benchpress.parse(key, mainData, (parsed) => {
						const expect = expected[key];

						logFailure({
							source: source[key],
							expected: expect,
							code,
							parsed,
							name: key,
						});

						equalsIgnoreWhitespace(parsed, expect);
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
					const expect = expected[name];

					logFailure({
						name,
						source: source[name],
						code,
						expected: expect,
						parsed,
					});

					equalsIgnoreWhitespace(parsed, expect);
					done();
				});
			});
		});
	});
}


benchpress.registerHelper('canspeak', data /* , iterator, numblocks ) */ =>
	((data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak'));

benchpress.registerHelper('test', data => (data.forum && !data.double));

benchpress.registerHelper('isHuman', (data, iterator) => data.animals[iterator].isHuman);

benchpress.registerHelper('caps', text => text.toUpperCase());

const templatesDir = path.join(__dirname, 'templates');
const sourceDir = path.join(templatesDir, 'source');
const expectedDir = path.join(templatesDir, 'expected');

test(prepare(sourceDir, expectedDir));
