param(
    [string] $ServerHost = "121.78.183.225",
    [string] $SshUser = "ubuntu",
    [string] $KeyPath = "C:\workspace\toolloop\SSH_KeyPair-260716092832.pem",
    [string] $RemoteDir = "~/haemi"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WebDir = Join-Path $RepoRoot "web-dist"

if (-not (Test-Path (Join-Path $WebDir "index.html"))) {
    throw "웹 빌드가 없습니다. 먼저 npm run web:export 를 실행하세요: $WebDir"
}

$Archive = Join-Path $env:TEMP "haemi-web.tgz"
if (Test-Path $Archive) { Remove-Item $Archive -Force }

Push-Location $RepoRoot
try {
    & tar.exe -czf $Archive -C $WebDir .
}
finally {
    Pop-Location
}

$sshBase = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new")
$sshTarget = "${SshUser}@${ServerHost}"

& ssh.exe @sshBase $sshTarget "mkdir -p $RemoteDir/deploy /tmp/haemi-web"
if ($LASTEXITCODE -ne 0) { throw "SSH mkdir failed" }

& scp.exe @sshBase $Archive "${sshTarget}:/tmp/haemi-web.tgz"
if ($LASTEXITCODE -ne 0) { throw "SCP web archive failed" }

& scp.exe @sshBase (Join-Path $RepoRoot "deploy\haemi-web.conf") "${sshTarget}:/tmp/haemi-web.conf"
if ($LASTEXITCODE -ne 0) { throw "SCP nginx conf failed" }

& scp.exe @sshBase (Join-Path $RepoRoot "deploy\install-web-nginx.sh") "${sshTarget}:${RemoteDir}/deploy/install-web-nginx.sh"
if ($LASTEXITCODE -ne 0) { throw "SCP install script failed" }

$remote = @"
set -e
sudo mkdir -p /var/www/haemi-web
sudo rm -rf /var/www/haemi-web/*
sudo tar -xzf /tmp/haemi-web.tgz -C /var/www/haemi-web
rm -f /tmp/haemi-web.tgz
sudo chown -R www-data:www-data /var/www/haemi-web
sed -i 's/\r$//' $RemoteDir/deploy/install-web-nginx.sh
bash $RemoteDir/deploy/install-web-nginx.sh
"@
$remote = $remote -replace "`r", ""

& ssh.exe @sshBase $sshTarget $remote
if ($LASTEXITCODE -ne 0) { throw "remote web deploy failed" }

Remove-Item $Archive -Force -ErrorAction SilentlyContinue
Write-Host "deployed. Web: https://hm.if.io.kr"
