$ErrorActionPreference = "Stop"

$taskName = "Signal Intelligence Editorial Review"
$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot "run-local-editorial.ps1"
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source

$action = New-ScheduledTaskAction `
    -Execute $powershell `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" `
    -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday `
    -At 6:00PM

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Reviews pending Signal Intelligence news with the local Cursor agent and syncs results to Supabase." `
    -Force | Out-Null

$task = Get-ScheduledTask -TaskName $taskName
Write-Output "Registered '$($task.TaskName)' for weekdays at 18:00 local time."
