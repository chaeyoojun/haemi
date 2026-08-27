param(
    [string] $ServerHost = "121.78.183.225",
    [string] $SshUser = "ubuntu",
    [string] $KeyPath = "C:\workspace\toolloop\SSH_KeyPair-260716092832.pem",
    [string] $RemoteDir = "~/haemi"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $RepoRoot ".env"

if (-not (Test-Path $KeyPath)) {
    throw "PEM 파일을 찾을 수 없습니다: $KeyPath"
}

if (-not (Test-Path $EnvFile)) {
    $password = -join ((1..32) | ForEach-Object { Get-Random -InputObject ([char[]]"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789") })
    Set-Content -Path $EnvFile -Value "POSTGRES_PASSWORD=$password" -NoNewline
    Write-Host "created .env with POSTGRES_PASSWORD"
}

$Archive = Join-Path $env:TEMP "haemi-deploy.tgz"
if (Test-Path $Archive) { Remove-Item $Archive -Force }

Push-Location $RepoRoot
try {
    & tar.exe -czf $Archive `
        --exclude=node_modules `
        --exclude=.git `
        --exclude=android `
        --exclude=ios `
        --exclude=dist `
        --exclude=.expo `
        -C $RepoRoot `
        docker-compose.yml .env server deploy releases
}
finally {
    Pop-Location
}

$sshBase = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new")
$sshTarget = "${SshUser}@${ServerHost}"

& ssh.exe @sshBase $sshTarget "mkdir -p $RemoteDir"
if ($LASTEXITCODE -ne 0) { throw "SSH mkdir failed" }

& scp.exe @sshBase $Archive "${sshTarget}:${RemoteDir}/deploy.tgz"
if ($LASTEXITCODE -ne 0) { throw "SCP failed" }

$remote = @"
set -e
cd $RemoteDir
if [ -f .env ]; then cp .env .env.keep; fi
tar -xzf deploy.tgz
rm -f deploy.tgz
if [ -f .env.keep ]; then mv .env.keep .env; fi
sed -i 's/\r$//' deploy/install-nginx.sh 2>/dev/null || true
docker compose up -d --build
cp deploy/haemi-api.location.conf /tmp/haemi-api.location.conf
bash deploy/install-nginx.sh
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -fsS http://127.0.0.1:4400/health; then
    exit 0
  fi
  sleep 2
done
echo "API health check failed"
docker compose logs --tail=40 api || true
exit 1
"@
$remote = $remote -replace "`r", ""

& ssh.exe @sshBase $sshTarget $remote
if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }

Remove-Item $Archive -Force -ErrorAction SilentlyContinue
Write-Host "deployed. API: https://if.io.kr/haemi-api/health"
