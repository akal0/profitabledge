//+------------------------------------------------------------------+
//|                                    profitabledge_DataBridge.mq5   |
//|                        Copyright 2025, profitabledge Team         |
//|                                   https://profitabledge.com      |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, profitabledge Team"
#property link      "https://profitabledge.com"
#property version   "2.00"
#property description "Sends real-time broker price data + manipulation tracking to profitabledge"
#property strict

//--- Input parameters
input string API_KEY = "pe_live_RT7a43_0xBplM7NcQEuTwDyhqBVlzwro";  // Your profitabledge API Key (get from dashboard)
input string API_URL = "https://c895cb5a4ba6.ngrok-free.app/trpc/webhook.priceUpdate";  // API Endpoint
input string ACCOUNT_ID = "";  // Optional: Your profitabledge Account ID
input int UPDATE_INTERVAL_MS = 5000;  // Send data every N milliseconds (5000 = 5 seconds)
input int MAX_SYMBOLS = 10;  // Maximum symbols to track (reduce for lower CPU usage)
input bool TRACK_ALL_SYMBOLS = true;  // Track all symbols in Market Watch vs only open positions
input bool DEBUG_MODE = true;  // Print debug messages to Experts log

//--- Global variables
datetime lastUpdateTime = 0;
int updateIntervalSeconds = UPDATE_INTERVAL_MS / 1000;
string trackedSymbols[];
int requestHandle = -1;
bool accountRegistered = false;  // Track if account is already registered
datetime lastHistorySync = 0;  // Track last time we synced closed trades

//+------------------------------------------------------------------+
//| Trade tracking structure for manipulation analysis               |
//+------------------------------------------------------------------+
struct TradeTracking {
    ulong ticket;
    string symbol;
    double openPrice;
    datetime openTime;
    int type;  // 0 = buy, 1 = sell

    // Manipulation tracking
    double highestPrice;
    double lowestPrice;
    datetime highestTime;
    datetime lowestTime;

    // SL/TP tracking (updated on each tick)
    double sl;
    double tp;

    bool initialized;
};

TradeTracking activeTracking[];

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Validate API key
   if(StringLen(API_KEY) == 0)
   {
      Alert("ERROR: Please set your profitabledge API Key in the EA settings!");
      Print("Get your API key from: https://profitabledge.com/dashboard/settings");
      return(INIT_FAILED);
   }

   // Validate URL format
   if(!StringFind(API_URL, "http") == 0)
   {
      Alert("ERROR: Invalid API URL. Must start with http:// or https://");
      return(INIT_FAILED);
   }

   Print("======================================");
   Print("profitabledge DataBridge EA Started");
   Print("Version 2.00 - WITH MANIPULATION TRACKING");
   Print("======================================");
   Print("API URL: ", API_URL);
   Print("Update Interval: ", updateIntervalSeconds, " seconds");
   Print("Track All Symbols: ", TRACK_ALL_SYMBOLS ? "Yes" : "No (positions only)");
   Print("Debug Mode: ", DEBUG_MODE ? "ON" : "OFF");
   Print("======================================");

   // Register MT5 account with profitabledge
   if(!accountRegistered)
   {
      RegisterAccount();
   }

   // Initialize tracking for existing open positions
   InitializeExistingPositions();

   // Initial symbol scan
   UpdateTrackedSymbols();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("profitabledge DataBridge EA Stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Update manipulation tracking for all active positions
   UpdateActiveTracking();

   // Check if enough time has passed since last update
   datetime currentTime = TimeCurrent();

   if(currentTime - lastUpdateTime < updateIntervalSeconds)
      return;  // Not time yet

   lastUpdateTime = currentTime;

   // Send account status update
   SendAccountStatus();

   // Send open trades sync
   SendOpenTrades();

   // Send closed trades history (once per hour)
   if(currentTime - lastHistorySync >= 3600)
   {
      SendClosedTrades();
      lastHistorySync = currentTime;
   }

   // Update list of symbols to track
   UpdateTrackedSymbols();

   // Gather price data
   string jsonData = BuildPriceDataJSON();

   if(StringLen(jsonData) == 0)
   {
      if(DEBUG_MODE)
         Print("No data to send (no positions or symbols)");
      return;
   }

   // Send data to profitabledge
   SendDataToprofitabledge(jsonData);
}

//+------------------------------------------------------------------+
//| Trade transaction event handler                                  |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                       const MqlTradeRequest& request,
                       const MqlTradeResult& result)
{
   // Handle position open
   if(trans.type == TRADE_TRANSACTION_POSITION)
   {
      InitializeTracking(trans.position);
   }

   // Handle position close
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      if(HistoryDealSelect(trans.deal))
      {
         ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);

         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
         {
            ulong positionId = HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);

            if(DEBUG_MODE)
               Print("🔔 Position closed: #", positionId);

            // Send closed trade immediately with manipulation data
            SendSingleClosedTrade(positionId);

            // Clean up tracking
            RemoveTracking(positionId);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Initialize tracking for existing positions                       |
//+------------------------------------------------------------------+
void InitializeExistingPositions()
{
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         InitializeTracking(ticket);
      }
   }

   if(DEBUG_MODE && total > 0)
      Print("✅ Initialized tracking for ", total, " existing positions");
}

//+------------------------------------------------------------------+
//| Initialize tracking for a position                               |
//+------------------------------------------------------------------+
void InitializeTracking(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;

   // Check if already tracking
   int idx = FindTrackingIndex(ticket);
   if(idx != -1) return; // Already tracking

   // Get position details
   string symbol = PositionGetString(POSITION_SYMBOL);
   double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
   int type = (int)PositionGetInteger(POSITION_TYPE);
   double sl = PositionGetDouble(POSITION_SL);
   double tp = PositionGetDouble(POSITION_TP);

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
   activeTracking[size].sl = sl;
   activeTracking[size].tp = tp;
   activeTracking[size].initialized = true;

   // Initialize high/low tracking
   if(type == 0) // Buy
   {
      activeTracking[size].highestPrice = bid;
      activeTracking[size].lowestPrice = bid;
   }
   else // Sell
   {
      activeTracking[size].highestPrice = ask;
      activeTracking[size].lowestPrice = ask;
   }

   activeTracking[size].highestTime = TimeCurrent();
   activeTracking[size].lowestTime = TimeCurrent();

   if(DEBUG_MODE)
      Print("📊 Started tracking position #", ticket, " (", symbol, ")");
}

//+------------------------------------------------------------------+
//| Update tracking for all active positions                         |
//+------------------------------------------------------------------+
void UpdateActiveTracking()
{
   for(int i = ArraySize(activeTracking) - 1; i >= 0; i--)
   {
      if(!activeTracking[i].initialized) continue;

      ulong ticket = activeTracking[i].ticket;

      // Check if position still exists
      if(!PositionSelectByTicket(ticket))
      {
         RemoveTracking(ticket);
         continue;
      }

      string symbol = activeTracking[i].symbol;
      int type = activeTracking[i].type;

      // Update SL/TP (they can be modified at any time)
      activeTracking[i].sl = PositionGetDouble(POSITION_SL);
      activeTracking[i].tp = PositionGetDouble(POSITION_TP);

      // Get current prices
      double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

      // Update highest/lowest based on position type
      if(type == 0) // Buy position
      {
         // Track bid prices
         if(bid > activeTracking[i].highestPrice)
         {
            activeTracking[i].highestPrice = bid;
            activeTracking[i].highestTime = TimeCurrent();
         }
         if(bid < activeTracking[i].lowestPrice)
         {
            activeTracking[i].lowestPrice = bid;
            activeTracking[i].lowestTime = TimeCurrent();
         }
      }
      else // Sell position
      {
         // Track ask prices
         if(ask > activeTracking[i].highestPrice)
         {
            activeTracking[i].highestPrice = ask;
            activeTracking[i].highestTime = TimeCurrent();
         }
         if(ask < activeTracking[i].lowestPrice)
         {
            activeTracking[i].lowestPrice = ask;
            activeTracking[i].lowestTime = TimeCurrent();
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Find tracking index by ticket                                    |
//+------------------------------------------------------------------+
int FindTrackingIndex(ulong ticket)
{
   for(int i = ArraySize(activeTracking) - 1; i >= 0; i--)
   {
      if(activeTracking[i].initialized && activeTracking[i].ticket == ticket)
         return i;
   }
   return -1;
}

//+------------------------------------------------------------------+
//| Remove tracking by ticket                                        |
//+------------------------------------------------------------------+
void RemoveTracking(ulong ticket)
{
   int idx = FindTrackingIndex(ticket);
   if(idx == -1) return;

   // Shift array to remove element
   int size = ArraySize(activeTracking);
   for(int i = idx; i < size - 1; i++)
   {
      activeTracking[i] = activeTracking[i + 1];
   }
   ArrayResize(activeTracking, size - 1);

   if(DEBUG_MODE)
      Print("🗑️ Stopped tracking position #", ticket);
}

//+------------------------------------------------------------------+
//| Get pip size for symbol                                          |
//+------------------------------------------------------------------+
double GetPipSize(string symbol)
{
   // JPY pairs
   if(StringFind(symbol, "JPY") != -1)
      return 0.01;

   // Metals
   if(StringFind(symbol, "XAU") != -1 || StringFind(symbol, "XAG") != -1)
      return 0.01;

   // Standard forex pairs
   return 0.0001;
}

//+------------------------------------------------------------------+
//| Convert datetime to ISO 8601 string                              |
//+------------------------------------------------------------------+
string TimeToISO8601(datetime time)
{
   MqlDateTime dt;
   TimeToStruct(time, dt);

   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                      dt.year, dt.mon, dt.day,
                      dt.hour, dt.min, dt.sec);
}

//+------------------------------------------------------------------+
//| Register MT5 account with profitabledge                          |
//+------------------------------------------------------------------+
void RegisterAccount()
{
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   string accountName = AccountInfoString(ACCOUNT_NAME);
   string accountServer = AccountInfoString(ACCOUNT_SERVER);
   double accountBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   long accountLeverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
   string brokerName = AccountInfoString(ACCOUNT_COMPANY);

   string broker = StringSubstr(accountServer, 0, StringFind(accountServer, "-"));
   StringToLower(broker);

   string currencySymbol = "$";
   if(accountCurrency == "EUR") currencySymbol = "€";
   else if(accountCurrency == "GBP") currencySymbol = "£";

   string registerUrl = API_URL;
   StringReplace(registerUrl, "webhook.priceUpdate", "webhook.registerAccount");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"accountName\":\"%s\",\"broker\":\"%s\",\"brokerServer\":\"%s\",\"initialBalance\":%f,\"currency\":\"%s\",\"leverage\":%d}",
      API_KEY,
      accountNumber,
      accountName,
      broker,
      accountServer,
      accountBalance,
      currencySymbol,
      accountLeverage
   );

   char postData[];
   string headers = "Content-Type: application/json\r\n";

   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   int res = WebRequest(
      "POST",
      registerUrl,
      headers,
      10000,
      postData,
      result,
      resultHeaders
   );

   if(res == 200)
   {
      string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

      if(StringFind(responseText, "Account already registered") >= 0)
         Print("✅ Account already registered with profitabledge");
      else
         Print("✅ Account registered successfully with profitabledge");

      accountRegistered = true;

      if(DEBUG_MODE)
         Print("Response: ", responseText);
   }
   else if(res == -1)
   {
      int errorCode = GetLastError();
      if(errorCode == 4060)
      {
         Print("❌ WARNING: WebRequest not enabled for URL");
         Print("Add this URL to allowed WebRequest URLs: ", registerUrl);
      }
      else
      {
         Print("❌ ERROR: WebRequest failed with code: ", errorCode);
      }
   }
}

//+------------------------------------------------------------------+
//| Update the list of symbols to track                             |
//+------------------------------------------------------------------+
void UpdateTrackedSymbols()
{
   ArrayResize(trackedSymbols, 0);

   if(TRACK_ALL_SYMBOLS)
   {
      for(int i = 0; i < SymbolsTotal(true); i++)
      {
         string sym = SymbolName(i, true);
         if(ArraySize(trackedSymbols) < MAX_SYMBOLS)
         {
            ArrayResize(trackedSymbols, ArraySize(trackedSymbols) + 1);
            trackedSymbols[ArraySize(trackedSymbols) - 1] = sym;
         }
         else
            break;
      }
   }
   else
   {
      for(int i = 0; i < PositionsTotal(); i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket > 0)
         {
            string sym = PositionGetString(POSITION_SYMBOL);

            bool found = false;
            for(int j = 0; j < ArraySize(trackedSymbols); j++)
            {
               if(trackedSymbols[j] == sym)
               {
                  found = true;
                  break;
               }
            }

            if(!found && ArraySize(trackedSymbols) < MAX_SYMBOLS)
            {
               ArrayResize(trackedSymbols, ArraySize(trackedSymbols) + 1);
               trackedSymbols[ArraySize(trackedSymbols) - 1] = sym;
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Build JSON payload with current price data                       |
//+------------------------------------------------------------------+
string BuildPriceDataJSON()
{
   if(ArraySize(trackedSymbols) == 0)
      return "";

   string pricesArray = "";
   int priceCount = 0;

   for(int i = 0; i < ArraySize(trackedSymbols); i++)
   {
      string symbol = trackedSymbols[i];

      double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

      if(bid == 0 || ask == 0)
         continue;

      MqlDateTime dt;
      TimeToStruct(TimeCurrent(), dt);
      string timestamp = StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                                       dt.year, dt.mon, dt.day,
                                       dt.hour, dt.min, dt.sec);

      string priceObj = StringFormat(
         "{\"symbol\":\"%s\",\"bid\":%.5f,\"ask\":%.5f,\"timestamp\":\"%s\"}",
         symbol, bid, ask, timestamp
      );

      if(priceCount > 0)
         pricesArray += ",";

      pricesArray += priceObj;
      priceCount++;
   }

   if(priceCount == 0)
      return "";

   string accountIdField = StringLen(ACCOUNT_ID) > 0
      ? StringFormat(",\"accountId\":\"%s\"", ACCOUNT_ID)
      : "";

   string json = StringFormat(
      "{\"apiKey\":\"%s\"%s,\"prices\":[%s]}",
      API_KEY, accountIdField, pricesArray
   );

   return json;
}

//+------------------------------------------------------------------+
//| Send data to profitabledge API via HTTP POST                     |
//+------------------------------------------------------------------+
void SendDataToprofitabledge(string jsonData)
{
   char postData[];
   string headers = "Content-Type: application/json\r\n";

   StringToCharArray(jsonData, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   ResetLastError();

   char result[];
   string resultHeaders;

   int res = WebRequest(
      "POST",
      API_URL,
      headers,
      5000,
      postData,
      result,
      resultHeaders
   );

   if(res == -1)
   {
      int errorCode = GetLastError();

      if(errorCode == 4060)
      {
         Print("ERROR: WebRequest not allowed. Add URL: ", API_URL);
      }
      else
      {
         Print("ERROR: WebRequest failed with code: ", errorCode);
      }

      return;
   }

   string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

   if(res == 200)
   {
      if(DEBUG_MODE)
         Print("✅ Price data sent successfully");
   }
   else
   {
      Print("ERROR: Server returned status ", res);
      Print("Response: ", responseText);
   }
}

//+------------------------------------------------------------------+
//| Send account status to profitabledge                            |
//+------------------------------------------------------------------+
void SendAccountStatus()
{
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.updateAccountStatus");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"freeMargin\":%.2f}",
      API_KEY,
      accountNumber,
      balance,
      equity,
      margin,
      freeMargin
   );

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Send open trades to profitabledge                               |
//+------------------------------------------------------------------+
void SendOpenTrades()
{
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   int totalPositions = PositionsTotal();

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.syncOpenTrades");

   string tradesJson = "";
   int tradeCount = 0;

   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         long type = PositionGetInteger(POSITION_TYPE);
         double volume = PositionGetDouble(POSITION_VOLUME);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
         double swap = PositionGetDouble(POSITION_SWAP);
         double commission = PositionGetDouble(POSITION_COMMISSION);
         double profit = PositionGetDouble(POSITION_PROFIT);
         string comment = PositionGetString(POSITION_COMMENT);
         long magic = PositionGetInteger(POSITION_MAGIC);

         string openTimeISO = TimeToISO8601(openTime);
         string tradeType = (type == POSITION_TYPE_BUY) ? "buy" : "sell";

         string tradeJson = StringFormat(
            "{\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"openPrice\":%.5f,\"openTime\":\"%s\",\"sl\":%.5f,\"tp\":%.5f,\"currentPrice\":%.5f,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"comment\":\"%s\",\"magicNumber\":%d}",
            ticket, symbol, tradeType, volume, openPrice, openTimeISO,
            sl, tp, currentPrice, swap, commission, profit, comment, magic
         );

         if(tradeCount > 0)
            tradesJson += ",";
         tradesJson += tradeJson;
         tradeCount++;
      }
   }

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"trades\":[%s]}",
      API_KEY, accountNumber, tradesJson
   );

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Send a single closed trade immediately with manipulation data    |
//+------------------------------------------------------------------+
void SendSingleClosedTrade(ulong positionId)
{
   if(!HistorySelectByPosition(positionId))
   {
      Print("❌ ERROR: Could not find position #", positionId, " in history");
      return;
   }

   // Extract trade details from history
   string symbol = "";
   int orderType = 0;
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

   // Try to get SL/TP from the tracking data first (most accurate)
   // The tracking data is updated on every tick, so it has the latest SL/TP
   int trackingIdx = FindTrackingIndex(positionId);
   if(trackingIdx != -1 && activeTracking[trackingIdx].initialized)
   {
      sl = activeTracking[trackingIdx].sl;
      tp = activeTracking[trackingIdx].tp;

      if(DEBUG_MODE)
         Print("✅ Got SL/TP from tracking data: SL=", sl, " | TP=", tp);
   }

   // If we still don't have SL/TP, try from orders
   if(DEBUG_MODE)
      Print("🔍 Checking orders for SL/TP (current: SL=", sl, " TP=", tp, ")");

   if(sl == 0 && tp == 0)
   {
      int ordersTotal = HistoryOrdersTotal();
      datetime latestOrderTime = 0;

      for(int i = ordersTotal - 1; i >= 0; i--)
      {
         ulong orderTicket = HistoryOrderGetTicket(i);
         if(HistoryOrderGetInteger(orderTicket, ORDER_POSITION_ID) == positionId)
         {
            datetime orderTime = (datetime)HistoryOrderGetInteger(orderTicket, ORDER_TIME_SETUP);
            ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)HistoryOrderGetInteger(orderTicket, ORDER_TYPE);
            ENUM_ORDER_STATE orderState = (ENUM_ORDER_STATE)HistoryOrderGetInteger(orderTicket, ORDER_STATE);

            // Only update if this order is more recent than what we've seen
            if(orderTime >= latestOrderTime)
            {
               double orderSL = HistoryOrderGetDouble(orderTicket, ORDER_SL);
               double orderTP = HistoryOrderGetDouble(orderTicket, ORDER_TP);

               sl = orderSL;
               tp = orderTP;
               latestOrderTime = orderTime;

               if(DEBUG_MODE)
               {
                  Print("📝 Found order #", orderTicket, " for position #", positionId);
                  Print("   Order Time: ", TimeToString(orderTime));
                  Print("   Order Type: ", EnumToString(orderType), " | State: ", EnumToString(orderState));
                  Print("   SL: ", orderSL, " | TP: ", orderTP);
               }
            }
         }
      }

      if(DEBUG_MODE && (sl > 0 || tp > 0))
         Print("✅ Final SL/TP from orders: SL=", sl, " | TP=", tp);
   }

   // Scan deals for this position
   int dealsTotal = HistoryDealsTotal();
   for(int i = 0; i < dealsTotal; i++)
   {
      ulong deal = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(deal, DEAL_POSITION_ID) != positionId) continue;

      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);

      if(entry == DEAL_ENTRY_IN)
      {
         symbol = HistoryDealGetString(deal, DEAL_SYMBOL);
         orderType = (int)HistoryDealGetInteger(deal, DEAL_TYPE);
         volume = HistoryDealGetDouble(deal, DEAL_VOLUME);
         openPrice = HistoryDealGetDouble(deal, DEAL_PRICE);
         openTime = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
         commission += HistoryDealGetDouble(deal, DEAL_COMMISSION);
         swap += HistoryDealGetDouble(deal, DEAL_SWAP);
         comment = HistoryDealGetString(deal, DEAL_COMMENT);

         // Only use deal SL/TP if we didn't find better values from orders
         if(sl == 0) sl = HistoryDealGetDouble(deal, DEAL_SL);
         if(tp == 0) tp = HistoryDealGetDouble(deal, DEAL_TP);
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
      {
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
   bool hasManipData = false;

   if(trackingIdx != -1 && activeTracking[trackingIdx].initialized)
   {
      TradeTracking track = activeTracking[trackingIdx];

      manipHigh = track.highestPrice;
      manipLow = track.lowestPrice;

      double pipSize = GetPipSize(symbol);

      if(track.type == 0) // Buy
      {
         manipPips = MathMax(0, (openPrice - manipLow) / pipSize);
         peakPrice = manipHigh;
         peakTimestamp = TimeToISO8601(track.highestTime);
      }
      else // Sell
      {
         manipPips = MathMax(0, (manipHigh - openPrice) / pipSize);
         peakPrice = manipLow;
         peakTimestamp = TimeToISO8601(track.lowestTime);
      }

      hasManipData = true;

      if(DEBUG_MODE)
      {
         Print("📊 Manipulation Data for #", positionId, ":");
         Print("   High: ", manipHigh, " | Low: ", manipLow);
         Print("   Manip Pips: ", DoubleToString(manipPips, 1));
         Print("   Peak Price: ", peakPrice, " @ ", peakTimestamp);
      }
   }
   else
   {
      if(DEBUG_MODE)
         Print("⚠️ No tracking data found for position #", positionId);
   }

   // Build JSON
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.syncClosedTrades");

   // Use symbol's actual digits for precision (avoids rounding)
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

   // Build trade JSON with exact precision
   string tradeJson = StringFormat(
      "{\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"openPrice\":%s,\"openTime\":\"%s\",\"closePrice\":%s,\"closeTime\":\"%s\",\"sl\":%s,\"tp\":%s,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"comment\":\"%s\",\"magicNumber\":%d",
      positionId, symbol,
      (orderType == 0 ? "buy" : "sell"),
      volume,
      DoubleToString(openPrice, digits), TimeToISO8601(openTime),
      DoubleToString(closePrice, digits), TimeToISO8601(closeTime),
      DoubleToString(sl, digits), DoubleToString(tp, digits),
      swap, commission, profit, comment, magic
   );

   // Add manipulation data if available (with exact precision)
   if(hasManipData)
   {
      tradeJson += StringFormat(
         ",\"manipulationHigh\":%s,\"manipulationLow\":%s,\"manipulationPips\":%.1f,\"entryPeakPrice\":%s,\"entryPeakTimestamp\":\"%s\"",
         DoubleToString(manipHigh, digits),
         DoubleToString(manipLow, digits),
         manipPips,
         DoubleToString(peakPrice, digits),
         peakTimestamp
      );
   }

   tradeJson += "}";

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"trades\":[%s]}",
      API_KEY, accountNumber, tradeJson
   );

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   int res = WebRequest(
      "POST",
      url,
      headers,
      10000,
      postData,
      result,
      resultHeaders
   );

   if(res == 200)
   {
      string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("✅ Closed trade #", positionId, " synced (P/L: ", DoubleToString(profit, 2),
            ", Manip: ", DoubleToString(manipPips, 1), " pips)");

      if(DEBUG_MODE)
         Print("Response: ", responseText);
   }
   else
   {
      string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("❌ ERROR syncing closed trade #", positionId, ": HTTP ", res);
      Print("Response: ", responseText);
   }
}

//+------------------------------------------------------------------+
//| Send closed trades history (bulk sync, no manipulation data)     |
//+------------------------------------------------------------------+
void SendClosedTrades()
{
   // This is the bulk historical sync - runs once per hour
   // Individual trades sent via SendSingleClosedTrade will have manipulation data

   datetime currentTime = TimeCurrent();
   datetime from = currentTime - (90 * 24 * 3600);
   datetime to = currentTime;

   if(!HistorySelect(from, to))
   {
      if(DEBUG_MODE)
         Print("Failed to select history");
      return;
   }

   int totalDeals = HistoryDealsTotal();
   string tradesJson = "";
   int tradeCount = 0;

   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

      ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(dealEntry != DEAL_ENTRY_OUT && dealEntry != DEAL_ENTRY_OUT_BY)
         continue;

      ulong positionTicket = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      double volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      double exitPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
      double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
      double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
      long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);

      double entryPrice = 0;
      datetime openTime = 0;
      double sl = 0;
      double tp = 0;

      // First try to get SL/TP from orders (most accurate)
      // We need to find the MOST RECENT order modification for this position
      int ordersTotal = HistoryOrdersTotal();
      datetime latestOrderTime = 0;

      for(int j = ordersTotal - 1; j >= 0; j--)
      {
         ulong orderTicket = HistoryOrderGetTicket(j);
         if(HistoryOrderGetInteger(orderTicket, ORDER_POSITION_ID) == positionTicket)
         {
            datetime orderTime = (datetime)HistoryOrderGetInteger(orderTicket, ORDER_TIME_SETUP);

            // Only update if this order is more recent than what we've seen
            if(orderTime >= latestOrderTime)
            {
               double orderSL = HistoryOrderGetDouble(orderTicket, ORDER_SL);
               double orderTP = HistoryOrderGetDouble(orderTicket, ORDER_TP);

               // Update SL/TP from this order (even if 0, because it's the most recent state)
               sl = orderSL;
               tp = orderTP;
               latestOrderTime = orderTime;
            }
         }
      }

      for(int j = 0; j < totalDeals; j++)
      {
         ulong entryDealTicket = HistoryDealGetTicket(j);
         if(entryDealTicket == 0) continue;

         ENUM_DEAL_ENTRY entryDealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(entryDealTicket, DEAL_ENTRY);
         if(entryDealEntry != DEAL_ENTRY_IN)
            continue;

         ulong entryPosTicket = HistoryDealGetInteger(entryDealTicket, DEAL_POSITION_ID);
         if(entryPosTicket == positionTicket)
         {
            entryPrice = HistoryDealGetDouble(entryDealTicket, DEAL_PRICE);
            openTime = (datetime)HistoryDealGetInteger(entryDealTicket, DEAL_TIME);

            // Only use deal SL/TP if we didn't find better values from orders
            if(sl == 0) sl = HistoryDealGetDouble(entryDealTicket, DEAL_SL);
            if(tp == 0) tp = HistoryDealGetDouble(entryDealTicket, DEAL_TP);
            break;
         }
      }

      if(entryPrice == 0 || openTime == 0)
         continue;

      string tradeType = (dealType == DEAL_TYPE_SELL) ? "sell" : "buy";

      // Use symbol's actual digits for exact precision
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      string tradeJson = StringFormat(
         "{\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"openPrice\":%s,\"openTime\":\"%s\",\"closePrice\":%s,\"closeTime\":\"%s\",\"sl\":%s,\"tp\":%s,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"comment\":\"%s\",\"magicNumber\":%d}",
         positionTicket, symbol, tradeType, volume,
         DoubleToString(entryPrice, digits), TimeToISO8601(openTime),
         DoubleToString(exitPrice, digits), TimeToISO8601(closeTime),
         DoubleToString(sl, digits), DoubleToString(tp, digits),
         swap, commission, profit, comment, magic
      );

      if(tradeCount > 0)
         tradesJson += ",";
      tradesJson += tradeJson;
      tradeCount++;

      if(tradeCount >= 100)
         break;
   }

   if(tradeCount == 0)
      return;

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.syncClosedTrades");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"trades\":[%s]}",
      API_KEY, accountNumber, tradesJson
   );

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   int res = WebRequest(
      "POST",
      url,
      headers,
      10000,
      postData,
      result,
      resultHeaders
   );

   if(res == 200)
   {
      Print("✅ Bulk sync: ", tradeCount, " historical trades");
   }
}

//+------------------------------------------------------------------+
