# Conditionals

### Note on alternate syntax

The different syntaxes can be mixed, but this is not advised. 
Any expressions after `END` is ignored when using the legacy syntax, so `<!-- END def -->` will close a conditional block started with `<!-- IF abc -->`.
Spaces just inside the curly braces are optional in the new syntax (`{{{ else }}}` = `{{{else}}}`).

## Basic If-Then

An if-then statement is done by surrounding the output text in an if block. An if block can be opened with two different syntaxes:
`{{{ if condition }}}` or `<!-- IF condition -->` in legacy syntax. The new syntax was added in Benchpress so conditionals inside HTML attributes don't affect syntax highlighting.
An if block is closed with any of the following: `{{{ end }}}`, `<!-- END -->`, `<!-- END conditional -->`, or `<!-- ENDIF conditional -->`. 

The parameter to the if block is called the "test", the text within the block is called the "body". In the case of a basic if-then, if the test is a [truthy value](https://developer.mozilla.org/en-US/docs/Glossary/Truthy), 
the body is output, otherwise nothing is output. One exception is that an empty array is treated as a falsy value, so would not output anything.

```html
{{{ if test }}}
This is a test!
{{{ end }}}

<!-- IF test -->
This is a test!
<!-- END -->
```

```
This is a test!

This is a test!
```

## If-Not-Then

The if-not-then syntax has a different opener in which an exclamation point (`!`) is prepended to the test: `{{{ if !condition }}}` or `<!-- IF !condition -->`.

```html
{{{ if !not_test }}}
This is not a test!
{{{ end }}}

<!-- IF !not_test -->
This is not a test!
<!-- END -->
```

Output
```
This is not a test!

This is not a test!
```

## If-Then-Else

An else block will execute when the main body of the if block does not. There are two syntaxes for an else token: `<!-- ELSE -->` or `{{{ else }}}`. 
Else blocks come before the closing token of the if block. Else can be used with both If-Thens and If-Not-Thens, though the latter usage is not recommended.

```html
{{{ if not_test }}}
This is a test!
{{{ else }}}
This is not a test!
{{{ end }}}

<!-- IF test -->
This is a test!
<!-- ELSE -->
This is not a test!
<!-- END -->
```

Output
```
This is a test!

This is not a test!
```
