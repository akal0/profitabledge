param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionId,

  [string]$EnvFile,
  [switch]$Loop
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path

if (-not $EnvFile) {
  $EnvFile = Join-Path $workerRoot ".env.windows"
}

. (Join-Path $scriptRoot "_load-env.ps1") -EnvFile $EnvFile

$pythonExe = Join-Path $workerRoot ".venv\Scripts\python.exe"
$workerScript = Join-Path $workerRoot "main.py"

if (-not (Test-Path $pythonExe)) {
  throw "Python environment not found at $pythonExe. Run windows\\setup.ps1 first."
}

$args = @($workerScript, "--connection-id", $ConnectionId)
if (-not $Loop) {
  $args += "--once"
}

Write-Host "[run-connection] starting MT5 worker for connection $ConnectionId"
& $pythonExe @args
