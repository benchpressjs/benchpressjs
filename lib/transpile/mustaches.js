'use strict';

module.exports = function transform(input) {
	return input
		// `{{key}}` => `{{{key}}}` (unescaped)
		.replace(/\{\{([^}]+)\}\}(?!\})/g, '{{{$1}}}')
		// `{key}` => `{{key}}` (escaped)
		.replace(/\{([^}]+)\}(?!\})/g, '{{$1}}');
};
