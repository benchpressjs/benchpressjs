'use strict';

const t = require('babel-types');

/**
 * Get block from ast array
 * @param {object[]} ast
 * @returns {object}
 */
function getBlocks(ast) {
	return ast.map((node) => {
		if (t.isIfStatement(node)) {
			return node.alternate ? [
				...getBlocks(node.consequent.body),
				...getBlocks(node.alternate.body),
			] : getBlocks(node.consequent.body);
		}
		if (
			t.isExpressionStatement(node) &&
			t.isCallExpression(node.expression) &&
			t.isIdentifier(node.expression.callee, { name: 'iter' })
		) {
			return [{
				block: node.expression,
				name: node.expression.name,
				cleanName: node.expression.cleanName,
				replaceWith: (newNode) => {
					node.expression = newNode;
				},
			}];
		}

		return null;
	}).filter(Boolean).reduce((prev, arr) => [...prev, ...arr], []);
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

			body.push(t.functionDeclaration(
				t.identifier(cleanName), [
					t.identifier('get'),
					t.identifier('iter'),
					t.identifier('helper'),
					t.identifier('echo'),
				],
				t.blockStatement([t.expressionStatement(block)])
			));

			props.push(t.objectProperty(
				t.stringLiteral(name),
				t.identifier(cleanName)
			));

			replaceWith(t.callExpression(t.identifier(cleanName), [
				t.identifier('get'),
				t.identifier('iter'),
				t.identifier('helper'),
				t.identifier('echo'),
			]));
		});
		body.push(t.expressionStatement(t.assignmentExpression(
			'=',
			t.memberExpression(t.identifier('compiled'), t.identifier('blocks')),
			t.objectExpression(props)
		)));
	}

	return t.file(t.program(body));
}

module.exports = blocks;

