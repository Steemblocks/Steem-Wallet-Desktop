import { useState, useEffect, useRef, useCallback } from 'react';
import { steemApi } from '@/services/steemApi';
import { 
  steemWebSocket, 
  MarketTickerData, 
  OrderBookData, 
  RecentTradeData 
} from '@/services/steemWebSocket';

// Helper to parse asset string like "1.234 STEEM" or "5.678 SBD"
const parseAsset = (asset: string): { amount: number; symbol: string } => {
  const parts = asset.trim().split(' ');
  return {
    amount: parseFloat(parts[0]) || 0,
    symbol: parts[1] || ''
  };
};

// Format WebSocket trade data to match REST API format
const formatWsTrade = (trade: RecentTradeData) => {
  const currentPays = parseAsset(trade.current_pays);
  const openPays = parseAsset(trade.open_pays);
  
  // Determine which is STEEM and which is SBD
  let steemAmount: number;
  let sbdAmount: number;
  let type: 'buy' | 'sell';
  
  if (currentPays.symbol === 'STEEM') {
    steemAmount = currentPays.amount;
    sbdAmount = openPays.amount;
    type = 'sell'; // Seller is paying STEEM
  } else {
    steemAmount = openPays.amount;
    sbdAmount = currentPays.amount;
    type = 'buy'; // Buyer is paying SBD
  }
  
  const price = steemAmount > 0 ? sbdAmount / steemAmount : 0;
  
  return {
    date: new Date(trade.date),
    steemAmount,
    sbdAmount,
    price,
    type
  };
};

// Format WebSocket order book to match REST API format
// WebSocket sends: { price: string, steem: number, sbd: number }
// REST API sends: { real_price: string, steem: number (scaled by 1000), sbd: number (scaled by 1000) }
const formatWsOrderBook = (data: OrderBookData) => {
  return {
    bids: data.bids.map(bid => ({
      real_price: bid.price,
      // WebSocket values may already be properly scaled, so multiply by 1000 
      // to match REST API format that gets divided by 1000 in formatOrderBookEntry
      steem: bid.steem * 1000,
      sbd: bid.sbd * 1000
    })),
    asks: data.asks.map(ask => ({
      real_price: ask.price,
      steem: ask.steem * 1000,
      sbd: ask.sbd * 1000
    }))
  };
};

export const useMarketData = () => {
  const [orderBook, setOrderBook] = useState<any>(null);
  const [ticker, setTicker] = useState<any>(null);
  const [volume, setVolume] = useState<any>(null);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [hourlyHistory, setHourlyHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  const unsubscribeRef = useRef<(() => void)[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsSetupAttemptedRef = useRef(false);

  // Fallback REST API fetch - always works
  const fetchMarketDataREST = useCallback(async () => {
    try {
      const [marketData, hourly] = await Promise.all([
        steemApi.getSimplifiedMarketData(),
        steemApi.getHourlyMarketHistory()
      ]);

      setOrderBook(marketData.orderBook);
      setTicker(marketData.ticker);
      setVolume(marketData.volume);
      setTradeHistory(marketData.recentTrades);
      setHourlyHistory(hourly);
      setError(null);
    } catch (err) {
      console.error('[useMarketData] Error fetching market data:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Setup WebSocket subscriptions (optional enhancement)
  const setupWebSocketSubscriptions = useCallback(() => {
    if (!steemWebSocket.isConnected()) {
      return false;
    }

    console.log('[useMarketData] Setting up WebSocket subscriptions for real-time updates');

    // Subscribe to ticker updates
    const unsubTicker = steemWebSocket.subscribeToTicker((data: MarketTickerData) => {
      console.log('[useMarketData] Received ticker update via WebSocket');
      setTicker({
        latest: data.latest,
        lowest_ask: data.lowest_ask,
        highest_bid: data.highest_bid,
        percent_change: data.percent_change,
      });
      setVolume({
        steem_volume: data.steem_volume,
        sbd_volume: data.sbd_volume,
      });
    });
    unsubscribeRef.current.push(unsubTicker);

    // Subscribe to order book updates
    const unsubOrderBook = steemWebSocket.subscribeToOrderBook((data: OrderBookData) => {
      console.log('[useMarketData] Received order book update via WebSocket');
      // Format WebSocket data to match REST API format
      setOrderBook(formatWsOrderBook(data));
    });
    unsubscribeRef.current.push(unsubOrderBook);

    // Subscribe to recent trades
    const unsubTrades = steemWebSocket.subscribeToTrades((data: RecentTradeData[]) => {
      console.log('[useMarketData] Received trades update via WebSocket:', data.length, 'trades');
      // Format WebSocket data to match REST API format
      const formattedTrades = data.map(formatWsTrade);
      setTradeHistory(formattedTrades);
    });
    unsubscribeRef.current.push(unsubTrades);

    setWsConnected(true);
    return true;
  }, []);

  // Cleanup subscriptions
  const cleanupSubscriptions = useCallback(() => {
    unsubscribeRef.current.forEach(unsub => unsub());
    unsubscribeRef.current = [];
    setWsConnected(false);
  }, []);

  // Main effect - Always fetch REST first, then try WebSocket for real-time updates
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      // ALWAYS fetch data via REST first (guaranteed to work)
      await fetchMarketDataREST();

      // Then try to enhance with WebSocket for real-time updates
      if (!wsSetupAttemptedRef.current) {
        wsSetupAttemptedRef.current = true;
        
        try {
          // Check if WebSocket is already connected (from WalletDataContext)
          if (steemWebSocket.isConnected()) {
            setupWebSocketSubscriptions();
          }
        } catch (err) {
          // WebSocket setup failed, continue with REST polling
        }
      }

      // Set up REST polling as backup (every 60 seconds when WS connected, 30 seconds when not)
      // This ensures data stays fresh even if WebSocket doesn't send updates
      const pollingInterval = steemWebSocket.isConnected() ? 60000 : 30000;
      pollingIntervalRef.current = setInterval(() => {
        if (isMounted) {
          fetchMarketDataREST();
        }
      }, pollingInterval);
    };

    initialize();

    // Listen for WebSocket connection changes
    const unsubConnect = steemWebSocket.onConnect(() => {
      if (isMounted) {
        setupWebSocketSubscriptions();
      }
    });

    const unsubDisconnect = steemWebSocket.onDisconnect(() => {
      if (isMounted) {
        cleanupSubscriptions();
        // REST polling is already running, so data will continue to refresh
      }
    });

    return () => {
      isMounted = false;
      cleanupSubscriptions();
      unsubConnect();
      unsubDisconnect();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchMarketDataREST, setupWebSocketSubscriptions, cleanupSubscriptions]);

  return { 
    orderBook, 
    ticker, 
    volume, 
    tradeHistory, 
    hourlyHistory, 
    isLoading, 
    error,
    wsConnected,
  };
};
