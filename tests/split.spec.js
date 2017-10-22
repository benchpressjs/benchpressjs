'use strict';

const assert = require('assert');

const { splitArgs } = require('../build/lib/compiler/tokens');

describe('splitArgs', () => {
  it('should split by commas', () => {
    assert.deepEqual(splitArgs('abc,def,ghj,123'), ['abc', 'def', 'ghj', '123']);
  });
  it('should leave double quotes around strings', () => {
    assert.deepEqual(splitArgs('abc,"def",ghj,123'), ['abc', '"def"', 'ghj', '123']);
  });
  it('should not split inside strings', () => {
    assert.deepEqual(splitArgs('abc,"def,ghj",123'), ['abc', '"def,ghj"', '123']);
  });
  it('should ignore escaped quotes', () => {
    assert.deepEqual(splitArgs('abc,"def,\\"ghj",123'), ['abc', '"def,\\"ghj"', '123']);
  });
  it('should ignore spaces around separating commas', () => {
    assert.deepEqual(splitArgs('abc , "def", ghj  ,123'), ['abc', '"def"', 'ghj', '123']);
    assert.deepEqual(splitArgs('abc , "def, ghj"  ,123'), ['abc', '"def, ghj"', '123']);
  });
});
