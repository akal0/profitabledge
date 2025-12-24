# ProfitabEdge - Codebase Context

**Last Updated**: 2025-12-22

This document provides a comprehensive overview of the ProfitabEdge codebase architecture, helping developers and AI assistants quickly understand the project structure and development patterns.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Monorepo Structure](#monorepo-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [Key Features](#key-features)
8. [Development Workflow](#development-workflow)
9. [API Reference](#api-reference)
10. [Common Patterns](#common-patterns)

---

## Project Overview

ProfitabEdge is a full-stack trading analytics platform that helps traders analyze their performance through:
- **Advanced Statistics**: Win rate, profit factor, expectancy, hold times
- **Customizable Dashboards**: 11 widgets + 3 chart widgets with drag-and-drop
- **Drawdown Analysis**: Real-time historical price data for MAE calculations
- **Multi-Account Support**: Manage multiple trading accounts
- **CSV Import**: Flexible import from various broker formats

**Architecture**: TypeScript monorepo with Next.js frontend/backend, tRPC for type-safe APIs, PostgreSQL database

---

## Technology Stack

### Core Technologies
- **Runtime**: Bun 1.2.12
- **Framework**: Next.js 15.3.0 with React 19
- **Language**: TypeScript (strict mode)
- **Build System**: Turborepo

### Frontend
- **UI Framework**: React 19
- **Styling**: TailwindCSS v4
- **Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand
- **Server State**: React Query (via tRPC)
- **Drag & Drop**: @dnd-kit
- **Charts**: Recharts
- **Calendar**: react-aria-components

### Backend
- **API Layer**: tRPC 11.4.2
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Authentication**: Better Auth 1.3.0
- **File Upload**: UploadThing
- **Market Data**: dukascopy-node

### Development Tools
- **Package Manager**: Bun
- **Linting**: ESLint
- **Type Checking**: TypeScript project references

---

## Monorepo Structure

```
profitabledge/
├── apps/
│   ├── web/              # Next.js frontend (port 3001)
│   └── server/           # Next.js API backend (port 3000)
├── package.json          # Root workspace config
├── turbo.json            # Turborepo build configuration
├── drizzle.config.ts     # Database configuration
├── CLAUDE.md             # AI assistant instructions
├── CODEBASE_CONTEXT.md   # This file
└── README.md
```

### Workspace Configuration
- **web**: TypeScript project with references to server
- **server**: Independent TypeScript project
- **Shared types**: Via TypeScript project references

---

## Frontend Architecture

### Directory Structure
```
apps/web/src/
├── app/
│   ├── (auth)/              # Auth routes (login, sign-up)
│   ├── (dashboard)/         # Dashboard routes
│   │   └── dashboard/
│   │       ├── onboarding/
│   │       ├── trades/
│   │       └── page.tsx
│   ├── layout.tsx
│   └── page.tsx             # Landing page
├── components/
│   ├── dashboard/           # Dashboard widgets & charts
│   │   ├── widgets.tsx      # 11 customizable widgets
│   │   ├── chart-widgets.tsx # 3 chart widgets
│   │   ├── calendar/
│   │   ├── charts/
│   │   └── sidebar/
│   ├── ui/                  # shadcn/ui components
│   ├── data-table/          # Reusable table components
│   ├── upload/              # CSV upload
│   └── icons/
├── stores/                  # Zustand state stores
│   ├── account.ts           # Selected account
│   ├── stats.ts             # Stats caching
│   ├── date-range.ts        # Date filters
│   └── comparison.ts        # Comparison state
├── hooks/                   # Custom React hooks
├── lib/                     # Utilities
├── types/                   # TypeScript types
└── utils/
    └── trpc.ts              # tRPC client
```

### Key Routes
- `/` - Landing page
- `/login`, `/sign-up` - Authentication
- `/dashboard` - Main dashboard with widgets
- `/dashboard/trades` - Full trades table
- `/dashboard/onboarding` - First-time setup

### State Management

**Zustand Stores**:
1. **Account Store** ([stores/account.ts](apps/web/src/stores/account.ts)): Selected trading account ID
2. **Stats Store** ([stores/stats.ts](apps/web/src/stores/stats.ts)): Cached account statistics
3. **Date Range Store** ([stores/date-range.ts](apps/web/src/stores/date-range.ts)): Global date filters
4. **Comparison Store** ([stores/comparison.ts](apps/web/src/stores/comparison.ts)): Account comparison state

### tRPC Client Setup
Location: [apps/web/src/utils/trpc.ts](apps/web/src/utils/trpc.ts)

```typescript
// React Query hooks
const { data } = trpc.accounts.stats.useQuery({ accountId });

// Direct client usage
const data = await trpcClient.accounts.list.query();

// Mutations
trpcClient.users.updateProfile.mutate({ ... });
```

**Features**:
- Automatic failover (LAN IP → localhost)
- Query caching with React Query
- Toast notifications for errors
- Credentials: "include" for cookie auth

---

## Backend Architecture

### Directory Structure
```
apps/server/src/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/   # Better Auth endpoints
│   │   └── uploadthing/     # File upload
│   └── trpc/[trpc]/
│       └── route.ts         # tRPC handler
├── routers/
│   ├── index.ts             # Main AppRouter
│   ├── accounts.ts          # Trading analytics (13 procedures)
│   ├── trades.ts            # Trade queries & drawdown
│   ├── users.ts             # User profile & preferences
│   └── upload.ts            # CSV import
├── db/
│   ├── index.ts             # Drizzle client
│   ├── schema/
│   │   ├── auth.ts          # Auth tables
│   │   └── trading.ts       # Trading tables
│   └── migrations/
├── lib/
│   ├── auth.ts              # Better Auth config
│   ├── trpc.ts              # tRPC setup
│   ├── context.ts           # Request context
│   └── dukascopy.ts         # Symbol mapping
└── scripts/
    └── fetch-dukas-ticks.ts
```

### tRPC Router Structure
Location: [apps/server/src/routers/index.ts](apps/server/src/routers/index.ts)

```typescript
export const appRouter = router({
  upload: uploadRouter,      // CSV import
  accounts: accountsRouter,   // Analytics (13 procedures)
  users: usersRouter,         // Profile & preferences
  trades: tradesRouter,       // Queries & drawdown
});

export type AppRouter = typeof appRouter;
```

### Authentication Flow
1. Better Auth handles email/password + OAuth (Google, Twitter)
2. Session stored in database (user, session, account tables)
3. tRPC context extracts session from headers
4. Protected procedures validate session

**Protected Procedure** ([lib/trpc.ts](apps/server/src/lib/trpc.ts:16-19)):
```typescript
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

---

## Database Schema

### Auth Tables
**user** ([db/schema/auth.ts](apps/server/src/db/schema/auth.ts:7-17)):
- id, name, username (unique), email (unique)
- emailVerified, image
- widgetPreferences (jsonb) - Dashboard layout
- chartWidgetPreferences (jsonb) - Chart layout
- tablePreferences (jsonb) - Table state
- createdAt, updatedAt

**session**: id, token, expiresAt, userId, ipAddress, userAgent
**account**: Better Auth OAuth/credential accounts
**verification**: Email verification codes

### Trading Tables
**tradingAccount** ([db/schema/trading.ts](apps/server/src/db/schema/trading.ts:7-13)):
- id, userId, name, broker
- initialBalance, initialCurrency
- createdAt

**trade** ([db/schema/trading.ts](apps/server/src/db/schema/trading.ts:15-30)):
- id, accountId
- open, close (timestamps), tradeType, symbol, volume
- openPrice, closePrice, sl, tp
- profit, pips, swap, commissions
- tradeDurationSeconds
- createdAt

**historicalPrices**: OHLCV + tick data (future use)

### Relationships
- user → session (1:many, cascade delete)
- user → tradingAccount (1:many, cascade delete)
- tradingAccount → trade (1:many, cascade delete)

---

## Key Features

### 1. Dashboard Widgets (11 Types)
Location: [apps/web/src/components/dashboard/widgets.tsx](apps/web/src/components/dashboard/widgets.tsx)

1. **Account Balance** - Initial + profit
2. **Win Rate** - Percentage with chart
3. **Win Streak** - Current streak + last 5
4. **Profit Factor** - Gross profit/loss ratio
5. **Hold Time** - Avg duration (H:M:S)
6. **Average RR** - Reward/risk multiple
7. **Asset Profitability** - Best/worst symbols
8. **Trade Counts** - Avg trades per day/week/month
9. **Profit Expectancy** - Expected $ per trade
10. **Total Losses** - Breakdown (profit/commission/swap)
11. **Consistency Score** - % profitable days

**Features**:
- Drag-and-drop reordering (@dnd-kit)
- Show/hide widgets (max 12 visible)
- Long-press to edit
- Persistent in database

### 2. Chart Widgets (3 Types)
Location: [apps/web/src/components/dashboard/chart-widgets.tsx](apps/web/src/components/dashboard/chart-widgets.tsx)

1. **Daily Net** - Daily profit area chart
2. **Weekday Performance** - Avg profit per weekday
3. **Performing Assets** - Symbol profitability

### 3. Advanced Trade Table
Location: [apps/web/src/app/(dashboard)/dashboard/trades/page.tsx](apps/web/src/app/(dashboard)/dashboard/trades/page.tsx)

**Features**:
- Infinite scroll with virtual rendering
- Filters: date range, direction, symbols, search
- Columns: symbol, direction, volume, profit, times
- Expandable rows with drawdown analysis

### 4. Drawdown Analysis Engine
Location: [apps/server/src/routers/trades.ts](apps/server/src/routers/trades.ts:55-200)

**Process**:
1. Map broker symbol to Dukascopy instrument
2. Fetch M1 candle data for trade timeframe
3. Calculate max adverse excursion (MAE)
4. Detect SL/TP hits (0.5 pip tolerance)
5. Fall back to tick data for precision
6. Return % to SL, pips moved, hit status

**Output**: `{ percentToSl, pipsToSl, hitStatus: NONE|SL|BE|TP|CLOSE }`

### 5. CSV Import System
Location: [apps/server/src/routers/upload.ts](apps/server/src/routers/upload.ts)

**Features**:
- Flexible column mapping
- Duplicate header handling
- Timezone-agnostic parsing
- Auto-calculates trade duration
- Creates account + bulk inserts trades

---

## Development Workflow

### Setup
```bash
# Install dependencies
bun install

# Configure environment
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.local.example apps/web/.env.local

# Setup database
bun db:push
```

### Running
```bash
# Both apps (recommended)
bun dev

# Individual apps
bun dev:web      # Port 3001
bun dev:server   # Port 3000

# Database UI
bun db:studio
```

### Building
```bash
# Build all
bun build

# Type-check
bun check-types

# Lint
cd apps/web && bun lint
```

### Database Operations
```bash
bun db:push       # Push schema changes
bun db:generate   # Generate migrations
bun db:migrate    # Run migrations
bun db:studio     # Open Drizzle Studio
```

---

## API Reference

### Accounts Router (13 Procedures)
Location: [apps/server/src/routers/accounts.ts](apps/server/src/routers/accounts.ts)

**Basic Info**:
- `list()` - Get user's trading accounts
- `metrics(accountId)` - Win/loss counts, winrate
- `stats(accountId, dateRange?)` - Full statistics object

**Daily/Time-Based**:
- `recentByDay(accountId)` - Last 7 days profit
- `profitByDayOverall(accountId, dateRange?)` - Daily profit (continuous buckets)

**Asset Analysis**:
- `profitByAssetRange(accountId, dateRange)` - Profit by symbol
- `lossesByAssetRange(accountId, dateRange)` - Loss breakdown by symbol

**Trade Counts**:
- `tradeCountsRange(accountId, dateRange)` - Avg trades/day/week/month (in range)
- `tradeCountsOverall(accountId, dateRange?)` - Continuous buckets

**Utilities**:
- `opensBounds(accountId)` - Min/max trade timestamps

### Trades Router (3 Procedures)
Location: [apps/server/src/routers/trades.ts](apps/server/src/routers/trades.ts)

- `listInfinite(accountId, cursor, limit, filters)` - Paginated trades
- `listSymbols(accountId)` - All unique symbols
- `drawdownForTrade(tradeId)` - Advanced drawdown calculation

### Users Router (7 Procedures)
Location: [apps/server/src/routers/users.ts](apps/server/src/routers/users.ts)

- `me()` - Current user profile
- `updateProfile(name, username, email, image)` - Update profile
- `clearImage()` - Remove avatar
- `getTablePreferences(accountId)` - Table state
- `updateTablePreferences(accountId, prefs)` - Save table state
- `updateWidgetPreferences(widgets)` - Save dashboard layout
- `updateChartWidgetPreferences(widgets)` - Save chart layout

### Upload Router (1 Procedure)
Location: [apps/server/src/routers/upload.ts](apps/server/src/routers/upload.ts)

- `importCsv(file, accountName, broker, initialBalance, currency)` - Import CSV

---

## Common Patterns

### 1. Account Selection Flow
```typescript
// 1. User selects account in sidebar
const { setSelectedAccountId } = useAccountStore();
setSelectedAccountId(accountId);

// 2. Components consume from store
const { selectedAccountId } = useAccountStore();

// 3. Query data with accountId
const { data: stats } = trpc.accounts.stats.useQuery(
  { accountId: selectedAccountId },
  { enabled: !!selectedAccountId }
);
```

### 2. Date Range Filtering
```typescript
// Global date range store
const { dateRange } = useDateRangeStore();

// Pass to queries
const { data } = trpc.accounts.profitByAssetRange.useQuery({
  accountId,
  dateRange: dateRange ? {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  } : undefined,
});
```

### 3. Protected API Calls
```typescript
// Server-side (routers)
export const accountsRouter = router({
  stats: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input, ctx }) => {
      // ctx.session is guaranteed to exist
      const { accountId } = input;

      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      // Fetch stats...
    }),
});
```

### 4. Infinite Scroll Pattern
```typescript
// Client-side
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = trpc.trades.listInfinite.useInfiniteQuery(
  { accountId, limit: 50, filters },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);

// Render with IntersectionObserver
<div ref={loadMoreRef}>
  {isFetchingNextPage && <Skeleton />}
</div>
```

### 5. Widget Persistence
```typescript
// Save to database
await trpcClient.users.updateWidgetPreferences.mutate({
  widgets: [
    { id: 'account-balance', enabled: true },
    { id: 'win-rate', enabled: true },
    // ... up to 12 widgets
  ],
});

// Load from user profile
const { data: user } = trpc.users.me.useQuery();
const widgetPrefs = user?.widgetPreferences || DEFAULT_WIDGETS;
```

### 6. Error Handling
```typescript
// tRPC client with toast
const { mutate } = trpc.users.updateProfile.useMutation({
  onSuccess: () => {
    toast.success('Profile updated');
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### 7. Stats Calculation (Server)
```typescript
// Example: Win rate
const [winCount, lossCount] = await Promise.all([
  db.select({ count: count() })
    .from(trade)
    .where(and(
      eq(trade.accountId, accountId),
      gt(trade.profit, 0)
    )),
  db.select({ count: count() })
    .from(trade)
    .where(and(
      eq(trade.accountId, accountId),
      lt(trade.profit, 0)
    )),
]);

const winrate = (winCount[0].count / (winCount[0].count + lossCount[0].count)) * 100;
```

### 8. Symbol Mapping (Dukascopy)
```typescript
import { getSymbolInfo } from '@/lib/dukascopy';

const symbolInfo = getSymbolInfo('EURUSD'); // or 'EURUSD.pro'
// { symbol: 'EURUSD', pipSize: 0.0001, contractSize: 100000 }

const pipsToSl = Math.abs(price - sl) / symbolInfo.pipSize;
```

---

## Environment Variables

### Backend (`apps/server/.env`)
```bash
DATABASE_URL=postgresql://user:pass@host/db
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001

# Optional OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
```

### Frontend (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

---

## Performance Considerations

### Frontend
- **Infinite scroll** for large trade lists (virtual rendering)
- **Query caching** with React Query (staleTime, cacheTime)
- **Debounced search** (300ms delay)
- **Skeleton loaders** during loading states
- **Lazy loading** for dashboard widgets

### Backend
- **Continuous date buckets** (no gaps in charts)
- **Parallel queries** for dashboard stats
- **Index optimization** on trade(accountId), trade(open)
- **Pagination** with cursor-based approach
- **Cached stats** in Zustand store (frontend)

### Database
- **Indexes**: accountId, userId, timestamps
- **Cascade deletes** for data integrity
- **JSONB** for flexible preferences storage
- **Numeric** type for precise financial calculations

---

## Future Extensibility

### Planned Features (based on schema)
- **Historical price caching** - Store Dukascopy data locally
- **Multi-account comparison** - Side-by-side analytics
- **Real-time updates** - WebSocket integration
- **Advanced charting** - Equity curves, Monte Carlo
- **Trade journal** - Notes, screenshots, tags
- **Risk calculator** - Position sizing tools

### Extension Points
- **New widget types** - Add to widgets.tsx + schema
- **Custom CSV formats** - Extend upload.ts parser
- **Additional auth providers** - Better Auth supports many
- **Alternative data sources** - Replace Dukascopy in trades.ts
- **Mobile app** - React Native with same tRPC backend

---

## Troubleshooting

### Common Issues

**tRPC Connection Errors**:
- Check CORS_ORIGIN in server/.env matches web origin
- Verify NEXT_PUBLIC_SERVER_URL in web/.env.local
- Ensure both servers are running (bun dev)

**Database Errors**:
- Verify DATABASE_URL is correct
- Run `bun db:push` to sync schema
- Check PostgreSQL is running

**Auth Issues**:
- Verify BETTER_AUTH_SECRET is set
- Check BETTER_AUTH_URL matches server URL
- Clear cookies and try logging in again

**Build Errors**:
- Run `bun install` to ensure dependencies are up to date
- Clear Turbo cache: `rm -rf .turbo`
- Check TypeScript errors: `bun check-types`

---

## Quick Reference

### File Locations
- **tRPC Router**: [apps/server/src/routers/index.ts](apps/server/src/routers/index.ts)
- **Database Schema**: [apps/server/src/db/schema/](apps/server/src/db/schema/)
- **Auth Config**: [apps/server/src/lib/auth.ts](apps/server/src/lib/auth.ts)
- **tRPC Client**: [apps/web/src/utils/trpc.ts](apps/web/src/utils/trpc.ts)
- **Widgets**: [apps/web/src/components/dashboard/widgets.tsx](apps/web/src/components/dashboard/widgets.tsx)
- **Trade Table**: [apps/web/src/app/(dashboard)/dashboard/trades/page.tsx](apps/web/src/app/(dashboard)/dashboard/trades/page.tsx)

### Port Reference
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- Drizzle Studio: `https://local.drizzle.studio`

### Key Dependencies
- Next.js: 15.3.0
- React: 19
- tRPC: 11.4.2
- Drizzle: 0.39.2
- Better Auth: 1.3.0
- TailwindCSS: 4.0.0
- Zustand: 5.0.2

---

**Last Updated**: 2025-12-22
**Maintainer**: ProfitabEdge Team
