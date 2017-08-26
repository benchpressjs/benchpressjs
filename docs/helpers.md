# Helpers

Helpers are custom functions used to enable more complex behavior than the basic syntax allows on its own.

## Creating a Helper
A helper functon is just a normal function which recieves arguments and returns a value. 
To create a helper, pass a name and function into the `Benchpress.registerHelper` method.

```js
Benchpress.registerHelper('caps', function (text) {
    return text.toUpperCase();
});
Benchpress.registerHelper('isEven', function (num) {
    return num % 2 === 0;
});
```

## Using a Helper
A helper is called within the context of a template using the `function.` prefix. 
It can be used in conditional tests and with interpolation. This unfortunately means that accessing properties of any value named `function` is impossible.

```js
var data = {
    ten: 10,
    lorem: 'Lorem ipsum dolar sit amet',
};
```
```html
{{{ if function.isEven, ten }}}
    {function.caps, lorem}
{{{ end }}}
```

Output
```text
LOREM IPSUM DOLAR SIT AMET
```

### Note about alternate syntax
In legacy syntax, helpers behave in inconsistent ways:

- In a conditional test, helpers are automatically given the full root context as the first parameter.
- In an iteration body, a helper with no arguments is automatically called with the value of the current element.
