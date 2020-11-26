## API

[API Usage](api.md)

## Syntax

- [Interpolation](interpolation.md)  
  `My name is {user.name}`
- [Conditionals](conditionals.md)  
  `{{{ if isTrue }}}is true{{{ end }}}`
- [Iteration](iteration.md)  
  `{{{ each people }}}{../name} is {../age} years old.{{{ end }}}`
- [Helpers](helpers.md)  
  `Average: {divide(total, count)}`
- [Operators](operators.md)  
  `Not Bob? {(name != "Bob")}`

### Paths
A path is a fundamental unit in Benchpress. Any description of where a certain value exists in the data is a path. For instance, in interpolation like `Hello, {world}.`, `world` is a path to the global `world` property. 

#### Numeric Indexing
Benchpress does not have numeric literals, or a special syntax for indexing into an array numerically. Instead, you place the number in the place of the property name. The equivalent of the JS expression `x.text[123]` is `x.text.123` in benchpress expressions.

- `{arr.3}` - access element `3` of array `arr`
- `{12}` - access the top-level value stored in the property `"12"`
- `{person.pets.0}` - access the person's first pet

*Note:* Only integers are supported in this manner.

#### Special Keywords
The following special keywords can be used in place of a path:

- `@true` - `boolean`  
  The boolean value `true`.
- `@false` - `boolean`  
  The boolean value `false`.
- `@root` - `any`  
  The object passed to `parse`. The top-level context object.
- `@value` - `any`  
  The value of the current element in an iteration.
- `@key` - `string | number`  
  The key of the current element in an iteration.
- `@index` - `number`  
  The numerical index of the current element in an iteration. For an object, this differs from the key. For an array, this is normally equal to the key.
- `@first` - `boolean`  
  Whether this is the first element in an iteration.
- `@last` - `boolean`  
  Whether this is the last element in an iteration.

#### templates.js Compatibility

Paths behave in some unfortunately odd ways in Benchpress in order to maintain maximum backwards-compatibility with templates.js:

- `../` equals `./` at the start of the path. You must use `../../` or `./../` to go "up one level".
- `abc.def` can either mean the `def` property of the `abc` object or the `def` property of each element within the `abc` array or object. It behaves the second way if within an iteration block.
- There's a lot of magic that is done to make paths backwards-compatible with templates.js behavior, since it worked with incomplete paths. Essentially, the algorithm has to pattern match through the full path, looking for an overlap of the given path within it. The gritty details are [in the implementation](../compiler/src/parse/path.rs).
