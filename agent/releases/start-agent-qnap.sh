#!/bin/sh
set -eu
BASE='/share/CACHEDEV1_DATA/总经办/信息技术/agent'
BIN="$BASE/cluster-agent"
PID_FILE="$BASE/agent.pid"
LOG_FILE="$BASE/agent.log"
ADDR_VALUE="${ADDR:-:9100}"
API_KEY_VALUE="${API_KEY:-}"

if [ ! -x "$BIN" ]; then
  echo "binary not found or not executable: $BIN"
  exit 1
fi

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "agent already running pid=$(cat "$PID_FILE")"
  exit 0
fi

cd "$BASE"
if [ -n "$API_KEY_VALUE" ]; then
  setsid env ADDR="$ADDR_VALUE" API_KEY="$API_KEY_VALUE" "$BIN" >> "$LOG_FILE" 2>&1 < /dev/null &
else
  setsid env ADDR="$ADDR_VALUE" "$BIN" >> "$LOG_FILE" 2>&1 < /dev/null &
fi

pid=$!
echo "$pid" > "$PID_FILE"
sleep 1
if kill -0 "$pid" 2>/dev/null; then
  echo "started pid=$pid"
else
  echo "failed to start, check $LOG_FILE"
  exit 2
fi