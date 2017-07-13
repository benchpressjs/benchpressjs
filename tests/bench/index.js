'use strict';

const async = require('async');
const Benchmark = require('benchmark');

const benchpress = require('../../build/lib/benchpress');
const categories = require('./categories');
const topic = require('./topic');

const suite = new Benchmark.Suite();

function benchmark(done) {
	async.parallel([
		categories,
		topic,
	], (err, [cats, top]) => {
		const cache = {
			categories: cats.template,
			topic: top.template,
		};

		benchpress.registerLoader((name, callback) => {
			callback(cache[name]);
		});

		const output = [];

		suite
			.add('categories', cats.bench, {
				defer: true,
			})
			.add('topic', top.bench, {
				defer: true,
			})
			.on('cycle', (event) => {
				output.push(event.target.toString());
			})
			.on('complete', () => {
				done(null, output);
			})
			.run({
				async: true,
			});
	});
}
module.exports = benchmark;
