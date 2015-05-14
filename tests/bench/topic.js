/*use strict*/

global.tjs = require('../../lib/templates.js');
global.data = require('./topic.json');
global.template = require('fs').readFileSync('tests/bench/topic.tpl').toString();


module.exports = function() {
	global.tjs.parse(global.template, global.data);
};