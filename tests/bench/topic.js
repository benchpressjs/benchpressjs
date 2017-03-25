'use strict';

const path = require('path');
const fs = require('fs');
const async = require('async');

const benchpress = require('../../build/lib/benchpress');
const data = require('./topic.json');

const templatePath = path.join(__dirname, 'topic.tpl');

function prep(callback) {
	async.waterfall([
		next => fs.readFile(templatePath, next),
		(file, next) => benchpress.precompile({ source: file.toString() }, next),
		(code, next) => {
			const template = benchpress.evaluate(code);
			function bench(deferred) {
				benchpress.parse('topic', data, () => deferred.resolve());
			}

			next(null, { bench, template });
		},
	], callback);
}

module.exports = prep;
