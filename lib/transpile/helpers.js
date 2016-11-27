'use strict';

module.exports = function transform(input, next) {
	const output = input
		// `{{function.helper}}` => `{{function__helper this}}`
		.replace(/\{\{function\.([^}\n ,]+)\}\}/g, '{{function__$1 this}}')
		// `{{function.helper, arg1, arg2...}}` => `{{function__helper arg1 arg2...}}`
		.replace(
			/\{\{function\.([^}\n]+)\}\}/g,
			(match, one) => `{{function__${one.split(/ ?, ?/).join(' ')}}}`
		)
		// `<!-- IF function.helper, arg1, arg2... -->` =>
		// `{{#if__function "helper" arg1 arg2...}}`
		.replace(
			/<!-- IF function\.([@a-zA-Z0-9/._: ,{}]+?) -->/g,
			(match, one) => {
				const [name, ...args] = one.split(/ ?, ?/);
				const textArgs = args.map(arg => arg.replace(
					/^(?:\{{2,3})?(?:esc )?(.*?)(?:\}{2,3})?$/g,
					'$1'
				)).join(' ').trim();
				return `{{#if__function "${name}"${textArgs ? ` ${textArgs}` : ''}}}`;
			}
		)
		// `<!-- ENDIF function.helper -->` =>
		// `{{/if__function}}`
		.replace(
			/<!-- ENDIF function\..+? -->/g,
			'{{/if__function}}'
		);
	
	next(null, output);
};
