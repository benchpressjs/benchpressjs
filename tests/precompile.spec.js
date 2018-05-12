'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Benchpress = require('../build/lib/benchpress');

const tplPath = path.join(__dirname, './templates/source/conditional-with-else-inside-loop.tpl');
const template = fs.readFileSync(tplPath).toString();

[true, false].forEach((native) => {
  const type = native ? 'native' : 'fallback';

  describe(`precompile (${type})`, () => {
    before(() => {
      Benchpress.precompile.defaults.native = native;
      Benchpress.flush();
    });

    it('should work with Promise usage', () =>
      Benchpress.precompile(template, {})
        .then((code) => {
          assert(code);
          assert(code.length);
        })
    );

    it('should work with callback usage', (done) => {
      Benchpress.precompile(template, {}, (err, code) => {
        assert.ifError(err);

        assert(code);
        assert(code.length);
        done();
      });
    });

    it('should work with old arguments', (done) => {
      Benchpress.precompile({ source: template }, (err, code) => {
        assert.ifError(err);

        assert(code);
        assert(code.length);
        done();
      });
    });

    it('should work with minify on', () =>
      Benchpress.precompile(template, { minify: true })
        .then((minified) => {
          assert(minified);

          return Benchpress.precompile(template, { minify: false })
            .then((code) => {
              assert(minified.length < code.length);
            });
        })
    );
  });
});
