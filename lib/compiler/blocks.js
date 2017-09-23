'use strict';

const t = require('babel-types');

const c = require('./constants');

/**
 * Get block from ast array
 * @param {object[]} ast
 * @returns {object}
 */
function getBlocks(ast) {
  ast = Array.isArray(ast) ? ast : [ast];

  return ast.map((node) => {
    if (t.isReturnStatement(node)) {
      return getBlocks(node.argument);
    }
    if (t.isConditionalExpression(node)) {
      return node.alternate ? [
        ...getBlocks(node.consequent),
        ...getBlocks(node.alternate),
      ] : getBlocks(node.consequent);
    }
    if (t.isBinaryExpression(node)) {
      const { left, right } = node;
      const out = [];

      right.side = 'right';
      left.side = 'left';

      [right, left].forEach((block) => {
        if (t.isCallExpression(block) && t.isIdentifier(block.callee, { name: 'iter' })) {
          out.push({
            block,
            name: block.name,
            cleanName: block.cleanName,
            replaceWith: (newNode) => {
              node[block.side] = newNode;
            },
          });
        } else {
          out.push(...getBlocks(block));
        }
      });

      return out;
    }

    return null;
  }).filter(Boolean).reduce((prev, arr) => prev.concat(arr), []);
}

/**
 * Pull top-level blocks out of ast and expose them at `compiled.blocks`
 * @param {object} ast
 * @returns {object}
 */
function blocks(ast) {
  const body = [ast];
  // start with body of function
  const nodes = getBlocks(ast.body.body);
  if (nodes.length) {
    const props = [];
    const keysUsed = [];
    nodes.forEach(({ name, cleanName, block, replaceWith }) => {
      if (keysUsed.includes(name)) {
        return;
      }
      keysUsed.push(name);

      props.push(t.objectProperty(
        t.stringLiteral(name),
        t.functionExpression(
          t.identifier(cleanName),
          c.runtimeParams,
          t.blockStatement([t.returnStatement(block)])
        )
      ));

      replaceWith(t.callExpression(t.memberExpression(
        c.BLOCKS,
        t.stringLiteral(name),
        true
      ), c.runtimeParams));
    });
    body.push(t.expressionStatement(t.assignmentExpression(
      '=',
      c.BLOCKS,
      t.objectExpression(props)
    )));
  }

  return body;
}

module.exports = blocks;

