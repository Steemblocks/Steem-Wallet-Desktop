import { useEffect, useRef, useCallback } from 'react';
import { steemOperations } from '@/services/steemOperations';
import { steemApi, SteemAccount } from '@/services/steemApi';
import { getSteemPerMvests, vestsToSteem } from '@/utils/utility';
import * as dsteem from 'dsteem';
import { useToast } from '@/hooks/use-toast';
import { getDecryptedKey } from '@/hooks/useSecureKeys';

// Check for rewards every 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;

interface UseAutoRewardClaimingOptions {
  enabled: boolean;
  username: string | null;
  // Optional: Pass in account data from WalletDataContext to avoid redundant API calls
  // If provided, the hook will use this data first and only fetch if needed
  accountData?: SteemAccount | null;
  onRewardsClaimed?: () => void;
}

export const useAutoRewardClaiming = ({ 
  enabled, 
  username,
  accountData,
  onRewardsClaimed 
}: UseAutoRewardClaimingOptions) => {
  const { toast } = useToast();
  const isClaimingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastClaimAttemptRef = useRef<number>(0);

  const claimRewards = useCallback(async () => {
    if (!enabled || !username || isClaimingRef.current) {
      return;
    }

    // Prevent claiming more than once per minute
    const now = Date.now();
    if (now - lastClaimAttemptRef.current < 60000) {
      return;
    }

    try {
      // Use provided account data if available and fresh, otherwise fetch
      let account: SteemAccount | null = null;
      
      if (accountData && accountData.name === username) {
        // Use the provided account data (already fetched by WalletDataContext)
        account = accountData;
      } else {
        // Fallback: Fetch latest account data
        const accounts = await steemApi.getAccounts([username]);
        if (!accounts || accounts.length === 0) {
          return;
        }
        account = accounts[0];
      }

      const rewardSteem = parseFloat(account.reward_steem_balance?.split(' ')[0] || '0');
      const rewardSbd = parseFloat(account.reward_sbd_balance?.split(' ')[0] || '0');
      const rewardVests = parseFloat(account.reward_vesting_balance?.split(' ')[0] || '0');

      // Check if there are any pending rewards
      const hasPendingRewards = rewardSteem > 0 || rewardSbd > 0 || rewardVests > 0;

      if (!hasPendingRewards) {
        return;
      }

      // Mark as claiming
      isClaimingRef.current = true;
      lastClaimAttemptRef.current = now;

      // Get private key (decrypted from secure storage)
      const postingKey = await getDecryptedKey(username, 'posting');
      const activeKey = await getDecryptedKey(username, 'active');
      const ownerKey = await getDecryptedKey(username, 'owner');

      const privateKeyString = postingKey || activeKey || ownerKey;

      if (!privateKeyString) {
        console.log('Auto reward claiming: No private key available');
        isClaimingRef.current = false;
        return;
      }

      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);

      const rewardSteemBalance = `${rewardSteem.toFixed(3)} STEEM`;
      const rewardSbdBalance = `${rewardSbd.toFixed(3)} SBD`;
      const rewardVestingBalance = `${rewardVests.toFixed(6)} VESTS`;

      console.log('Auto claiming rewards:', { rewardSteemBalance, rewardSbdBalance, rewardVestingBalance });

      await steemOperations.claimRewardBalance(
        username,
        rewardSteemBalance,
        rewardSbdBalance,
        rewardVestingBalance,
        privateKey
      );

      // Build reward summary
      const rewardParts: string[] = [];
      if (rewardSteem > 0) rewardParts.push(`${rewardSteem.toFixed(3)} STEEM`);
      if (rewardSbd > 0) rewardParts.push(`${rewardSbd.toFixed(3)} SBD`);
      if (rewardVests > 0) {
        // Get accurate SP value using the proper conversion
        try {
          const steemPerMvests = await getSteemPerMvests();
          const spValue = vestsToSteem(rewardVests, steemPerMvests);
          rewardParts.push(`${spValue.toFixed(3)} SP`);
        } catch {
          // Fallback to approximate value if conversion fails
          const approxSp = rewardVests / 1000000;
          rewardParts.push(`~${approxSp.toFixed(3)} SP`);
        }
      }

      toast({
        title: "Rewards Auto-Claimed!",
        description: `Automatically claimed: ${rewardParts.join(', ')}`,
        variant: "success",
      });

      onRewardsClaimed?.();

    } catch (error: any) {
      console.error('Auto reward claiming error:', error);
      
      // Check for duplicate transaction - this means it was already claimed
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        console.log('Rewards already claimed (duplicate transaction)');
        onRewardsClaimed?.();
      }
    } finally {
      isClaimingRef.current = false;
    }
  }, [enabled, username, accountData, toast, onRewardsClaimed]);

  useEffect(() => {
    if (!enabled || !username) {
      // Clear interval if disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run immediately on enable
    claimRewards();

    // Set up interval to check periodically
    intervalRef.current = setInterval(claimRewards, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, username, claimRewards]);

  return {
    claimRewardsNow: claimRewards,
  };
};

export default useAutoRewardClaiming;
