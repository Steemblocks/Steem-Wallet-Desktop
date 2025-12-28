import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowDown, X, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
import { getSteemPerMvests, vestsToSteem, getDaysUntilNextWithdrawal } from '@/utils/utility';
import { SecureStorageFactory } from '@/services/secureStorage';

interface PowerDownStatusProps {
  account: any;
  onUpdate?: () => void;
}

const PowerDownStatus = ({ account, onUpdate }: PowerDownStatusProps) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [weeklySteem, setWeeklySteem] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // CRITICAL: Track transaction submission to prevent duplicate transactions
  const cancelSubmittedRef = useRef(false);

  // Load credentials from secure storage - reload when account changes
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        const key = await storage.getItem('steem_active_key');
        setUsername(user);
        setActiveKey(key);
      } catch (error) {
        console.error('Error loading credentials from storage:', error);
      }
    };
    loadCredentials();
  }, [account?.name]); // Re-run when account changes

  if (!account) return null;

  const vestingWithdrawRate = parseFloat(account.vesting_withdraw_rate?.split(' ')[0] || '0');
  const nextWithdrawal = new Date(account.next_vesting_withdrawal);
  const withdrawn = parseFloat(account.withdrawn || '0');
  const toWithdraw = parseFloat(account.to_withdraw || '0');

  // Check if power down is active
  const isPowerDownActive = vestingWithdrawRate > 0 && nextWithdrawal > new Date('1970-01-01');

  // Calculate days until next withdrawal
  const daysUntilNext = getDaysUntilNextWithdrawal(account.next_vesting_withdrawal);

  // Check if current user is viewing their own account
  const isOwnAccount = username && account.name === username;

  useEffect(() => {
    const convertVestsToSteem = async () => {
      if (isPowerDownActive && vestingWithdrawRate > 0) {
        try {
          const steemPerMvests = await getSteemPerMvests();
          const weeklyAmount = vestsToSteem(vestingWithdrawRate, steemPerMvests);
          setWeeklySteem(weeklyAmount);
        } catch (error) {
          console.error('Error converting VESTS to STEEM:', error);
          // Fallback calculation
          setWeeklySteem(vestingWithdrawRate / 1000000);
        }
      }
    };

    convertVestsToSteem();
  }, [isPowerDownActive, vestingWithdrawRate]);

  const handleCancelPowerDown = async () => {
    if (!username || !isPowerDownActive) return;

    // CRITICAL: Prevent duplicate submissions
    if (cancelSubmittedRef.current || isCancelling) {
      console.log('Blocking duplicate cancel power down submission');
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    cancelSubmittedRef.current = true;
    setIsCancelling(true);

    try {
      await handlePrivateKeyCancel();
    } catch (error: any) {
      console.error('Cancel power down error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Power Down Already Cancelled",
          description: "This cancellation was already processed.",
        });
        onUpdate?.();
      } else {
        toast({
          title: "Operation Failed",
          description: "Failed to cancel power down. Please try again.",
          variant: "destructive",
        });
        // Only reset ref on genuine errors to allow retry
        cancelSubmittedRef.current = false;
      }
      setIsCancelling(false);
    }
  };

  const handlePrivateKeyCancel = async () => {
    const privateKeyString = activeKey;
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Active key required for this operation",
        variant: "destructive",
      });
      cancelSubmittedRef.current = false;
      setIsCancelling(false);
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      await steemOperations.powerDown(username!, '0.000000 VESTS', privateKey);
      
      toast({
        title: "Power Down Cancelled",
        description: "Your power down has been successfully cancelled",
      });
      onUpdate?.();
      setIsCancelling(false);
      // Keep cancelSubmittedRef as true to prevent any accidental double submissions
    } catch (error: any) {
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Power Down Already Cancelled",
          description: "This cancellation was already processed.",
        });
        onUpdate?.();
        setIsCancelling(false);
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
      cancelSubmittedRef.current = false;
      setIsCancelling(false);
    }
  };

  if (!isPowerDownActive) {
    return null; // Don't show anything if no active power down
  }

  return (
    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
          <ArrowDown className="w-3 h-3 mr-1" />
          Power Down Active
        </Badge>
        
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-amber-300 font-medium">{weeklySteem.toFixed(3)} STEEM</span>
            <span className="text-amber-400/70 ml-1">weekly</span>
          </div>
          
          <div>
            <span className="text-amber-300 font-medium">
              {nextWithdrawal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span className="text-amber-400/70 ml-1">({daysUntilNext} days)</span>
          </div>
        </div>
      </div>

      {isOwnAccount && (
        <Button
          onClick={() => setConfirmDialogOpen(true)}
          variant="outline"
          size="sm"
          className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/50 text-xs"
          disabled={isCancelling}
        >
          {isCancelling ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Cancelling...
            </>
          ) : (
            <>
              <X className="w-3 h-3 mr-1" />
              Cancel
            </>
          )}
        </Button>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="bg-slate-950/95 border-slate-800/70">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <AlertDialogTitle className="text-lg">Cancel Power Down?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-slate-300 leading-relaxed">
                <span>Are you sure you want to cancel your active power down? This action will:</span>
                <ul className="mt-3 space-y-2 ml-4 list-disc text-sm">
                  <li>Stop all scheduled weekly STEEM payouts</li>
                  <li>Keep your remaining Steem Power locked</li>
                  <li>Require starting a new power down if you change your mind</li>
                  <li className="text-amber-300 font-medium">Any partial payouts already received will remain in your account</li>
                </ul>
                <div className="mt-4 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400">Note: This operation requires your active key and cannot be undone.</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-900 border-slate-700 hover:bg-slate-800">Keep Power Down</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleCancelPowerDown()}
              className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 hover:text-red-300"
            >
              Yes, Cancel Power Down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PowerDownStatus;
