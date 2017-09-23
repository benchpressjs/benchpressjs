'use strict';

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

class StringLiteral extends Token {
  constructor(value) {
    super();
    this.value = value;
  }
}

class Expression extends Token {
  constructor(value) {
    super();

    const Extension = Expression.extensions
      .find(ext => RegExp(`^(?:${ext.pattern})$`).test(value));

    if (!Extension) {
      throw TypeError('Invalid arguments');
    }

    return new Extension(...value.match(Extension.pattern));
  }

  static extensions = [];
  static get pattern() {
    return Expression.extensions
      .map(ext => `(?:${ext.pattern})`)
      .join('|');
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

Expression.extensions.push(HelperExpression, SimpleExpression);

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

module.exports = tokens;
