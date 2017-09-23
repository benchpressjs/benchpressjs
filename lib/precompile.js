'use strict';

const uglifyjs = require('uglify-js');

const prefixer = require('./compiler/prefixer');
const tokenizer = require('./compiler/tokenizer');
const parser = require('./compiler/parser');
const compiler = require('./compiler/compiler');
const blocks = require('./compiler/blocks');
const codegen = require('./compiler/codegen');

/**
 * Precompile a benchpress template
 * - `precompiled(source, options): Promise<string>`
 * - `precompile(source, options, callback) => callback(err, output)`
 * - `precompile({ source, ...options }, callback) => callback(err, output)`
 *
 * @param {string} source - Template source
 * @param {Object} options
 * @param {boolean} [options.minify = false] - Output minified code
 * @param {boolean} [options.unsafe = false] - Disable safety checks, will throw on misshapen data
 * @param {function} [callback] - (err, output)
 * @returns {Promise<string>} - output code
 */
function precompile(source, options, callback) {
  if (typeof source === 'object' && typeof options === 'function') {
    callback = options;
    options = source;
    source = options.source;
  }

  const promise = Promise.try(() => {
    const opts = Object.assign({}, precompile.defaults, options);

    if (typeof source !== 'string') {
      throw Error('source must be a string');
    }

    const prefixed = prefixer(source);
    const tokens = tokenizer(prefixed);
    const parsed = parser(tokens);
    const fnAst = compiler(parsed, opts);
    const ast = blocks(fnAst);
    const compiled = codegen(ast, { minified: opts.minify });

    const wrapped = `
(function (factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  }
})(function () {
  ${compiled.replace(/\n/g, '\n\t')}

  return compiled;
});
    `;

    if (!opts.minify) {
      return wrapped;
    }
    const result = uglifyjs.minify({
      'benchpress.js': wrapped,
    });

    if (result.error) {
      throw result.error;
    }

    return result.code;
  });

  if (callback) {
    promise.then(
      code => process.nextTick(callback, null, code),
      err => process.nextTick(callback, err),
    );
  }

  return promise;
}

precompile.defaults = {
  minify: false,
  unsafe: false,
};

module.exports = precompile;
