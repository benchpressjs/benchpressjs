'use strict';

const vm = require('vm');

/**
 * Evaluate a compiled template for use on the server
 * @private
 * @param {string} code - Compiled JS code
 * @returns {function}
 */
function evaluate(code) {
  const context = {
    module: {
      exports: {},
    },
  };
  vm.runInNewContext(code, context, {
    timeout: 50,
  });
  const template = context.module.exports;

  return template;
}

module.exports = evaluate;
