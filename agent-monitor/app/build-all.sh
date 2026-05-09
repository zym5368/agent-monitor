#!/bin/bash
set -e

echo "========================================"
echo "构建 agent-monitor 三个客户端"
echo "========================================"

cd "$(dirname "$0")"

echo ""
echo "[1/3] 构建 Web 版本..."
npm run build:web

echo ""
echo "[2/3] 构建 Mobile 版本..."
npm run build:mobile

echo ""
echo "[3/3] 构建 Electron Windows 版本..."
npm run build:electron-win

echo ""
echo "========================================"
echo "构建完成！"
echo "========================================"
echo "输出目录:"
echo "  Web:       dist/"
echo "  Mobile:    dist-mobile/"
echo "  Electron:  electron-dist/"
