'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const async = require('async');

const benchpress = require('../build/lib/benchpress');
const { compileTemplate, equalsIgnoreWhitespace } = require('./lib/utils');
const data = require('./data.json');

const app = express();

const templatesDir = path.join(__dirname, 'templates/build');

app.engine('jst', benchpress.__express);
app.set('view engine', 'jst');
app.set('views', templatesDir);

describe('express', () => {
	it('app.render should work', (done) => {
		const name = 'basic';
		async.waterfall([
			next => compileTemplate(path.join(__dirname, `templates/source/${name}.tpl`), path.join(templatesDir, `${name}.jst`), next),
			next => fs.readFile(path.join(__dirname, `templates/expected/${name}.html`), next),
			(file, next) => {
				const expected = file.toString();
				app.render(name, data, (err, parsed) => next(err, parsed, expected));
			},
			(parsed, expected, next) => {
				equalsIgnoreWhitespace(parsed, expected);
				next();
			},
		], done);
	});
});
