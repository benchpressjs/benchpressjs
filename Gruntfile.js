'use strict';

/* eslint import/no-extraneous-dependencies: [error, { devDependencies: true }], no-console: off */

const fs = require('fs');
const nconf = require('nconf');
const async = require('async');
const babel = require('babel-core');

const bench = require('./tests/bench');

nconf.argv();

module.exports = function Gruntfile(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> by psychobunny, built on <%= grunt.template.today("yyyy-mm-dd") %> */\n',
			},
			build: {
				src: 'build/templates.js',
				dest: 'build/templates.min.js',
			},
		},
		watch: {
			scripts: {
				files: ['**/*.js'],
				tasks: ['default'],
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
				src: ['tests/index.js'],
			},
		},
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-mocha-test');

	grunt.registerTask('benchmark', 'Run benchmarks', function benchmark() {
		const done = this.async();

		bench((err, output) => {
			if (err) {
				done(err);
				return;
			}

			output.forEach(x => console.log(x));
			done();
		});
	});

	grunt.registerTask('build', 'Stripping and wrapping shim', function build() {
		const done = this.async();

		async.waterfall([
			next => async.parallel([
				cb => fs.readFile('lib/benchpress.js', cb),
				cb => fs.readFile('lib/compiler/runtime.js', cb),
			], next),
			([shimFile, runtimeFile], next) => {
				const cutout = /\/\* build:SERVER-ONLY:open \*\/[\s\S]*?\/\* build:SERVER-ONLY:close \*\//g;
				const shimSource = shimFile.toString().replace(cutout, '');
				const runtimeSource = runtimeFile.toString().replace(cutout, '');

				const wrapped = `(function (factory) {
					if (typeof define === 'function' && define.amd) {
						define('templates', factory);
					}
				})(function () {
					const runtime = (function () {
						${runtimeSource}

						return runtime;
					})();

					${shimSource}

					return Benchpress;
				});`;

				const transpiled = babel.transform(wrapped, {
					plugins: [
						'check-es2015-constants',
						'transform-es2015-arrow-functions',
						'transform-es2015-block-scoped-functions',
						'transform-es2015-block-scoping',
						'transform-es2015-function-name',
						'transform-es2015-shorthand-properties',
					],
				}).code;

				next(null, transpiled);
			},
			(file, next) => fs.writeFile('build/templates.js', file, next),
		], done);
	});

	grunt.registerTask('default', ['build', 'uglify', 'mochaTest', 'benchmark', 'watch']);
};
