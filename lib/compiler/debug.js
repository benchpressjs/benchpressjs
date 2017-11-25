'use strict';

/* eslint no-debugger: off, no-unused-vars: off, no-eval: off, no-undef: off */

/**
 * This file is for debugging failing tests. It lets you inspect each step of compilation easily.
 */

const fs = require('fs');
const path = require('path');

const prefixer = require('../../build/lib/compiler/prefixer');
const tokenizer = require('../../build/lib/compiler/tokenizer');
const parser = require('../../build/lib/compiler/parser');
const compiler = require('../../build/lib/compiler/compiler');
const blocks = require('../../build/lib/compiler/blocks');
const codegen = require('../../build/lib/compiler/codegen');
const runtime = require('../../build/lib/runtime');

const collapseWhitespace = str => str
  .replace(/(?:[ \t]*[\r\n]+[ \t]*)+/g, '\n')
  .replace(/[\t ]+/g, ' ')
  .replace(/ (<)|(>) /g, '$1$2')
  .trim();

// path.join(__dirname, '../../tmp/flags-detail.tpl')
const testPath = path.join(__dirname, '../../tests/templates/source/modern-helper.tpl');

const testTemplate = fs.readFileSync(testPath).toString();

const testData = require('../../tests/data.json');

const testHelpers = {
  canspeak(data) {
    return (data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak';
  },
  test(data) {
    return data.forum && !data.double;
  },
  isHuman(data, iterator) {
    return data.animals[iterator].isHuman;
  },
};

function everything(template, data, helpers) {
  const prefixed = prefixer(template);
  const tokens = tokenizer(prefixed);
  const parsed = parser(tokens);
  const fnAst = compiler(parsed, {});
  const ast = blocks(fnAst);
  const code = codegen(ast);
  eval(code);
  // const output = runtime(helpers, data, compiled);
  const output = runtime(helpers, data, compiled.blocks.rooms);

  return output;
}

const out = collapseWhitespace(everything(testTemplate, testData, testHelpers));

debugger;
