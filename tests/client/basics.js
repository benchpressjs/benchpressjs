"use strict";
/*global templates, json*/

templates.registerHelper('canspeak', function(data/*, iterator, numblocks*/) {
	return (data.isHuman && data.name === "Human") ? "Can speak" : "Cannot speak";
});

function start() {
	document.getElementById('reset').reset();

	var tests = document.getElementsByClassName('unit');

	for (var t in tests) {
		if (tests.hasOwnProperty(t)) {
			var test = tests[t],
				template = (test.querySelector('.template').value).toString(),
				expectEl = test.querySelector('.expect');

			test.querySelector('.rendered').innerHTML = test.querySelector('.result').value = templates.parse(template, json, true);

			if (test.querySelector('.result').value === expectEl.value) {
				expectEl.style.border = "2px solid green";
			} else {
				expectEl.style.border = "2px solid red";
			}
		}
	}
}

window.onload = start;