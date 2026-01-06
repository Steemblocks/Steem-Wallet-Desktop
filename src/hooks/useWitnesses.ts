
import { useQuery } from '@tanstack/react-query';
import { steemApi } from '@/services/steemApi';

export const useWitnesses = () => {
  return useQuery({
    queryKey: ['witnesses'],
    queryFn: () => steemApi.getWitnessesByVote(null, 150),
    refetchInterval: 120000, // Refetch every 2 minutes (witnesses don't change often)
    staleTime: 60000, // Consider data stale after 60 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Helper function to format votes in millions
const formatVotesInMillions = (rawVests: string): string => {
  const vests = parseFloat(rawVests);
  const millions = vests / 1000000000000000; // Convert to millions (15 zeros)
  return `${millions.toFixed(1)}M`;
};

// Helper function to check if witness is disabled due to signing key
const isWitnessDisabledByKey = (witness: any): boolean => {
  return witness.signing_key && witness.signing_key.startsWith('STM1111111111');
};

// Helper function to check if witness has invalid version
const hasInvalidVersion = (witness: any): boolean => {
  return witness.running_version !== '0.23.1';
};

interface UseWitnessDataOptions {
  // If provided, these witness votes will be used instead of fetching from API
  // This allows the caller to pass in votes from WalletDataContext to avoid duplicate API calls
  preloadedWitnessVotes?: string[];
}

export const useWitnessData = (loggedInUser: string | null, options?: UseWitnessDataOptions) => {
  const { data: witnesses, isLoading: witnessesLoading, error: witnessesError } = useWitnesses();
  
  // Only fetch user account if we don't have preloaded witness votes
  const shouldFetchAccount = !!loggedInUser && !options?.preloadedWitnessVotes;
  
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['userWitnessVotes', loggedInUser],
    queryFn: () => loggedInUser ? steemApi.getAccount(loggedInUser) : null,
    enabled: shouldFetchAccount,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 120000, // Keep in cache for 2 minutes
    refetchOnWindowFocus: false,
  });

  // Use preloaded votes if available, otherwise fall back to fetched data
  const userWitnessVotes = options?.preloadedWitnessVotes || userData?.witness_votes || [];

  const formattedWitnesses = witnesses?.map((witness, index) => {
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
  }) || [];

  return {
    witnesses: formattedWitnesses,
    // If using preloaded votes, don't show user loading state
    isLoading: witnessesLoading || (shouldFetchAccount && userLoading),
    error: witnessesError,
    userVoteCount: userWitnessVotes.length,
  };
};
