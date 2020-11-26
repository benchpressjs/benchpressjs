
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

{{{ if ((name == "Jack") && yes) }}}
That's an affirmative, Bob!
{{{ end }}}

Hello, {(is_human && "fellow human")} {name}. How was your day?

{{{ if (!count || !yes) }}}
Dang, nothing here!
{{{ end }}}

Hello, {name} {(last_name || "the Fantastic")}!
