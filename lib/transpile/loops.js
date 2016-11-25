'use strict';

module.exports = function transform(input) {
	let output = input;
	let prev;
	while (output !== prev) {
		prev = output;
		output = output
			// `<!-- BEGIN thing -->{{thing.elemkey}}<!-- END thing -->` =>
			// `<!-- BEGIN thing -->{{thing__item.elemkey}}<!-- END thing -->`
			.replace(
				/(<!-- BEGIN ((?:[a-zA-Z0-9/._:]+\.)?([a-zA-Z0-9_:]+)) -->[\s\S]*?)(\{{2,3}[a-z# ]*?)(?:[a-zA-Z0-9/._:]+\.)?\3\.([a-zA-Z0-9/._:]+\}{2,3})([\s\S]*?<!-- END \2 -->)/g,
				'$1$4$3__item.$5$6'
			);
	}

	prev = null;
	while (output !== prev) {
		prev = output;
		output = output
			// `<!-- BEGIN thing -->@key: @value<!-- END thing -->` =>
			// `<!-- BEGIN thing -->{{thing__key}}: {{thing_item}}<!-- END thing -->`
			// @index is alias of @key
			.replace(
				/(<!-- BEGIN ((?:[a-zA-Z0-9/._:]+\.)?([a-zA-Z0-9_:]+)) -->[\s\S]*?)(?:@key|@index)([\s\S]*?<!-- END \2 -->)/g,
				'$1{{$3__key}}$4'
			)
			.replace(
				/(<!-- BEGIN ((?:[a-zA-Z0-9/._:]+\.)?([a-zA-Z0-9_:]+)) -->[\s\S]*?)@value([\s\S]*?<!-- END \2 -->)/g,
				'$1{{$3__item}}$4'
			);
	}

	prev = null;
	while (output !== prev) {
		prev = output;
		output = output
			// `<!-- BEGIN thing -->` =>
			// `{{#each thing as |thing__item thing__key|}}`
			// `<!-- END thing -->` => `{{/each}}`
			.replace(
				/<!-- BEGIN ((?:[a-zA-Z0-9/._:]+\.)?([a-zA-Z0-9_:]+)) -->([\s\S]*?)<!-- END \1 -->/g,
				'{{#each $1 as |$2__item $2__key|}}$3{{/each}}'
			);
	}

	return output;
};
