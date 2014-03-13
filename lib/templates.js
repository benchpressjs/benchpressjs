"use strict";

var templates = {
	blocks: {},
	helpers: {},
	globals: {}
};

(function() {
	templates.registerHelper = function(name, func) {
		templates.helpers[name] = func;
	};

	templates.parse = function (data, template) {
		function replace(key, value, template) {
			var searchRegex = new RegExp('{' + key + '}', 'g');
			return template.replace(searchRegex, value);
		}

		function makeRegex(block) {
			return new RegExp("<!--[\\s]*BEGIN " + block + "[\\s]*-->[\\s\\S]*<!--[\\s]*END " + block + "[\\s]*-->", 'g');
		}

		function makeConditionalRegex(block) {
			return new RegExp("<!--[\\s]*IF " + block + "[\\s]*-->([\\s\\S]*?)<!--[\\s]*ENDIF " + block + "[\\s]*-->", 'g');
		}

		function getBlock(regex, block, template) {
			data = template.match(regex);
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

		// registering globals
		for (var g in templates.globals) {
			if (templates.globals.hasOwnProperty(g)) {
				data[g] = data[g] || templates.globals[g];
			}
		}

		return (function parse(data, namespace, template, blockInfo) {
			if (!data || data.length === 0) {
				template = '';
			}

			function checkConditional(template, key, value) {
				var conditional = makeConditionalRegex(key),
					matches = template.match(conditional);

				if (matches !== null) {
					for (var i = 0, ii = matches.length; i < ii; i++) {
						var conditionalBlock = matches[i].split(/\s*<!-- ELSE -->\s*/),
							statement = new RegExp("([\\s]*<!--[\\s]*IF " + key + "[\\s]*-->[\\s]*)|([\\s]*<!--[\\s]*ENDIF " + key + "[\\s]*-->[\\s]*)", 'gi');

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

			function parseFunctions(block, result, data, i, numblocks) {
				var functions = block.match(/{function.*?}/gi, '');
				for (var fn in functions) {
					if (functions.hasOwnProperty(fn)) {
						var func = functions[fn],
							method = functions[fn].split('.').pop().split('}').shift();

						if (templates.helpers[method]) {
							result = result.replace(new RegExp(func, 'gi'), templates.helpers[method].apply(this, [data[i], i, numblocks]));
						}
					}
				}

				return result;
			}

			function parseArray(template, data, d, namespace) {
				template = checkConditional(template, namespace + 'length', data[d].length);
				template = checkConditional(template, '!' + namespace + 'length', !data[d].length);

				var regex = makeRegex(d),
					block = getBlock(regex, namespace.substring(0, namespace.length - 1), template);

				if (typeof block === "undefined") {
					return template;
				}

				var numblocks = data[d].length - 1,
					i = 0,
					result = "";

				do {
					result += parse(data[d][i], namespace, block, {iterator: i, total: numblocks}) + ((i < numblocks) ? '\r\n':'');
					result = parseFunctions(block, result, data[d], i, numblocks);
				} while (i++ < numblocks);

				return setBlock(regex, result, template);
			}

			function parseValue(template, data, d, namespace) {
				var key = namespace + d,
					value = typeof data[d] === 'string' ? data[d].replace(/^\s+|\s+$/g, '') : data[d];

				template = checkConditional(template, key, value);
				template = checkConditional(template, '!' + key, !value);

				if (blockInfo) {
					template = checkConditional(template, '@first', blockInfo.iterator === 0);
					template = checkConditional(template, '!@first', blockInfo.iterator !== 0);
					template = checkConditional(template, '@last', blockInfo.iterator === blockInfo.total);
					template = checkConditional(template, '!@last', blockInfo.iterator !== blockInfo.total);
				}

				return replace(key, value, template);
			}

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					if (typeof data[d] === 'undefined') {
						continue;
					} else if (data[d] === null) {
						template = replace(namespace + d, '', template);
					} else if (data[d].constructor === Array) {
						template = parseArray(template, data, d, namespace + d + '.');
					} else if (data[d] instanceof Object) {
						template = parse(data[d], namespace + d + '.', template);
					} else {
						template = parseValue(template, data, d, namespace);
					}
				}
			}

			if (namespace) {
				template = template.replace(new RegExp("{" + namespace + "[\\s\\S]*?}", 'g'), '');
				namespace = '';
			} else {
				// clean up all undefined conditionals
				template = template.replace(/\s*<!-- ELSE -->/gi, 'ENDIF -->')
									.replace(/\s*<!-- IF([^@]*?)ENDIF([^@]*?)-->/gi, '')
									.replace(/\s*<!-- ENDIF ([^@]*?)-->\s*/gi, '');
			}

			return template;

		})(data, "", template);
	};
}());