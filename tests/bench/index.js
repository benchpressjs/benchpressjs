'use strict';

const Benchmark = require('benchmark');

const benchpress = require('../../build/lib/benchpress');
const categories = require('./categories');
const topic = require('./topic');
const compilation = require('./compilation');

Benchmark.options.defer = true;
Benchmark.options.minSamples = 100;
const suite = new Benchmark.Suite();

async function benchmark() {
  const [cats, top, comp] = await Promise.all([
    categories(),
    topic(),
    compilation(),
  ]);

  const cache = {
    categories: cats.template,
    topic: top.template,
  };

  benchpress.registerLoader(async name => cache[name]);

  const output = [];

  return new Promise((resolve) => {
    suite
      .add('categories', cats.bench)
      .add('topic', top.bench)
      .add('compilation', comp.bench)
      .on('cycle', (event) => {
        output.push(event.target.toString());
      })
      .on('complete', () => {
        resolve(output);
      })
      .run({
        async: true,
      });
  });
}

module.exports = benchmark;
