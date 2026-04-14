# Cluster Agent 部署文档

## 支持的平台

| 平台 | 架构 | 二进制文件 |
|------|------|-----------|
| Windows | amd64 (x86_64) | `cluster-agent-windows-amd64.exe` |
| Debian/Ubuntu | amd64 (x86_64) | `cluster-agent-linux-amd64` |
| Debian/Ubuntu | i386 (x86) | `cluster-agent-linux-386` |
| QNAP NAS (x86) | amd64 | `cluster-agent-linux-amd64` |
| QNAP NAS (ARM) | arm64/arm | `cluster-agent-linux-arm64` 或 `cluster-agent-linux-arm` |
| OpenWrt x86 | amd64/i386 | `cluster-agent-linux-amd64` 或 `cluster-agent-linux-386` |

---

## 修改源码后：多平台重新编译

每次改完 `agent/` 下代码后，在 **`agent` 目录**执行其一即可生成上表所列全部二进制（输出到 `agent/releases/`）：

- **Windows（PowerShell）**：`.\build-releases.ps1`
- **Linux / macOS / Git Bash**：`chmod +x build-releases.sh && ./build-releases.sh`

脚本使用 `CGO_ENABLED=0` 与 `-ldflags "-s -w"`，与此前手动交叉编译方式一致。编译完成后将对应文件拷到各服务器覆盖旧二进制并重启服务即可。

---

## 一、Windows 系统部署

### 1. 快速启动
1. 将 `cluster-agent-windows-amd64.exe` 复制到任意目录
2. 双击运行即可
3. 默认监听端口：`9100`

### 2. 作为 Windows 服务开机自启（推荐）

#### 方法一：使用 NSSM（推荐）
1. 下载 [NSSM](https://nssm.cc/download)
2. 解压后，以管理员身份打开 cmd
3. 进入 nssm 目录，运行：
   ```cmd
   nssm install ClusterAgent
   ```
4. 在弹出的窗口中配置：
   - **Path**: 选择 `cluster-agent-windows-amd64.exe` 的完整路径
   - **Startup directory**: 选择 exe 所在目录
   - **Service name**: `ClusterAgent`
5. 点击 "Install service"
6. 启动服务：
   ```cmd
   nssm start ClusterAgent
   ```

#### 方法二：使用任务计划程序
1. 按 `Win+R`，输入 `taskschd.msc` 打开任务计划程序
2. 右侧点击 "创建基本任务"
3. 名称输入：`ClusterAgent`
4. 触发器选择："当计算机启动时"
5. 操作选择："启动程序"
6. 程序或脚本：选择 `cluster-agent-windows-amd64.exe`
7. 勾选 "不管用户是否登录都要运行"

### 3. 配置环境变量（可选）
- `ADDR`: 修改监听端口，例如 `:9101`
- `API_KEY`: 设置 API Key 认证

---

## 二、Debian / Ubuntu 系统部署

### 0. 一键安装脚本（推荐）
在 `agent/releases/` 目录使用：

```bash
# 不启用鉴权
sudo bash install-agent-linux.sh

# 启用 API_KEY（环境变量方式）
API_KEY='your_secure_key' sudo bash install-agent-linux.sh

# 启用 API_KEY（参数方式）
sudo bash install-agent-linux.sh 'your_secure_key'
```

### 1. 快速启动
```bash
# 上传文件到服务器
chmod +x cluster-agent-linux-amd64
./cluster-agent-linux-amd64
```

### 2. 使用 systemd 服务（推荐）

#### 创建服务文件
```bash
sudo nano /etc/systemd/system/cluster-agent.service
```

#### 粘贴以下内容：
```ini
[Unit]
Description=Cluster Management Agent
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cluster-agent
ExecStart=/opt/cluster-agent/cluster-agent-linux-amd64
Restart=always
RestartSec=5
Environment=ADDR=:9100
# Environment=API_KEY=your_secret_key_here

[Install]
WantedBy=multi-user.target
```

#### 启动服务
```bash
# 创建目录并移动文件
sudo mkdir -p /opt/cluster-agent
sudo mv cluster-agent-linux-amd64 /opt/cluster-agent/
sudo chmod +x /opt/cluster-agent/cluster-agent-linux-amd64

# 重载 systemd 并启动
sudo systemctl daemon-reload
sudo systemctl enable cluster-agent
sudo systemctl start cluster-agent

# 查看状态
sudo systemctl status cluster-agent

# 查看日志
sudo journalctl -u cluster-agent -f
```

### 3. 防火墙配置
```bash
# 如果使用 ufw
sudo ufw allow 9100/tcp

# 如果使用 iptables
sudo iptables -A INPUT -p tcp --dport 9100 -j ACCEPT
```

---

## 三、QNAP NAS 部署

### 1. 确定 NAS 架构
在 QNAP 控制台中：
- 控制台 → 系统 → 系统信息 → 总览
- 查看 "CPU 架构"

### 2. 上传并运行

#### 方法一：通过 SSH 运行（临时测试）
1. 启用 SSH：控制台 → 网络和文件服务 → Telnet/SSH → 启用 SSH
2. 使用 SSH 连接到 NAS
3. 上传对应架构的二进制文件（一般是 `cluster-agent-linux-arm64` 或 `cluster-agent-linux-amd64`）
4. 运行：
   ```bash
   chmod +x cluster-agent-linux-arm64
   ./cluster-agent-linux-arm64
   ```

#### 方法二：使用 Container Station（推荐）
如果 NAS 支持 Docker，建议使用 Docker 方式运行（更稳定）。

#### 方法三：创建开机启动脚本
1. 创建自动启动脚本：
   ```bash
   # 编辑 autorun.sh（根据 NAS 型号位置可能不同）
   sudo vi /share/CE_CACHEDEV1_DATA/.qpkg/autorun.sh
   ```
2. 添加内容：
   ```bash
   #!/bin/bash
   /share/CE_CACHEDEV1_DATA/cluster-agent/cluster-agent-linux-arm64 &
   ```
3. 设置权限：
   ```bash
   chmod +x /share/CE_CACHEDEV1_DATA/.qpkg/autorun.sh
   chmod +x /share/CE_CACHEDEV1_DATA/cluster-agent/cluster-agent-linux-arm64
   ```

### 3. 防火墙配置
- 控制台 → 网络和文件服务 → 网络安全 → 防火墙
- 添加规则：允许 TCP 端口 9100

---

## 四、OpenWrt (x86) 部署

### 0. 一键安装脚本（推荐）
在 `agent/releases/` 目录使用：

```sh
# 不启用鉴权
sh install-agent-openwrt.sh

# 启用 API_KEY（环境变量方式）
API_KEY='your_secure_key' sh install-agent-openwrt.sh

# 启用 API_KEY（参数方式）
sh install-agent-openwrt.sh 'your_secure_key'
```

### 1. 上传文件
使用 SCP 或 SFTP 上传二进制文件到 OpenWrt：
```bash
# 从本地上传
scp cluster-agent-linux-amd64 root@192.168.1.1:/usr/bin/cluster-agent
```

### 2. 设置权限并测试
```bash
ssh root@192.168.1.1
chmod +x /usr/bin/cluster-agent

# 测试运行
cluster-agent
```

### 3. 创建 OpenWrt 服务（推荐）

#### 创建 init 脚本
```bash
cat > /etc/init.d/cluster-agent << 'EOF'
#!/bin/sh /etc/rc.common

START=99
STOP=15

USE_PROCD=1
PROG=/usr/bin/cluster-agent

start_service() {
    procd_open_instance
    procd_set_param command "$PROG"
    procd_set_param env ADDR=:9100
    # procd_set_param env API_KEY=your_secret_key
    procd_set_param respawn
    procd_close_instance
}
EOF
```

#### 启用并启动服务
```bash
chmod +x /etc/init.d/cluster-agent
/etc/init.d/cluster-agent enable
/etc/init.d/cluster-agent start

# 查看状态
/etc/init.d/cluster-agent status

# 查看日志
logread -f | grep cluster-agent
```

### 4. 防火墙配置
```bash
# 编辑防火墙配置
vi /etc/config/firewall

# 添加以下规则
config rule
    option name 'Allow-Cluster-Agent'
    option src 'lan'
    option dest_port '9100'
    option proto 'tcp'
    option target 'ACCEPT'

# 重启防火墙
/etc/init.d/firewall restart
```

---

## 五、通用配置

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ADDR` | 监听地址和端口 | `:9100` |
| `API_KEY` | API 认证密钥（可选） | 未设置 |
| `DOCKER_HOST` | Docker API 连接地址（仅容器管理） | 自动使用 Docker 默认 |
| `DISK_PATHS` | 磁盘采集挂载点列表（逗号分隔） | 未设置（默认采集 `/`） |

### 使用 API Key 认证
1. 通过安装脚本设置（推荐）：
   ```bash
   # Debian / Ubuntu
   API_KEY='your_secure_password_here' sudo bash install-agent-linux.sh

   # OpenWrt
   API_KEY='your_secure_password_here' sh install-agent-openwrt.sh
   ```

2. 或手动设置环境变量：
   ```bash
   # Linux/macOS
   export API_KEY=your_secure_password_here
   
   # Windows
   set API_KEY=your_secure_password_here
   ```

3. 在前端添加服务器时，填写 API Key 字段

### 健康检查
访问 `http://<server-ip>:9100/health` 应该返回：
```json
{"status":"ok"}
```

### QNAP / Container Station 兼容说明
当 NAS 启用了 Container Station，但默认 Docker Socket 不在 `/var/run/docker.sock` 时，请在启动 Agent 前指定：

```bash
export DOCKER_HOST=unix:///var/run/system-docker.sock
```

如果使用启动脚本，建议在脚本中写为默认值（可被外部覆盖）：

```bash
DOCKER_HOST_VALUE="${DOCKER_HOST:-unix:///var/run/system-docker.sock}"
```

这样只影响该 NAS 节点，不会影响 Debian / OpenWrt / Windows 等其它 Agent。

QNAP 如需按挂载点采集磁盘（例如 `CACHEDEV1_DATA`、`CACHEDEV2_DATA`）：

```bash
export DISK_PATHS=/share/CACHEDEV1_DATA,/share/CACHEDEV2_DATA
```

设置后 `/api/metrics` 会额外返回 `disk_mounts`，并将 `disk_*` 聚合为这些挂载点的总量。

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/metrics` | GET | 获取系统指标 |
| `/api/containers` | GET | 获取 Docker 容器列表 |
| `/api/containers/:id/start` | POST | 启动容器 |
| `/api/containers/:id/stop` | POST | 停止容器 |
| `/api/containers/:id/restart` | POST | 重启容器 |
| `/api/containers/:id/logs` | GET | 获取容器日志 |
| `/api/containers/:id` | DELETE | 删除容器 |
| `/api/system/info` | GET | 获取系统信息 |

---

## 六、故障排查

### Agent 无法启动
1. 检查端口是否被占用：
   ```bash
   # Linux
   netstat -tlnp | grep 9100
   
   # Windows
   netstat -ano | findstr :9100
   ```

2. 查看日志输出（前台运行时）

3. 确认二进制文件权限正确（Linux）：
   ```bash
   chmod +x cluster-agent-linux-amd64
   ```

### 前端无法连接
1. 检查防火墙设置
2. 确认 Agent 正在运行
3. 测试 API：
   ```bash
   curl http://<server-ip>:9100/health
   ```
   如果启用了 API Key，再测试：
   ```bash
   curl -H "X-API-Key: <your_api_key>" http://<server-ip>:9100/api/services
   ```
4. 检查浏览器控制台是否有 CORS 错误（确认使用了带 CORS 支持的 Agent 版本）

### 无法获取 Docker 容器信息
1. 确认 Docker 已安装并运行
2. 确认有访问 Docker 的权限（Linux 下可能需要 root 用户）

---

## 七、卸载

### Windows
1. 如果使用 NSSM：
   ```cmd
   nssm stop ClusterAgent
   nssm remove ClusterAgent confirm
   ```
2. 删除二进制文件

### Linux (systemd)
```bash
sudo systemctl stop cluster-agent
sudo systemctl disable cluster-agent
sudo rm /etc/systemd/system/cluster-agent.service
sudo systemctl daemon-reload
sudo rm -rf /opt/cluster-agent
```

### OpenWrt
```bash
/etc/init.d/cluster-agent stop
/etc/init.d/cluster-agent disable
rm /etc/init.d/cluster-agent
rm /usr/bin/cluster-agent
```
