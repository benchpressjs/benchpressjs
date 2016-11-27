'use strict';

/* eslint global-require: off, import/no-dynamic-require: off, no-use-before-define: off */
/* global config */

const Shim = {};

/* build:SERVER-ONLY:open */

// const fs = require('fs');
const uglifyjs = require('uglify-js');
const Handlebars = require('handlebars');
const transpile = require('./transpile');

// expose precompilation abilities
Shim.precompile = function precompile({ name, source, minify }, callback) {
	transpile(source, (err, transpiled) => {
		if (err) {
			callback(err);
			return;
		}

		const compiled = Handlebars.precompile(transpiled);
		
		const wrapped = `(function (thing) {
		if (typeof module === 'object' && module.exports) {
		module.exports = module.parent.require('handlebars').template(thing);
			} else if (typeof define === 'function' && define.amd) {
				define(['templates', 'handlebars.runtime'], function (Templates, Handlebars) {
					return Templates.cache['${name}'] = Handlebars.template(thing);
				});
			}
		})(${compiled});`;

		if (!minify) {
			callback(null, wrapped);
			return;
		}
		const minified = uglifyjs.minify(wrapped, {
			fromString: true,
		}).code;
		callback(null, minified);
	});
};

// shim for the tjs express engine
Shim.__express = function __express(filename, data, next) {
	const name = filename
		.replace(`${data.settings.views}/`, '')
		.replace(`${data.settings.views}\\`, '');

	data = addGlobals(data);
	data._locals = null;

	try {
		if (Shim.cache[name]) {
			next(null, Shim.cache[name](data));
		} else {
			// TODO: maybe this instead at some point
			// but the slow sync require only happens once
			// so not that big of a deal
			/*
			fs.readFile(filename, 'utf-8', (err, file) => {
				if (err) {
					next(err);
					return;
				}

				const compiled = new Function('module', file.toString());
				const m = {
					exports: {},
					parent: module,
				};
				compiled(m);
				const template = Shim.cache[name] = m.exports;
				next(null, template(data));
			});
			*/

			const template = Shim.cache[name] = require(filename);
			next(null, template(data));
		}
	} catch (e) {
		next(e);
	}
};

module.exports = Shim;

/* build:SERVER-ONLY:close */

// Shim the tjs helpers to work with handlebars
Shim.helpers = {};

Shim.registerHelper = function registerHelper(name, fn) {
	Handlebars.registerHelper(`function__${name}`, function delegate(...args) {
		args.pop();

		return new Handlebars.SafeString(fn.apply(this, args));
	});

	Shim.helpers[name] = fn;
};

Handlebars.registerHelper('if__function', function delegateConditional(method, ...args) {
	const options = args.pop();

	if (typeof Shim.helpers[method] === 'function') {
		args.unshift(options.data.root);

		if (Shim.helpers[method].apply(this, args)) {
			return options.fn(this);
		}
	}
	return options.inverse(this);
});

Handlebars.registerHelper('esc', text => {
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

// shim for tjs global fields
Shim.globals = {};

Shim.setGlobal = function setGlobal(key, value) {
	Shim.globals[key] = value;
};

const assign = Object.assign || jQuery.extend; // eslint-disable-line

function addGlobals(data) {
	return assign({}, Shim.globals, data);
}

Shim.flush = function flush() {
	Shim.cache = {};
};

// shim the tjs parse method incompletely
Shim.parse = function parse(template, data, callback) {
	if (!template) {
		callback('');
		return;
	}

	data = addGlobals(data);

	if (Shim.cache[template]) {
		callback(Shim.cache[template](data));
	} else {
		Shim.loader(template, (loaded) => callback(loaded(data)));
	}
};

Shim.registerLoader = function registerLoader(loader) {
	Shim.loader = loader;
};
