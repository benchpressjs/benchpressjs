'use strict';

const { tokens, matchPattern } = require('./tokens');

const { Text } = tokens;

function getTopLevelTokens() {
  return Object.keys(tokens)
    .map(key => tokens[key])
    .filter(token => token.priority > 0)
    .sort((a, b) => a.priority - b.priority);
}

function removeExtraCloses(input) {
  const remove = new Set();
  const closeSubject = /^<!-- END[^ ]* !?(.+) -->$/;

  let opens = 0;
  let closes = 0;

  const expectedSubjects = [];
  // try to find a Close with no corresponding Open
  input.forEach((token, index) => {
    if (token.tokenType.startsWith('Open')) {
      opens += 1;

      expectedSubjects.push(
        (token.subject && token.subject.path) ||
        (token.test && (token.test.raw || token.test.path))
      );
    } else if (token.tokenType === 'Close') {
      closes += 1;

      const expectedSubject = expectedSubjects.pop();

      if (!expectedSubject) {
        remove.add(token);
      } else {
        const matches = token.raw.match(closeSubject);
        if (matches && !expectedSubject.startsWith(matches[1])) {
          remove.add(token);
          expectedSubjects.push(expectedSubject);
        } else {
          // search for a close within close proximity
          // that has the expected subject
          for (let i = index + 1; i < input.length; i += 1) {
            const tok = input[i];
            if (tok.tokenType.startsWith('Open')) {
              break;
            }
            if (tok.tokenType === 'Close') {
              const m = tok.raw.match(closeSubject);
              if (m && m[1] === expectedSubject) {
                // found one ahead, so remove the current one
                remove.add(token);
                expectedSubjects.push(expectedSubject);
                break;
              }
            }
          }
        }
      }
    }
  });

  if (closes > opens) {
    let diff = closes - opens;

    /* eslint-disable no-console */
    console.warn('Found extra token(s):');

    const output = input.map((token) => {
      if (remove.has(token) && diff > 0) {
        console.warn(token.raw);

        diff -= 1;
        return new Text(token.raw);
      }

      return token;
    });

    console.warn('These tokens will be passed through as text, but you should remove them to prevent issues in the future.');
    /* eslint-enable no-console */

    return output;
  }

  return input;
}

/**
 * Generate an array of tokens describing the template
 * @param {string} input
 * @return {Token[]}
 */
function tokenizer(input) {
  const topLevelTokens = getTopLevelTokens();

  const length = input.length;

  const output = [];

  let cursor = 0;
  let lastBreak = 0;

  while (cursor < length) {
    const slice = input.slice(cursor);
    const found = matchPattern(topLevelTokens, slice, false);

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

  // if there are more closes than opens
  // intelligently remove extra ones
  return removeExtraCloses(output);
}

module.exports = tokenizer;
