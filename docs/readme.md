## Syntax

- [Interpolation](interpolation.md)  
  `My name is {user.name}`
- [Conditionals](conditionals.md)  
  `<!-- IF isTrue -->is true<!-- END -->`
- [Iteration](iteration.md)  
  `<!-- BEGIN people -->{../name} is {../age} years old.<!-- END -->`
- [Helpers](helpers.md)  
  `Average: {function.divide, total, count}`

### Paths
A path is a fundamental unit in Benchpress. Any description of where a certain value exists in the data is a path. For instance, in interpolation like `Hello, {world}.`, `world` is a path to the global `world` property. Paths behave in some unfortunately odd ways in Benchpress in order to maintain maximum backwards-compatibility with templates.js. 

- `../` equals `./` at the start of the path. You must use `../../` or `./../` to go "up one level".
- `abc.def` can either mean the `def` property of the `abc` object or the `def` property of each element within the `abc` array or object. It behaves the second way if within an iteration block.
- There's a lot of magic that is done to make paths backwards-compatible with templates.js behavior, since it worked with incomplete paths. Essentially, the algorithm has to pattern match through the full path, looking for an overlap of the given path within it. The gritty details are [in the implementation](../lib/compiler/paths.js). 

## API

- [Usage](api.md)