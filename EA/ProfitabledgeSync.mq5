//+------------------------------------------------------------------+
//|                                           ProfitabledgeSync.mq5 |
//|                                      Profitabledge Trade Tracker |
//|                                             https://profitabledge |
//+------------------------------------------------------------------+
#property copyright "Profitabledge"
#property link      "https://profitabledge.com"
#property version   "1.00"
#property description "Syncs trades with Profitabledge platform and tracks manipulation structure"

#include <Trade\Trade.mqh>

//--- Input parameters
input string API_KEY = "";                    // Your Profitabledge API Key
input string SERVER_URL = "http://localhost:3000/api/trpc"; // Server URL
input int SYNC_INTERVAL_SECONDS = 10;         // Sync interval in seconds
input bool ENABLE_LOGGING = true;             // Enable detailed logging

//--- Global variables
datetime lastSyncTime = 0;
string accountId = "";
bool accountRegistered = false;

//+------------------------------------------------------------------+
//| Trade tracking structure                                         |
//+------------------------------------------------------------------+
struct TradeTracking {
    ulong ticket;
    string symbol;
    double openPrice;
    datetime openTime;
    ENUM_POSITION_TYPE type;

    // Manipulation tracking
    double highestPrice;
    double lowestPrice;
    datetime highestTime;
    datetime lowestTime;

    // Initialization flag
    bool initialized;
};

TradeTracking activeTracking[];

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    if(API_KEY == "") {
        Alert("ERROR: API_KEY is required! Please set your API key in the EA settings.");
        return(INIT_PARAMETERS_INCORRECT);
    }

    Log("Profitabledge Sync EA initialized");
    Log("Account: " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)));

    // Register account on startup
    RegisterAccount();

    // Initialize tracking for existing positions
    InitializeExistingPositions();

    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    Log("EA stopped. Reason: " + IntegerToString(reason));
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
    // Update tracking for all active positions
    UpdateActiveTracking();

    // Periodic sync
    if(TimeCurrent() - lastSyncTime >= SYNC_INTERVAL_SECONDS) {
        SyncAccountStatus();
        SyncOpenTrades();
        lastSyncTime = TimeCurrent();
    }
}

//+------------------------------------------------------------------+
//| Trade transaction event handler                                  |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                       const MqlTradeRequest& request,
                       const MqlTradeResult& result) {
    // Handle position open
    if(trans.type == TRADE_TRANSACTION_POSITION) {
        InitializeTracking(trans.position);
    }

    // Handle position close
    if(trans.type == TRADE_TRANSACTION_DEAL_ADD) {
        if(HistoryDealSelect(trans.deal)) {
            ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);

            if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY) {
                ulong positionId = HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);

                // Send closed trade with manipulation data
                SendClosedTrade(positionId);

                // Clean up tracking
                RemoveTracking(positionId);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Initialize tracking for existing positions                       |
//+------------------------------------------------------------------+
void InitializeExistingPositions() {
    for(int i = PositionsTotal() - 1; i >= 0; i--) {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0) {
            InitializeTracking(ticket);
        }
    }
}

//+------------------------------------------------------------------+
//| Initialize tracking for a position                               |
//+------------------------------------------------------------------+
void InitializeTracking(ulong ticket) {
    if(!PositionSelectByTicket(ticket)) return;

    // Check if already tracking
    int idx = FindTrackingIndex(ticket);
    if(idx != -1) return; // Already tracking

    // Get position details
    string symbol = PositionGetString(POSITION_SYMBOL);
    double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
    datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
    ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

    // Get current prices
    double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
    double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

    // Add to tracking array
    int size = ArraySize(activeTracking);
    ArrayResize(activeTracking, size + 1);

    activeTracking[size].ticket = ticket;
    activeTracking[size].symbol = symbol;
    activeTracking[size].openPrice = openPrice;
    activeTracking[size].openTime = openTime;
    activeTracking[size].type = type;
    activeTracking[size].initialized = true;

    // Initialize high/low tracking
    if(type == POSITION_TYPE_BUY) {
        activeTracking[size].highestPrice = bid;
        activeTracking[size].lowestPrice = bid;
        activeTracking[size].highestTime = TimeCurrent();
        activeTracking[size].lowestTime = TimeCurrent();
    } else {
        activeTracking[size].highestPrice = ask;
        activeTracking[size].lowestPrice = ask;
        activeTracking[size].highestTime = TimeCurrent();
        activeTracking[size].lowestTime = TimeCurrent();
    }

    Log("Started tracking position #" + IntegerToString(ticket) + " (" + symbol + ")");
}

//+------------------------------------------------------------------+
//| Update tracking for all active positions                         |
//+------------------------------------------------------------------+
void UpdateActiveTracking() {
    for(int i = ArraySize(activeTracking) - 1; i >= 0; i--) {
        if(!activeTracking[i].initialized) continue;

        ulong ticket = activeTracking[i].ticket;

        // Check if position still exists
        if(!PositionSelectByTicket(ticket)) {
            // Position closed but we missed the event - handle it
            RemoveTracking(ticket);
            continue;
        }

        string symbol = activeTracking[i].symbol;
        ENUM_POSITION_TYPE type = activeTracking[i].type;

        // Get current prices
        double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
        double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

        // Update highest/lowest based on position type
        if(type == POSITION_TYPE_BUY) {
            // For longs, track bid prices
            if(bid > activeTracking[i].highestPrice) {
                activeTracking[i].highestPrice = bid;
                activeTracking[i].highestTime = TimeCurrent();
            }
            if(bid < activeTracking[i].lowestPrice) {
                activeTracking[i].lowestPrice = bid;
                activeTracking[i].lowestTime = TimeCurrent();
            }
        } else {
            // For shorts, track ask prices
            if(ask > activeTracking[i].highestPrice) {
                activeTracking[i].highestPrice = ask;
                activeTracking[i].highestTime = TimeCurrent();
            }
            if(ask < activeTracking[i].lowestPrice) {
                activeTracking[i].lowestPrice = ask;
                activeTracking[i].lowestTime = TimeCurrent();
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Find tracking index by ticket                                    |
//+------------------------------------------------------------------+
int FindTrackingIndex(ulong ticket) {
    for(int i = ArraySize(activeTracking) - 1; i >= 0; i--) {
        if(activeTracking[i].initialized && activeTracking[i].ticket == ticket) {
            return i;
        }
    }
    return -1;
}

//+------------------------------------------------------------------+
//| Remove tracking by ticket                                        |
//+------------------------------------------------------------------+
void RemoveTracking(ulong ticket) {
    int idx = FindTrackingIndex(ticket);
    if(idx == -1) return;

    // Shift array to remove element
    int size = ArraySize(activeTracking);
    for(int i = idx; i < size - 1; i++) {
        activeTracking[i] = activeTracking[i + 1];
    }
    ArrayResize(activeTracking, size - 1);

    Log("Stopped tracking position #" + IntegerToString(ticket));
}

//+------------------------------------------------------------------+
//| Register account with server                                     |
//+------------------------------------------------------------------+
void RegisterAccount() {
    string accountNumber = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    string accountName = AccountInfoString(ACCOUNT_NAME);
    string broker = AccountInfoString(ACCOUNT_COMPANY);
    string brokerServer = AccountInfoString(ACCOUNT_SERVER);
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    string currency = AccountInfoString(ACCOUNT_CURRENCY);
    int leverage = (int)AccountInfoInteger(ACCOUNT_LEVERAGE);

    string payload = "{"
        "\"apiKey\":\"" + API_KEY + "\","
        "\"accountNumber\":\"" + accountNumber + "\","
        "\"accountName\":\"" + accountName + "\","
        "\"broker\":\"" + broker + "\","
        "\"brokerServer\":\"" + brokerServer + "\","
        "\"initialBalance\":" + DoubleToString(balance, 2) + ","
        "\"currency\":\"" + currency + "\","
        "\"leverage\":" + IntegerToString(leverage) +
    "}";

    string response = SendRequest("webhook.registerAccount", payload);

    if(StringFind(response, "\"success\":true") != -1) {
        accountRegistered = true;

        // Extract accountId from response
        int start = StringFind(response, "\"accountId\":\"");
        if(start != -1) {
            start += 14;
            int end = StringFind(response, "\"", start);
            accountId = StringSubstr(response, start, end - start);
        }

        Log("Account registered successfully. ID: " + accountId);
    } else {
        Log("Account registration failed: " + response);
    }
}

//+------------------------------------------------------------------+
//| Sync account status                                              |
//+------------------------------------------------------------------+
void SyncAccountStatus() {
    if(!accountRegistered) return;

    string accountNumber = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    double margin = AccountInfoDouble(ACCOUNT_MARGIN);
    double freeMargin = AccountInfoDouble(ACCOUNT_FREEMARGIN);

    string payload = "{"
        "\"apiKey\":\"" + API_KEY + "\","
        "\"accountNumber\":\"" + accountNumber + "\","
        "\"balance\":" + DoubleToString(balance, 2) + ","
        "\"equity\":" + DoubleToString(equity, 2) + ","
        "\"margin\":" + DoubleToString(margin, 2) + ","
        "\"freeMargin\":" + DoubleToString(freeMargin, 2) +
    "}";

    SendRequest("webhook.updateAccountStatus", payload);
}

//+------------------------------------------------------------------+
//| Sync open trades                                                 |
//+------------------------------------------------------------------+
void SyncOpenTrades() {
    if(!accountRegistered) return;

    string accountNumber = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    string tradesArray = "";

    for(int i = PositionsTotal() - 1; i >= 0; i--) {
        ulong ticket = PositionGetTicket(i);
        if(ticket == 0) continue;

        string symbol = PositionGetString(POSITION_SYMBOL);
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        double volume = PositionGetDouble(POSITION_VOLUME);
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
        double sl = PositionGetDouble(POSITION_SL);
        double tp = PositionGetDouble(POSITION_TP);
        double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
        double swap = PositionGetDouble(POSITION_SWAP);
        double commission = 0; // MT5 doesn't provide commission for open positions easily
        double profit = PositionGetDouble(POSITION_PROFIT);
        string comment = PositionGetString(POSITION_COMMENT);
        long magic = PositionGetInteger(POSITION_MAGIC);

        if(tradesArray != "") tradesArray += ",";

        tradesArray += "{"
            "\"ticket\":\"" + IntegerToString(ticket) + "\","
            "\"symbol\":\"" + symbol + "\","
            "\"type\":\"" + (type == POSITION_TYPE_BUY ? "buy" : "sell") + "\","
            "\"volume\":" + DoubleToString(volume, 2) + ","
            "\"openPrice\":" + DoubleToString(openPrice, 5) + ","
            "\"openTime\":\"" + TimeToISO8601(openTime) + "\","
            "\"sl\":" + (sl > 0 ? DoubleToString(sl, 5) : "null") + ","
            "\"tp\":" + (tp > 0 ? DoubleToString(tp, 5) : "null") + ","
            "\"currentPrice\":" + DoubleToString(currentPrice, 5) + ","
            "\"swap\":" + DoubleToString(swap, 2) + ","
            "\"commission\":" + DoubleToString(commission, 2) + ","
            "\"profit\":" + DoubleToString(profit, 2) + ","
            "\"comment\":\"" + comment + "\","
            "\"magicNumber\":" + IntegerToString(magic) +
        "}";
    }

    string payload = "{"
        "\"apiKey\":\"" + API_KEY + "\","
        "\"accountNumber\":\"" + accountNumber + "\","
        "\"trades\":[" + tradesArray + "]"
    "}";

    SendRequest("webhook.syncOpenTrades", payload);
}

//+------------------------------------------------------------------+
//| Send closed trade with manipulation data                         |
//+------------------------------------------------------------------+
void SendClosedTrade(ulong positionId) {
    // Select position from history
    if(!HistorySelectByPosition(positionId)) {
        Log("ERROR: Could not find position #" + IntegerToString(positionId) + " in history");
        return;
    }

    // Get tracking data
    int idx = FindTrackingIndex(positionId);

    // Extract trade details from history
    string symbol = "";
    ENUM_ORDER_TYPE orderType;
    double volume = 0;
    double openPrice = 0;
    datetime openTime = 0;
    double closePrice = 0;
    datetime closeTime = 0;
    double sl = 0;
    double tp = 0;
    double swap = 0;
    double commission = 0;
    double profit = 0;
    string comment = "";
    long magic = 0;

    // Scan deals for this position
    int dealsTotal = HistoryDealsTotal();
    for(int i = 0; i < dealsTotal; i++) {
        ulong deal = HistoryDealGetTicket(i);
        if(HistoryDealGetInteger(deal, DEAL_POSITION_ID) != positionId) continue;

        ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);

        if(entry == DEAL_ENTRY_IN) {
            symbol = HistoryDealGetString(deal, DEAL_SYMBOL);
            orderType = (ENUM_ORDER_TYPE)HistoryDealGetInteger(deal, DEAL_TYPE);
            volume = HistoryDealGetDouble(deal, DEAL_VOLUME);
            openPrice = HistoryDealGetDouble(deal, DEAL_PRICE);
            openTime = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
            commission += HistoryDealGetDouble(deal, DEAL_COMMISSION);
            swap += HistoryDealGetDouble(deal, DEAL_SWAP);
            comment = HistoryDealGetString(deal, DEAL_COMMENT);
        } else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY) {
            closePrice = HistoryDealGetDouble(deal, DEAL_PRICE);
            closeTime = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
            profit = HistoryDealGetDouble(deal, DEAL_PROFIT);
            commission += HistoryDealGetDouble(deal, DEAL_COMMISSION);
            swap += HistoryDealGetDouble(deal, DEAL_SWAP);
        }
    }

    // Calculate manipulation data
    double manipHigh = 0;
    double manipLow = 0;
    double manipPips = 0;
    double peakPrice = 0;
    string peakTimestamp = "";

    if(idx != -1 && activeTracking[idx].initialized) {
        // Use tracked data
        TradeTracking track = activeTracking[idx];

        manipHigh = track.highestPrice;
        manipLow = track.lowestPrice;

        double pipSize = GetPipSize(symbol);

        if(track.type == POSITION_TYPE_BUY) {
            // Long trade
            manipPips = MathMax(0, (openPrice - manipLow) / pipSize);
            peakPrice = manipHigh;
            peakTimestamp = TimeToISO8601(track.highestTime);
        } else {
            // Short trade
            manipPips = MathMax(0, (manipHigh - openPrice) / pipSize);
            peakPrice = manipLow;
            peakTimestamp = TimeToISO8601(track.lowestTime);
        }
    }

    // Build JSON payload
    string accountNumber = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));

    string tradeJson = "{"
        "\"ticket\":\"" + IntegerToString(positionId) + "\","
        "\"symbol\":\"" + symbol + "\","
        "\"type\":\"" + (orderType == ORDER_TYPE_BUY ? "buy" : "sell") + "\","
        "\"volume\":" + DoubleToString(volume, 2) + ","
        "\"openPrice\":" + DoubleToString(openPrice, 5) + ","
        "\"openTime\":\"" + TimeToISO8601(openTime) + "\","
        "\"closePrice\":" + DoubleToString(closePrice, 5) + ","
        "\"closeTime\":\"" + TimeToISO8601(closeTime) + "\","
        "\"sl\":" + (sl > 0 ? DoubleToString(sl, 5) : "null") + ","
        "\"tp\":" + (tp > 0 ? DoubleToString(tp, 5) : "null") + ","
        "\"swap\":" + DoubleToString(swap, 2) + ","
        "\"commission\":" + DoubleToString(commission, 2) + ","
        "\"profit\":" + DoubleToString(profit, 2) + ","
        "\"comment\":\"" + comment + "\","
        "\"magicNumber\":" + IntegerToString(magic);

    // Add manipulation data if available
    if(manipHigh > 0 && manipLow > 0) {
        tradeJson += ","
            "\"manipulationHigh\":" + DoubleToString(manipHigh, 5) + ","
            "\"manipulationLow\":" + DoubleToString(manipLow, 5) + ","
            "\"manipulationPips\":" + DoubleToString(manipPips, 1) + ","
            "\"entryPeakPrice\":" + DoubleToString(peakPrice, 5) + ","
            "\"entryPeakTimestamp\":\"" + peakTimestamp + "\"";
    }

    tradeJson += "}";

    string payload = "{"
        "\"apiKey\":\"" + API_KEY + "\","
        "\"accountNumber\":\"" + accountNumber + "\","
        "\"trades\":[" + tradeJson + "]"
    "}";

    string response = SendRequest("webhook.syncClosedTrades", payload);

    if(StringFind(response, "\"success\":true") != -1) {
        Log("Closed trade #" + IntegerToString(positionId) + " synced successfully (P/L: " + DoubleToString(profit, 2) + ", Manip: " + DoubleToString(manipPips, 1) + " pips)");
    } else {
        Log("ERROR syncing closed trade: " + response);
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

//+------------------------------------------------------------------+
//| Send HTTP request to server                                      |
//+------------------------------------------------------------------+
string SendRequest(string method, string jsonPayload) {
    string url = SERVER_URL + "/" + method;

    char postData[];
    char resultData[];
    string resultHeaders;

    StringToCharArray(jsonPayload, postData, 0, StringLen(jsonPayload));

    int timeout = 5000; // 5 seconds

    int res = WebRequest(
        "POST",
        url,
        "Content-Type: application/json\r\n",
        timeout,
        postData,
        resultData,
        resultHeaders
    );

    if(res == -1) {
        int error = GetLastError();
        Log("ERROR: WebRequest failed. Error: " + IntegerToString(error));

        if(error == 4060) {
            Log("ERROR: URL not allowed. Add '" + SERVER_URL + "' to Tools -> Options -> Expert Advisors -> Allow WebRequest URLs");
        }

        return "";
    }

    string response = CharArrayToString(resultData);

    if(ENABLE_LOGGING) {
        Log("Request to " + method + " - Response: " + response);
    }

    return response;
}

//+------------------------------------------------------------------+
//| Logging helper                                                   |
//+------------------------------------------------------------------+
void Log(string message) {
    if(ENABLE_LOGGING) {
        Print("[Profitabledge] " + message);
    }
}
//+------------------------------------------------------------------+
