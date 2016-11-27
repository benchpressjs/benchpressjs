'use strict';

module.exports = function transform(input, next) {
	let output = input;
	let prev;

	while (output !== prev) {
		prev = output;
		output = output
			// `<!-- IF !key -->xxxxxxxx<!-- ENDIF !key -->` =>
			// `{{#unless key}}xxxxxxxx{{/unless}}`
			.replace(
				/<!-- IF !([@a-zA-Z0-9/._:]+) -->([\s\S]*?)<!-- ENDIF !\1 -->/g,
				'{{#unless $1}}$2{{/unless}}'
			)
			// `<!-- IF key -->xxxxxxxx<!-- ENDIF key -->` =>
			// `{{#if key}}xxxxxxxx{{/if}}`
			// exclude `function` keys
			.replace(
				/<!-- IF (?!function)([@a-zA-Z0-9/._:]+) -->([\s\S]*?)<!-- ENDIF \1 -->/g,
				'{{#if $1}}$2{{/if}}'
			);
	}

	output = output
		// `<!-- ELSE -->` => `{{else}}`
		.replace(
			/<!-- ELSE -->/g,
			'{{else}}'
		);
	
	next(null, output);
};
