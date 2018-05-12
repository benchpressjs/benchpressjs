'use strict';

const fs = require('fs');
const path = require('path');
const async = require('async');
const mkdirp = require('mkdirp');
const assert = require('assert');

const benchpress = require('../../build/lib/benchpress');

let cache = null;
function prepare() {
  if (cache) {
    return cache;
  }

  const templatesDir = path.join(__dirname, '../templates');
  const sourceDir = path.join(templatesDir, 'source');
  const expectedDir = path.join(templatesDir, 'expected');

  const [sourceArr, expectedArr] = [sourceDir, expectedDir]
    .map(dir => fs.readdirSync(dir).map(file => [
      file.replace(/(\.tpl|\.html|\.hbs)$/, ''),
      fs.readFileSync(path.join(dir, file), 'utf-8'),
    ]));

  const expected = expectedArr.reduce((prev, [key, text]) => {
    prev[key] = text;
    return prev;
  }, {});

  const missing = [];

  const source = sourceArr.reduce((prev, [key, text]) => {
    if (expected[key] == null) {
      missing.push(key);
      return prev;
    }

    prev[key] = text;
    return prev;
  }, {});

  cache = [source, expected, missing];

  return cache;
}

function collapseWhitespace(str) {
  return str
    .replace(/(?:[ \t]*[\r\n]+[ \t]*)+/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ (<)|(>) /g, '$1$2')
    .trim();
}

function compileTemplate(src, dest, callback) {
  async.waterfall([
    next => fs.readFile(src, 'utf8', next),
    (source, next) => benchpress.precompile({ source }, next),
    (code, next) => mkdirp(path.dirname(dest), err => next(err, code)),
    (code, next) => fs.writeFile(dest, code, next),
  ], callback);
}

function equalsIgnoreWhitespace(actual, expected) {
  return assert.equal(collapseWhitespace(actual), collapseWhitespace(expected));
}

exports.equalsIgnoreWhitespace = equalsIgnoreWhitespace;
exports.compileTemplate = compileTemplate;
exports.prepare = prepare;
exports.collapseWhitespace = collapseWhitespace;
