# Multi-Account Setup Guide

This guide explains how to set up the ProfitabEdge DataBridge EA to work with multiple trading accounts simultaneously.

## Approach: Multiple MT5 Instances (Recommended)

Since MT5's architecture is designed for one account per terminal, the best way to track multiple accounts is to run multiple MT5 instances.

### Option 1: Multiple MT5 Installations

**Windows:**
1. Download MT5 installer from your broker
2. Install MT5 to different directories:
   - `C:\Program Files\MetaTrader 5 - Account1`
   - `C:\Program Files\MetaTrader 5 - Account2`
   - `C:\Program Files\MetaTrader 5 - Account3`
3. Log into each account in its respective MT5 instance
4. Copy the EA to each installation's `MQL5/Experts` folder
5. Attach the EA to a chart in each instance

**macOS:**
1. Download MT5 from your broker
2. After installing, duplicate the MT5 app:
   - Right-click MetaTrader 5.app → Duplicate
   - Rename to "MetaTrader 5 - Account1.app"
   - Repeat for each account
3. Log into each account in its respective app
4. Copy the EA to each app's MQL5/Experts folder
5. Attach the EA to a chart in each instance

### Option 2: MT5 Portable Installations

**Best for Windows users:**
1. Download MT5 portable version from your broker
2. Extract to separate folders:
   - `D:\MT5\Account1`
   - `D:\MT5\Account2`
   - `D:\MT5\Account3`
3. Each folder is a complete, independent MT5 installation
4. Log into different accounts in each
5. Copy the EA to each folder's `MQL5/Experts` directory

### Option 3: Virtual Machines (Advanced)

For enterprise setups with many accounts:
1. Use VirtualBox or VMware
2. Create separate Windows VMs for each account
3. Install MT5 in each VM
4. Better isolation and stability

---

## EA Configuration for Each Account

When setting up the EA in each MT5 instance:

### 1. Get Your API Key
- Go to your dashboard settings: `/dashboard/settings`
- Generate an API key for each account (or use the same key for all)

### 2. Configure EA Settings

For **Account 1** (MT5 Instance 1):
```
API_KEY = "your-api-key-here"
API_URL = "http://localhost:3000/trpc/webhook.updateAccountStatus"
ACCOUNT_ID = "" (leave empty - auto-detected)
UPDATE_INTERVAL_MS = 5000
```

For **Account 2** (MT5 Instance 2):
```
API_KEY = "your-api-key-here"
API_URL = "http://localhost:3000/trpc/webhook.updateAccountStatus"
ACCOUNT_ID = "" (leave empty - auto-detected)
UPDATE_INTERVAL_MS = 5000
```

**Important:** The EA will automatically register each account using the broker's account number. You don't need to manually set ACCOUNT_ID.

---

## Verification

After setting up multiple instances:

1. **Check Dashboard**
   - Go to your dashboard
   - You should see multiple accounts in the account selector
   - Each account will have its own metrics, trades, and data

2. **Check Live Indicators**
   - Each account card should show a pulsing "LIVE" indicator
   - The "Account Equity" widget updates every 2 seconds
   - "Open Trades" widget shows real-time positions

3. **Check Logs**
   - In each MT5 instance, go to: Terminal → Experts tab
   - You should see: "profitabledge DataBridge EA Started"
   - And periodic updates: "Account status sent successfully"

---

## Troubleshooting

### Problem: Accounts conflict or overwrite each other
**Solution:** Make sure each MT5 instance is logged into a **different** account number. The system uses the broker's account number as a unique identifier.

### Problem: Only one account shows as "verified"
**Solution:**
- Check that the EA is running in each MT5 instance
- Look for the green "LIVE" indicator next to each account
- Check MT5 Experts logs for errors

### Problem: Data not updating for some accounts
**Solution:**
- Ensure all MT5 instances are connected to the internet
- Check the API_URL is correct in each EA
- Verify the API key is valid
- Make sure the EA is attached to a chart with active ticks

### Problem: High CPU usage with multiple instances
**Solution:**
- Reduce UPDATE_INTERVAL_MS to 10000 (10 seconds) instead of 5000
- Set MAX_SYMBOLS to a lower value (e.g., 5)
- Use TRACK_ALL_SYMBOLS = false to only track open positions

---

## Resource Usage

Expected resource usage per MT5 instance:
- **RAM:** ~200-300 MB per instance
- **CPU:** ~2-5% per instance (idle)
- **Network:** ~1-5 KB/s per instance

For 5 accounts:
- Total RAM: ~1-1.5 GB
- Total CPU: ~10-25%
- Minimal network bandwidth

This is very manageable on modern computers.

---

## Advanced: Auto-Restart on Errors

To ensure your EAs keep running even if MT5 crashes:

**Windows (Task Scheduler):**
1. Create a batch file for each MT5 instance
2. Use Task Scheduler to restart MT5 if it closes
3. Set EA to auto-attach to charts

**macOS (launchd):**
1. Create launch agents for each MT5 instance
2. Set them to restart on failure

---

## Security Considerations

1. **API Keys:**
   - Use a different API key per account for better tracking
   - Revoke keys immediately if compromised

2. **Local Network:**
   - If running on local network, ensure firewall allows port 3000
   - Consider using HTTPS in production

3. **Backups:**
   - Each MT5 instance maintains its own logs
   - Backup EA settings from each instance

---

## Support

If you need help setting up multiple accounts:
1. Check the logs in each MT5 instance (Experts tab)
2. Verify accounts appear in the dashboard account selector
3. Contact support with your account numbers and error logs
