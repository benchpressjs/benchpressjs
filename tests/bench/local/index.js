/*use strict*/

var path = require('path'),
	nconf = require('nconf');
	nconf.argv();

global.tjs = require('../../../lib/templates.js');
global.data = JSON.parse(require('fs').readFileSync(path.join('./tmp/', nconf.get('api'))).toString());
global.template = require('fs').readFileSync(path.join('./tmp/', nconf.get('tpl'))).toString();

module.exports = {
	name: 'local bench',
	fn: function() {
		global.tjs.parse(global.template, global.data);
	},
	onComplete: function() {
		console.log('>> ' + this.times.period.toFixed(4) + 's (' + this.times.elapsed + 's total)');
	}
}