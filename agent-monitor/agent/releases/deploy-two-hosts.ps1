# 在「已设置密码」的 PowerShell 中执行，或先把密码写入用户级环境变量 / pwfile。
# OpenWrt: 192.168.113.205  Debian: 192.168.113.58
# 用法:
#   $env:AGENT_SSH_PASSWORD = '你的root密码'
#   .\deploy-two-hosts.ps1
# 或先持久化（供 Cursor Agent 读取）:
#   [Environment]::SetEnvironmentVariable('AGENT_SSH_PASSWORD', $env:AGENT_SSH_PASSWORD, 'User')

$ErrorActionPreference = 'Stop'

$OpenWrt = '192.168.113.205'
$Debian = '192.168.113.58'
$HostKey205 = 'ssh-ed25519 255 SHA256:PhepoY2Hixw8xP2KL/4J5xWwtNxKUAOlw0EITt/baaE'
$HostKey58 = 'ssh-ed25519 255 SHA256:iptRzpWQ1XHuZ4pDxvp8rKmJcdWE9v3klOBpN3co0+M'

function Get-PuttyExe {
  param([string]$Name)
  $c = Get-Command $Name -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in @('D:\software\putty', 'C:\Program Files\PuTTY')) {
    $f = Join-Path $p "$Name.exe"
    if (Test-Path $f) { return $f }
  }
  throw "未找到 $Name.exe，请安装 PuTTY 或加入 PATH"
}

$plink = Get-PuttyExe 'plink'
$pscp = Get-PuttyExe 'pscp'

$pw = $env:AGENT_SSH_PASSWORD
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('AGENT_SSH_PASSWORD', 'User') }
$pwFile = Join-Path $env:USERPROFILE '.cluster-agent-ssh'
if (-not $pw -and (Test-Path $pwFile)) {
  $pw = (Get-Content -LiteralPath $pwFile -Raw).TrimEnd("`r", "`n")
}
if (-not $pw) {
  throw @"
未找到 SSH 密码。任选其一:
  1) 本窗口: `$env:AGENT_SSH_PASSWORD = '密码'  再执行本脚本
  2) 用户级: [Environment]::SetEnvironmentVariable('AGENT_SSH_PASSWORD','密码','User')
  3) 文件: Set-Content -LiteralPath `"$pwFile`" -Value '密码' -NoNewline -Encoding utf8
"@
}

$bin = Join-Path $PSScriptRoot 'cluster-agent-linux-amd64'
if (-not (Test-Path $bin)) {
  $agentDir = Split-Path $PSScriptRoot -Parent
  Push-Location $agentDir
  try {
    $env:GOOS = 'linux'
    $env:GOARCH = 'amd64'
    $env:CGO_ENABLED = '0'
    go build -trimpath -ldflags "-s -w" -o (Join-Path $PSScriptRoot 'cluster-agent-linux-amd64') .
  } finally {
    Remove-Item Env:GOOS -ErrorAction SilentlyContinue
    Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
    Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
    Pop-Location
  }
}

$tmpPw = [IO.Path]::GetTempFileName()
try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [IO.File]::WriteAllText($tmpPw, $pw, $utf8NoBom)

  Write-Host ">>> 上传 -> $OpenWrt (OpenWrt) ..."
  & $pscp -scp -batch -hostkey $HostKey205 -pwfile $tmpPw $bin "root@${OpenWrt}:/tmp/cluster-agent-new"

  Write-Host ">>> 安装重启 $OpenWrt ..."
  $cmd205 = 'test -f /tmp/cluster-agent-new && cp /usr/bin/cluster-agent /usr/bin/cluster-agent.bak.cursor 2>/dev/null; install -m 755 /tmp/cluster-agent-new /usr/bin/cluster-agent && /etc/init.d/cluster-agent restart && sleep 2 && pgrep -x cluster-agent >/dev/null && echo OK_OPENWRT'
  & $plink -batch -ssh -hostkey $HostKey205 -pwfile $tmpPw "root@${OpenWrt}" $cmd205

  Write-Host ">>> 上传 -> $Debian ..."
  & $pscp -scp -batch -hostkey $HostKey58 -pwfile $tmpPw $bin "root@${Debian}:/tmp/cluster-agent-new"

  Write-Host ">>> 安装重启 $Debian ..."
  $cmd58 = 'test -f /tmp/cluster-agent-new && systemctl stop cluster-agent 2>/dev/null; mkdir -p /opt/cluster-agent; cp /opt/cluster-agent/cluster-agent /opt/cluster-agent/cluster-agent.bak.cursor 2>/dev/null; install -m 755 /tmp/cluster-agent-new /opt/cluster-agent/cluster-agent; systemctl daemon-reload 2>/dev/null; systemctl enable cluster-agent 2>/dev/null; systemctl start cluster-agent; sleep 2; systemctl is-active --quiet cluster-agent && echo OK_DEBIAN'
  & $plink -batch -ssh -hostkey $HostKey58 -pwfile $tmpPw "root@${Debian}" $cmd58

  Write-Host ">>> 两台均已更新完成。"
} finally {
  Remove-Item -LiteralPath $tmpPw -Force -ErrorAction SilentlyContinue
}

$url = [Environment]::GetEnvironmentVariable('SERVERCHAN_PUSH_URL', 'User')
if (-not $url) { $url = $env:SERVERCHAN_PUSH_URL }
if ($url) {
  $desp = "OpenWrt $OpenWrt : 已覆盖 /usr/bin/cluster-agent 并已 /etc/init.d/cluster-agent restart`n" +
    "Debian $Debian : 已覆盖 /opt/cluster-agent/cluster-agent 并已 systemctl start cluster-agent`n" +
    '本地二进制: cluster-agent-linux-amd64'
  $body = @{
    title = 'Cursor：Agent 双机更新完成'
    desp  = $desp
    tags  = 'cursor通知'
  } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Uri $url -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8'
    Write-Host ">>> Server酱 已发送。"
  } catch {
    Write-Warning "Server酱 发送失败: $_"
  }
}
