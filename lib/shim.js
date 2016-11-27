'use strict';

/* eslint global-require: off, import/no-dynamic-require: off, no-use-before-define: off */

const Shim = {};

// Shim the tjs helpers to work with handlebars
Shim.helpers = {};

Shim.registerHelper = function registerHelper(name, fn) {
	Handlebars.registerHelper(`function__${name}`, (...args) => {
		args.pop();

		return new Handlebars.SafeString(fn.apply(this, args));
	});

	Shim.helpers[name] = fn;
};

Handlebars.registerHelper('if__function', (method, ...args) => {
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

function addGlobals(data) {
	return Object.assign({}, Shim.globals, data);
}

Shim.flush = function flush() {
	Shim.cache = {};
};

/* build:SERVER-ONLY:open */

// const fs = require('fs');
const uglifyjs = require('uglify-js');
const Handlebars = require('handlebars');
const transpile = require('./transpile');

// expose precompilation abilities
Shim.precompile = function precompile(name, source, minify) {
	const transpiled = transpile(source);
	const compiled = Handlebars.precompile(transpiled);
	const wrapped = `(function (thing) {
		if (typeof module === 'object' && module.exports) {
			module.exports = module.parent.require('handlebars').template(thing);
		} else if (typeof define === 'function' && define.amd) {
			define(['handlebars.runtime'], function (Handlebars) {
				window.templates.cache['${name}'] = Handlebars.template(thing);
			});
		}
	})(${compiled});`;

	if (minify) {
		const minified = uglifyjs.minify(wrapped, {
			fromString: true,
		}).code;
		return minified;
	}
	return wrapped;
};

// shim for the tjs express engine
Shim.__express = function __express(filename, data, next) {
	const name = filename
		.replace(`${data.settings.views}/`, '')
		.replace(`${data.settings.views}\\`, '')
		.replace(/\.jst$/, '');

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

/* build:SERVER-ONLY:close */

module.exports = Shim;
