param(
    [string] $ServerHost = "121.78.183.225",
    [string] $SshUser = "ubuntu",
    [string] $KeyPath = "C:\workspace\toolloop\SSH_KeyPair-260716092832.pem",
    [string] $RemoteDir = "~/haemi",
    [string] $Notes = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Apk = Join-Path $RepoRoot "dist\haemi.apk"

if (-not (Test-Path $Apk)) {
    throw "APK가 없습니다. 먼저 npm run apk 를 실행하세요: $Apk"
}

$VersionFile = Join-Path $env:TEMP "haemi-version.json"
$writeArgs = @((Join-Path $RepoRoot "scripts\write-version.cjs"), "--out", $VersionFile)
if ($Notes) {
    $writeArgs += @("--notes", $Notes)
}
& node.exe @writeArgs
if ($LASTEXITCODE -ne 0) { throw "version.json write failed" }
$Meta = Get-Content $VersionFile -Encoding UTF8 -Raw | ConvertFrom-Json
$Version = $Meta.version
$VersionCode = $Meta.versionCode

$sshBase = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new")
$sshTarget = "${SshUser}@${ServerHost}"

& ssh.exe @sshBase $sshTarget "mkdir -p $RemoteDir/releases"
if ($LASTEXITCODE -ne 0) { throw "SSH mkdir failed" }

& scp.exe @sshBase $Apk "${sshTarget}:${RemoteDir}/releases/hmfpv.apk"
if ($LASTEXITCODE -ne 0) { throw "SCP apk failed" }

& scp.exe @sshBase $VersionFile "${sshTarget}:${RemoteDir}/releases/version.json"
if ($LASTEXITCODE -ne 0) { throw "SCP version failed" }

Remove-Item $VersionFile -Force -ErrorAction SilentlyContinue
Write-Host "published $Version ($VersionCode) to https://if.io.kr/haemi-api/api/app/version"
