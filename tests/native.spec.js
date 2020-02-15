'use strict';

const assert = require('assert');
const Benchpress = require('../build/lib/benchpress');

describe('native', () => {
  it('is available', () => {
    assert(Benchpress.precompile.isNative);
  });
});
