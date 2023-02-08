'use strict';

/* eslint
  import/no-extraneous-dependencies: [error, { devDependencies: true }],
  no-console: off,
  global-require: off,
*/

const fs = require('fs').promises;
const mkdirp = require('mkdirp');

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
  shell: {
    compiler: 'wasm-pack build --target nodejs --out-dir ../build/compiler compiler',
    docs: 'npm run docs',
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

function wrap([shimFile, runtimeFile]) {
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

  return wrapped;
}

function client() {
  const done = this.async();

  (async () => {
    const files = await Promise.all([
      fs.readFile('lib/benchpress.js'),
      fs.readFile('lib/runtime.js'),
      mkdirp('build'),
    ]);

    const wrapped = wrap(files);
    await fs.writeFile('build/benchpress.js', wrapped);
  })().then(() => done(), (err) => {
    console.error(err);
    done(false);
  });
}

module.exports = function Gruntfile(grunt) {
  config.pkg = grunt.file.readJSON('package.json');
  grunt.initConfig(config);

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('benchmark', 'Run benchmarks', benchmark);

  grunt.registerTask('client', 'Stripping and wrapping shim', client);

  grunt.registerTask('build', ['client', 'uglify', 'shell:compiler', 'shell:docs']);
  grunt.registerTask('default', ['build', 'mochaTest']);
  grunt.registerTask('bench', ['default', 'benchmark']);
};
