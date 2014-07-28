/*global describe, it*/

var assert = require('assert'),
	templates = require('./../../lib/templates.js'),
	data = require('./../data.json'),
	fs = require('fs'),
	path = require('path'),
	async = require('async'),
	winston = require('winston'),

	TEMPLATES_DIRECTORY = path.join(__dirname, '../templates/');


function prepare(callback) {
	var raw = {},
		expected = {};

	fs.readdir(TEMPLATES_DIRECTORY, function(err, files) {
		async.each(files, function(file, next) {
			fs.readFile(path.join(TEMPLATES_DIRECTORY, file), 'utf-8', function(err, html) {
				if (file.match(/\.html?/)) {
					expected[file.replace(/\.html?/, '')] = html;
				} else if (file.match(/\.tpl?/)) {
					raw[file.replace(/\.tpl?/, '')] = html;
				}

				next();
			});
		}, function(err) {
			if (err) {
				throw new Error(err);
			}

			for (var key in raw) {
				if (raw.hasOwnProperty(key)) {
					if (typeof expected[key] === 'undefined') {
						winston.warn('Missing expected file: ' + key + '.html');
						delete raw[key];
					}
				}
			}

			callback(raw, expected);
		});


	});
}

function test(raw, expected) {
	describe('templates.js', function() {
		for (var key in raw) {
			if (raw.hasOwnProperty(key)) {
				it(key, function() {
					assert.equal(templates.parse(raw[key], data), expected[key]);
				});
			}
		}
	});
}


prepare(test);