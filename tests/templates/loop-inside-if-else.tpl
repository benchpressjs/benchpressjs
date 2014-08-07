<!-- IF rooms.length -->
	<!-- BEGIN rooms -->
		<!-- IF !rooms.private -->
			<a data-func="webrtc.joinRoom" data-room="{rooms.slug}" href="#" class="list-group-item">
				<h4 class="list-group-item-heading">{rooms.name}</h4>
				<p class="list-group-item-text">{rooms.description}</p>
			</a>
		<!-- ENDIF !rooms.private -->
	<!-- END rooms -->
<!-- ELSE -->
    <a data-func="webrtc.newRoom" href="#" class="list-group-item">
        <h4 class="list-group-item-heading">No rooms currently available!</h4>
        <p class="list-group-item-text">Click here to create one!</p>
    </a>
<!-- ENDIF rooms.length -->