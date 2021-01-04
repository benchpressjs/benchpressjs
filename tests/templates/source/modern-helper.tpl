{{{ each animals }}}
{canspeak(@value)}
{{{ end animals }}}

{caps("I hate you!")}
{join(" ", "a", "b", "c")}

{{{ if caps("")}}}
Truthy
{{{ else }}}
Falsy
{{{ end }}}

{{{ if !join() }}}
Falsy
{{{ end }}}
