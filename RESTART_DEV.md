# How to Fix 404 on New Routes

The Settings pages were just created and Next.js dev server needs to pick them up.

## Solution: Restart Dev Server

### If using mprocs (bun dev:all):
1. Press `q` to quit mprocs
2. Run `bun dev:all` again

### If running servers separately:
1. Stop the web server (Ctrl+C)
2. Run `bun dev:web` again

### Quick Fix (Without full restart):
Try visiting these URLs to trigger Next.js to compile them:
- http://localhost:3001/dashboard/settings
- http://localhost:3001/dashboard/settings/ea-setup

Then refresh the page after a few seconds.

### Clear Next.js cache (if issue persists):
```bash
cd apps/web
rm -rf .next
bun dev
```

## Verify Routes Exist
```bash
# Check files exist
ls apps/web/src/app/\(dashboard\)/dashboard/settings/page.tsx
ls apps/web/src/app/\(dashboard\)/dashboard/settings/ea-setup/page.tsx

# Both should exist ✓
```
