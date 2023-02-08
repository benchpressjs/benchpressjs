'use strict';

/**
 * Convert null and undefined values to empty strings
 * @param {any} value
 * @returns {string}
 */
function guard(value) {
  return value == null || (Array.isArray(value) && value.length === 0) ? '' : value;
}

/**
 * Iterate over an object or array
 * @param {string[]} obj - Iteratee object / array
 * @param {function} each - Callback to execute on each item
 * @return {string}
 */
function iter(obj, each) {
  if (!obj || typeof obj !== 'object') { return ''; }

  let output = '';
  const keys = Object.keys(obj);
  const length = keys.length;

  for (let i = 0; i < length; i += 1) {
    const key = keys[i];
    output += each(key, i, length, obj[key]);
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
  return guard(templateFunction(helpers, context, guard, iter, helper)).toString();
}

/* build:SERVER-ONLY:open */

module.exports = runtime;

/* build:SERVER-ONLY:close */

// polyfill for Promise.try
if (typeof Promise.try !== 'function') {
  Promise.try = {
    try(fn) {
      return new Promise((resolve) => { resolve(fn()); });
    },
  }.try;
}
