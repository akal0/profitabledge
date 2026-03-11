//+------------------------------------------------------------------+
//|                                    profitabledge_DataBridge.mq5   |
//|                        Copyright 2025, profitabledge Team         |
//|                                   https://profitabledge.com      |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, profitabledge Team"
#property link      "https://profitabledge.com"
#property version   "3.0"
#property description "Sends real-time broker price data + manipulation tracking + post-exit tracking + session tags to profitabledge + TRADE COPIER"
#property strict

//--- Input parameters
input string API_KEY = "pe_live_RT7a43_0xBplM7NcQEuTwDyhqBVlzwro";  // Your profitabledge API Key (get from dashboard)
input string API_URL = "https://decoctive-debi-grayly.ngrok-free.dev/trpc/webhook.priceUpdate";  // API Endpoint
input string ACCOUNT_ID = "";  // Optional: Your profitabledge Account ID
input int UPDATE_INTERVAL_MS = 5000;  // Send data every N milliseconds (5000 = 5 seconds)
input int MAX_SYMBOLS = 10;  // Maximum symbols to track (reduce for lower CPU usage)
input bool TRACK_ALL_SYMBOLS = false;  // Track all Market Watch symbols vs only open/post-exit symbols
input bool DEBUG_MODE = true;  // Print debug messages to Experts log
input int POST_EXIT_TRACKING_SECONDS = 3600;  // Track price for N seconds after exit (default: 1 hour)
input bool AUTO_SESSION_TAGS = true;  // Auto-assign session tags based on trade open time
input int SESSION_TIME_MODE = 0;  // 0 = Auto (server->UTC), 1 = Server time, 2 = UTC
input int SESSION_UTC_OFFSET_MINUTES = 9999;  // Override UTC offset in minutes (9999 = auto)
input int ASIA_START_MINUTES = 0;  // 00:00
input int ASIA_END_MINUTES = 420;  // 07:00
input int LONDON_START_MINUTES = 420;  // 07:00
input int LONDON_END_MINUTES = 960;  // 16:00
input int NEW_YORK_START_MINUTES = 780;  // 13:00
input int NEW_YORK_END_MINUTES = 1320;  // 22:00
input int LONDON_LUNCH_START_MINUTES = 660;  // 11:00
input int LONDON_LUNCH_END_MINUTES = 780;  // 13:00
input int LONDON_CLOSE_START_MINUTES = 960;  // 16:00
input int LONDON_CLOSE_END_MINUTES = 1020;  // 17:00
input string ASIA_COLOR = "#FF33F3";  // Default Asia color
input string LONDON_COLOR = "#3357FF";  // Default London color
input string NEW_YORK_COLOR = "#FF5733";  // Default New York color
input string LONDON_LUNCH_COLOR = "#FF8C33";  // Default London Lunch color
input string LONDON_CLOSE_COLOR = "#8C33FF";  // Default London Close color
input bool INITIAL_SYNC_CLOSED_TRADES = true;  // Sync historical closed trades on first connect
input int HISTORY_SYNC_DAYS = 3650;  // How many days of closed trades to sync
input int HISTORY_SYNC_BATCH_SIZE = 100;  // Trades per batch when syncing history

// ============== TRADE COPIER SETTINGS ==============
input string COPIER_SEPARATOR = "--- Trade Copier ---";  // Copier Settings Section
input bool ENABLE_COPY_RECEIVER = true;  // Enable slave/receiver mode (receive copied trades)
input bool ENABLE_COPY_SENDER = true;     // Enable master/sender mode (send trade signals)
input int COPY_CHECK_INTERVAL_MS = 1000;  // Check for copy signals every N ms
input double COPY_MAX_SLIPPAGE_PIPS = 3.0;  // Max allowed slippage when copying
input int COPY_MAGIC_NUMBER = 12345678;   // Magic number for copied trades

//--- Global variables
datetime lastUpdateTime = 0;
int updateIntervalSeconds = UPDATE_INTERVAL_MS / 1000;
string trackedSymbols[];
int requestHandle = -1;
bool accountRegistered = false;  // Track if account is already registered
datetime lastHistorySync = 0;  // Track last time we synced closed trades

// Copy receiver variables
ulong lastCopyCheckTick = 0;

// Map master ticket -> slave ticket for tracking closes
struct CopyTicketMap {
   string masterTicket;
   ulong slaveTicket;
};
CopyTicketMap copiedTrades[];

// Track positions that we've already sent master signals for
ulong lastSentMasterTickets[];
int lastSentMasterTicketsCount = 0;

//+------------------------------------------------------------------+
//| Copier helpers                                                   |
//+------------------------------------------------------------------+
bool IsCopiedTradeComment(string comment)
{
   return StringLen(comment) > 0 && StringFind(comment, "Copied:") == 0;
}

bool IsCopiedPosition(ulong ticket)
{
   if(!PositionSelectByTicket(ticket))
      return false;

   string comment = PositionGetString(POSITION_COMMENT);
   return IsCopiedTradeComment(comment);
}

bool IsCopiedDeal(ulong dealTicket)
{
   string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
   return IsCopiedTradeComment(comment);
}

int FindCopiedTradeMapIndex(string masterTicket)
{
   for(int i = 0; i < ArraySize(copiedTrades); i++)
   {
      if(copiedTrades[i].masterTicket == masterTicket)
         return i;
   }

   return -1;
}

void UpsertCopiedTradeMap(string masterTicket, ulong slaveTicket)
{
   if(slaveTicket == 0)
      return;

   int idx = FindCopiedTradeMapIndex(masterTicket);
   if(idx != -1)
   {
      copiedTrades[idx].slaveTicket = slaveTicket;
      return;
   }

   int size = ArraySize(copiedTrades);
   ArrayResize(copiedTrades, size + 1);
   copiedTrades[size].masterTicket = masterTicket;
   copiedTrades[size].slaveTicket = slaveTicket;
}

ulong FindCopiedPositionTicket(string masterTicket, string symbol = "")
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong positionTicket = PositionGetTicket(i);
      if(positionTicket == 0 || !PositionSelectByTicket(positionTicket))
         continue;

      string comment = PositionGetString(POSITION_COMMENT);
      if(!IsCopiedTradeComment(comment))
         continue;

      if(StringFind(comment, masterTicket) == -1)
         continue;

      if(StringLen(symbol) > 0 && PositionGetString(POSITION_SYMBOL) != symbol)
         continue;

      return positionTicket;
   }

   return 0;
}

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
    double entrySpreadPips;
    double entryExpectedPrice;
    double lastBid;
    double lastAsk;
    int slModCount;
    int tpModCount;
    double lastSL;
    double lastTP;
    double entryBalance;
    double entryEquity;
    double entryMargin;
    double entryFreeMargin;
    double entryMarginLevel;
    bool trailingStopDetected;
    int entryDealCount;
    double entryVolume;
    int exitDealCount;
    double exitVolume;
    int scaleInCount;
    int scaleOutCount;
    int partialCloseCount;

    bool initialized;
};

TradeTracking activeTracking[];

//+------------------------------------------------------------------+
//| Post-Exit tracking structure for MPE Manip PE calculation        |
//+------------------------------------------------------------------+
struct PostExitTracking {
    ulong ticket;
    string symbol;
    int type;  // 0 = buy, 1 = sell (original trade direction)
    datetime closeTime;
    datetime trackingEndTime;

    // Post-exit peak tracking
    double postExitPeakPrice;
    datetime postExitPeakTime;

    // Original trade data (needed for final sync)
    string tradeJson;  // Pre-built JSON with all trade data except PE fields

    bool initialized;
};

PostExitTracking postExitTracking[];

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
   Print("Version 2.11 - WITH POST-EXIT + SESSION TAGS");
   Print("======================================");
   Print("API URL: ", API_URL);
   Print("Update Interval: ", updateIntervalSeconds, " seconds");
   Print("Track All Symbols: ", TRACK_ALL_SYMBOLS ? "Yes" : "No (positions only)");
   Print("Post-Exit Tracking: ", POST_EXIT_TRACKING_SECONDS, " seconds (", POST_EXIT_TRACKING_SECONDS/60, " mins)");
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

   if(COPY_CHECK_INTERVAL_MS > 0)
      EventSetMillisecondTimer((int)MathMax((double)COPY_CHECK_INTERVAL_MS, 250.0));

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("profitabledge DataBridge EA Stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Timer handler                                                    |
//+------------------------------------------------------------------+
void OnTimer()
{
   CheckPendingCopySignals();
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   CheckPendingCopySignals();

   // Update manipulation tracking for all active positions
   UpdateActiveTracking();

   // Update post-exit tracking for recently closed positions
   UpdatePostExitTracking();

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
      bool wasTracking = FindTrackingIndex(trans.position) != -1;
      InitializeTracking(trans.position);

      if(!wasTracking && trans.position > 0 && !IsCopiedPosition(trans.position))
         SendMasterTradeOpen(trans.position);
   }

   // Handle position close
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      if(HistoryDealSelect(trans.deal))
      {
         ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
         ulong positionId = HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
         int idx = FindTrackingIndex(positionId);

         if(idx != -1)
         {
            double dealVolume = HistoryDealGetDouble(trans.deal, DEAL_VOLUME);
            if(entry == DEAL_ENTRY_IN)
            {
               activeTracking[idx].entryDealCount++;
               activeTracking[idx].entryVolume += dealVolume;
               activeTracking[idx].scaleInCount = MathMax(0, activeTracking[idx].entryDealCount - 1);
            }
            else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
            {
               activeTracking[idx].exitDealCount++;
               activeTracking[idx].exitVolume += dealVolume;
               activeTracking[idx].scaleOutCount = MathMax(0, activeTracking[idx].exitDealCount - 1);
               if(PositionSelectByTicket(positionId))
                  activeTracking[idx].partialCloseCount = activeTracking[idx].exitDealCount;
            }
         }

         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
         {
            if(PositionSelectByTicket(positionId))
               return;

            double closePrice = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
            double dealProfit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
            bool copiedTrade = IsCopiedDeal(trans.deal);

            if(DEBUG_MODE)
               Print("🔔 Position closed: #", positionId);

            // Send closed trade immediately with manipulation data
            SendSingleClosedTrade(positionId);

            if(!copiedTrade)
               SendMasterTradeClose(positionId, closePrice, dealProfit);

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

         if(ENABLE_COPY_SENDER && !IsCopiedPosition(ticket))
            SendMasterTradeOpen(ticket);
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
   double pipSize = GetPipSize(symbol);

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
   activeTracking[size].entrySpreadPips = (pipSize > 0) ? ((ask - bid) / pipSize) : 0;
   activeTracking[size].entryExpectedPrice = (type == 0) ? ask : bid;
   activeTracking[size].lastBid = bid;
   activeTracking[size].lastAsk = ask;
   activeTracking[size].slModCount = 0;
   activeTracking[size].tpModCount = 0;
   activeTracking[size].lastSL = sl;
   activeTracking[size].lastTP = tp;
   activeTracking[size].entryBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   activeTracking[size].entryEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   activeTracking[size].entryMargin = AccountInfoDouble(ACCOUNT_MARGIN);
   activeTracking[size].entryFreeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   activeTracking[size].entryMarginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   activeTracking[size].trailingStopDetected = false;
   activeTracking[size].entryDealCount = 0;
   activeTracking[size].entryVolume = 0;
   activeTracking[size].exitDealCount = 0;
   activeTracking[size].exitVolume = 0;
   activeTracking[size].scaleInCount = 0;
   activeTracking[size].scaleOutCount = 0;
   activeTracking[size].partialCloseCount = 0;

   InitializeDealCountsFromHistory(
      ticket,
      activeTracking[size].entryDealCount,
      activeTracking[size].entryVolume,
      activeTracking[size].exitDealCount,
      activeTracking[size].exitVolume
   );
   InitializeOrderModsFromHistory(
      ticket,
      type,
      activeTracking[size].slModCount,
      activeTracking[size].tpModCount,
      activeTracking[size].trailingStopDetected
   );
   activeTracking[size].scaleInCount = MathMax(0, activeTracking[size].entryDealCount - 1);
   activeTracking[size].scaleOutCount = MathMax(0, activeTracking[size].exitDealCount - 1);
   if(PositionSelectByTicket(ticket))
      activeTracking[size].partialCloseCount = activeTracking[size].exitDealCount;
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
      double newSL = PositionGetDouble(POSITION_SL);
      double newTP = PositionGetDouble(POSITION_TP);
      bool slChanged = newSL != activeTracking[i].lastSL;
      bool tpChanged = newTP != activeTracking[i].lastTP;

      if(slChanged)
      {
         if(activeTracking[i].lastSL > 0 && newSL > 0)
         {
            if(activeTracking[i].type == 0 && newSL > activeTracking[i].lastSL)
               activeTracking[i].trailingStopDetected = true;
            if(activeTracking[i].type == 1 && newSL < activeTracking[i].lastSL)
               activeTracking[i].trailingStopDetected = true;
         }
         activeTracking[i].slModCount++;
         activeTracking[i].lastSL = newSL;
      }
      if(tpChanged)
      {
         activeTracking[i].tpModCount++;
         activeTracking[i].lastTP = newTP;
      }
      activeTracking[i].sl = newSL;
      activeTracking[i].tp = newTP;

      if((slChanged || tpChanged) && !IsCopiedPosition(ticket))
         SendMasterTradeModify(ticket, slChanged ? newSL : 0, tpChanged ? newTP : 0);

      // Update current volume (helps with scale in/out visibility)
      double currentVolume = PositionGetDouble(POSITION_VOLUME);
      if(currentVolume > 0 && activeTracking[i].entryVolume <= 0)
         activeTracking[i].entryVolume = currentVolume;

      // Get current prices
      double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

      // Update highest/lowest based on position type
      if(type == 0) // Buy position
      {
        // Track bid prices
        activeTracking[i].lastBid = bid;
        activeTracking[i].lastAsk = ask;
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
        activeTracking[i].lastBid = bid;
        activeTracking[i].lastAsk = ask;
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
//| Initialize deal counts for an open position                      |
//+------------------------------------------------------------------+
void InitializeDealCountsFromHistory(ulong positionId,
                                     int &entryDealCount,
                                     double &entryVolume,
                                     int &exitDealCount,
                                     double &exitVolume)
{
   entryDealCount = 0;
   entryVolume = 0;
   exitDealCount = 0;
   exitVolume = 0;

   datetime currentTime = TimeCurrent();
   int days = HISTORY_SYNC_DAYS;
   if(days <= 0) days = 1;
   datetime from = currentTime - (days * 24 * 3600);

   if(!HistorySelect(from, currentTime))
      return;

   int totalDeals = HistoryDealsTotal();
   for(int i = 0; i < totalDeals; i++)
   {
      ulong deal = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(deal, DEAL_POSITION_ID) != positionId)
         continue;

      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);
      double dealVolume = HistoryDealGetDouble(deal, DEAL_VOLUME);

      if(entry == DEAL_ENTRY_IN)
      {
         entryDealCount++;
         entryVolume += dealVolume;
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
      {
         exitDealCount++;
         exitVolume += dealVolume;
      }
   }
}

//+------------------------------------------------------------------+
//| Initialize SL/TP modifications from history                      |
//+------------------------------------------------------------------+
void InitializeOrderModsFromHistory(ulong positionId,
                                    int positionType,
                                    int &slModCount,
                                    int &tpModCount,
                                    bool &trailingStopDetected)
{
   slModCount = 0;
   tpModCount = 0;
   trailingStopDetected = false;

   datetime currentTime = TimeCurrent();
   int days = HISTORY_SYNC_DAYS;
   if(days <= 0) days = 1;
   datetime from = currentTime - (days * 24 * 3600);

   if(!HistorySelect(from, currentTime))
      return;

   datetime orderTimes[];
   double orderSLs[];
   double orderTPs[];

   int ordersTotal = HistoryOrdersTotal();
   for(int i = 0; i < ordersTotal; i++)
   {
      ulong orderTicket = HistoryOrderGetTicket(i);
      if(HistoryOrderGetInteger(orderTicket, ORDER_POSITION_ID) != positionId)
         continue;

      int idx = ArraySize(orderTimes);
      ArrayResize(orderTimes, idx + 1);
      ArrayResize(orderSLs, idx + 1);
      ArrayResize(orderTPs, idx + 1);

      orderTimes[idx] = (datetime)HistoryOrderGetInteger(orderTicket, ORDER_TIME_SETUP);
      orderSLs[idx] = HistoryOrderGetDouble(orderTicket, ORDER_SL);
      orderTPs[idx] = HistoryOrderGetDouble(orderTicket, ORDER_TP);
   }

   int orderCount = ArraySize(orderTimes);
   if(orderCount <= 1)
      return;

   for(int a = 0; a < orderCount - 1; a++)
   {
      for(int b = a + 1; b < orderCount; b++)
      {
         if(orderTimes[b] < orderTimes[a])
         {
            datetime tmpTime = orderTimes[a];
            orderTimes[a] = orderTimes[b];
            orderTimes[b] = tmpTime;

            double tmpSL = orderSLs[a];
            orderSLs[a] = orderSLs[b];
            orderSLs[b] = tmpSL;

            double tmpTP = orderTPs[a];
            orderTPs[a] = orderTPs[b];
            orderTPs[b] = tmpTP;
         }
      }
   }

   double lastSL = orderSLs[0];
   double lastTP = orderTPs[0];

   for(int k = 1; k < orderCount; k++)
   {
      if(orderSLs[k] != lastSL)
      {
         slModCount++;
         if(lastSL > 0)
         {
            if(positionType == 0 && orderSLs[k] > lastSL)
               trailingStopDetected = true;
            if(positionType == 1 && orderSLs[k] < lastSL)
               trailingStopDetected = true;
         }
         lastSL = orderSLs[k];
      }
      if(orderTPs[k] != lastTP)
      {
         tpModCount++;
         lastTP = orderTPs[k];
      }
   }
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
//| Update post-exit tracking for recently closed positions          |
//+------------------------------------------------------------------+
void UpdatePostExitTracking()
{
   datetime currentTime = TimeCurrent();

   for(int i = ArraySize(postExitTracking) - 1; i >= 0; i--)
   {
      if(!postExitTracking[i].initialized) continue;

      ulong ticket = postExitTracking[i].ticket;
      string symbol = postExitTracking[i].symbol;
      int type = postExitTracking[i].type;

      // Check if tracking period has ended
      if(currentTime >= postExitTracking[i].trackingEndTime)
      {
         // Tracking complete - send final data with PE metrics
         SendFinalClosedTradeWithPE(i);

         // Remove from tracking
         RemovePostExitTracking(ticket);
         continue;
      }

      // Update post-exit peak price
      double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

      if(type == 0) // Original trade was Buy
      {
         // Track bid prices (favorable direction is up)
         if(bid > postExitTracking[i].postExitPeakPrice)
         {
            postExitTracking[i].postExitPeakPrice = bid;
            postExitTracking[i].postExitPeakTime = currentTime;
         }
      }
      else // Original trade was Sell
      {
         // Track ask prices (favorable direction is down)
         if(ask < postExitTracking[i].postExitPeakPrice || postExitTracking[i].postExitPeakPrice == 0)
         {
            postExitTracking[i].postExitPeakPrice = ask;
            postExitTracking[i].postExitPeakTime = currentTime;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Initialize post-exit tracking for a closed position              |
//+------------------------------------------------------------------+
void InitializePostExitTracking(ulong ticket, string symbol, int type, datetime closeTime, string tradeJson)
{
   // Check if already tracking
   for(int i = 0; i < ArraySize(postExitTracking); i++)
   {
      if(postExitTracking[i].initialized && postExitTracking[i].ticket == ticket)
         return; // Already tracking
   }

   // Add to tracking array
   int size = ArraySize(postExitTracking);
   ArrayResize(postExitTracking, size + 1);

   postExitTracking[size].ticket = ticket;
   postExitTracking[size].symbol = symbol;
   postExitTracking[size].type = type;
   postExitTracking[size].closeTime = closeTime;
   postExitTracking[size].trackingEndTime = closeTime + POST_EXIT_TRACKING_SECONDS;
   postExitTracking[size].tradeJson = tradeJson;
   postExitTracking[size].initialized = true;

   // Initialize post-exit peak with current price
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

   if(type == 0) // Buy trade
   {
      postExitTracking[size].postExitPeakPrice = bid;
   }
   else // Sell trade
   {
      postExitTracking[size].postExitPeakPrice = ask;
   }

   postExitTracking[size].postExitPeakTime = TimeCurrent();

   if(DEBUG_MODE)
   {
      datetime endTime = postExitTracking[size].trackingEndTime;
      Print("📈 Started post-exit tracking for #", ticket, " (", symbol, ")");
      Print("   Will track until ", TimeToString(endTime), " (", POST_EXIT_TRACKING_SECONDS, " seconds)");
   }
}

//+------------------------------------------------------------------+
//| Remove post-exit tracking by ticket                              |
//+------------------------------------------------------------------+
void RemovePostExitTracking(ulong ticket)
{
   for(int i = ArraySize(postExitTracking) - 1; i >= 0; i--)
   {
      if(postExitTracking[i].initialized && postExitTracking[i].ticket == ticket)
      {
         // Shift array to remove element
         int size = ArraySize(postExitTracking);
         for(int j = i; j < size - 1; j++)
         {
            postExitTracking[j] = postExitTracking[j + 1];
         }
         ArrayResize(postExitTracking, size - 1);

         if(DEBUG_MODE)
            Print("✅ Completed post-exit tracking for #", ticket);

         return;
      }
   }
}

//+------------------------------------------------------------------+
//| Send final closed trade data with post-exit metrics              |
//+------------------------------------------------------------------+
void SendClosedTradePayload(string tradeJsonComplete, ulong ticket, string successLabel)
{
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.syncClosedTrades");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"trades\":[%s]}",
      API_KEY, accountNumber, tradeJsonComplete
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
      Print("✅ Closed trade #", ticket, " ", successLabel);

      if(DEBUG_MODE)
         Print("Response: ", responseText);
   }
   else
   {
      string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("❌ ERROR syncing closed trade #", ticket, ": HTTP ", res);
      Print("Response: ", responseText);
   }
}

void SendFinalClosedTradeWithPE(int peIndex)
{
   if(peIndex < 0 || peIndex >= ArraySize(postExitTracking))
      return;

   PostExitTracking pe = postExitTracking[peIndex];

   if(!pe.initialized)
      return;

   // Build complete JSON with post-exit data
   string finalJson = pe.tradeJson;

   // Add post-exit peak data
   int digits = (int)SymbolInfoInteger(pe.symbol, SYMBOL_DIGITS);

   string peData = StringFormat(
      ",\"postExitPeakPrice\":%s,\"postExitPeakTimestamp\":\"%s\",\"postExitSamplingDuration\":%d",
      DoubleToString(pe.postExitPeakPrice, digits),
      TimeToISO8601(pe.postExitPeakTime),
      POST_EXIT_TRACKING_SECONDS
   );

   int postExitPeakDurationSeconds = (int)MathMax(0, pe.postExitPeakTime - pe.closeTime);
   peData += StringFormat(
      ",\"postExitPeakDurationSeconds\":%d",
      postExitPeakDurationSeconds
   );

   finalJson += peData + "}";

   SendClosedTradePayload(finalJson, pe.ticket, "synced WITH POST-EXIT DATA");

   Print("   Post-Exit Peak: ", DoubleToString(pe.postExitPeakPrice, digits),
         " @ ", TimeToString(pe.postExitPeakTime));
}

//+------------------------------------------------------------------+
//| Get pip size for symbol                                          |
//+------------------------------------------------------------------+
double GetPipSize(string symbol)
{
   string upper = StringToUpper(symbol);

   // JPY pairs
   if(StringFind(upper, "JPY") != -1)
      return 0.01;

   // Metals
   if(StringFind(upper, "XAU") != -1 || StringFind(upper, "XAG") != -1)
      return 0.01;

   // Indices
   if(
      StringFind(upper, "US100") != -1 ||
      StringFind(upper, "NAS100") != -1 ||
      StringFind(upper, "NAS") != -1 ||
      StringFind(upper, "US500") != -1 ||
      StringFind(upper, "SPX") != -1 ||
      StringFind(upper, "SP500") != -1 ||
      StringFind(upper, "US30") != -1 ||
      StringFind(upper, "DJ30") != -1 ||
      StringFind(upper, "DOW") != -1 ||
      StringFind(upper, "GER30") != -1 ||
      StringFind(upper, "DE30") != -1 ||
      StringFind(upper, "GER40") != -1 ||
      StringFind(upper, "DE40") != -1
   )
      return 1.0;

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
//| Escape string for JSON output                                    |
//+------------------------------------------------------------------+
string EscapeJsonString(string value)
{
   string result = value;
   StringReplace(result, "\\", "\\\\");
   StringReplace(result, "\"", "\\\"");
   StringReplace(result, "\r", "\\r");
   StringReplace(result, "\n", "\\n");
   StringReplace(result, "\t", "\\t");
   return result;
}

//+------------------------------------------------------------------+
//| Session detection helpers                                        |
//+------------------------------------------------------------------+
int GetUtcOffsetMinutes()
{
   if(SESSION_UTC_OFFSET_MINUTES != 9999)
      return SESSION_UTC_OFFSET_MINUTES;

   int offsetSeconds = (int)(TimeCurrent() - TimeGMT());
   return (int)MathRound(offsetSeconds / 60.0);
}

int GetMinuteOfDay(datetime timeValue)
{
   MqlDateTime dt;
   TimeToStruct(timeValue, dt);
   return dt.hour * 60 + dt.min;
}

bool IsMinuteInRange(int minuteOfDay, int startMinutes, int endMinutes)
{
   if(startMinutes == endMinutes)
      return true;

   if(startMinutes < endMinutes)
      return (minuteOfDay >= startMinutes && minuteOfDay < endMinutes);

   return (minuteOfDay >= startMinutes || minuteOfDay < endMinutes);
}

string GetSessionColor(string sessionName)
{
   string name = sessionName;
   StringToLower(name);

   if(name == "asia")
      return ASIA_COLOR;
   if(name == "london")
      return LONDON_COLOR;
   if(name == "new york")
      return NEW_YORK_COLOR;
   if(name == "london lunch")
      return LONDON_LUNCH_COLOR;
   if(name == "london close")
      return LONDON_CLOSE_COLOR;

   return "#FF5733";
}

string DetectSessionTag(datetime tradeTime)
{
   if(!AUTO_SESSION_TAGS)
      return "";

   int mode = SESSION_TIME_MODE;
   int offsetMinutes = GetUtcOffsetMinutes();

   datetime refTime = tradeTime;
   if(mode == 2) // UTC
      refTime = tradeTime - (offsetMinutes * 60);
   else if(mode == 0) // Auto (server->UTC)
      refTime = tradeTime - (offsetMinutes * 60);

   int minuteOfDay = GetMinuteOfDay(refTime);

   if(IsMinuteInRange(minuteOfDay, LONDON_LUNCH_START_MINUTES, LONDON_LUNCH_END_MINUTES))
      return "London Lunch";
   if(IsMinuteInRange(minuteOfDay, LONDON_CLOSE_START_MINUTES, LONDON_CLOSE_END_MINUTES))
      return "London Close";
   if(IsMinuteInRange(minuteOfDay, NEW_YORK_START_MINUTES, NEW_YORK_END_MINUTES))
      return "New York";
   if(IsMinuteInRange(minuteOfDay, LONDON_START_MINUTES, LONDON_END_MINUTES))
      return "London";
   if(IsMinuteInRange(minuteOfDay, ASIA_START_MINUTES, ASIA_END_MINUTES))
      return "Asia";

   return "";
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
      EscapeJsonString(accountName),
      EscapeJsonString(broker),
      EscapeJsonString(accountServer),
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

      if(INITIAL_SYNC_CLOSED_TRADES)
      {
         if(DEBUG_MODE)
            Print("🔄 Initial history sync starting...");
         SendClosedTrades();
         lastHistorySync = TimeCurrent();
      }
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

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   string accountIdField = StringLen(ACCOUNT_ID) > 0
      ? StringFormat(",\"accountId\":\"%s\"", ACCOUNT_ID)
      : "";
   string accountNumberField = StringFormat(",\"accountNumber\":\"%d\"", accountNumber);

   string json = StringFormat(
      "{\"apiKey\":\"%s\"%s%s,\"prices\":[%s]}",
      API_KEY, accountIdField, accountNumberField, pricesArray
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
         string safeComment = EscapeJsonString(comment);
         string safeSymbol = EscapeJsonString(symbol);
         string sessionTag = DetectSessionTag(openTime);
         string sessionTagColor = "";
         if(sessionTag != "")
            sessionTagColor = GetSessionColor(sessionTag);
         int trackingIdx = FindTrackingIndex(ticket);
         int slModCount = 0;
         int tpModCount = 0;
         int entryDealCount = 0;
         int exitDealCount = 0;
         int partialCloseCount = 0;
         int scaleInCount = 0;
         int scaleOutCount = 0;
         double entryVolume = 0;
         double exitVolume = 0;
         bool trailingStopDetected = false;
         if(trackingIdx != -1 && activeTracking[trackingIdx].initialized)
         {
            slModCount = activeTracking[trackingIdx].slModCount;
            tpModCount = activeTracking[trackingIdx].tpModCount;
            entryDealCount = activeTracking[trackingIdx].entryDealCount;
            exitDealCount = activeTracking[trackingIdx].exitDealCount;
            partialCloseCount = activeTracking[trackingIdx].partialCloseCount;
            scaleInCount = activeTracking[trackingIdx].scaleInCount;
            scaleOutCount = activeTracking[trackingIdx].scaleOutCount;
            entryVolume = activeTracking[trackingIdx].entryVolume;
            exitVolume = activeTracking[trackingIdx].exitVolume;
            trailingStopDetected = activeTracking[trackingIdx].trailingStopDetected;
         }

         string tradeJson = StringFormat(
            "{\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"openPrice\":%.5f,\"openTime\":\"%s\",\"sl\":%.5f,\"tp\":%.5f,\"currentPrice\":%.5f,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"comment\":\"%s\",\"magicNumber\":%d,\"slModCount\":%d,\"tpModCount\":%d,\"partialCloseCount\":%d,\"exitDealCount\":%d,\"exitVolume\":%.2f,\"entryDealCount\":%d,\"entryVolume\":%.2f,\"scaleInCount\":%d,\"scaleOutCount\":%d,\"trailingStopDetected\":%s",
            ticket, safeSymbol, tradeType, volume, openPrice, openTimeISO,
            sl, tp, currentPrice, swap, commission, profit, safeComment, magic,
            slModCount,
            tpModCount,
            partialCloseCount,
            exitDealCount,
            exitVolume,
            entryDealCount,
            entryVolume,
            scaleInCount,
            scaleOutCount,
            trailingStopDetected ? "true" : "false"
         );

         if(sessionTag != "")
         {
            tradeJson += StringFormat(
               ",\"sessionTag\":\"%s\",\"sessionTagColor\":\"%s\"",
               EscapeJsonString(sessionTag),
               EscapeJsonString(sessionTagColor)
            );
         }

         tradeJson += "}";

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
   double entrySpreadPips = 0;
   bool hasEntrySpread = false;
   double entrySlippagePips = 0;
   double exitSlippagePips = 0;
   bool hasSlippage = false;
   int slModCount = 0;
   int tpModCount = 0;
   int exitDealCount = 0;
   double exitVolume = 0;
   int entryDealCount = 0;
   double entryVolume = 0;
   double entryBalance = 0;
   double entryEquity = 0;
   double entryMargin = 0;
   double entryFreeMargin = 0;
   double entryMarginLevel = 0;
   bool hasEntryAccountSnapshot = false;
   bool trailingStopDetected = false;

   // Try to get SL/TP from the tracking data first (most accurate)
   // The tracking data is updated on every tick, so it has the latest SL/TP
   int trackingIdx = FindTrackingIndex(positionId);
   if(trackingIdx != -1 && activeTracking[trackingIdx].initialized)
   {
      sl = activeTracking[trackingIdx].sl;
      tp = activeTracking[trackingIdx].tp;
      entrySpreadPips = activeTracking[trackingIdx].entrySpreadPips;
      hasEntrySpread = true;
      slModCount = activeTracking[trackingIdx].slModCount;
      tpModCount = activeTracking[trackingIdx].tpModCount;
      entryBalance = activeTracking[trackingIdx].entryBalance;
      entryEquity = activeTracking[trackingIdx].entryEquity;
      entryMargin = activeTracking[trackingIdx].entryMargin;
      entryFreeMargin = activeTracking[trackingIdx].entryFreeMargin;
      entryMarginLevel = activeTracking[trackingIdx].entryMarginLevel;
      hasEntryAccountSnapshot = true;
      trailingStopDetected = activeTracking[trackingIdx].trailingStopDetected;

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
         entryDealCount++;
         entryVolume += volume;

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
         exitDealCount++;
         exitVolume += HistoryDealGetDouble(deal, DEAL_VOLUME);
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
   double pipSize = GetPipSize(symbol);
   double bidNow = SymbolInfoDouble(symbol, SYMBOL_BID);
   double askNow = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double exitSpreadPips = (pipSize > 0) ? ((askNow - bidNow) / pipSize) : 0;
   double exitRefBid = bidNow;
   double exitRefAsk = askNow;

   if(trackingIdx != -1 && activeTracking[trackingIdx].initialized)
   {
      exitRefBid = activeTracking[trackingIdx].lastBid;
      exitRefAsk = activeTracking[trackingIdx].lastAsk;
   }

   if(pipSize > 0 && trackingIdx != -1 && activeTracking[trackingIdx].initialized)
   {
      double expectedEntry = activeTracking[trackingIdx].entryExpectedPrice;
      if(orderType == 0) // buy
         entrySlippagePips = MathAbs((openPrice - expectedEntry) / pipSize);
      else
         entrySlippagePips = MathAbs((expectedEntry - openPrice) / pipSize);

      if(orderType == 0) // buy exit on bid
         exitSlippagePips = MathAbs((closePrice - exitRefBid) / pipSize);
      else
         exitSlippagePips = MathAbs((exitRefAsk - closePrice) / pipSize);

      hasSlippage = true;
   }

   string sessionTag = DetectSessionTag(openTime);
   string sessionTagColor = "";
   if(sessionTag != "")
      sessionTagColor = GetSessionColor(sessionTag);
   string safeComment = EscapeJsonString(comment);
   string safeSymbol = EscapeJsonString(symbol);

   // Build trade JSON with exact precision
   string tradeJson = StringFormat(
      "{\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"openPrice\":%s,\"openTime\":\"%s\",\"closePrice\":%s,\"closeTime\":\"%s\",\"sl\":%s,\"tp\":%s,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"comment\":\"%s\",\"magicNumber\":%d",
      positionId, safeSymbol,
      (orderType == 0 ? "buy" : "sell"),
      volume,
      DoubleToString(openPrice, digits), TimeToISO8601(openTime),
      DoubleToString(closePrice, digits), TimeToISO8601(closeTime),
      DoubleToString(sl, digits), DoubleToString(tp, digits),
      swap, commission, profit, safeComment, magic
   );

   if(sessionTag != "")
   {
      tradeJson += StringFormat(
         ",\"sessionTag\":\"%s\",\"sessionTagColor\":\"%s\"",
         EscapeJsonString(sessionTag),
         EscapeJsonString(sessionTagColor)
      );
   }

   if(hasEntrySpread)
   {
      tradeJson += StringFormat(
         ",\"entrySpreadPips\":%.2f,\"exitSpreadPips\":%.2f",
         entrySpreadPips,
         exitSpreadPips
      );
   }

   int partialCloseCount = exitDealCount > 0 ? exitDealCount - 1 : 0;
   int scaleInCount = entryDealCount > 0 ? entryDealCount - 1 : 0;
   int scaleOutCount = exitDealCount > 0 ? exitDealCount - 1 : 0;
   tradeJson += StringFormat(
      ",\"slModCount\":%d,\"tpModCount\":%d,\"partialCloseCount\":%d,\"exitDealCount\":%d,\"exitVolume\":%.2f,\"entryDealCount\":%d,\"entryVolume\":%.2f,\"scaleInCount\":%d,\"scaleOutCount\":%d,\"trailingStopDetected\":%s",
      slModCount,
      tpModCount,
      partialCloseCount,
      exitDealCount,
      exitVolume,
      entryDealCount,
      entryVolume,
      scaleInCount,
      scaleOutCount,
      trailingStopDetected ? "true" : "false"
   );

   if(hasSlippage)
   {
      tradeJson += StringFormat(
         ",\"entrySlippagePips\":%.2f,\"exitSlippagePips\":%.2f",
         entrySlippagePips,
         exitSlippagePips
      );
   }

   if(hasEntryAccountSnapshot)
   {
      tradeJson += StringFormat(
         ",\"entryBalance\":%.2f,\"entryEquity\":%.2f,\"entryMargin\":%.2f,\"entryFreeMargin\":%.2f,\"entryMarginLevel\":%.2f",
         entryBalance,
         entryEquity,
         entryMargin,
         entryFreeMargin,
         entryMarginLevel
      );
   }

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

      if(trackingIdx != -1 && activeTracking[trackingIdx].initialized)
      {
         datetime peakTime = (activeTracking[trackingIdx].type == 0)
           ? activeTracking[trackingIdx].highestTime
           : activeTracking[trackingIdx].lowestTime;
         int entryPeakDurationSeconds = (int)MathMax(0, peakTime - openTime);
         tradeJson += StringFormat(
            ",\"entryPeakDurationSeconds\":%d",
            entryPeakDurationSeconds
         );
      }
   }

   string baseTradeJson = tradeJson;
   string initialJson = baseTradeJson + "}";

   // Send closed trade immediately (without post-exit data)
   SendClosedTradePayload(initialJson, positionId, "synced (initial close)");

   // Initialize post-exit tracking to update the same trade later
   InitializePostExitTracking(positionId, symbol, orderType, closeTime, baseTradeJson);

   if(DEBUG_MODE)
   {
      Print("🎯 Trade #", positionId, " closed. Starting post-exit tracking...");
      Print("   P/L: ", DoubleToString(profit, 2), " | Manip: ", DoubleToString(manipPips, 1), " pips");
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
   int days = HISTORY_SYNC_DAYS;
   if(days <= 0) days = 1;
   datetime from = currentTime - (days * 24 * 3600);
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
   int totalSynced = 0;
   int batchSize = HISTORY_SYNC_BATCH_SIZE;
   if(batchSize <= 0) batchSize = 100;

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
      double totalProfit = 0;
      string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
      long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);

      double entryPrice = 0;
      datetime openTime = 0;
      double sl = 0;
      double tp = 0;
      int slModCount = 0;
      int tpModCount = 0;
      bool trailingStopDetected = false;
      int entryDealCount = 0;
      double entryVolume = 0;
      int exitDealCount = 0;
      double exitVolume = 0;
      int entryOrderType = -1;
      datetime orderTimes[];
      double orderSLs[];
      double orderTPs[];

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
            double orderSL = HistoryOrderGetDouble(orderTicket, ORDER_SL);
            double orderTP = HistoryOrderGetDouble(orderTicket, ORDER_TP);

            int idx = ArraySize(orderTimes);
            ArrayResize(orderTimes, idx + 1);
            ArrayResize(orderSLs, idx + 1);
            ArrayResize(orderTPs, idx + 1);
            orderTimes[idx] = orderTime;
            orderSLs[idx] = orderSL;
            orderTPs[idx] = orderTP;

            // Only update if this order is more recent than what we've seen
            if(orderTime >= latestOrderTime)
            {
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

         ulong entryPosTicket = HistoryDealGetInteger(entryDealTicket, DEAL_POSITION_ID);
         if(entryPosTicket != positionTicket)
            continue;

         ENUM_DEAL_ENTRY entryDealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(entryDealTicket, DEAL_ENTRY);
         double dealVolume = HistoryDealGetDouble(entryDealTicket, DEAL_VOLUME);
         datetime dealTime = (datetime)HistoryDealGetInteger(entryDealTicket, DEAL_TIME);

         if(entryDealEntry == DEAL_ENTRY_IN)
         {
            entryDealCount++;
            entryVolume += dealVolume;
            if(openTime == 0 || dealTime < openTime)
            {
               entryPrice = HistoryDealGetDouble(entryDealTicket, DEAL_PRICE);
               openTime = dealTime;
               entryOrderType = (int)HistoryDealGetInteger(entryDealTicket, DEAL_TYPE);
            }

            // Only use deal SL/TP if we didn't find better values from orders
            if(sl == 0) sl = HistoryDealGetDouble(entryDealTicket, DEAL_SL);
            if(tp == 0) tp = HistoryDealGetDouble(entryDealTicket, DEAL_TP);
         }
         else if(entryDealEntry == DEAL_ENTRY_OUT || entryDealEntry == DEAL_ENTRY_OUT_BY)
         {
            exitDealCount++;
            exitVolume += dealVolume;
            totalProfit += HistoryDealGetDouble(entryDealTicket, DEAL_PROFIT);
            if(closeTime == 0 || dealTime > closeTime)
            {
               closeTime = dealTime;
               exitPrice = HistoryDealGetDouble(entryDealTicket, DEAL_PRICE);
            }
         }
      }

      if(entryPrice == 0 || openTime == 0)
         continue;

      if(exitDealCount > 0)
         profit = totalProfit;

      string tradeType = (entryOrderType == DEAL_TYPE_SELL) ? "sell" : "buy";
      string safeComment = EscapeJsonString(comment);
      string safeSymbol = EscapeJsonString(symbol);
      string sessionTag = DetectSessionTag(openTime);
      string sessionTagColor = "";
      if(sessionTag != "")
         sessionTagColor = GetSessionColor(sessionTag);

      int orderCount = ArraySize(orderTimes);
      if(orderCount > 1)
      {
         for(int a = 0; a < orderCount - 1; a++)
         {
            for(int b = a + 1; b < orderCount; b++)
            {
               if(orderTimes[b] < orderTimes[a])
               {
                  datetime tmpTime = orderTimes[a];
                  orderTimes[a] = orderTimes[b];
                  orderTimes[b] = tmpTime;

                  double tmpSL = orderSLs[a];
                  orderSLs[a] = orderSLs[b];
                  orderSLs[b] = tmpSL;

                  double tmpTP = orderTPs[a];
                  orderTPs[a] = orderTPs[b];
                  orderTPs[b] = tmpTP;
               }
            }
         }
      }

      if(orderCount > 0)
      {
         double lastSL = orderSLs[0];
         double lastTP = orderTPs[0];

         for(int k = 1; k < orderCount; k++)
         {
            if(orderSLs[k] != lastSL)
            {
               slModCount++;
               if(lastSL > 0)
               {
                  if(tradeType == "buy" && orderSLs[k] > lastSL)
                     trailingStopDetected = true;
                  if(tradeType == "sell" && orderSLs[k] < lastSL)
                     trailingStopDetected = true;
               }
               lastSL = orderSLs[k];
            }
            if(orderTPs[k] != lastTP)
            {
               tpModCount++;
               lastTP = orderTPs[k];
            }
         }
      }

      int scaleInCount = MathMax(0, entryDealCount - 1);
      int scaleOutCount = MathMax(0, exitDealCount - 1);
      int partialCloseCount = MathMax(0, exitDealCount - 1);

      // Use symbol's actual digits for exact precision
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      string tradeJson = StringFormat(
         "{\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"openPrice\":%s,\"openTime\":\"%s\",\"closePrice\":%s,\"closeTime\":\"%s\",\"sl\":%s,\"tp\":%s,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"comment\":\"%s\",\"magicNumber\":%d",
         positionTicket, safeSymbol, tradeType, volume,
         DoubleToString(entryPrice, digits), TimeToISO8601(openTime),
         DoubleToString(exitPrice, digits), TimeToISO8601(closeTime),
         DoubleToString(sl, digits), DoubleToString(tp, digits),
         swap, commission, profit, safeComment, magic
      );

      if(sessionTag != "")
      {
         tradeJson += StringFormat(
            ",\"sessionTag\":\"%s\",\"sessionTagColor\":\"%s\"",
            EscapeJsonString(sessionTag),
            EscapeJsonString(sessionTagColor)
         );
      }

      tradeJson += StringFormat(
         ",\"slModCount\":%d,\"tpModCount\":%d,\"partialCloseCount\":%d,\"exitDealCount\":%d,\"exitVolume\":%.2f,\"entryDealCount\":%d,\"entryVolume\":%.2f,\"scaleInCount\":%d,\"scaleOutCount\":%d,\"trailingStopDetected\":%s",
         slModCount,
         tpModCount,
         partialCloseCount,
         exitDealCount,
         exitVolume,
         entryDealCount,
         entryVolume,
         scaleInCount,
         scaleOutCount,
         trailingStopDetected ? "true" : "false"
      );
      tradeJson += "}";

      if(tradeCount > 0)
         tradesJson += ",";
      tradesJson += tradeJson;
      tradeCount++;

      if(tradeCount >= batchSize)
      {
         if(SendClosedTradesBatch(tradesJson, tradeCount))
            totalSynced += tradeCount;
         tradesJson = "";
         tradeCount = 0;
      }
   }

   if(tradeCount > 0)
   {
      if(SendClosedTradesBatch(tradesJson, tradeCount))
         totalSynced += tradeCount;
   }

   if(totalSynced > 0)
      Print("✅ Bulk sync complete: ", totalSynced, " historical trades");
}

bool SendClosedTradesBatch(string tradesJson, int tradeCount)
{
   if(tradeCount <= 0)
      return false;

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.syncClosedTrades");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"trades\":[%s]}",
      API_KEY, AccountInfoInteger(ACCOUNT_LOGIN), tradesJson
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
      if(DEBUG_MODE)
         Print("✅ Bulk sync batch: ", tradeCount, " historical trades");
      return true;
   }

   if(DEBUG_MODE)
   {
      string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("❌ Bulk sync batch failed: HTTP ", res, " | ", responseText);
   }
   return false;
}

//+------------------------------------------------------------------+
//| ================ TRADE COPIER FUNCTIONS ================         |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Check for pending copy signals (called by slave/receiver)        |
//+------------------------------------------------------------------+
void CheckPendingCopySignals()
{
   if(!ENABLE_COPY_RECEIVER)
      return;

   ulong currentTick = (ulong)GetTickCount();
   if(lastCopyCheckTick > 0 &&
      currentTick - lastCopyCheckTick < (ulong)MathMax((double)COPY_CHECK_INTERVAL_MS, 250.0))
      return;

   lastCopyCheckTick = currentTick;

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.getCopySignals");
   url += StringFormat("?input={\"apiKey\":\"%s\",\"accountNumber\":\"%d\"}", API_KEY, accountNumber);

   char postData[];
   ArrayResize(postData, 0);
   string headers = "";
   char result[];
   string resultHeaders;

   int res = WebRequest(
      "GET",
      url,
      headers,
      5000,
      postData,
      result,
      resultHeaders
   );

   if(res != 200)
   {
      if(DEBUG_MODE)
         Print("❌ Failed to fetch copy signals: HTTP ", res);
      return;
   }

   string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

   // Parse signals from response
   // Response format: {"result":{"data":{"signals":[...]}}}
   int signalsStart = StringFind(responseText, "\"signals\":[");
   if(signalsStart == -1)
      return;

   signalsStart += 11;
   int signalsEnd = StringFind(responseText, "]", signalsStart);
   if(signalsEnd == -1)
      return;

   string signalsArray = StringSubstr(responseText, signalsStart, signalsEnd - signalsStart);

   if(StringLen(signalsArray) < 5)
      return;  // Empty array

   // Process each signal
   ProcessCopySignals(signalsArray);
}

//+------------------------------------------------------------------+
//| Process copy signals from server response                        |
//+------------------------------------------------------------------+
void ProcessCopySignals(string signalsJson)
{
   // Simple JSON parsing for signal objects
   int pos = 0;
   while(pos < StringLen(signalsJson))
   {
      int objStart = StringFind(signalsJson, "{", pos);
      if(objStart == -1)
         break;

      int objEnd = StringFind(signalsJson, "}", objStart);
      if(objEnd == -1)
         break;

      string signalObj = StringSubstr(signalsJson, objStart, objEnd - objStart + 1);

      // Extract signal fields
      string signalId = ExtractJsonString(signalObj, "id");
      string signalType = ExtractJsonString(signalObj, "signalType");
      string masterTicket = ExtractJsonString(signalObj, "masterTicket");
      string symbol = ExtractJsonString(signalObj, "symbol");
      string tradeType = ExtractJsonString(signalObj, "tradeType");
      double volume = ExtractJsonDouble(signalObj, "volume");
      double openPrice = ExtractJsonDouble(signalObj, "openPrice");
      double sl = ExtractJsonDouble(signalObj, "sl");
      double tp = ExtractJsonDouble(signalObj, "tp");
      double newSl = ExtractJsonDouble(signalObj, "newSl");
      double newTp = ExtractJsonDouble(signalObj, "newTp");
      double closePrice = ExtractJsonDouble(signalObj, "closePrice");

      if(StringLen(signalId) == 0)
      {
         pos = objEnd + 1;
         continue;
      }

      bool success = false;
      ulong slaveTicket = 0;
      double executedPrice = 0;
      double slippagePips = 0;
      double profit = 0;
      string errorMessage = "";

      if(signalType == "open")
      {
         success = ExecuteCopyOpen(symbol, tradeType, volume, openPrice, sl, tp, masterTicket, slaveTicket, executedPrice, slippagePips, errorMessage);
      }
      else if(signalType == "close")
      {
         success = ExecuteCopyClose(masterTicket, profit, errorMessage);
      }
      else if(signalType == "modify")
      {
         success = ExecuteCopyModify(masterTicket, newSl, newTp, errorMessage);
      }

      // Acknowledge signal
      AcknowledgeCopySignal(signalId, success, slaveTicket, executedPrice, slippagePips, profit, errorMessage);

      pos = objEnd + 1;
   }
}

//+------------------------------------------------------------------+
//| Execute copy open signal                                         |
//+------------------------------------------------------------------+
bool ExecuteCopyOpen(string symbol, string tradeType, double volume, double expectedPrice,
                     double sl, double tp, string masterTicket,
                     ulong &slaveTicket, double &executedPrice, double &slippagePips, string &errorMessage)
{
   if(volume <= 0)
   {
      errorMessage = "Invalid volume";
      return false;
   }

   // Validate symbol
   if(!SymbolSelect(symbol, true))
   {
      errorMessage = "Symbol not available: " + symbol;
      return false;
   }

   // Get current prices
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

   if(bid == 0 || ask == 0)
   {
      errorMessage = "Unable to get prices for " + symbol;
      return false;
   }

   // Determine order type and price
   ENUM_ORDER_TYPE orderType;
   double price;

   if(tradeType == "buy")
   {
      orderType = ORDER_TYPE_BUY;
      price = ask;
   }
   else if(tradeType == "sell")
   {
      orderType = ORDER_TYPE_SELL;
      price = bid;
   }
   else
   {
      errorMessage = "Invalid trade type: " + tradeType;
      return false;
   }

   // Check slippage
   double pipSize = GetPipSize(symbol);
   slippagePips = MathAbs(price - expectedPrice) / pipSize;

   if(slippagePips > COPY_MAX_SLIPPAGE_PIPS)
   {
      errorMessage = StringFormat("Slippage too high: %.1f pips > %.1f max", slippagePips, COPY_MAX_SLIPPAGE_PIPS);
      return false;
   }

   // Normalize volume
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

   volume = MathMax(minLot, MathMin(maxLot, volume));
   volume = MathFloor(volume / lotStep) * lotStep;

   // Normalize SL/TP
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(sl > 0) sl = NormalizeDouble(sl, digits);
   if(tp > 0) tp = NormalizeDouble(tp, digits);

   // Create trade request
   MqlTradeRequest request = {};
   MqlTradeResult result = {};

   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = volume;
   request.type = orderType;
   request.price = price;
   request.sl = sl;
   request.tp = tp;
   request.deviation = (ulong)(COPY_MAX_SLIPPAGE_PIPS * 10);
   request.magic = COPY_MAGIC_NUMBER;
   request.comment = "Copied: " + masterTicket;
   request.type_filling = ORDER_FILLING_IOC;

   // Execute order
   if(!OrderSend(request, result))
   {
      errorMessage = StringFormat("OrderSend failed: %d - %s", result.retcode, GetRetcodeDescription(result.retcode));
      return false;
   }

   if(result.retcode != TRADE_RETCODE_DONE && result.retcode != TRADE_RETCODE_PLACED)
   {
      errorMessage = StringFormat("Order rejected: %d - %s", result.retcode, GetRetcodeDescription(result.retcode));
      return false;
   }

   slaveTicket = FindCopiedPositionTicket(masterTicket, symbol);
   if(slaveTicket == 0)
   {
      for(int attempt = 0; attempt < 10 && slaveTicket == 0; attempt++)
      {
         Sleep(100);
         slaveTicket = FindCopiedPositionTicket(masterTicket, symbol);
      }
   }

   if(slaveTicket == 0)
      slaveTicket = result.order > 0 ? result.order : result.deal;

   executedPrice = result.price;
   slippagePips = MathAbs(result.price - expectedPrice) / pipSize;

   // Store mapping for close tracking
   UpsertCopiedTradeMap(masterTicket, slaveTicket);

   if(DEBUG_MODE)
   {
      Print("✅ Copied trade: ", symbol, " ", tradeType, " ", volume, " lots @ ", result.price);
      Print("   Master: #", masterTicket, " -> Slave: #", slaveTicket);
   }

   return true;
}

//+------------------------------------------------------------------+
//| Execute copy close signal                                        |
//+------------------------------------------------------------------+
bool ExecuteCopyClose(string masterTicket, double &profit, string &errorMessage)
{
   // Find slave ticket for this master ticket
   ulong slaveTicket = 0;
   int idx = FindCopiedTradeMapIndex(masterTicket);
   if(idx != -1)
      slaveTicket = copiedTrades[idx].slaveTicket;

   if(slaveTicket == 0)
      slaveTicket = FindCopiedPositionTicket(masterTicket);

   // Check if position exists
   if(!PositionSelectByTicket(slaveTicket))
   {
      ulong resolvedTicket = FindCopiedPositionTicket(masterTicket);
      if(resolvedTicket > 0 && PositionSelectByTicket(resolvedTicket))
      {
         slaveTicket = resolvedTicket;
         UpsertCopiedTradeMap(masterTicket, slaveTicket);
         idx = FindCopiedTradeMapIndex(masterTicket);
      }
   }

   if(!PositionSelectByTicket(slaveTicket))
   {
      errorMessage = "Slave position no longer exists: " + IntegerToString(slaveTicket);
      // Remove from tracking
      if(idx >= 0)
      {
         for(int i = idx; i < ArraySize(copiedTrades) - 1; i++)
            copiedTrades[i] = copiedTrades[i + 1];
         ArrayResize(copiedTrades, ArraySize(copiedTrades) - 1);
      }
      return false;
   }

   string symbol = PositionGetString(POSITION_SYMBOL);
   double volume = PositionGetDouble(POSITION_VOLUME);
   profit = PositionGetDouble(POSITION_PROFIT);
   ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

   // Create close request
   MqlTradeRequest request = {};
   MqlTradeResult result = {};

   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = volume;
   request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
   request.price = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
   request.position = slaveTicket;
   request.deviation = (ulong)(COPY_MAX_SLIPPAGE_PIPS * 10);
   request.magic = COPY_MAGIC_NUMBER;
   request.type_filling = ORDER_FILLING_IOC;

   if(!OrderSend(request, result))
   {
      errorMessage = StringFormat("Close failed: %d - %s", result.retcode, GetRetcodeDescription(result.retcode));
      return false;
   }

   if(result.retcode != TRADE_RETCODE_DONE)
   {
      errorMessage = StringFormat("Close rejected: %d - %s", result.retcode, GetRetcodeDescription(result.retcode));
      return false;
   }

   // Remove from tracking
   if(idx >= 0)
   {
      for(int i = idx; i < ArraySize(copiedTrades) - 1; i++)
         copiedTrades[i] = copiedTrades[i + 1];
      ArrayResize(copiedTrades, ArraySize(copiedTrades) - 1);
   }

   if(DEBUG_MODE)
      Print("✅ Closed copied trade: #", slaveTicket, " P/L: ", profit);

   return true;
}

//+------------------------------------------------------------------+
//| Execute copy modify signal                                       |
//+------------------------------------------------------------------+
bool ExecuteCopyModify(string masterTicket, double newSl, double newTp, string &errorMessage)
{
   // Find slave ticket for this master ticket
   ulong slaveTicket = 0;
   int idx = FindCopiedTradeMapIndex(masterTicket);
   if(idx != -1)
      slaveTicket = copiedTrades[idx].slaveTicket;

   if(slaveTicket == 0)
      slaveTicket = FindCopiedPositionTicket(masterTicket);

   if(!PositionSelectByTicket(slaveTicket))
   {
      ulong resolvedTicket = FindCopiedPositionTicket(masterTicket);
      if(resolvedTicket > 0 && PositionSelectByTicket(resolvedTicket))
      {
         slaveTicket = resolvedTicket;
         UpsertCopiedTradeMap(masterTicket, slaveTicket);
      }
   }

   if(!PositionSelectByTicket(slaveTicket))
   {
      errorMessage = "Slave position no longer exists: " + IntegerToString(slaveTicket);
      return false;
   }

   string symbol = PositionGetString(POSITION_SYMBOL);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

   if(newSl > 0) newSl = NormalizeDouble(newSl, digits);
   if(newTp > 0) newTp = NormalizeDouble(newTp, digits);

   MqlTradeRequest request = {};
   MqlTradeResult result = {};

   request.action = TRADE_ACTION_SLTP;
   request.symbol = symbol;
   request.position = slaveTicket;
   request.sl = newSl > 0 ? newSl : PositionGetDouble(POSITION_SL);
   request.tp = newTp > 0 ? newTp : PositionGetDouble(POSITION_TP);

   if(!OrderSend(request, result))
   {
      errorMessage = StringFormat("Modify failed: %d - %s", result.retcode, GetRetcodeDescription(result.retcode));
      return false;
   }

   if(result.retcode != TRADE_RETCODE_DONE)
   {
      errorMessage = StringFormat("Modify rejected: %d - %s", result.retcode, GetRetcodeDescription(result.retcode));
      return false;
   }

   if(DEBUG_MODE)
      Print("✅ Modified copied trade: #", slaveTicket, " SL:", newSl, " TP:", newTp);

   return true;
}

//+------------------------------------------------------------------+
//| Acknowledge copy signal execution to server                      |
//+------------------------------------------------------------------+
void AcknowledgeCopySignal(string signalId, bool success, ulong slaveTicket,
                           double executedPrice, double slippagePips, double profit, string errorMessage)
{
   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.ackCopySignal");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"signalId\":\"%s\",\"success\":%s",
      API_KEY, signalId, success ? "true" : "false"
   );

   if(slaveTicket > 0)
      json += StringFormat(",\"slaveTicket\":\"%d\"", slaveTicket);
   if(executedPrice > 0)
      json += StringFormat(",\"executedPrice\":%.5f", executedPrice);
   if(slippagePips > 0)
      json += StringFormat(",\"slippagePips\":%.2f", slippagePips);
   if(profit != 0)
      json += StringFormat(",\"profit\":%.2f", profit);
   if(StringLen(errorMessage) > 0)
      json += StringFormat(",\"errorMessage\":\"%s\"", EscapeJsonString(errorMessage));

   json += "}";

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Send master trade open signal                                    |
//+------------------------------------------------------------------+
void SendMasterTradeOpen(ulong ticket)
{
   if(!ENABLE_COPY_SENDER)
      return;

   // Check if we already sent this ticket
   for(int i = 0; i < lastSentMasterTicketsCount; i++)
   {
      if(lastSentMasterTickets[i] == ticket)
         return;
   }

   if(!PositionSelectByTicket(ticket))
      return;

   string symbol = PositionGetString(POSITION_SYMBOL);
   ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double volume = PositionGetDouble(POSITION_VOLUME);
   double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   double sl = PositionGetDouble(POSITION_SL);
   double tp = PositionGetDouble(POSITION_TP);
   datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);

   string tradeType = (posType == POSITION_TYPE_BUY) ? "buy" : "sell";
   string sessionTag = DetectSessionTag(openTime);

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.masterTradeOpen");

   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

   string tradeJson = StringFormat(
      "\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"openPrice\":%s",
      ticket, EscapeJsonString(symbol), tradeType, volume, DoubleToString(openPrice, digits)
   );

   if(sl > 0)
      tradeJson += StringFormat(",\"sl\":%s", DoubleToString(sl, digits));
   if(tp > 0)
      tradeJson += StringFormat(",\"tp\":%s", DoubleToString(tp, digits));
   if(sessionTag != "")
      tradeJson += StringFormat(",\"sessionTag\":\"%s\"", EscapeJsonString(sessionTag));

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"trade\":{%s},\"accountMetrics\":{\"balance\":%.2f,\"equity\":%.2f}}",
      API_KEY, accountNumber, tradeJson, balance, equity
   );

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   int res = WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);

   if(res == 200)
   {
      // Track that we sent this ticket
      ArrayResize(lastSentMasterTickets, lastSentMasterTicketsCount + 1);
      lastSentMasterTickets[lastSentMasterTicketsCount] = ticket;
      lastSentMasterTicketsCount++;

      if(DEBUG_MODE)
         Print("📤 Master trade open signal sent: #", ticket, " ", symbol, " ", tradeType);
   }
   else if(DEBUG_MODE)
   {
      string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("❌ Failed to send master trade open: HTTP ", res, " | ", responseText);
   }
}

//+------------------------------------------------------------------+
//| Send master trade close signal                                   |
//+------------------------------------------------------------------+
void SendMasterTradeClose(ulong ticket, double closePrice, double profit)
{
   if(!ENABLE_COPY_SENDER)
      return;

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.masterTradeClose");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"ticket\":\"%d\",\"closePrice\":%.5f,\"profit\":%.2f}",
      API_KEY, accountNumber, ticket, closePrice, profit
   );

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   int res = WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);

   if(res == 200)
   {
      // Remove from sent tickets
      for(int i = 0; i < lastSentMasterTicketsCount; i++)
      {
         if(lastSentMasterTickets[i] == ticket)
         {
            for(int j = i; j < lastSentMasterTicketsCount - 1; j++)
               lastSentMasterTickets[j] = lastSentMasterTickets[j + 1];
            lastSentMasterTicketsCount--;
            break;
         }
      }

      if(DEBUG_MODE)
         Print("📤 Master trade close signal sent: #", ticket, " P/L: ", profit);
   }
   else if(DEBUG_MODE)
   {
      string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("❌ Failed to send master trade close: HTTP ", res, " | ", responseText);
   }
}

//+------------------------------------------------------------------+
//| Send master trade modify signal                                  |
//+------------------------------------------------------------------+
void SendMasterTradeModify(ulong ticket, double newSl, double newTp)
{
   if(!ENABLE_COPY_SENDER)
      return;

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);

   string url = API_URL;
   StringReplace(url, "webhook.priceUpdate", "webhook.masterTradeModify");

   string json = StringFormat(
      "{\"apiKey\":\"%s\",\"accountNumber\":\"%d\",\"ticket\":\"%d\"",
      API_KEY, accountNumber, ticket
   );

   if(newSl > 0)
      json += StringFormat(",\"newSl\":%.5f", newSl);
   if(newTp > 0)
      json += StringFormat(",\"newTp\":%.5f", newTp);

   json += "}";

   char postData[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;

   WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);

   if(DEBUG_MODE)
      Print("📤 Master trade modify signal sent: #", ticket);
}

//+------------------------------------------------------------------+
//| Helper: Extract string value from JSON                           |
//+------------------------------------------------------------------+
string ExtractJsonString(string json, string key)
{
   string searchKey = "\"" + key + "\":\"";
   int keyStart = StringFind(json, searchKey);
   if(keyStart == -1)
   {
      // Try without quotes (for numbers stored as strings)
      searchKey = "\"" + key + "\":";
      keyStart = StringFind(json, searchKey);
      if(keyStart == -1)
         return "";
   }

   int valueStart = keyStart + StringLen(searchKey);
   if(StringGetCharacter(json, valueStart - 1) == '\"')
   {
      // String value
      int valueEnd = StringFind(json, "\"", valueStart);
      if(valueEnd == -1)
         return "";
      return StringSubstr(json, valueStart, valueEnd - valueStart);
   }
   else
   {
      // Non-string value
      int valueEnd = StringFind(json, ",", valueStart);
      int valueEnd2 = StringFind(json, "}", valueStart);
      if(valueEnd == -1 || (valueEnd2 != -1 && valueEnd2 < valueEnd))
         valueEnd = valueEnd2;
      if(valueEnd == -1)
         return "";
      return StringSubstr(json, valueStart, valueEnd - valueStart);
   }
}

//+------------------------------------------------------------------+
//| Helper: Extract double value from JSON                           |
//+------------------------------------------------------------------+
double ExtractJsonDouble(string json, string key)
{
   string value = ExtractJsonString(json, key);
   if(value == "" || value == "null")
      return 0;
   return StringToDouble(value);
}

//+------------------------------------------------------------------+
//| Helper: Get retcode description                                  |
//+------------------------------------------------------------------+
string GetRetcodeDescription(uint retcode)
{
   switch(retcode)
   {
      case TRADE_RETCODE_REQUOTE: return "Requote";
      case TRADE_RETCODE_REJECT: return "Request rejected";
      case TRADE_RETCODE_CANCEL: return "Request canceled";
      case TRADE_RETCODE_PLACED: return "Order placed";
      case TRADE_RETCODE_DONE: return "Request completed";
      case TRADE_RETCODE_DONE_PARTIAL: return "Partially completed";
      case TRADE_RETCODE_ERROR: return "General error";
      case TRADE_RETCODE_TIMEOUT: return "Request timed out";
      case TRADE_RETCODE_INVALID: return "Invalid request";
      case TRADE_RETCODE_INVALID_VOLUME: return "Invalid volume";
      case TRADE_RETCODE_INVALID_PRICE: return "Invalid price";
      case TRADE_RETCODE_INVALID_STOPS: return "Invalid stops";
      case TRADE_RETCODE_TRADE_DISABLED: return "Trade disabled";
      case TRADE_RETCODE_MARKET_CLOSED: return "Market closed";
      case TRADE_RETCODE_NO_MONEY: return "Insufficient funds";
      case TRADE_RETCODE_PRICE_CHANGED: return "Price changed";
      case TRADE_RETCODE_PRICE_OFF: return "No quotes";
      case TRADE_RETCODE_INVALID_EXPIRATION: return "Invalid expiration";
      case TRADE_RETCODE_ORDER_CHANGED: return "Order state changed";
      case TRADE_RETCODE_TOO_MANY_REQUESTS: return "Too many requests";
      case TRADE_RETCODE_NO_CHANGES: return "No changes";
      case TRADE_RETCODE_POSITION_CLOSED: return "Position closed";
      case TRADE_RETCODE_INVALID_FILL: return "Invalid fill mode";
      default: return "Unknown error";
   }
}

//+------------------------------------------------------------------+
