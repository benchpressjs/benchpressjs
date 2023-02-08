'use strict';

const path = require('path');
const fs = require('fs').promises;

const benchpress = require('../../lib/benchpress');
const evaluate = require('../../lib/evaluate');
const data = require('./topic.json');

const templatePath = path.join(__dirname, 'topic.tpl');

async function prep() {
  const source = await fs.readFile(templatePath, 'utf8');
  const code = await benchpress.precompile({ source, filename: 'tests/bench/topic.tpl' });
  const template = evaluate(code);
  function bench(deferred) {
    benchpress.render('topic', data).then(() => deferred.resolve());
  }
  return { bench, template };
}

module.exports = prep;
