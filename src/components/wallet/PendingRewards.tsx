
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
import { getSteemPerMvests, vestsToSteem } from '@/utils/utility';
import { SecureStorageFactory } from '@/services/secureStorage';
import { SteemAccount } from '@/services/steemApi';

interface PendingRewardsProps {
  account: SteemAccount | null;
  onUpdate?: () => void;
}

const PendingRewards = ({ account, onUpdate }: PendingRewardsProps) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [rewardSteemPower, setRewardSteemPower] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const { toast } = useToast();
  
  // CRITICAL: Track transaction submission to prevent duplicate transactions
  const claimSubmittedRef = useRef(false);

  // Load username from secure storage - reload when account changes
  useEffect(() => {
    const loadData = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        setUsername(user);
      } catch (error) {
        console.error('Error loading user data from storage:', error);
      }
    };
    loadData();
  }, [account?.name]); // Re-run when account changes

  if (!account) return null;
  const rewardSteem = parseFloat(account.reward_steem_balance?.split(' ')[0] || '0');
  const rewardSbd = parseFloat(account.reward_sbd_balance?.split(' ')[0] || '0');
  const rewardVests = parseFloat(account.reward_vesting_balance?.split(' ')[0] || '0');

  // Check if current user is viewing their own account
  const isOwnAccount = username && account.name === username;

  // Check if there are any pending rewards
  const hasPendingRewards = rewardSteem > 0 || rewardSbd > 0 || rewardVests > 0;

  useEffect(() => {
    const convertRewardVestsToSteem = async () => {
      if (rewardVests > 0) {
        try {
          const steemPerMvests = await getSteemPerMvests();
          const steemPowerAmount = vestsToSteem(rewardVests, steemPerMvests);
          setRewardSteemPower(steemPowerAmount);
        } catch (error) {
          console.error('Error converting reward VESTS to STEEM:', error);
          // Fallback calculation
          setRewardSteemPower(rewardVests / 1000000);
        }
      }
    };

    convertRewardVestsToSteem();
  }, [rewardVests]);

  const handleClaimRewards = async () => {
    if (!username || !hasPendingRewards) return;

    // CRITICAL: Prevent duplicate submissions
    if (claimSubmittedRef.current || isClaiming) {
      console.log('Blocking duplicate claim rewards submission');
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    claimSubmittedRef.current = true;
    setIsClaiming(true);

    try {
      await handlePrivateKeyClaim();
    } catch (error: any) {
      console.error('Claim rewards error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Rewards Already Claimed",
          description: "Your rewards were already claimed.",
          variant: "success",
        });
        onUpdate?.();
      } else {
        toast({
          title: "Operation Failed",
          description: "Failed to claim rewards. Please try again.",
          variant: "destructive",
        });
        // Only reset ref on genuine errors to allow retry
        claimSubmittedRef.current = false;
      }
      setIsClaiming(false);
    }
  };

  const handlePrivateKeyClaim = async () => {
    // Try different keys in order: posting, active, owner
    const storage = SecureStorageFactory.getInstance();
    const postingKey = await storage.getItem('steem_posting_key');
    const activeKey = await storage.getItem('steem_active_key');
    const ownerKey = await storage.getItem('steem_owner_key');

    let privateKeyString = postingKey || activeKey || ownerKey;
    
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Posting, Active, or Owner key required for this operation",
        variant: "destructive",
      });
      claimSubmittedRef.current = false;
      setIsClaiming(false);
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      
      const rewardSteemBalance = `${rewardSteem.toFixed(3)} STEEM`;
      const rewardSbdBalance = `${rewardSbd.toFixed(3)} SBD`;
      const rewardVestingBalance = `${rewardVests.toFixed(6)} VESTS`;

      await steemOperations.claimRewardBalance(
        username!,
        rewardSteemBalance,
        rewardSbdBalance,
        rewardVestingBalance,
        privateKey
      );
      
      toast({
        title: "Rewards Claimed Successfully",
        description: "Your pending rewards have been claimed and added to your wallet",
        variant: "success",
      });
      // Call onUpdate to refresh data without page reload
      onUpdate?.();
      setIsClaiming(false);
      // Keep claimSubmittedRef as true to prevent any accidental double submissions
    } catch (error: any) {
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Rewards Already Claimed",
          description: "Your rewards were already claimed successfully.",
          variant: "success",
        });
        onUpdate?.();
        setIsClaiming(false);
        return;
      }
      
      let errorMessage = "Operation failed";
      if (error.jse_shortmsg) {
        errorMessage = error.jse_shortmsg;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Operation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      // CRITICAL: Reset ref so user can retry on genuine errors
      claimSubmittedRef.current = false;
      setIsClaiming(false);
    }
  };

  // Don't show if not own account or no pending rewards
  if (!isOwnAccount || !hasPendingRewards) {
    return null;
  }

  return (
    <div className="flex items-center justify-between bg-slate-800 border border-emerald-800 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="bg-green-900/50 text-green-400 hover:bg-green-900/60">
          <Gift className="w-3 h-3 mr-1" />
          Pending Rewards
        </Badge>
        
        <div className="flex items-center gap-4 text-sm">
          {rewardSteem > 0 && (
            <div>
              <span className="text-green-400 font-medium">{rewardSteem.toFixed(3)} STEEM</span>
            </div>
          )}
          
          {rewardSbd > 0 && (
            <div>
              <span className="text-green-400 font-medium">{rewardSbd.toFixed(3)} SBD</span>
            </div>
          )}
          
          {rewardVests > 0 && (
            <div>
              <span className="text-green-400 font-medium">{rewardSteemPower.toFixed(3)} SP</span>
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={handleClaimRewards}
        variant="outline"
        size="sm"
        className="border-emerald-600 text-emerald-400 hover:bg-emerald-950 text-xs"
        disabled={isClaiming}
      >
        {isClaiming ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Claiming...
          </>
        ) : (
          <>
            <Gift className="w-3 h-3 mr-1" />
            Claim
          </>
        )}
      </Button>
    </div>
  );
};

export default PendingRewards;
