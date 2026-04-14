Cluster Agent 二进制文件
========================

一键编译 Agent + 客户端（在 agent 仓库根目录执行）
------------------------------------------------
  Windows:
    powershell -ExecutionPolicy Bypass -File .\releases\build-all.ps1
    仅 Agent:           -SkipApp
    跳过 Windows 安装包: -SkipElectronWin
    顺带 APK:            -WithApk（需 Android SDK、keystore 等）
    Windows 客户端产出: app/electron-dist/（便携 .exe + NSIS 安装包；输出目录避免与旧 release/ 文件锁冲突）
    若 electron-builder 报「无法创建符号链接」: 打开 Windows「开发者模式」或以管理员运行，
    或保持 package.json 中 win.signAndEditExecutable=false（已默认关闭，避免拉取 winCodeSign）

  Linux/macOS:
    bash releases/build-all.sh
    仅 Agent:  SKIP_APP=1 bash releases/build-all.sh
    跳过 NSIS: SKIP_ELECTRON_WIN=1 bash releases/build-all.sh
    非 Windows 强打 NSIS: WITH_ELECTRON_WIN=1（常失败，建议用 Windows）
    顺带 APK:  WITH_APK=1 bash releases/build-all.sh

要求:
  - Go 1.21+（CGO_ENABLED=0）
  - 客户端: Node.js + npm；build:artifacts（移动+Web dist）；Windows 上默认再打 npm run build:electron-win（NSIS）
  - 上级目录需为同一工作区，且存在 ../app（集群管理前端）

文件说明
--------
cluster-agent-windows-amd64.exe
  - Windows x64，配合 "启动Agent-Windows.bat"

cluster-agent-windows-arm64.exe
  - Windows ARM64（如部分 Surface / WoA）

cluster-agent-linux-amd64
  - Linux x64 (Debian, Ubuntu, QNAP x86, OpenWrt x86_64)
  - 配合 "install-agent-linux.sh" / "install-agent-openwrt.sh"

cluster-agent-linux-386
  - Linux x86 32 位 (OpenWrt x86 32)

cluster-agent-linux-arm64
  - Linux ARM64 (QNAP ARM, 树莓派 4 等)

cluster-agent-linux-arm
  - Linux ARMv7 32 位（GOARM=7，常见树莓派等）

cluster-agent-darwin-amd64
  - macOS Intel

cluster-agent-darwin-arm64
  - macOS Apple Silicon

安装脚本
--------
启动Agent-Windows.bat
  - Windows 快速启动脚本

install-agent-linux.sh
  - Linux (Debian/Ubuntu) 自动安装脚本 (配置 systemd 服务)
  - 使用: sudo bash install-agent-linux.sh

install-agent-openwrt.sh
  - OpenWrt 自动安装脚本
  - 使用: sh install-agent-openwrt.sh

完整文档
--------
详细部署说明请查看上级目录的 "Agent部署文档.md"

快速测试
--------
启动 Agent 后，测试是否正常运行:
  curl http://localhost:9100/health

应该返回: {"status":"ok"}
