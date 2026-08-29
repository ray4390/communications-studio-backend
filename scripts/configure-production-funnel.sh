#!/usr/bin/env bash
set -euo pipefail

backend='http://127.0.0.1:8787'

# Keep the historical dedicated API port and path working while making the
# bare production hostname a healthy backend endpoint instead of a dead proxy.
tailscale funnel --bg --https=10000 "$backend"
tailscale funnel --bg --https=443 "$backend"
tailscale funnel --bg --https=443 --set-path=/communications-studio-api "$backend"
tailscale funnel status
