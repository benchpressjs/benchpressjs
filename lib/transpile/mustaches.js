'use strict';

module.exports = function transform(input) {
	return input
		// `{{key}}` => `{{{key}}}` (unescaped)
		.replace(/(\{\{[^}\n]+\}\})(?!\})/g, '{$1}')
		// `{function.helper}` => `{{function.helper}}`
		// `{function.helper, whatever}` => `{{function.helper, whatever}}`
		.replace(/(\{function\.[^}\n]+\})/g, '{$1}')
		// `{key}` => `{{esc key}}` (escape T.JS stuff)
		.replace(/\{([^}\n ]+)\}(?!\})/g, '{{esc $1}}')
		// `/{{undefined}}` => `{undefined}`
		.replace(/\/\{\{esc undefined\}\}(?!\})/g, '{undefined}');
};
