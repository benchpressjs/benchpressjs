'use strict';

const { fork } = require('child_process');
const { cpus } = require('os');
const transpile = require('./transpile');

if (process.env.transpiler_worker) {
	process.on('message', ([m, input]) => {
		if (m === 'transpile') {
			transpile(input, (err, output) => {
				if (err) {
					throw err;
				}

				process.send(['transpile.output', output]);
			});
		}
	});

	return;
}

const noop = () => null;

const filepath = `${__dirname}/index.js`;
const threads = [];
const threadOps = [];
const max = cpus().length;
let n = 0;

function threadedTranspile(input, callback) {
	function go(child) {
		let off;

		const onmessage = ([m, output]) => {
			if (m === 'transpile.output') {
				callback(null, output);
				off();
			}
		};
		child.on('message', onmessage);

		const onerror = err => {
			callback(err);
			off();
		};

		off = () => {
			callback = noop;
			child.removeListener('error', onerror);
			child.removeListener('message', onmessage);
		};

		child.on('error', onerror);
		child.send(['transpile', input]);
	}

	if (n >= max) {
		go(threads[Math.floor(Math.random() * n)]);
		return;
	}

	const child = fork(filepath, {
		env: {
			transpiler_worker: true,
		},
	});

	child.setMaxListeners(200);

	child.on('exit', () => {
		const index = threads.indexOf(child);
		threads.splice(index, 1);
		threadOps.slice(index, 1);
		n -= 1;
	});

	n += 1;
	threads.push(child);
	threadOps.push(1);

	go(child);
}

module.exports = threadedTranspile;
