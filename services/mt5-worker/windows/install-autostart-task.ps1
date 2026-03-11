param(
  [string]$TaskName = "Profitabledge MT5 Supervisor",
  [string]$EnvFile,
  [string]$UserName = $env:USERNAME,
  [switch]$StartNow
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path

if (-not $EnvFile) {
  $EnvFile = Join-Path $workerRoot ".env.windows"
}

if (-not (Test-Path $EnvFile)) {
  throw "Environment file not found at $EnvFile. Run windows\\setup.ps1 first."
}

$runScript = Join-Path $scriptRoot "run-supervisor.ps1"
$actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$runScript`" -EnvFile `"$EnvFile`""

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserName
$principal = New-ScheduledTaskPrincipal -UserId $UserName -RunLevel Highest -LogonType Interactive
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

Write-Host "[install-autostart-task] registered '$TaskName' for user '$UserName'"
Write-Host "[install-autostart-task] it will start the MT5 supervisor when that user logs in"

if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "[install-autostart-task] started '$TaskName'"
}
