"use strict";
/*global describe, it*/

var assert = require('assert'),
	templates = require('./../lib/templates.js'),
	data = require('./data.json');

describe('templates.js', function() {
	it('key/values should render correctly', function() {
		var template = "My favourite forum software is {forum}. This templating engine is written in {language}.",
			expected = "My favourite forum software is NodeBB. This templating engine is written in JavaScript.",
			parsed = templates.parse(template, data);

		assert.equal(parsed, expected);
	});

	it('conditionals should render correctly', function() {
		var template = "<!-- IF language -->There is language<!-- ENDIF language -->",
			expected = "There is language",
			parsed = templates.parse(template, data);

		assert.equal(parsed, expected);
	});

	it('arrays should render correctly', function() {
		var template = "<!-- BEGIN animals -->{animals.species}, is commonly known as <strong>{animals.name}</strong><!-- END animals -->",
			expected = "Felis silvestris catus, is commonly known as <strong>Cat</strong>\r\nCanis lupus familiaris, is commonly known as <strong>Dog</strong>\r\nCarassius auratus auratus, is commonly known as <strong>Goldfish</strong>\r\nHomo sapiens, is commonly known as <strong>Human</strong>",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('arrays with conditionals should render correctly', function() {
		var template = "<!-- BEGIN animals --><!-- IF animals.isHuman -->{animals.name} is human<!-- ELSE -->{animals.name} is not human<!-- ENDIF animals.isHuman --><!-- END animals -->",
			expected = "Cat is not human\r\nDog is not human\r\nGoldfish is not human\r\nHuman is human",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('arrays with !conditionals should render correctly', function() {
		var template = "<!-- BEGIN animals --><!-- IF !animals.isHuman -->{animals.name} is not human<!-- ELSE -->{animals.name} is human<!-- ENDIF !animals.isHuman --><!-- END animals -->",
			expected = "Cat is not human\r\nDog is not human\r\nGoldfish is not human\r\nHuman is human",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('arrays with @first blocks should render correctly', function() {
		var template = "<!-- BEGIN animals --><!-- IF @first -->this is first<!-- ELSE -->this is not first<!-- ENDIF @first --><!-- END animals -->",
			expected = "this is first\r\nthis is not first\r\nthis is not first\r\nthis is not first",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('helpers should render correctly', function() {
		templates.registerHelper('canspeak', function(data/*, iterator, numblocks*/) {
			return (data.isHuman && data.name === "Human") ? "Can speak" : "Cannot speak";
		});

		var template = "<!-- BEGIN animals -->{function.canspeak}<!-- END animals -->",
			expected = "Cannot speak\r\nCannot speak\r\nCannot speak\r\nCan speak",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('loops should continue to render correctly', function() {
		var template = "<!-- BEGIN animals --><!-- IF animals.pet.info -->{animals.name} - {animals.pet.info}<!-- ENDIF animals.pet.info --><!-- END animals -->",
			expected = "Cat - Hates dogs, eats goldfish\r\nDog - Hates cats\r\nGoldfish - Keep away from cats",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('more loops should render correctly', function() {
		var template = "<!-- BEGIN animals --><!-- IF animals.pet.trainable -->{animals.name} can be trained<!-- ELSE -->{animals.name} cannot be trained<!-- ENDIF animals.pet.trainable --><!-- END animals -->",
			expected = "Cat can be trained\r\nDog can be trained\r\nGoldfish cannot be trained\r\nHuman cannot be trained",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('objects should render correctly', function() {
		var template = "Rendered using <a href='{package.url}'>{package.name}</a> by {package.author}",
			expected = "Rendered using <a href='http://www.github.com/psychobunny/templates.js'>templates.js</a> by psychobunny",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});

	it('complicated things should render correctly', function() {
		var template = "<h3>{header}</h3><ul><!-- BEGIN items --><!-- IF @first --><li><strong>{items.name}</strong></li><!-- ELSE --><li><!-- IF items.link --><a href='{items.url}'><!-- ENDIF items.link -->{items.name}<!-- IF items.link --></a><!-- ENDIF items.link --></li><!-- ENDIF @first --><!-- END items --></ul><!-- IF something --><p>do something!</p><!-- ENDIF something -->",
			expected = "<h3>Colors</h3><ul><li><strong>rainbow</strong></li>\r\n<li><a href='#Red'>red</a></li>\r\n<li><a href='#Orange'>orange</a></li>\r\n<li><a href='#Yellow'>yellow</a></li>\r\n<li><a href='#Green'>green</a></li>\r\n<li><a href='#Blue'>blue</a></li>\r\n<li><a href='#Purple'>purple</a></li>\r\n<li>white</li>\r\n<li>black</li></ul>",
			parsed = templates.parse(template, data);
			
		assert.equal(parsed, expected);
	});
});