'use strict';

/* eslint
  import/no-extraneous-dependencies: [error, { devDependencies: true }],
  no-console: off,
  global-require: off,
*/

const fs = require('fs');
const async = require('async');
const mkdirp = require('mkdirp');
const babel = require('babel-core');

const config = {
  uglify: {
    options: {
      banner: '/*! <%= pkg.name %> by psychobunny, built on <%= grunt.template.today("yyyy-mm-dd") %> */\n',
    },
    build: {
      files: {
        'build/benchpress.min.js': ['build/benchpress.js'],
      },
    },
  },
  watch: {
    scripts: {
      files: ['**/*.js'],
      tasks: ['babel', 'build', 'uglify', 'mochaTest'],
      options: {
        spawn: true,
      },
    },
  },
  mochaTest: {
    test: {
      options: {
        reporter: 'spec',
        clearRequireCache: true,
      },
      src: ['tests/*.js'],
    },
  },
  babel: {
    options: {
      sourceMap: true,
      plugins: [
        'transform-class-properties',
      ],
    },
    dist: {
      files: [
        {
          expand: true,
          cwd: 'lib',
          src: ['**/*.js'],
          dest: 'build/lib',
        },
      ],
    },
  },
};

function benchmark() {
  const bench = require('./tests/bench');
  const done = this.async();

  bench((err, output) => {
    if (err) {
      done(err);
      return;
    }

    output.forEach(x => console.log(x));
    done();
  });
}

const babelConfig = {
  plugins: [
    'check-es2015-constants',
    'transform-es2015-arrow-functions',
    'transform-es2015-block-scoped-functions',
    'transform-es2015-block-scoping',
    'transform-es2015-function-name',
    'transform-es2015-shorthand-properties',
  ],
};

function wrap([shimFile, runtimeFile], next) {
  const cutout = /\/\* build:SERVER-ONLY:open \*\/[\s\S]*?\/\* build:SERVER-ONLY:close \*\//g;
  const shimSource = shimFile.toString().replace(cutout, '');
  const runtimeSource = runtimeFile.toString().replace(cutout, '');

  const wrapped = `(function (factory) {
    if (typeof define === 'function' && define.amd) {
      define('benchpress', factory);
    }
  })(function () {
    const runtime = (function () {
      ${runtimeSource}

      return runtime;
    })();

    ${shimSource}

    return Benchpress;
  });`;

  const transpiled = babel.transform(wrapped, babelConfig).code;

  next(null, transpiled);
}

function build() {
  const done = this.async();

  async.waterfall([
    next => async.parallel([
      cb => fs.readFile('lib/benchpress.js', cb),
      cb => fs.readFile('lib/runtime.js', cb),
    ], next),
    wrap,
    (file, next) => mkdirp('build', err => next(err, file)),
    (file, next) => fs.writeFile('build/benchpress.js', file, next),
  ], done);
}

module.exports = function Gruntfile(grunt) {
  config.pkg = grunt.file.readJSON('package.json');
  grunt.initConfig(config);

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-babel');

  grunt.registerTask('benchmark', 'Run benchmarks', benchmark);

  grunt.registerTask('build', 'Stripping and wrapping shim', build);

  grunt.registerTask('default', ['babel', 'build', 'uglify', 'mochaTest']);
  grunt.registerTask('bench', ['default', 'benchmark']);
};
