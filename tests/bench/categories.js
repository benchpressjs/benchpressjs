'use strict';

const path = require('path');
const fs = require('fs');

const benchpress = require('../../build/lib/benchpress');
const evaluate = require('../../build/lib/evaluate');
const data = require('./categories.json');

const templatePath = path.join(__dirname, 'categories.tpl');

async function prep() {
  const source = await fs.readFile(templatePath, 'utf8');
  const code = await benchpress.precompile({ source, filename: 'tests/bench/categories.tpl' });
  const template = evaluate(code);
  function bench(deferred) {
    benchpress.render('categories', data).then(() => deferred.resolve());
  }
  return { bench, template };
}

module.exports = prep;
