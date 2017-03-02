'use strict';

const babylon = require('babylon');

// Helpers for construction AST nodes
function Identifier(name) {
	return {
		type: 'Identifier',
		name,
	};
}
function StringLiteral(str) {
	return {
		type: 'StringLiteral',
		value: str,
	};
}
function PathExpression(path) {
	// FIXME: make the expression directly
	if (/\[(\d+)]/.test(path)) {
		path = path.replace(/\[(\d+)]/g, '.\' + key$1 + \'');
	}
	path = `'${path}'`;

	return babylon.parseExpression(path);
}
function GetCall(path, fallback) {
	return {
		type: 'CallExpression',
		callee: Identifier('get'),
		arguments: fallback ? [path, StringLiteral(fallback)] : [path],
	};
}

/**
 * Transform a template syntax tree into a Babylon AST
 * @param {object[]} body
 * @returns {object[]}
 */
function compile(body) {
	const transforms = {
		StringLiteral(branch) {
			return StringLiteral(branch.value);
		},
		SimpleExpression(branch) { // , fallback) {
			const path = branch.path;
			if (path === '@key') {
				return Identifier('key');
			}
			if (path === '@index') {
				return Identifier('index');
			}
			if (path === '@first') {
				return {
					type: 'BinaryExpression',
					left: Identifier('index'),
					operator: '===',
					right: {
						type: 'NumericLiteral',
						value: 0,
					},
				};
			}
			if (path === '@last') {
				return {
					type: 'BinaryExpression',
					left: Identifier('index'),
					operator: '===',
					right: {
						type: 'BinaryExpression',
						left: Identifier('length'),
						operator: '-',
						right: {
							type: 'NumericLiteral',
							value: 1,
						},
					},
				};
			}

			return GetCall(PathExpression(path));
			// if the mustache source should show up when not found
			// return GetCall(PathExpression(path), fallback);
		},
		HelperExpression(branch) {
			return {
				type: 'CallExpression',
				callee: Identifier('helper'),
				arguments: [
					StringLiteral(branch.helperName),
					{
						type: 'ArrayExpression',
						elements: compile(branch.args),
					},
				],
			};
		},
		OpenIf(branch, nextBranch) {
			let test = transforms[branch.test.tokenType](branch.test);
			if (branch.not) {
				test = {
					type: 'UnaryExpression',
					operator: '!',
					prefix: true,
					argument: test,
				};
			}

			const obj = {
				type: 'IfStatement',
				test,
				consequent: {
					type: 'BlockStatement',
					body: compile(branch.body),
				},
			};
			if (nextBranch && nextBranch.tokenType === 'Else') {
				obj.alternate = {
					type: 'BlockStatement',
					body: compile(nextBranch.body),
				};

				nextBranch.skipThis = true;
			}
			return obj;
		},
		OpenIter(branch) {
			return {
				type: 'ExpressionStatement',
				expression: {
					type: 'CallExpression',
					callee: Identifier('iter'),
					arguments: [
						PathExpression(branch.subject.path),
						{
							type: 'FunctionExpression',
							id: Identifier('each'),
							params: [
								Identifier(`key${branch.iterSuffix}`),
								Identifier(`index${branch.iterSuffix}`),
								Identifier(`length${branch.iterSuffix}`),
							],
							body: {
								type: 'BlockStatement',
								body: [
									{
										type: 'VariableDeclaration',
										declarations: [
											{
												type: 'VariableDeclarator',
												id: Identifier('key'),
												init: Identifier(`key${branch.iterSuffix}`),
											},
										],
										kind: 'var',
									},
									{
										type: 'VariableDeclaration',
										declarations: [
											{
												type: 'VariableDeclarator',
												id: Identifier('index'),
												init: Identifier(`index${branch.iterSuffix}`),
											},
										],
										kind: 'var',
									},
									{
										type: 'VariableDeclaration',
										declarations: [
											{
												type: 'VariableDeclarator',
												id: Identifier('length'),
												init: Identifier(`length${branch.iterSuffix}`),
											},
										],
										kind: 'var',
									},
									...compile(branch.body),
								],
							},
						},
					],
				},
			};
		},
		Text(branch) {
			return {
				type: 'ExpressionStatement',
				expression: {
					type: 'CallExpression',
					callee: Identifier('echo'),
					arguments: [
						StringLiteral(branch.value),
					],
				},
			};
		},
		RawMustache(branch) {
			return {
				type: 'ExpressionStatement',
				expression: {
					type: 'CallExpression',
					callee: Identifier('echo'),
					arguments: [
						transforms[branch.expression.tokenType](branch.expression, branch.raw),
					],
				},
			};
		},
		EscapedMustache(branch) {
			return transforms.RawMustache(branch);
		},
	};

	const compiled = [];
	const len = body.length;
	for (let i = 0; i < len; i += 1) {
		const branch = body[i];
		if (!branch.skipThis) {
			compiled.push(transforms[branch.tokenType](branch, body[i + 1]));
		}
	}

	return compiled;
}

/**
 * Transform a template syntax tree into a Babylon AST
 * @param {object[]} parsed
 * @returns {object}
 */
function compiler(parsed) {
	const compiled = compile(parsed);
	const wrapper = {
		type: 'File',
		program: {
			type: 'Program',
			sourceType: 'script',
			body: [
				{
					type: 'FunctionDeclaration',
					id: Identifier('compiled'),
					params: [
						Identifier('get'),
						Identifier('iter'),
						Identifier('helper'),
						Identifier('echo'),
					],
					body: {
						type: 'BlockStatement',
						body: compiled,
					},
				},
			],
		},
	};

	return wrapper;
}

module.exports = compiler;
