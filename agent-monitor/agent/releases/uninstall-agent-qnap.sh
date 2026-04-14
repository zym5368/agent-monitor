#!/bin/sh
set -eu
BASE='/share/CACHEDEV1_DATA/总经办/信息技术/agent'
CRON_FILE='/etc/config/crontab'
CRON_TAG='cluster-agent-autostart'
REMOVE_FILES='${1:-}'

if [ -x "$BASE/stop-agent.sh" ]; then
  "$BASE/stop-agent.sh" || true
fi

if grep -F "$CRON_TAG" "$CRON_FILE" >/dev/null 2>&1; then
  sed -i "/$CRON_TAG/d" "$CRON_FILE"
  crontab "$CRON_FILE"
  /etc/init.d/crond.sh restart
  echo "removed autostart cron entry"
else
  echo "autostart cron entry not found"
fi

if [ "$REMOVE_FILES" = "--purge" ]; then
  rm -f "$BASE/cluster-agent" "$BASE/start-agent.sh" "$BASE/stop-agent.sh" "$BASE/agent.pid"
  echo "purged runtime files"
  echo "log/doc kept: $BASE/agent.log, $BASE/cluster-agent-deploy.md"
fi

echo "uninstall done"