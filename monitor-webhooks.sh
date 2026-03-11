#!/bin/bash

# Monitor webhook performance in real-time
# Usage: ./monitor-webhooks.sh

echo "🔍 Monitoring Webhook Performance"
echo "=================================="
echo ""
echo "Watching for webhook logs..."
echo "Press Ctrl+C to stop"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to colorize output
colorize() {
    while read line; do
        if [[ $line == *"ERROR"* ]]; then
            echo -e "${RED}${line}${NC}"
        elif [[ $line == *"CACHE HIT"* ]]; then
            echo -e "${GREEN}${line}${NC}"
        elif [[ $line == *"COMPLETE"* ]]; then
            echo -e "${BLUE}${line}${NC}"
        elif [[ $line == *"START"* ]]; then
            echo -e "${YELLOW}${line}${NC}"
        else
            echo "$line"
        fi
    done
}

# Watch server logs for webhook activity
if command -v lnav &> /dev/null; then
    # Use lnav if available (better log viewer)
    lnav apps/server/.next/trace
else
    # Fallback to tail + grep
    tail -f apps/server/.next/trace 2>/dev/null | \
        grep -E '\[(priceUpdate|syncOpenTrades|updateAccountStatus|liveMetrics|registerAccount|syncClosedTrades)\]' | \
        grep --line-buffered -E 'START|COMPLETE|ERROR|CACHE' | \
        colorize
fi
