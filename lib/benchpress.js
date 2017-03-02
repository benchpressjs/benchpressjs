'use strict';

const Benchpress = {};

/* build:SERVER-ONLY:open */

const fs = require('fs');
const vm = require('vm');
const uglifyjs = require('uglify-js');

const prefixer = require('./compiler/prefixer');
const tokenizer = require('./compiler/tokenizer');
const parser = require('./compiler/parser');
const compiler = require('./compiler/compiler');
const codegen = require('./compiler/codegen');
const runtime = require('./compiler/runtime');

/**
 * Precompile a benchpress template
 * @param {object} options
 * @param {string} options.source - Template source
 * @param {string} [options.name] - Name of template
 * @param {boolean} [options.minify] - Whether to output a minified file
 * @param {function} callback - (err, output)
 */
Benchpress.precompile = function precompile({ source, name, minify }, callback) {
	try {
		const prefixed = prefixer(source);
		const tokens = tokenizer(prefixed);
		const parsed = parser(tokens);
		const ast = compiler(parsed);
		const compiled = codegen(ast);

		const wrapped = `(function (templateFunction) {
			if (typeof module === 'object' && module.exports) {
				module.exports = templateFunction;
			} else if (typeof define === 'function' && define.amd) {
				define(templateFunction);
			}
		})(${compiled});`;

		if (!minify) {
			callback(null, wrapped);
			return;
		}

		const minified = uglifyjs.minify(wrapped, {
			fromString: true,
		}).code;
		callback(null, minified);
	} catch (e) {
		callback(e);
	}
};

/**
 * Provide functionality to act as an express engine
 * @param {string} filepath - Compiled template file path
 * @param {object} data - Data with which to parse the template
 * @param {function} next - (err, output)
 */
Benchpress.__express = function __express(filepath, data, next) {
	const name = filepath
		.replace(`${data.settings.views}[/\\]`, '');

	data = addGlobals(data);
	data._locals = null;

	if (Benchpress.cache[name]) {
		try {
			const template = Benchpress.cache[name];
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
			const template = Benchpress.cache[name] = Benchpress.evaluate(code);

			next(null, runtime(Benchpress.helpers, data, template));
		} catch (e) {
			next(e);
		}
	});
};

/**
 * Evaluate a compiled template for use on the server
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
		timeout: 10,
	});
	const template = context.module.exports;

	return template;
};

module.exports = Benchpress;

/* build:SERVER-ONLY:close */

Benchpress.helpers = {};

/**
 * Register a helper function
 * @param {string} name - Helper name
 * @param {function} fn - Helper function
 */
Benchpress.registerHelper = function registerHelper(name, fn) {
	Benchpress.helpers[name] = fn;
};

Benchpress.cache = {};

Benchpress.globals = {};

/**
 * Set a global data value
 * @param {string} key - Property key
 * @param {object} value - Property value
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
 * @param {string} template - Name of template to Fetch
 * @param {object} data - Data with which to run the template
 * @param {function} callback - callback(output)
 */
Benchpress.parse = function parse(template, data, callback) {
	if (!template) {
		callback('');
		return;
	}

	data = addGlobals(data || {});

	if (Benchpress.cache[template]) {
		const templateFunction = Benchpress.cache[template];
		callback(runtime(Benchpress.helpers, data, templateFunction));
	} else {
		Benchpress.loader(template, loaded => callback(runtime(Benchpress.helpers, data, loaded)));
	}
};

/**
 * Register a loader function to fetch templates
 * @param {function} loader - (name, callback) => callback(templateFunction)
 */
Benchpress.registerLoader = function registerLoader(loader) {
	Benchpress.loader = loader;
};
