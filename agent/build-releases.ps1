# 多平台编译 cluster-agent，输出到 releases/（与《Agent部署文档》中的文件名一致）
# 用法：在 agent 目录执行 .\build-releases.ps1
# 要求：已安装 Go，且当前目录为 agent（脚本会自动 cd 到自身所在目录）

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$out = Join-Path $root "releases"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$ldflags = "-s -w"
$env:CGO_ENABLED = "0"

Write-Host "Building cluster-agent -> $out" -ForegroundColor Cyan

# Windows amd64
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -ldflags $ldflags -o (Join-Path $out "cluster-agent-windows-amd64.exe") .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "  OK cluster-agent-windows-amd64.exe"

# Linux
$env:GOOS = "linux"
$linuxTargets = @(
    @{ GOARCH = "amd64"; Out = "cluster-agent-linux-amd64" },
    @{ GOARCH = "386";   Out = "cluster-agent-linux-386" },
    @{ GOARCH = "arm64"; Out = "cluster-agent-linux-arm64" },
    @{ GOARCH = "arm";   Out = "cluster-agent-linux-arm" }
)
foreach ($t in $linuxTargets) {
    $env:GOARCH = $t.GOARCH
    go build -ldflags $ldflags -o (Join-Path $out $t.Out) .
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "  OK $($t.Out)"
}

Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue

Write-Host "Done." -ForegroundColor Green
