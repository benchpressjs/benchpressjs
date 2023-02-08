'use strict';

const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const assert = require('assert');

const Benchpress = require('../build/lib/benchpress');
const { compileTemplate, equalsIgnoreWhitespace } = require('./lib/utils');
const data = require('./data.json');

const templatesDir = path.join(__dirname, 'templates/build');
const name = 'basic';
const sourcePath = path.join(__dirname, `templates/source/${name}.tpl`);
const compiledPath = path.join(templatesDir, `${name}.jst`);
const expectedPath = path.join(__dirname, `templates/expected/${name}.html`);

describe('express', () => {
  let app;

  const render = (n, d) => new Promise((resolve, reject) => {
    app.render(n, d, (err, rendered) => {
      if (err) {
        reject(err);
      } else {
        resolve(rendered);
      }
    });
  });

  before(() => {
    Benchpress.flush();

    app = express();

    app.engine('jst', Benchpress.__express);
    app.set('view engine', 'jst');
    app.set('views', templatesDir);
  });

  it('app.render should work first time', async () => {
    await compileTemplate(sourcePath, compiledPath);
    const expected = await fs.readFile(expectedPath, 'utf8');
    const rendered = await render(name, data);
    equalsIgnoreWhitespace(rendered, expected);
  });

  it('app.render should work from cache', async () => {
    assert.ok(Benchpress.cache[compiledPath]);

    const expected = await fs.readFile(expectedPath, 'utf8');
    const rendered = await render(name, data);
    equalsIgnoreWhitespace(rendered, expected);
  });

  it('should catch errors in render', async () => {
    const error = new Error();
    Benchpress.cache[compiledPath] = () => { throw error; };

    try {
      await render(name, data);
    } catch (err) {
      assert.strictEqual(err, error);
      assert.ok(err.message.startsWith('Render failed'));
    }
  });

  it('should catch errors in evaluate', async () => {
    const id = 'some-random-name';
    const tempPath = path.join(templatesDir, `${id}.jst`);

    await fs.writeFile(tempPath, 'throw Error()');

    try {
      await render(id, data);
    } catch (err) {
      assert.ok(err);
      assert.ok(err.message.startsWith('Evaluate failed'));
    }

    await fs.unlink(tempPath);
  });

  it('should fail if file does not exist', async () => {
    const id = 'file-that-does-not-exist';

    try {
      await render(id, data);
    } catch (err) {
      assert.ok(err);
    }
  });
});
