/* eslint import/no-extraneous-dependencies: ["error", { devDependencies: true }] */
/* eslint no-console: off */

const request = require('request');
const fs = require('fs');
const nconf = require('nconf');
const async = require('async');
const babel = require('babel-core');

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
		benchmark: {
			all: {
				src: ['tests/bench/*.js'],
			},
			remote: {
				src: ['tests/bench/remote/index.js'],
			},
			local: {
				src: ['tests/bench/local/index.js'],
			},
		},
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-benchmark');

	grunt.registerTask('loadRemote', 'Loading remote data', function loadRemote() {
		const done = this.async();

		const api = nconf.get('api');
		const tpl = nconf.get('tpl');

		async.parallel({
			api(next) {
				request.get(api, (err, response, body) => {
					fs.writeFile('tmp/api.json', body.toString(), next);
				});
			},
			tpl(next) {
				request.get(tpl, (err, response, body) => {
					fs.writeFile('tmp/template.tpl', body.toString(), next);
				});
			},
		}, (err) => {
			if (err) {
				console.log(err);
				return;
			}

			done();
		});
	});

	grunt.registerTask('build', 'Stripping and wrapping shim', function build() {
		const done = this.async();

		async.waterfall([
			fs.readFile.bind(null, 'lib/shim.js'),
			(file, next) => {
				const cutout = /\/\* build:SERVER-ONLY:open \*\/[\s\S]*?\/\* build:SERVER-ONLY:close \*\//g;
				const source = file.toString().replace(cutout, '');

				const wrapped = `(function (factory) {
					if (typeof define === 'function' && define.amd) {
						define('templates', ['handlebars.runtime'], function (Handlebars) {
							return factory(Handlebars.default);
						});
					} else {
						window.Templates = factory(window.Handlebars);
					}
				})(function (Handlebars) {
					${source}

					return Shim;
				});
				require(['templates'], function (Templates) {
					window.templates = Templates;
				});`;

				const transpiled = babel.transform(wrapped, {
					presets: ['es2015'],
				}).code;

				next(null, transpiled);
			},
			(file, next) => fs.writeFile('build/templates.js', file, next),
		], done);
	});

	if (nconf.get('local')) {
		grunt.registerTask('default', ['build', 'uglify', 'mochaTest', 'benchmark:local', 'watch']);
	} else if (nconf.get('api')) {	
		grunt.registerTask('default', ['build', 'uglify', 'mochaTest', 'loadRemote', 'benchmark:remote', 'watch']);
	} else {
		grunt.registerTask('default', ['build', 'uglify', 'mochaTest', 'benchmark:all', 'watch']);
	}
};
