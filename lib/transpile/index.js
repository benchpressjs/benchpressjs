'use strict';

/* eslint global-require: 0 */

const transforms = [
	require('./mustaches'),
	require('./conditionals'),
	require('./loops'),
	require('./fix-relative'),
];

function transpile(input) {
	let output = input;

	transforms.forEach(transform => {
		output = transform(output);
	});

	return output;
}

module.exports = transpile;
