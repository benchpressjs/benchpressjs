# Operators

Data
```js
{
  yes: true,
  count: 0,
  name: "Jack",
  password: "Jack",
}
```

## Negative / Not

Like in many languages, preceeding an expression with the `!` character causes its boolean value to be reversed:

```html
{{{ if !count }}}
Nobody here!
{{{ end }}}
```

Output
```html
Nobody here!
```

## Equal

To check for equality between two values, you can use the `==` operator and wrap the two expressions in parenthesis. Wrapping the whole `left == right` piece in parenthesis is mandatory.

```html
{{{ if (name == password) }}}
Your password cannot be the same as your name!
Please try a different one.
{{{ end }}}
```

Output
```html
Your password cannot be the same as your name!
Please try a different one.
```

## Not-Equal / Inequal

To check that two values are _not_ equal, you can use the `!=` operator. Wrapping the whole `left != right` piece in parenthesis is mandatory.

```html
{{{ if (name != "Bob") }}}
Hello, visitor!
{{{ end }}}
```

Output
```html
Hello, visitor!
```
