# Communications Studio Backend

Backend API for the **United States of America Roblox Communications Studio**.

This service owns authentication, account linking, publishing authorization, Discord channel/mention policy, and (next phase) Discord Components V2 publication and audit logging. The frontend is maintained separately at [`nationalarchivesusar/communications-studio`](https://github.com/nationalarchivesusar/communications-studio).

## Current scope

- Discord OAuth and guild-role authorization
- Roblox OAuth/account linking and group-rank authorization
- Persistent opaque application sessions backed by SQLite
- Curated publishing-identity policy
- Server-enforced destination-channel and ping policy
- FEC/NARA Discord-role-controlled access
- Docker/Compose deployment and Caddy reverse-proxy example
- Automated policy/routing tests
- `/api/publish` authorization gate (Discord send is intentionally disabled until bot/application credentials are configured)

## Canonical Discord configuration

Guild: `886068973886640129`

Publication channels:

- White House: `899467464826556427`
- Executive Branch: `886076674792390707`
- Legislative Branch: `886077286414172171`
- Judicial Branch: `886077834911678464`
- Federal Election Commission: `1076283102822940713`

Notification roles:

- Executive Ping: `937155572342587392`
- White House Ping: `1156347407899041812`
- Legislative Ping: `1156346015234924615`
- Judicial Ping: `1156346227286360236`

FEC may use `@everyone` and any combination of the four approved ping roles. NARA may use any combination of the four approved ping roles but never `@everyone`.

## Local development

```bash
cp .env.example .env
npm install
npm test
npm start
```

Default local API: `http://127.0.0.1:8787`.

## Production

The service is designed to run behind HTTPS on the Linux server using Docker Compose and a reverse proxy. Never commit `.env`, bot tokens, OAuth client secrets, webhook tokens, or other credentials.

See `DEPLOYMENT.md` for deployment and application setup.
