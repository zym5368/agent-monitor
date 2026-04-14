#!/bin/sh
set -eu
BASE='/share/backup/projects/cluster-agent'
BIN="$BASE/cluster-agent"
PID_FILE="$BASE/agent.pid"
LOG_FILE="$BASE/agent.log"
ADDR_VALUE="${ADDR:-:9100}"
API_KEY_VALUE="${API_KEY:-}"
DISK_PATHS_VALUE="${DISK_PATHS:-/share/CACHEDEV1_DATA,/share/backup}"

if [ ! -x "$BIN" ]; then
  echo "binary not found or not executable: $BIN"
  exit 1
fi
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "agent already running pid=$(cat \"$PID_FILE\")"
  exit 0
fi
cd "$BASE"
if [ -n "$API_KEY_VALUE" ]; then
  setsid env ADDR="$ADDR_VALUE" API_KEY="$API_KEY_VALUE" DISK_PATHS="$DISK_PATHS_VALUE" "$BIN" >> "$LOG_FILE" 2>&1 < /dev/null &
else
  setsid env ADDR="$ADDR_VALUE" DISK_PATHS="$DISK_PATHS_VALUE" "$BIN" >> "$LOG_FILE" 2>&1 < /dev/null &
fi
pid=$!
echo "$pid" > "$PID_FILE"
sleep 1
kill -0 "$pid" 2>/dev/null && echo "started pid=$pid"