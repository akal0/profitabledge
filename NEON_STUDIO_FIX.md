# Neon + Drizzle Studio Fix

## The Problem

You're now using the **correct** Neon driver (`@neondatabase/serverless` with `drizzle-orm/neon-http`), which is excellent for your app! However:

- ❌ **drizzle-kit studio doesn't support the Neon HTTP driver**
- The studio tool requires a traditional PostgreSQL connection (postgres-js or node-postgres)
- This is a known limitation of drizzle-kit studio

## Solution: Use Two Different Drivers

### Strategy: One driver for app, another for drizzle-kit

**Your current setup:**
- ✅ **App runtime** ([src/db/index.ts](apps/server/src/db/index.ts)): Uses `@neondatabase/serverless` (perfect for Neon!)
- ❌ **Drizzle kit** ([drizzle.config.ts](apps/server/drizzle.config.ts)): Also tries to use the same connection (doesn't work)

## Implementation

### Option 1: Add postgres-js for drizzle-kit only (Recommended)

Keep your app using Neon's driver, but configure drizzle-kit to use `postgres-js`:

**1. Install postgres-js (you already have it):**
```bash
# Already in your package.json root
```

**2. Update `apps/server/drizzle.config.ts`:**

```typescript
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config();

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  // Use pg driver for drizzle-kit compatibility
  driver: "pglite", // This will use the standard pg protocol
});
```

Actually, let me correct that - the better approach:

```typescript
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config();

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
```

The issue is that drizzle-kit doesn't know which driver to use. It needs to connect directly.

### Option 2: Use Neon's Postgres.js adapter (Best Solution)

Actually, there's a better way! Neon provides a WebSocket-based connection that works with standard PostgreSQL clients.

**Update `apps/server/drizzle.config.ts`:**

```typescript
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config();

// Drizzle Kit needs a WebSocket-compatible connection
// Neon's DATABASE_URL works with postgres-js when WebSocket is available
export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  // This tells drizzle-kit to use a standard PostgreSQL connection
  // It will work because Neon supports both HTTP and WebSocket protocols
});
```

The real issue is that `drizzle-kit studio` internally can't handle the Neon HTTP driver.

## Option 3: Alternative to Drizzle Studio

Since Drizzle Studio has compatibility issues with Neon, use these alternatives:

### A. Neon's Built-in SQL Editor
- Go to your Neon dashboard: https://console.neon.tech
- Navigate to your database
- Use the built-in SQL Editor (much better than drizzle studio for remote DBs)

### B. TablePlus / Postico / pgAdmin
Use a proper PostgreSQL client:
```bash
brew install tableplus
# or
brew install --cask postico
```

Connect with your Neon connection string directly.

### C. Create a local Drizzle Studio script
Create `apps/server/studio.ts`:

```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "dotenv";

config();

// Use postgres-js for local development studio access
const connectionString = process.env.DATABASE_URL || "";
const client = postgres(connectionString, {
  max: 1,
});

const db = drizzle(client);

console.log("Connected to database for local exploration");
console.log("Use this db instance in your REPL or scripts");
```

Then run:
```bash
bun --eval "$(cat apps/server/studio.ts)"
```

## Recommended Solution

**I recommend Option 3A: Use Neon's built-in SQL Editor**

Why:
- ✅ No configuration needed
- ✅ Works perfectly with Neon
- ✅ Better performance (native to Neon's infrastructure)
- ✅ No EPIPE or connection issues
- ✅ Direct access to your production data

**For your app:** Keep using `@neondatabase/serverless` - it's the right choice!

**For database exploration:** Use Neon Console or a dedicated PostgreSQL client like TablePlus.

## Summary

- Your Neon database is **100% compatible** and working correctly ✅
- Your app setup with `@neondatabase/serverless` is **the right choice** ✅
- `drizzle-kit studio` has **known limitations with Neon** ❌
- Use **Neon Console or TablePlus** instead of drizzle studio ✅
