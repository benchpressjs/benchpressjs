'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function prepare(sourceDir, expectedDir) {
	const [sourceArr, expectedArr] = [sourceDir, expectedDir]
		.map(dir => fs.readdirSync(dir).map(file => [
			file.replace(/(\.tpl|\.html|\.hbs)$/, ''),
			fs.readFileSync(path.join(dir, file), 'utf-8'),
		]));

	const expected = expectedArr.reduce((prev, [key, text]) => {
		prev[key] = text;
		return prev;
	}, {});

	const missing = [];

	const source = sourceArr.reduce((prev, [key, text]) => {
		if (expected[key] == null) {
			missing.push(key);
			return prev;
		}

		prev[key] = text;
		return prev;
	}, {});

	return [source, expected, missing];
};
