'use strict';

const path = require('path');
const fs = require('fs');
const async = require('async');

const benchpress = require('../../build/lib/benchpress');
const evaluate = require('../../build/lib/evaluate');
const data = require('./categories.json');

const templatePath = path.join(__dirname, 'categories.tpl');

function prep(callback) {
  async.waterfall([
    next => fs.readFile(templatePath, 'utf8', next),
    (source, next) => benchpress.precompile({ source, filename: 'tests/bench/categories.tpl' }, next),
    (code, next) => {
      const template = evaluate(code);
      function bench(deferred) {
        benchpress.render('categories', data).then(() => deferred.resolve());
      }

      next(null, { bench, template });
    },
  ], callback);
}

module.exports = prep;
