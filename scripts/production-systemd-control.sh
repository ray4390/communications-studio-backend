#!/usr/bin/env bash
set -euo pipefail

APP="/opt/communications-studio-backend"
SERVICE="communications-studio-backend.service"
REPO="ray4390/communications-studio-backend"
BRANCH="main"
RUN_USER="ray"
HOME_DIR="/home/ray"
NODE="/home/ray/.nvm/versions/node/v24.19.0/bin/node"
NPM="/home/ray/.nvm/versions/node/v24.19.0/bin/npm"
PATH_NODE="/home/ray/.nvm/versions/node/v24.19.0/bin:/usr/bin:/bin"
HEALTH_URL="http://127.0.0.1:8787/health"

runray() {
  /usr/sbin/runuser -u "$RUN_USER" -- env HOME="$HOME_DIR" PATH="$PATH_NODE" "$@"
}

verify_origin() {
  local origin
  origin="$(runray /usr/bin/git -C "$APP" remote get-url origin)"
  case "$origin" in
    "git@github.com:${REPO}.git"|"https://github.com/${REPO}.git"|"https://github.com/${REPO}") ;;
    *) echo "Refusing deployment: unexpected origin $origin" >&2; exit 3 ;;
  esac
}

health() {
  /usr/bin/systemctl is-active --quiet "$SERVICE" || return 1
  /usr/bin/curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" \
    | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const ok=j?.ok===true&&j?.service==="communications-studio-api"&&Array.isArray(j?.config_warnings)&&j.config_warnings.length===0;if(!ok){console.error(s);process.exit(1)}console.log(`health ok service=${j.service} warnings=0`)}catch(e){console.error(s);process.exit(1)}})'
}

status() {
  /usr/bin/systemctl is-active "$SERVICE"
  health
  local sha
  sha="$(runray /usr/bin/git -C "$APP" rev-parse HEAD)"
  echo "deployed_sha=$sha"
}

logs() {
  /usr/bin/journalctl -u "$SERVICE" -n 120 --no-pager
}

install_sha() {
  local sha="$1"
  runray /usr/bin/git -C "$APP" checkout -B production-deployed-main "$sha"
  runray "$NPM" --prefix "$APP" ci --omit=dev --no-audit --no-fund
  runray "$NPM" --prefix "$APP" run check
  runray "$NPM" --prefix "$APP" test
}

wait_stable() {
  local stable=0
  local attempt
  for attempt in $(seq 1 18); do
    /usr/bin/sleep 5
    if health; then
      stable=$((stable + 1))
    else
      stable=0
    fi
    if [ "$stable" -ge 8 ]; then
      echo "health_gate=passed consecutive_checks=$stable"
      return 0
    fi
  done
  echo "Health gate failed: service did not remain healthy for 40 consecutive seconds." >&2
  return 1
}

rollback_to() {
  local previous="$1"
  echo "Rolling back to $previous" >&2
  install_sha "$previous"
  /usr/bin/systemctl restart "$SERVICE"
  local healthy=0
  for _ in $(seq 1 12); do
    /usr/bin/sleep 5
    if health; then
      healthy=1
      break
    fi
  done
  if [ "$healthy" -ne 1 ]; then
    echo "Rollback completed on disk but the service did not recover." >&2
    logs >&2 || true
    return 1
  fi
  echo "rollback_sha=$previous"
}

deploy() {
  local sha="$1"
  [[ "$sha" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "Invalid deployment SHA" >&2; exit 2; }
  test -d "$APP/.git" || { echo "Production checkout missing: $APP" >&2; exit 2; }
  test -f "$APP/.env" || { echo "Production .env missing" >&2; exit 2; }
  if runray /usr/bin/git -C "$APP" ls-files --error-unmatch .env >/dev/null 2>&1; then
    echo "Refusing deployment: .env is tracked by Git" >&2
    exit 4
  fi
  verify_origin
  test -z "$(runray /usr/bin/git -C "$APP" status --porcelain --untracked-files=no)" || { echo "Refusing deployment: tracked production changes are present" >&2; exit 4; }

  local previous target
  previous="$(runray /usr/bin/git -C "$APP" rev-parse HEAD)"
  runray /usr/bin/git -C "$APP" fetch --prune origin "$BRANCH"
  target="$(runray /usr/bin/git -C "$APP" rev-parse "origin/$BRANCH")"
  test "$target" = "$sha" || { echo "Refusing deployment: requested SHA is not current origin/$BRANCH" >&2; exit 5; }

  echo "previous_sha=$previous"
  echo "target_sha=$sha"

  if ! install_sha "$sha"; then
    echo "Candidate installation or validation failed." >&2
    rollback_to "$previous" || true
    exit 1
  fi

  if ! /usr/bin/systemctl restart "$SERVICE"; then
    echo "systemd restart failed." >&2
    rollback_to "$previous" || true
    exit 1
  fi

  if ! wait_stable; then
    logs >&2 || true
    rollback_to "$previous" || true
    exit 1
  fi

  echo "deployed_sha=$sha"
}

case "${1:-}" in
  status)
    test "$#" -eq 1 || exit 2
    status
    ;;
  logs)
    test "$#" -eq 1 || exit 2
    logs
    ;;
  deploy)
    test "$#" -eq 2 || exit 2
    deploy "$2"
    ;;
  *)
    echo "Usage: $0 {status|logs|deploy <sha>}" >&2
    exit 2
    ;;
esac
