'use strict';

const assert = require('assert');

describe('native', () => {
  it('is available', () => {
    // eslint-disable-next-line global-require
    assert.doesNotThrow(() => require('../rust/benchpress-rs'));
  });
});
