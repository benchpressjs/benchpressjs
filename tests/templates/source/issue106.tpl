{{{each users}}}
  <li>
    <a href="{config.relative_path}/uid/{../uid}">{{buildAvatar(users, "sm", true)}} {../username}</a>
  </li>
{{{end}}}
