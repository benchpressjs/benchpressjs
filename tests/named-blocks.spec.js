'use strict';

const fs = require('fs');
const path = require('path');

const Benchpress = require('../build/lib/benchpress');
const mainData = require('./data.json');
const { equalsIgnoreWhitespace } = require('./lib/utils');

const source = fs.readFileSync(path.join(__dirname, './templates/source/loop-inside-if-else.tpl')).toString();
const expected = fs.readFileSync(path.join(__dirname, './templates/expected/loop-inside-if-else.html')).toString();

describe('named-blocks', () => {
  it('should work', () => {
    const blockName = 'rooms';

    return Benchpress.compileRender(source, mainData, blockName)
      .then(output => equalsIgnoreWhitespace(output, expected));
  });
});
