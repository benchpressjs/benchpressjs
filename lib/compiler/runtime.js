'use strict';

/**
 * Get the value from an object path or return an empty string if any part fails
 * @param {object} context - Base data object
 * @param {string} path - Key path (`a.b.0.c`)
 * @param {string} fallback - If path not found in context, return this string
 * @returns {any}
 */
function get(context, path, fallback) {
	fallback = fallback || '';
	if (path === '@root') {
		return context;
	}
	let res = context;

	const paths = path.split('.');
	const len = paths.length;
	for (let i = 0; i < len; i += 1) {
		res = res[paths[i]];
		if (res == null) {
			return fallback;
		}
	}

	return res;
}

/**
 * Iterate over an object or array
 * @param {object} context - Base data object
 * @param {string} path - Path to the iteratee
 * @param {function} echo - Text output function
 * @param {function} each - Callback to execute on each item
 */
function iter(context, path, echo, each) {
	const obj = get(context, path);
	if (typeof obj !== 'object') {
		echo('');
		return;
	}

	const keys = Object.keys(obj);
	const length = keys.length;
	keys.forEach((key, index) => each(key, index, length));
}

/**
 * Execute a helper
 * @param {object} context - Base data object
 * @param {object} helpers - Map of helper functions
 * @param {string} helperName - Name of helper to execute
 * @param {any[]} args - Array of arguments
 * @returns {string}
 */
function helper(context, helpers, helperName, args) {
	if (typeof helpers[helperName] !== 'function') {
		return '';
	}
	try {
		const out = helpers[helperName].apply(context, args);
		return out || '';
	} catch (e) {
		return '';
	}
}

/**
 * Run a compiled template function
 * @param {object} helpers - Map of helper functions
 * @param {object} context - Base data object
 * @param {function} templateFunction - Compiled template function
 * @returns {string}
 */
function runtime(helpers, context, templateFunction) {
	let output = '';

	const localEcho = (str) => { output += str; };
	const localGet = (path, fallback) => get(context, path, fallback);
	const localIter = (path, each) => iter(context, path, localEcho, each);
	const localHelper = (helperName, args) => helper(context, helpers, helperName, args);

	templateFunction(localGet, localIter, localHelper, localEcho);

	return output;
}

/* build:SERVER-ONLY:open */

module.exports = runtime;

/* build:SERVER-ONLY:close */
