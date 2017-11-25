'use strict';

const fs = require('fs');
const path = require('path');

const { prepare, equalsIgnoreWhitespace } = require('./lib/utils');
const Benchpress = require('../build/lib/benchpress');
const mainData = require('./data.json');

const logDir = path.join(__dirname, 'logs');

function logFailure({ name, source, code, expected, output, err }) {
  if (output !== expected) {
    fs.writeFileSync(path.join(logDir, `${name}.log`), `
      ==== source ====
      ${source}

      ==== code ====
      ${code == null ? `PRECOMPILE FAILED: ${err}` : code}

      ==== output ====
      ${output == null ? `PRECOMPILE FAILED: ${err}` : output}

      ==== expected ====
      ${expected}
    `);
  } else {
    try {
      fs.unlinkSync(path.join(logDir, `${name}.log`));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
      // ignore error
    }
  }
}

const templatesDir = path.join(__dirname, 'templates');
const sourceDir = path.join(templatesDir, 'source');
const expectedDir = path.join(templatesDir, 'expected');

describe('templates', () => {
  const [source, expected, missing] = prepare(sourceDir, expectedDir);

  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(`[templates.js] Missing expected files: ${JSON.stringify(missing, null, 2)}`);
  }

  const keys = Object.keys(source);

  keys.forEach((name) => {
    it(name, () =>
      Benchpress.precompile(source[name], {})
        .catch((err) => {
          logFailure({
            source: source[name],
            expected: expected[name],
            name,
            err: err.message,
          });
          throw err;
        })
        .then((code) => {
          const template = Benchpress.evaluate(code);
          const output = Benchpress.runtime(Benchpress.helpers, mainData, template);
          const expect = expected[name];

          logFailure({
            source: source[name],
            expected: expect,
            code,
            output,
            name,
          });

          equalsIgnoreWhitespace(output, expect);
        })
    );
  });
});

Benchpress.registerHelper('canspeak', data /* , iterator, numblocks ) */ =>
  ((data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak'));

Benchpress.registerHelper('test', data => (data.forum && !data.double));

Benchpress.registerHelper('isHuman', (data, iterator) => data.animals[iterator].isHuman);

// the following helper definitions are from examples, copied as-is
/* eslint-disable func-names, prefer-arrow-callback */

Benchpress.registerHelper('caps', function (text) {
  return String(text).toUpperCase();
});

Benchpress.registerHelper('isEven', function (num) {
  return num % 2 === 0;
});
// in legacy IF syntax, the root context is provided as the first argument
Benchpress.registerHelper('isEvenLegacy', function (context, num) {
  return num % 2 === 0;
});

// ES6 array function syntax
Benchpress.registerHelper('join', (joiner, ...args) => args.join(joiner));
