# <img alt="templates.js" src="http://i.imgur.com/vVyRepC.png" />
[![Build Status](https://travis-ci.org/psychobunny/templates.js.png?branch=master)](https://travis-ci.org/psychobunny/templates.js)
[![Code Climate](https://codeclimate.com/github/psychobunny/templates.js.png)](https://codeclimate.com/github/psychobunny/templates.js)
[![Dependency Status](https://david-dm.org/psychobunny/templates.js.png)](https://david-dm.org/psychobunny/templates.js)

templates.js is an ultralight (1.98kb minified and gzipped) and super fast templating framework for JavaScript and node.js.


## API

```
// Register helpers, optional.
templates.registerHelper('hello_world', function(data, iterator, numblocks) {
	return (data.sayHello) ? "Hello World!" : "Goodbye!";
});

var html = templates.parse(template, {sayHello: true});
```

### templates.js and express

```
var express = require('express'),
	app = express(),
	templates = require('templates.js'),
	data = {};

app.configure(function() {
	app.engine('tpl', templates.__express);
	app.set('view engine', 'tpl');
	app.set('views', 'path/to/templates');
});

app.render('myview', data, function(err, html) {
	console.log(html);
});

app.get('/test', function(res, req, next) {
	res.render('myview', data);
});
```


## Template Syntax
Sample data, see test cases for more:

```
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
		"name": "templates.js",
		"author": "psychobunny",
		"url": "http://www.github.com/psychobunny/templates.js"
	},
	"website": "http://burnaftercompiling.com",
	"sayHello": true
}
```

### Simple key/value
```
My blog URL is {website}. The URL for this library is {package.url}
```

### Conditionals
```
<!-- IF sayHello -->
  Hello world!
<!-- ENDIF sayHello -->

<!-- IF !somethingFalse -->
  somethingFalse doensn't exist
<!-- ENDFIF !somethingFalse -->
```

### Arrays:
```
<!-- BEGIN animals -->
  {animals.name} is from the species {animals.species}.<br />
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

### Helpers

Helpers are JavaScript methods for advanced logic in templates. This example shows a really simple example of a function called `print_is_human` which will render text depending on the current block's data.

```
templates.registerHelper('print_is_human', function(data, iterator, numblocks) {
	return (data.isHuman) ? "Is human" : "Isn't human";
});

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

## Projects using templates.js

[NodeBB](http://www.nodebb.org)

Add yours here by submitting a PR :)
