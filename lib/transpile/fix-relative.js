'use strict';

module.exports = function transform(input) {
	return input
		// `{{../key}}` => `{{this.key}}`
		// `{{../../../key}}` => `{{../../this.key}}`
		.replace(/\{\{([^}\n]+? )?((?:\.\.\/)*)(?:\.\.\/)([^}\n]+?)\}\}/g, '{{$1$2this.$3}}');
};
