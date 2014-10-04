# <img alt="templates.js" src="http://i.imgur.com/vVyRepC.png" />
[![Build Status](https://travis-ci.org/psychobunny/templates.js.png?branch=master)](https://travis-ci.org/psychobunny/templates.js)
[![Code Climate](https://codeclimate.com/github/psychobunny/templates.js.png)](https://codeclimate.com/github/psychobunny/templates.js)
[![Dependency Status](https://david-dm.org/psychobunny/templates.js.png)](https://david-dm.org/psychobunny/templates.js)

templates.js is an ultralight (1.72kb minified and gzipped) and super fast templating framework for JavaScript and node.js.

It has [express](http://expressjs.com/) support out-of-the-box.

## API

Parse templates by passing in a template string and an object representing the data to be parsed.

```
var parsed = templates.parse(template, data);
```

### templates.js client-side

```
<html>
<head>
	<script type="text/javascript" src="path/to/templates.js"></script>
</head>
<body>
	<div id="template">
		<p>{quote.text}</p>
		<strong>{quote.author}</strong>
	</div>

	<script type="text/javascript">
		var el = document.getElementById('template');

		el.innerHTML = templates.parse(el.innerHTML, {
			quote: {
				text: "Life is really simple, but we insist on making it complicated.",
				author: "Confucius"
			}
		});
	</script>
</body>
</html>
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

app.get('/myview', function(res, req, next) {
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

### Arrays
Repeat blocks of HTML with an array. The two helpers `@first` and `@last` are also available as conditionals within an array.

```
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
## Installation

    npm install templates.js

## Testing

    npm install
    npm test

## Projects using templates.js

[NodeBB](http://www.nodebb.org)

Add yours here by submitting a PR :)
