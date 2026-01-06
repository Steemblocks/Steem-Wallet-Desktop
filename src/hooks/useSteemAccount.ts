
import { useQuery } from '@tanstack/react-query';
import { steemApi, SteemAccount } from '@/services/steemApi';
import { priceApi, MarketPriceData } from '@/services/priceApi';
import { getSteemPerMvests, vestsToSteem } from '@/utils/utility';

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
  // New market data fields
  steemMarketData: MarketPriceData;
  sbdMarketData: MarketPriceData;
}

export const useSteemAccount = (username: string) => {
  return useQuery({
    queryKey: ['steemAccount', username],
    queryFn: () => steemApi.getAccount(username),
    enabled: !!username,
    // Disabled automatic polling - WalletDataContext handles real-time updates via WebSocket
    // Components can still call refetch() manually when needed after operations
    refetchInterval: false,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 120000, // Keep in cache for 2 minutes
    refetchOnWindowFocus: false,
  });
};

export const formatWalletData = async (account: SteemAccount): Promise<WalletData> => {
  const steem = steemApi.parseAmount(account.balance);
  const sbd = steemApi.parseAmount(account.sbd_balance);
  const savingsSteem = steemApi.parseAmount(account.savings_balance);
  const savingsSbd = steemApi.parseAmount(account.savings_sbd_balance);
  const delegatedVests = steemApi.parseAmount(account.delegated_vesting_shares);
  const receivedVests = steemApi.parseAmount(account.received_vesting_shares);
  const vestingShares = steemApi.parseAmount(account.vesting_shares);
  
  // Default market data for fallback
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

  try {
    // Get current STEEM per Mvests conversion rate and market data
    const [steemPerMvests, marketData] = await Promise.all([
      getSteemPerMvests(),
      priceApi.getMarketData()
    ]);
    
    // Convert Vests to STEEM Power using the utility functions
    const steemPower = vestsToSteem(vestingShares, steemPerMvests);
    const delegatedSP = vestsToSteem(delegatedVests, steemPerMvests);
    const receivedSP = vestsToSteem(receivedVests, steemPerMvests);
    
    const reputation = steemApi.formatReputation(account.reputation);
    
    // Calculate accurate voting power from manabar if available, otherwise use deprecated field
    let votingPower = account.voting_power / 100; // Fallback to deprecated field
    
    // If voting_manabar is available, calculate accurate VP
    if (account.voting_manabar) {
      const effectiveVests = vestingShares + receivedVests - delegatedVests;
      const maxVotingMana = effectiveVests * 1e6;
      const now = Date.now();
      const lastUpdateTime = (account.voting_manabar.last_update_time || 0) * 1000;
      const secondsSinceUpdate = Math.max(0, (now - lastUpdateTime) / 1000);
      const storedMana = parseFloat(account.voting_manabar.current_mana || '0');
      const regenRate = maxVotingMana / 432000; // 5 days full regen
      const regeneratedMana = regenRate * secondsSinceUpdate;
      const currentMana = Math.min(storedMana + regeneratedMana, maxVotingMana);
      votingPower = maxVotingMana > 0 ? (currentMana / maxVotingMana) * 100 : 0;
    }
    
    // Calculate USD values
    const steemValueUsd = (steem + steemPower + savingsSteem) * marketData.steem.price;
    const sbdValueUsd = (sbd + savingsSbd) * marketData.sbd.price;
    const totalUsdValue = steemValueUsd + sbdValueUsd;
    
    // Simple account value calculation (STEEM + SBD + STEEM Power)
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
      votingPower,
      resourceCredits: 85, // Placeholder - would need separate API call
      accountValue: accountValue.toFixed(2),
      usdValue: totalUsdValue.toFixed(2),
      steemPrice: marketData.steem.price,
      sbdPrice: marketData.sbd.price,
      steemMarketData: marketData.steem,
      sbdMarketData: marketData.sbd,
    };
  } catch (error) {
    console.error('Error converting Vests to STEEM Power or fetching prices:', error);
    
    // Fallback to rough approximation if API call fails
    const steemPower = vestingShares / 1000000; // Rough approximation
    const delegatedSP = delegatedVests / 1000000;
    const receivedSP = receivedVests / 1000000;
    
    const reputation = steemApi.formatReputation(account.reputation);
    
    // Calculate accurate voting power from manabar if available
    let votingPower = account.voting_power / 100; // Fallback to deprecated field
    if (account.voting_manabar) {
      const effectiveVests = vestingShares + receivedVests - delegatedVests;
      const maxVotingMana = effectiveVests * 1e6;
      const now = Date.now();
      const lastUpdateTime = (account.voting_manabar.last_update_time || 0) * 1000;
      const secondsSinceUpdate = Math.max(0, (now - lastUpdateTime) / 1000);
      const storedMana = parseFloat(account.voting_manabar.current_mana || '0');
      const regenRate = maxVotingMana / 432000;
      const regeneratedMana = regenRate * secondsSinceUpdate;
      const currentMana = Math.min(storedMana + regeneratedMana, maxVotingMana);
      votingPower = maxVotingMana > 0 ? (currentMana / maxVotingMana) * 100 : 0;
    }
    const accountValue = steem + sbd + steemPower + savingsSteem + savingsSbd;
    
    // Fallback USD calculation with default prices
    const totalUsdValue = ((steem + steemPower + savingsSteem) * 0.25) + ((sbd + savingsSbd) * 1.0);

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
      votingPower,
      resourceCredits: 85,
      accountValue: accountValue.toFixed(2),
      usdValue: totalUsdValue.toFixed(2),
      steemPrice: 0.25,
      sbdPrice: 1.0,
      steemMarketData: { ...defaultMarketData, price: 0.25 },
      sbdMarketData: { ...defaultMarketData, price: 1.0 },
    };
  }
};
