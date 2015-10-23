/*use strict*/

global.tjs = require('../../../lib/templates.js');
global.data = JSON.parse(require('fs').readFileSync('./tmp/api.json').toString());
global.template = require('fs').readFileSync('./tmp/template.tpl').toString();

module.exports = function() {
	global.tjs.parse(global.template, global.data);
};