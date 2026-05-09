@echo off
setlocal enabledelayedexpansion

echo ========================================
echo 构建 agent-monitor 三个客户端
echo ========================================

cd /d "%~dp0"

echo.
echo [1/3] 构建 Web 版本...
call npm run build:web
if errorlevel 1 (
    echo Web 构建失败！
    exit /b 1
)

echo.
echo [2/3] 构建 Mobile 版本...
call npm run build:mobile
if errorlevel 1 (
    echo Mobile 构建失败！
    exit /b 1
)

echo.
echo [3/3] 构建 Electron Windows 版本...
call npm run build:electron-win
if errorlevel 1 (
    echo Electron 构建失败！
    exit /b 1
)

echo.
echo ========================================
echo 构建完成！
echo ========================================
echo 输出目录:
echo   Web:       dist/
echo   Mobile:    dist-mobile/
echo   Electron:  electron-dist/
echo.

endlocal
