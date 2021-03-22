# <img alt="benchpress" src="https://cdn.rawgit.com/benchpressjs/benchpressjs/master/benchpress.svg" />

![CI Status](https://github.com/benchpressjs/benchpressjs/workflows/Lint%20and%20test/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/benchpressjs/benchpressjs/badge.svg?branch=master)](https://coveralls.io/github/benchpressjs/benchpressjs?branch=master)
[![Code Climate](https://codeclimate.com/github/benchpressjs/benchpressjs.png)](https://codeclimate.com/github/benchpressjs/benchpressjs)

Benchpress is an ultralight (1.3kb minified + gzipped) and super fast templating framework for Javascript and node.js.

It has [express](http://expressjs.com/) support out-of-the-box, and requires zero client-side dependencies.

## Installation
Benchpress is available as an npm module:

    npm i benchpressjs

## API
The following is a quick rundown of the API. [See the full docs](docs/readme.md)

Benchpress uses an ahead of time (AOT) compilation model. It requires that you precompile templates into Javascript modules before using them.

### `.precompile(source, { filename }): Promise<string>`
This method compiles a template source into Javascript code.

```js
const fs = require('fs').promises;
const benchpress = require('benchpressjs');

const template = await fs.readFile('path/to/source/templates/favorite.tpl', 'utf8');
const compiled = await benchpress.precompile(template, { filename: 'favorite.tpl' });
await fs.writeFile('path/to/compiled/templates/favorite.jst', compiled);
```

`path/to/source/templates/favorite.tpl`
```html
My favourite forum software is {forum}. This templating engine is written in {language}.
```

`path/to/compiled/templates/favorite.jst`
```js
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

app.get('/myroute', function(req, res, next) {
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
{{{ if sayHello }}}
  Hello world!
{{{ end }}}

{{{ if !somethingFalse }}}
  somethingFalse doesn't exist
{{{ end }}}
```
Benchpress supports several syntaxes for conditionals in order to be backwards compatible with **templates.js**.
`<!-- ENDIF abcd -->`, `<!-- END abcd -->`, `<!-- ENDIF !foobar -->`, and `<!-- END -->` are all equivalent tokens as far as Benchpress is concerned.

### Iteration
Repeat blocks of HTML. The two special keys `@first` and `@last` are available as booleans, and the `@index`, `@key`, and `@value` special keys are also available. Benchpress supports iterating over objects, in which case `@index` will be the current loop number and `@key` will be the key of the current item. For normal arrays, `@key == @index`.

```html
{{{ each animals }}}
  {animals.name} is from the species {animals.species}.
  {{{ if !animals.isHuman }}}
    - This could be a pet.
  {{{ end }}}
{{{ end }}}

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
{{{ each animals }}}
{print_is_human(@value)}
{{{ end }}}

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
