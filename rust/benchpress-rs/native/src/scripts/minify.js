/* global esmangle escodegen */

'use strict';

/* eslint-disable no-unused-vars, no-unused-expressions, semi */
((source) => {
  const tree = Reflect.parse(source, {
    loc: false,
  });

  const optimized = esmangle.optimize(tree, null, { destructive: true });
  const mangled = esmangle.mangle(optimized, { destructive: true });

  return escodegen.generate(mangled, {
    format: {
      renumber: true,
      hexadecimal: true,
      escapeless: true,
      compact: true,
      semicolons: false,
      parentheses: false,
    },
  });
})
