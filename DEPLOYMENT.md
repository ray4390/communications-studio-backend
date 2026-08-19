# Deployment runbook

This service is intended to run on the USAR Linux server behind HTTPS.

## 1. Server prerequisites

Install Git, Docker Engine, the Docker Compose plugin, and Caddy (or another HTTPS reverse proxy).

Recommended checkout location:

```bash
sudo mkdir -p /opt/communications-studio-backend
sudo chown "$USER":"$USER" /opt/communications-studio-backend
git clone https://github.com/ray4390/communications-studio-backend.git /opt/communications-studio-backend
cd /opt/communications-studio-backend
```

## 2. Choose the public API hostname

The API needs a public HTTPS hostname that browsers can reach. Example:

```text
communications-api.example.com
```

Point that DNS name at the server before configuring Caddy.

The final hostname must be used consistently in:

- `PUBLIC_BASE_URL`
- `DISCORD_REDIRECT_URI`
- `ROBLOX_REDIRECT_URI`
- the Discord Developer Portal redirect list
- the Roblox OAuth application redirect list
- the frontend `apiBase`

## 3. Configure secrets

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

At minimum fill in:

```text
PUBLIC_BASE_URL
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN
ROBLOX_CLIENT_ID
ROBLOX_CLIENT_SECRET
```

Do not change the canonical guild/channel/ping IDs unless the Discord server itself changes.

Never commit `.env`.

## 4. Discord application setup

The Discord application/bot belongs in guild:

```text
886068973886640129
```

OAuth redirect URI:

```text
https://YOUR-API-HOST/auth/discord/callback
```

The website OAuth flow requests:

```text
identify
guilds.members.read
```

The backend does **not** currently need to connect to Discord's Gateway or run a separate `discord.js` process. It uses the bot token through Discord's HTTP API to fetch one specific guild member when it needs a fresh role check. Therefore the current authorization phase does not require Message Content Intent, Presence Intent, or Server Members Intent.

Do not give the bot Administrator. During the authorization-only phase, simply install the bot in the USAR guild and keep the token available to the backend. The future publication phase will additionally need access to the approved publication channels and webhook-management/send permissions; those permissions should be scoped to the five approved publication channels rather than the entire server wherever possible.

## 5. Roblox OAuth setup

Roblox redirect URI:

```text
https://YOUR-API-HOST/auth/roblox/callback
```

The current OAuth flow requests:

```text
openid
profile
```

Roblox is used to link the user's Roblox identity and resolve the curated group/rank publishing policy. FEC and NARA are exceptions and use Discord roles instead.

## 6. Start the API

The production image runs as the non-root `node` user (UID 1000). Create the host data directory before first start so SQLite can write to it:

```bash
cd /opt/communications-studio-backend
mkdir -p data
sudo chown 1000:1000 data
```

Then build and start:

```bash
docker compose -f compose.yml build
docker compose -f compose.yml up -d
```

Check health locally:

```bash
curl http://127.0.0.1:8787/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "communications-studio-api",
  "guild_id": "886068973886640129",
  "config_warnings": []
}
```

If `config_warnings` is not empty, fix `.env` before enabling the frontend.

Useful operations:

```bash
docker compose -f compose.yml logs -f api
docker compose -f compose.yml restart api
docker compose -f compose.yml pull
docker compose -f compose.yml build --pull
docker compose -f compose.yml up -d
```

SQLite data is stored in `./data` on the host and survives container replacement.

## 7. HTTPS reverse proxy

Copy `Caddyfile.example` into the server's Caddy configuration and replace the placeholder hostname.

Example:

```text
communications-api.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8787
}
```

Then reload Caddy and verify:

```bash
curl https://YOUR-API-HOST/health
```

Do not expose port `8787` directly to the public Internet. Compose binds it to `127.0.0.1` only.

## 8. Connect the frontend

In `nationalarchivesusar/communications-studio/config.js`, set:

```js
apiBase: "https://YOUR-API-HOST"
```

Keep fetch requests using `credentials: "include"`.

The current GitHub Pages frontend and a separately hosted API are cross-site origins. The backend therefore defaults to `SameSite=None; Secure`. Browser third-party-cookie restrictions can still affect this architecture. A future shared custom domain for frontend + API is preferable.

## 9. Smoke test

Test in this order:

1. `/health` reports no configuration warnings.
2. Discord sign-in returns to Communications Studio.
3. A user outside guild `886068973886640129` is denied Studio access.
4. A normal guild member with no qualifying roles/ranks receives zero publishing identities.
5. Link Roblox and confirm qualifying group ranks appear.
6. Confirm FEC/NARA are granted only by their configured Discord roles.
7. Confirm FEC is restricted to channel `1076283102822940713`.
8. Confirm NARA can select any branch channel but cannot request `@everyone`.
9. Confirm ordinary identities cannot change their branch destination or ping role.

`POST /api/publish` intentionally returns `501 publishing_not_configured` after all authorization checks. Actual Discord delivery will be enabled only after the application/webhook layer is configured and tested.
