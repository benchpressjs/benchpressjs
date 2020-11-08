'use strict';

const path = require('path');
const fs = require('fs');
const async = require('async');

const benchpress = require('../../build/lib/benchpress');

const templatePaths = ['categories.tpl', 'topic.tpl'].map(name => path.join(__dirname, name));

function prep(callback) {
  async.waterfall([
    next => async.map(
      templatePaths,
      (templatePath, cb) => fs.readFile(templatePath, 'utf8', cb),
      next
    ),
    ([categories, topics], next) => {
      function bench(deferred) {
        return benchpress.precompile(categories)
          .then(() => benchpress.precompile(topics))
          .then(() => deferred.resolve(), err => deferred.reject(err));
      }

      next(null, { bench });
    },
  ], callback);
}

module.exports = prep;
