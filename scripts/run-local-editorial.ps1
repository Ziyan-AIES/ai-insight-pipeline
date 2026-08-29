$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $root "logs"
$logPath = Join-Path $logDirectory "local-editorial.log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location $root

function Write-EditorialLogLine {
    param([string]$Message)
    $Message | Out-File -FilePath $logPath -Append -Encoding utf8
}

Write-EditorialLogLine "[$(Get-Date -Format o)] Starting local editorial review."

try {
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $env:EDITORIAL_BATCH_SIZE = "5"
    & $npm run editorial:drain 2>&1 | Out-File -FilePath $logPath -Append -Encoding utf8
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    Write-EditorialLogLine "[$(Get-Date -Format o)] Finished with exit code $exitCode."
    exit $exitCode
}
catch {
    Write-EditorialLogLine "[$(Get-Date -Format o)] Failed: $($_.Exception.Message)"
    exit 1
}
