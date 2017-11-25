'use strict';

const _ = require('lodash');

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
exports.first = first;

/**
 * Split on commas, but ignore commas inside strings
 * @param {string} str
 */
function splitArgs(str) {
  const out = [];

  let inString = false;
  let currentArg = '';

  for (let index = 0; index < str.length; index += 1) {
    const c = str[index];
    if (c === ',' && !inString) {
      out.push(currentArg.trim());
      currentArg = '';
    } else if (currentArg.length === 0 && c === '"' && !inString) {
      currentArg += c;
      inString = true;
    } else if (inString && c === '"' && str[index - 1] !== '\\') {
      currentArg += c;
      inString = false;
    } else if (!(c === ' ' && currentArg.length === 0)) {
      currentArg += c;
    }
  }
  out.push(currentArg.trim());

  return out;
}
exports.splitArgs = splitArgs;

class Token {
  constructor() {
    this.tokenType = this.constructor.name;
  }

  static priority = 0;
}

class Text extends Token {
  constructor(value) {
    super();
    this.value = value;
  }
}

class Expression extends Token {
  constructor(value) {
    super();

    const found = first(Expression.extensions, (Ext) => {
      let matches;
      if (Ext.patterns) {
        matches = first(Ext.patterns, pattern => value.match(`^(?:${pattern})$`));
      } else {
        matches = value.match(`^(?:${Ext.pattern})$`);
      }
      return matches && [Ext, matches];
    });

    if (!found) {
      throw TypeError('Invalid arguments');
    }

    const [Extension, matches] = found;
    return new Extension(...matches);
  }

  static extensions = [];
  static get pattern() {
    return _.flatMap(Expression.extensions, Ext => Ext.patterns || Ext.pattern)
      .map(pattern => `(?:${pattern})`)
      .join('|');
  }
}

const unescapeMap = {
  '\\b': '\b',
  '\\t': '\t',
  '\\n': '\n',
  '\\v': '\v',
  '\\f': '\f',
  '\\r': '\r',
  '\\"': '"',
  '\\\'': '\'',
  '\\\\': '\\',
};

class StringLiteral extends Token {
  constructor(raw, rawValue) {
    super();

    const value = rawValue.replace(/\\(.)/g, (str, c) => unescapeMap[str] || c);
    Object.assign(this, { raw, rawValue, value });
  }

  static pattern = '"((?:\\\\.|[^"\\n])*)"';
}

Expression.extensions.push(StringLiteral);

class SimpleExpression extends Token {
  constructor(path) {
    super();
    Object.assign(this, { path });
  }

  static pattern = '[@a-zA-Z0-9/._:\\-]+';
}

Expression.extensions.push(SimpleExpression);

const simpleOrString = `(?:${StringLiteral.pattern}|${SimpleExpression.pattern})`;

class HelperExpression extends Token {
  constructor(raw, helperName, args) {
    super();
    if (args) {
      const arr = splitArgs(args.replace(/^ *, */, '')).map(arg => new Expression(arg));
      Object.assign(this, { raw, helperName, args: arr });
    } else {
      Object.assign(this, { raw, helperName, args: [] });
    }
  }

  static patterns = [
    `function\\.(${SimpleExpression.pattern})((?: *, *${simpleOrString})*)`,
    `(${SimpleExpression.pattern})(?:\\( *(${simpleOrString}(?: *, *${simpleOrString})*)? *\\))`,
  ];
}

Expression.extensions.push(HelperExpression);

class OpenIf extends Token {
  constructor(raw, not, test) {
    super();
    Object.assign(this, { raw, not: !!not, test: new Expression(test) });
  }

  static patterns = [
    `<!-- IF (!?)(${Expression.pattern}) -->`,
    `{{{ ?if (!?)(${Expression.pattern}) ?}}}`,
  ];
  static priority = 60;
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
  static priority = 50;
}

class Else extends Token {
  static patterns = [
    '<!-- ELSE -->',
    '{{{ ?else ?}}}',
  ];
  static priority = 40;
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
  static priority = 30;
}

class RawMustache extends Token {
  constructor(raw, expression) {
    super();
    Object.assign(this, { raw, expression: new Expression(expression) });
  }

  static pattern = `\\{\\{(${Expression.pattern})\\}\\}`;
  static priority = 20;
}

class EscapedMustache extends Token {
  constructor(raw, expression) {
    super();
    Object.assign(this, { raw, expression: new Expression(expression) });
  }

  static pattern = `\\{(${Expression.pattern})\\}`;
  static priority = 10;
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

exports.tokens = tokens;
