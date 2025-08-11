# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack TypeScript monorepo built with Better-T-Stack, featuring:
- **Frontend**: Next.js app (port 3001) with React 19, TailwindCSS v4, shadcn/ui components
- **Backend**: Next.js API (port 3000) with tRPC for type-safe APIs
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with email/password
- **Build System**: Turborepo with Bun runtime

## Development Commands

```bash
# Install dependencies
bun install

# Development (starts both web and server)
bun dev

# Individual apps
bun dev:web      # Frontend only (port 3001)
bun dev:server   # Backend only (port 3000)

# Building
bun build        # Build all apps
bun check-types  # TypeScript checking across monorepo

# Database operations
bun db:push      # Push schema changes to database
bun db:studio    # Open Drizzle Studio UI
bun db:generate  # Generate migrations
bun db:migrate   # Run migrations

# Individual app commands
cd apps/web && bun lint    # Lint frontend
cd apps/server && bun lint # Lint backend (if available)
```

## Architecture

### Monorepo Structure
- `apps/web/` - Next.js frontend with TypeScript project references to server
- `apps/server/` - Next.js API backend with tRPC routes
- Shared TypeScript configuration and build pipeline via Turborepo

### Key Files
- `apps/server/src/routers/index.ts` - Main tRPC router
- `apps/server/src/lib/trpc.ts` - tRPC setup with protected procedures
- `apps/server/src/lib/auth.ts` - Better Auth configuration
- `apps/server/src/db/schema/auth.ts` - Database auth schema
- `apps/web/src/utils/trpc.ts` - Frontend tRPC client setup
- `drizzle.config.ts` - Database configuration

### Authentication Flow
- Better Auth handles email/password authentication
- Protected tRPC procedures check for valid session in context
- Frontend uses credentials: "include" for cookie-based auth
- Database schema includes user, session, account, and verification tables

### Database Setup Required
1. Set up PostgreSQL database
2. Configure `apps/server/.env` with DATABASE_URL
3. Run `bun db:push` to apply schema


## Environment Variables
Backend (`apps/server/.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Auth secret key
- `BETTER_AUTH_URL` - Auth base URL
- `CORS_ORIGIN` - Allowed CORS origin

Frontend (`apps/web/.env.local`):
- `NEXT_PUBLIC_SERVER_URL` - Backend API URL (typically http://localhost:3000)