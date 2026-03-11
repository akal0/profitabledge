param(
  [string]$TaskName = "Profitabledge MT5 Supervisor"
)

$ErrorActionPreference = "Stop"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
Write-Host "[uninstall-autostart-task] removed '$TaskName'"
