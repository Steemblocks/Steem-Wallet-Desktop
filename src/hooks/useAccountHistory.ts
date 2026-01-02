import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { steemApi } from '@/services/steemApi';

export interface TransactionFilter {
  operationTypes: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// Default operations to show - financial, reward, and witness operations
const DEFAULT_OPERATION_TYPES = [
  'author_reward',
  'cancel_transfer_from_savings',
  'claim_reward_balance',
  'comment_benefactor_reward',
  'curation_reward',
  'delegate_vesting_shares',
  'escrow_approve',
  'escrow_dispute',
  'escrow_release',
  'escrow_transfer',
  'feed_publish',
  'fill_convert_request',
  'fill_transfer_from_savings',
  'fill_vesting_withdraw',
  'limit_order_cancel',
  'limit_order_create',
  'limit_order_create2',
  'producer_reward',
  'proposal_pay',
  'set_withdraw_vesting_route',
  'transfer',
  'transfer_from_savings',
  'transfer_to_savings',
  'transfer_to_vesting',
  'withdraw_vesting',
  'witness_set_properties',
  'witness_update',
  'account_witness_vote',
  'account_witness_proxy'
];

// Operations to exclude completely
const EXCLUDED_OPERATIONS = ['comment', 'custom_json', 'vote'];

// All available operation types for filtering
const ALL_AVAILABLE_OPERATIONS = [
  ...DEFAULT_OPERATION_TYPES
];

export const useAccountHistory = (account: string, limit: number = 100) => {
  const [filter, setFilter] = useState<TransactionFilter>({
    operationTypes: DEFAULT_OPERATION_TYPES
  });
  const [page, setPage] = useState(1);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [oldestLoadedIndex, setOldestLoadedIndex] = useState<number | null>(null);

  const { data: rawTransactions, isLoading, error, refetch } = useQuery({
    queryKey: ['accountHistory', account, limit],
    queryFn: async () => {
      if (!account) return [];
      
      try {
        const history = await steemApi.getAccountHistory(account, -1, limit);
        return history || [];
      } catch (error) {
        console.error('Error fetching account history:', error);
        throw error;
      }
    },
    enabled: !!account,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 120000, // Keep in cache for 2 minutes
    refetchInterval: 60000, // Auto-poll every 60 seconds for new transactions
    refetchIntervalInBackground: false, // Only poll when tab is active
  });

  useEffect(() => {
    if (rawTransactions && rawTransactions.length > 0) {
      const formatted = rawTransactions
        .map(tx => steemApi.formatTransaction(tx))
        .filter(tx => !EXCLUDED_OPERATIONS.includes(tx.type)) // Filter out excluded operations
        .reverse(); // Reverse to show latest first
      setAllTransactions(formatted);
      
      // Track the oldest (lowest) transaction index loaded
      // rawTransactions[0] is the oldest when fetched with -1
      const oldestIndex = rawTransactions[0][0];
      setOldestLoadedIndex(oldestIndex);
    }
  }, [rawTransactions]);

  // Apply filters to all transactions
  const filteredTransactions = allTransactions.filter(transaction => {
    // If no operation types selected, show all (except excluded ones)
    if (filter.operationTypes.length === 0) return true;
    
    // Check if transaction type is in selected operation types
    return filter.operationTypes.includes(transaction.type);
  });

  // Apply date filter if specified
  const dateFilteredTransactions = filter.dateRange 
    ? filteredTransactions.filter(tx => {
        const txDate = tx.timestamp;
        return txDate >= filter.dateRange!.from && txDate <= filter.dateRange!.to;
      })
    : filteredTransactions;

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(dateFilteredTransactions.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedTransactions = dateFilteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const loadMore = async () => {
    // Only load more if we have a valid oldest index and it's greater than 0
    if (oldestLoadedIndex === null || oldestLoadedIndex <= 0) {
      return; // No more transactions to load
    }
    
    try {
      // Fetch transactions older than the oldest we have
      // Use oldestLoadedIndex - 1 to avoid overlap
      const from = oldestLoadedIndex - 1;
      if (from < 0) return;
      
      const moreHistory = await steemApi.getAccountHistory(account, from, limit);
      if (moreHistory && moreHistory.length > 0) {
        // Get existing transaction indices for deduplication
        const existingIndices = new Set(allTransactions.map(tx => tx.index));
        
        const formatted = moreHistory
          .map(tx => steemApi.formatTransaction(tx))
          .filter(tx => !EXCLUDED_OPERATIONS.includes(tx.type)) // Filter out excluded operations
          .filter(tx => !existingIndices.has(tx.index)) // Remove duplicates
          .reverse(); // Reverse to show latest first
        
        if (formatted.length > 0) {
          // Append to end (older transactions)
          setAllTransactions(prev => [...prev, ...formatted]);
          
          // Update the oldest loaded index
          const newOldestIndex = moreHistory[0][0];
          setOldestLoadedIndex(newOldestIndex);
        }
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    }
  };

  // Get available operation types excluding the ones we don't want to show
  const availableOperationTypes = ALL_AVAILABLE_OPERATIONS
    .filter(type => !EXCLUDED_OPERATIONS.includes(type));

  // Check if there are more transactions to load
  const hasMore = oldestLoadedIndex !== null && oldestLoadedIndex > 0;

  // Custom refresh function that resets state and refetches
  const refresh = async () => {
    setPage(1);
    setOldestLoadedIndex(null);
    // Don't clear allTransactions before refetch - let the useEffect handle it
    // Use refetch with cache invalidation to ensure fresh data
    const result = await refetch();
    
    // If refetch returned data, process it immediately
    if (result.data && result.data.length > 0) {
      const formatted = result.data
        .map(tx => steemApi.formatTransaction(tx))
        .filter(tx => !EXCLUDED_OPERATIONS.includes(tx.type))
        .reverse();
      setAllTransactions(formatted);
      
      const oldestIndex = result.data[0][0];
      setOldestLoadedIndex(oldestIndex);
    } else {
      setAllTransactions([]);
    }
  };

  return {
    transactions: paginatedTransactions,
    allTransactions: dateFilteredTransactions,
    isLoading,
    error,
    filter,
    setFilter,
    page,
    setPage,
    totalPages,
    itemsPerPage,
    loadMore,
    hasMore,
    refresh,
    availableOperationTypes
  };
};
