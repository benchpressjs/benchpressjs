'use strict';

const t = require('babel-types');

const CONTEXT = t.identifier('context');
const HELPERS = t.identifier('helpers');
const HELPER = t.identifier('helper');
const GUARD = t.identifier('guard');
const ITER = t.identifier('iter');
const EACH = t.identifier('each');
const ESCAPE = t.memberExpression(HELPERS, t.identifier('__escape'));
const KEY = t.identifier('key');
const INDEX = t.identifier('index');
const LENGTH = t.identifier('length');
const COMPILED = t.identifier('compiled');
const BLOCKS = t.memberExpression(COMPILED, t.identifier('blocks'));

const KEY_I = i => t.identifier(`key${i}`);
const LENGTH_I = i => t.identifier(`length${i}`);

const runtimeParams = [
  HELPERS,
  CONTEXT,
  GUARD,
  ITER,
  HELPER,
];

module.exports = {
  CONTEXT,
  HELPERS,
  HELPER,
  GUARD,
  ITER,
  EACH,
  ESCAPE,
  KEY,
  INDEX,
  LENGTH,
  COMPILED,
  BLOCKS,

  KEY_I,
  LENGTH_I,

  runtimeParams,
};
