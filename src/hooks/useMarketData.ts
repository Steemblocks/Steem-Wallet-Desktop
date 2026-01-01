import { useState, useEffect, useRef, useCallback } from 'react';
import { steemApi } from '@/services/steemApi';
import { 
  steemWebSocket, 
  MarketTickerData, 
  OrderBookData, 
  RecentTradeData 
} from '@/services/steemWebSocket';

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

    // Subscribe to ticker updates
    const unsubTicker = steemWebSocket.subscribeToTicker((data: MarketTickerData) => {
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
      setOrderBook(data);
    });
    unsubscribeRef.current.push(unsubOrderBook);

    // Subscribe to recent trades
    const unsubTrades = steemWebSocket.subscribeToTrades((data: RecentTradeData[]) => {
      const formattedTrades = data.map(trade => ({
        date: trade.date,
        current_pays: trade.current_pays,
        open_pays: trade.open_pays,
      }));
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

      // Set up REST polling as backup (every 30 seconds)
      // This ensures data stays fresh even if WebSocket doesn't send updates
      pollingIntervalRef.current = setInterval(() => {
        if (isMounted) {
          fetchMarketDataREST();
        }
      }, 30000);
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
