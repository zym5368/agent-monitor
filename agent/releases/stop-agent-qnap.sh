#!/bin/sh
set -eu
BASE='/share/CACHEDEV1_DATA/总经办/信息技术/agent'
PID_FILE="$BASE/agent.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "pid file not found"
  exit 0
fi

pid=$(cat "$PID_FILE")
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid" || true
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" || true
  fi
  echo "stopped pid=$pid"
else
  echo "process not running"
fi
rm -f "$PID_FILE"