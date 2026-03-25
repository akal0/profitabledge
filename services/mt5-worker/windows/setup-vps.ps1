param(
  [Parameter(Mandatory = $true)]
  [string]$ServerUrl,

  [Parameter(Mandatory = $true)]
  [string]$WorkerSecret,

  [Parameter(Mandatory = $true)]
  [string]$TerminalPath,

  [Parameter(Mandatory = $true)]
  [string]$DeviceProfileId,

  [string]$TerminalPathMapJson = "",
  [string]$HostLabel = $env:COMPUTERNAME,
  [string]$HostEnvironment = "production",
  [string]$HostProvider = "vps",
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
  [int]$Children = 2,
  [int]$PollSeconds = 20,
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
  [string]$WorkerId = $env:COMPUTERNAME
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$setupScript = Join-Path $scriptRoot "setup.ps1"

if (-not (Test-Path $setupScript)) {
  throw "Setup script not found at $setupScript"
}

if (-not $DeviceProfileId.Trim()) {
  throw "DeviceProfileId is required for VPS setup so one device identity is not reused across traders"
}

if (-not $HostRegion.Trim()) {
  throw "HostRegion is required for VPS setup so region placement stays explicit"
}

if (-not $HostCountry.Trim()) {
  throw "HostCountry is required for VPS setup so trader placement stays explicit"
}

if (-not $HostTimezone.Trim()) {
  throw "HostTimezone is required for VPS setup so operator intent is explicit"
}

$normalizedHostRole = $HostRole.Trim().ToLowerInvariant()
if ($normalizedHostRole -ne "shared" -and $normalizedHostRole -ne "dedicated") {
  throw "HostRole must be either 'shared' or 'dedicated'"
}

$normalizedHostCapabilities =
  if ($HostCapabilities.Trim()) {
    $HostCapabilities
  } elseif ($normalizedHostRole -eq "dedicated") {
    "dedicated,terminal-farm,vps"
  } else {
    "shared,terminal-farm,vps"
  }

& $setupScript `
  -ServerUrl $ServerUrl `
  -WorkerSecret $WorkerSecret `
  -TerminalPath $TerminalPath `
  -TerminalPathMapJson $TerminalPathMapJson `
  -HostLabel $HostLabel `
  -HostEnvironment $HostEnvironment `
  -HostProvider $HostProvider `
  -HostRegion $HostRegion `
  -HostCountry $HostCountry `
  -HostTimezone $HostTimezone `
  -HostCity $HostCity `
  -HostPublicIpLabel $HostPublicIpLabel `
  -HostTags $HostTags `
  -HostCapabilities $normalizedHostCapabilities `
  -HostRole $normalizedHostRole `
  -ReservedUserId $ReservedUserId `
  -TraderId $TraderId `
  -TraderCountry $TraderCountry `
  -TraderTimezone $TraderTimezone `
  -DeviceProfileId $DeviceProfileId `
  -Children $Children `
  -PollSeconds $PollSeconds `
  -HeartbeatSeconds $HeartbeatSeconds `
  -HttpTimeoutSeconds $HttpTimeoutSeconds `
  -HttpRetryCount $HttpRetryCount `
  -HttpRetryBackoffSeconds $HttpRetryBackoffSeconds `
  -HistoryOverlapSeconds $HistoryOverlapSeconds `
  -HistoryFutureSeconds $HistoryFutureSeconds `
  -TickReplaySeconds $TickReplaySeconds `
  -FullReconcileMinutes $FullReconcileMinutes `
  -PostExitTrackingSeconds $PostExitTrackingSeconds `
  -ConnectedTimeoutSeconds $ConnectedTimeoutSeconds `
  -WorkerId $WorkerId
