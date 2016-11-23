'use strict';

/* global describe, it */

const assert = require('assert');
const templates = require('./../../lib/templates.js');
const mainData = require('./../data.json');
const fs = require('fs');
const path = require('path');
const async = require('async');
const winston = require('winston');

const templatesDir = path.join(__dirname, '../templates/');
const logDir = path.join(__dirname, '../logs/');

function prepare(callback) {
	const sourceDir = path.join(templatesDir, 'source');
	const expectedDir = path.join(templatesDir, 'expected');
	const sourceFiles = fs.readdirSync(sourceDir);
	const expectedFiles = fs.readdirSync(expectedDir);

	async.map([
		[sourceDir, sourceFiles], 
		[expectedDir, expectedFiles],
	], ([dir, files], next) => async.map(files, (file, cb) => {
		fs.readFile(path.join(dir, file), 'utf-8', (err, text) => {
			if (err) {
				cb(err);
				return;
			}
			cb(null, [file.replace(/(\.tpl|\.html)$/, ''), text]);
		});
	}, next), (err, [sourceArr, expectedArr]) => {
		if (err) {
			callback(err);
			return;
		}

		const expected = expectedArr.reduce((prev, [key, text]) => {
			prev[key] = text;
			return prev;
		}, {});
		const source = sourceArr.reduce((prev, [key, text]) => {
			if (expected[key] == null) {
				winston.warn(`Missing expected file: '${key}.html'`);
				return prev;
			}

			prev[key] = text;
			return prev;
		}, {});

		callback(null, source, expected);
	});
}

function test(error, source, expected) {
	if (error) {
		throw error;
	}

	describe('templates.js', () => {
		const keys = Object.keys(source);

		async.each(keys, (key, next) => {
			it(key, (done) => {
				const parsed = templates.parse(source[key], mainData).replace(/\r\n/g, '\n');
				const expect = expected[key].replace(/\r\n/g, '\n');

				if (parsed !== expect) {
					fs.writeFile(path.join(logDir, `${key}.log`), parsed);
				} else {
					fs.unlink(path.join(logDir, `${key}.log`), () => {});
				}

				assert.equal(parsed, expect);
				done();
				next();
			});
		}, (err) => {
			if (err) {
				throw err;
			}
		});
	});
}


templates.registerHelper('canspeak', (data /* , iterator, numblocks */) => ((data.isHuman && data.name === 'Human') ? 'Can speak' : 'Cannot speak'));

templates.registerHelper('test', data => (data.forum && !data.double));

templates.registerHelper('isHuman', (data, iterator) => data.animals[iterator].isHuman);

prepare(test);
