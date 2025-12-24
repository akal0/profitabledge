# Neon Database Compatibility Guide

## Current Issues Identified

Your current Neon PostgreSQL setup **WILL WORK** with Neon, but you're experiencing errors with `bun db:studio` due to:

### 1. **channel_binding=require** Parameter
- **Problem**: Drizzle Kit Studio has issues with the `channel_binding=require` parameter
- **Error**: `write: EPIPE` when running `bun db:studio`
- **Status**: ✅ Already partially fixed in your `drizzle.config.ts`

### 2. **Pooled Connection for Studio**
- **Problem**: Using Neon's pooler connection (`-pooler.eu-west-2.aws.neon.tech`) can cause timeouts with Drizzle Kit Studio
- **Error**: Connection drops/EPIPE errors during studio operations
- **Status**: ⚠️ Needs fix

## Solution: Use Two Connection Strings

Neon provides **two types** of connection strings:

### 1. **Pooled Connection** (for production/app runtime)
```
postgresql://user:pass@ep-xxx-pooler.eu-west-2.aws.neon.tech/db
```
- Use for: Your application (apps/server/src/db/index.ts)
- Benefits: Better for serverless, connection pooling, auto-scaling

### 2. **Direct Connection** (for migrations & studio)
```
postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech/db
```
- Use for: Drizzle Kit Studio, migrations, development tools
- Benefits: Stable connection, no pooling overhead

## How to Get Both Connection Strings from Neon

1. Go to your Neon project dashboard
2. Navigate to "Connection Details"
3. You'll see both:
   - **Pooled connection** (contains `-pooler` in hostname)
   - **Direct connection** (no `-pooler` in hostname)

## Recommended Setup

### Option A: Separate Environment Variables (Recommended)

Update `apps/server/.env`:

```bash
# Direct connection - for drizzle-kit operations (studio, generate, etc.)
DATABASE_URL='postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require'

# Pooled connection - for application runtime
DATABASE_URL_POOLED='postgresql://user:pass@ep-xxx-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
```

**Note**: Remove `&channel_binding=require` from both URLs

Then update your files:

**apps/server/drizzle.config.ts:**
```typescript
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "", // Uses direct connection
  },
});
```

**apps/server/src/db/index.ts:**
```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// Use pooled connection for app, fallback to direct
const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || "";

const client = postgres(connectionString);

export const db = drizzle(client);
```

### Option B: Single URL (Quick Fix)

Just update your current `DATABASE_URL` to use the **direct connection** (non-pooler) and remove `channel_binding`:

```bash
DATABASE_URL='postgresql://neondb_owner:npg_9PVBGbS4jgai@ep-solitary-cloud-abcw3nzq.eu-west-2.aws.neon.tech/neondb?sslmode=require'
```

**Changes**:
- ❌ Remove `-pooler` from hostname
- ❌ Remove `&channel_binding=require`

## Why Your drizzle.config.ts Fix Wasn't Enough

Your `drizzle.config.ts` removes `channel_binding`, which is good! However:

```typescript
const cleanUrl = dbUrl.replace("&channel_binding=require", "").replace("channel_binding=require&", "");
```

This only fixes the config file. The EPIPE error occurs because:
1. Drizzle Kit still struggles with pooled connections
2. The pooler has different timeout/connection handling
3. Studio needs a stable, persistent connection

## Verification Steps

After implementing the fix:

```bash
# 1. Test the direct connection
bun test-db-connection.ts

# 2. Try drizzle studio
bun db:studio

# 3. Verify your app still works
bun dev
```

## Additional Notes

- **Your database IS compatible with Neon** ✅
- **postgres-js** (your current driver) works great with Neon
- The issue is specifically with Drizzle Kit Studio and pooled connections
- For production deployment, always use the pooled connection string
- For local development tools, use the direct connection string

## Quick Fix Summary

**Immediate fix** (Option B):
1. Get your direct connection URL from Neon dashboard (no `-pooler`)
2. Remove `&channel_binding=require` from the URL
3. Update `apps/server/.env` DATABASE_URL
4. Run `bun db:studio` - should work now!
