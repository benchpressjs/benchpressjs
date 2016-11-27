'use strict';

/* eslint global-require: 0 */

const async = require('async');

const transforms = [
	require('./mustaches'),
	require('./conditionals'),
	require('./loops'),
	require('./fix-relative'),
	require('./helpers'),
];

function transpile(input, callback) {
	async.waterfall([
		next => next(null, input),
		...transforms,
	], callback);
}

module.exports = transpile;
