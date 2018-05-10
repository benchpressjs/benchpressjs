'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const async = require('async');
const assert = require('assert');

const Benchpress = require('../build/lib/benchpress');
const { compileTemplate, equalsIgnoreWhitespace } = require('./lib/utils');
const data = require('./data.json');

const templatesDir = path.join(__dirname, 'templates/build');
const name = 'basic';
const sourcePath = path.join(__dirname, `templates/source/${name}.tpl`);
const compiledPath = path.join(templatesDir, `${name}.jst`);
const expectedPath = path.join(__dirname, `templates/expected/${name}.html`);

[true, false].forEach((native) => {
  const type = native ? 'native' : 'fallback';

  let app;

  describe(`express (${type})`, () => {
    before(() => {
      Benchpress.precompile.defaults.native = native;
      Benchpress.flush();

      app = express();

      app.engine('jst', Benchpress.__express);
      app.set('view engine', 'jst');
      app.set('views', templatesDir);
    });

    it('app.render should work first time', (done) => {
      async.waterfall([
        next => compileTemplate(sourcePath, compiledPath, next),
        next => fs.readFile(expectedPath, 'utf8', next),
        (expected, next) => {
          app.render(name, data, (err, rendered) => next(err, rendered, expected));
        },
        (rendered, expected, next) => {
          equalsIgnoreWhitespace(rendered, expected);
          next();
        },
      ], done);
    });

    it('app.render should work from cache', (done) => {
      assert.ok(Benchpress.cache[compiledPath]);

      async.waterfall([
        next => fs.readFile(expectedPath, 'utf8', next),
        (expected, next) => {
          app.render(name, data, (err, rendered) => next(err, rendered, expected));
        },
        (rendered, expected, next) => {
          equalsIgnoreWhitespace(rendered, expected);
          next();
        },
      ], done);
    });

    it('should catch errors in render', (done) => {
      const error = new Error();
      Benchpress.cache[compiledPath] = () => { throw error; };

      app.render(name, data, (err) => {
        assert.strictEqual(err, error);
        assert.ok(err.message.startsWith('Render failed'));
        done();
      });
    });

    it('should catch errors in evaluate', (done) => {
      const id = 'some-random-name';
      const tempPath = path.join(templatesDir, `${id}.jst`);

      async.series([
        next => fs.writeFile(tempPath, 'throw Error()', next),
        (next) => {
          app.render(id, data, (err) => {
            assert.ok(err);
            assert.ok(err.message.startsWith('Evaluate failed'));

            next();
          });
        },
        next => fs.unlink(tempPath, next),
      ], done);
    });

    it('should fail if file does not exist', (done) => {
      const id = 'file-that-does-not-exist';
      app.render(id, data, (err) => {
        assert.ok(err);

        done();
      });
    });
  });
});
