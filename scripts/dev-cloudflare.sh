#!/usr/bin/env bash
set -euo pipefail

TUNNEL_URL="${TUNNEL_URL:-http://localhost:5173}"
DEV_HOST="${DEV_HOST:-0.0.0.0}"
LOG_FILE="$(mktemp -t cloudflared-dev-log.XXXXXX)"
CLOUDFLARED_PID=""
TAIL_PID=""

cleanup() {
	if [[ -n "$TAIL_PID" ]] && kill -0 "$TAIL_PID" 2>/dev/null; then
		kill "$TAIL_PID" 2>/dev/null || true
	fi

	if [[ -n "$CLOUDFLARED_PID" ]] && kill -0 "$CLOUDFLARED_PID" 2>/dev/null; then
		kill "$CLOUDFLARED_PID" 2>/dev/null || true
	fi

	rm -f "$LOG_FILE"
}
trap cleanup EXIT INT TERM

cloudflared tunnel --url "$TUNNEL_URL" >"$LOG_FILE" 2>&1 &
CLOUDFLARED_PID="$!"

tail -n +1 -f "$LOG_FILE" &
TAIL_PID="$!"

CLOUDFLARE_HOST_NAME=""
for _ in $(seq 1 240); do
	if ! kill -0 "$CLOUDFLARED_PID" 2>/dev/null; then
		echo "cloudflared exited before publishing a hostname" >&2
		wait "$CLOUDFLARED_PID" || true
		exit 1
	fi

	CLOUDFLARE_HOST_NAME="$({ grep -oE 'https://[[:alnum:].-]+\.trycloudflare\.com' "$LOG_FILE" || true; } | sed 's#https://##' | tail -n 1)"
	if [[ -n "$CLOUDFLARE_HOST_NAME" ]]; then
		break
	fi

	sleep 0.25
done

if [[ -z "$CLOUDFLARE_HOST_NAME" ]]; then
	echo "Timed out waiting for cloudflared hostname" >&2
	exit 1
fi

export CLOUDFLARE_HOST_NAME
CLOUDFLARE_TUNNEL_URL="https://$CLOUDFLARE_HOST_NAME"

echo

echo "Cloudflare URL: $CLOUDFLARE_TUNNEL_URL"
echo "CLOUDFLARE_HOST_NAME=$CLOUDFLARE_HOST_NAME"
echo "Starting Vite with allowed host..."
echo

pnpm dev --host "$DEV_HOST"
