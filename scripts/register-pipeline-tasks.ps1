$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content (Join-Path $root 'config/daily-pipeline.json') -Raw | ConvertFrom-Json
if ((Get-TimeZone).Id -ne 'China Standard Time') { throw 'These Windows triggers require the PC timezone Asia/Shanghai (China Standard Time).' }
$runner = Join-Path $PSScriptRoot 'run-local-pipeline.ps1'
$powershell = (Get-Command powershell.exe).Source
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10) -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
foreach ($stage in @('intake','editorial')) {
  $action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Stage $stage" -WorkingDirectory $root
  if ($stage -eq 'intake') {
    $name = 'Signal Intelligence Daily Intake'
    $time = '{0:00}:{1:00}' -f $config.intakeHour,$config.intakeMinute
    $trigger = New-ScheduledTaskTrigger -Daily -At $time
  } else {
    $name = 'Signal Intelligence Editorial Review'
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At ('{0:00}:00' -f $config.editorialHour)
  }
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description "Signal pipeline $stage; config/daily-pipeline.json is the shared policy. See logs/pipeline for receipts." -Force | Out-Null
  Write-Output "Registered $name"
}
