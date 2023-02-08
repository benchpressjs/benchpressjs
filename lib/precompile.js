'use strict';

// eslint-disable-next-line import/no-unresolved, import/extensions
const { compile } = require('../build/compiler');

/**
 * Precompile a benchpress template
 * - `precompiled(source): Promise<string>`
 * - `precompile(source, {}, callback) => callback(err, output)`
 * - `precompile({ source }, callback) => callback(err, output)`
 *
 * @param {string} source - Template source
 * @param {string} options.filename - Template file name for diagnostics
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

  const filename = (options && options.filename) || '<unknown>';

  const promise = Promise.try(() => {
    if (typeof source !== 'string') {
      throw Error('source must be a string');
    }

    return compile(source, filename);
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
