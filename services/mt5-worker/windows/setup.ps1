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
  [string]$HostTags = "",

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

Write-Host "[setup] creating virtual environment at $venvPath"
& $PythonLauncher -m venv $venvPath

Write-Host "[setup] upgrading pip"
& $pythonExe -m pip install --upgrade pip

Write-Host "[setup] installing MetaTrader5"
& $pythonExe -m pip install MetaTrader5

$envLines = @(
  "PE_SERVER_URL=$ServerUrl",
  "BROKER_WORKER_SECRET=$WorkerSecret",
  "MT5_WORKER_MODE=terminal",
  "MT5_WORKER_ID=$WorkerId",
  "MT5_WORKER_LABEL=$HostLabel",
  "MT5_WORKER_ENVIRONMENT=$HostEnvironment",
  "MT5_WORKER_PROVIDER=$HostProvider",
  "MT5_WORKER_REGION=$HostRegion",
  "MT5_WORKER_TAGS=$HostTags",
  "MT5_TERMINAL_PATH=$TerminalPath",
  "MT5_TERMINAL_PATH_MAP=$TerminalPathMapJson",
  "MT5_POLL_SECONDS=$PollSeconds",
  "MT5_HEARTBEAT_SECONDS=$HeartbeatSeconds",
  "MT5_HTTP_TIMEOUT_SECONDS=$HttpTimeoutSeconds",
  "MT5_HTTP_RETRY_COUNT=$HttpRetryCount",
  "MT5_HTTP_RETRY_BACKOFF_SECONDS=$HttpRetryBackoffSeconds",
  "MT5_CONNECTED_TIMEOUT_SECONDS=$ConnectedTimeoutSeconds",
  "MT5_HISTORY_OVERLAP_SECONDS=$HistoryOverlapSeconds",
  "MT5_HISTORY_FUTURE_SECONDS=$HistoryFutureSeconds",
  "MT5_TICK_REPLAY_SECONDS=$TickReplaySeconds",
  "MT5_FULL_RECONCILE_MINUTES=$FullReconcileMinutes",
  "MT5_POST_EXIT_TRACKING_SECONDS=$PostExitTrackingSeconds",
  "MT5_SUPERVISOR_CHILDREN=$Children",
  "MT5_SUPERVISOR_REPORT_SECONDS=5"
)

[System.IO.File]::WriteAllLines($envFile, $envLines)

Write-Host ""
Write-Host "[setup] wrote worker environment to $envFile"
Write-Host "[setup] next:"
Write-Host "  1. Run windows\\run-supervisor.ps1 to start the pooled MT5 worker"
Write-Host "  2. Or run windows\\run-connection.ps1 -ConnectionId <id> for a single-account smoke test"
Write-Host "  3. Optionally run windows\\install-autostart-task.ps1 for unattended startup on this host"
