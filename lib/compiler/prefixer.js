'use strict';

const fixIter = input => input.replace(
  /<!-- BEGIN ([^./][@a-zA-Z0-9/.\-_:]+?) -->([\s\S]*?)<!-- END \1 -->/g,
  (str, one, two) => {
    const t = fixIter(two);
    return `<!-- IF ../${one} --><!-- BEGIN ../${one} -->${t}<!-- END ../${one} --><!-- ELSE --><!-- BEGIN ${one} -->${t}<!-- END ${one} --><!-- ENDIF ../${one} -->`;
  }
);

const transforms = [
  // add value context for in-loop helpers
  input => input.replace(/\{function\.([^}\n ,]+)\}/g, '{function.$1, @value}'),
  // `<!-- BEGIN stuff -->` => `<!-- BEGIN ../stuff -->` and `<!-- BEGIN stuff -->`
  // we need to add the fallback by duplicating under a different key
  // only apply to nested blocks
  input => input.replace(
    /<!-- BEGIN ([^./][@a-zA-Z0-9/.\-_:]+?) -->([\s\S]*?)<!-- END \1 -->/g,
    (str, one, two) => {
      const t = fixIter(two);
      return `<!-- BEGIN ${one} -->${t}<!-- END ${one} -->`;
    }
  ),
  // wrap `@key`, `@value`, `@index` in mustaches
  // if they aren't in a mustache already
  input => input.replace(
    /(\{{1,2}[^}]+\}{1,2})|(<!--[^>]+-->)|(@key|@value|@index)/g,
    (str, mustache, block, lone) => {
      if (lone) {
        return `{${lone}}`;
      }

      return str;
    }
  ),
  // add root data to if helpers
  input => input.replace(
    /<!-- IF (?:function\.([@a-zA-Z0-9/._:]+)(?:\s*,\s*)?(.*?)) -->/g,
    (raw, helperName, argStr) => `<!-- IF function.${helperName}, @root${argStr ? `, ${argStr}` : ''} -->`
  ),
];

/**
 * Apply text-based fixes for backward compatibility
 * @param {string} input
 * @returns {string}
 */
function prefixer(input) {
  return transforms.reduce((prev, transform) => transform(prev), input);
}

prefixer.transforms = transforms;

module.exports = prefixer;
