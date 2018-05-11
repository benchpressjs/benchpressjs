'use strict';

const addon = require('../native'); // eslint-disable-line import/no-unresolved

/**
 * Precompile a template into a JS module
 * @param {string} source - template source
 * @returns {string} - JS module
 */
exports.compile = function compile(source) {
  return addon.compile(source == null ? '' : source.toString());
};
