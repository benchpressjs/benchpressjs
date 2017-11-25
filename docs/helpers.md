# Helpers

Helpers are custom functions used to enable more complex behavior than the basic syntax allows on its own.

## Creating a Helper
A helper functon is just a normal function which recieves arguments and returns a value. 
To create a helper, pass a name and function into the `Benchpress.registerHelper` method.

```js
Benchpress.registerHelper('caps', function (text) {
    return String(text).toUpperCase();
});

Benchpress.registerHelper('isEven', function (num) {
    return num % 2 === 0;
});
// in legacy IF syntax, the root context is provided as the first argument
Benchpress.registerHelper('isEvenLegacy', function (context, num) {
    return num % 2 === 0;
});

// ES6 array function syntax
Benchpress.registerHelper('join', (joiner, ...args) => args.join(joiner));
```

## Using a Helper
A helper is called within the context of a template using one of two syntaxes: `function.helperName, ...args` or `helperName(...args)`. 
It can be used in conditional tests and with interpolation. 

```js
var data = {
    ten: 10,
    eleven: 11,
    lorem: 'Lorem ipsum dolar sit amet',
};
```
```html
<!-- IF function.isEvenLegacy, ten -->
    {function.caps, lorem}
<!-- END -->

{{{ if isEven(ten) }}}
    {caps(lorem)}
{{{ end }}}
```

Output
```text
LOREM IPSUM DOLAR SIT AMET
```

It works with any number of arguments, and also works with If-Not-Then syntax:

```html
The first five letters are: {join(", ", "a", "b", "c", "d", "e")}

{{{ if !isEven(eleven) }}}
It's odd.
{{{ end }}}
```

Output
```
The first five letters are: a, b, c, d, e

It's odd.
```

### Note about alternate syntax
In legacy syntax, helpers behave in inconsistent ways:

- Unfortunately, accessing properties of any value named `function` is impossible.
- In a conditional test, helpers are automatically given the full root context as the first parameter.
- In an iteration body, a helper with no arguments is automatically called with the value of the current element.
