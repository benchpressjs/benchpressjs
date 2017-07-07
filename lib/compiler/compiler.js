'use strict';

const t = require('babel-types');

// Helpers for constructing AST nodes
function PathExpression(path) {
	const iterPattern = /^(.*)\[(\d+)]$/;
	const paths = path.split('.').reduce((prev, key) => {
		const matches = key.match(iterPattern);
		if (matches) {
			const [, rest, index] = matches;
			return [...prev, t.stringLiteral(rest), t.identifier(`key${index}`)];
		}
		return [...prev, t.stringLiteral(key)];
	}, []);

	return paths;
}
function Get(path) {
	const paths = PathExpression(path);

	// precompile path expressions into
	//   context && context['prop'] && context['prop'][5] ...
	return t.callExpression(t.identifier('get'), [
		paths.reduce(
			(out, p) => t.logicalExpression('&&', out, t.memberExpression(out, p, true)),
			t.identifier('context')
		),
	]);
}
// take an array of string expressions
// and convert it to direct concatenation like this
// 	 a + b + c + d
function ConcatStringList(outputs) {
	let out = outputs[0];

	for (let i = 1; i < outputs.length; i += 1) {
		out = t.binaryExpression('+', out, outputs[i]);
	}

	return out;
}

const transforms = {
	StringLiteral(branch) {
		return t.stringLiteral(branch.value);
	},
	SimpleExpression(branch) {
		const path = branch.path;
		if (path === '@root') {
			return t.identifier('context');
		}
		if (path === '@key') {
			return t.identifier('key');
		}
		if (path === '@index') {
			return t.identifier('index');
		}
		if (path === '@first') {
			return t.binaryExpression('===', t.identifier('index'), t.numericLiteral(0));
		}
		if (path === '@last') {
			return t.binaryExpression('===', t.identifier('index'), t.binaryExpression(
				'-',
				t.identifier('length'),
				t.numericLiteral(1)
			));
		}

		return Get(path);
	},
	HelperExpression(branch) {
		return t.callExpression(t.identifier('helper'), [
			t.identifier('context'),
			t.identifier('helpers'),
			t.stringLiteral(branch.helperName),
			t.arrayExpression(compile(branch.args)),
		]);
	},
	OpenIf(branch, nextBranch) {
		let test = transforms[branch.test.tokenType](branch.test);
		if (branch.not) {
			test = t.unaryExpression('!', test, true);
		}

		let alternate = t.stringLiteral('');
		if (nextBranch && nextBranch.tokenType === 'Else') {
			alternate = ConcatStringList(compile(nextBranch.body));

			nextBranch.skipThis = true;
		}

		return t.conditionalExpression(test, ConcatStringList(compile(branch.body)), alternate);
	},
	OpenIter(branch) {
		const key = t.identifier(`key${branch.iterSuffix}`);
		const index = t.identifier(`index${branch.iterSuffix}`);
		const length = t.identifier(`length${branch.iterSuffix}`);

		const iter = t.callExpression(t.identifier('iter'), [
			Get(branch.subject.path),
			t.functionExpression(t.identifier('each'), [
				key,
				index,
				length,
			], t.blockStatement([
				t.variableDeclaration('var', [t.variableDeclarator(t.identifier('key'), key)]),
				t.variableDeclaration('var', [t.variableDeclarator(t.identifier('index'), index)]),
				t.variableDeclaration('var', [t.variableDeclarator(t.identifier('length'), length)]),
				t.returnStatement(ConcatStringList(compile(branch.body))),
			])),
		]);
		iter.name = branch.name;
		iter.cleanName = branch.cleanName;

		return iter;
	},
	Text(branch) {
		return t.stringLiteral(branch.value);
	},
	RawMustache(branch) {
		return transforms[branch.expression.tokenType](branch.expression, branch.raw);
	},
	EscapedMustache(branch) {
		return t.callExpression(
			t.memberExpression(t.identifier('helpers'), t.identifier('escape')),
			[transforms.RawMustache(branch)]
		);
	},
};

/**
 * Transform a template syntax tree into a Babylon AST
 * @param {object[]} body
 * @returns {object[]}
 */
function compile(body) {
	const compiled = [];
	const len = body.length;
	for (let i = 0; i < len; i += 1) {
		const branch = body[i];
		if (!branch.skipThis) {
			compiled.push(transforms[branch.tokenType](branch, ...body.slice(i + 1)));
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

	return t.functionDeclaration(t.identifier('compiled'), [
		t.identifier('helpers'),
		t.identifier('context'),
		t.identifier('get'),
		t.identifier('iter'),
		t.identifier('helper'),
	], t.blockStatement([
		t.variableDeclaration('var', [t.variableDeclarator(
			t.identifier('escape'),
			t.logicalExpression(
				'||',
				t.memberExpression(t.identifier('helpers'), t.identifier('escape')),
				t.functionExpression(null, [t.identifier('str')], t.blockStatement([
					t.returnStatement(t.identifier('str')),
				]))
			)
		)]),
		t.returnStatement(ConcatStringList(compiled)),
	]));
}

compiler.transforms = transforms;

module.exports = compiler;
