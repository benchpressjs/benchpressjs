'use strict';

const fs = require('fs');

const Benchpress = require('./benchpress');
const runtime = require('./runtime');
const evaluate = require('./evaluate');

function render(filepath, data, template, next) {
  try {
    const output = runtime(Benchpress.helpers, data, template);

    process.nextTick(next, null, output);
  } catch (e) {
    e.message = `Render failed for template ${filepath}:\n ${e.message}`;
    e.stack = `Render failed for template ${filepath}:\n ${e.stack}`;

    process.nextTick(next, e);
  }
}

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
    render(filepath, data, Benchpress.cache[filepath], next);
    return;
  }

  fs.readFile(filepath, 'utf-8', (err, code) => {
    if (err) {
      next(err);
      return;
    }

    let template;
    try {
      template = Benchpress.cache[filepath] = evaluate(code);
    } catch (e) {
      e.message = `Evaluate failed for template ${filepath}:\n ${e.message}`;
      e.stack = `Evaluate failed for template ${filepath}:\n ${e.stack}`;

      process.nextTick(next, e);
      return;
    }

    render(filepath, data, template, next);
  });
}

module.exports = __express;
