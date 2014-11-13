'use strict';
/*global require, module, self*/

(function(module) {
	var templates = {
			cache: {}
		},
		helpers = {},
		globals = {},
		loader,
		worker;

	var regexes = {
		nestedConditionals: /(?!^)<!-- IF([\s\S]*?)ENDIF[ a-zA-Z0-9\._:]*-->(?!$)/gi,
		conditionalBlock: /[\r\n?\n]*?<!-- ELSE -->[\r\n?\n]*?/,
		conditionalHelper: /IF function.([\S]*)/gi,
		cleanup: [/\s*<!-- ELSE -->\s*/gi, /\s*<!-- IF([\s\S]*?)ENDIF([\s\S]*?)-->/gi, /\s*<!-- BEGIN([\s\S]*?)END ([\s\S]*?)-->/gi, /\s*<!-- ENDIF ([\s\S]*?)-->\s*/gi]
	};

	if (typeof self !== 'undefined' && self.addEventListener) {
		self.addEventListener('message', function(ev) {
			var data = ev.data;

			self.postMessage({
				result: !data.block ? templates.parse(data.template, data.object) : templates.parse(data.template, data.block, data.object),
				signature: data.signature
			});
		}, false);
	}

	var callbacks = {},
		signature = 0,
		MAX_SAFE_INT = Math.pow(2, 53) - 1;

	templates.setupWebWorker = function(pathToScript) {
		try {
			worker = new Worker(pathToScript);

			worker.addEventListener('message', function(e) {
				callbacks[e.data.signature](e.data.result);
			}, false);
		} catch (err) {};
	};

	function launchWorker(template, obj, block, callback) {
		signature++;
		if (signature > MAX_SAFE_INT) {
			signature = 0;
		}

		worker.postMessage({
			template: template,
			object: obj,
			block: block,
			signature: signature
		});

		callbacks[signature] = function(result) {
			callback(result);
			delete callbacks[signature];
		};
	}
	
	templates.parse = function(template, block, obj, callback) {
		if (typeof block !== 'string') {
			callback = obj;
			obj = block;
			block = false;
		}

		obj = registerGlobals(obj || {});

		if (loader && callback) {
			if (!templates.cache[template]) {
				loader(template, function(loaded) {
					templates.cache[template] = loaded;

					if (worker) {
						launchWorker(loaded, obj, block, callback);
					} else {
						callback(parseTemplate(loaded));
					}
				});	
			} else {
				if (worker) {
					launchWorker(templates.cache[template], obj, block, callback);
				} else {
					callback(parseTemplate(templates.cache[template]));
				}
			}
		} else if (callback) {
			if (worker) {
				launchWorker(template, obj, block, callback);
			} else {
				callback(parseTemplate(template));
			}
		} else {
			return parseTemplate(template);
		}

		function parseTemplate(template) {
			return parse(!block ? template : templates.getBlock(template, block), obj);
		}
	};

	templates.registerHelper = function(name, func) {
		helpers[name] = func;
	};

	templates.registerLoader = function(func) {
		loader = func;
	};

	templates.setGlobal = function(key, value) {
		globals[key] = value;
	};

	templates.getBlock = function(template, block) {
		return template.replace(new RegExp('[\\s\\S]*(<!--[\\s]*BEGIN ' + block + '[\\s]*-->[\\s\\S]*?<!--[\\s]*END ' + block + '[\\s]*-->)[\\s\\S]*', 'g'), '$1');
	};

	templates.flush = function() {
		templates.cache = {};
	};

	function express(filename, options, fn) {
		var fs = require('fs'),
			tpl = filename.replace(options.settings.views + '/', '');

		options._locals = null;

		if (!templates.cache[tpl]) {
			fs.readFile(filename, function(err, html) {
				templates.cache[tpl] = (html || '').toString();
				return fn(err, templates.parse(templates.cache[tpl], options));
			});
		} else {
			return fn(null, templates.parse(templates.cache[tpl], options));
		}
	}

	function replace(string, regex, value) {
		return string.replace(regex, value.toString().replace(/\$+/g, '$$$'));
	}

	function replaceValue(template, key, value) {
		var searchRegex = new RegExp('{' + key + '}', 'g');
		return replace(template, searchRegex, value);
	}

	function makeRegex(block) {
		return new RegExp('[\\t ]*<!--[\\s]*BEGIN ' + block + '[\\s]*-->[\\s\\S]*?<!--[\\s]*END ' + block + '[\\s]*-->');
	}

	function makeBlockRegex(block) {
		return new RegExp('([\\t ]*<!--[\\s]*BEGIN ' + block + '[\\s]*-->[\\r\\n?|\\n]?)|(<!--[\\s]*END ' + block + '[\\s]*-->)', 'g');
	}

	function makeConditionalRegex(block) {
		return new RegExp('<!--[\\s]*IF ' + block + '[\\s]*-->([\\s\\S]*?)<!--[\\s]*ENDIF ' + block + '[\\s]*-->', 'g');
	}

	function makeStatementRegex(key) {
		return new RegExp('(<!--[\\s]*IF ' + key + '[\\s]*-->)|(<!--[\\s]*ENDIF ' + key + '[\\s]*-->)', 'g');
	}

	function registerGlobals(obj) {
		for (var g in globals) {
			if (globals.hasOwnProperty(g)) {
				obj[g] = obj[g] || globals[g];
			}
		}

		return obj;
	}

	function checkConditional(template, key, value) {
		var matches = template.match(makeConditionalRegex(key));

		if (matches !== null) {
			for (var i = 0, ii = matches.length; i < ii; i++) {
				var statement = makeStatementRegex(key),
					nestedConditionals = matches[i].match(regexes.nestedConditionals),
					match = replace(matches[i].replace(statement, ''), /(?!^)<!-- IF([\s\S]*?)ENDIF[ a-zA-Z0-9\._:]*-->(?!$)/gi, '<!-- NESTED -->'),
					conditionalBlock = match.split(regexes.conditionalBlock);

				if (conditionalBlock[1]) {
					// there is an else statement
					if (!value) { // todo check second line break conditional, doesn't match.
						template = replace(template, matches[i], replace(conditionalBlock[1], /(^[\r\n?|\n]*)|([\r\n\t]*$)/gi, ''));
					} else {
						template = replace(template, matches[i], replace(conditionalBlock[0], /(^[\r\n?|\n]*)|([\r\n\t]*$)/gi, ''));
					}
				} else {
					// regular if statement
					if (!value) {
						template = replace(template, matches[i], '');
					} else {
						template = replace(template, matches[i], replace(match, /(^[\r\n?|\n]*)|([\r\n\t]*$)/gi, ''));
					}
				}

				if (nestedConditionals) {
					for (var x = 0, xx = nestedConditionals.length; x < xx; x++) {
						template = replace(template, '<!-- NESTED -->', nestedConditionals[x]);
					}
				}
			}
		}

		return template;
	}

	function checkConditionalHelper(template, obj) {
		var func = regexes.conditionalHelper.exec(template);

		if (func && helpers[func[1]]) {
			template = checkConditional(template, 'function.' + func[1], helpers[func[1]](obj));
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

				if (helpers[method]) {

					result = replace(result, new RegExp(func, 'gi'), callMethod(helpers[method], parameters));
				}
			}
		}

		return result;
	}

	function parseArray(template, array, key, namespace) {
		template = checkConditional(template, namespace + 'length', array[key].length);
		template = checkConditional(template, '!' + namespace + 'length', !array[key].length);

		var regex = makeRegex(key), block;

		if (!array[key].length) {
			return template.replace(regex, '');
		}

		while (block = template.match(regex)) {
			block = block[0].replace(makeBlockRegex(key), '');
			
			var numblocks = array[key].length - 1,
				iterator = 0,
				result = '';

			do {
				result += parse(block, array[key][iterator], namespace, {iterator: iterator, total: numblocks});
				result = checkConditional(result, '@first', iterator === 0);
				result = checkConditional(result, '!@first', iterator !== 0);
				result = checkConditional(result, '@last', iterator === numblocks);
				result = checkConditional(result, '!@last', iterator !== numblocks);

				result = result.replace(/^[\r\n?|\n|\t]*?|[\r\n?|\n|\t]*?$/g, '');

				result = parseFunctions(block, result, {
					data: array[key][iterator],
					iterator: iterator,
					numblocks: numblocks
				});
			} while (iterator++ < numblocks);

			template = replace(template, regex, result.replace(/^[\r\n?|\n]|[\r\n?|\n]$/g, ''));
		}
		
		return template;
	}

	function parseValue(template, key, value) {
		template = checkConditional(template, key, value);
		template = checkConditional(template, '!' + key, !value);

		return replaceValue(template, key, value);
	}

	function parse(template, obj, namespace) {
		namespace = namespace || '';
		template = checkConditionalHelper(template, obj);

		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (typeof obj[key] === 'undefined' || typeof obj[key] === 'function') {
					continue;
				} else if (obj[key] === null) {
					template = replaceValue(template, namespace + key, '');
				} else if (obj[key].constructor === Array) {
					template = parseArray(template, obj, key, namespace + key + '.');
				} else if (obj[key] instanceof Object) {
					template = checkConditional(template, key, obj[key]);
					template = checkConditional(template, '!' + key, !obj[key]);
					template = parse(template, obj[key], namespace + key + '.');
				} else {
					template = parseValue(template, namespace + key, obj[key]);
				}
			}
		}

		if (namespace) {
			template = template.replace(new RegExp('{' + namespace + '\\.[\\s\\S]*?}', 'g'), '');
			namespace = '';
		} else {
			template = template.replace(regexes.cleanup[0], 'ENDIF -->\r\n')
				.replace(regexes.cleanup[1], '')
				.replace(regexes.cleanup[2], '')
				.replace(regexes.cleanup[3], '');
		}

		return template;
	}

	module.exports = templates;
	module.exports.__express = express;

	if ('undefined' !== typeof window) {
		window.templates = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);