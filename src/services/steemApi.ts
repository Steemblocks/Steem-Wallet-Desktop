import { API_CONFIG, getAllEndpoints, getPrimaryEndpoint } from '@/config/api';
import { jsonRpcRequest } from '@/utils/httpClient';

export interface SteemAccount {
  id: number;
  name: string;
  owner: {
    weight_threshold: number;
    account_auths: any[];
    key_auths: [string, number][];
  };
  active: {
    weight_threshold: number;
    account_auths: any[];
    key_auths: [string, number][];
  };
  posting: {
    weight_threshold: number;
    account_auths: any[];
    key_auths: [string, number][];
  };
  memo_key: string;
  json_metadata: string;
  proxy: string;
  last_owner_update: string;
  last_account_update: string;
  created: string;
  mined: boolean;
  recovery_account: string;
  last_account_recovery: string;
  reset_account: string;
  comment_count: number;
  lifetime_vote_count: number;
  post_count: number;
  can_vote: boolean;
  voting_power: number;
  voting_manabar?: {
    current_mana: string;
    last_update_time: number;
  };
  downvote_manabar?: {
    current_mana: string;
    last_update_time: number;
  };
  last_vote_time: string;
  balance: string;
  savings_balance: string;
  sbd_balance: string;
  sbd_seconds: string;
  sbd_seconds_last_update: string;
  sbd_last_interest_payment: string;
  savings_sbd_balance: string;
  savings_sbd_seconds: string;
  savings_sbd_seconds_last_update: string;
  savings_sbd_last_interest_payment: string;
  savings_withdraw_requests: number;
  reward_sbd_balance: string;
  reward_steem_balance: string;
  reward_vesting_balance: string;
  reward_vesting_steem: string;
  vesting_shares: string;
  delegated_vesting_shares: string;
  received_vesting_shares: string;
  vesting_withdraw_rate: string;
  next_vesting_withdrawal: string;
  withdrawn: number;
  to_withdraw: number;
  withdraw_routes: number;
  curation_rewards: number;
  posting_rewards: number;
  proxied_vsf_votes: number[];
  witnesses_voted_for: number;
  last_post: string;
  last_root_post: string;
  vesting_balance: string;
  reputation: string;
  transfer_history: any[];
  market_history: any[];
  post_history: any[];
  vote_history: any[];
  other_history: any[];
  witness_votes: string[];
  tags_usage: any[];
  guest_bloggers: any[];
}

export interface SteemWitness {
  id: number;
  owner: string;
  created: string;
  url: string;
  votes: string;
  virtual_last_update: string;
  virtual_position: string;
  virtual_scheduled_time: string;
  total_missed: number;
  last_aslot: number;
  last_confirmed_block_num: number;
  pow_worker: number;
  signing_key: string;
  props: {
    account_creation_fee: string;
    maximum_block_size: number;
    sbd_interest_rate: number;
    account_subsidy_budget: number;
    account_subsidy_decay: number;
  };
  sbd_exchange_rate: {
    base: string;
    quote: string;
  };
  last_sbd_exchange_update: string;
  last_work: string;
  running_version: string;
  hardfork_version_vote: string;
  hardfork_time_vote: string;
  available_witness_account_subsidies: number;
}

export interface MarketOrderBook {
  bids: Array<{
    order_price: {
      base: { amount: string; precision: number; nai: string };
      quote: { amount: string; precision: number; nai: string };
    };
    real_price: string;
    created: string;
  }>;
  asks: Array<{
    order_price: {
      base: { amount: string; precision: number; nai: string };
      quote: { amount: string; precision: number; nai: string };
    };
    real_price: string;
    created: string;
  }>;
}

export interface MarketTicker {
  latest: string;
  lowest_ask: string;
  highest_bid: string;
  percent_change: string;
  steem_volume: {
    amount: string;
    precision: number;
    nai: string;
  };
  sbd_volume: {
    amount: string;
    precision: number;
    nai: string;
  };
}

export interface MarketVolume {
  steem_volume: {
    amount: string;
    precision: number;
    nai: string;
  };
  sbd_volume: {
    amount: string;
    precision: number;
    nai: string;
  };
}

export interface MarketHistoryEntry {
  id: number;
  open: string;
  high: string;
  low: string;
  close: string;
  steem_volume: string;
  sbd_volume: string;
  seconds: number;
}

export interface MarketTradeHistoryEntry {
  date: string;
  current_pays: {
    amount: string;
    precision: number;
    nai: string;
  };
  open_pays: {
    amount: string;
    precision: number;
    nai: string;
  };
}

export interface MarketTradeHistory {
  trades: MarketTradeHistoryEntry[];
}

export interface RecentTradesResponse {
  trades: MarketTradeHistoryEntry[];
}

export interface SavingsWithdrawal {
  id: number;
  from: string;
  to: string;
  memo: string;
  request_id: number;
  amount: string;
  complete: string; // Date when withdrawal completes
}

export interface SteemProposal {
  id: number;
  proposal_id: number;
  creator: string;
  receiver: string;
  start_date: string;
  end_date: string;
  daily_pay: string;
  subject: string;
  permlink: string;
  total_votes: string;
}

export interface UserProposalVote {
  id: number;
  voter: string;
  proposal: {
    id: number;
    proposal_id: number;
    creator: string;
    receiver: string;
    start_date: string;
    end_date: string;
    daily_pay: {
      amount: string;
      precision: number;
      nai: string;
    };
    subject: string;
    permlink: string;
    total_votes: string;
    status: string;
  };
}

export interface VestingDelegation {
  id: number;
  delegator: string;
  delegatee: string;
  vesting_shares: string;
  min_delegation_time: string;
}

// Expiring vesting delegations (cancelled delegations in cooldown period)
export interface ExpiringVestingDelegation {
  id: number;
  delegator: string;
  vesting_shares: string;
  expiration: string;
}

export class SteemApiService {
  private currentEndpoint = 0;
  private endpoints = getAllEndpoints();

  // Helper function to format dates for Steem API
  private formatDateForSteemApi(date: Date): string {
    // Remove milliseconds and timezone indicator from ISO string
    // Changes "2025-06-25T06:00:00.000Z" to "2025-06-25T06:00:00"
    return date.toISOString().slice(0, 19);
  }

  private async makeRequest(method: string, params: any): Promise<any> {
    let lastError: Error | null = null;
    
    // Get the user's selected endpoint first
    const primaryEndpoint = getPrimaryEndpoint();
    
    // Build endpoints list: user's selected node first, then fallbacks
    const endpointsToTry = [primaryEndpoint];
    
    // Add fallback endpoints (excluding the primary to avoid duplicates)
    for (const endpoint of this.endpoints) {
      if (endpoint !== primaryEndpoint) {
        endpointsToTry.push(endpoint);
      }
    }

    // Track which endpoints were tried for better error reporting
    const failedEndpoints: string[] = [];

    // Try each endpoint using the CORS-bypassing HTTP client
    for (let attempt = 0; attempt < endpointsToTry.length; attempt++) {
      const endpoint = endpointsToTry[attempt];
      
      try {
        const response = await jsonRpcRequest(
          endpoint,
          method,
          params,
          API_CONFIG.REQUEST_TIMEOUT
        );

        if (!response.ok) {
          throw new Error(response.error || 'API Error');
        }

        return response.result;
      } catch (error) {
        lastError = error as Error;
        failedEndpoints.push(endpoint);
        // Only log detailed error on last attempt
        if (attempt === endpointsToTry.length - 1) {
          // In production, use console.warn to reduce noise
          const logFn = import.meta.env.DEV ? console.error : console.warn;
          logFn(`[SteemAPI] All ${failedEndpoints.length} endpoints failed for ${method}. Primary: ${primaryEndpoint}`, error);
        }
      }
    }

    // All endpoints exhausted, throw the last error with better context
    const errorMsg = `Request failed: All API endpoints unavailable. Primary: ${primaryEndpoint}`;
    throw new Error(errorMsg);
  }

  async getAccounts(usernames: string[]): Promise<SteemAccount[]> {
    return this.makeRequest('condenser_api.get_accounts', [usernames]);
  }

  async getAccount(username: string): Promise<SteemAccount | null> {
    const accounts = await this.getAccounts([username]);
    return accounts.length > 0 ? accounts[0] : null;
  }

  async getWitnessesByVote(startName: string | null = null, limit: number = 150): Promise<SteemWitness[]> {
    return this.makeRequest('condenser_api.get_witnesses_by_vote', [startName, limit]);
  }

  async getDynamicGlobalProperties(): Promise<any> {
    return this.makeRequest('condenser_api.get_dynamic_global_properties', []);
  }

  parseAmount(amountString: string): number {
    return parseFloat(amountString.split(' ')[0]);
  }

  calculateSteemPower(vestingShares: string, totalVestingShares: string, totalVestingFund: string): number {
    const vests = this.parseAmount(vestingShares);
    const totalVests = this.parseAmount(totalVestingShares);
    const totalFund = this.parseAmount(totalVestingFund);
    
    if (totalVests === 0) return 0;
    return (vests * totalFund) / totalVests;
  }

  formatReputation(reputation: string): number {
    const rep = parseInt(reputation);
    if (rep === 0) return 25;
    
    const neg = rep < 0;
    let reputationLevel = Math.log10(Math.abs(rep));
    reputationLevel = Math.max(reputationLevel - 9, 0);
    reputationLevel = (neg ? -1 : 1) * reputationLevel;
    reputationLevel = reputationLevel * 9 + 25;
    
    return Math.floor(reputationLevel);
  }

  formatVotes(votes: string): string {
    const voteCount = parseInt(votes);
    return voteCount.toLocaleString();
  }

  async getMarketOrderBook(limit: number = 50): Promise<MarketOrderBook> {
    return this.makeRequest('market_history_api.get_order_book', { limit });
  }

  async getMarketTicker(): Promise<MarketTicker> {
    return this.makeRequest('market_history_api.get_ticker', {});
  }

  async getMarketVolume(): Promise<MarketVolume> {
    return this.makeRequest('condenser_api.get_volume', []);
  }

  // Get the blockchain median price feed (witness-voted price)
  // This is the price used by the blockchain for reward calculations
  async getCurrentMedianHistoryPrice(): Promise<{ base: string; quote: string }> {
    return this.makeRequest('condenser_api.get_current_median_history_price', []);
  }

  async getMarketHistory(bucketSeconds: number, start: string, end: string): Promise<MarketHistoryEntry[]> {
    return this.makeRequest('condenser_api.get_market_history', [bucketSeconds, start, end]);
  }

  async getMarketTradeHistory(start: string, end: string, limit: number = 1000): Promise<MarketTradeHistory> {
    return this.makeRequest('market_history_api.get_trade_history', [{ start, end, limit }]);
  }

  formatMarketPrice(price: string): string {
    return parseFloat(price).toFixed(6);
  }

  formatMarketVolume(volume: { amount: string; precision: number }): string {
    const amount = parseInt(volume.amount);
    const divisor = Math.pow(10, volume.precision);
    return (amount / divisor).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }

  // Format order book data with proper precision
  formatOrderBookEntry(entry: any) {
    return {
      price: parseFloat(entry.real_price).toFixed(6),
      steem: (entry.steem / 1000).toFixed(3),
      sbd: (entry.sbd / 1000).toFixed(3),
      created: entry.created
    };
  }

  // Format trade history data with proper precision handling
  formatTradeHistoryEntry(entry: MarketTradeHistoryEntry) {
    const steemAmount = parseInt(entry.current_pays.amount) / Math.pow(10, entry.current_pays.precision);
    const sbdAmount = parseInt(entry.open_pays.amount) / Math.pow(10, entry.open_pays.precision);
    const price = sbdAmount / steemAmount;
    
    return {
      date: new Date(entry.date),
      steemAmount: steemAmount,
      sbdAmount: sbdAmount,
      price: price,
      type: entry.current_pays.nai === '@@000000021' ? 'sell' : 'buy'
    };
  }

  // Get last 24 hours of trade history
  async getLast24HoursTrades(): Promise<any[]> {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const history = await this.getMarketTradeHistory(
      start.toISOString(),
      end.toISOString(),
      1000
    );

    return history.trades.map(entry => this.formatTradeHistoryEntry(entry)).slice(0, 50);
  }

  // Get formatted market history for charts
  async getHourlyMarketHistory(): Promise<any[]> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const response = await this.makeRequest('market_history_api.get_market_history', {
        bucket_seconds: 3600, // 1 hour buckets
        start: this.formatDateForSteemApi(start),
        end: this.formatDateForSteemApi(end)
      });

      if (!response || !response.buckets) {
        return [];
      }

      return response.buckets.map((bucket: any) => {
        // Convert values from API format (divide by 1000 for proper scaling)
        const steemData = bucket.steem;
        const nonSteemData = bucket.non_steem;
        
        // Calculate price from steem/non_steem ratio
        const price = steemData.close / nonSteemData.close;
        const high = steemData.high / nonSteemData.high;
        const low = steemData.low / nonSteemData.low;
        const open = steemData.open / nonSteemData.open;
        
        // Volume is in STEEM
        const volume = steemData.volume / 1000;

        return {
          time: new Date(bucket.open).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          price: price,
          volume: volume,
          high: high,
          low: low,
          open: open,
          timestamp: new Date(bucket.open).getTime()
        };
      }).filter(entry => !isNaN(entry.price) && entry.price > 0)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error fetching hourly market history:', error);
      return [];
    }
  }

  async getDailyMarketHistory(): Promise<any[]> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      const response = await this.makeRequest('market_history_api.get_market_history', {
        bucket_seconds: 86400, // 1 day buckets
        start: this.formatDateForSteemApi(start),
        end: this.formatDateForSteemApi(end)
      });

      if (!response || !response.buckets) {
        return [];
      }

      return response.buckets.map((bucket: any) => {
        // Convert values from API format (divide by 1000 for proper scaling)
        const steemData = bucket.steem;
        const nonSteemData = bucket.non_steem;
        
        // Calculate price from steem/non_steem ratio
        const price = steemData.close / nonSteemData.close;
        const high = steemData.high / nonSteemData.high;
        const low = steemData.low / nonSteemData.low;
        const open = steemData.open / nonSteemData.open;
        
        // Volume is in STEEM
        const volume = steemData.volume / 1000;

        return {
          time: new Date(bucket.open).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }),
          price: price,
          volume: volume,
          high: high,
          low: low,
          open: open,
          timestamp: new Date(bucket.open).getTime()
        };
      }).filter(entry => !isNaN(entry.price) && entry.price > 0)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error fetching daily market history:', error);
      return [];
    }
  }

  async getRecentTrades(limit: number = 50): Promise<RecentTradesResponse> {
    return this.makeRequest('market_history_api.get_recent_trades', { limit });
  }

  async getRecentTradesFormatted(): Promise<any[]> {
    try {
      const response = await this.getRecentTrades(50);
      
      return response.trades.map(entry => this.formatTradeHistoryEntry(entry));
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      return [];
    }
  }

  async listProposals(start: number = 10, limit: number = 1000): Promise<SteemProposal[]> {
    // Use the exact parameter structure from your working curl command
    return this.makeRequest('condenser_api.list_proposals', [
      [start],           // [10] - start parameter as array
      limit,             // 1000 - limit
      "by_total_votes",  // order by votes
      "ascending",       // direction
      "votable"          // status
    ]);
  }

  async getProposalsByVotes(): Promise<SteemProposal[]> {
    try {
      const proposals = await this.listProposals(10, 1000);
      
      // Sort by total_votes in descending order (highest first)
      // Convert string votes to numbers for proper sorting
      const sortedProposals = proposals.sort((a, b) => {
        const votesA = parseInt(a.total_votes);
        const votesB = parseInt(b.total_votes);
        return votesB - votesA; // Descending order
      });

      return sortedProposals;
    } catch (error) {
      console.error('Error fetching proposals:', error);
      throw error;
    }
  }

  // Get user's proposal votes
  async getUserProposalVotes(username: string): Promise<number[]> {
    try {
      const response = await this.makeRequest('database_api.list_proposal_votes', {
        start: [username, 0],
        limit: 100,
        order: "by_voter_proposal",
        order_direction: "ascending",
        status: "all"
      });

      if (!response || !response.proposal_votes) {
        return [];
      }

      // Extract proposal IDs that the user has voted for
      return response.proposal_votes
        .filter((vote: UserProposalVote) => vote.voter === username)
        .map((vote: UserProposalVote) => vote.proposal.proposal_id);
    } catch (error) {
      console.error('Error fetching user proposal votes:', error);
      return [];
    }
  }

  formatProposalVotes(votes: string): string {
    const voteCount = parseInt(votes);
    if (voteCount >= 1000000000000) {
      return (voteCount / 1000000000000).toFixed(1) + 'T';
    } else if (voteCount >= 1000000000) {
      return (voteCount / 1000000000).toFixed(1) + 'B';
    } else if (voteCount >= 1000000) {
      return (voteCount / 1000000).toFixed(1) + 'M';
    } else if (voteCount >= 1000) {
      return (voteCount / 1000).toFixed(1) + 'K';
    }
    return voteCount.toLocaleString();
  }

  formatDailyPay(dailyPay: string): string {
    return dailyPay.replace(' SBD', '');
  }

  getProposalStatus(startDate: string, endDate: string): string {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'pending';
    if (now > end) return 'expired';
    return 'active';
  }

  async getSimplifiedMarketData() {
    try {
      const [orderBook, ticker, recentTrades] = await Promise.all([
        this.getMarketOrderBook(50),
        this.getMarketTicker(), 
        this.getRecentTradesFormatted()
      ]);

      return {
        orderBook,
        ticker,
        recentTrades,
        volume: {
          steem_volume: this.formatMarketVolume(ticker.steem_volume),
          sbd_volume: this.formatMarketVolume(ticker.sbd_volume)
        }
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  // Get withdraw vesting routes for an account
  async getWithdrawVestingRoutes(account: string): Promise<any[]> {
    try {
      const response = await this.makeRequest('database_api.list_withdraw_vesting_routes', {
        start: [account, ""],
        limit: 100,
        order: "by_withdraw_route"
      });

      if (!response || !response.routes) {
        return [];
      }

      // Filter routes for the specific account
      return response.routes.filter((route: any) => route.from_account === account);
    } catch (error) {
      console.error('Error fetching withdraw routes:', error);
      return [];
    }
  }

  // Get vesting delegations (outgoing delegations from an account)
  async getVestingDelegations(delegator: string, startAccount: string | null = null, limit: number = 100): Promise<VestingDelegation[]> {
    return this.makeRequest('condenser_api.get_vesting_delegations', [delegator, startAccount, limit]);
  }

  // Get expiring vesting delegations (delegations in cooldown period, returning to account)
  // These are delegations that were cancelled and are waiting ~5 days to return
  async getExpiringVestingDelegations(account: string, afterDate: string = '1970-01-01T00:00:00', limit: number = 100): Promise<ExpiringVestingDelegation[]> {
    return this.makeRequest('condenser_api.get_expiring_vesting_delegations', [account, afterDate, limit]);
  }

  // Helper method to format delegation data
  formatDelegation(delegation: VestingDelegation, steemPerMvests: number) {
    const vests = parseFloat(delegation.vesting_shares.split(' ')[0]);
    const steemPower = (vests / 1000000) * steemPerMvests;
    
    return {
      ...delegation,
      steemPower: steemPower.toFixed(3),
      vestsAmount: vests,
      formattedDate: new Date(delegation.min_delegation_time).toLocaleDateString()
    };
  }

  // Get account history with pagination
  // Always use direct HTTP API for consistent and fresh results
  async getAccountHistory(account: string, from: number = -1, limit: number = 100): Promise<any[]> {
    return this.makeRequest('condenser_api.get_account_history', [account, from, limit]);
  }

  // Helper method to filter transactions by operation type
  filterTransactionsByType(transactions: any[], operationTypes: string[]): any[] {
    if (operationTypes.length === 0) return transactions;
    
    return transactions.filter(transaction => {
      const operation = transaction[1]?.op;
      if (!operation || !Array.isArray(operation)) return false;
      
      const operationType = operation[0];
      return operationTypes.includes(operationType);
    });
  }

  // Helper method to format transaction data
  formatTransaction(transaction: any) {
    const [index, txData] = transaction;
    const { timestamp, op } = txData;
    const [operationType, operationData] = op;

    // Steem blockchain timestamps are in UTC, append 'Z' to ensure proper parsing
    const utcTimestamp = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
    const date = new Date(utcTimestamp);

    return {
      index,
      timestamp: date,
      type: operationType,
      data: operationData,
      formattedTimestamp: date.toLocaleString(),
      operationType,
      operationData
    };
  }

  // Get common operation types for filtering
  getCommonOperationTypes(): string[] {
    return [
      'transfer',
      'transfer_to_vesting',
      'withdraw_vesting',
      'delegate_vesting_shares',
      'claim_reward_balance',
      'author_reward',
      'curation_reward',
      'comment_benefactor_reward',
      'transfer_to_savings',
      'transfer_from_savings',
      'cancel_transfer_from_savings',
      'fill_convert_request',
      'fill_order',
      'limit_order_create',
      'limit_order_cancel',
      'vote',
      'comment',
      'custom_json'
    ];
  }

  // Get pending savings withdrawals for an account
  async getSavingsWithdrawFrom(account: string): Promise<SavingsWithdrawal[]> {
    try {
      const result = await this.makeRequest('condenser_api.get_savings_withdraw_from', [account]);
      return result || [];
    } catch (error) {
      console.error('Error fetching savings withdrawals:', error);
      return [];
    }
  }

  // Get pending savings withdrawals to an account
  async getSavingsWithdrawTo(account: string): Promise<SavingsWithdrawal[]> {
    try {
      const result = await this.makeRequest('condenser_api.get_savings_withdraw_to', [account]);
      return result || [];
    } catch (error) {
      console.error('Error fetching savings withdrawals to:', error);
      return [];
    }
  }
}

export const steemApi = new SteemApiService();
