'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const Benchpress = require('../build/lib/benchpress');
const { equalsIgnoreWhitespace } = require('./lib/utils');
const mainData = require('./data.json');

describe('each Object.keys("")', () => {
  const keys = Object.keys;

  before(() => {
    Object.keys = (obj) => {
      assert.equal(typeof obj, 'object');
      return keys(obj);
    };
  });

  it('ES5 behavior is correct', () => {
    assert.throws(() => {
      Object.keys('');
    });
  });

  it('should work with ES5 behavior', () => {
    const source = fs.readFileSync(path.join(__dirname, 'templates/source/object-keys-error.tpl')).toString();
    const expected = fs.readFileSync(path.join(__dirname, 'templates/expected/object-keys-error.html')).toString();

    return Benchpress.compileRender(source, mainData).then((output) => {
      equalsIgnoreWhitespace(expected, output);
    });
  });

  after(() => {
    Object.keys = keys;
  });
});
