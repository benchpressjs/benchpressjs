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
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-mocha-test');

	grunt.registerTask('default', ['uglify']);
	grunt.registerTask('default', 'mochaTest');
};