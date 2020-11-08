# Iteration

### Note on alternate syntax

The different syntaxes can be mixed, but this is not advised. 
Any expressions after `END` is ignored when using the legacy syntax, so `<!-- END def -->` will close a block started with `<!-- BEGIN abc -->`.
Spaces just inside the curly braces are optional in the new syntax (`{{{ end }}}` = `{{{end}}}`).

Using the new syntax is highly encouraged. Using the legacy syntax will increase file size and also slow down parsing speeds. 
This is because the `<!-- BEGIN thing -->` syntax is ambiguous. It can be used to refer to local or global properties. 
To fix this, Benchpress transforms it into ` IF ../thing   BEGIN ../thing   ELSE   BEGIN thing `. This allows for backwards compatibility.
The new syntax is not transformed like this, you must use `{{{ each ../thing }}}` or `{{{ each arr.thing }}}` to refer to the current context, as `{{{ each thing }}}` refers to the global `thing`.

## Array Iteration

An iteration block is started with `{{{ each arr }}}` or `<!-- BEGIN arr -->` in legacy syntax. For each element in the array, the body of the block is output. 
Interpolation, conditionals, etc can be used within the block and can reference the current element in different ways. There are several ways to reference the element's value or properties:

- `@value` references the entire value of the current element
- `@index` and `@key` reference the numeric index of the current element  
  (one exception is with sparse arrays, where they can differ)
- `../prop` and `arr.prop` refer to the `prop` property of the current element

### Example #1
```js
var arr = [
    'a',
    'b',
    'c',
    'd',
    'e',
];
```
```html
{{{ each arr }}}
{@index} = {@value}
{{{ end }}}

<!-- BEGIN arr -->
{@index} = {@value}
<!-- END -->
```

Output
```text
0 = a
1 = b
2 = c
3 = d
4 = e
```

### Example #2

```js
var people = [
    {
        name: 'John Smith',
        age: 34,
    },
    {
        name: 'Samantha Walker',
        age: 67,
    },
    {
        name: 'Josh Hawkins',
        age: 12,
    },
];
```
```html
{{{ each people }}}
{people.name} is {../age} years old.
{{{ end }}}

<!-- BEGIN people -->
{people.name} is {../age} years old.
<!-- END -->
```

Output
```text
John Smith is 34 years old.
Samantha Walker is 67 years old.
Josh Hawkins is 12 years old.
```

## Object Iteration

An iteration block is started with `{{{ each obj }}}` or `<!-- BEGIN obj -->`. For each enumerable, own property of the object (the behavior of `Object.keys`), the body of the block is output. 
Interpolation, conditionals, etc can be used within the block and can reference the current element in different ways. There are several ways to reference the element's value or properties:

- `@value` references the entire value of the current element
- `@index` references the numeric index of the current element (0, 1, 2 ...)
- `@key` references the property name of the current element
- `../prop` and `arr.prop` refer to the `prop` property of the current element

### Example #1
```js
var usernames = {
    'jumpbugger': 'Jacob Harley',
    'neatoooo': 'Kate Worden',
    'hamster': 'Nate Francis',
};
```
```html
{{{ each usernames }}}
#{@index}   {@key}: {@value}
{{{ end }}}

<!-- BEGIN usernames -->
#{@index}   {@key}: {@value}
<!-- END -->
```

Output
```text
#0   jumpbugger: Jacob Harley
#1   neatoooo: Kate Worden
#2   hamster: Nate Francis
```

### Example #2
```js
var admins = {
    'jumpbugger': {
        name: 'Jacob Harley',
    },
    'neatoooo': {
        name: 'Kate Worden',
    },
    'hamster': {
        name: 'Nate Francis',
    },
};
```
```html
{{{ each admins }}}
username: {@key}
name: {admins.name}

{{{ end }}}

<!-- BEGIN admins -->
username: {@key}
name: {admins.name}

<!-- END -->
```

Output
```text
username: jumpbugger
name: Jacob Harley

username: neatoooo
name: Kate Worden

username: hamster
name: Nate Francis
```
