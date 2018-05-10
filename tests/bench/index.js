'use strict';

const async = require('async');
const Benchmark = require('benchmark');

const benchpress = require('../../build/lib/benchpress');
const categories = require('./categories');
const topic = require('./topic');
const compilation = require('./compilation');

Benchmark.options.defer = true;
Benchmark.options.minSamples = 100;
const suite = new Benchmark.Suite();

function benchmark(done) {
  async.parallel([
    categories,
    topic,
    compilation,
  ], (err, [cats, top, comp]) => {
    const cache = {
      categories: cats.template,
      topic: top.template,
    };

    benchpress.registerLoader((name, callback) => {
      callback(cache[name]);
    });

    const output = [];

    suite
      .add('categories', cats.bench)
      .add('topic', top.bench)
      .add('compilation', comp.bench)
      .add('native compilation', comp.benchNative)
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
