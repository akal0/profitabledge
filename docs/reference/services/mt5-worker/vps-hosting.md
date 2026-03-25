# MT5 VPS Hosting

This runbook covers Windows VPS setup for MT5 worker hosts. The default model is a shared regional pool: one VPS, one stable host identity, and multiple isolated portable MT5 runtimes claimed by the supervisor as capacity allows.

## Policy

- Do not reuse a `DeviceProfileId` across different VPS hosts.
- Keep the host region, country, and timezone explicit.
- Prefer a VPS pool that matches the trader's region or the broker/prop-firm placement expectation.
- If no local-region host is available, warn the user in the browser before creating the MT5 connection and require explicit confirmation for best-effort placement.
- Use a dedicated host only when a prop-firm workflow requires stricter host isolation than a shared pool can provide.

## What You Need

- A Windows VPS with admin access.
- MetaTrader 5 installed.
- Python installed, or the Windows launcher used by `setup.ps1`.
- Repo checkout on the VPS.
- A unique `DeviceProfileId` for the VPS host.

## First-Time Setup

1. Open PowerShell as the operator account that will own the scheduled task.
2. Change into `services/mt5-worker/windows`.
3. Run the VPS bootstrap wrapper.

```powershell
.\setup-vps.ps1 `
  -ServerUrl "http://<server>:3000" `
  -WorkerSecret "your-shared-secret" `
  -TerminalPath "C:\Program Files\MetaTrader 5\terminal64.exe" `
  -DeviceProfileId "lon-shared-01" `
  -HostLabel "mt5-lon-shared-01" `
  -HostProvider "vps" `
  -HostRegion "eu-west-2" `
  -HostCountry "GB" `
  -HostTimezone "Europe/London" `
  -HostCity "London" `
  -HostRole "shared" `
  -Children 2
```

The wrapper writes `services/mt5-worker/.env.windows`, creates the virtual environment, installs `MetaTrader5`, and records the host's geo metadata before you ever log in to MT5.

If a host must be reserved to one Profitabledge user, add:

```powershell
-HostRole "dedicated" `
-ReservedUserId "<profitabledge-user-id>" `
-TraderId "trader-014"
```

## Broker-Specific MT5 Paths

If this VPS will only run one MT5 install, `-TerminalPath` is enough.

If the VPS has multiple MT5 installs, for example:

- `C:\Program Files\MetaTrader 5\terminal64.exe`
- `C:\Program Files\FTMO MetaTrader 5\terminal64.exe`
- `C:\Program Files\OANDA MetaTrader 5\terminal64.exe`

then keep `-TerminalPath` as the default fallback and add `-TerminalPathMapJson` so server names are routed to the correct MT5 install.

Example:

```powershell
.\setup-vps.ps1 `
  -ServerUrl "http://<server>:3000" `
  -WorkerSecret "your-shared-secret" `
  -TerminalPath "C:\Program Files\MetaTrader 5\terminal64.exe" `
  -TerminalPathMapJson '{"^FTMO-":"C:\\Program Files\\FTMO MetaTrader 5\\terminal64.exe","OANDA":"C:\\Program Files\\OANDA MetaTrader 5\\terminal64.exe"}' `
  -DeviceProfileId "lon-shared-01" `
  -HostLabel "mt5-lon-shared-01" `
  -HostProvider "ovhcloud" `
  -HostRegion "london" `
  -HostCountry "GB" `
  -HostTimezone "Europe/London" `
  -HostCity "London" `
  -HostRole "shared" `
  -Children 3
```

Notes:

- The keys in `TerminalPathMapJson` are regex patterns matched against the MT5 server name.
- `^FTMO-` is a good FTMO starter pattern.
- `OANDA` is a good OANDA starter pattern.
- If a mapping does not match, the worker falls back to `-TerminalPath`.
- The worker also tries auto-discovery, but explicit path maps are safer when you have multiple branded MT5 installs on one VPS.

If you want to inspect likely MT5 installs on the VPS first, run:

```powershell
Get-ChildItem "C:\Program Files","C:\Program Files (x86)",$env:LOCALAPPDATA -Recurse -Filter terminal64.exe -ErrorAction SilentlyContinue |
  Select-Object FullName
```

## Start The Supervisor

```powershell
.\run-supervisor.ps1
```

If you need to override child count temporarily:

```powershell
.\run-supervisor.ps1 -Children 1
```

## Smoke Test

Use a single connection smoke test before you let the host take production load:

```powershell
.\run-connection.ps1 -ConnectionId <connection-id>
```

## Autostart

If the VPS should come up automatically after the operator logs in, register the scheduled task:

```powershell
.\install-autostart-task.ps1 -TaskName "Profitabledge MT5 Supervisor" -StartNow
```

## Region Warnings

The app now treats this globally, not as a Canada-only edge case. If a trader's saved or browser timezone maps to North America, Asia, or another region and the currently available MT5 hosts are only in London or another mismatch region, the connection form shows a confirmation dialog before the MT5 credential is created.

- If the user confirms, the connection is stored with `best-effort` placement and can be claimed by the non-local host only when no preferred regional host is currently online.
- If the user cancels, the connection is not created and the account waits for a suitable host pool.

## Troubleshooting

- If the device profile is missing, rerun `setup-vps.ps1` with a stable `DeviceProfileId` for that VPS host.
- If the host metadata is wrong, rerun the VPS wrapper rather than editing `.env.windows` by hand.
- If MT5 cannot start, confirm that `MT5_TERMINAL_PATH` points to either `terminal64.exe`, `terminal.exe`, or the install directory.
- If the host is in the wrong region, stop the supervisor and reprovision it under the correct placement settings.

## Operational Notes

- Keep `HostLabel` and `DeviceProfileId` stable across reboots.
- The worker already launches each connection from its own portable MT5 runtime directory, which isolates data folders and logs per session.
- Portable MT5 runtimes are not the same thing as guaranteed broker-visible unique device fingerprints. Shared pools reduce cost and keep sessions isolated, but they are not a hard compliance guarantee for firms that care about device identity.
- Use the host tags to describe the pool, not to hide the pool.
