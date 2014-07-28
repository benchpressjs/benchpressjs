"use strict";
/*global describe, it*/

var assert = require('assert'),
	path = require('path'),
	fs = require('fs'),
	express = require('express'),
	app = express(),

	templates = require('./../../lib/templates.js'),
	data = require('./../data.json');

app.configure(function() {
	app.engine('tpl', templates.__express);
	app.set('view engine', 'tpl');
	app.set('views', path.join(__dirname, '../templates'));
});

describe('templates.js w/ express', function() {
	it('app.render should work', function() {
		var expected = fs.readFileSync(path.join(__dirname, '../templates/basic.html')).toString();

		app.render('basic', data, function(err, parsed) {
			assert.equal(parsed, expected);
		});
	});
});