/**
 * useWebSocket Hook
 * React hook for consuming real-time data from the Steem WebSocket service
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  steemWebSocket, 
  MarketTickerData, 
  OrderBookData, 
  RecentTradeData,
  GlobalPropsData,
  AccountUpdateData 
} from '@/services/steemWebSocket';

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
}

/**
 * Hook to manage WebSocket connection state
 */
export const useWebSocketConnection = () => {
  const [state, setState] = useState<WebSocketState>({
    isConnected: steemWebSocket.isConnected(),
    isConnecting: false,
    error: null,
  });

  useEffect(() => {
    // Connect on mount
    setState(prev => ({ ...prev, isConnecting: true }));
    
    steemWebSocket.connect()
      .then(() => {
        setState({ isConnected: true, isConnecting: false, error: null });
      })
      .catch((error) => {
        setState({ isConnected: false, isConnecting: false, error });
      });

    // Listen for connection changes
    const unsubConnect = steemWebSocket.onConnect(() => {
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    });

    const unsubDisconnect = steemWebSocket.onDisconnect(() => {
      setState(prev => ({ ...prev, isConnected: false }));
    });

    const unsubError = steemWebSocket.onError((event) => {
      setState(prev => ({ ...prev, error: new Error('WebSocket error') }));
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubError();
    };
  }, []);

  const reconnect = useCallback(() => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    steemWebSocket.connect()
      .then(() => {
        setState({ isConnected: true, isConnecting: false, error: null });
      })
      .catch((error) => {
        setState({ isConnected: false, isConnecting: false, error });
      });
  }, []);

  return { ...state, reconnect };
};

/**
 * Hook for subscribing to market ticker updates
 */
export const useMarketTicker = (enabled: boolean = true) => {
  const [ticker, setTicker] = useState<MarketTickerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Ensure connection
    steemWebSocket.connect().catch(console.error);

    const unsubscribe = steemWebSocket.subscribeToTicker((data) => {
      setTicker(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [enabled]);

  return { ticker, isLoading };
};

/**
 * Hook for subscribing to order book updates
 */
export const useOrderBook = (enabled: boolean = true, limit: number = 50) => {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    steemWebSocket.connect().catch(console.error);

    const unsubscribe = steemWebSocket.subscribeToOrderBook((data) => {
      setOrderBook(data);
      setIsLoading(false);
    }, limit);

    return () => {
      unsubscribe();
    };
  }, [enabled, limit]);

  return { orderBook, isLoading };
};

/**
 * Hook for subscribing to recent trades
 */
export const useRecentTrades = (enabled: boolean = true) => {
  const [trades, setTrades] = useState<RecentTradeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    steemWebSocket.connect().catch(console.error);

    const unsubscribe = steemWebSocket.subscribeToTrades((data) => {
      setTrades(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [enabled]);

  return { trades, isLoading };
};

/**
 * Hook for subscribing to global properties
 */
export const useGlobalProps = (enabled: boolean = true) => {
  const [globalProps, setGlobalProps] = useState<GlobalPropsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    steemWebSocket.connect().catch(console.error);

    const unsubscribe = steemWebSocket.subscribeToGlobalProps((data) => {
      setGlobalProps(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [enabled]);

  return { globalProps, isLoading };
};

/**
 * Hook for subscribing to account updates
 */
export const useAccountUpdates = (username: string | null, enabled: boolean = true) => {
  const [accountData, setAccountData] = useState<AccountUpdateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !username) {
      setIsLoading(false);
      return;
    }

    steemWebSocket.connect().catch(console.error);

    const unsubscribe = steemWebSocket.subscribeToAccount(username, (data) => {
      setAccountData(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [username, enabled]);

  return { accountData, isLoading };
};

/**
 * Combined hook for all market data (ticker, orderbook, trades)
 * Only subscribes when market tab is active
 */
export const useMarketDataWebSocket = (enabled: boolean = true) => {
  const { ticker, isLoading: tickerLoading } = useMarketTicker(enabled);
  const { orderBook, isLoading: orderBookLoading } = useOrderBook(enabled);
  const { trades, isLoading: tradesLoading } = useRecentTrades(enabled);

  return {
    ticker,
    orderBook,
    trades,
    isLoading: tickerLoading || orderBookLoading || tradesLoading,
  };
};

export default {
  useWebSocketConnection,
  useMarketTicker,
  useOrderBook,
  useRecentTrades,
  useGlobalProps,
  useAccountUpdates,
  useMarketDataWebSocket,
};
