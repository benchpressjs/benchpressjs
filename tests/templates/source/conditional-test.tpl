<!-- IF isFalse -->
<div class="select" component="topic/select">
<!-- IF username -->
<div class="user-picture"></div>
<!-- ELSE -->
<div class="user-icon"></div>
<!-- ENDIF username -->
</div>
<!-- ELSE -->
<a href="<!-- IF userslug -->/user<!-- ELSE -->#<!-- ENDIF userslug -->">
<!-- IF username -->
<div class="user-picture"></div>
<!-- ELSE -->
<div class="user-icon"></div>
<!-- ENDIF username -->
</a>
<!-- ENDIF isFalse -->
