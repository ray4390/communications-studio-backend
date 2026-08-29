# Deployment runbook

Communications Studio Backend runs natively under systemd on the USAR Linux server and is published through Tailscale Funnel.

## Production layout

- Checkout: `/opt/communications-studio-backend`
- Service: `communications-studio-backend.service`
- Runtime user: `ray`
- Environment file: `/opt/communications-studio-backend/.env`
- Local health endpoint: `http://127.0.0.1:8787/health`
- Production deploy helper: `/usr/local/bin/communications-studio-systemd-control`
- Auto-deploy activation sentinel: `/home/deploy/.communications-studio-autodeploy-enabled`
- GitHub Actions runner: `ray-server-communications-studio`
- Runner labels: `ray-server`, `production`, `communications-studio`

SQLite data remains under the repository `data/` directory and is not replaced during deployments.

## Automatic production deployment

`.github/workflows/production-deploy.yml` validates every pull request and every push to `main` on a GitHub-hosted runner. Pushes to `main` then deploy through the dedicated self-hosted production runner.

The production path is:

1. Check out the pushed commit on GitHub-hosted Ubuntu.
2. Install dependencies with `npm ci`.
3. Run syntax checks and unit tests.
4. Audit runtime dependencies for high-severity findings.
5. Hand the exact validated `GITHUB_SHA` to the self-hosted runner.
6. The restricted control helper verifies that SHA is the current `origin/main` head.
7. The production checkout is moved to that exact SHA.
8. Locked production dependencies are installed with `npm ci --omit=dev`.
9. `communications-studio-backend.service` is restarted.
10. The helper requires repeated successful `/health` responses before accepting the deployment.
11. If checkout, dependency installation, restart, or the health gate fails, the helper rolls the checkout back to the previously deployed SHA, reinstalls its locked dependencies, and restarts systemd.
12. GitHub receives a `production-deploy` commit status and service logs are captured on failure.

The self-hosted runner does not have general-purpose passwordless root access. Its `deploy` account is authorized only to execute the Communications Studio production control helper through sudo.

## Manual production operations

Status and health check:

```bash
sudo /usr/local/bin/communications-studio-systemd-control status
```

Recent service logs:

```bash
sudo /usr/local/bin/communications-studio-systemd-control logs
```

A manual GitHub Actions deployment can also be started with the workflow's `workflow_dispatch` action and `deploy=true`.

Do not manually `git pull` and restart the service for ordinary releases once auto-deploy is enabled. Production should correspond to a validated GitHub SHA.

## Environment and secrets

Copy `.env.example` to `.env` for a new installation and keep it mode `600`. Never commit `.env`.

Required production integrations include Discord and Roblox OAuth/application credentials. Sentry is optional but recommended:

```text
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

When `SENTRY_DSN` is configured, the service reports under release names of the form:

```text
communications-studio-backend@<git-sha>
```

Instrumentation redacts common credential fields and does not enable default PII collection.

## HTTPS routing

The application listens on port `8787`. The current production route is provided by Tailscale Funnel rather than Docker/Caddy.

Keep the backend bound to the server and expose it through the configured Funnel route. The bare HTTPS hostname, historical port `10000`, and compatibility path `/communications-studio-api` all route to the same backend. Reconcile those routes as root with:

```bash
sudo bash scripts/configure-production-funnel.sh
```

If Funnel administration is temporarily unavailable, set
`COMPATIBILITY_PORT=3001` in `.env` to serve the pre-existing root Funnel
target directly. Keep `PORT=8787` so the legacy endpoint and compatibility
path continue to work.

Verify both the bare public endpoint and the dedicated health endpoint separately from the local systemd health check.

## OAuth configuration

The Discord application belongs in guild `886068973886640129`. The web OAuth flow requests:

```text
identify
guilds.members.read
```

The backend uses the Discord bot token through the HTTP API for fresh guild membership/role checks, user search, and guild emoji metadata. It does not require a separate Discord Gateway process for the current feature set.

Roblox OAuth currently requests:

```text
openid
profile
```

Roblox is used to link the user's identity and resolve curated group/rank publication authority. FEC and NARA are Discord-role-controlled exceptions.

## Smoke test

After any infrastructure change, verify:

1. `sudo /usr/local/bin/communications-studio-systemd-control status` reports `active` and a healthy API.
2. `/health` reports `config_warnings: []`.
3. Discord sign-in returns to Communications Studio.
4. Roblox linking completes and qualifying group ranks appear.
5. Discord user search returns current server members for authorized Studio users.
6. Publishing identities and branch routing remain restricted by backend policy.

`POST /api/publish` currently remains gated until the Discord publication layer is explicitly enabled and tested.
