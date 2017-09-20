'use strict';

const t = require('babel-types');

const c = require('./constants');

let options;

// Helpers for constructing AST nodes
function PathExpression(path) {
	const iterPattern = /^(.*)\[(\d+)]$/;
	const paths = path.split('.').reduce((prev, key) => {
		const matches = key.match(iterPattern);
		if (matches) {
			const [, rest, index] = matches;
			return [...prev, t.stringLiteral(rest), c.KEY_I(index)];
		}
		return [...prev, t.stringLiteral(key)];
	}, []);

	return paths;
}
function Guard(path) {
	const paths = PathExpression(path);

	if (options.guard === false) {
		return t.callExpression(c.GUARD, [
			paths.reduce((out, p) => t.memberExpression(out, p, true), c.CONTEXT),
		]);
	}

	// precompile path expressions into
	//   context && context['prop'] && context['prop'][5] ...
	let last = c.CONTEXT;
	return t.callExpression(c.GUARD, [
		paths.reduce((out, p) => {
			last = t.memberExpression(last, p, true);
			return t.logicalExpression('&&', out, last);
		}, last),
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
			return c.CONTEXT;
		}
		if (path === '@key') {
			return c.KEY;
		}
		if (path === '@index') {
			return c.INDEX;
		}
		if (path === '@first') {
			return t.binaryExpression('===', c.INDEX, t.numericLiteral(0));
		}
		if (path === '@last') {
			return t.binaryExpression('===', c.INDEX, t.binaryExpression(
				'-',
				c.LENGTH,
				t.numericLiteral(1)
			));
		}

		return Guard(path);
	},
	HelperExpression(branch) {
		return t.callExpression(c.HELPER, [
			c.CONTEXT,
			c.HELPERS,
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
		const key = c.KEY_I(branch.iterSuffix);
		const index = c.INDEX_I(branch.iterSuffix);
		const length = c.LENGTH_I(branch.iterSuffix);

		const iter = t.callExpression(c.ITER, [
			Guard(branch.subject.path),
			t.functionExpression(c.EACH, [
				key,
				index,
				length,
			], t.blockStatement([
				t.variableDeclaration('var', [t.variableDeclarator(c.KEY, key)]),
				t.variableDeclaration('var', [t.variableDeclarator(c.INDEX, index)]),
				t.variableDeclaration('var', [t.variableDeclarator(c.LENGTH, length)]),
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
			c.ESCAPE,
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
function compiler(parsed, opts) {
	options = opts;
	const compiled = compile(parsed);

	return t.functionDeclaration(c.COMPILED, c.runtimeParams, t.blockStatement([
		t.returnStatement(ConcatStringList(compiled)),
	]));
}

compiler.transforms = transforms;

module.exports = compiler;
