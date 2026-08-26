param(
    [string] $ServerHost = "121.78.183.225",
    [string] $SshUser = "ubuntu",
    [string] $KeyPath = "C:\workspace\toolloop\SSH_KeyPair-260716092832.pem",
    [string] $RemoteDir = "~/haemi",
    [string] $Notes = "앱 업데이트"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Apk = Join-Path $RepoRoot "dist\haemi.apk"
$AppJson = Get-Content (Join-Path $RepoRoot "app.json") -Raw | ConvertFrom-Json
$Version = $AppJson.expo.version
$VersionCode = $AppJson.expo.android.versionCode

if (-not (Test-Path $Apk)) {
    throw "APK가 없습니다. 먼저 npm run apk 를 실행하세요: $Apk"
}

$VersionFile = Join-Path $env:TEMP "haemi-version.json"
$json = @"
{"version":"$Version","versionCode":$VersionCode,"notes":"$Notes"}
"@
[System.IO.File]::WriteAllText($VersionFile, $json.Trim() + "`n", [System.Text.UTF8Encoding]::new($false))

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
