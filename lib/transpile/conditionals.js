'use strict';

module.exports = function transform(input) {
	return input
		// `<!-- IF key -->xxxxxxxx<!-- ENDIF key -->` =>
		// `{{#if key}}xxxxxxxx{{/if}}`
		.replace(
			/<!-- IF ([a-zA-Z0-9/._:]+) -->([\s\S]*?)<!-- ENDIF \1 -->/g,
			'{{#if $1}}$2{{/if}}'
		);
};
