'use strict';

/** @exports Benchpress */
const Benchpress = (typeof module === 'object' && module.exports) ? module.exports : {};

/* build:SERVER-ONLY:open */

const runtime = require('./runtime');
const precompile = require('./precompile');
const __express = require('./express');
const evaluate = require('./evaluate');
const { compileRender, compileParse } = require('./compile-render');

Benchpress.precompile = precompile;
Benchpress.__express = __express;
Benchpress.evaluate = evaluate;
Benchpress.compileRender = compileRender;
Benchpress.compileParse = compileParse;

/* build:SERVER-ONLY:close */

Benchpress.runtime = runtime;

Benchpress.helpers = {};

/**
 * Register a helper function
 * @param {string} name - Helper name
 * @param {function} fn - Helper function
 */
Benchpress.registerHelper = function registerHelper(name, fn) {
  Benchpress.helpers[name] = fn;
};

// add default escape function for escaping HTML entities
const escapeCharMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;',
};
const replaceChar = c => escapeCharMap[c];
const escapeChars = /[&<>"'`=]/g;

Benchpress.registerHelper('__escape', (str) => {
  if (str == null) {
    return '';
  }
  if (!str) {
    return String(str);
  }

  return str.toString().replace(escapeChars, replaceChar);
});

Benchpress.cache = {};

Benchpress.globals = {};

/**
 * Set a global data value
 * @param {string} key - Property key
 * @param {Object} value - Property value
 */
Benchpress.setGlobal = function setGlobal(key, value) {
  Benchpress.globals[key] = value;
};

const assign = Object.assign || jQuery.extend; // eslint-disable-line

/**
 * @private
 */
Benchpress.addGlobals = function addGlobals(data) {
  return assign({}, Benchpress.globals, data);
};

/**
 * Clear the template cache
 */
Benchpress.flush = function flush() {
  Benchpress.cache = {};
};

// necessary to support both promises and callbacks
// can remove when `parse` methods are removed
function load(template) {
  return new Promise((resolve, reject) => {
    const promise = Benchpress.loader(template, (templateFunction) => {
      resolve(templateFunction);
    });

    if (promise && promise.then) {
      promise.then(resolve, reject);
    }
  });
}

/**
 * Fetch and run the given template
 * @param {string} template - Name of template to fetch
 * @param {Object} data - Data with which to run the template
 * @param {string} [block] - Parse only this block in the template
 * @returns {Promise<string>} - Rendered output
 */
function render(template, data, block) {
  data = Benchpress.addGlobals(data || {});

  return Promise.try(() => {
    Benchpress.cache[template] = Benchpress.cache[template] || load(template);
    return Benchpress.cache[template];
  }).then((templateFunction) => {
    if (block) {
      templateFunction = templateFunction.blocks && templateFunction.blocks[block];
    }
    if (!templateFunction) {
      return '';
    }

    return runtime(Benchpress.helpers, data, templateFunction);
  });
}

/**
 * Alias for {@link render}, but uses a callback
 * @param {string} template - Name of template to fetch
 * @param {string} [block] - Render only this block in the template
 * @param {Object} data - Data with which to run the template
 * @param {function} callback - callback(output)
 *
 * @deprecated - Use {@link render} instead
 */
function parse(template, block, data, callback) {
  // eslint-disable-next-line no-console
  console.warn('Deprecated: Benchpress.parse is deprecated, to be removed in v3.0.0');

  if (!callback && typeof block === 'object' && typeof data === 'function') {
    callback = data;
    data = block;
    block = null;
  }
  if (typeof callback !== 'function') {
    // Calling parse synchronously with no callback is discontinued
    throw TypeError('Invalid Arguments: callback must be a function');
  }
  if (!template) {
    callback('');
    return;
  }

  render(template, data, block).then(
    output => setTimeout(callback, 0, output),
    err => console.error(err), // eslint-disable-line no-console
  );
}

Benchpress.render = render;
Benchpress.parse = parse;

/**
 * Register a loader function to fetch templates
 * - `loader(name, callback) => callback(templateFunction)`
 * - `loader(name) => Promise<templateFunction>`
 * @param {function} loader
 */
Benchpress.registerLoader = function registerLoader(loader) {
  Benchpress.loader = loader;
};
