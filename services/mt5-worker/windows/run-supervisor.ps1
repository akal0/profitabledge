param(
  [string]$EnvFile,
  [int]$Children = 0
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path

if (-not $EnvFile) {
  $EnvFile = Join-Path $workerRoot ".env.windows"
}

. (Join-Path $scriptRoot "_load-env.ps1") -EnvFile $EnvFile

if ($Children -gt 0) {
  [System.Environment]::SetEnvironmentVariable(
    "MT5_SUPERVISOR_CHILDREN",
    "$Children",
    "Process"
  )
}

$pythonExe = Join-Path $workerRoot ".venv\Scripts\python.exe"
$supervisorScript = Join-Path $workerRoot "supervisor.py"

if (-not (Test-Path $pythonExe)) {
  throw "Python environment not found at $pythonExe. Run windows\\setup.ps1 first."
}

Write-Host "[run-supervisor] starting MT5 supervisor"
& $pythonExe $supervisorScript
