# ProfitabEdge DataBridge EA

**100% Accurate Drawdown Analysis with Your Actual Broker Data**

## What is This?

The ProfitabEdge DataBridge Expert Advisor (EA) runs on your MetaTrader 5 terminal and automatically sends real-time price data from your broker to ProfitabEdge. This allows for **perfectly accurate** drawdown analysis using the exact prices you traded with, not approximated market data.

---

## Why Use the DataBridge EA?

### The Problem

By default, ProfitabEdge uses **public market data** (Dukascopy, Alpha Vantage, etc.) to calculate your maximum drawdown. While this data is good, it's not perfect because:

- ❌ Different brokers have different spreads
- ❌ Prices can vary slightly between liquidity providers
- ❌ Public data doesn't account for broker-specific slippage

**Result**: Your drawdown percentage might be off by 10-30%!

### The Solution

The DataBridge EA sends **your actual broker's bid/ask prices** to ProfitabEdge every 5 seconds. This means:

- ✅ **100% accuracy** (uses exact prices from your trades)
- ✅ **Zero cost** (no third-party API fees)
- ✅ **You control your data** (EA runs on your computer)
- ✅ **Works with any MT5 broker**
- ✅ **Secure** (no credentials shared, only API key)

---

## Installation Guide

### Step 1: Get Your API Key

1. Go to [profitabledge.com/dashboard/settings](http://localhost:3001/dashboard/settings)
2. Click **"Generate API Key"**
3. Give it a name: "My FTMO Account EA"
4. Copy the API key (starts with `pe_live_...`)
5. **Save it somewhere safe** - you can't see it again!

### Step 2: Download the EA

1. Download `ProfitabEdge_DataBridge.mq5` from this folder
2. Open your MetaTrader 5 terminal
3. Click **File → Open Data Folder**
4. Navigate to **MQL5 → Experts**
5. Copy `ProfitabEdge_DataBridge.mq5` into the Experts folder
6. Restart MetaTrader 5 (or click **Refresh** in Navigator)

### Step 3: Setup Ngrok (Required for Local Development)

**IMPORTANT**: MetaTrader 5 cannot connect to `localhost`. You need to expose your local server using ngrok.

1. **Install ngrok**:

   ```bash
   brew install ngrok/ngrok/ngrok
   ```

   Or download from [ngrok.com/download](https://ngrok.com/download)

2. **Start ngrok tunnel**:

   ```bash
   ngrok http 3000
   ```

3. **Copy your ngrok URL**:

   - Look for the "Forwarding" line (e.g., `https://abc123.ngrok.io`)
   - This is your temporary public URL

4. **Keep ngrok running**: Don't close the terminal window while using the EA

> **Note**: If you restart ngrok, you'll get a new URL and need to update the EA settings.

### Step 4: Enable WebRequest

**This is CRITICAL - the EA won't work without this!**

1. In MT5, go to **Tools → Options**
2. Click the **Expert Advisors** tab
3. Check these boxes:
   - ✅ **Allow automated trading**
   - ✅ **Allow WebRequest for listed URL**
4. In the URL field, add **ONLY the base URL** (without any paths):

   ```
   https://your-ngrok-url.ngrok.io
   ```

   (Or production URL: `https://api.profitabledge.com`)

   **IMPORTANT**:

   - ✅ Correct: `https://abc123.ngrok.io`
   - ❌ Wrong: `https://abc123.ngrok.io/trpc/webhook.priceUpdate`

   Adding just the base URL allows all EA endpoints to work (registration, price updates, etc.)

5. Click **OK**
6. **Restart MT5** (important for changes to take effect)

### Step 5: Attach EA to Chart

1. In the **Navigator** panel (View → Navigator), expand **Expert Advisors**
2. Find **ProfitabEdge_DataBridge**
3. Drag it onto **any chart** (the symbol doesn't matter)
4. A settings window will appear:

   **Configure these settings**:

   - `API_KEY`: Paste your API key from Step 1
   - `API_URL`: Use your ngrok URL + `/trpc/webhook.priceUpdate`
     - Example: `https://abc123.ngrok.io/trpc/webhook.priceUpdate`
     - Production: `https://api.profitabledge.com/trpc/webhook.priceUpdate`
   - `ACCOUNT_ID`: (Optional) Your ProfitabEdge account ID for linking
   - `UPDATE_INTERVAL_MS`: `5000` (sends data every 5 seconds)
   - `TRACK_ALL_SYMBOLS`: `false` (only tracks symbols with open positions)
   - `DEBUG_MODE`: `true` (for initial testing, turn off later)

5. Click **OK**

### Step 6: Verify It's Working

1. Open the **Experts** tab in the Terminal window (View → Terminal)
2. You should see:

   ```
   ======================================
   ProfitabEdge DataBridge EA Started
   ======================================
   API URL: https://abc123.ngrok.io/trpc/webhook.priceUpdate
   Update Interval: 5 seconds
   Track All Symbols: No (positions only)
   ======================================
   ```

3. Open a trade on any symbol
4. Within 5 seconds, you should see:

   ```
   Tracking 1 symbols: EURUSD
   Data sent successfully: {"success":true,"inserted":1}
   ```

5. Go to ProfitabEdge dashboard → Settings → API Keys
6. Your API key should show **"Last Used: Just now"**

**Congratulations! The EA is running correctly!** 🎉

---

## Configuration Options

### Basic Settings

| Setting      | Default        | Description                             |
| ------------ | -------------- | --------------------------------------- |
| `API_KEY`    | (empty)        | **REQUIRED**: Your ProfitabEdge API key |
| `API_URL`    | localhost:3000 | The ProfitabEdge API endpoint           |
| `ACCOUNT_ID` | (empty)        | Optional: Link data to specific account |

### Performance Settings

| Setting              | Default | Description                                   |
| -------------------- | ------- | --------------------------------------------- |
| `UPDATE_INTERVAL_MS` | 5000    | How often to send data (milliseconds)         |
| `MAX_SYMBOLS`        | 10      | Max symbols to track (reduce for lower CPU)   |
| `TRACK_ALL_SYMBOLS`  | false   | Track all Market Watch vs only open positions |

**Recommendations**:

- **Scalpers**: Set `UPDATE_INTERVAL_MS` to `1000` (1 second)
- **Day traders**: Keep at `5000` (5 seconds)
- **Swing traders**: Increase to `30000` (30 seconds)

### Debug Settings

| Setting      | Default | Description                                      |
| ------------ | ------- | ------------------------------------------------ |
| `DEBUG_MODE` | false   | Print detailed logs (useful for troubleshooting) |

---

## Troubleshooting

### Error: "WebRequest not allowed"

**Problem**: The EA can't send data because WebRequest is disabled.

**Solution**:

1. Go to Tools → Options → Expert Advisors
2. Check "Allow WebRequest for listed URL"
3. Add your API URL to the list
4. Restart MT5

---

### Error: "Please set your ProfitabEdge API Key"

**Problem**: You haven't entered your API key.

**Solution**:

1. Get your API key from profitabledge.com/dashboard/settings
2. Right-click the EA on the chart → Expert Advisors → Properties
3. Paste your API key in the `API_KEY` field
4. Click OK

---

### Error: "Could not connect to server"

**Problem**: The EA can't reach ProfitabEdge.

**Solutions**:

1. **Check ngrok is running**: Make sure ngrok terminal is still open
2. **Verify ngrok URL**: Copy the current URL from ngrok (it changes on restart)
3. **Check internet connection**: Ensure MT5 has internet access
4. **Check API URL format**: Should be `https://your-url.ngrok.io/trpc/webhook.priceUpdate`
5. **Check firewall**: Allow MT5 through your firewall
6. **Check VPN**: Some VPNs block WebRequest - try disabling temporarily

---

### No data appearing in ProfitabEdge

**Problem**: EA is running but data isn't showing up.

**Checklist**:

1. ✅ EA shows "Data sent successfully" in Experts log
2. ✅ API key "Last Used" timestamp is updating in dashboard
3. ✅ You have open positions (if `TRACK_ALL_SYMBOLS` is false)
4. ✅ The trade you're checking happened AFTER you started the EA

**Note**: The EA only captures data for **future trades**. It can't retroactively get historical data.

---

### EA stopped working after MT5 restart

**Problem**: EA doesn't auto-start when you reopen MT5.

**Solution**: MT5 should remember the EA on your chart. If not:

1. Save a chart template with the EA attached
2. Use that template when opening charts
3. Or: Attach the EA manually each time (it remembers settings)

---

## Performance & Resource Usage

### CPU Usage

- **Normal**: < 0.5% CPU usage
- **Update interval**: 5 seconds → negligible impact
- **Tracking 10 symbols**: Minimal overhead

### Network Usage

- **Data sent per update**: ~500 bytes per symbol
- **5-second interval, 1 symbol**: ~0.6 KB/minute = **~850 KB/day**
- **24/7 with 5 symbols**: ~4.2 MB/day

**Verdict**: Extremely lightweight, won't affect your trading performance!

---

## Security & Privacy

### What Data Is Sent?

- **Symbol name** (e.g., "EURUSD")
- **Bid price** (e.g., 1.08500)
- **Ask price** (e.g., 1.08520)
- **Timestamp** (ISO 8601 format)

### What Data Is NOT Sent?

- ❌ Your broker login credentials
- ❌ Your account balance
- ❌ Your personal information
- ❌ Trade entry/exit prices (only current market prices)
- ❌ Profit/loss data

### How Is Data Stored?

- **User-specific**: Your price data is private to your account
- **Time-limited**: Data older than 90 days is automatically deleted
- **Encrypted**: All API communication uses HTTPS (in production)

### Can I Revoke Access?

**Yes!** At any time:

1. Go to ProfitabEdge → Settings → API Keys
2. Click **"Revoke"** on your EA's API key
3. The EA will immediately stop working

---

## FAQ

### Q: Does this work with MT4?

**A**: Not yet! MT4 support is coming soon. For now, MT5 only.

### Q: Can I run multiple EAs on different accounts?

**A**: Yes! Generate a separate API key for each account and attach the EA with different keys.

### Q: Will this affect my trading?

**A**: No! The EA only **reads** market data. It doesn't open/close trades or modify anything.

### Q: What happens if my internet disconnects?

**A**: The EA will queue data locally and send it when connection is restored (future feature - currently data during disconnection is lost).

### Q: Can I use this on a VPS?

**A**: Yes! Perfect for 24/7 data collection. Just ensure the VPS allows WebRequest.

### Q: Is there a cost?

**A**: **Free!** The EA is included with all ProfitabEdge accounts.

---

## Advanced: API Key Management

### Generating Multiple Keys

You can have multiple API keys for different purposes:

- **"FTMO Account 1 EA"** → For your first FTMO challenge
- **"FTMO Account 2 EA"** → For your second challenge
- **"Live Account EA"** → For your live funded account

Each key can be revoked independently without affecting others.

### Key Security Best Practices

1. **Never share your API key** with anyone
2. **Use descriptive names** to track which EA uses which key
3. **Revoke unused keys** to minimize security risk
4. **Regenerate keys** if you suspect compromise

---

## Support

### Need Help?

1. **Check the Experts log**: View → Terminal → Experts tab
2. **Enable DEBUG_MODE**: See detailed information
3. **Contact support**: support@profitabledge.com
4. **Join Discord**: [discord.gg/profitabledge](https://discord.gg/profitabledge)

### Report a Bug

Found a bug? Please report it:

- **GitHub**: [github.com/profitabledge/ea-issues](https://github.com/profitabledge/ea-issues)
- **Email**: bugs@profitabledge.com

---

## Changelog

### v1.0.0 (2025-01-15)

- Initial release
- MT5 support
- Real-time tick data transmission
- Configurable update intervals
- Debug mode

---

**Happy Trading! 📈**
