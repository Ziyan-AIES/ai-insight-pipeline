$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $root "logs"
$logPath = Join-Path $logDirectory "local-editorial.log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location $root

"[$(Get-Date -Format o)] Starting local editorial review." | Add-Content $logPath

try {
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    & $npm run editorial:local *>> $logPath
    $exitCode = $LASTEXITCODE
    "[$(Get-Date -Format o)] Finished with exit code $exitCode." | Add-Content $logPath
    exit $exitCode
}
catch {
    "[$(Get-Date -Format o)] Failed: $($_.Exception.Message)" | Add-Content $logPath
    exit 1
}
