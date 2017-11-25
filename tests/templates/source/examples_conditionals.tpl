<!-- IF test -->
This is a test!
<!-- END -->

{{{ if test }}}
This is a test!
{{{ end }}}



<!-- IF !not_test -->
This is not a test!
<!-- END -->

{{{ if !not_test }}}
This is not a test!
{{{ end }}}



<!-- IF test -->
This is a test!
<!-- ELSE -->
This is not a test!
<!-- END -->

{{{ if not_test }}}
This is a test!
{{{ else }}}
This is not a test!
{{{ end }}}
