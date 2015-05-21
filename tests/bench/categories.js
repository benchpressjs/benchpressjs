/*use strict*/

global.tjs = require('../../lib/templates.js');
global.data = require('./categories.json');
global.template = require('fs').readFileSync('tests/bench/categories.tpl').toString();

module.exports = function() {
	global.tjs.parse(global.template, global.data);
};

module.exports();