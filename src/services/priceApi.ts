
export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  price_change_percentage_24h: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  circulating_supply: number;
  total_supply: number;
  last_updated: string;
}

export interface MarketPriceData {
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  image: string;
  lastUpdated: string;
}

export interface PricesData {
  steem: MarketPriceData;
  sbd: MarketPriceData;
  lastFetched: number;
}

// Cache configuration
const CACHE_DURATION_MS = 5000; // 5 seconds cache

class PriceCache {
  private cache: PricesData | null = null;
  private fetchPromise: Promise<PricesData> | null = null;

  isValid(): boolean {
    if (!this.cache) return false;
    const now = Date.now();
    return (now - this.cache.lastFetched) < CACHE_DURATION_MS;
  }

  get(): PricesData | null {
    return this.cache;
  }

  set(data: PricesData): void {
    this.cache = data;
  }

  setFetchPromise(promise: Promise<PricesData> | null): void {
    this.fetchPromise = promise;
  }

  getFetchPromise(): Promise<PricesData> | null {
    return this.fetchPromise;
  }

  clear(): void {
    this.cache = null;
    this.fetchPromise = null;
  }
}

const priceCache = new PriceCache();

// Default fallback data
const defaultMarketData: MarketPriceData = {
  price: 0,
  priceChange24h: 0,
  marketCap: 0,
  volume24h: 0,
  high24h: 0,
  low24h: 0,
  image: '',
  lastUpdated: new Date().toISOString()
};

const defaultSteemData: MarketPriceData = {
  ...defaultMarketData,
  price: 0.25
};

const defaultSbdData: MarketPriceData = {
  ...defaultMarketData,
  price: 1.0
};

export class PriceApiService {
  private readonly COINGECKO_MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets';

  private parseMarketData(data: CoinMarketData): MarketPriceData {
    return {
      price: data.current_price ?? 0,
      priceChange24h: data.price_change_percentage_24h ?? 0,
      marketCap: data.market_cap ?? 0,
      volume24h: data.total_volume ?? 0,
      high24h: data.high_24h ?? 0,
      low24h: data.low_24h ?? 0,
      image: data.image ?? '',
      lastUpdated: data.last_updated ?? new Date().toISOString()
    };
  }

  private async fetchFromApi(): Promise<PricesData> {
    try {
      // Fetch both STEEM and SBD in a single API call
      const response = await fetch(
        `${this.COINGECKO_MARKETS_URL}?vs_currency=usd&ids=steem,steem-dollars&order=market_cap_desc&sparkline=false`,
        { signal: AbortSignal.timeout(10000) } // 10 second timeout
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: CoinMarketData[] = await response.json();
      
      const steemData = data.find(coin => coin.id === 'steem');
      const sbdData = data.find(coin => coin.id === 'steem-dollars');

      const result: PricesData = {
        steem: steemData ? this.parseMarketData(steemData) : defaultSteemData,
        sbd: sbdData ? this.parseMarketData(sbdData) : defaultSbdData,
        lastFetched: Date.now()
      };

      return result;
    } catch (error) {
      // Only log in development, as CoinGecko may be rate-limited or blocked
      // The app falls back to Steem's internal market for pricing
      if (import.meta.env.DEV) {
        console.warn('CoinGecko price fetch failed (using fallback):', error instanceof Error ? error.message : 'Unknown error');
      }
      return {
        steem: defaultSteemData,
        sbd: defaultSbdData,
        lastFetched: Date.now()
      };
    }
  }

  async getMarketData(): Promise<PricesData> {
    // Return cached data if still valid
    if (priceCache.isValid()) {
      const cached = priceCache.get();
      if (cached) {
        return cached;
      }
    }

    // If there's already a fetch in progress, wait for it
    const existingPromise = priceCache.getFetchPromise();
    if (existingPromise) {
      return existingPromise;
    }

    // Start a new fetch
    const fetchPromise = this.fetchFromApi();
    priceCache.setFetchPromise(fetchPromise);

    try {
      const data = await fetchPromise;
      priceCache.set(data);
      return data;
    } finally {
      priceCache.setFetchPromise(null);
    }
  }

  async getSteemPrice(): Promise<number> {
    const data = await this.getMarketData();
    return data.steem.price;
  }

  async getSbdPrice(): Promise<number> {
    const data = await this.getMarketData();
    return data.sbd.price;
  }

  async getCurrentPrices(): Promise<{ steemPrice: number; sbdPrice: number }> {
    const data = await this.getMarketData();
    return {
      steemPrice: data.steem.price,
      sbdPrice: data.sbd.price
    };
  }

  // Clear cache (useful for forcing a refresh)
  clearCache(): void {
    priceCache.clear();
  }
}

export const priceApi = new PriceApiService();
