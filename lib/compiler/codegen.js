'use strict';

const babel = require('babel-core');

const defaults = {
	// minified: global.env === 'development',
	minified: true,
	presets: ['babili'],
};

/**
 * Generate JS code from a compiled syntax tree
 * @param {object} compiled - Compiled JS AST
 * @param {object} options - Babylon options
 */
function codegen(compiled, options) {
	const { code } = babel.transformFromAst(compiled, Object.assign({}, defaults, options));

	return code;
}

module.exports = codegen;
