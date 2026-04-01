# Rithmic Worker Foundation

Current status:

- backend worker-managed connection plumbing is in place
- Python worker mode `rithmic` is scaffolded against `async_rithmic`
- account snapshots, open-position snapshots, and raw order-history capture are wired
- closed-trade reconstruction still needs a dedicated history mapping pass before the provider can be promoted to active

## Worker host requirements

- set `MT5_WORKER_MODE=rithmic`
- install `async_rithmic` on the worker host Python environment
- set `RITHMIC_GATEWAY_URL`
- set `RITHMIC_APP_NAME`
- set `RITHMIC_APP_VERSION`
- set `MT5_WORKER_TAGS=platform:rithmic`

## User credentials

Users provide:

- `login`
- `password`
- `systemName`
- `fcmId`
- optional `ibId`
- optional `accountId`
- optional `gatewayUrl`

Profitabledge provides:

- the worker app name/version configured on the worker host
- the worker process that talks to the Rithmic protocol API

## Current frame mapping

- account RMS / PnL snapshots -> account snapshot
- instrument PnL position snapshots -> open positions
- order history summary snapshots -> raw order events for future reconstruction

## Next steps

1. map order-history summary/detail rows into closed entry/exit executions
2. persist discovered Rithmic accounts back into connection metadata
3. validate worker behavior against paper-trading credentials
