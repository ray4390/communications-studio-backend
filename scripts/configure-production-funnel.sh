#!/usr/bin/env bash
set -euo pipefail

backend='http://127.0.0.1:8787'

# Keep the dedicated API port and compatibility path on the OptiPlex.
# Do not replace the bare HTTPS root because it is reserved for BlueMap/Minecraft.
tailscale funnel --bg --https=10000 "$backend"
tailscale funnel --bg --https=443 --set-path=/communications-studio-api "$backend"
tailscale funnel status
