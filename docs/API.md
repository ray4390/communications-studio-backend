# Communications Studio API

Base URL is configured by `PUBLIC_BASE_URL`.

All authenticated browser requests use the server-owned `cs_session` cookie and must be sent with `credentials: "include"` from the configured frontend origin.

## `GET /health`

No authentication required.

Example:

```json
{
  "ok": true,
  "service": "communications-studio-api",
  "guild_id": "886068973886640129",
  "config_warnings": []
}
```

A production deployment should not be considered ready while `config_warnings` is non-empty.

## `GET /auth/discord?return_to=<url>`

Starts Discord OAuth. The backend allow-lists the return URL to the configured frontend origin/path.

Requested Discord OAuth scopes:

- `identify`
- `guilds.members.read`

Callback:

`GET /auth/discord/callback`

## `GET /auth/roblox?return_to=<url>`

Starts Roblox OAuth with PKCE. If a Studio session already exists, the Roblox account is linked to that Studio user.

Callback:

`GET /auth/roblox/callback`

## `POST /auth/logout`

Revokes the current server-side Studio session and clears the session cookie.

Success: `204 No Content`.

## `GET /auth/session`

Unauthenticated:

```json
{
  "authenticated": false
}
```

Authenticated example:

```json
{
  "authenticated": true,
  "user": {
    "id": "internal-user-id",
    "display_name": "Example User",
    "username": "example",
    "provider": "Discord",
    "studio_access": true,
    "discord": {
      "id": "123",
      "username": "example",
      "display_name": "Example User",
      "avatar_url": "https://...",
      "guild_id": "886068973886640129",
      "in_guild": true,
      "roles": ["..."]
    },
    "roblox": {
      "id": "456",
      "username": "ExampleRoblox",
      "display_name": "ExampleRoblox",
      "avatar_url": "https://..."
    },
    "allowed_identity_ids": ["doj", "fbi"],
    "publishing_identities": []
  }
}
```

`publishing_identities` is the complete client-safe metadata for only the identities this user currently qualifies for.

## `GET /api/identities`

Requires an authenticated Studio user who is currently a member of the configured USAR Discord guild.

Response:

```json
{
  "identities": [
    {
      "id": "doj",
      "category": "Department of Justice",
      "label": "Department of Justice",
      "display_name": "United States Department of Justice",
      "avatar_url": "",
      "avatar_initials": "DOJ",
      "avatar_color": "#1f4d3e",
      "channels": [
        {
          "key": "executive",
          "id": "886076674792390707",
          "label": "#executive-branch"
        }
      ],
      "default_channel_id": "886076674792390707",
      "ping_options": [
        {
          "key": "executive",
          "id": "937155572342587392",
          "label": "@Executive Ping"
        }
      ],
      "allow_everyone": false
    }
  ]
}
```

The frontend must not invent additional identities, destination channels, ping role IDs, or `@everyone` capability.

## `POST /api/publish`

Current state: authorization/routing gate implemented; Discord delivery deliberately disabled.

Request shape:

```json
{
  "identity_id": "doj",
  "channel_id": "886076674792390707",
  "ping_keys": ["executive"],
  "ping_everyone": false,
  "builder_document": {
    "schema": "usar.communications-studio/v1",
    "version": 1,
    "message": {
      "identityId": "doj"
    },
    "containers": [
      {
        "kind": "container",
        "children": []
      }
    ]
  }
}
```

Before publication the backend:

1. requires an authenticated session;
2. resolves the requested identity;
3. forces a fresh Discord guild-membership/role lookup using the bot token;
4. for Roblox-controlled identities, forces a fresh Roblox group/rank lookup;
5. recalculates the user's allowed identities;
6. validates destination-channel policy;
7. validates approved ping-role / `@everyone` policy;
8. rejects multiple Containers and File components;
9. then enters the Discord publishing layer.

Until that final layer is enabled, a valid request returns `501`:

```json
{
  "error": "publishing_not_configured",
  "identity_id": "doj",
  "channel_id": "886076674792390707",
  "selected_ping_role_ids": ["937155572342587392"],
  "ping_everyone": false
}
```

### Common errors

- `401 authentication_required`
- `403 discord_guild_membership_required`
- `403 identity_not_authorized`
- `403 channel_not_authorized`
- `403 ping_not_authorized`
- `403 everyone_not_authorized`
- `400 builder_document_required`
- `400 exactly_one_container_required`
- `400 invalid_container`
- `400 file_components_not_allowed`
- `503 AUTHORIZATION_UNAVAILABLE`
