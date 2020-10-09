# Interpolation

Data
```js
{
  html: '<span>Here are two odd numbers:  3 and 1</span>',
  text: {
    123: 'One number is greater than the other:  3 > 1',
  }
}
```

## Unescaped
Wrapping an expression in two braces on each side creates an unescaped interpolation token:

```html
<div>{{html}}</div>
```

Output
```html
<div><span>Here are two odd numbers:  3 and 1</span></div>
```

An unescaped token is replaced with the string value of the given expression, according to how the Javascript engine does so, with the exception of `null` and `undefined`, which output nothing. Here are some examples:

value     | output string
----------|-----------------
{ a: 1 }  | [object Object]
[3, 5, 7] | 3,5,7
"hello"   | hello
0         | 0
true      | true
false     | false
NaN       | NaN
[]        | 
null      | 
undefined | 

## Escaped

Wrapping an expression in single braces creates an escaped interpolation token:

```html
<div>{text.123}</div>
```

Output
```html
<div>One number is greater than the other:  3 &gt; 1</div>
```

An escaped token behaves the same as an unescaped token, but escapes HTML characters like `<` and `>` in the output. If you want a different escaping behavior, you can override the `__escape` built-in helper:

```js
Benchpress.registerHelper('__escape', function (str) {
  // do something with str
  return str;
});
```
