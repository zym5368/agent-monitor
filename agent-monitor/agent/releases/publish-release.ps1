# Publish GitHub release with template and assets.
# Usage (run in agent directory):
#   .\releases\publish-release.ps1 -Tag "v0.1.2"
#   .\releases\publish-release.ps1 -Tag "v0.1.2" -DryRun
#   .\releases\publish-release.ps1 -Tag "v0.1.2" -Change1 "xxx" -Change2 "yyy" -Change3 "zzz"

param(
  [Parameter(Mandatory = $true)]
  [string]$Tag,
  [string]$ReleaseName = "",
  [string]$TemplatePath = "",
  [string]$EnvPath = "C:\Users\zym53\.cursor\secrets\github.env",
  [string]$Change1 = "Please fill change 1",
  [string]$Change2 = "Please fill change 2",
  [string]$Change3 = "Please fill change 3",
  [string]$KnownIssue = "None.",
  [string]$UpgradeNote1 = "Windows setup version can be installed over old version.",
  [string]$UpgradeNote2 = "Allow unknown sources before installing Android APK.",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Load-EnvFile([string]$Path) {
  if (!(Test-Path $Path)) { throw "Credential file not found: $Path" }
  Get-Content $Path | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
    $k, $v = $_ -split "=", 2
    if ([string]::IsNullOrWhiteSpace($k) -or [string]::IsNullOrWhiteSpace($v)) { return }
    [System.Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), "Process")
  }
}

function Build-BodyFromTemplate([string]$Tpl, [hashtable]$Map) {
  $body = $Tpl
  foreach ($key in $Map.Keys) {
    $body = $body.Replace($key, $Map[$key])
  }
  return $body
}

function Remove-TemplateExampleSection([string]$Body) {
  $splitToken = "<!-- EXAMPLE_START -->"
  $idx = $Body.IndexOf($splitToken)
  if ($idx -ge 0) {
    return $Body.Substring(0, $idx).Trim()
  }
  return $Body.Trim()
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentDir = Split-Path -Parent $scriptDir
$workspaceRoot = Split-Path -Parent $agentDir
$appDir = Join-Path $workspaceRoot "app"

if ([string]::IsNullOrWhiteSpace($TemplatePath)) {
  $TemplatePath = Join-Path $workspaceRoot "RELEASE_TEMPLATE.md"
}
if ([string]::IsNullOrWhiteSpace($ReleaseName)) {
  $ReleaseName = "Cluster Manager $Tag"
}

$assets = @(
  @{ Name = "cluster-manager-setup-win-x64.exe"; Path = (Join-Path $appDir "release-assets\cluster-manager-setup-win-x64.exe"); ContentType = "application/vnd.microsoft.portable-executable" },
  @{ Name = "cluster-manager-portable-win-x64.exe"; Path = (Join-Path $appDir "release-assets\cluster-manager-portable-win-x64.exe"); ContentType = "application/vnd.microsoft.portable-executable" },
  @{ Name = "cluster-manager-android-release.apk"; Path = (Join-Path $appDir "release-assets\cluster-manager-android-release.apk"); ContentType = "application/vnd.android.package-archive" }
)

Write-Host "[1/5] Loading local credentials..."
Load-EnvFile -Path $EnvPath
if (-not $env:GITHUB_TOKEN -or -not $env:GITHUB_OWNER -or -not $env:GITHUB_REPO) {
  throw "Missing required env vars: GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO"
}

Write-Host "[2/5] Reading template and generating release body..."
if (!(Test-Path $TemplatePath)) { throw "Template file not found: $TemplatePath" }
$tpl = Get-Content -Raw -Encoding UTF8 $TemplatePath
$body = Build-BodyFromTemplate -Tpl $tpl -Map @{
  "{{VERSION}}" = $Tag.TrimStart("v")
  "{{CHANGE_1}}" = $Change1
  "{{CHANGE_2}}" = $Change2
  "{{CHANGE_3}}" = $Change3
  "{{KNOWN_ISSUE_1_OR_NONE}}" = $KnownIssue
  "{{UPGRADE_NOTE_1}}" = $UpgradeNote1
  "{{UPGRADE_NOTE_2}}" = $UpgradeNote2
}
$body = Remove-TemplateExampleSection -Body $body

Write-Host "[3/5] Validating assets..."
foreach ($a in $assets) {
  if (!(Test-Path $a.Path)) { throw "Asset missing: $($a.Path)" }
  $f = Get-Item $a.Path
  Write-Host ("  - {0} ({1} bytes)" -f $a.Name, $f.Length)
}

$repo = "$($env:GITHUB_OWNER)/$($env:GITHUB_REPO)"
$apiHeaders = @{
  Authorization = "Bearer $($env:GITHUB_TOKEN)"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "cursor-release-publisher"
}

if ($DryRun) {
  Write-Host "[4/5] DryRun: skip GitHub write operations"
  Write-Host "Repo: $repo"
  Write-Host "Tag : $Tag"
  Write-Host "Name: $ReleaseName"
  Write-Host ""
  Write-Host "==== Release Body Preview ===="
  Write-Host $body
  exit 0
}

Write-Host "[4/5] Creating or loading release..."
$release = $null
try {
  $release = Invoke-RestMethod -Headers $apiHeaders -Uri "https://api.github.com/repos/$repo/releases/tags/$Tag" -Method Get
  Write-Host "  - Existing release: $($release.id)"
} catch {
  $createPayload = @{
    tag_name = $Tag
    target_commitish = "main"
    name = $ReleaseName
    draft = $false
    prerelease = $false
    body = $body
  } | ConvertTo-Json -Depth 6
  $release = Invoke-RestMethod -Headers $apiHeaders -Uri "https://api.github.com/repos/$repo/releases" -Method Post -ContentType "application/json; charset=utf-8" -Body $createPayload
  Write-Host "  - Created release: $($release.id)"
}

# Patch every time to keep title/body in sync.
$patchPayload = @{
  name = $ReleaseName
  body = $body
} | ConvertTo-Json -Depth 4
$release = Invoke-RestMethod -Headers $apiHeaders -Uri "https://api.github.com/repos/$repo/releases/$($release.id)" -Method Patch -ContentType "application/json; charset=utf-8" -Body $patchPayload

Write-Host "[5/5] Uploading assets..."
$existingAssets = Invoke-RestMethod -Headers $apiHeaders -Uri "https://api.github.com/repos/$repo/releases/$($release.id)/assets" -Method Get
foreach ($a in $assets) {
  $hit = $existingAssets | Where-Object { $_.name -eq $a.Name }
  if ($null -ne $hit) {
    Invoke-RestMethod -Headers $apiHeaders -Uri "https://api.github.com/repos/$repo/releases/assets/$($hit.id)" -Method Delete
    Write-Host "  - Deleted old asset: $($a.Name)"
  }
}

$uploadBase = ("$($release.upload_url)").Replace("{?name,label}", "")
foreach ($a in $assets) {
  $uploadUrl = $uploadBase + "?name=" + [uri]::EscapeDataString($a.Name)
  $uploadHeaders = @{
    Authorization = "Bearer $($env:GITHUB_TOKEN)"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent" = "cursor-release-publisher"
    "Content-Type" = $a.ContentType
  }
  $resp = Invoke-RestMethod -Headers $uploadHeaders -Uri $uploadUrl -Method Post -InFile $a.Path
  Write-Host "  - Uploaded: $($resp.name)"
}

Write-Host ""
Write-Host "Release done:"
Write-Host "https://github.com/$repo/releases/tag/$Tag"
