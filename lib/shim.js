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

	return Shim;
});
