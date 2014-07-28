var fs = require('fs'),
	path = require('path');


fs.readFile('../tests/templates/items.tpl', function(err, file) {
	file = file.toString();
	//console.log(file);

	//file = function(options) {
		//return '<h3>' + options.header + '</h3>\r\nnib' + ;
	//}

	file = compiler.compile(file);

	var html = templates.parse(file, {
		header: 'compiling like a pro', 
		items: [
			{
				name: 'herp'
			},
			{
				name: 'derp'
			}
		]
	});

	console.log(html);

});


var compiler = {};

compiler.compile = function(template) {
	template = template.replace('')
};


var templates = {};

templates.parse = function(template, items) {
	return template.call(this, items);
};