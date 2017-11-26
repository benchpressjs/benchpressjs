'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const async = require('async');
const assert = require('assert');

const benchpress = require('../build/lib/benchpress');
const { compileTemplate, equalsIgnoreWhitespace } = require('./lib/utils');
const data = require('./data.json');

const app = express();

const templatesDir = path.join(__dirname, 'templates/build');

app.engine('jst', benchpress.__express);
app.set('view engine', 'jst');
app.set('views', templatesDir);

describe('express', () => {
  const name = 'basic';
  const sourcePath = path.join(__dirname, `templates/source/${name}.tpl`);
  const compiledPath = path.join(templatesDir, `${name}.jst`);
  const expectedPath = path.join(__dirname, `templates/expected/${name}.html`);

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
    assert.ok(benchpress.cache[compiledPath]);

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
    benchpress.cache[compiledPath] = () => { throw error; };

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
