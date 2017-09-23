'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Benchpress = require('../build/lib/benchpress');

const tplPath = path.join(__dirname, './templates/source/conditional-with-else-inside-loop.tpl');
const template = fs.readFileSync(tplPath).toString();

describe('precompile', () => {
	it('should work with Promise usage', () =>
		Benchpress.precompile(template, {})
			.then((code) => {
				assert(code);
				assert(code.length);
			})
	);

	it('should work with callback usage', (done) => {
		Benchpress.precompile(template, {}, (err, code) => {
			assert.ifError(err);

			assert(code);
			assert(code.length);
			done();
		});
	});

	it('should work with old arguments', (done) => {
		Benchpress.precompile({ source: template }, (err, code) => {
			assert.ifError(err);

			assert(code);
			assert(code.length);
			done();
		});
	});
});
