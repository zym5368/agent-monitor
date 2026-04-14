# Cluster Agent 在 NAS 的部署记录

更新时间: 2026-04-14

## 部署目录
- `/share/CACHEDEV1_DATA/总经办/信息技术/agent`

## 已部署文件
- 二进制: `/share/CACHEDEV1_DATA/总经办/信息技术/agent/cluster-agent`
- 启动脚本: `/share/CACHEDEV1_DATA/总经办/信息技术/agent/start-agent.sh`
- 停止脚本: `/share/CACHEDEV1_DATA/总经办/信息技术/agent/stop-agent.sh`
- 日志文件: `/share/CACHEDEV1_DATA/总经办/信息技术/agent/agent.log`
- PID 文件: `/share/CACHEDEV1_DATA/总经办/信息技术/agent/agent.pid`

## 运行配置
- 监听地址: `ADDR=:9100`
- 健康检查: `GET http://127.0.0.1:9100/health`
- API_KEY: 当前未在启动脚本中固定写死，可在执行启动脚本时通过环境变量传入。
- Docker Socket（QNAP Container Station）:
  - 默认通过启动脚本注入 `DOCKER_HOST=unix:///var/run/system-docker.sock`
  - 用于修复 `/api/containers` 与 `/api/docker/overview` 无法连接默认 `/var/run/docker.sock` 的问题
- 磁盘挂载点（NAS 专用）:
  - 启动脚本可注入 `DISK_PATHS=/share/CACHEDEV1_DATA,/share/CACHEDEV2_DATA`
  - Agent 将按挂载点采集并在 `/api/metrics` 返回 `disk_mounts`，同时聚合到 `disk_used_bytes/disk_total_bytes`

## 开机自启动配置
已写入系统计划任务文件:
- 文件: `/etc/config/crontab`
- 条目:
  `@reboot /share/CACHEDEV1_DATA/总经办/信息技术/agent/start-agent.sh >/dev/null 2>&1 # cluster-agent-autostart`

应用方式:
- `crontab /etc/config/crontab`
- `/etc/init.d/crond.sh restart`

## 运维命令
### 启动
```sh
/share/CACHEDEV1_DATA/总经办/信息技术/agent/start-agent.sh
```

### 停止
```sh
/share/CACHEDEV1_DATA/总经办/信息技术/agent/stop-agent.sh
```

### 查看进程
```sh
ps -ef | grep '/share/CACHEDEV1_DATA/总经办/信息技术/agent/cluster-agent' | grep -v grep
```

### 查看日志
```sh
tail -f /share/CACHEDEV1_DATA/总经办/信息技术/agent/agent.log
```

### 健康检查
```sh
curl -sS http://127.0.0.1:9100/health
```

### 容器接口检查（QNAP）
```sh
curl -sS http://127.0.0.1:9100/api/docker/overview
curl -sS http://127.0.0.1:9100/api/containers
```

## 变更清单（本次）
1. 本地编译 `cluster-agent` Linux amd64 版本并上传到 NAS。
2. 创建部署目录 `/share/CACHEDEV1_DATA/总经办/信息技术/agent`。
3. 创建并验证 `start-agent.sh`、`stop-agent.sh`。
4. 启动服务并验证健康检查返回 `{"status":"ok"}`。
5. 配置开机自启 cron 条目（`cluster-agent-autostart`）。
6. 启动脚本补充 `DOCKER_HOST=unix:///var/run/system-docker.sock`，已验证容器管理 API 恢复可用。

## 回滚说明
- 取消开机自启: 从 `/etc/config/crontab` 删除 `cluster-agent-autostart` 行后，执行:
  - `crontab /etc/config/crontab`
  - `/etc/init.d/crond.sh restart`
- 停止服务:
  - `/share/CACHEDEV1_DATA/总经办/信息技术/agent/stop-agent.sh`
## 卸载
提供脚本：`uninstall-agent.sh`

```sh
# 仅停服务 + 删除开机自启（保留程序与文档）
/share/CACHEDEV1_DATA/总经办/信息技术/agent/uninstall-agent.sh

# 停服务 + 删除开机自启 + 删除运行文件
/share/CACHEDEV1_DATA/总经办/信息技术/agent/uninstall-agent.sh --purge
```
