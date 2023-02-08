'use strict';

const path = require('path');
const fs = require('fs');

const benchpress = require('../../lib/benchpress');

async function prep() {
  const [categories, topics] = Promise.all(
    ['categories.tpl', 'topic.tpl']
      .map(async name => fs.readFile(path.join(__dirname, name), 'utf8'))
  );

  function bench(deferred) {
    return benchpress.precompile(categories, { filename: 'tests/bench/categories.tpl' })
      .then(() => benchpress.precompile(topics, { filename: 'tests/bench/topic.tpl' }))
      .then(() => deferred.resolve(), err => deferred.reject(err));
  }

  return { bench };
}

module.exports = prep;
