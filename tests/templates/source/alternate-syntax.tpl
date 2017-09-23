{{{each animals}}}
  {{{if @first}}}main{{{end}}}
  {{{ each ../hates }}}
    {{{ if @first }}}first{{{ end }}}
    {animals.hates.name}
  {{{ end }}}
  <br />
{{{end}}}