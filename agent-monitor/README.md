# Cluster Manager

集群管理项目（`app` + `agent`），用于统一管理多台服务器：

- 实时监控：CPU / 内存 / 磁盘
- 系统服务管理：启动/停止/重启/启用/禁用
- Docker 容器与镜像管理
- Dockge 内嵌访问
- 告警规则与多渠道通知
- 桌面端（Electron）+ 移动端（Android APK）

## 项目结构

- `agent/`：Go Agent，部署在目标主机，暴露 `/health`、`/api/metrics`、`/api/services`、`/api/containers` 等接口
- `app/`：Electron + React + TypeScript 客户端（含移动端构建）

## 快速开始

### 1) Agent

```bash
cd agent-monitor/agent
go mod tidy
go run .
```

默认监听 `:9100`。可选环境变量：

- `ADDR`：监听地址（默认 `:9100`）
- `API_KEY`：API 鉴权密钥
- `DOCKER_HOST`：Docker Socket 地址（QNAP 常用 `unix:///var/run/system-docker.sock`）
- `DISK_PATHS`：磁盘挂载点列表（逗号分隔，NAS 可用）

### 2) 客户端

```bash
cd agent-monitor/app
npm install
npm run electron:dev
```

## 构建

### Windows 客户端

```bash
cd agent-monitor/app
npm run build:artifacts
npx electron-builder --win --publish never
```

### Android APK

```bash
cd agent-monitor/app
npm run build:mobile
npx cap sync android
cd android
./gradlew assembleRelease
```

**签名说明（避免「Release 里 APK 装不上」）：**

- `android/keystore.properties` 与密钥库 **不会进 Git**（见 `android/.gitignore`）。
- 仅当存在 `keystore.properties` 时，`assembleRelease` 使用 **正式 release 签名**。
- **无该文件时**（含 GitHub Actions 默认环境）：`release` 使用 **debug 签名**，便于侧载安装；这与本地 Android Studio 里配好 keystore 打出来的包 **证书不同**，覆盖安装会冲突，需先卸载旧包。
- CI 在收集产物前会 **`apksigner verify`**，避免再发布未签名 APK。

## 发布下载

最新构建产物发布在 GitHub Releases：

- [agent-monitor Releases](https://github.com/zym5368/agent-monitor/releases)

## 备注

- NAS（QNAP）建议同时设置：
  - `DOCKER_HOST=unix:///var/run/system-docker.sock`
  - `DISK_PATHS=/share/CACHEDEV1_DATA,/share/CACHEDEV2_DATA`
- `DISK_PATHS` 生效后，`/api/metrics` 会返回 `disk_mounts`，客户端会显示挂载点明细。
