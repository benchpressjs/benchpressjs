<!-- IF function.isEvenLegacy, ten -->
{function.caps, lorem}
<!-- END -->

{{{ if isEven(ten) }}}
    {caps(lorem)}
{{{ end }}}



The first five letters are: {join(", ", "a", "b", "c", "d", "e")}

{{{ if !isEven(eleven) }}}
It's odd.
{{{ end }}}
