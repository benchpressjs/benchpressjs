# <img alt="benchpress" src="https://cdn.rawgit.com/benchpressjs/benchpressjs/master/benchpress.svg" />

[![Build Status](https://travis-ci.org/benchpressjs/benchpressjs.png?branch=master)](https://travis-ci.org/benchpressjs/benchpressjs)
[![Coverage Status](https://coveralls.io/repos/github/benchpressjs/benchpressjs/badge.svg?branch=master)](https://coveralls.io/github/benchpressjs/benchpressjs?branch=master)
[![Dependency Status](https://david-dm.org/benchpressjs/benchpressjs.svg)](https://david-dm.org/benchpressjs/benchpressjs)
[![Code Climate](https://codeclimate.com/github/benchpressjs/benchpressjs.png)](https://codeclimate.com/github/benchpressjs/benchpressjs)

Benchpress is an ultralight (1.3kb minified) and super fast templating framework for Javascript and node.js.

It has [express](http://expressjs.com/) support out-of-the-box, and requires zero client-side dependencies.

## Installation
Benchpress is available as an npm module:

    npm i benchpressjs

For native module acceleration on Windows, you must have the VS2015 Redistributable binaries installed:

[Visual C++ Redistributable for Visual Studio 2015](https://www.microsoft.com/en-us/download/details.aspx?id=48145)

### Manually Building Native Module
The rust native module template compiler is approximately 30 times faster than the Javascript-based compiler. Binaries are pre-built for most of the latest versions of Node on both Linux and Windows (build matrix can be seen in the [latest build listed here](https://github.com/benchpressjs/benchpress-rs/actions?query=workflow%3A%22Build+and+publish+binaries+for+distribution+with+npm+package%22)). If a pre-built binary is unavailable, you'll see something similar to the following during an install:

```text
> benchpressjs@2.0.7 postinstall /home/peter/Dev/benchpressjs
> cd rust/benchpress-rs && npm install || echo '[benchpress] Native module install failed. Will use the fallback JS compiler.'


> benchpress-rs@0.1.0 postinstall /home/peter/Dev/benchpress-rs
> node scripts/install

[benchpress] No compatible pre-built native module found! { platform: 'linux', module_version: '67', node: '11.15.0' }
[benchpress] Building native module from source...
neon ERR! spawn cargo ENOENT

Error: spawn cargo ENOENT
    at Process.ChildProcess._handle.onexit (internal/child_process.js:247:19)
    at onErrorNT (internal/child_process.js:429:16)
    at processTicksAndRejections (internal/process/task_queues.js:81:17)
    at process.runNextTicks [as _tickCallback] (internal/process/task_queues.js:56:3)
    at Function.Module.runMain (internal/modules/cjs/loader.js:880:11)
    at internal/main/run_main_module.js:21:11
[benchpress] FATAL: Fallback build failed. For more info, see https://github.com/benchpressjs/benchpressjs#manually-building-native-module
npm ERR! code ELIFECYCLE
npm ERR! errno 1
npm ERR! benchpress-rs@0.1.0 postinstall: `node scripts/install`
npm ERR! Exit status 1
npm ERR! 
npm ERR! Failed at the benchpress-rs@0.1.0 postinstall script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /home/peter/.npm/_logs/2020-10-11T19_20_03_873Z-debug.log
[benchpress] Native module install failed. Will use the fallback JS compiler.
```

If for some reason a pre-built binary is not available or will not function, building one manually on your system is possible:

1. [Install the required dependencies for Neon](https://neon-bindings.com/docs/getting-started/).
2. Re-run `npm install` to re-run the build script, which should build a native module at `rust/benchpress-rs/native/index.node` and copy it to `rust/benchpress-rs/index.node`.

#### Build Flags and Env Variables

Skip the build from source fallback, when a compatible native module is not found
- Set env var `BENCHPRESS_SKIP_FALLBACK=true`

Force a build from source, even if a compatible pre-built module is found (take precedence over `BENCHPRESS_SKIP_FALLBACK`)
- `npm install --build-from-source`
- Set env var `BENCHPRESS_FORCE_BUILD=true`

## API
Benchpress uses an ahead of time (AOT) compilation model. It requires that you precompile templates into Javascript modules before using them.

### `.precompile(source, { minify = false, unsafe = false }): Promise<string>`
This method compiles a template source into Javascript code, optionally minifying the result with UglifyJS

```js
const benchpress = require('benchpressjs');
const template = 'My favourite forum software is {forum}. This templating engine is written in {language}.';
benchpress.precompile(template, {}).then((precompiled) => {
  // store it somewhere
});

// precompiled output
(function (factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  }
})(function () {
  function compiled(helpers, context, get, iter, helper) {
    return 'My favourite forum software is ' + get(context && context['forum']) + '. This templating engine is written in ' + get(context && context['language']) + '.';
  }

  return compiled;
});
```

### `.__express`

This method provides an express engine API.

```js
const express = require('express');
const app = express();
const benchpress = require('benchpressjs');

const data = {
  foo: 'bar',
};

app.configure(function() {
  app.engine('jst', benchpress.__express);
  app.set('view engine', 'jst');
  app.set('views', 'path/to/compiled/templates');
});

app.render('myview', data, function(err, html) {
  console.log(html);
});

app.get('/myroute', function(res, req, next) {
  res.render('myview', data);
});
```

### `.render(template, data): Promise<string>` (alias: `.parse(template, data, callback(string))`)

This method is used mainly to parse templates on the client-side.
To use it, `.registerLoader(loader)` must be used to set the callback for fetching compiled template modules.

```js
require(['benchpress'], (benchpress) => {
  benchpress.registerLoader((name, callback) => {
    // fetch `name` template module
  });

  benchpress.render('basic', {
    forum: 'NodeBB',
    language: 'Javascript',
  }).then((output) => {
    // do something with output
  });
});
```

This has been a quick rundown of the API. [See the full docs](docs/readme.md)

## Template Syntax
Sample data, see test cases for more:

```json
{
  "animals": [
    {
      "name": "Cat",
      "species": "Felis silvestris catus",
      "isHuman": false,
    },
    {
      "name": "Dog",
      "species": "Canis lupus familiaris",
      "isHuman": false,
    },
    {
      "name": "Human",
      "species": "Homo sapiens",
      "isHuman": true
    }
  ],
  "package": {
    "name": "benchpressjs",
    "author": "psychobunny",
    "url": "http://www.github.com/benchpressjs/benchpress"
  },
  "website": "http://burnaftercompiling.com",
  "sayHello": true
}
```

### Simple key/value
```
My blog URL is {website}. The URL for this library is {{package.url}}
```

### Conditionals
```html
<!-- IF sayHello -->
  Hello world!
<!-- END -->

<!-- IF !somethingFalse -->
  somethingFalse doesn't exist
<!-- END -->
```
Benchpress supports several syntaxes for conditionals in order to be backwards compatible with **templates.js**.
`<!-- ENDIF abcd -->`, `<!-- END abcd -->`, `<!-- ENDIF !foobar -->`, and `<!-- END -->` are all equivalent tokens as far as Benchpress is concerned.

### Iteration
Repeat blocks of HTML. The two special keys `@first` and `@last` are available as booleans, and the `@index`, `@key`, and `@value` special keys are also available. Benchpress supports iterating over objects, in which case `@index` will be the current loop number and `@key` will be the key of the current item. For normal arrays, `@key == @index`.

```html
<!-- BEGIN animals -->
  {animals.name} is from the species {animals.species}.
  <!-- IF !animals.isHuman -->
    - This could be a pet.
  <!-- ENDIF !animals.isHuman -->
<!-- END animals -->

prints out:

Cat is from the species Felis silvestris catus.
- This could be a pet.
Dog is from the Canis lupus familiaris.
- This could be a pet.
Human is from the species Homo sapiens.
```

Benchpress supports several syntaxes for iteration in order to be backwards compatible with **templates.js**:
 - `<!-- END abcd -->` == `<!-- END foo -->` == `<!-- END -->`
 - `<!-- BEGIN abc --> {abc.def} <!-- END -->` == `<!-- BEGIN abc --> {../def} <!-- END -->` which will print the `def` key of every item in `abc`.

There is a grey zone where if you wish to print a field of the object you are iterating over, you can't directly. This is a breaking change from **templates.js**. To fix this, change `{abc.def}` to `{../../abc.def}`.

### Helpers

Helpers are JavaScript methods for advanced logic in templates. This example shows a really simple example of a function called `print_is_human` which will render text depending on the current block's data.

```js
benchpress.registerHelper('print_is_human', function (data) {
  return (data.isHuman) ? "Is human" : "Isn't human";
});
```

```html
<!-- BEGIN animals -->
{function.print_is_human}
<!-- END animals -->

prints out:

Isn't human
Isn't human
Is human
```

## Testing

    npm install
    npm test

## Projects using Benchpress

[NodeBB](http://www.nodebb.org)

Add yours here by submitting a PR :)
