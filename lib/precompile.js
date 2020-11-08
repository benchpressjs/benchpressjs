'use strict';

// eslint-disable-next-line import/no-unresolved
const { compile } = require('../compiler');

/**
 * Precompile a benchpress template
 * - `precompiled(source): Promise<string>`
 * - `precompile(source, {}, callback) => callback(err, output)`
 * - `precompile({ source }, callback) => callback(err, output)`
 *
 * @param {string} source - Template source
 * @param {function} [callback] - (err, output)
 * @returns {Promise<string>} - output code
 */
function precompile(source, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }
  if (typeof source === 'object') {
    options = source;
    source = options.source;
  }

  const promise = Promise.try(() => {
    if (typeof source !== 'string') {
      throw Error('source must be a string');
    }

    return compile(source);
  });

  if (callback) {
    promise.then(
      code => process.nextTick(callback, null, code),
      err => process.nextTick(callback, err),
    );
  }

  return promise;
}

module.exports = precompile;
