'use strict';

module.exports = function transform(input) {
	return input
		// `{{key}}` => `{{{key}}}` (unescaped)
		.replace(/(\{\{[^}\n]+\}\})(?!\})/g, '{$1}')
		// `{key}` => `{{key}}` (escaped)
		.replace(/(\{[^}\n]+\})(?!\})/g, '{$1}')
		// `/{{undefined}}` => `{undefined}`
		.replace(/\/\{(\{(?:undefined)\})\}(?!\})/g, '$1');
};
