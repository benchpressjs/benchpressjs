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

	var files = fs.readdirSync(TEMPLATES_DIRECTORY);

	async.each(files, function(file, next) {
		var html = fs.readFileSync(path.join(TEMPLATES_DIRECTORY, file), 'utf-8');

		if (file.match(/\.html?/)) {
			expected[file.replace(/\.html?/, '')] = html;
		} else if (file.match(/\.tpl?/)) {
			raw[file.replace(/\.tpl?/, '')] = html;
		}

		next();
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
}

function test(raw, expected) {
	describe('templates.js', function() {
		var keys = Object.keys(raw);

		async.each(keys, function(key, next) {
			it(key, function() {
				var parsed = templates.parse(raw[key], data).replace(/\r\n/g, '\n'),
					expect = expected[key].replace(/\r\n/g, '\n');

				if (parsed !== expect) {
					fs.writeFile(path.join(TEMPLATES_DIRECTORY, key + '.log'), parsed);
				} else {
					fs.unlink(path.join(TEMPLATES_DIRECTORY, key + '.log'), function(){});
				}

				assert.equal(parsed, expect);
				next();
			});
		}, function(err) {
			if (err) {
				throw new Error(err);
			}
		});
	});
}


templates.registerHelper('canspeak', function(data, iterator, numblocks) {
	return (data.isHuman && data.name === "Human") ? "Can speak" : "Cannot speak";
});

templates.registerHelper('test', function(data) {
	return (data.forum && !data.double);
});

templates.registerHelper('isHuman', function(data, iterator) {
	return data.animals[iterator].isHuman;
});
prepare(test);