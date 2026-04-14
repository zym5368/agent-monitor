#!/bin/sh
set -eu
CRON_FILE='/etc/config/crontab'
LINE='@reboot /share/backup/projects/cluster-agent/start-agent.sh >/dev/null 2>&1 # cluster-agent-autostart'
if ! grep -F 'cluster-agent-autostart' "$CRON_FILE" >/dev/null 2>&1; then
  echo "$LINE" >> "$CRON_FILE"
fi
crontab "$CRON_FILE"
/etc/init.d/crond.sh restart