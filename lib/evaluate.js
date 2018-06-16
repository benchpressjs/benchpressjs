'use strict';

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

  const renderFunction = new Function('module', code); // eslint-disable-next-line no-new-func
  renderFunction(context.module);

  const template = context.module.exports;

  return template;
}

module.exports = evaluate;
