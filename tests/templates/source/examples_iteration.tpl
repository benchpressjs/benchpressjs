<!-- BEGIN arr -->
{@index} = {@value}
<!-- END -->

{{{ each arr }}}
{@index} = {@value}
{{{ end }}}



<!-- BEGIN people -->
{people.name} is {../age} years old.
<!-- END -->

{{{ each people }}}
{people.name} is {../age} years old.
{{{ end }}}



<!-- BEGIN usernames -->
#{@index}   {@key}: {@value}
<!-- END -->

{{{ each usernames }}}
#{@index}   {@key}: {@value}
{{{ end }}}



<!-- BEGIN admins -->
username: {@key}
name: {admins.name}

<!-- END -->

{{{ each admins }}}
username: {@key}
name: {admins.name}

{{{ end }}}