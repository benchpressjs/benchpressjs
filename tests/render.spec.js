'use strict';

const fs = require('fs');
const path = require('path');

const Benchpress = require('../build/lib/benchpress');
const { equalsIgnoreWhitespace } = require('./lib/utils');
const mainData = require('./data.json');

const name = 'loop-inside-if-else';
const source = fs.readFileSync(path.join(__dirname, 'templates/source/loop-inside-if-else.tpl')).toString();
const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/loop-inside-if-else.html')).toString();

describe('', () => {
  before(() => {
    const cache = {};

    return Benchpress.precompile(source)
      .then((code) => {
        cache[name] = Benchpress.evaluate(code);
        return Benchpress.registerLoader(n => Promise.resolve(cache[n]));
      });
  });

  describe('render', () => {
    it('should work', () =>
      Benchpress.render(name, mainData)
        .then(output => equalsIgnoreWhitespace(expected, output))
    );

    it('should work with block', () =>
      Benchpress.render(name, mainData, 'rooms')
        .then(output => equalsIgnoreWhitespace(expected, output))
    );
  });

  describe('parse', () => {
    it('should work', (done) => {
      Benchpress.parse(name, mainData, (output) => {
        equalsIgnoreWhitespace(expected, output);
        done();
      });
    });

    it('should work with block', (done) => {
      Benchpress.parse(name, 'rooms', mainData, (output) => {
        equalsIgnoreWhitespace(expected, output);
        done();
      });
    });
  });
});
