'use strict';

const fs = require('fs');
const Handlebars = require('handlebars');
const transpile = require('./transpile');

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

// shim for the tjs express engine
Shim.__express = function express(filename, data, next) {
	const template = filename
		.replace(`${data.settings.views}/`, '')
		.replace(`${data.settings.views}\\`, '');

	data = addGlobals(data);
	data._locals = null;

	if (Shim.cache[template]) {
		next(null, Shim.cache[template](data));
		return;
	}

	fs.readFile(filename, (err, source) => {
		if (err) {
			next(err);
			return;
		}

		const transpiled = transpile(source.toString());
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

module.exports = Shim;
