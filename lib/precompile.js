'use strict';

const uglifyjs = require('uglify-js');
const fs = require('fs');

const prefixer = require('./compiler/prefixer');
const tokenizer = require('./compiler/tokenizer');
const parser = require('./compiler/parser');
const compiler = require('./compiler/compiler');
const blocks = require('./compiler/blocks');
const codegen = require('./compiler/codegen');

function wrap(compiled) {
  return `
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
}

function compileFallback(source, opts) {
  const prefixed = prefixer(source);
  const tokens = tokenizer(prefixed);
  const parsed = parser(tokens);
  const fnAst = compiler(parsed, opts);
  const ast = blocks(fnAst);
  const code = codegen(ast, { minified: opts.minify });

  return wrap(code);
}

function minify(wrapped) {
  const result = uglifyjs.minify(wrapped);

  if (result.error) {
    throw result.error;
  }

  return result.code;
}

const compile = (() => {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    return require('../../rust/benchpress-rs').compile;
  } catch (e) {
    const platform = `${process.platform}_${process.versions.modules}`;
    /* eslint-disable no-console */
    console.warn('[benchpressjs] Unable to build or find a suitable native module, falling back to JS version.');
    console.warn('[benchpressjs] This is non-fatal, but will result in much longer template build times.');
    if (e.code === 'MODULE_NOT_FOUND') {
      try {
        fs.accessSync(require.resolve(`../../rust/benchpress-rs/pre-built/${platform}.node`), fs.constants.R_OK);
        console.warn(`[benchpressjs] Pre-built module (${platform}) exists, but was not in the correct location.`);
      } catch (accessErr) {
        console.warn(`[benchpressjs] No pre-built native module for platform: ${platform}`);
      }
    } else {
      console.warn(`[benchpressjs] Pre-built module failed to load: ${platform}`);
      console.error(e);
    }
    console.warn('[benchpressjs] Visit `https://github.com/benchpressjs/benchpressjs/blob/master/README.md#installation` for more info');

    /* eslint-enable no-console */
    return compileFallback;
  }
})();

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
 * @param {boolean} [options.native = true] - Use the native Rust compiler if available
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

    // benchpress-rs doesn't support unsafe yet
    const compiled = (opts.unsafe || opts.native === false ? compileFallback : compile)(
      source,
      opts
    );
    return opts.minify ? minify(compiled) : compiled;
  });

  if (callback) {
    promise.then(
      code => process.nextTick(callback, null, code),
      err => process.nextTick(callback, err),
    );
  }

  return promise;
}

precompile.isNative = compile !== compileFallback;

precompile.defaults = {
  minify: false,
  unsafe: false,
  native: true,
};

module.exports = precompile;
