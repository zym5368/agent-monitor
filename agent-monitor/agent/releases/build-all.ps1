# 一键：Agent 全平台 + 客户端 dist / dist-mobile（可选 Release APK）
# 用法（在 agent 目录）:
#   .\releases\build-all.ps1
#   .\releases\build-all.ps1 -SkipApp           # 只编 Agent
#   .\releases\build-all.ps1 -SkipElectronWin   # 不打 NSIS（仅 dist + dist-mobile）
#   .\releases\build-all.ps1 -WithApk           # 额外打签名 Release APK（需 android、keystore 等）
# 要求: Go 1.21+；客户端需 Node.js + npm

param(
  [switch]$SkipApp,
  [switch]$WithApk,
  [switch]$SkipElectronWin
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $Root
$AppRoot = Join-Path $WorkspaceRoot 'app'

Push-Location $Root
try {
  $env:CGO_ENABLED = '0'

  $targets = @(
    @{ GOOS = 'windows'; GOARCH = 'amd64'; Out = 'cluster-agent-windows-amd64.exe' },
    @{ GOOS = 'windows'; GOARCH = 'arm64'; Out = 'cluster-agent-windows-arm64.exe' },
    @{ GOOS = 'linux';   GOARCH = 'amd64'; Out = 'cluster-agent-linux-amd64' },
    @{ GOOS = 'linux';   GOARCH = '386';   Out = 'cluster-agent-linux-386' },
    @{ GOOS = 'linux';   GOARCH = 'arm64'; Out = 'cluster-agent-linux-arm64' },
    @{ GOOS = 'linux';   GOARCH = 'arm';   Out = 'cluster-agent-linux-arm'; Env = @{ GOARM = '7' } },
    @{ GOOS = 'darwin';  GOARCH = 'amd64'; Out = 'cluster-agent-darwin-amd64' },
    @{ GOOS = 'darwin';  GOARCH = 'arm64'; Out = 'cluster-agent-darwin-arm64' }
  )

  foreach ($t in $targets) {
    Remove-Item Env:GOARM -ErrorAction SilentlyContinue
    $env:GOOS = $t.GOOS
    $env:GOARCH = $t.GOARCH
    if ($t.Env) {
      foreach ($k in $t.Env.Keys) { Set-Item -Path "env:$k" -Value $t.Env[$k] }
    }

    $dest = Join-Path $Out $t.Out
    Write-Host "==> GOOS=$($t.GOOS) GOARCH=$($t.GOARCH) -> $($t.Out)"
    go build -trimpath -ldflags "-s -w" -o $dest .

    if ($LASTEXITCODE -ne 0) { throw "build failed: $($t.Out)" }
  }

  Remove-Item Env:GOOS -ErrorAction SilentlyContinue
  Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
  Remove-Item Env:GOARM -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "[Agent] 完成。输出目录: $Out"
  Get-ChildItem $Out -File | Where-Object { $_.Name -like 'cluster-agent*' } | Format-Table Name, Length, LastWriteTime -AutoSize

  if (-not $SkipApp) {
    if (-not (Test-Path $AppRoot)) {
      Write-Warning "未找到客户端目录: $AppRoot，跳过 app 构建"
    } else {
      Write-Host ""
      Write-Host ">>> [App] npm run build:artifacts (dist + dist-mobile) ..."
      Push-Location $AppRoot
      try {
        if (-not (Test-Path (Join-Path $AppRoot 'node_modules'))) {
          npm install
        }
        npm run build:artifacts
        if ($LASTEXITCODE -ne 0) { throw "npm run build:artifacts failed" }
        Write-Host "[App] dist/ 与 dist-mobile/ 已更新"

        if (-not $SkipElectronWin) {
          Write-Host ""
          Write-Host ">>> [App] electron-builder --win (NSIS 安装包) ..."
          npm run build:electron-win
          if ($LASTEXITCODE -ne 0) { throw "npm run build:electron-win failed" }
          $rel = Join-Path $AppRoot 'electron-dist'
          Write-Host "[App] Windows 安装包目录: $rel"
        }

        if ($WithApk) {
          Write-Host ">>> [App] cap sync + assembleRelease ..."
          npx cap sync android
          if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }
          $androidDir = Join-Path $AppRoot 'android'
          $gradlew = Join-Path $androidDir 'gradlew.bat'
          if (Test-Path $gradlew) {
            Push-Location $androidDir
            try {
              & .\gradlew.bat assembleRelease --no-daemon
              if ($LASTEXITCODE -ne 0) { throw "gradlew assembleRelease failed" }
            } finally {
              Pop-Location
            }
            $apk = Join-Path $AppRoot 'android\app\build\outputs\apk\release\app-release.apk'
            Write-Host "[App] Release APK: $apk"
          } else {
            Write-Warning "未找到 gradlew.bat，跳过 APK"
          }
        }
      } finally {
        Pop-Location
      }
    }
  }
}
finally {
  Pop-Location
}
