param([ValidateSet('intake','editorial')][string]$Stage = 'intake')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path (Join-Path $root 'logs/pipeline') | Out-Null
$logPath = Join-Path $root "logs/pipeline/$Stage.log"
"[$(Get-Date -Format o)] Starting $Stage" | Out-File $logPath -Append -Encoding utf8
$ErrorActionPreference = 'Continue'
& node --import ./scripts/local-network.mjs ./scripts/run-daily-pipeline.mjs "--stage=$Stage" 2>&1 | Out-File $logPath -Append -Encoding utf8
$result = $LASTEXITCODE
"[$(Get-Date -Format o)] Exit $result" | Out-File $logPath -Append -Encoding utf8
exit $result
