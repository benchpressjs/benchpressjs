"use strict";

window.json = {
	"animals": [
		{
			"name": "Cat",
			"species": "Felis silvestris catus",
			"isHuman": false,
			"pet": {
				"trainable": true,
				"info": "Hates dogs, eats goldfish"
			},
			"hates": [
				{
					"name": "dogs"
				},
				{
					"name": "humans"
				}
			]
		},
		{
			"name": "Dog",
			"species": "Canis lupus familiaris",
			"isHuman": false,
			"pet": {
				"trainable": true,
				"info": "Hates cats"
			}
		},
		{
			"name": "Goldfish",
			"species": "Carassius auratus auratus",
			"isHuman": false,
			"pet": {
				"trainable": false,
				"info": "Keep away from cats"
			}
		},
		{
			"name": "Human",
			"species": "Homo sapiens",
			"isHuman": true,
			"hobbies": [
				{
					"name": "guitar",
				}, 
				{
					"name": "programming",
				}, 
				{
					"name": "sports"
				}
			]
		}
	],
	"package": {
		"name": "templates.js",
		"author": "psychobunny",
		"url": "http://www.github.com/psychobunny/templates.js"
	},
	"forum": "NodeBB",
	"language": "JavaScript",
	"isTrue": true,
	"isFalse": false,
	"website": "http://burnaftercompiling.com",
    "sayHello": true,
	"header": "Colors",
	"items": [
		{
			"name": "rainbow",
			"url": "#Rainbow"
		},
		{
			"name": "red",
			"link": true,
			"url": "#Red"
		},
		{
			"name": "orange",
			"link": true,
			"url": "#Orange"
		},
		{
			"name": "yellow",
			"link": true,
			"url": "#Yellow"
		},
		{
			"name": "green",
			"link": true,
			"url": "#Green"
		},
		{
			"name": "blue",
			"link": true,
			"url": "#Blue"
		},
		{
			"name": "purple",
			"link": true,
			"url": "#Purple"
		},
		{
			"name": "white",
			"link": false,
			"url": "#While"
		},
		{
			"name": "black",
			"link": false,
			"url": "#Black"
		}
	],
	"double": true
};