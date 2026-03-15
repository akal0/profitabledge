# profitabledge

Profitabledge is a trading analytics platform with account sync, trade journaling, replay/backtesting, AI-assisted analysis, and MT5 worker infrastructure.

## Workspace

```text
profitabledge/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── server/               # Next.js + tRPC backend
├── packages/
│   ├── contracts/            # shared contract surface
│   └── platform/             # shared runtime helpers
├── services/
│   └── mt5-worker/           # MT5 worker service
├── EA/                       # MetaTrader expert advisor assets
└── docs/                     # canonical documentation tree
```

## Getting Started

1. Install dependencies:

```bash
bun install
```

2. Configure environment variables for the server app in `apps/server/.env`.

3. Push the database schema:

```bash
bun db:push
```

4. Start the apps:

```bash
bun dev
```

Default local URLs:

- web: `http://localhost:3001`
- server: `http://localhost:3000`

## Key Scripts

- `bun dev`
- `bun build`
- `bun check-types`
- `bun dev:web`
- `bun dev:server`
- `bun db:push`
- `bun db:generate`
- `bun db:migrate`
- `bun db:studio`

## Documentation

- `docs/README.md`
- `docs/reference/architecture/overview.md`
- `docs/reference/frontend/overview.md`
- `docs/reference/backend/overview.md`
- `docs/reference/operations/developer-playbook.md`
- `docs/reference/roadmap/alpha-launch-hardening-plan.md`
