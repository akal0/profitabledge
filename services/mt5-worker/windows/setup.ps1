param(
  [Parameter(Mandatory = $true)]
  [string]$ServerUrl,

  [Parameter(Mandatory = $true)]
  [string]$WorkerSecret,

  [Parameter(Mandatory = $true)]
  [string]$TerminalPath,

  [string]$TerminalPathMapJson = "",
  [string]$HostLabel = $env:COMPUTERNAME,
  [string]$HostEnvironment = "development",
  [string]$HostProvider = "self-hosted",
  [string]$HostRegion = "",
  [string]$HostCountry = "",
  [string]$HostTimezone = "",
  [string]$HostCity = "",
  [string]$HostPublicIpLabel = "",
  [string]$HostTags = "",
  [string]$HostCapabilities = "",
  [string]$HostRole = "shared",
  [string]$ReservedUserId = "",
  [string]$TraderId = "",
  [string]$TraderCountry = "",
  [string]$TraderTimezone = "",
  [string]$DeviceProfileId = "",

  [int]$Children = 2,
  [int]$PollSeconds = 30,
  [int]$HeartbeatSeconds = 5,
  [int]$HttpTimeoutSeconds = 30,
  [int]$HttpRetryCount = 4,
  [double]$HttpRetryBackoffSeconds = 1.5,
  [int]$HistoryOverlapSeconds = 90,
  [int]$HistoryFutureSeconds = 28800,
  [int]$TickReplaySeconds = 10,
  [int]$FullReconcileMinutes = 720,
  [int]$PostExitTrackingSeconds = 3600,
  [int]$ConnectedTimeoutSeconds = 20,
  [string]$WorkerId = $env:COMPUTERNAME,
  [string]$PythonLauncher = "py"
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
$venvPath = Join-Path $workerRoot ".venv"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
$envFile = Join-Path $workerRoot ".env.windows"

if (-not (Test-Path $TerminalPath)) {
  throw "MT5 terminal path does not exist: $TerminalPath"
}

function Add-EnvLine {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Name,
    [string]$Value
  )

  if ($null -ne $Value -and $Value.Trim() -ne "") {
    $Lines.Add("$Name=$Value")
  }
}

Write-Host "[setup] creating virtual environment at $venvPath"
& $PythonLauncher -m venv $venvPath

Write-Host "[setup] upgrading pip"
& $pythonExe -m pip install --upgrade pip

Write-Host "[setup] installing MetaTrader5"
& $pythonExe -m pip install MetaTrader5

$normalizedTags = @()
if ($HostTags.Trim()) {
  $normalizedTags += $HostTags.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}
if ($HostCapabilities.Trim()) {
  $normalizedTags += $HostCapabilities.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}
if ($ReservedUserId.Trim()) {
  $normalizedTags += "user:$ReservedUserId"
}
$normalizedTags = $normalizedTags | Select-Object -Unique

$envLines = New-Object "System.Collections.Generic.List[string]"
Add-EnvLine $envLines "PE_SERVER_URL" $ServerUrl
Add-EnvLine $envLines "BROKER_WORKER_SECRET" $WorkerSecret
Add-EnvLine $envLines "MT5_WORKER_MODE" "terminal"
Add-EnvLine $envLines "MT5_WORKER_ID" $WorkerId
Add-EnvLine $envLines "MT5_WORKER_LABEL" $HostLabel
Add-EnvLine $envLines "MT5_WORKER_ENVIRONMENT" $HostEnvironment
Add-EnvLine $envLines "MT5_WORKER_PROVIDER" $HostProvider
Add-EnvLine $envLines "MT5_WORKER_REGION" $HostRegion
Add-EnvLine $envLines "MT5_HOST_COUNTRY_CODE" $HostCountry
Add-EnvLine $envLines "MT5_HOST_TIMEZONE" $HostTimezone
Add-EnvLine $envLines "MT5_HOST_CITY" $HostCity
Add-EnvLine $envLines "MT5_HOST_PUBLIC_IP" $HostPublicIpLabel
Add-EnvLine $envLines "MT5_WORKER_TAGS" ($normalizedTags -join ",")
Add-EnvLine $envLines "MT5_WORKER_CAPABILITIES" $HostCapabilities
Add-EnvLine $envLines "MT5_WORKER_ROLE" $HostRole
Add-EnvLine $envLines "MT5_RESERVED_USER_ID" $ReservedUserId
Add-EnvLine $envLines "MT5_TRADER_ID" $TraderId
Add-EnvLine $envLines "MT5_TRADER_COUNTRY" $TraderCountry
Add-EnvLine $envLines "MT5_TRADER_TIMEZONE" $TraderTimezone
Add-EnvLine $envLines "MT5_DEVICE_PROFILE_ID" $DeviceProfileId
Add-EnvLine $envLines "MT5_TERMINAL_PATH" $TerminalPath
Add-EnvLine $envLines "MT5_TERMINAL_PATH_MAP" $TerminalPathMapJson
Add-EnvLine $envLines "MT5_POLL_SECONDS" "$PollSeconds"
Add-EnvLine $envLines "MT5_HEARTBEAT_SECONDS" "$HeartbeatSeconds"
Add-EnvLine $envLines "MT5_HTTP_TIMEOUT_SECONDS" "$HttpTimeoutSeconds"
Add-EnvLine $envLines "MT5_HTTP_RETRY_COUNT" "$HttpRetryCount"
Add-EnvLine $envLines "MT5_HTTP_RETRY_BACKOFF_SECONDS" "$HttpRetryBackoffSeconds"
Add-EnvLine $envLines "MT5_CONNECTED_TIMEOUT_SECONDS" "$ConnectedTimeoutSeconds"
Add-EnvLine $envLines "MT5_HISTORY_OVERLAP_SECONDS" "$HistoryOverlapSeconds"
Add-EnvLine $envLines "MT5_HISTORY_FUTURE_SECONDS" "$HistoryFutureSeconds"
Add-EnvLine $envLines "MT5_TICK_REPLAY_SECONDS" "$TickReplaySeconds"
Add-EnvLine $envLines "MT5_FULL_RECONCILE_MINUTES" "$FullReconcileMinutes"
Add-EnvLine $envLines "MT5_POST_EXIT_TRACKING_SECONDS" "$PostExitTrackingSeconds"
Add-EnvLine $envLines "MT5_SUPERVISOR_CHILDREN" "$Children"
Add-EnvLine $envLines "MT5_SUPERVISOR_REPORT_SECONDS" "5"

[System.IO.File]::WriteAllLines($envFile, $envLines.ToArray())

Write-Host ""
Write-Host "[setup] wrote worker environment to $envFile"
Write-Host "[setup] host profile:"
Write-Host "  role: $HostRole"
if ($HostCountry) { Write-Host "  country: $HostCountry" }
if ($HostRegion) { Write-Host "  region: $HostRegion" }
if ($HostTimezone) { Write-Host "  timezone: $HostTimezone" }
if ($HostPublicIpLabel) { Write-Host "  public-ip-label: $HostPublicIpLabel" }
if ($ReservedUserId) { Write-Host "  reserved-user-id: $ReservedUserId" }
if ($DeviceProfileId) { Write-Host "  device-profile: $DeviceProfileId" }
Write-Host "[setup] next:"
Write-Host "  1. Run windows\\run-supervisor.ps1 to start the MT5 worker"
Write-Host "  2. Or run windows\\run-connection.ps1 -ConnectionId <id> for a single-account smoke test"
Write-Host "  3. Optionally run windows\\install-autostart-task.ps1 for unattended startup on this host"
