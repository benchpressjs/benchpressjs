module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> by psychobunny, built on <%= grunt.template.today("yyyy-mm-dd") %> */\n'
			},
			build: {
				src: 'lib/templates.js',
				dest: 'build/templates.min.js'
			}
		},
		watch: {
			scripts: {
				files: ['**/*.js'],
					tasks: ['mochaTest'],
					options: {
					spawn: true,
				}
			}
		},
		mochaTest: {
			test: {
				options: {
					reporter: 'spec',
					clearRequireCache: true
				},
				src: ['tests/lib/tests.js']
			}
		},
		benchmark: {
			all: {
				src: ['tests/bench/*.js']
			},
			remote: {
				src: ['tests/bench/remote/index.js']
			},
			local: {
				src: ['tests/bench/local/index.js']
			}
		},
		watch: {
			all: {
				files: ['lib/**/*.js', 'tests/**/*.js'],
				tasks: ['default']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-benchmark');

	grunt.registerTask('loadRemote', 'Loading remote data', function() {
		var done = this.async();

		var api = nconf.get('api'),
			tpl = nconf.get('tpl'),
			request = require('request'),
			fs = require('fs');

		require('async').parallel({
			api: function(next) {
				request.get(api, function(err, response, body) {
					fs.writeFile('tmp/api.json', body.toString(), next);
				});
			},
			tpl: function(next) {
				request.get(tpl, function(err, response, body) {
					fs.writeFile('tmp/template.tpl', body.toString(), next);
				});
			}
		}, function(err) {
			if (err) {
				return console.log(err);
			}

			done();
		});
	});

	var nconf = require('nconf');
	nconf.argv();

	if (nconf.get('local')) {
		grunt.registerTask('default', ['uglify', 'mochaTest', 'benchmark:local', 'watch']);
	} else if(nconf.get('api')) {	
		grunt.registerTask('default', ['uglify', 'mochaTest', 'loadRemote', 'benchmark:remote', 'watch']);
	} else {
		grunt.registerTask('default', ['uglify', 'mochaTest', 'benchmark:all', 'watch']);
	}
};