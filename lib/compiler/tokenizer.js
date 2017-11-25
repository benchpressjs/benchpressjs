'use strict';

const { tokens, first } = require('./tokens');

const { Text } = tokens;

/**
 * Generate an array of tokens describing the template
 * @param {string} input
 * @return {Token[]}
 */
function tokenizer(input) {
  const topLevelTokens = Object.keys(tokens)
    .map(key => tokens[key])
    .filter(token => token.priority > 0)
    .sort((a, b) => a.priority - b.priority);

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

  // if there are more closes than opens
  // intelligently remove extra ones
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

module.exports = tokenizer;
