'use strict';

/* eslint global-require: 0 */

const transforms = [
	require('./mustaches'),
	require('./conditionals'),
];

function transpile(input) {
	let output = input;

	transforms.forEach(transform => {
		output = transform(output);
	});

	return output;
}

module.exports = transpile;
