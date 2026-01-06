/**
 * Steem WebSocket Service
 * Real-time data streaming for market data, account updates, and global properties
 * Connects to wss://dhakawitness.com WebSocket server
 */

type WebSocketCallback = (data: any) => void;
type ConnectionCallback = () => void;

export interface MarketTickerData {
  latest: string;
  lowest_ask: string;
  highest_bid: string;
  percent_change: string;
  steem_volume: string;
  sbd_volume: string;
}

export interface OrderBookData {
  bids: Array<{ price: string; steem: number; sbd: number }>;
  asks: Array<{ price: string; steem: number; sbd: number }>;
}

export interface RecentTradeData {
  date: string;
  current_pays: string;
  open_pays: string;
}

export interface GlobalPropsData {
  head_block_number: number;
  total_vesting_fund_steem: string;
  total_vesting_shares: string;
  current_supply: string;
  current_sbd_supply: string;
  sbd_interest_rate: number;
}

export interface AccountUpdateData {
  name: string;
  balance: string;
  sbd_balance: string;
  vesting_shares: string;
  voting_power: number;
  reward_steem_balance: string;
  reward_sbd_balance: string;
  reward_vesting_balance: string;
}

export interface PowerMeterData {
  username: string;
  account: {
    vesting_shares: any;
    received_vesting_shares: any;
    delegated_vesting_shares: any;
    vesting_withdraw_rate: any;
    voting_manabar: {
      current_mana: string;
      last_update_time: number;
    };
    downvote_manabar: {
      current_mana: string;
      last_update_time: number;
    };
  };
  rc_account: {
    max_rc: string;
    rc_manabar: {
      current_mana: string;
      last_update_time: number;
    };
  };
  reward_fund: {
    reward_balance: string;
    recent_claims: string;
  };
  median_history_price: {
    base: string;
    quote: string;
  };
}

type SubscriptionType = 
  | 'ticker' 
  | 'orderbook' 
  | 'trades' 
  | 'global_props' 
  | 'account'
  | 'power_meter';

interface Subscription {
  type: SubscriptionType;
  callback: WebSocketCallback;
  params?: any;
}

class SteemWebSocketService {
  private ws: WebSocket | null = null;
  private wsUrl: string = 'wss://dhakawitness.com';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // Start with 1 second
  private maxReconnectDelay: number = 30000; // Max 30 seconds
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private messageQueue: any[] = [];
  private pendingRequests: Map<number, { resolve: (data: any) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = new Map();
  
  // Callbacks
  private onConnectCallbacks: Set<ConnectionCallback> = new Set();
  private onDisconnectCallbacks: Set<ConnectionCallback> = new Set();
  private onErrorCallbacks: Set<(error: Event) => void> = new Set();

  constructor() {
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for connection
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }

      this.isConnecting = true;
      this.shouldReconnect = true;

      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = (event) => {
          this.handleOpen(event);
          resolve();
        };

        this.ws.onclose = this.handleClose;
        this.ws.onerror = (event) => {
          this.handleError(event);
          if (this.reconnectAttempts === 0) {
            reject(new Error('WebSocket connection failed'));
          }
        };
        this.ws.onmessage = this.handleMessage;

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket connection open
   */
  private handleOpen(event: Event): void {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    // Start ping/pong to keep connection alive
    this.startPingInterval();

    // Send any queued messages
    this.flushMessageQueue();

    // Re-subscribe to all active subscriptions
    this.resubscribeAll();

    // Notify listeners
    this.onConnectCallbacks.forEach(cb => cb());
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(event: CloseEvent): void {
    this.isConnecting = false;
    this.stopPingInterval();

    // Notify listeners
    this.onDisconnectCallbacks.forEach(cb => cb());

    // Attempt reconnection if allowed
    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(event: Event): void {
    console.error('[WebSocket] Error:', event);
    this.onErrorCallbacks.forEach(cb => cb(event));
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      // Handle pong response
      if (message.type === 'pong') {
        return;
      }

      // Handle one-time request responses (has id field)
      if (message.id && this.pendingRequests.has(message.id)) {
        const pending = this.pendingRequests.get(message.id)!;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.data || message.result);
        }
        return;
      }

      // Handle subscription updates (new format: type=subscription_update, subscription=<type>)
      if (message.type === 'subscription_update' && message.subscription && message.data) {
        const subscriptionType = message.subscription;
        
        // Find matching subscription by type
        this.subscriptions.forEach((sub, key) => {
          if (key.startsWith(subscriptionType + ':')) {
            sub.callback(message.data);
          }
        });
        return;
      }

      // Handle legacy subscription updates (type=<subscription_type>, data=<data>)
      if (message.type && message.data) {
        const subscriptionKey = this.getSubscriptionKey(message.type, message.params);
        const subscription = this.subscriptions.get(subscriptionKey);
        
        if (subscription) {
          subscription.callback(message.data);
        }

        // Also notify any general listeners for this type
        this.subscriptions.forEach((sub, key) => {
          if (key.startsWith(message.type + ':') && key !== subscriptionKey) {
            sub.callback(message.data);
          }
        });
      }

    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
    }
  }

  /**
   * Send a message to the WebSocket server
   */
  private send(message: any): void {
    const messageStr = JSON.stringify(message);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(messageStr);
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch(err => {
          console.error('[WebSocket] Reconnection failed:', err);
        });
      }
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Generate subscription key
   */
  private getSubscriptionKey(type: SubscriptionType, params?: any): string {
    if (params) {
      return `${type}:${JSON.stringify(params)}`;
    }
    return `${type}:default`;
  }

  /**
   * Resubscribe to all active subscriptions after reconnection
   */
  private resubscribeAll(): void {
    this.subscriptions.forEach((subscription, key) => {
      this.sendSubscription(subscription.type, subscription.params);
    });
  }

  /**
   * Send subscription request to server
   */
  private sendSubscription(type: SubscriptionType, params?: any): void {
    this.send({
      action: 'subscribe',
      type,
      params
    });
  }

  /**
   * Send unsubscription request to server
   */
  private sendUnsubscription(type: SubscriptionType, params?: any): void {
    this.send({
      action: 'unsubscribe',
      type,
      params
    });
  }

  // ==================== Public Subscription Methods ====================

  /**
   * Subscribe to market ticker updates
   */
  subscribeToTicker(callback: (data: MarketTickerData) => void): () => void {
    const key = this.getSubscriptionKey('ticker');
    this.subscriptions.set(key, { type: 'ticker', callback });
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription('ticker');
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(key);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscription('ticker');
      }
    };
  }

  /**
   * Subscribe to order book updates
   */
  subscribeToOrderBook(callback: (data: OrderBookData) => void, limit: number = 50): () => void {
    const params = { limit };
    const key = this.getSubscriptionKey('orderbook', params);
    this.subscriptions.set(key, { type: 'orderbook', callback, params });
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription('orderbook', params);
    }

    return () => {
      this.subscriptions.delete(key);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscription('orderbook', params);
      }
    };
  }

  /**
   * Subscribe to recent trades
   */
  subscribeToTrades(callback: (data: RecentTradeData[]) => void): () => void {
    const key = this.getSubscriptionKey('trades');
    this.subscriptions.set(key, { type: 'trades', callback });
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription('trades');
    }

    return () => {
      this.subscriptions.delete(key);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscription('trades');
      }
    };
  }

  /**
   * Subscribe to global properties updates
   */
  subscribeToGlobalProps(callback: (data: GlobalPropsData) => void): () => void {
    const key = this.getSubscriptionKey('global_props');
    this.subscriptions.set(key, { type: 'global_props', callback });
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription('global_props');
    }

    return () => {
      this.subscriptions.delete(key);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscription('global_props');
      }
    };
  }

  /**
   * Subscribe to account updates for a specific user
   */
  subscribeToAccount(username: string, callback: (data: AccountUpdateData) => void): () => void {
    const params = { account: username };
    const key = this.getSubscriptionKey('account', params);
    this.subscriptions.set(key, { type: 'account', callback, params });
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription('account', params);
    }

    return () => {
      this.subscriptions.delete(key);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscription('account', params);
      }
    };
  }

  /**
   * Subscribe to power meter updates (voting power, RC, vote value) for a specific user
   * This combines find_accounts, find_rc_accounts, get_reward_fund, and median_history_price
   */
  subscribeToPowerMeter(username: string, callback: (data: PowerMeterData) => void): () => void {
    const params = { account: username };
    const key = this.getSubscriptionKey('power_meter', params);
    this.subscriptions.set(key, { type: 'power_meter', callback, params });
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Use the method format your server expects
      this.send({
        id: Date.now(),
        method: 'subscribe_power_meter',
        params: [username]
      });
    }

    return () => {
      this.subscriptions.delete(key);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          id: Date.now(),
          method: 'unsubscribe_power_meter',
          params: []
        });
      }
    };
  }

  /**
   * Fetch power meter data once (for initial load)
   * Calls the 4 individual API methods and combines results
   */
  async fetchPowerMeterData(username: string, timeoutMs: number = 10000): Promise<PowerMeterData> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Call all 4 APIs in parallel
    const [accountResult, rcResult, rewardFundResult, medianPriceResult] = await Promise.all([
      this.callApi('database_api.find_accounts', { accounts: [username] }, timeoutMs),
      this.callApi('rc_api.find_rc_accounts', { accounts: [username] }, timeoutMs),
      this.callApi('condenser_api.get_reward_fund', ['post'], timeoutMs),
      this.callApi('condenser_api.get_current_median_history_price', [], timeoutMs),
    ]);

    const account = accountResult?.accounts?.[0];
    const rcAccount = rcResult?.rc_accounts?.[0];

    if (!account) {
      throw new Error('Account not found');
    }

    return {
      username,
      account: {
        vesting_shares: account.vesting_shares,
        received_vesting_shares: account.received_vesting_shares,
        delegated_vesting_shares: account.delegated_vesting_shares,
        vesting_withdraw_rate: account.vesting_withdraw_rate,
        voting_manabar: account.voting_manabar,
        downvote_manabar: account.downvote_manabar,
      },
      rc_account: rcAccount ? {
        max_rc: rcAccount.max_rc,
        rc_manabar: rcAccount.rc_manabar,
      } : { max_rc: '0', rc_manabar: { current_mana: '0', last_update_time: 0 } },
      reward_fund: {
        reward_balance: rewardFundResult?.reward_balance || '0 STEEM',
        recent_claims: rewardFundResult?.recent_claims || '1',
      },
      median_history_price: {
        base: medianPriceResult?.base || '0 SBD',
        quote: medianPriceResult?.quote || '1 STEEM',
      },
    };
  }

  /**
   * Call a Steem API method via WebSocket
   */
  private callApi(method: string, params: any, timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = Date.now() + Math.random();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`API call ${method} timed out`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.send({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });
    });
  }

  // ==================== Connection Event Handlers ====================

  /**
   * Register callback for connection open
   */
  onConnect(callback: ConnectionCallback): () => void {
    this.onConnectCallbacks.add(callback);
    return () => this.onConnectCallbacks.delete(callback);
  }

  /**
   * Register callback for connection close
   */
  onDisconnect(callback: ConnectionCallback): () => void {
    this.onDisconnectCallbacks.add(callback);
    return () => this.onDisconnectCallbacks.delete(callback);
  }

  /**
   * Register callback for connection error
   */
  onError(callback: (error: Event) => void): () => void {
    this.onErrorCallbacks.add(callback);
    return () => this.onErrorCallbacks.delete(callback);
  }

  // ==================== Connection Status ====================

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPingInterval();
    this.subscriptions.clear();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Change WebSocket URL (for custom node support)
   */
  setUrl(url: string): void {
    if (url !== this.wsUrl) {
      this.wsUrl = url;
      if (this.isConnected()) {
        this.disconnect();
        this.connect();
      }
    }
  }
}

// Export singleton instance
export const steemWebSocket = new SteemWebSocketService();

// Export class for testing
export { SteemWebSocketService };
