#!/usr/bin/env bash
# 多平台编译 cluster-agent，输出到 releases/
# 用法：cd agent-monitor/agent && chmod +x build-releases.sh && ./build-releases.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
OUT="$ROOT/releases"
mkdir -p "$OUT"

LDFLAGS="-s -w"
export CGO_ENABLED=0

echo "Building cluster-agent -> $OUT"

GOOS=windows GOARCH=amd64 go build -ldflags "$LDFLAGS" -o "$OUT/cluster-agent-windows-amd64.exe" .
echo "  OK cluster-agent-windows-amd64.exe"

build_linux() {
  local arch="$1"
  local name="$2"
  GOOS=linux GOARCH="$arch" go build -ldflags "$LDFLAGS" -o "$OUT/$name" .
  echo "  OK $name"
}

build_linux amd64 cluster-agent-linux-amd64
build_linux 386 cluster-agent-linux-386
build_linux arm64 cluster-agent-linux-arm64
build_linux arm cluster-agent-linux-arm

echo "Done."
