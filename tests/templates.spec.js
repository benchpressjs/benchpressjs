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

[true, false].forEach((native) => {
  const type = native ? 'native' : 'fallback';

  describe(`templates (${type})`, () => {
    before(() => {
      Benchpress.precompile.defaults.native = native;
      Benchpress.flush();
    });

    const [source, expected, missing] = prepare();

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
            let template = null;
            let output = '';
            let err = null;

            try {
              template = Benchpress.evaluate(code);

              try {
                output = Benchpress.runtime(Benchpress.helpers, mainData, template);
              } catch (e) {
                err = e;
              }
            } catch (e) {
              err = e;
            }

            const expect = expected[name];

            logFailure({
              source: source[name],
              expected: expect,
              code,
              output,
              name,
              err,
            });

            equalsIgnoreWhitespace(output, expect);
          })
      );
    });
  });
});

Benchpress.registerHelper('canspeak', data /* , iterator, numblocks ) */ =>
  ((data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak'));

Benchpress.registerHelper('test', data => (data.forum && !data.double));

Benchpress.registerHelper('isHuman', (data, iterator) => data.animals[iterator].isHuman);

Benchpress.registerHelper('wordpressHome', () => 'wordpress-home');

Benchpress.registerHelper('stylesheetLocation', () => 'stylesheet-location');

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
