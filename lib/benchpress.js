'use strict';

const Benchpress = {};

/* build:SERVER-ONLY:open */

const fs = require('fs');
const vm = require('vm');
const md5 = require('md5');
const Cache = require('node-cache');
const uglifyjs = require('uglify-js');

const prefixer = require('./compiler/prefixer');
const tokenizer = require('./compiler/tokenizer');
const parser = require('./compiler/parser');
const compiler = require('./compiler/compiler');
const blocks = require('./compiler/blocks');
const codegen = require('./compiler/codegen');
const runtime = require('./compiler/runtime');

/**
 * Precompile a benchpress template
 * @param {Object} options
 * @param {string} options.source - Template source
 * @param {boolean} [options.minify = false] - Whether to output minified code
 * @param {function} callback - (err, output)
 */
Benchpress.precompile = function precompile(options, callback) {
	let minified;

	try {
		const { source, minify } = options;

		const prefixed = prefixer(source);
		const tokens = tokenizer(prefixed);
		const parsed = parser(tokens);
		const fnAst = compiler(parsed);
		const ast = blocks(fnAst);
		const compiled = codegen(ast);

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

		if (!minify) {
			minified = wrapped;
		} else {
			minified = uglifyjs.minify({
				'benchpress.js': wrapped,
			}).code;
		}
	} catch (e) {
		callback(e);
		return;
	}

	callback(null, minified);
};

/**
 * Provide functionality to act as an express engine
 * @param {string} filepath - Compiled template file path
 * @param {Object} data - Data with which to parse the template
 * @param {function} next - (err, output)
 */
Benchpress.__express = function __express(filepath, data, next) {
	data = addGlobals(data);
	data._locals = null;

	if (Benchpress.cache[filepath]) {
		try {
			const template = Benchpress.cache[filepath];
			next(null, runtime(Benchpress.helpers, data, template));
		} catch (e) {
			next(e);
		}
		return;
	}

	fs.readFile(filepath, 'utf-8', (err, file) => {
		if (err) {
			next(err);
			return;
		}

		const code = file.toString();
		try {
			const template = Benchpress.cache[filepath] = Benchpress.evaluate(code);

			next(null, runtime(Benchpress.helpers, data, template));
		} catch (e) {
			next(e);
		}
	});
};

/**
 * Evaluate a compiled template for use on the server
 * @private
 * @param {string} code - Compiled JS code
 * @returns {function}
 */
Benchpress.evaluate = function evaluate(code) {
	const context = {
		module: {
			exports: {},
		},
	};
	vm.runInNewContext(code, context, {
		timeout: 20,
	});
	const template = context.module.exports;

	return template;
};

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
Benchpress.compileParse = function compileParse(templateSource, block, data, callback) {
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
		callback(null, runtime(Benchpress.helpers, data, templateFunction));
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

		const templateFunction = Benchpress.evaluate(code);
		compileParseCache.set(hash, templateFunction);

		compileParseCallbackCache[hash].forEach(next => next(templateFunction));
		compileParseCallbackCache[hash] = null;
	});
};

module.exports = Benchpress;

/* build:SERVER-ONLY:close */

Benchpress.runtime = runtime;

Benchpress.helpers = {};

/**
 * Register a helper function
 * @param {string} name - Helper name
 * @param {function} fn - Helper function
 */
Benchpress.registerHelper = function registerHelper(name, fn) {
	Benchpress.helpers[name] = fn;
};

const freeze = Object.freeze || (obj => obj);

// add default escape function for escaping HTML entities
const escapeCharMap = freeze({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#x27;',
	'`': '&#x60;',
	'=': '&#x3D;',
});
const replaceChar = c => escapeCharMap[c];
const escapeChars = /[&<>"'`=]/g;

Benchpress.registerHelper('__escape', (str) => {
	if (str == null) {
		return '';
	}
	if (!str) {
		return String(str);
	}

	return str.toString().replace(escapeChars, replaceChar);
});

Benchpress.cache = {};

Benchpress.globals = {};

/**
 * Set a global data value
 * @param {string} key - Property key
 * @param {Object} value - Property value
 */
Benchpress.setGlobal = function setGlobal(key, value) {
	Benchpress.globals[key] = value;
};

const assign = Object.assign || jQuery.extend; // eslint-disable-line

function addGlobals(data) {
	return assign({}, Benchpress.globals, data);
}

/**
 * Clear the template cache
 */
Benchpress.flush = function flush() {
	Benchpress.cache = {};
};

/**
 * Fetch and run the given template
 * @param {string} template - Name of template to fetch
 * @param {string} [block] - Parse only this block in the template
 * @param {Object} data - Data with which to run the template
 * @param {function} callback - callback(output)
 */
Benchpress.parse = function parse(template, block, data, callback) {
	if (!callback && typeof block === 'object' && typeof data === 'function') {
		callback = data;
		data = block;
		block = null;
	}
	if (typeof callback !== 'function') {
		// Calling parse synchronously with no callback is discontinued
		throw TypeError('Invalid Arguments: callback must be a function');
	}
	if (!template) {
		callback('');
		return;
	}

	data = addGlobals(data || {});

	function run(templateFunction) {
		if (block) {
			templateFunction = templateFunction.blocks && templateFunction.blocks[block];
		}
		if (!templateFunction) {
			callback('');
			return;
		}

		callback(runtime(Benchpress.helpers, data, templateFunction));
	}

	if (Benchpress.cache[template]) {
		const templateFunction = Benchpress.cache[template];
		run(templateFunction);
	} else {
		Benchpress.loader(template, (templateFunction) => {
			Benchpress.cache[template] = templateFunction;
			run(templateFunction);
		});
	}
};

/**
 * Register a loader function to fetch templates
 * @param {function} loader - (name, callback) => callback(templateFunction)
 */
Benchpress.registerLoader = function registerLoader(loader) {
	Benchpress.loader = loader;
};
