"use strict";

(function(module) {
	var templates = {
		helpers: {},
		globals: {},
		cache: {}
	};

	templates.registerHelper = function(name, func) {
		templates.helpers[name] = func;
	};

	templates.parse = function(template, obj, bind) {
		obj = obj || {};

		bind = bind ? Math.random() : false;
		var parsed = parse(template, registerGlobals(obj), bind);
		if (bind) {
			obj.__template = template;
		}
		return bind ? '<span data-binding="' + bind + '">' + parsed + '</span>' : parsed;
	};

	templates.render = function(filename, options, fn) {
		var fs = require('fs'),
			tpl = filename.replace(options.settings.views + '/', '');

		if (!templates.cache[tpl]) {
			fs.readFile(filename, function(err, html) {
				templates.cache[tpl] = html.toString();
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

	function getBlock(template, block) {
		return template.replace(new RegExp("[\\s\\S]*<!--[\\s]*BEGIN " + block + "[\\s]*-->[\r\n]*([\\s\\S]*?)[\r\n]*<!--[\\s]*END " + block + "[\\s]*-->[\\s\\S]*", 'g'), '$1');
	}

	function registerGlobals(obj) {
		for (var g in templates.globals) {
			if (templates.globals.hasOwnProperty(g)) {
				obj[g] = obj[g] || templates.globals[g];
			}
		}

		return obj;
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

	function parseArray(template, array, key, namespace, bind) {
		template = checkConditional(template, namespace + 'length', array[key].length);
		template = checkConditional(template, '!' + namespace + 'length', !array[key].length);

		var regex = makeRegex(key),
			block = getBlock(template, namespace.substring(0, namespace.length - 1));

		if (typeof block === "undefined") {
			return template;
		}

		var numblocks = array[key].length - 1,
			iterator = 0,
			result = "",
			parsedBlock;

		do {
			parsedBlock = parse(block, array[key][iterator], bind, namespace, {iterator: iterator, total: numblocks}) + ((iterator < numblocks) ? '\r\n':'');
			
			result += (!bind) ? parsedBlock : '<span data-binding="' + bind + namespace + iterator + '">' + parsedBlock + '</span>';
			result = parseFunctions(block, result, {
				data: array[key][iterator],
				iterator: iterator,
				numblocks: numblocks // seems unnecessary
			});
			array[key][iterator].__template = block;
		} while (iterator++ < numblocks);

		return template.replace(regex, result);
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

	function setupBindings(parameters) {
		var obj = parameters.obj,
			key = parameters.key,
			namespace = parameters.namespace,
			blockInfo = parameters.blockInfo,
			bind = parameters.bind,
			template = parameters.template,
			value = obj[key];

		obj.__namespace = namespace;
		obj.__iterator = blockInfo ? blockInfo.iterator : false;

		Object.defineProperty(obj, key, {
			get: function() {
				return this['__' + key];
			},
			set: function(value) {
				this['__' + key] = value;

				var els = document.querySelectorAll('[data-binding="' + (this.__iterator !== false ? (bind + this.__namespace + this.__iterator) : bind) + '"]');
				
				for (var el in els) {
					if (els.hasOwnProperty(el)) {
						if (this.__parent) {
							var parent = this.__parent();
							els[el].innerHTML = parse(parent.template, parent.data, false);
						} else {
							els[el].innerHTML = parse(this.__template, obj, false, this.__namespace);	
						}
					}
				}
			}
		});

		obj[key] = value;
	}

	function defineParent(obj, parent) {
		obj.__parent = function() {
			return {
				data: parent,
				template: parent.__template
			};
		};
	}

	var originalObj;

	function parse(template, obj, bind, namespace, blockInfo) {
		if (!obj || obj.length === 0) {
			template = '';
		}

		namespace = namespace || '';
		originalObj = originalObj || obj;

		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (typeof obj[key] === 'undefined' || typeof obj[key] === 'function') {
					continue;
				} else if (obj[key] === null) {
					template = replace(template, namespace + key, '');
				} else if (obj[key].constructor === Array) {
					template = parseArray(template, obj, key, namespace + key + '.', bind);
				} else if (obj[key] instanceof Object) {
					defineParent(obj[key], originalObj);
					template = parse(template, obj[key], bind, namespace + key + '.');
				} else {
					template = parseValue(template, namespace + key, obj[key], blockInfo);
					
					if (bind && obj[key]) {
						setupBindings({
							obj: obj,
							key: key,
							namespace: namespace,
							blockInfo: blockInfo,
							bind: bind,
							template: template
						});
					}
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