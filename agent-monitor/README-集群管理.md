# 服务器集群管理（Windows 应用 + Agent）

## 结构

- **agent/**：Go 语言写的轻量 Agent，部署在每台服务器上，提供 `/health`、`/api/metrics`（资源指标）。后续可扩展 Docker 容器接口与 Dockge 探测。
- **app/**：Electron + React + TypeScript 桌面应用，用于多机监控、服务器配置、Dockge 内嵌打开。

## Agent（Go）

### 环境要求

- Go 1.21+

### 本地运行

```bash
cd agent-monitor/agent
go mod tidy
go run .
# 默认监听 :9100，无 API Key
# 设置环境变量：LISTEN_ADDR=:9100  API_KEY=your-secret
```

### 接口

- `GET /health`：健康检查，返回 `{"status":"ok"}`。
- `GET /api/metrics`：CPU、内存、磁盘使用率与用量（需配置 API_KEY 时请求头带 `X-API-Key`）。

### Linux 部署

```bash
GOOS=linux GOARCH=amd64 go build -o agent .
# 将 agent 拷贝到服务器，用 systemd 或 nohup 运行
```

## 桌面应用（Electron + React）

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装与运行

```bash
cd agent-monitor/app
npm install
# 仅前端开发
npm run dev
# Electron 开发（先起 vite，再起 electron）
npm run electron:dev
# 打包 Windows 安装包
npm run electron:build
```

### 功能

1. **服务器**：添加/删除服务器（Host、端口、API Key、Dockge URL），持久化到本地。
2. **仪表盘**：轮询各服务器 `/api/metrics`，展示 CPU、内存、磁盘。
3. **Dockge**：选择服务器后，在应用内嵌 `<webview>` 打开该机 Dockge 页面，可登录管理。
4. **容器管理**：占位页，待 Agent 提供 `/api/containers` 后接入。

## 使用流程

### 方式一：Netdata 数据源（推荐，若服务器已装 Netdata）

1. 确保每台服务器已安装并运行 Netdata（默认端口 19999）。
2. 在 Windows 应用「服务器」中选数据源 **Netdata API**，填写 **Netdata 地址**（如 `http://192.168.1.10:19999`）。
3. 本机**无需安装 Netdata**，应用直接请求各机的 `/api/v1/allmetrics?format=json`，在本地解析并展示。
4. 在「仪表盘」查看资源；在「Dockge」选择该机即可在应用内打开 Dockge 进行管理。

### 方式二：自建 Agent 数据源

1. 在每台需要管理的服务器上运行 Agent（可设置 `API_KEY` 保证安全）。
2. 在 Windows 应用「服务器」中选数据源 **自建 Agent**，填写 Host 与端口（如 `9100`）。
3. 在「仪表盘」查看资源；在「Dockge」选择该机即可在应用内打开 Dockge 进行管理。

### Windows 本机能否装 Netdata？

可以。Netdata 提供 Windows 版 MSI 安装包（[官方文档](https://learn.netdata.cloud/docs/netdata-agent/installation/windows)）。若你**只**用本机做「数据处理与展示」、数据来自其它已装 Netdata 的服务器，则本机**不必**安装 Netdata，应用直接拉取各服务器 Netdata API 即可。
