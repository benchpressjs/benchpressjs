'use strict';

const { Close } = require('./tokens').tokens;
const paths = require('./paths');

/**
 * Resolve all expression paths relative to the loop
 * @param {string} basePath
 * @param {object} expression
 */
function expressionPaths(basePath, expression) {
  const expr = Object.assign({}, expression);
  if (expr.tokenType === 'SimpleExpression') {
    if (expr.path === '@value') {
      expr.path = basePath;
    } else {
      expr.path = paths.resolve(basePath, expr.path);
    }
  } else if (expr.tokenType === 'HelperExpression') {
    expr.args = expr.args.map((arg) => {
      if (arg.tokenType === 'StringLiteral') {
        return arg;
      }

      return expressionPaths(basePath, arg);
    });
  }

  return expr;
}

const subroutines = {
  OpenIf(token, rest, basePath, iterSuffix) {
    const [blockBody, tokensHandled] = parse(rest, basePath, iterSuffix);

    const test = expressionPaths(basePath, token.test);
    return [Object.assign({}, token, { test, body: blockBody }), tokensHandled];
  },
  OpenIter(token, rest, basePath, iterSuffix) {
    const path = paths.resolve(basePath, token.subject.path);
    const [blockBody, tokensHandled] = parse(rest, `${path}[${iterSuffix}]`, iterSuffix + 1);

    const subject = Object.assign({}, token.subject, { path });
    return [
      Object.assign({}, token, {
        body: blockBody,
        subject,
        iterSuffix,
      }),
      tokensHandled,
    ];
  },
  Else(token, rest, basePath, iterSuffix) {
    const [blockBody, tokensHandled] = parse(rest, basePath, iterSuffix);
    return [Object.assign({}, token, { body: blockBody }), tokensHandled];
  },
  RawMustache(token, rest, basePath) {
    const expression = expressionPaths(basePath, token.expression);
    return [Object.assign({}, token, { expression }), 1];
  },
  EscapedMustache(...args) {
    return subroutines.RawMustache(...args);
  },
  Text(token) {
    return [token, 1];
  },
  Close() {
    return [null, 1, true];
  },
};

/**
 * Parse an array of tokens into a syntax tree
 * @param {object[]} tokens
 * @param {string} basePath
 * @param {number} iterSuffix
 * @returns {[object[], number]}
 */
function parse(tokens, basePath, iterSuffix) {
  const len = tokens.length;
  const body = [];

  let i = 0;
  while (i < len) {
    const token = tokens[i];
    if (subroutines[token.tokenType]) {
      const rest = tokens.slice(i + 1);
      const [
        branches,
        tokensHandled,
        shouldBreak,
      ] = subroutines[token.tokenType](token, rest, basePath, iterSuffix);

      if (Array.isArray(branches)) {
        body.push(...branches);
      } else if (branches) {
        body.push(branches);
      }

      i += tokensHandled;

      if (shouldBreak) {
        break;
      }
    } else {
      i += 1;
    }
  }

  return [body, i + 1];
}

/**
 * Parse an array of tokens into a syntax tree
 * @param {object[]} tokens
 * @returns {object}
 */
function parser(tokens) {
  // add Close token before each Else
  const toks = tokens.reduce((prev, tok) => {
    if (tok.tokenType === 'Else') {
      return [...prev, new Close(), tok];
    }

    return [...prev, tok];
  }, []);

  const [body] = parse(toks, '', 1);
  return body;
}

parser.subroutines = subroutines;

module.exports = parser;
