'use strict';

module.exports = function transform(input) {
	return input
		// `{{../key}}` => `{{this.key}}`
		// `{{../../../key}}` => `{{../../this.key}}`
		.replace(/\{\{([a-z# ]*)((?:\.\.\/)*)(?:\.\.\/)([^}]+?)\}\}/g, '{{$1$2this.$3}}');
};
