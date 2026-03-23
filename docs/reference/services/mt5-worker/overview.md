# MT5 Worker

Minimal Python worker for the Profitabledge MT5 terminal-farm.

Important runtime boundary:

- the Next.js request server no longer boots the provider sync scheduler from the tRPC route
- scheduled provider sync now runs as a separate Bun worker via `bun run --cwd apps/server sync:worker`
- the Python MT5 worker remains the terminal/session ingestion process
- on the server side, MT5 frame ingestion is now split into typed parsing, persistence, and trade-projection modules under `apps/server/src/lib/mt5/`

## Modes

### `mock`

Generates deterministic MT5-like payloads and pushes them into the control plane.

Use this first to validate:

- worker authentication
- connection claiming
- bootstrap fetch
- raw event ingestion
- trade/open-trade/equity projection

### `terminal`

Uses the local `MetaTrader5` Python package plus a locally installed MT5 terminal.

This mode is intended for a Windows environment with:

- MetaTrader 5 installed
- `MetaTrader5` Python package installed
- broker server reachable

The worker copies the base MT5 install into a per-connection portable runtime directory before connecting. That keeps account sessions isolated instead of sharing one MT5 data folder.

In `terminal` mode, the worker uses the last persisted sync checkpoint to fetch deals and orders incrementally on each poll instead of rereading the full `lookbackDays` history every loop. It also runs a periodic full reconcile, so older MT5 events and richer raw payloads get backfilled without another worker rollout.

## Environment

- `PE_SERVER_URL`
  - Example: `http://localhost:3000`
- `BROKER_WORKER_SECRET`
  - Must match the server secret
- `MT5_WORKER_MODE`
  - `mock` or `terminal`
- `MT5_WORKER_ID`
  - Optional, defaults to hostname. Set this to a stable host identifier so a future VPS hand-off does not change the control-plane identity
- `MT5_WORKER_LABEL`
  - Optional, defaults to `MT5_WORKER_ID`. Human-friendly display label for the host in the Connections page
- `MT5_WORKER_ENVIRONMENT`
  - Optional, default `development`. Recommended values: `development`, `staging`, `production`
- `MT5_WORKER_PROVIDER`
  - Optional host provider label, for example `self-hosted`, `hetzner`, `aws`, `azure`
- `MT5_WORKER_REGION`
  - Optional region label, for example `lon1`, `eu-west-2`, `nyc3`
- `MT5_WORKER_TAGS`
  - Optional comma-separated tags for the host, for example `mt5,ftmo,primary`
- `MT5_POLL_SECONDS`
  - Optional, default `30`
- `MT5_HEARTBEAT_SECONDS`
  - Optional, default `5`
- `MT5_HISTORY_OVERLAP_SECONDS`
  - Optional, default `90`. Re-reads a short recent window so same-second fills/partials are not missed
- `MT5_HISTORY_FUTURE_SECONDS`
  - Optional, default `28800`. Extends the history end bound into the future so brokers whose MT5 timestamps run ahead of UTC do not hide recent deals/orders
- `MT5_FULL_RECONCILE_MINUTES`
  - Optional, default `720`. Forces a broader history refresh on a longer cadence to heal missed MT5 events and backfill richer raw payloads
- `MT5_CLAIM_LIMIT`
  - Optional, default `5`
- `MT5_LOOKBACK_DAYS`
  - Optional, default `90`
- `MT5_SESSIONS_ROOT`
  - Optional per-connection runtime root. Default: `<repo>/.mt5-worker/sessions`
- `MT5_STATUS_ROOT`
  - Optional worker status root. Default: `<repo>/.mt5-worker/status`
- `MT5_TERMINAL_PATH`
  - Required for `terminal` mode. Can point to `terminal64.exe`, `terminal.exe`, or an MT5 installation directory
- `MT5_TERMINAL_PATH_MAP`
  - Optional JSON object mapping MT5 server-name regex patterns to broker-specific MT5 installs.
  - Example: `{"^FTMO-":"C:\\Program Files\\FTMO MetaTrader 5\\terminal64.exe"}`
  - Use this when one Windows host needs multiple broker-specific MT5 builds.
  - If omitted, the worker will still try to auto-discover installed broker terminals from common Windows install locations and match them to the requested server name.
- `MT5_INITIALIZE_TIMEOUT_MS`
  - Optional, default `60000`
- `MT5_CONNECTED_TIMEOUT_SECONDS`
  - Optional, default `20`. After `initialize(...)` succeeds, the worker still waits for the terminal to become truly broker-connected for the requested login/server.
- `MT5_SUPERVISOR_CHILDREN`
  - Optional, default `2`. Maximum concurrent MT5 sessions on one host when using the supervisor
- `MT5_SUPERVISOR_ADMIN_HOST`
  - Optional, default `127.0.0.1`
- `MT5_SUPERVISOR_ADMIN_PORT`
  - Optional, default `9680`
- `MT5_SUPERVISOR_REPORT_SECONDS`
  - Optional, default `5`. How often the supervisor posts host/worker health to the control plane
- `MT5_SUPERVISOR_RESTART_BACKOFF_SECONDS`
  - Optional, default `5`
- `MT5_SUPERVISOR_POLL_SECONDS`
  - Optional, default `2`
- `MT5_SUPERVISOR_CHILD_PYTHON`
  - Optional child Python executable override
- `MT5_SUPERVISOR_CHILD_SCRIPT`
  - Optional child worker script override

## Run

From repo root:

```bash
python3 services/mt5-worker/main.py --once
```

Run the server-side provider sync worker:

```bash
bun run --cwd apps/server sync:worker
```

Continuous loop:

```bash
python3 services/mt5-worker/main.py
```

Single connection:

```bash
python3 services/mt5-worker/main.py --connection-id <connection-id> --once
```

Host supervisor:

```bash
python3 services/mt5-worker/supervisor.py
```

Supervisor with an explicit capacity:

```bash
python3 services/mt5-worker/supervisor.py --children 4
```

Local admin surface:

- `GET /health`
- `GET /workers`
- `GET /sessions`
- `POST /workers/<slot>/restart`

## Local Test Flow

### 1. Start the app stack

- Run the server/web app locally as normal.
- Ensure the server has `BROKER_WORKER_SECRET` set.
- Apply the latest schema changes with `bun run db:push` inside `apps/server`.

### 2. Create an MT5 terminal connection

Use the web app:

- Open `Settings -> Connections`
- Choose `MetaTrader 5`
- Enter `login`, `password`, and `server`

The connection will be created in `pending` state and claimed by the worker.

### 3. Validate the worker path first with `mock`

```bash
export PE_SERVER_URL=http://localhost:3000
export BROKER_WORKER_SECRET=your-shared-secret
export MT5_WORKER_MODE=mock
python3 services/mt5-worker/main.py --once
```

This validates:

- worker auth
- connection claiming
- bootstrap fetch
- sync ingestion
- account auto-linking

### 4. Switch to real `terminal` mode on Windows

```bash
export PE_SERVER_URL=http://localhost:3000
export BROKER_WORKER_SECRET=your-shared-secret
export MT5_WORKER_MODE=terminal
export MT5_TERMINAL_PATH='C:\\Program Files\\MetaTrader 5\\terminal64.exe'
python3 services/mt5-worker/main.py --connection-id <connection-id> --once
```

### 5. Run the bounded host pool

```bash
export PE_SERVER_URL=http://localhost:3000
export BROKER_WORKER_SECRET=your-shared-secret
export MT5_WORKER_MODE=terminal
export MT5_TERMINAL_PATH='C:\\Program Files\\MetaTrader 5\\terminal64.exe'
export MT5_SUPERVISOR_CHILDREN=4
python3 services/mt5-worker/supervisor.py
```

This starts four child workers, each limited to one claimed MT5 session at a time. That gives you a predictable host-level session cap.

Notes:

- `terminal` mode is intended for a Windows machine with MT5 installed.
- The Python `MetaTrader5` package must be installed in that environment.
- macOS/Linux are fine for `mock` mode, but not the recommended target for real MT5 sessions.
- The supervisor admin API is local by default on `127.0.0.1:9680`.
- Each child worker writes a status file in `MT5_STATUS_ROOT`, which the supervisor uses for health and active-session reporting.
- The supervisor also posts host status back to the app, so the Connections page can show worker health even when the MT5 worker runs on a separate Windows machine.

## Windows Quick Start

From a Windows machine that has MetaTrader 5 installed:

### 1. Bootstrap the worker once

```powershell
cd services/mt5-worker/windows
.\setup.ps1 `
  -ServerUrl "http://<your-mac-or-server>:3000" `
  -WorkerSecret "your-shared-secret" `
  -WorkerId "mt5-host-dev-01" `
  -HostLabel "Windows MT5 Dev 01" `
  -HostEnvironment "development" `
  -HostProvider "self-hosted" `
  -HostRegion "office" `
  -TerminalPath "C:\Program Files\MetaTrader 5\terminal64.exe" `
  -TerminalPathMapJson '{"^FTMO-":"C:\\Program Files\\FTMO MetaTrader 5\\terminal64.exe"}' `
  -Children 2 `
  -PollSeconds 30 `
  -HeartbeatSeconds 5 `
  -ConnectedTimeoutSeconds 20 `
  -HistoryOverlapSeconds 90 `
  -HistoryFutureSeconds 28800 `
  -FullReconcileMinutes 720
```

This will:

- create `services/mt5-worker/.venv`
- install `MetaTrader5`
- write `services/mt5-worker/.env.windows`
- set a moderate terminal poll cadence for near-live updates
- enable overlap polling plus periodic full reconciles for reliability and raw-payload backfills

### 2. Run a single real connection smoke test

```powershell
.\run-connection.ps1 -ConnectionId <connection-id>
```

Use this first with one MT5 connection from the app to confirm:

- MT5 terminal login succeeds
- the worker posts a real sync frame
- the connection status updates in the web app

### 3. Run the pooled supervisor

```powershell
.\run-supervisor.ps1
```

Optional capacity override:

```powershell
.\run-supervisor.ps1 -Children 4
```

### 4. Local admin endpoints on the Windows box

```powershell
curl http://127.0.0.1:9680/health
curl http://127.0.0.1:9680/workers
curl http://127.0.0.1:9680/sessions
```

### 5. Optional unattended startup on a VPS

For Windows VPS use, register the supervisor as a Scheduled Task so the host behaves the same way as your current PC:

```powershell
.\install-autostart-task.ps1 -TaskName "Profitabledge MT5 Supervisor" -StartNow
```

This registers the worker to start when that Windows user logs in. That is usually the safest default for MT5 because the terminal is still a desktop application.

To remove it later:

```powershell
.\uninstall-autostart-task.ps1 -TaskName "Profitabledge MT5 Supervisor"
```
