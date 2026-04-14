#!/bin/bash
# Cluster Agent Linux 安装脚本
# 适用于: Debian, Ubuntu, 等 systemd 系统

set -e

echo "========================================"
echo "   Cluster Agent 安装脚本"
echo "========================================"
echo ""

# API Key（可通过环境变量或首个参数传入）
# 用法:
#   API_KEY=xxx sudo bash install-agent-linux.sh
#   sudo bash install-agent-linux.sh xxx
API_KEY_INPUT="${API_KEY:-$1}"

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
    echo "请使用 root 权限运行此脚本"
    echo "使用: sudo $0"
    exit 1
fi

# 检测架构
ARCH=$(uname -m)
echo "[信息] 检测到架构: $ARCH"

# 选择对应二进制文件
if [ "$ARCH" = "x86_64" ]; then
    BINARY="cluster-agent-linux-amd64"
elif [ "$ARCH" = "i686" ] || [ "$ARCH" = "i386" ]; then
    BINARY="cluster-agent-linux-386"
elif [ "$ARCH" = "aarch64" ]; then
    BINARY="cluster-agent-linux-arm64"
elif [[ "$ARCH" = "arm"* ]]; then
    BINARY="cluster-agent-linux-arm"
else
    echo "[错误] 不支持的架构: $ARCH"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY_PATH="$SCRIPT_DIR/$BINARY"

if [ ! -f "$BINARY_PATH" ]; then
    echo "[错误] 找不到二进制文件: $BINARY_PATH"
    echo "请确保文件在同一目录下"
    exit 1
fi

echo "[信息] 使用二进制文件: $BINARY"

# 创建安装目录
INSTALL_DIR="/opt/cluster-agent"
echo "[信息] 安装目录: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# 复制二进制文件
cp "$BINARY_PATH" "$INSTALL_DIR/cluster-agent"
chmod +x "$INSTALL_DIR/cluster-agent"
echo "[信息] 二进制文件已复制"

# 创建 systemd 服务文件
SERVICE_FILE="/etc/systemd/system/cluster-agent.service"
echo "[信息] 创建 systemd 服务: $SERVICE_FILE"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Cluster Management Agent
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cluster-agent
ExecStart=/opt/cluster-agent/cluster-agent
Restart=always
RestartSec=5
Environment=ADDR=:9100
$(if [ -n "$API_KEY_INPUT" ]; then echo "Environment=API_KEY=$API_KEY_INPUT"; else echo "# Environment=API_KEY=your_secret_key_here"; fi)

[Install]
WantedBy=multi-user.target
EOF

# 重载 systemd 并启动服务
echo "[信息] 重载 systemd 配置..."
systemctl daemon-reload

echo "[信息] 启用开机自启..."
systemctl enable cluster-agent

echo "[信息] 启动服务..."
systemctl start cluster-agent

# 等待一下让服务启动
sleep 2

# 检查状态
echo ""
echo "========================================"
if systemctl is-active --quiet cluster-agent; then
    echo "   安装成功!"
    echo ""
    echo "服务状态: $(systemctl status cluster-agent | grep Active)"
    echo ""
    echo "常用命令:"
    echo "  查看状态: sudo systemctl status cluster-agent"
    echo "  查看日志: sudo journalctl -u cluster-agent -f"
    echo "  停止服务: sudo systemctl stop cluster-agent"
    echo "  启动服务: sudo systemctl start cluster-agent"
    echo "  重启服务: sudo systemctl restart cluster-agent"
    echo ""
    echo "API 健康检查: curl http://localhost:9100/health"
    if [ -n "$API_KEY_INPUT" ]; then
        echo "API 鉴权: 已启用"
        echo "请求示例: curl -H \"X-API-Key: $API_KEY_INPUT\" http://localhost:9100/api/services"
    else
        echo "API 鉴权: 未启用（建议配置 API_KEY）"
    fi
else
    echo "   服务启动失败!"
    echo "请查看日志: sudo journalctl -u cluster-agent -n 50"
fi
echo "========================================"
