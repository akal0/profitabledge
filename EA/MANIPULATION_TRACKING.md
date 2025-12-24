# Manipulation Structure Tracking - MQL5 EA Implementation Guide

## Overview

The manipulation structure tracking feature calculates adverse price movement during trade execution. This provides critical insights into:
- How much price moved against the trader before hitting TP/SL
- The maximum favorable price reached during the trade
- Whether trades are being entered during manipulation phases

## What to Track

For each closed trade, the EA must calculate and send:

### 1. **manipulationHigh** (double)
- The **highest price** reached during the trade lifetime
- For **longs**: This represents the best favorable price
- For **shorts**: This represents the worst adverse price
- Track from `OrderOpenTime()` to `OrderCloseTime()`

### 2. **manipulationLow** (double)
- The **lowest price** reached during the trade lifetime
- For **longs**: This represents the worst adverse price
- For **shorts**: This represents the best favorable price
- Track from `OrderOpenTime()` to `OrderCloseTime()`

### 3. **manipulationPips** (double)
- The **adverse price movement in pips**
- For **longs**: `(openPrice - manipulationLow) / pipSize`
- For **shorts**: `(manipulationHigh - openPrice) / pipSize`
- Only positive values (0 if price never moved against entry)

### 4. **entryPeakPrice** (double)
- The **maximum favorable price** during the trade
- For **longs**: Same as `manipulationHigh`
- For **shorts**: Same as `manipulationLow`

### 5. **entryPeakTimestamp** (datetime → ISO 8601 string)
- The **timestamp when the peak favorable price was reached**
- Convert to ISO 8601 format: `TimeToString(peakTime, TIME_DATE|TIME_MINUTES|TIME_SECONDS)`
- Then format as: `"YYYY-MM-DDTHH:MM:SSZ"`

## Implementation Strategy

### Option 1: Real-time Tracking (Recommended)

Track prices during the trade lifecycle for maximum accuracy:

```mql5
// Global or Class Variables
struct TradeTracking {
    ulong ticket;
    double highestPrice;
    double lowestPrice;
    datetime highestTime;
    datetime lowestTime;
    double openPrice;
    string symbol;
    ENUM_ORDER_TYPE type; // ORDER_TYPE_BUY or ORDER_TYPE_SELL
};

TradeTracking activeTracking[];

//+------------------------------------------------------------------+
//| OnTick - Update tracking for active trades                        |
//+------------------------------------------------------------------+
void OnTick() {
    // For each active trade
    for(int i = PositionsTotal() - 1; i >= 0; i--) {
        ulong ticket = PositionGetTicket(i);

        // Find or create tracking record
        int idx = FindTrackingIndex(ticket);
        if(idx == -1) {
            idx = InitializeTracking(ticket);
        }

        // Get current prices
        string symbol = PositionGetString(POSITION_SYMBOL);
        double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
        double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

        // Update highest/lowest
        if(type == POSITION_TYPE_BUY) {
            // For longs, track both bid prices
            if(bid > activeTracking[idx].highestPrice) {
                activeTracking[idx].highestPrice = bid;
                activeTracking[idx].highestTime = TimeCurrent();
            }
            if(bid < activeTracking[idx].lowestPrice) {
                activeTracking[idx].lowestPrice = bid;
                activeTracking[idx].lowestTime = TimeCurrent();
            }
        } else {
            // For shorts, track ask prices
            if(ask > activeTracking[idx].highestPrice) {
                activeTracking[idx].highestPrice = ask;
                activeTracking[idx].highestTime = TimeCurrent();
            }
            if(ask < activeTracking[idx].lowestPrice) {
                activeTracking[idx].lowestPrice = ask;
                activeTracking[idx].lowestTime = TimeCurrent();
            }
        }
    }
}

//+------------------------------------------------------------------+
//| When trade closes - Calculate and send manipulation data          |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                       const MqlTradeRequest& request,
                       const MqlTradeResult& result) {
    if(trans.type == TRADE_TRANSACTION_DEAL_ADD) {
        // Check if this is a position close
        if(HistoryDealSelect(trans.deal)) {
            ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);

            if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY) {
                ulong ticket = HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);

                // Find tracking data
                int idx = FindTrackingIndex(ticket);
                if(idx != -1) {
                    // Calculate manipulation metrics
                    TradeTracking track = activeTracking[idx];

                    string symbol = track.symbol;
                    double openPrice = track.openPrice;
                    double pipSize = GetPipSize(symbol);

                    double manipHigh = track.highestPrice;
                    double manipLow = track.lowestPrice;
                    double manipPips = 0.0;
                    double peakPrice = 0.0;
                    datetime peakTime;

                    if(track.type == ORDER_TYPE_BUY) {
                        // Long trade
                        manipPips = MathMax(0, (openPrice - manipLow) / pipSize);
                        peakPrice = manipHigh;
                        peakTime = track.highestTime;
                    } else {
                        // Short trade
                        manipPips = MathMax(0, (manipHigh - openPrice) / pipSize);
                        peakPrice = manipLow;
                        peakTime = track.lowestTime;
                    }

                    // Send to server with other trade data
                    SendClosedTradeData(
                        ticket,
                        manipHigh,
                        manipLow,
                        manipPips,
                        peakPrice,
                        TimeToISO8601(peakTime)
                    );

                    // Clean up tracking
                    RemoveTracking(idx);
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Get pip size for symbol                                          |
//+------------------------------------------------------------------+
double GetPipSize(string symbol) {
    // JPY pairs
    if(StringFind(symbol, "JPY") != -1) {
        return 0.01;
    }

    // Metals
    if(StringFind(symbol, "XAU") != -1 || StringFind(symbol, "XAG") != -1) {
        return 0.01;
    }

    // Standard forex pairs
    return 0.0001;
}

//+------------------------------------------------------------------+
//| Convert datetime to ISO 8601 string                              |
//+------------------------------------------------------------------+
string TimeToISO8601(datetime time) {
    MqlDateTime dt;
    TimeToStruct(time, dt);

    return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       dt.year, dt.mon, dt.day,
                       dt.hour, dt.min, dt.sec);
}
```

### Option 2: Historical Reconstruction (Fallback)

If real-time tracking isn't implemented, reconstruct from history:

```mql5
void CalculateManipulationForClosedTrade(ulong positionId) {
    // Get trade details from history
    if(!HistorySelectByPosition(positionId)) return;

    datetime openTime = 0;
    datetime closeTime = 0;
    string symbol = "";
    double openPrice = 0;
    ENUM_ORDER_TYPE type;

    // Extract from history deals
    for(int i = 0; i < HistoryDealsTotal(); i++) {
        ulong deal = HistoryDealGetTicket(i);
        ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);

        if(entry == DEAL_ENTRY_IN) {
            openTime = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
            openPrice = HistoryDealGetDouble(deal, DEAL_PRICE);
            symbol = HistoryDealGetString(deal, DEAL_SYMBOL);
            type = (ENUM_ORDER_TYPE)HistoryDealGetInteger(deal, DEAL_TYPE);
        } else if(entry == DEAL_ENTRY_OUT) {
            closeTime = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
        }
    }

    // Scan price bars between open and close
    double highest = 0;
    double lowest = DBL_MAX;
    datetime highestTime = 0;
    datetime lowestTime = 0;

    // Use M1 timeframe for granularity
    int bars = Bars(symbol, PERIOD_M1, openTime, closeTime);

    for(int i = 0; i < bars; i++) {
        datetime barTime = iTime(symbol, PERIOD_M1, i);
        if(barTime < openTime || barTime > closeTime) continue;

        double high = iHigh(symbol, PERIOD_M1, i);
        double low = iLow(symbol, PERIOD_M1, i);

        if(high > highest) {
            highest = high;
            highestTime = barTime;
        }
        if(low < lowest) {
            lowest = low;
            lowestTime = barTime;
        }
    }

    // Calculate manipulation
    double pipSize = GetPipSize(symbol);
    double manipPips = 0;
    double peakPrice = 0;
    datetime peakTime;

    if(type == ORDER_TYPE_BUY) {
        manipPips = MathMax(0, (openPrice - lowest) / pipSize);
        peakPrice = highest;
        peakTime = highestTime;
    } else {
        manipPips = MathMax(0, (highest - openPrice) / pipSize);
        peakPrice = lowest;
        peakTime = lowestTime;
    }

    // Send to server
    SendClosedTradeData(positionId, highest, lowest, manipPips, peakPrice, TimeToISO8601(peakTime));
}
```

## JSON Payload Example

When sending closed trades to the `webhook.syncClosedTrades` endpoint:

```json
{
  "apiKey": "your-api-key",
  "accountNumber": "12345678",
  "trades": [
    {
      "ticket": "123456789",
      "symbol": "EURUSD",
      "type": "buy",
      "volume": 0.1,
      "openPrice": 1.08500,
      "openTime": "2025-01-15T10:30:00Z",
      "closePrice": 1.08650,
      "closeTime": "2025-01-15T12:45:00Z",
      "sl": 1.08350,
      "tp": 1.08750,
      "swap": -0.50,
      "commission": -7.00,
      "profit": 15.00,
      "manipulationHigh": 1.08680,
      "manipulationLow": 1.08420,
      "manipulationPips": 8.0,
      "entryPeakPrice": 1.08680,
      "entryPeakTimestamp": "2025-01-15T12:30:00Z"
    }
  ]
}
```

## Important Notes

### Price Selection
- **For longs**: Use **BID** prices (you sell at bid)
- **For shorts**: Use **ASK** prices (you buy at ask)
- This ensures accurate representation of what the trader actually experienced

### Pip Calculation
- Use the correct pip size for each symbol
- JPY pairs: 0.01 (2 decimals)
- Most forex: 0.0001 (4 decimals)
- Metals (XAU, XAG): 0.01

### Timestamp Format
- Must be ISO 8601: `YYYY-MM-DDTHH:MM:SSZ`
- Use UTC timezone (Z suffix)
- Include seconds precision

### Performance Considerations
- Real-time tracking is more accurate but requires memory for active trades
- Historical reconstruction uses less memory but may miss sub-M1 price action
- For most use cases, M1 bar reconstruction is sufficient

## Testing Checklist

1. ✅ Open a long trade and verify `manipulationLow` tracks the lowest price
2. ✅ Open a short trade and verify `manipulationHigh` tracks the highest price
3. ✅ Verify `manipulationPips` is always >= 0
4. ✅ Verify `entryPeakPrice` tracks the best favorable price
5. ✅ Check that timestamps are in ISO 8601 format
6. ✅ Test with both winning and losing trades
7. ✅ Test with trades closed at SL, TP, and manually
8. ✅ Verify data appears correctly in the dashboard

## Database Storage

The manipulation data is stored in the `trade` table with these fields:
- `manipulation_high` (numeric) - Highest price during trade
- `manipulation_low` (numeric) - Lowest price during trade
- `manipulation_pips` (numeric) - Adverse movement in pips
- `entry_peak_price` (numeric) - Best favorable price
- `entry_peak_timestamp` (timestamp) - When peak was reached

These fields are then used to calculate advanced metrics:
- **Max R:R** - Maximum risk-reward achieved before price reversed
- **RR Capture Efficiency** - How much of the available move was captured
- **Manipulation structure analysis** - Understanding entry timing quality
