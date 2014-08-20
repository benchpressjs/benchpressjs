<h3>{header}</h3>
<ul>
<!-- BEGIN items -->
<!-- IF @first -->
	<li>
		<strong>{items.name}</strong>
	</li>
	<!-- ELSE -->
	<li>
		<!-- IF items.link --><a href="{items.url}"><!-- ENDIF items.link -->{items.name}<!-- IF items.link --></a><!-- ENDIF items.link -->
	</li>
<!-- ENDIF @first -->
<!-- END items -->
</ul>
<!-- IF something -->
    <p>do something!</p>
<!-- ENDIF something -->