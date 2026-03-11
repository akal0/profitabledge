param(
  [Parameter(Mandatory = $true)]
  [string]$EnvFile
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  throw "Environment file not found: $EnvFile"
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $parts = $line.Split("=", 2)
    if ($parts.Length -eq 2) {
      $name = $parts[0].Trim()
      $value = $parts[1]
      [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}
