
{{{ if !count }}}
Nobody here!
{{{ end }}}

{{{ if (name == password) }}}
Your password cannot be the same as your name!
Please try a different one.
{{{ end }}}

{{{ if (name != "Bob") }}}
Hello, visitor!
{{{ end }}}

