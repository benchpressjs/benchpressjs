'use strict';

class Token {
	constructor() {
		this.tokenType = this.constructor.name;
	}
}

class Text extends Token {
	constructor(value) {
		super();
		this.value = value;
	}
}

class StringLiteral extends Token {
	constructor(value) {
		super();
		this.value = value;
	}
}

class Expression extends Token {
	constructor(value) {
		super();

		return Expression.create(value);
	}
}

class SimpleExpression extends Token {
	constructor(path) {
		super();
		Object.assign(this, { path });
	}

	static pattern = '[@a-zA-Z0-9/._:\\-]+';
}

class HelperExpression extends Token {
	constructor(raw, helperName, args) {
		super();
		const arr = args.split(/\s*,\s*/).map((arg) => {
			const stringPattern = /^"(.*)"$/;
			const matches = arg.match(stringPattern);

			if (matches) {
				return new StringLiteral(matches[1]);
			}

			return new Expression(arg);
		});
		Object.assign(this, { raw, helperName, args: arr });
	}

	static pattern = `function\\.(${SimpleExpression.pattern})(?:\\s*,\\s*)?`
		+ '([@a-zA-Z0-9/._: ,\\-"]+[@a-zA-Z0-9/_:\\-"]*)';
}

Expression.pattern = `(${HelperExpression.pattern})|(${SimpleExpression.pattern})`;
Expression.create = (value) => {
	if (RegExp(`^(?:${HelperExpression.pattern})$`).test(value)) {
		return new HelperExpression(...value.match(HelperExpression.pattern));
	}
	if (RegExp(`^(?:${SimpleExpression.pattern})$`).test(value)) {
		return new SimpleExpression(...value.match(SimpleExpression.pattern));
	}

	throw new TypeError('Invalid arguments');
};

class OpenIf extends Token {
	constructor(raw, not, test) {
		super();
		Object.assign(this, { raw, not: !!not, test: new Expression(test) });
	}

	static patterns = [
		`<!-- IF (!?)(${Expression.pattern}) -->`,
		`{{{ ?if (!?)(${Expression.pattern}) ?}}}`,
	];
}

class OpenIter extends Token {
	constructor(raw, subject) {
		super();
		Object.assign(this, {
			raw,
			subject: new SimpleExpression(subject),
			name: subject.replace(/^[./]*/, ''),
			cleanName: subject.replace(/^[./]*/, '').replace(/(^[^a-zA-Z_])|[^a-zA-Z0-9_]/g, '_'),
		});
	}

	static patterns = [
		`<!-- BEGIN (${SimpleExpression.pattern}) -->`,
		`{{{ ?each (${SimpleExpression.pattern}) ?}}}`,
	];
}

class Else extends Token {
	static patterns = [
		'<!-- ELSE -->',
		'{{{ ?else ?}}}',
	];
}

class Close extends Token {
	constructor(raw) {
		super();
		Object.assign(this, { raw });
	}

	static patterns = [
		'<!-- END(.*?) -->',
		'{{{ ?end ?}}}',
	];
}

class RawMustache extends Token {
	constructor(raw, expression) {
		super();
		Object.assign(this, { raw, expression: new Expression(expression) });
	}

	static pattern = `\\{\\{(${Expression.pattern})\\}\\}`;
}

class EscapedMustache extends Token {
	constructor(raw, expression) {
		super();
		Object.assign(this, { raw, expression: new Expression(expression) });
	}

	static pattern = `\\{(${Expression.pattern})\\}`;
}

const tokens = {
	Token,
	Text,
	StringLiteral,
	Expression,
	SimpleExpression,
	HelperExpression,
	OpenIf,
	OpenIter,
	Else,
	Close,
	RawMustache,
	EscapedMustache,
};

const topLevelTokens = [
	OpenIf,
	OpenIter,
	Else,
	Close,
	RawMustache,
	EscapedMustache,
];

/**
 * Get the first truthy value returned by a mapper function
 * @param {any[]} arr
 * @param {function} fn
 */
function first(arr, fn) {
	const l = arr.length;
	for (let i = 0; i < l; i += 1) {
		const res = fn(arr[i], i);
		if (res) {
			return res;
		}
	}

	return null;
}

/**
 * Generate an array of tokens describing the template
 * @param {string} input
 * @return {Token[]}
 */
function tokenizer(input) {
	const length = input.length;

	const output = [];

	let cursor = 0;
	let lastBreak = 0;

	while (cursor < length) {
		const slice = input.slice(cursor);
		const found = first(topLevelTokens, (Tok) => {
			let matches;
			if (Tok.patterns) {
				matches = first(Tok.patterns, pattern => slice.match(`^(?:${pattern})`));
			} else {
				matches = slice.match(`^(?:${Tok.pattern})`);
			}
			return matches && [Tok, matches];
		});

		if (found && input[cursor - 1] === '\\') {
			const text = input.slice(lastBreak, cursor - 1);
			if (text) {
				output.push(new Text(text));
			}

			const escapedText = found[1][0];
			output.push(new Text(escapedText));

			cursor += escapedText.length;
			lastBreak = cursor;
		} else if (found) {
			const [Tok, matches] = found;

			const text = input.slice(lastBreak, cursor);
			if (text) {
				output.push(new Text(text));
			}
			output.push(new Tok(...matches));

			cursor += matches[0].length;
			lastBreak = cursor;
		} else {
			cursor += 1;
		}
	}
	const text = input.slice(lastBreak, cursor);
	if (text) {
		output.push(new Text(text));
	}

	const opens = [];
	const closes = [];
	output.forEach((token) => {
		if (token.tokenType.startsWith('Open')) {
			opens.push(token);
		} else if (token.tokenType === 'Close') {
			closes.push(token);
		}
	});

	if (closes.length > opens.length) {
		const remove = new Set();
		const closeSubject = /^<!-- END[^ ]* !?(.*) -->$/;

		const expectedSubjects = [];
		// try to find a Close with no corresponding Open
		output.forEach((token, index) => {
			if (token.tokenType.startsWith('Open')) {
				expectedSubjects.push(
					(token.subject && token.subject.path) ||
					(token.test && (token.test.raw || token.test.path))
				);
			} else if (token.tokenType === 'Close') {
				const expectedSubject = expectedSubjects[expectedSubjects.length - 1];
				expectedSubjects.pop();

				if (!expectedSubject) {
					remove.add(token);
				} else {
					const matches = token.raw.match(closeSubject);
					if (matches && matches[1] !== expectedSubject) {
						remove.add(token);
					} else {
						// search for a close within close proximity
						// that has the expected subject
						for (let i = index + 1; i < output.length; i += 1) {
							const tok = output[i];
							if (tok.tokenType.startsWith('Open')) {
								break;
							}
							if (tok.tokenType === 'Close') {
								const m = tok.raw.match(closeSubject);
								if (m && m[1] === expectedSubject) {
									// found one ahead, so remove the current one
									remove.add(token);
									break;
								}
							}
						}
					}
				}
			}
		});

		return output.filter(token => !remove.has(token));
	}

	return output;
}

tokenizer.tokens = tokens;
tokenizer.topLevelTokens = topLevelTokens;

module.exports = tokenizer;
