'use strict';

/**
 * Get the value from an object path or return an empty string if any part fails
 * @param {object} context - Base data object
 * @param {string[]} paths - Key path (`['a', 'b', 0, 'c']`)
 * @param {string} fallback - If path not found in context, return this string
 * @returns {any}
 */
function get(context, paths, fallback) {
	fallback = fallback || '';
	if (paths[0] === '@root') {
		return context;
	}
	let res = context;

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
 * @param {string[]} paths - Path to the iteratee
 * @param {function} echo - Text output function
 * @param {function} each - Callback to execute on each item
 */
function iter(context, paths, echo, each) {
	const obj = get(context, paths);
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
	const localGet = (paths, fallback) => get(context, paths, fallback);
	const localIter = (paths, each) => iter(context, paths, localEcho, each);
	const localHelper = (helperName, args) => helper(context, helpers, helperName, args);

	templateFunction(localGet, localIter, localHelper, localEcho);

	return output;
}

/* build:SERVER-ONLY:open */

module.exports = runtime;

/* build:SERVER-ONLY:close */
