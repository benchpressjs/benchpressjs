## Version 1.1.0 (2017-9-23)

### New

- Add `unsafe` compilation option
  + Disables property access guarding
  + Only supports iterating over dense array-like objects
  + Doesn't need `Benchpress.runtime` to render, can be called like `template(helpers, data)`
- Add `.render` and `.compileRender`, Promise-based methods doing what `.parse` and `.compileParse` did
- `.precompile` now returns and Promise or takes a callback
- `loader` functions can now return a Promise instead of receiving a callback

### Deprecations
The following deprecated functionality will be removed in v2.0.0

- use `.render` instead of `.parse` 
- use `.compileRender` instead of `.compileParse`
- `loader` functions should return a Promise instead of receiving a callback

## Version 1.0.4 (2017-9-13)

### Fixes

- Fix `Object.keys` on empty string error (#73)
- Make `evaluate` timeout longer

## Version 1.0.3 (2017-8-30)

### Fixes

- Fix not using cache client side

## Version 1.0.2 (2017-8-30)

### New

- Add issue template
- Add syntax documentation

### Fixes

- Fix duplicate existence checks

## Version 1.0.1 (2017-7-24)

### New

- Improve extensibility
- Test more Node versions

### Fixes

- Fix path undefined error

## Version 1.0.0 (2017-7)

Initial release