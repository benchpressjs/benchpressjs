'use strict';

const Cache = require('node-cache');

const Benchpress = require('./benchpress');
const precompile = require('./precompile');
const runtime = require('./runtime');
const evaluate = require('./evaluate');

const compileRenderCache = new Cache({
  stdTTL: 60 * 60, // one hour
  useClones: false,
});

/**
 * Compile a template and render it
 * Automatically caches template function based on hash of input template
 * @param {string} templateSource
 * @param {any} data
 * @param {string} [block]
 * @returns {Promise<string>} - rendered output
 */
function compileRender(templateSource, data, block) {
  return Promise.try(() => {
    const cached = compileRenderCache.get(templateSource);
    if (cached) {
      compileRenderCache.ttl(templateSource);
      return cached;
    }

    const templateFunction = precompile(templateSource, {})
      .then(code => evaluate(code));

    compileRenderCache.set(templateSource, templateFunction);
    return templateFunction;
  }).then((templateFunction) => {
    if (block) {
      templateFunction = templateFunction.blocks && templateFunction.blocks[block];
    }
    if (!templateFunction) {
      return '';
    }

    return runtime(Benchpress.helpers, data, templateFunction);
  }).catch((err) => {
    err.message = `Render failed for template ${templateSource.slice(0, 20)}:\n ${err.message}`;
    err.stack = `Render failed for template ${templateSource.slice(0, 20)}:\n ${err.stack}`;

    throw err;
  });
}

/**
 * Alias for {@link compileRender}, but uses a callback
 * @param {string} templateSource
 * @param {string} [block]
 * @param {any} data
 * @param {function} callback - (err, output)
 *
 * @deprecated - Use {@link compileRender} instead
 */
function compileParse(templateSource, block, data, callback) {
  // eslint-disable-next-line no-console
  console.warn('Deprecated: Benchpress.compileParse is deprecated, to be removed in v3.0.0');

  if (!callback && typeof block === 'object' && typeof data === 'function') {
    callback = data;
    data = block;
    block = null;
  }
  if (!templateSource) {
    callback('');
    return;
  }

  compileRender(templateSource, data, block)
    .then(
      output => process.nextTick(callback, null, output),
      err => process.nextTick(callback, err),
    );
}

exports.compileRender = compileRender;
exports.compileParse = compileParse;
