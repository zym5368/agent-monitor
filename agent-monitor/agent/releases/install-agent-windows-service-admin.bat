@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Cluster Agent 服务安装

REM 请右键本文件 →「以管理员身份运行」。双击普通运行会因无管理员权限而失败。

cd /d "%~dp0"
set "LOG=%~dp0install-agent-last-run.log"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [错误] 当前不是管理员权限。
  echo 请关闭本窗口，对 install-agent-windows-service-admin.bat 右键 → 以管理员身份运行。
  echo.
  pause
  exit /b 1
)

if exist "%~dp0agent-install.local.bat" (
  call "%~dp0agent-install.local.bat"
)

if not defined CLUSTER_AGENT_ADDR set "CLUSTER_AGENT_ADDR=:9100"
if not defined CLUSTER_AGENT_API_KEY set "CLUSTER_AGENT_API_KEY="
if not defined CLUSTER_AGENT_DISK_PATHS set "CLUSTER_AGENT_DISK_PATHS="
if not defined CLUSTER_AGENT_DOCKER_HOST set "CLUSTER_AGENT_DOCKER_HOST="

set "PS1=%~dp0install-agent-windows-service.ps1"
if not exist "%PS1%" (
  echo [错误] 找不到 install-agent-windows-service.ps1，请与本 bat 放在同一目录。
  pause
  exit /b 1
)

echo 工作目录: %CD%
echo 日志文件: %LOG%
echo.
echo 正在执行安装脚本...
echo === 开始 %date% %time% === >> "%LOG%"

REM ApiKey 仅通过环境变量 CLUSTER_AGENT_API_KEY 传给 PowerShell（不在命令行上出现，避免特殊字符问题）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Addr "%CLUSTER_AGENT_ADDR%" -DiskPaths "%CLUSTER_AGENT_DISK_PATHS%" -DockerHost "%CLUSTER_AGENT_DOCKER_HOST%" >> "%LOG%" 2>&1

set "ERR=%ERRORLEVEL%"
echo. >> "%LOG%"
echo === 结束 退出码 %ERR% %date% %time% === >> "%LOG%"

type "%LOG%"
echo.
if not "%ERR%"=="0" (
  echo [失败] 退出码 %ERR%，请根据上方输出排查。
) else (
  echo [成功] 若服务已启动，可在 服务.msc 中查看 ClusterAgent。
)
echo.
pause
exit /b %ERR%
