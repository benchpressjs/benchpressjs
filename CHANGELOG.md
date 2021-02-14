<!--
Detail changes here upon release

Format:

## Version <version> (<date>)

### New

- Large improvements
- Features

### Fixes

- Bug fixes
- Small improvements
-->

## Version 2.4.1 (2021-02-13)

### Fixes

- Allow `/` in paths [#102](https://github.com/benchpressjs/benchpressjs/issues/102)
- Add a warning for probable template token syntax errors

## Version 2.4.0 (2021-01-04)

### Fixes

- Better error handling
- Fix TreeError when blocks were unterminated [#98](https://github.com/benchpressjs/benchpressjs/issues/98)

### New

- Allow a subject hint in new end syntax: `{{{ end thing }}}`

## Version 2.3.0 (2020-11-26)

### New

- Added `@true` and `@false` boolean keywords
- Added `==` and `!=` operators for comparison
- Added `&&` and `||` operators for short-circuiting boolean operations

## Version 2.2.2 (2020-11-15)

### Fixes

- Fix tab calculation (column starts at 1)

## Version 2.2.1 (2020-11-15)

### Fixes

- Warning padding now accounts correctly for tabs
- Add _Extra Tokens_ to warnings under 2.2.0
- Exclude more files from npm package

## Version 2.2.0 (2020-11-15)

### New: Compiler Rewrite

This release includes a rewrite of the compiler, using the parser combinator library [`nom`](https://github.com/geal/nom).

This rewrite has drastically improved code quality and extensibility. As part of the rewrite, structures include information about source location, so warnings now display file (assuming file name was passed to `precompile`), line, and column.

Also a performance win: the new compiler is about 4.4 times as fast.

### Deprecations
The following features are deprecated, to become errors in v3.0.0:

#### Keyword outside an interpolation token
You may see a warning like the following:
```text
[benchpress] warning: keyword outside an interpolation token is deprecated
     --> tests/templates/source/loop-tokens-conditional.tpl:4:65
      |
    4 |     <!-- IF @value --> &rarr; <span class="label label-default">@value</span><!-- ENDIF @value -->
      |                                                                 ^^^^^^ help: wrap this in curly braces: `{@value}`
      | note: This will become an error in the v3.0.0
```

This is a legacy of backwards compatibility with templates.js, where this was supported for `@key`, `@value`, and `@index`.

#### Mixing token types
You may see a warning like the following:
```text
[benchpress] warning: mixing token types is deprecated
     --> tests/templates/source/mixed-syntax.tpl:20:1
      |
   20 | {{{if rooms.length}}}
      | ^^^^^^^^^^^^^^^^^^^^^ `if` started with modern syntax
     ::: tests/templates/source/mixed-syntax.tpl:34:1
      |
   34 | <!-- ENDIF rooms.length -->
      | ^^^^^^^^^^^^^^^^^^^^^^^^^^^ but legacy syntax used for `ENDIF`
      | note: Migrate all to modern syntax. This will become an error in v3.0.0
```

### New Warnings
We added some new warnings to help you avoid common issues:

#### Output bloat due to ambiguous inner BEGIN
```text
[benchpress] warning: output bloat due to ambiguous inner BEGIN
     --> tests/templates/source/nested-loop.tpl:1:37
      |
    1 | <!-- BEGIN animals -->{animals.name}<!-- BEGIN hobbies -->{animals.hobbies.name}<!-- END hobbies --><!-- END animals -->
      |                                     ^^^^^^^^^^^^^^^^^^^^^^ `hobbies` could refer to the top-level value `hobbies` or 
the `.hobbies` property of the current element, so compiler must emit code for both cases
      | note: Migrate to modern syntax to avoid the ambiguity. This will become an error in the future.
```

This exists to support backwards compatibility with templates.js, which supported this behavior. Switching to modern syntax will allow you to avoid this ambiguity, resulting in faster templates (and faster compiles).

#### Extra Tokens
This warning isn't actually new, just improved.
```text
[benchpress] warning: found extra tokens
     --> tests/templates/source/extra-tokens.tpl:17:7 
      |
   17 | </div><!-- END container -->
      |       ^^^^^^^^^^^^^^^^^^^^^^ help: remove the token or make it an unambiguous comment
     --> tests/templates/source/extra-tokens.tpl:25:64 
      |
   25 |         <p class="list-group-item-text">{rooms.description}</p><!-- END description -->
      |                                                                ^^^^^^^^^^^^^^^^^^^^^^^^ help: remove the token or make it an unambiguous comment
     --> tests/templates/source/extra-tokens.tpl:32:66 
      |
   32 |     <p class="list-group-item-text">Click here to create one!</p><!-- END -->
      |                                                                  ^^^^^^^^^^^^ help: remove the token or make it an unambiguous comment
      = note: These tokens will be passed through as text, but this will become an error in the future.
```

Another legacy of backwards compatibility with templates.js, which would ignore these cases due to how it worked.

## Version 2.1.0 (2020-11-08)

### New

- Switch to WebAssembly from a native module
  Provides much wider support across platforms and a single build for all versions of Node

### Fixes

- Test Node 15 (latest current) instead of Node 13
- Add console warnings for deprecated functions `.parse` and `.compileParse`
- Change docs to emphasize new syntax

## Version 2.0.9 (2020-11-07)

### Fixes

- Improve warning message when pre-build module fails to load

## Version 2.0.8 (2020-10-14)

### Fixes

- Fix issue where native module install failure would cause install to fail completely

## Version 2.0.7 (2020-10-10)

### Fixes

- Fix missing script in npm package

## Version 2.0.6 (2020-10-08)

### New

- Native module compiler will now provide context around extra token warnings

### Fixes

- Update dependencies

## Version 2.0.4 (2020-09-13)

### Fixes

- Remove old/unsupported native module binaries
- Update dependencies

## Version 2.0.3 (2020-05-09)

### New

- Now pre-builds native module binaries for Node 14

### Fixes

- Native module should now build successfully on Mac OS (#86)
- Update dependencies

### Removals

- Node 8 no longer supported by native rust compiler

## Version 2.0.1 (2020-02-14)

### New

- Node 13 now supported by native rust compiler

### Fixes

- Update dependencies
- Native rust compiler build script fixed to build in release mode with optimizations

## Version 2.0.0 (2019-09-01)

### New

- Node 12 now supported by native rust compiler

### Fixes

- Removed md5 hashing in `compileRender`

### Deprecations

The following features deprecated in earlier versions (slated for removal in v2.0.0) will instead be removed in v3.0.0:

- use `.render` instead of `.parse`
- use `.compileRender` instead of `.compileParse`
- `loader` functions should return a Promise instead of receiving a callback

### Removals

- Node 6 is no longer supported

## Version 1.2.11 (2019-04-27)

### Fixes

- Empty `if`s no longer RTE JS compiler

## Version 1.2.10 (2019-02-18)

### Fixes

- Corrected `nyc` dependency version

## Version 1.2.9 (2019-02-17)

### Fixes

- Correct behavior of `./prop`
- Bump dependencies

## Version 1.2.8 (2019-01-09)

### Fixes

- Rust compiler bug fixes
- Exclude dev material from distribution

## Version 1.2.7 (2018-11-03)

### New

- Remove Onig dependency

### Fixes

- Upgrade neon to v0.2
- Add warning for VS2015 requirement

## Version 1.2.6 (2018-7-28)

### Fixes

- Legacy helpers without arguments at the top level no longer result in runtime errors
- Legacy syntax (`IF stuff`) no longer allowed within modern block syntax (`{{{ if stuff }}}`) and vice-versa

## Version 1.2.5 (2018-7-17)

### Fixes

- Unicode support for rust compiler

## Version 1.2.4 (2018-7-16)

### Fixes

- Rust compiler optimizations

## Version 1.2.3 (2018-7-14)

### Fixes

- Update dependencies
- Ignore unnecessary build artifacts

## Version 1.2.2 (2018-7-14)

### New

- Re-implement the compiler in rust
  + Speed up compile times by orders of magnitude
  + Native bindings with JS fallback
  + Fully compatible (except unsafe)
  + Will attempt to compile on install
  + If that fails, will try precompiled version
  + If that fails, will fall back to JS version
  + Add more tests to catch previously untested bugs
  + Make the extra tokens algorithm more forgiving
  + Add benchmarks for compilation
  + Build binaries with CI
  + benchchpress-rs in a separate repo with a git submodule here

### Fixes

- Use `new Function` instead of `vm.runInNewContext` (#77)
  + Results in slight performance improvements client-side

## Version 1.2.1 (2018-2-19)

### Fixes

- Empty template files will now render to an empty string (#75)

## Version 1.2.0 (2017-11-24)

### New

- Add new helper syntax which looks like a function call: `helperName(...args)`

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