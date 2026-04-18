# One-click install/start cluster-agent as Windows auto-start service.
# Usage examples:
#   powershell -ExecutionPolicy Bypass -File .\install-agent-windows-service.ps1
#   powershell -ExecutionPolicy Bypass -File .\install-agent-windows-service.ps1 -ApiKey "your-key" -Addr ":9100"
#   powershell -ExecutionPolicy Bypass -File .\install-agent-windows-service.ps1 -DiskPaths "C:\,D:\" -DockerHost "npipe:////./pipe/docker_engine"

param(
  [string]$ServiceName = "ClusterAgent",
  [string]$DisplayName = "Cluster Agent",
  [string]$Description = "Cluster monitoring agent service",
  [string]$InstallDir = "C:\ProgramData\ClusterAgent",
  [string]$ExeSource = "",
  [string]$Addr = ":9100",
  [string]$ApiKey = "",
  [string]$DiskPaths = "",
  [string]$DockerHost = "",
  [switch]$ForceReplace
)

# 若未传 -ApiKey，则使用环境变量 CLUSTER_AGENT_API_KEY（推荐：由 .bat set 后继承，避免密钥含 -- 等在命令行被误解析）
if ([string]::IsNullOrWhiteSpace($ApiKey) -and $env:CLUSTER_AGENT_API_KEY) {
  $ApiKey = $env:CLUSTER_AGENT_API_KEY
}

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "请以管理员身份运行 PowerShell。"
  }
}

function Resolve-ExeSource([string]$GivenPath) {
  if (-not [string]::IsNullOrWhiteSpace($GivenPath)) {
    if (Test-Path -LiteralPath $GivenPath) { return (Resolve-Path -LiteralPath $GivenPath).Path }
    throw "指定 ExeSource 不存在: $GivenPath"
  }

  $candidates = @(
    (Join-Path $PSScriptRoot "cluster-agent-windows-amd64.exe"),
    (Join-Path (Split-Path -Parent $PSScriptRoot) "cluster-agent-windows-amd64.exe"),
    (Join-Path (Split-Path -Parent $PSScriptRoot) "cluster-agent.exe"),
    (Join-Path (Get-Location) "cluster-agent.exe")
  )

  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) {
      return (Resolve-Path -LiteralPath $p).Path
    }
  }

  throw "未找到 agent 可执行文件。请用 -ExeSource 指定 cluster-agent.exe 路径。"
}

Assert-Admin

$sourceExe = Resolve-ExeSource -GivenPath $ExeSource

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
$targetExe = Join-Path $InstallDir "cluster-agent.exe"

if ((Test-Path -LiteralPath $targetExe) -and (-not $ForceReplace)) {
  Write-Host "[Info] 已存在 $targetExe，默认覆盖更新。"
}
Copy-Item -LiteralPath $sourceExe -Destination $targetExe -Force

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
  Write-Host "[Info] 创建服务 $ServiceName ..."
  $binPath = "`"$targetExe`""
  sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= "`"$DisplayName`"" | Out-Null
} else {
  Write-Host "[Info] 服务已存在，更新启动路径与启动类型..."
  if ($service.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  }
  $binPath = "`"$targetExe`""
  sc.exe config $ServiceName binPath= $binPath start= auto DisplayName= "`"$DisplayName`"" | Out-Null
}

sc.exe description $ServiceName "$Description" | Out-Null

$envList = New-Object System.Collections.Generic.List[string]
if (-not [string]::IsNullOrWhiteSpace($Addr)) { $envList.Add("ADDR=$Addr") }
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) { $envList.Add("API_KEY=$ApiKey") }
if (-not [string]::IsNullOrWhiteSpace($DiskPaths)) { $envList.Add("DISK_PATHS=$DiskPaths") }
if (-not [string]::IsNullOrWhiteSpace($DockerHost)) { $envList.Add("DOCKER_HOST=$DockerHost") }

$svcReg = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName"
if ($envList.Count -gt 0) {
  New-ItemProperty -Path $svcReg -Name "Environment" -PropertyType MultiString -Value $envList.ToArray() -Force | Out-Null
  Write-Host "[Info] 已写入服务环境变量: $($envList -join ', ')"
} else {
  Remove-ItemProperty -Path $svcReg -Name "Environment" -ErrorAction SilentlyContinue
}

Write-Host "[Info] 启动服务..."
Start-Service -Name $ServiceName
Start-Sleep -Seconds 1

$final = Get-Service -Name $ServiceName
Write-Host ""
Write-Host "安装完成"
Write-Host "ServiceName : $ServiceName"
Write-Host "Status      : $($final.Status)"
Write-Host "InstallExe  : $targetExe"
Write-Host "Addr        : $Addr"
Write-Host "AutoStart   : enabled"
Write-Host ""
Write-Host "健康检查示例: http://127.0.0.1$Addr/health"
