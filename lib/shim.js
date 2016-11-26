'use strict';

/* eslint-disable */

(function (factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('handlebars'), require('fs'), require('./transpile'));
	} else if (typeof define === 'function' && define.amd) {
		define('templates.js', ['handlebars'], factory);
	} else {
		window.templatesjs = factory(window.Handlebars);
	}
})(function (Handlebars, fs, transpile) {
	var Shim = {};
	var loader;

	// Shim the tjs helpers to work with handlebars
	Shim.helpers = {};

	Shim.registerHelper = function registerHelper(name, fn) {
		Handlebars.registerHelper('function__' + name, function () {
			var args = Array.prototype.slice.call(arguments);
			var options = args.pop();

			return new Handlebars.SafeString(fn.apply(this, args));
		});

		Shim.helpers[name] = fn;
	};

	Handlebars.registerHelper('if__function', function () {
		var args = Array.prototype.slice.call(arguments);
		var options = args.pop();
		var method = args.shift();

		if (typeof Shim.helpers[method] === 'function') {
			args.unshift(options.data.root);

			if (Shim.helpers[method].apply(this, args)) {
				return options.fn(this);
			}
		}
		return options.inverse(this);
	});

	Handlebars.registerHelper('esc', function (text, options) {
		const escapeKeys = /\{([\s\S]*?)\}/g;
		const escapeBlocks = /<!--([\s\S]*?)-->/g;

		if (!text && text !== 0) {
			return null;
		}

		const escaped = text.toString()
			.replace(escapeKeys, '&#123;$1&#125;')
			.replace(escapeBlocks, '&lt;!--$1--&gt;');
		return new Handlebars.SafeString(escaped);
	});

	Shim.cache = {};

	// shim for the tjs parse method
	Shim.registerLoader = function registerLoader(func) {
		loader = func;
	};

	Shim.parse = function parse(template, block, data, callback) {
		if (typeof block !== 'string') {
			callback = data;
			data = block;
			block = null;
		}

		if (!template) {
			return callback ? callback('') : '';
		}

		data = addGlobals(data);

		if (loader && callback) {
			if (Shim.cache[template]) {
				return callback(Shim.cache[template](data));
			}
			loader(template, function (source) {
				Shim.cache[template] = Handlebars.compile(transpile(source));

				callback(Shim.cache[template](data));
			});
		} else if (callback) {
			callback(Handlebars.compile(transpile(template))(data));
		} else {
			return Handlebars.compile(transpile(template))(data);
		}
	};

	// shim for tjs global fields
	Shim.globals = {};

	Shim.setGlobal = function(key, value) {
		Shim.globals[key] = value;
	};

	function addGlobals(data) {
		return (Object.assign || jQuery.extend)({}, Shim.globals, data);
	}

	// shim for the tjs express engine
	Shim.__express = function express(filename, data, next) {
		var template = filename
			.replace(data.settings.views + '/', '')
			.replace(data.settings.views + '\\', '');

		data = addGlobals(data);
		data._locals = null;

		if (Shim.cache[template]) {
			return next(null, Shim.cache[template](data));
		}

		fs.readFile(filename, function (err, source) {
			if (err) {
				return next(err);
			}
			var transpiled = transpile(source.toString());
			try {
				Shim.cache[template] = Handlebars.compile(transpiled);
				next(null, Shim.cache[template](data));
			} catch (e) {
				e.source = source.toString();
				e.transpiled = transpiled;
				next(e);
			}
		});
	};

	Shim.flush = function flush() {
		Shim.cache = {};
	};

	return Shim;
});
