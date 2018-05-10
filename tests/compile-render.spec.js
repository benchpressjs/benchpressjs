'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const Benchpress = require('../build/lib/benchpress');
const { equalsIgnoreWhitespace } = require('./lib/utils');
const mainData = require('./data.json');

const source = fs.readFileSync(path.join(__dirname, 'templates/source/loop-inside-if-else.tpl')).toString();
const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/loop-inside-if-else.html')).toString();

[true, false].forEach((native) => {
  const type = native ? 'native' : 'fallback';

  describe(`compileRender (${type})`, () => {
    before(() => {
      Benchpress.precompile.defaults.native = native;
      Benchpress.flush();
    });

    it('should work', () =>
      Benchpress.compileRender(source, mainData)
        .then(output => equalsIgnoreWhitespace(output, expected))
    );

    it('should work with block', () =>
      Benchpress.compileRender(source, mainData, 'rooms')
        .then(output => equalsIgnoreWhitespace(output, expected))
    );
  });

  describe(`compileParse (${type})`, () => {
    before(() => {
      Benchpress.precompile.defaults.native = native;
      Benchpress.flush();
    });

    it('should work', (done) => {
      Benchpress.compileParse(source, mainData, (err, output) => {
        assert.ifError(err);

        equalsIgnoreWhitespace(output, expected);
        done();
      });
    });

    it('should work with block', (done) => {
      Benchpress.compileParse(source, 'rooms', mainData, (err, output) => {
        assert.ifError(err);

        equalsIgnoreWhitespace(output, expected);
        done();
      });
    });
  });
});
