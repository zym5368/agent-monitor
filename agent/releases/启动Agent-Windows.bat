@echo off
chcp 65001 >nul
echo ========================================
echo   Cluster Agent 启动脚本
echo ========================================
echo.

cd /d "%~dp0"

if not exist "cluster-agent-windows-amd64.exe" (
    echo [错误] 找不到 cluster-agent-windows-amd64.exe
    echo 请确保文件在同一目录下
    pause
    exit /b 1
)

echo [信息] 正在启动 Cluster Agent...
echo [信息] 监听端口: 9100
echo [信息] 按 Ctrl+C 停止
echo.

cluster-agent-windows-amd64.exe

pause
