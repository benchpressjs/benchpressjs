'use strict';

const fs = require('fs');

const Benchpress = require('./benchpress.js');
const runtime = require('./runtime');
const evaluate = require('./evaluate');

/**
 * Provide functionality to act as an express engine
 * @param {string} filepath - Compiled template file path
 * @param {Object} data - Data with which to parse the template
 * @param {function} next - (err, output)
 */
function __express(filepath, data, next) {
  data = Benchpress.addGlobals(data);
  data._locals = null;

  if (Benchpress.cache[filepath]) {
    try {
      const template = Benchpress.cache[filepath];
      const output = runtime(Benchpress.helpers, data, template);

      process.nextTick(next, null, output);
    } catch (e) {
      process.nextTick(next, e);
    }
    return;
  }

  fs.readFile(filepath, 'utf-8', (err, file) => {
    if (err) {
      next(err);
      return;
    }

    const code = file.toString();
    try {
      const template = Benchpress.cache[filepath] = evaluate(code);
      const output = runtime(Benchpress.helpers, data, template);

      process.nextTick(next, null, output);
    } catch (e) {
      e.message = `Parsing failed for template ${filepath}:\n ${e.message}`;
      e.stack = `Parsing failed for template ${filepath}:\n ${e.stack}`;

      process.nextTick(next, e);
    }
  });
}

module.exports = __express;
