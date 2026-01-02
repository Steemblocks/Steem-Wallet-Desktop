import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { steemApi, SteemAccount } from "@/services/steemApi";
import { MarketPriceData, PricesData } from "@/services/priceApi";
import { getSteemPerMvests, vestsToSteem } from "@/utils/utility";
import { SecureStorageFactory } from "@/services/secureStorage";
import { getPrimaryEndpoint } from "@/config/api";
import { steemWebSocket, GlobalPropsData, PowerMeterData as WsPowerMeterData } from "@/services/steemWebSocket";
import { dataCache } from "@/services/dataCache";

// ===== Types =====
export interface WalletData {
  steem: string;
  steemPower: string;
  sbd: string;
  savings: {
    steem: string;
    sbd: string;
  };
  delegated: string;
  received: string;
  reputation: number;
  votingPower: number;
  resourceCredits: number;
  accountValue: string;
  usdValue: string;
  steemPrice: number;
  sbdPrice: number;
  steemMarketData: MarketPriceData;
  sbdMarketData: MarketPriceData;
}

export interface FormattedDelegation {
  delegatee: string;
  delegator: string;
  min_delegation_time: string;
  vesting_shares: string;
  steemPower: string;
  vestsAmount: number;
  formattedDate: string;
}

export interface FormattedWitness {
  name: string;
  votes: string;
  voted: boolean;
  rank: number;
  version: string;
  url: string;
  missedBlocks: number;
  lastBlock: number;
  signing_key: string;
  isDisabledByKey: boolean;
  hasInvalidVersion: boolean;
  isDisabled: boolean;
}

export interface MarketDataState {
  orderBook: any;
  ticker: any;
  volume: { steem_volume: string; sbd_volume: string } | null;
  tradeHistory: any[];
  hourlyHistory: any[];
  dailyHistory: any[];
}

// Power meters data for AccountPowerMeters component
export interface PowerMeterData {
  votingPower: number;
  downvotePower: number;
  resourceCredits: number;
  maxResourceCredits: number;
  votingRechargeTime: string;
  downvoteRechargeTime: string;
  rcRechargeTime: string;
  voteValue: number;
  fullVoteValue: number;
}

export interface PreloadedData {
  // Account data
  account: SteemAccount | null;
  walletData: WalletData;

  // Delegations
  outgoingDelegations: FormattedDelegation[];
  totalDelegatedOut: number;

  // Witnesses (top 150)
  witnesses: FormattedWitness[];
  userWitnessVotes: string[];

  // Market data
  marketData: MarketDataState;
  priceData: PricesData | null;

  // Conversion rate
  steemPerMvests: number;

  // Account history (recent transactions)
  recentTransactions: any[];

  // Power meters data (voting/downvote/RC)
  powerMeterData: PowerMeterData | null;
}

interface WalletDataContextType {
  // Data state
  data: PreloadedData;

  // Loading states
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadingProgress: number;
  loadingStage: string;

  // Errors
  error: Error | null;

  // Actions
  refreshAll: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  refreshMarket: () => Promise<void>;
  setSelectedAccount: (username: string) => void;

  // Current account
  selectedAccount: string;
  loggedInUser: string | null;
  setLoggedInUser: (user: string | null) => void;
  
  // Active tab for optimized API calls
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// ===== Default Values =====
const defaultMarketPriceData: MarketPriceData = {
  price: 0,
  priceChange24h: 0,
  marketCap: 0,
  volume24h: 0,
  high24h: 0,
  low24h: 0,
  image: "",
  lastUpdated: new Date().toISOString(),
};

const defaultWalletData: WalletData = {
  steem: "0.000",
  steemPower: "0.000",
  sbd: "0.000",
  savings: { steem: "0.000", sbd: "0.000" },
  delegated: "0.000",
  received: "0.000",
  reputation: 25,
  votingPower: 100,
  resourceCredits: 100,
  accountValue: "0.00",
  usdValue: "0.00",
  steemPrice: 0.25,
  sbdPrice: 1.0,
  steemMarketData: { ...defaultMarketPriceData, price: 0.25 },
  sbdMarketData: { ...defaultMarketPriceData, price: 1.0 },
};

const defaultPreloadedData: PreloadedData = {
  account: null,
  walletData: defaultWalletData,
  outgoingDelegations: [],
  totalDelegatedOut: 0,
  witnesses: [],
  userWitnessVotes: [],
  marketData: {
    orderBook: null,
    ticker: null,
    volume: null,
    tradeHistory: [],
    hourlyHistory: [],
    dailyHistory: [],
  },
  priceData: null,
  steemPerMvests: 500,
  recentTransactions: [],
  powerMeterData: null,
};

// ===== Context =====
const WalletDataContext = createContext<WalletDataContextType | undefined>(
  undefined
);

// ===== Helper Functions =====
const formatVotesInMillions = (rawVests: string): string => {
  const vests = parseFloat(rawVests);
  const millions = vests / 1000000000000000;
  return `${millions.toFixed(1)}M`;
};

const isWitnessDisabledByKey = (witness: any): boolean => {
  return witness.signing_key && witness.signing_key.startsWith("STM1111111111");
};

const hasInvalidVersion = (witness: any): boolean => {
  return witness.running_version !== "0.23.1";
};

// Get price data from Steem's internal market (no CORS issues)
const fetchPriceFromSteemMarket = async (): Promise<PricesData> => {
  const defaultPriceData: PricesData = {
    steem: {
      price: 0.25,
      priceChange24h: 0,
      marketCap: 0,
      volume24h: 0,
      high24h: 0,
      low24h: 0,
      image: "",
      lastUpdated: new Date().toISOString(),
    },
    sbd: {
      price: 1.0,
      priceChange24h: 0,
      marketCap: 0,
      volume24h: 0,
      high24h: 0,
      low24h: 0,
      image: "",
      lastUpdated: new Date().toISOString(),
    },
    lastFetched: Date.now(),
  };

  try {
    const response = await fetch(getPrimaryEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "condenser_api.get_ticker",
        params: [],
        id: 1,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result) {
        // The ticker gives us SBD/STEEM price
        // latest is the price of 1 STEEM in SBD
        const sbdPerSteem = parseFloat(data.result.latest) || 1;

        // Approximate USD price (SBD is roughly pegged to $1)
        // If 1 STEEM = 0.25 SBD, then STEEM price in USD ≈ $0.25
        const steemPriceUsd = sbdPerSteem;

        return {
          steem: {
            price: steemPriceUsd,
            priceChange24h: parseFloat(data.result.percent_change) || 0,
            marketCap: 0,
            volume24h: parseFloat(data.result.steem_volume) || 0,
            high24h: 0,
            low24h: 0,
            image: "",
            lastUpdated: new Date().toISOString(),
          },
          sbd: {
            price: 1.0, // SBD is pegged to ~$1
            priceChange24h: 0,
            marketCap: 0,
            volume24h: parseFloat(data.result.sbd_volume) || 0,
            high24h: 0,
            low24h: 0,
            image: "",
            lastUpdated: new Date().toISOString(),
          },
          lastFetched: Date.now(),
        };
      }
    }
  } catch (error) {
    console.error("Error fetching from Steem market:", error);
  }

  return defaultPriceData;
};

// Calculate recharge time helper
const calculateRechargeTime = (currentPower: number): string => {
  if (currentPower >= 100) return "Full";
  const powerNeeded = 100 - currentPower;
  const secondsToFull = (powerNeeded / 100) * 432000; // 5 days = 432000 seconds

  if (secondsToFull < 3600) {
    return `${Math.ceil(secondsToFull / 60)}m`;
  } else if (secondsToFull < 86400) {
    return `${Math.ceil(secondsToFull / 3600)}h`;
  } else {
    return `${(secondsToFull / 86400).toFixed(1)}d`;
  }
};

// Process WebSocket power meter data to context's PowerMeterData format
const processPowerMeterData = (wsData: WsPowerMeterData): PowerMeterData | null => {
  try {
    const account = wsData.account;
    const rcAccount = wsData.rc_account;
    const rewardFund = wsData.reward_fund;
    const medianPrice = wsData.median_history_price;
    const now = Date.now();

    // Get vesting values in RAW units (NAI format)
    const vestingSharesRaw =
      account.vesting_shares?.nai === "@@000000037"
        ? BigInt(account.vesting_shares.amount)
        : BigInt(Math.floor(parseFloat(account.vesting_shares?.amount || "0") * 1e6));
    const receivedVestingRaw =
      account.received_vesting_shares?.nai === "@@000000037"
        ? BigInt(account.received_vesting_shares.amount)
        : BigInt(Math.floor(parseFloat(account.received_vesting_shares?.amount || "0") * 1e6));
    const delegatedVestingRaw =
      account.delegated_vesting_shares?.nai === "@@000000037"
        ? BigInt(account.delegated_vesting_shares.amount)
        : BigInt(Math.floor(parseFloat(account.delegated_vesting_shares?.amount || "0") * 1e6));
    const vestingWithdrawRateRaw =
      account.vesting_withdraw_rate?.nai === "@@000000037"
        ? BigInt(account.vesting_withdraw_rate.amount)
        : BigInt(Math.floor(parseFloat(account.vesting_withdraw_rate?.amount || "0") * 1e6));

    // Total effective vests
    const effectiveVestsRaw =
      vestingSharesRaw + receivedVestingRaw - delegatedVestingRaw - vestingWithdrawRateRaw;
    const totalVests = Number(effectiveVestsRaw) / 1e6;
    const maxVotingMana = effectiveVestsRaw;

    // Calculate voting power from voting_manabar
    const votingManabar = account.voting_manabar;
    const lastVoteTime = votingManabar.last_update_time * 1000;
    const secondsSinceVote = Math.floor((now - lastVoteTime) / 1000);
    const storedVotingMana = BigInt(votingManabar.current_mana);
    const regeneratedMana = (maxVotingMana * BigInt(secondsSinceVote)) / BigInt(432000);
    let currentVotingMana = storedVotingMana + regeneratedMana;
    if (currentVotingMana > maxVotingMana) currentVotingMana = maxVotingMana;
    const currentVotingPower =
      maxVotingMana > BigInt(0)
        ? Number((currentVotingMana * BigInt(10000)) / maxVotingMana) / 100
        : 0;

    // Calculate downvote power
    const maxDownvoteMana = maxVotingMana / BigInt(4);
    const downvoteManabar = account.downvote_manabar;
    const lastDownvoteTime = downvoteManabar.last_update_time * 1000;
    const secondsSinceDownvote = Math.floor((now - lastDownvoteTime) / 1000);
    const storedDownvoteMana = BigInt(downvoteManabar.current_mana);
    const regeneratedDownvoteMana = (maxDownvoteMana * BigInt(secondsSinceDownvote)) / BigInt(432000);
    let currentDownvoteMana = storedDownvoteMana + regeneratedDownvoteMana;
    if (currentDownvoteMana > maxDownvoteMana) currentDownvoteMana = maxDownvoteMana;
    const currentDownvotePower =
      maxDownvoteMana > BigInt(0)
        ? Number((currentDownvoteMana * BigInt(10000)) / maxDownvoteMana) / 100
        : 0;

    // Calculate RC percentage
    let rcPercentage = 100;
    if (rcAccount) {
      const maxRcMana = BigInt(rcAccount.max_rc);
      const lastRcUpdate = Number(rcAccount.rc_manabar.last_update_time) * 1000;
      const storedRcMana = BigInt(rcAccount.rc_manabar.current_mana);
      const secondsSinceRcUpdate = (now - lastRcUpdate) / 1000;
      const rcRegenRate = maxRcMana / BigInt(432000);
      const regeneratedRc = rcRegenRate * BigInt(Math.floor(secondsSinceRcUpdate));
      let currentRcMana = storedRcMana + regeneratedRc;
      if (currentRcMana > maxRcMana) currentRcMana = maxRcMana;
      rcPercentage = Number((currentRcMana * BigInt(10000)) / maxRcMana) / 100;
    }

    // Calculate vote value
    const rewardBalance = parseFloat(rewardFund?.reward_balance || "0");
    const recentClaims = parseFloat(rewardFund?.recent_claims || "1");

    // Get SBD/STEEM price from median
    let sbdPerSteem: number | null = null;
    if (medianPrice?.base && medianPrice?.quote) {
      const base = parseFloat(medianPrice.base.replace(" SBD", ""));
      const quote = parseFloat(medianPrice.quote.replace(" STEEM", ""));
      if (base > 0 && quote > 0) {
        sbdPerSteem = base / quote;
      }
    }

    // Calculate vote values
    const finalVest = totalVests * 1e6;
    let currentVoteSbd = 0;
    let fullVoteSbd = 0;

    if (sbdPerSteem !== null) {
      const vpScale = currentVotingPower * 100;
      const weight = 10000;
      const currentPower = (vpScale * weight) / 10000 / 50;
      const currentRshares = (currentPower * finalVest) / 10000;
      const currentVoteSteem = (currentRshares / recentClaims) * rewardBalance;
      currentVoteSbd = currentVoteSteem * sbdPerSteem;

      const fullVpScale = 10000;
      const fullPower = (fullVpScale * weight) / 10000 / 50;
      const fullRshares = (fullPower * finalVest) / 10000;
      const fullVoteSteem = (fullRshares / recentClaims) * rewardBalance;
      fullVoteSbd = fullVoteSteem * sbdPerSteem;
    }

    return {
      votingPower: currentVotingPower,
      downvotePower: currentDownvotePower,
      resourceCredits: rcPercentage,
      maxResourceCredits: 100,
      votingRechargeTime: calculateRechargeTime(currentVotingPower),
      downvoteRechargeTime: calculateRechargeTime(currentDownvotePower),
      rcRechargeTime: calculateRechargeTime(rcPercentage),
      voteValue: currentVoteSbd,
      fullVoteValue: fullVoteSbd,
    };
  } catch (error) {
    console.error("Error processing WebSocket power meter data:", error);
    return null;
  }
};

const formatWalletDataFromAccount = async (
  account: SteemAccount,
  marketData: PricesData,
  steemPerMvests: number
): Promise<WalletData> => {
  const steem = steemApi.parseAmount(account.balance);
  const sbd = steemApi.parseAmount(account.sbd_balance);
  const savingsSteem = steemApi.parseAmount(account.savings_balance);
  const savingsSbd = steemApi.parseAmount(account.savings_sbd_balance);
  const delegatedVests = steemApi.parseAmount(account.delegated_vesting_shares);
  const receivedVests = steemApi.parseAmount(account.received_vesting_shares);
  const vestingShares = steemApi.parseAmount(account.vesting_shares);

  const steemPower = vestsToSteem(vestingShares, steemPerMvests);
  const delegatedSP = vestsToSteem(delegatedVests, steemPerMvests);
  const receivedSP = vestsToSteem(receivedVests, steemPerMvests);
  const reputation = steemApi.formatReputation(account.reputation);

  // Calculate accurate voting power from manabar
  let votingPower = account.voting_power / 100;
  if (account.voting_manabar) {
    const effectiveVests = vestingShares + receivedVests - delegatedVests;
    const maxVotingMana = effectiveVests * 1e6;
    const now = Date.now();
    const lastUpdateTime =
      (account.voting_manabar.last_update_time || 0) * 1000;
    const secondsSinceUpdate = Math.max(0, (now - lastUpdateTime) / 1000);
    const storedMana = parseFloat(account.voting_manabar.current_mana || "0");
    const regenRate = maxVotingMana / 432000;
    const regeneratedMana = regenRate * secondsSinceUpdate;
    const currentMana = Math.min(storedMana + regeneratedMana, maxVotingMana);
    votingPower = maxVotingMana > 0 ? (currentMana / maxVotingMana) * 100 : 0;
  }

  // Calculate USD values
  const steemValueUsd =
    (steem + steemPower + savingsSteem) * marketData.steem.price;
  const sbdValueUsd = (sbd + savingsSbd) * marketData.sbd.price;
  const totalUsdValue = steemValueUsd + sbdValueUsd;
  const accountValue = steem + sbd + steemPower + savingsSteem + savingsSbd;

  return {
    steem: steem.toFixed(3),
    steemPower: steemPower.toFixed(3),
    sbd: sbd.toFixed(3),
    savings: {
      steem: savingsSteem.toFixed(3),
      sbd: savingsSbd.toFixed(3),
    },
    delegated: delegatedSP.toFixed(3),
    received: receivedSP.toFixed(3),
    reputation,
    votingPower: Math.min(100, Math.max(0, votingPower)),
    resourceCredits: 100, // Will be updated separately if needed
    accountValue: accountValue.toFixed(2),
    usdValue: totalUsdValue.toFixed(2),
    steemPrice: marketData.steem.price,
    sbdPrice: marketData.sbd.price,
    steemMarketData: marketData.steem,
    sbdMarketData: marketData.sbd,
  };
};

// Excluded operations for history
const EXCLUDED_OPERATIONS = ["comment", "custom_json", "vote"];

// ===== Provider Component =====
interface WalletDataProviderProps {
  children: ReactNode;
}

export const WalletDataProvider: React.FC<WalletDataProviderProps> = ({
  children,
}) => {
  const queryClient = useQueryClient();

  // State
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("Initializing...");
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<PreloadedData>(defaultPreloadedData);
  
  // Active tab state for optimized API calls (default "overview" won't need market data)
  const [activeTab, setActiveTab] = useState<string>("overview");
  
  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  const wsUnsubscribeRef = useRef<(() => void)[]>([]);

  // Initialize WebSocket connection
  useEffect(() => {
    steemWebSocket.connect()
      .then(() => {
        setWsConnected(true);
      })
      .catch((err) => {
        console.warn('[WalletDataContext] WebSocket connection failed, using REST polling');
        setWsConnected(false);
      });

    const unsubConnect = steemWebSocket.onConnect(() => {
      setWsConnected(true);
    });

    const unsubDisconnect = steemWebSocket.onDisconnect(() => {
      setWsConnected(false);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      // Clean up all subscriptions
      wsUnsubscribeRef.current.forEach(unsub => unsub());
      wsUnsubscribeRef.current = [];
    };
  }, []);

  // Subscribe to global properties via WebSocket
  useEffect(() => {
    if (!wsConnected) return;

    const unsubscribe = steemWebSocket.subscribeToGlobalProps((globalProps: GlobalPropsData) => {
      // Calculate steemPerMvests from global props
      const totalVestingFund = parseFloat(globalProps.total_vesting_fund_steem.split(' ')[0]);
      const totalVestingShares = parseFloat(globalProps.total_vesting_shares.split(' ')[0]);
      const steemPerMvests = (totalVestingFund / totalVestingShares) * 1000000;

      setData(prev => ({
        ...prev,
        steemPerMvests,
      }));
    });

    wsUnsubscribeRef.current.push(unsubscribe);

    return () => {
      unsubscribe();
      wsUnsubscribeRef.current = wsUnsubscribeRef.current.filter(u => u !== unsubscribe);
    };
  }, [wsConnected]);

  // Subscribe to account updates via WebSocket when logged in
  useEffect(() => {
    if (!wsConnected || !selectedAccount) return;

    const unsubscribe = steemWebSocket.subscribeToAccount(selectedAccount, async (accountUpdate) => {
      // Update account data with real-time changes
      if (data.account && data.priceData) {
        // Merge the update with existing account data
        const updatedAccount = {
          ...data.account,
          balance: accountUpdate.balance || data.account.balance,
          sbd_balance: accountUpdate.sbd_balance || data.account.sbd_balance,
          vesting_shares: accountUpdate.vesting_shares || data.account.vesting_shares,
          reward_steem_balance: accountUpdate.reward_steem_balance || data.account.reward_steem_balance,
          reward_sbd_balance: accountUpdate.reward_sbd_balance || data.account.reward_sbd_balance,
          reward_vesting_balance: accountUpdate.reward_vesting_balance || data.account.reward_vesting_balance,
        };

        // Recalculate wallet data
        const walletData = await formatWalletDataFromAccount(
          updatedAccount,
          data.priceData,
          data.steemPerMvests
        );

        setData(prev => ({
          ...prev,
          account: updatedAccount,
          walletData,
        }));
      }
    });

    wsUnsubscribeRef.current.push(unsubscribe);

    return () => {
      unsubscribe();
      wsUnsubscribeRef.current = wsUnsubscribeRef.current.filter(u => u !== unsubscribe);
    };
  }, [wsConnected, selectedAccount, data.account, data.priceData, data.steemPerMvests]);

  // Subscribe to power meter updates via WebSocket when logged in
  useEffect(() => {
    if (!wsConnected || !selectedAccount) return;

    const unsubscribe = steemWebSocket.subscribeToPowerMeter(selectedAccount, (wsData) => {
      // Process WebSocket data and update power meters
      const processedData = processPowerMeterData(wsData);
      if (processedData) {
        setData(prev => ({
          ...prev,
          powerMeterData: processedData,
        }));
      }
    });

    wsUnsubscribeRef.current.push(unsubscribe);

    return () => {
      unsubscribe();
      wsUnsubscribeRef.current = wsUnsubscribeRef.current.filter(u => u !== unsubscribe);
    };
  }, [wsConnected, selectedAccount]);

  // Load saved user on mount
  useEffect(() => {
    const loadSavedUser = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const savedUsername = await storage.getItem("steem_username");
        if (savedUsername) {
          setLoggedInUser(savedUsername);
          setSelectedAccount(savedUsername);
        }
      } catch (err) {
        console.error("Error loading saved user:", err);
      }
    };
    loadSavedUser();
  }, []);

  // Main data fetching function with caching
  const fetchAllData = useCallback(
    async (username: string, isRefresh = false) => {
      if (!username) {
        setIsInitialLoading(false);
        return;
      }

      try {
        if (!isRefresh) {
          setIsInitialLoading(true);
          setLoadingProgress(0);
          
          // Try to load cached data for immediate display while fetching fresh data
          try {
            const cachedData = await dataCache.getStaleDataForQuickLoad(username);
            if (cachedData.walletData || cachedData.witnesses || cachedData.delegations) {
              console.log('[WalletDataContext] Using cached data for quick display');
              setData(prev => ({
                ...prev,
                walletData: cachedData.walletData || prev.walletData,
                witnesses: cachedData.witnesses || prev.witnesses,
                outgoingDelegations: cachedData.delegations || prev.outgoingDelegations,
                recentTransactions: cachedData.accountHistory || prev.recentTransactions,
              }));
              // Show faster initial progress
              setLoadingProgress(20);
            }
          } catch (cacheError) {
            console.warn('[WalletDataContext] Cache read error:', cacheError);
          }
        } else {
          setIsRefreshing(true);
        }
        setError(null);

        // Stage 1: Fetch core data in parallel (30%)
        setLoadingStage("Fetching account data...");
        setLoadingProgress(isRefresh ? 10 : 25);

        const [steemPerMvests, priceData, account] = await Promise.all([
          getSteemPerMvests(),
          fetchPriceFromSteemMarket(),
          steemApi.getAccount(username),
        ]);

        if (!account) {
          throw new Error(`Account ${username} not found`);
        }
        
        // Cache price data
        dataCache.cachePriceData(priceData).catch(console.warn);

        setLoadingProgress(30);
        setLoadingStage("Processing wallet data...");

        // Stage 2: Format wallet data (40%)
        const walletData = await formatWalletDataFromAccount(
          account,
          priceData,
          steemPerMvests
        );
        
        // Cache wallet data
        dataCache.cacheWalletData(username, walletData).catch(console.warn);
        
        setLoadingProgress(40);

        // Stage 3: Fetch delegations and witnesses in parallel (60%)
        setLoadingStage("Loading delegations & witnesses...");

        const [delegationsResult, witnessesResult] =
          await Promise.all([
            steemApi.getVestingDelegations(username).catch(() => []),
            steemApi.getWitnessesByVote(null, 150).catch(() => []),
          ]);

        setLoadingProgress(60);

        // Format delegations
        const outgoingDelegations = delegationsResult
          .filter((d: any) => parseFloat(d.vesting_shares.split(" ")[0]) > 0)
          .map((d: any) => steemApi.formatDelegation(d, steemPerMvests));

        const totalDelegatedOut = outgoingDelegations.reduce(
          (sum: number, d: any) => sum + parseFloat(d.steemPower),
          0
        );
        
        // Cache delegations
        dataCache.cacheDelegations(username, outgoingDelegations).catch(console.warn);

        // Format witnesses
        const userWitnessVotes = account.witness_votes || [];
        const witnesses = witnessesResult.map((witness: any, index: number) => {
          const isDisabledByKey = isWitnessDisabledByKey(witness);
          const hasInvalidVer = hasInvalidVersion(witness);
          return {
            name: witness.owner,
            votes: formatVotesInMillions(witness.votes),
            voted: userWitnessVotes.includes(witness.owner),
            rank: index + 1,
            version: witness.running_version,
            url: witness.url,
            missedBlocks: witness.total_missed,
            lastBlock: witness.last_confirmed_block_num,
            signing_key: witness.signing_key,
            isDisabledByKey,
            hasInvalidVersion: hasInvalidVer,
            isDisabled: isDisabledByKey || hasInvalidVer,
          };
        });
        
        // Cache witnesses
        dataCache.cacheWitnesses(witnesses).catch(console.warn);

        setLoadingProgress(70);
        setLoadingStage("Loading history & power data...");

        // Stage 4: Fetch account history and power meter data (90%)
        // Try to fetch power meter data via WebSocket for faster initial load
        // Skip heavy market history data - it will be fetched on-demand when user visits market tab
        const [accountHistory, wsPowerMeterData] = await Promise.all([
          steemApi.getAccountHistory(username, -1, 100).catch(() => []),
          steemWebSocket.isConnected() 
            ? steemWebSocket.fetchPowerMeterData(username).catch(() => null)
            : Promise.resolve(null)
        ]);
        
        // Process power meter data if received
        const powerMeterData = wsPowerMeterData ? processPowerMeterData(wsPowerMeterData) : null;

        setLoadingProgress(90);
        setLoadingStage("Finalizing...");

        // Format account history
        const recentTransactions = (accountHistory || [])
          .map((tx: any) => steemApi.formatTransaction(tx))
          .filter((tx: any) => !EXCLUDED_OPERATIONS.includes(tx.type))
          .reverse();
        
        // Cache account history
        dataCache.cacheAccountHistory(username, recentTransactions).catch(console.warn);

        // Compile market data (empty until user visits market tab)
        const marketData: MarketDataState = {
          orderBook: null,
          ticker: null,
          volume: null,
          tradeHistory: [],
          hourlyHistory: [],
          dailyHistory: [],
        };

        // Set all data at once
        setData({
          account,
          walletData,
          outgoingDelegations,
          totalDelegatedOut,
          witnesses,
          userWitnessVotes,
          marketData,
          priceData,
          steemPerMvests,
          recentTransactions,
          powerMeterData,
        });

        setLoadingProgress(100);
        setLoadingStage("Complete!");

        // Small delay to show completion
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err) {
        console.error("Error fetching wallet data:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Fetch data when selected account changes
  useEffect(() => {
    if (selectedAccount) {
      fetchAllData(selectedAccount, false);
    } else {
      setData(defaultPreloadedData);
      setIsInitialLoading(false);
    }
  }, [selectedAccount, fetchAllData]);

  // Auto-refresh with adaptive interval based on WebSocket connection
  // When WebSocket is connected: 60 seconds (just for price/power data that WS doesn't provide)
  // When WebSocket is disconnected: 30 seconds (fallback polling)
  useEffect(() => {
    if (!selectedAccount || isInitialLoading) return;

    // Use longer interval when WebSocket is connected (real-time updates handle most data)
    const refreshInterval = wsConnected ? 60000 : 30000;

    const interval = setInterval(async () => {
      // Only do a minimal refresh for non-market tabs
      if (activeTab !== 'market') {
        // Just refresh account data, not market data
        setIsRefreshing(true);
        try {
          // If WebSocket is connected, we only need to fetch price data
          // Account data and power meter data come from WebSocket
          if (wsConnected) {
            const priceData = await fetchPriceFromSteemMarket();
            
            setData((prev) => ({
              ...prev,
              priceData,
            }));
          } else {
            // Fallback to full polling when WebSocket is down
            const [steemPerMvests, priceData, account] = await Promise.all([
              getSteemPerMvests(),
              fetchPriceFromSteemMarket(),
              steemApi.getAccount(selectedAccount),
            ]);

            if (account && priceData) {
              const walletData = await formatWalletDataFromAccount(
                account,
                priceData,
                steemPerMvests
              );
              
              setData((prev) => ({
                ...prev,
                account,
                walletData,
                priceData,
                steemPerMvests,
              }));
            }
          }
        } catch (err) {
          console.error("Error in minimal refresh:", err);
        } finally {
          setIsRefreshing(false);
        }
      } else {
        // Full refresh including market data when on market tab
        // Market tab uses its own WebSocket subscriptions via useMarketData hook
        if (!wsConnected) {
          fetchAllData(selectedAccount, true);
        }
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [selectedAccount, isInitialLoading, fetchAllData, activeTab, wsConnected]);

  // Actions
  const refreshAll = useCallback(async () => {
    if (selectedAccount) {
      await fetchAllData(selectedAccount, true);
    }
  }, [selectedAccount, fetchAllData]);

  const refreshAccount = useCallback(async () => {
    if (!selectedAccount) return;

    setIsRefreshing(true);
    try {
      const account = await steemApi.getAccount(selectedAccount);
      if (account && data.priceData) {
        const walletData = await formatWalletDataFromAccount(
          account,
          data.priceData,
          data.steemPerMvests
        );
        setData((prev) => ({ ...prev, account, walletData }));
      }
    } catch (err) {
      console.error("Error refreshing account:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedAccount, data.priceData, data.steemPerMvests]);

  const refreshMarket = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [priceData, marketDataResult] = await Promise.all([
        fetchPriceFromSteemMarket(),
        steemApi.getSimplifiedMarketData(),
      ]);

      const marketData: MarketDataState = {
        orderBook: marketDataResult?.orderBook || null,
        ticker: marketDataResult?.ticker || null,
        volume: marketDataResult?.volume
          ? {
              steem_volume: marketDataResult.volume.steem_volume,
              sbd_volume: marketDataResult.volume.sbd_volume,
            }
          : null,
        tradeHistory: marketDataResult?.recentTrades || [],
        hourlyHistory: data.marketData.hourlyHistory,
        dailyHistory: data.marketData.dailyHistory,
      };

      // Also update wallet data with new prices
      if (data.account && priceData) {
        const walletData = await formatWalletDataFromAccount(
          data.account,
          priceData,
          data.steemPerMvests
        );
        setData((prev) => ({ ...prev, priceData, marketData, walletData }));
      } else {
        setData((prev) => ({ ...prev, priceData, marketData }));
      }
    } catch (err) {
      console.error("Error refreshing market data:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [data.account, data.steemPerMvests, data.marketData]);

  // Memoized context value
  const contextValue = useMemo<WalletDataContextType>(
    () => ({
      data,
      isInitialLoading,
      isRefreshing,
      loadingProgress,
      loadingStage,
      error,
      refreshAll,
      refreshAccount,
      refreshMarket,
      setSelectedAccount,
      selectedAccount,
      loggedInUser,
      setLoggedInUser,
      activeTab,
      setActiveTab,
    }),
    [
      data,
      isInitialLoading,
      isRefreshing,
      loadingProgress,
      loadingStage,
      error,
      refreshAll,
      refreshAccount,
      refreshMarket,
      selectedAccount,
      loggedInUser,
      activeTab,
    ]
  );

  return (
    <WalletDataContext.Provider value={contextValue}>
      {children}
    </WalletDataContext.Provider>
  );
};

// ===== Hook =====
// Track if we've already warned about HMR context issue
let hmrWarned = false;

export const useWalletData = (): WalletDataContextType => {
  const context = useContext(WalletDataContext);
  if (context === undefined) {
    // During HMR, the context might briefly be undefined
    // This provides a graceful fallback instead of crashing
    if (!hmrWarned) {
      hmrWarned = true;
      // Reset after a short delay to allow warning again if issue persists
      setTimeout(() => { hmrWarned = false; }, 5000);
    }
    return {
      data: defaultPreloadedData,
      isInitialLoading: true,
      isRefreshing: false,
      loadingProgress: 0,
      loadingStage: "Initializing...",
      error: null,
      refreshAll: async () => {},
      refreshAccount: async () => {},
      refreshMarket: async () => {},
      setSelectedAccount: () => {},
      selectedAccount: "",
      loggedInUser: null,
      setLoggedInUser: () => {},
      activeTab: "overview",
      setActiveTab: () => {},
    };
  }
  return context;
};

// Re-export types for backwards compatibility
export { defaultWalletData };
