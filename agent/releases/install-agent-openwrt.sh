#!/bin/sh
# Cluster Agent OpenWrt 安装脚本
# 适用于: OpenWrt x86 系统

echo "========================================"
echo "   Cluster Agent OpenWrt 安装脚本"
echo "========================================"
echo ""

# API Key（可通过环境变量或首个参数传入）
# 用法:
#   API_KEY=xxx sh install-agent-openwrt.sh
#   sh install-agent-openwrt.sh xxx
API_KEY_INPUT="${API_KEY:-$1}"

# 检查是否为 root
if [ "$(id -u)" != "0" ]; then
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
else
    echo "[错误] 不支持的架构: $ARCH"
    echo "此脚本仅用于 x86 架构的 OpenWrt"
    exit 1
fi

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
BINARY_PATH="$SCRIPT_DIR/$BINARY"

if [ ! -f "$BINARY_PATH" ]; then
    echo "[错误] 找不到二进制文件: $BINARY_PATH"
    echo "请确保文件在同一目录下"
    exit 1
fi

echo "[信息] 使用二进制文件: $BINARY"

# 复制二进制文件
INSTALL_PATH="/usr/bin/cluster-agent"
echo "[信息] 安装到: $INSTALL_PATH"
cp "$BINARY_PATH" "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"
echo "[信息] 二进制文件已安装"

# 创建 init 脚本
INIT_SCRIPT="/etc/init.d/cluster-agent"
echo "[信息] 创建服务脚本: $INIT_SCRIPT"

cat > "$INIT_SCRIPT" << EOF
#!/bin/sh /etc/rc.common

START=99
STOP=15

USE_PROCD=1
PROG=/usr/bin/cluster-agent

start_service() {
    procd_open_instance
    procd_set_param command "$PROG"
    procd_set_param env ADDR=:9100
$(if [ -n "$API_KEY_INPUT" ]; then echo "    procd_set_param env API_KEY=$API_KEY_INPUT"; else echo "    # procd_set_param env API_KEY=your_secret_key"; fi)
    procd_set_param respawn
    procd_close_instance
}
EOF

chmod +x "$INIT_SCRIPT"

# 启用并启动服务
echo "[信息] 启用开机自启..."
"$INIT_SCRIPT" enable

echo "[信息] 启动服务..."
"$INIT_SCRIPT" start

# 等待一下让服务启动
sleep 2

# 检查状态
echo ""
echo "========================================"
if "$INIT_SCRIPT" status | grep -q "running"; then
    echo "   安装成功!"
    echo ""
    echo "服务状态: 运行中"
    echo ""
    echo "常用命令:"
    echo "  查看状态: /etc/init.d/cluster-agent status"
    echo "  查看日志: logread -f | grep cluster-agent"
    echo "  停止服务: /etc/init.d/cluster-agent stop"
    echo "  启动服务: /etc/init.d/cluster-agent start"
    echo "  重启服务: /etc/init.d/cluster-agent restart"
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
    echo "请查看日志: logread | grep cluster-agent"
fi
echo "========================================"
