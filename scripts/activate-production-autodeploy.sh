#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run this activation helper with sudo." >&2
  exit 1
fi

APP="/opt/communications-studio-backend"
CONTROL_SOURCE="$APP/scripts/production-systemd-control.sh"
CONTROL_TARGET="/usr/local/bin/communications-studio-systemd-control"
SERVICE="communications-studio-backend.service"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN="$DROPIN_DIR/10-sentry-instrumentation.conf"
SUDOERS="/etc/sudoers.d/communications-studio-autodeploy"
SENTINEL="/home/deploy/.communications-studio-autodeploy-enabled"
NODE="/home/ray/.nvm/versions/node/v24.19.0/bin/node"
NPM="/home/ray/.nvm/versions/node/v24.19.0/bin/npm"
PATH_NODE="/home/ray/.nvm/versions/node/v24.19.0/bin:/usr/bin:/bin"

id deploy >/dev/null 2>&1 || { echo "The existing deploy service account is required." >&2; exit 1; }
test -f "$APP/.env" || { echo "Production .env is missing." >&2; exit 1; }
test -x "$NODE" || { echo "Production Node binary is missing: $NODE" >&2; exit 1; }
test -x "$CONTROL_SOURCE" || { echo "Control helper is missing or not executable: $CONTROL_SOURCE" >&2; exit 1; }

install -o root -g root -m 0755 "$CONTROL_SOURCE" "$CONTROL_TARGET"
printf '%s\n' 'deploy ALL=(root) NOPASSWD: /usr/local/bin/communications-studio-systemd-control' > "$SUDOERS"
chmod 0440 "$SUDOERS"
/usr/sbin/visudo -cf "$SUDOERS"

install -d -o root -g root -m 0755 "$DROPIN_DIR"
cat > "$DROPIN" <<EOF
[Service]
ExecStart=
ExecStart=$NODE --import ./src/instrument.js $APP/src/server.js
EOF
chmod 0644 "$DROPIN"

/usr/sbin/runuser -u ray -- env HOME=/home/ray PATH="$PATH_NODE" "$NPM" --prefix "$APP" ci --omit=dev --no-audit --no-fund
/usr/sbin/runuser -u ray -- env HOME=/home/ray PATH="$PATH_NODE" "$NPM" --prefix "$APP" run check
/usr/sbin/runuser -u ray -- env HOME=/home/ray PATH="$PATH_NODE" "$NPM" --prefix "$APP" test

/usr/bin/systemctl daemon-reload
/usr/bin/systemctl restart "$SERVICE"
/usr/bin/sleep 3
"$CONTROL_TARGET" status

install -d -o deploy -g deploy -m 0755 /home/deploy
touch "$SENTINEL"
chown deploy:deploy "$SENTINEL"
chmod 0644 "$SENTINEL"

echo "Communications Studio production auto-deploy is enabled."
echo "control=$CONTROL_TARGET"
echo "sentinel=$SENTINEL"
