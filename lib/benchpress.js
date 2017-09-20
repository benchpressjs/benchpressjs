'use strict';

/** @exports Benchpress */
const Benchpress = (typeof module === 'object' && module.exports) ? module.exports : {};

/* build:SERVER-ONLY:open */

const runtime = require('./runtime');
const precompile = require('./precompile');
const __express = require('./express');
const compileRender = require('./compile-render');

Benchpress.precompile = precompile;
Benchpress.__express = __express;
Benchpress.compileParse = Benchpress.compileRender = compileRender;

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

/**
 * @private
 */
Benchpress.addGlobals = function addGlobals(data) {
	return assign({}, Benchpress.globals, data);
};

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
function render(template, block, data, callback) {
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

	data = Benchpress.addGlobals(data || {});

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
}

Benchpress.parse = Benchpress.render = render;

/**
 * Register a loader function to fetch templates
 * @param {function} loader - (name, callback) => callback(templateFunction)
 */
Benchpress.registerLoader = function registerLoader(loader) {
	Benchpress.loader = loader;
};
