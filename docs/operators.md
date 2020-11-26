# Operators

Data
```js
{
  yes: true,
  count: 0,
  name: "Jack",
  password: "Jack",
  last_name: null,
  is_human: true,
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

## And

To check that two values are both true, you can use the `&&` operator. Wrapping the whole `left && right` piece in parenthesis in mandatory.

```html
{{{ if ((name == "Jack") && yes) }}}
That's an affirmative, Jack!
{{{ end }}}
```

Output
```html
That's an affirmative, Jack!
```

You can also use this operator to map to a different value if one is truthy:

```html
Hello, {(is_human && "fellow human")} {name}. How was your day?
```

Output
```html
Hello, fellow human Jack. How was your day?
```

## Or

To check that one or both values are true, you can use the `||` operator. Wrapping the whole `left || right` piece in parenthesis in mandatory.

```html
{{{ if (!count || !yes) }}}
Dang, nothing here!
{{{ end }}}
```

Output
```html
Dang, nothing here!
```

You can also use this operator to provide a default value if the left one is falsy:

```html
Hello, {name} {(last_name || "the Fantastic")}!
```

Output
```html
Hello, Jack the Fantastic!
```
