#!/usr/bin/env bash
# 一键：Agent 全平台 + 可选客户端 dist/dist-mobile（可选 Android APK）
# 用法（在 agent 仓库根目录）:
#   bash releases/build-all.sh
#   SKIP_APP=1 bash releases/build-all.sh     # 只编 Agent
#   WITH_APK=1 bash releases/build-all.sh     # 额外 assembleRelease（需 app/android、JDK、签名配置）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$(cd "$ROOT/.." && pwd)"
APP="$WORKSPACE/app"

cd "$ROOT"
export CGO_ENABLED=0

build_one() {
  local goos="$1" goarch="$2" outfile="$3"
  echo "==> GOOS=$goos GOARCH=$goarch -> $outfile"
  GOOS="$goos" GOARCH="$goarch" go build -trimpath -ldflags "-s -w" -o "$OUT/$outfile" .
}

build_one windows amd64 cluster-agent-windows-amd64.exe
build_one windows arm64 cluster-agent-windows-arm64.exe
build_one linux   amd64 cluster-agent-linux-amd64
build_one linux   386   cluster-agent-linux-386
build_one linux   arm64 cluster-agent-linux-arm64
echo "==> GOOS=linux GOARCH=arm GOARM=7 -> cluster-agent-linux-arm"
GOOS=linux GOARCH=arm GOARM=7 go build -trimpath -ldflags "-s -w" -o "$OUT/cluster-agent-linux-arm" .
build_one darwin  amd64 cluster-agent-darwin-amd64
build_one darwin  arm64 cluster-agent-darwin-arm64

echo ""
echo "[Agent] 完成。输出目录: $OUT"
ls -la "$OUT"/cluster-agent-* 2>/dev/null || true

if [ "${SKIP_APP:-0}" != "1" ]; then
  if [ ! -d "$APP" ]; then
    echo "[警告] 未找到客户端目录: $APP，跳过 app 构建"
  else
    echo ""
    echo ">>> [App] npm run build:artifacts (dist + dist-mobile) ..."
    if [ ! -d "$APP/node_modules" ]; then
      (cd "$APP" && npm install)
    fi
    (cd "$APP" && npm run build:artifacts)
    echo "[App] dist/ 与 dist-mobile/ 已更新"

    if [ "${SKIP_ELECTRON_WIN:-0}" != "1" ]; then
      case "$(uname -s 2>/dev/null || echo unknown)" in
        MINGW*|MSYS*|CYGWIN*|Windows_NT*)
          echo ""
          echo ">>> [App] electron-builder --win (NSIS) ..."
          (cd "$APP" && npm run build:electron-win)
          echo "[App] Windows 安装包目录: $APP/electron-dist"
          ;;
        *)
          if [ "${WITH_ELECTRON_WIN:-0}" = "1" ]; then
            echo ""
            echo ">>> [App] electron-builder --win (强制，非 Windows 可能失败) ..."
            (cd "$APP" && npm run build:electron-win) || true
          else
            echo "[提示] 当前非 Windows shell，已跳过 NSIS。要打安装包请在 Windows 执行 build-all.ps1，或 WITH_ELECTRON_WIN=1 bash releases/build-all.sh"
          fi
          ;;
      esac
    fi

    if [ "${WITH_APK:-0}" = "1" ]; then
      echo ">>> [App] cap sync + assembleRelease ..."
      (cd "$APP" && npx cap sync android)
      if [ -x "$APP/android/gradlew" ]; then
        (cd "$APP/android" && ./gradlew assembleRelease --no-daemon)
        echo "[App] Release APK: $APP/android/app/build/outputs/apk/release/app-release.apk"
      else
        echo "[警告] 未找到可执行的 android/gradlew，跳过 APK"
      fi
    fi
  fi
fi
