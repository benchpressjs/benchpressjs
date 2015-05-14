/*use strict*/

var tjs = require('../../lib/templates.js'),
	data = require('./topic.json'),
	template = require('fs').readFileSync('tests/bench/topic.tpl').toString();


module.exports = function() {
	tjs.parse(data, template);
};