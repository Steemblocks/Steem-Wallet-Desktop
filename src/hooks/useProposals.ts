import { useQuery, useQueryClient } from '@tanstack/react-query';
import { steemApi, SteemProposal } from '@/services/steemApi';

/**
 * Hook for fetching and caching proposal data
 * Centralizes proposal fetching to avoid duplicate API calls
 */
export const useProposals = () => {
  return useQuery({
    queryKey: ['proposals'],
    queryFn: () => steemApi.getProposalsByVotes(),
    staleTime: 60000, // Cache for 60 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching user's proposal votes
 */
export const useUserProposalVotes = (username: string | null) => {
  return useQuery({
    queryKey: ['userProposalVotes', username],
    queryFn: () => username ? steemApi.getUserProposalVotes(username) : [],
    enabled: !!username,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching user's created proposals (filtered from all proposals)
 */
export const useUserCreatedProposals = (username: string | null) => {
  const { data: allProposals, isLoading, error, refetch } = useProposals();
  
  const userProposals = allProposals?.filter(
    (p: SteemProposal) => p.creator === username
  ) || [];

  return {
    userProposals,
    hasProposals: userProposals.length > 0,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook to invalidate and refetch proposals
 * Use this after creating/removing proposals
 */
export const useInvalidateProposals = () => {
  const queryClient = useQueryClient();
  
  return {
    invalidateProposals: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    invalidateUserVotes: (username?: string) => {
      if (username) {
        queryClient.invalidateQueries({ queryKey: ['userProposalVotes', username] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['userProposalVotes'] });
      }
    },
    invalidateAll: (username?: string) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      if (username) {
        queryClient.invalidateQueries({ queryKey: ['userProposalVotes', username] });
      }
    }
  };
};
