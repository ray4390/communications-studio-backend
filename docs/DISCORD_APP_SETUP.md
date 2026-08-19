# Discord application setup

Communications Studio uses one Discord application for user OAuth, the installed bot identity, authoritative guild-role checks, and eventually publication/webhook management.

Target guild:

`886068973886640129`

## What to configure now

### 1. General Information

Record these values for the backend `.env` file:

- **Application ID** → `DISCORD_CLIENT_ID`
- **Client Secret** → `DISCORD_CLIENT_SECRET`

Treat the client secret as a password. Do not put it in the frontend repository, screenshots, or Discord messages.

### 2. Bot

Create the bot user if the application does not already have one.

Generate/reset the bot token and store it as:

`DISCORD_BOT_TOKEN`

The current backend does not connect to the Gateway. It uses the bot token only for authenticated HTTP API calls, including a fresh lookup of the publishing user's guild membership and role IDs.

For the current authorization phase you do **not** need:

- Message Content Intent
- Presence Intent
- Server Members Intent

Do not grant Administrator.

If this application is only for USAR, leaving the bot non-public is reasonable.

### 3. OAuth2 redirect

Once the API hostname is chosen, add exactly:

`https://YOUR-API-HOST/auth/discord/callback`

The Communications Studio user-login flow requests:

- `identify`
- `guilds.members.read`

Those are user OAuth scopes and are separate from the bot's server installation.

### 4. Install the bot in USAR

Install the bot into guild `886068973886640129`.

The authorization-only backend does not need broad Discord permissions. It only needs to be present in the target guild so the backend can use the bot token for a specific-member lookup.

Do not install it into unrelated servers unless there is a reason to do so.

## What will be added for publication

Do not over-permission the bot yet. When the Discord delivery layer is enabled, we will choose the final webhook/application-owned publication mechanism and then grant only what that mechanism requires.

The only channels Communications Studio is allowed to publish into are:

| Purpose | Channel ID |
|---|---:|
| White House | `899467464826556427` |
| Executive Branch | `886076674792390707` |
| Legislative Branch | `886077286414172171` |
| Judicial Branch | `886077834911678464` |
| Federal Election Commission | `1076283102822940713` |

Likely future bot permissions include channel visibility and webhook-management capability in those channels only. We will finalize that before enabling `POST /api/publish`; do not grant Administrator as a shortcut.

## Notification roles managed by the backend

| Role | ID |
|---|---:|
| Executive Ping | `937155572342587392` |
| White House Ping | `1156347407899041812` |
| Legislative Ping | `1156346015234924615` |
| Judicial Ping | `1156346227286360236` |

Users never submit arbitrary role IDs. They submit policy keys, and the backend resolves these IDs.

FEC may combine any/all four approved roles with `@everyone`. NARA may combine any/all four approved roles but may not use `@everyone`.

## Backend values you can prepare now

Once you have the application created, the local production `.env` will contain:

```text
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=886068973886640129
DISCORD_BOT_TOKEN=...
DISCORD_REDIRECT_URI=https://YOUR-API-HOST/auth/discord/callback
```

Do **not** commit the real `.env` file. `.gitignore` already excludes it.
