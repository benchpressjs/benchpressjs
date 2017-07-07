'use strict';

/**
 * Get the value from an object path or return an empty string if any part fails
 * @param {object} context - Base data object
 * @param {string[]} paths - Key path (`['a', 'b', 0, 'c']`)
 * @returns {any}
 */
function get(context, paths) {
	let obj = context;
	let index = 0;
	const length = paths.length;

	while (obj != null && index < length) {
		obj = obj[paths[index]];
		index += 1;
	}

	return obj == null ? '' : obj;
}

/**
 * Iterate over an object or array
 * @param {object} context - Base data object
 * @param {string[]} paths - Path to the iteratee
 * @param {function} each - Callback to execute on each item
 * @return {string}
 */
function iter(context, paths, each) {
	const obj = get(context, paths);
	if (typeof obj !== 'object') {
		return '';
	}

	let output = '';
	const keys = Object.keys(obj);
	const length = keys.length;

	for (let i = 0; i < length; i += 1) {
		output += each(keys[i], i, length);
	}

	return output;
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
	return templateFunction(helpers, context, get, iter, helper);
}

/* build:SERVER-ONLY:open */

module.exports = runtime;

/* build:SERVER-ONLY:close */
