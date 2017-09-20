'use strict';

const md5 = require('md5');
const Cache = require('node-cache');

const Benchpress = require('./benchpress');
const runtime = require('./runtime');
const evaluate = require('./evaluate');

const compileParseCache = new Cache({
	stdTTL: 60 * 60, // one hour
	useClones: false,
});
const compileParseCallbackCache = {};

/**
 * Compile a template and parse it
 * Automatically caches template function based on hash of input template
 * @param {string} templateSource
 * @param {string} [block]
 * @param {any} data
 * @param {function} callback - (err, output)
 */
function compileParse(templateSource, block, data, callback) {
	if (!callback && typeof block === 'object' && typeof data === 'function') {
		callback = data;
		data = block;
		block = null;
	}
	if (!templateSource) {
		callback('');
		return;
	}

	const hash = md5(templateSource);
	function run(templateFunction) {
		if (block) {
			templateFunction = templateFunction.blocks && templateFunction.blocks[block];
		}

		try {
			const output = runtime(Benchpress.helpers, data, templateFunction);
			process.nextTick(callback, null, output);
		} catch (e) {
			callback(e);
		}
	}

	const cached = compileParseCache.get(hash);
	if (cached) {
		compileParseCache.ttl(hash);
		run(cached);
		return;
	}
	if (compileParseCallbackCache[hash]) {
		compileParseCallbackCache[hash].push(run);
		return;
	}

	compileParseCallbackCache[hash] = [run];
	Benchpress.precompile({ source: templateSource }, (err, code) => {
		if (err) {
			compileParseCallbackCache[hash] = null;
			callback(err);
			return;
		}

		try {
			const templateFunction = evaluate(code);
			compileParseCache.set(hash, templateFunction);

			compileParseCallbackCache[hash].forEach(next => next(templateFunction));
			compileParseCallbackCache[hash] = null;
		} catch (e) {
			e.message = `Parsing failed for template ${templateSource.slice(0, 20)}:\n ${e.message}`;
			e.stack = `Parsing failed for template ${templateSource.slice(0, 20)}:\n ${e.stack}`;
			callback(e);
		}
	});
}

module.exports = compileParse;
