#!/bin/sh
set -eu
BASE='/share/backup/projects/cluster-agent'
PID_FILE="$BASE/agent.pid"
if [ ! -f "$PID_FILE" ]; then
  echo "pid file not found"
  exit 0
fi
pid=$(cat "$PID_FILE")
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid" || true
  sleep 1
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" || true
  echo "stopped pid=$pid"
else
  echo "process not running"
fi
rm -f "$PID_FILE"