'use strict';

/**
 * Resolve a full path from a base path and relative path
 * @param {string} basePath
 * @param {string} relPath
 */
function resolve(basePath, relPath) {
  // already relative, so easy work
  if (/^\.\.?\//.test(relPath)) {
    const backPattern = /[^.]*\.\.\//;
    const rel = relPath.replace(/^\.\.\//, '');
    let path;
    if (!basePath) {
      path = `${rel.replace(/^\./, '')}`;
    } else {
      path = `${basePath}.${rel.replace(/^\./, '')}`;
    }
    while (backPattern.test(path)) {
      path = path.replace(backPattern, '');
    }

    return path;
  }

  // otherwise we have to figure out if this is something like
  // BEGIN a.b.c
  // `- {a.b.c.d}
  // or if it's an absolute path
  const base = basePath.split('.');
  const rel = relPath.split('.');
  // find largest possible match in the base path
  // decrease size of slice until a match is found
  let found = false;
  let relStart;
  let baseLen;

  for (let l = rel.length; l > 0 && !found; l -= 1) {
    // slide through array from end to start until a match is found
    for (let j = base.length - l; j >= 0 && !found; j -= 1) {
      // check every element from (j) to (j + l) for equality
      // if not equal, break right away
      for (let i = 0; i < l; i += 1) {
        if (base[j + i].replace(/\[\d+]$/, '') === rel[i]) {
          found = true;
          if (i === l - 1) {
            relStart = l;
            baseLen = j + l;
          }
        } else {
          found = false;
          break;
        }
      }
    }
  }

  if (found) {
    return base.slice(0, baseLen).concat(rel.slice(relStart)).join('.');
  }

  // assume its an absolute path
  return relPath;
}

exports.resolve = resolve;
