"use strict";

(function(module) {
	var templates = {};
	templates.blocks = {};
	templates.helpers = {};
	templates.globals = {};
	templates.cache = {};

	templates.registerHelper = function(name, func) {
		templates.helpers[name] = func;
	};

	templates.parse = function(template, data) {
		return parse(template, registerGlobals(data));
	};

	templates.prepare = function(str) {
		return str;
	};

	templates.render = function(filename, options, fn) {
		var fs = require('fs'),
			tpl = filename.replace(options.settings.views + '/', '');

		if (!templates.cache[tpl]) {
			fs.readFile(filename, function(err, html) {
				templates.cache[tpl] = templates.prepare(html.toString());
				return fn(err, templates.parse(templates.cache[tpl], options));
			});
		} else {
			return fn(null, templates.parse(templates.cache[tpl], options));
		}
	};

	function replace(template, key, value) {
		var searchRegex = new RegExp('{' + key + '}', 'g');
		return template.replace(searchRegex, value);
	}

	function makeRegex(block) {
		return new RegExp("<!--[\\s]*BEGIN " + block + "[\\s]*-->[\\s\\S]*<!--[\\s]*END " + block + "[\\s]*-->", 'g');
	}

	function makeConditionalRegex(block) {
		return new RegExp("<!--[\\s]*IF " + block + "[\\s]*-->([\\s\\S]*?)<!--[\\s]*ENDIF " + block + "[\\s]*-->", 'g');
	}

	function makeStatementRegex(key) {
		return new RegExp("([\\s]*<!--[\\s]*IF " + key + "[\\s]*-->[\\s]*)|([\\s]*<!--[\\s]*ENDIF " + key + "[\\s]*-->[\\s]*)", 'gi');
	}

	function getBlock(template, regex, block) {
		var data = template.match(regex);
		if (data === null) {
			return;
		}

		if (block !== undefined) {
			templates.blocks[block] = data[0];
		}

		var syntax = new RegExp("([\r\n]*<!-- BEGIN " + block + " -->[\r\n]*)|[\r\n]*<!-- END " + block + " -->[\r\n]*", "g");

		return data[0].replace(syntax, "");
	}

	function setBlock(regex, block, template) {
		return template.replace(regex, block);
	}

	function registerGlobals(data) {
		for (var g in templates.globals) {
			if (templates.globals.hasOwnProperty(g)) {
				data[g] = data[g] || templates.globals[g];
			}
		}

		return data;
	}

	function checkConditional(template, key, value) {
		var conditional = makeConditionalRegex(key),
			matches = template.match(conditional);

		if (matches !== null) {
			for (var i = 0, ii = matches.length; i < ii; i++) {
				var conditionalBlock = matches[i].split(/\s*<!-- ELSE -->\s*/),
					statement = makeStatementRegex(key);

				if (conditionalBlock[1]) {
					// there is an else statement
					if (!value) {
						template = template.replace(matches[i], conditionalBlock[1].replace(statement, '').replace(/(^[\s]*)|([\s]*$)/gi, ''));
					} else {
						template = template.replace(matches[i], conditionalBlock[0].replace(statement, '').replace(/(^[\s]*)|([\s]*$)/gi, ''));
					}
				} else {
					// regular if statement
					if (!value) {
						template = template.replace(matches[i], '');
					} else {
						template = template.replace(matches[i], matches[i].replace(statement, '').replace(/(^[\s]*)|([\s]*$)/gi, ''));
					}
				}
			}
		}

		return template;
	}

	function callMethod(method, parameters) {
		return method.apply(templates, [parameters.data, parameters.iterator, parameters.numblocks]);
	}

	function parseFunctions(block, result, parameters) {
		var functions = block.match(/{function.*?}/gi, '');
		for (var fn in functions) {
			if (functions.hasOwnProperty(fn)) {
				var func = functions[fn],
					method = functions[fn].split('.').pop().split('}').shift();

				if (templates.helpers[method]) {
					result = result.replace(new RegExp(func, 'gi'), callMethod(templates.helpers[method], parameters));
				}
			}
		}

		return result;
	}

	function parseArray(template, array, key, namespace) {
		template = checkConditional(template, namespace + 'length', array[key].length);
		template = checkConditional(template, '!' + namespace + 'length', !array[key].length);

		var regex = makeRegex(key),
			block = getBlock(template, regex, namespace.substring(0, namespace.length - 1));

		if (typeof block === "undefined") {
			return template;
		}

		var numblocks = array[key].length - 1,
			iterator = 0,
			result = "";

		do {
			result += parse(block, array[key][iterator], namespace, {iterator: iterator, total: numblocks}) + ((iterator < numblocks) ? '\r\n':'');
			result = parseFunctions(block, result, {
				data: array[key][iterator],
				iterator: iterator,
				numbloks: numblocks
			});
		} while (iterator++ < numblocks);

		return setBlock(regex, result, template);
	}

	function parseValue(template, key, value, blockInfo) {
		value = typeof value === 'string' ? value.replace(/^\s+|\s+$/g, '') : value;

		template = checkConditional(template, key, value);
		template = checkConditional(template, '!' + key, !value);

		if (blockInfo) {
			template = checkConditional(template, '@first', blockInfo.iterator === 0);
			template = checkConditional(template, '!@first', blockInfo.iterator !== 0);
			template = checkConditional(template, '@last', blockInfo.iterator === blockInfo.total);
			template = checkConditional(template, '!@last', blockInfo.iterator !== blockInfo.total);
		}

		return replace(template, key, value);
	}

	function parse(template, data, namespace, blockInfo) {
		if (!data || data.length === 0) {
			template = '';
		}

		namespace = namespace || '';

		for (var d in data) {
			if (data.hasOwnProperty(d)) {
				if (typeof data[d] === 'undefined') {
					continue;
				} else if (data[d] === null) {
					template = replace(template, namespace + d, '');
				} else if (data[d].constructor === Array) {
					template = parseArray(template, data, d, namespace + d + '.');
				} else if (data[d] instanceof Object) {
					template = parse(template, data[d], namespace + d + '.');
				} else {
					template = parseValue(template, namespace + d, data[d], blockInfo);
				}
			}
		}

		if (namespace) {
			template = template.replace(new RegExp("{" + namespace + "[\\s\\S]*?}", 'g'), '');
			namespace = '';
		} else {
			// clean up all undefined conditionals
			template = template.replace(/\s*<!-- ELSE -->\s*/gi, 'ENDIF -->\r\n')
								.replace(/\s*<!-- IF([^@]*?)ENDIF([^@]*?)-->/gi, '')
								.replace(/\s*<!-- ENDIF ([^@]*?)-->\s*/gi, '');
		}

		return template;
	}

	module.exports = templates;
	module.exports.__express = module.exports.render;

	if ('undefined' !== typeof window) {
		window.templates = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);