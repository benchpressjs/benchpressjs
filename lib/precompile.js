'use strict';

const uglifyjs = require('uglify-js');

const prefixer = require('./compiler/prefixer');
const tokenizer = require('./compiler/tokenizer');
const parser = require('./compiler/parser');
const compiler = require('./compiler/compiler');
const blocks = require('./compiler/blocks');
const codegen = require('./compiler/codegen');

/**
 * Precompile a benchpress template
 * @param {Object} options
 * @param {string} options.source - Template source
 * @param {boolean} [options.minify = false] - Output minified code
 * @param {boolean} [options.unsafe = true] - Disable safety checks, will throw on misshapen data
 * @param {function} callback - (err, output)
 */
function precompile(options, callback) {
	try {
		const opts = Object.assign({}, precompile.defaults, options);

		if (typeof opts.source !== 'string') {
			throw Error('source must be a string');
		}

		const prefixed = prefixer(opts.source);
		const tokens = tokenizer(prefixed);
		const parsed = parser(tokens);
		const fnAst = compiler(parsed, opts);
		const ast = blocks(fnAst);
		const compiled = codegen(ast, { minified: opts.minify });

		const wrapped = `
(function (factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		define(factory);
	}
})(function () {
	${compiled.replace(/\n/g, '\n\t')}

	return compiled;
});
		`;

		if (!opts.minify) {
			process.nextTick(() => callback(null, wrapped));
		} else {
			const result = uglifyjs.minify({
				'benchpress.js': wrapped,
			});

			if (result.error) {
				callback(result.error);
				return;
			}

			process.nextTick(callback, null, result.code);
		}
	} catch (e) {
		process.nextTick(callback, e);
	}
}

precompile.defaults = {
	minify: false,
	unsafe: false,
};

module.exports = precompile;
