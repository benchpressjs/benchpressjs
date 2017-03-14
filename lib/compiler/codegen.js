'use strict';

const generate = require('babel-generator').default;

const defaults = {
	minified: false,
	quotes: 'single',
};

/**
 * Generate JS code from a compiled syntax tree
 * @param {object} compiled - Compiled JS AST
 * @param {object} options - Babel generator options
 */
function codegen(compiled, options) {
	const { code } = generate(compiled, Object.assign({}, defaults, options));

	return code;
}

module.exports = codegen;
