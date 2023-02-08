'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const assert = require('assert');

const benchpress = require('../../lib/benchpress');

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

async function compileTemplate(src, dest) {
  const source = await fs.promises.readFile(src, 'utf8');
  const code = await benchpress.precompile({ source });
  await mkdirp(path.dirname(dest));
  await fs.promises.writeFile(dest, code);
}

function equalsIgnoreWhitespace(actual, expected) {
  return assert.equal(collapseWhitespace(actual), collapseWhitespace(expected));
}

exports.equalsIgnoreWhitespace = equalsIgnoreWhitespace;
exports.compileTemplate = compileTemplate;
exports.prepare = prepare;
exports.collapseWhitespace = collapseWhitespace;
