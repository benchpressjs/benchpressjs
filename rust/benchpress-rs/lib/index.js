'use strict';

const addon = (() => {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    return require('../native');
  } catch (e) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(`../pre-built/${process.platform}_${process.versions.modules}`);
  }
})();

/**
 * Precompile a template into a JS module
 * @param {string} source - template source
 * @returns {string} - JS module
 */
exports.compile = function compile(source) {
  return addon.compile(source == null ? '' : source.toString());
};
