'use strict';

const t = require('babel-types');

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

			if (t.isCallExpression(left) && t.isIdentifier(left.callee, { name: 'iter' })) {
				out.push({
					block: left,
					name: left.name,
					cleanName: left.cleanName,
					replaceWith: (newNode) => {
						node.left = newNode;
					},
				});
			} else {
				out.push(...getBlocks(left));
			}

			if (t.isCallExpression(right) && t.isIdentifier(right.callee, { name: 'iter' })) {
				out.push({
					block: right,
					name: right.name,
					cleanName: right.cleanName,
					replaceWith: (newNode) => {
						node.right = newNode;
					},
				});
			} else {
				out.push(...getBlocks(right));
			}

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
					t.identifier(cleanName), [
						t.identifier('helpers'),
						t.identifier('context'),
						t.identifier('get'),
						t.identifier('iter'),
						t.identifier('helper'),
					],
					t.blockStatement([t.returnStatement(block)])
				)
			));

			replaceWith(t.callExpression(t.memberExpression(
				t.memberExpression(
					t.identifier('compiled'),
					t.identifier('blocks')
				),
				t.stringLiteral(name),
				true
			), [
				t.identifier('helpers'),
				t.identifier('context'),
				t.identifier('get'),
				t.identifier('iter'),
				t.identifier('helper'),
			]));
		});
		body.push(t.expressionStatement(t.assignmentExpression(
			'=',
			t.memberExpression(t.identifier('compiled'), t.identifier('blocks')),
			t.objectExpression(props)
		)));
	}

	return body;
}

module.exports = blocks;

