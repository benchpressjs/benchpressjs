'use strict';

/* global describe, it */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const express = require('express');

const templates = require('./../../lib/templates.js');
const data = require('./../data.json');

const app = express();

const templatesDir = path.join(__dirname, '../templates/source/');

app.configure(() => {
	app.engine('tpl', templates.__express);
	app.set('view engine', 'tpl');
	app.set('views', templatesDir);
});

describe('templates.js w/ express', () => {
	it('app.render should work', (done) => {
		fs.readFile(path.join(__dirname, '../templates/expected/basic.html'), (err, file) => {
			if (err) {
				done(err);
			}
			const expected = file.toString();
			app.render('basic', data, (error, parsed) => {
				if (error) {
					done(error);
				}
				assert.equal(parsed, expected);
				done();
			});
		});
	});
});
