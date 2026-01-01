import { useState, useEffect } from 'react';
import { steemApi } from '@/services/steemApi';

export const useMarketData = () => {
  const [orderBook, setOrderBook] = useState<any>(null);
  const [ticker, setTicker] = useState<any>(null);
  const [volume, setVolume] = useState<any>(null);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [hourlyHistory, setHourlyHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchMarketData = async () => {
    try {
      // Fetch all required data
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
      console.error('Error fetching market data:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      await fetchMarketData();
    };

    loadData();
    
    // Refresh every 30 seconds for live feel
    const interval = setInterval(() => {
      if (isMounted) fetchMarketData();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { 
    orderBook, 
    ticker, 
    volume, 
    tradeHistory, 
    hourlyHistory, 
    isLoading, 
    error 
  };
};
