"use strict";
/*global $, templates, json*/

function load(template, callback) {
	$.get('../templates/items.tpl' + template + '.tpl' + Date.now(), function(html) {
		callback(html);
	});

	$.ajax({
		url: '../templates/' + template + '.tpl',
		type: 'GET',
		success: function(data) {
			callback(null, data);
		},
		error: function(error) {
			callback({message: error.statusText}, false);
		}
	});
}

function init() {
	templates.registerLoader(load);
	templates.parse('items', json, function(err, html) {
		if (err) {
			throw new Error(err.message);
		}
		
		$('body').html(html);
	});
}

window.onload = init;