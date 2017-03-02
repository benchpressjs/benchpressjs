'use strict';

const tokenizer = require('./tokenizer');
const paths = require('./paths');

/**
 * Resolve all expression paths relative to the loop
 * @param {string} basePath
 * @param {object} expression
 */
function expressionPaths(basePath, expression) {
	const expr = Object.assign({}, expression);
	if (expr.tokenType === 'SimpleExpression') {
		if (expr.path === '@value') {
			expr.path = basePath;
		} else {
			expr.path = paths.resolve(basePath, expr.path);
		}
	} else if (expr.tokenType === 'HelperExpression') {
		expr.args = expr.args.map((arg) => {
			if (arg.tokenType === 'StringLiteral') {
				return arg;
			}

			return expressionPaths(basePath, arg);
		});
	}

	return expr;
}

/**
 * Parse an array of tokens into a syntax tree
 * @param {object[]} tokens
 * @param {string} basePath
 * @param {number} iterSuffix
 * @returns {[object[], number]}
 */
function parse(tokens, basePath, iterSuffix) {
	const len = tokens.length;
	const body = [];

	let i = 0;
	while (i < len) {
		const token = tokens[i];
		if (token.tokenType === 'OpenIf') {
			const [blockBody, tokensHandled] = parse(tokens.slice(i + 1), basePath, iterSuffix);

			const test = expressionPaths(basePath, token.test);
			body.push(Object.assign({}, token, { test, body: blockBody }));

			i += tokensHandled;
		} else if (token.tokenType === 'OpenIter') {
			const path = paths.resolve(basePath, token.subject.path);
			const [blockBody, tokensHandled] = parse(tokens.slice(i + 1), `${path}[${iterSuffix}]`, iterSuffix + 1);

			const subject = Object.assign({}, token.subject, { path });
			body.push(Object.assign({}, token, {
				body: blockBody,
				subject,
				iterSuffix,
			}));

			i += tokensHandled;
		} else if (token.tokenType === 'Else') {
			const [blockBody, tokensHandled] = parse(tokens.slice(i + 1), basePath, iterSuffix);
			body.push(Object.assign({}, token, { body: blockBody }));

			i += tokensHandled;
		} else if (token.tokenType === 'RawMustache' || token.tokenType === 'EscapedMustache') {
			const expression = expressionPaths(basePath, token.expression);
			body.push(Object.assign({}, token, { expression }));

			i += 1;
		} else if (token.tokenType === 'Text') {
			body.push(token);

			i += 1;
		} else if (token.tokenType === 'Close') {
			i += 1;

			break;
		}
	}

	return [body, i + 1];
}

const Close = tokenizer.tokens.Close;

/**
 * Parse an array of tokens into a syntax tree
 * @param {object[]} tokens
 * @returns {object}
 */
function parser(tokens) {
	// add Close token before each Else
	const toks = tokens.reduce((prev, tok) => {
		if (tok.tokenType === 'Else') {
			return [...prev, new Close(), tok];
		}

		return [...prev, tok];
	}, []);

	const [body] = parse(toks, '', 1);
	return body;
}

module.exports = parser;
