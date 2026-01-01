import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PiggyBank, X, Loader2, Clock, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
import { steemApi, SavingsWithdrawal } from '@/services/steemApi';
import { SecureStorageFactory } from '@/services/secureStorage';

interface SavingsWithdrawStatusProps {
  account: any;
  onUpdate?: () => void;
}

const SavingsWithdrawStatus = ({ account, onUpdate }: SavingsWithdrawStatusProps) => {
  const [isCancelling, setIsCancelling] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<SavingsWithdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null);
  const { toast } = useToast();
  
  // CRITICAL: Track which request_ids have been submitted to prevent duplicate transactions
  const cancelSubmittedRef = useRef<Set<number>>(new Set());

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

  // Load pending savings withdrawals
  useEffect(() => {
    const loadWithdrawals = async () => {
      if (!account?.name) return;
      
      setIsLoading(true);
      try {
        const pendingWithdrawals = await steemApi.getSavingsWithdrawFrom(account.name);
        setWithdrawals(pendingWithdrawals);
      } catch (error) {
        console.error('Error loading savings withdrawals:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadWithdrawals();
  }, [account?.name]);

  if (!account || isLoading) return null;
  if (withdrawals.length === 0) return null;

  // Check if current user is viewing their own account
  const isOwnAccount = username && account.name === username;

  // Calculate days until completion
  const getDaysUntil = (completeDate: string) => {
    const complete = new Date(completeDate);
    const now = new Date();
    const diffTime = complete.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Format amount with currency
  const formatAmount = (amount: string) => {
    const parts = amount.split(' ');
    return {
      value: parseFloat(parts[0]).toFixed(3),
      currency: parts[1] || 'STEEM'
    };
  };

  const handleCancelWithdrawal = async (requestId: number) => {
    if (!username) return;

    // CRITICAL: Prevent duplicate submissions
    if (cancelSubmittedRef.current.has(requestId) || isCancelling === requestId) {
      console.log('Blocking duplicate cancel withdrawal submission for request:', requestId);
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    cancelSubmittedRef.current.add(requestId);
    setIsCancelling(requestId);

    try {
      await handlePrivateKeyCancel(requestId);
    } catch (error: any) {
      console.error('Cancel savings withdrawal error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Withdrawal Already Cancelled",
          description: "This cancellation was already processed.",
        });
        setWithdrawals(prev => prev.filter(w => w.request_id !== requestId));
        onUpdate?.();
      } else {
        toast({
          title: "Operation Failed",
          description: "Failed to cancel savings withdrawal. Please try again.",
          variant: "destructive",
        });
        // Only reset ref on genuine errors to allow retry
        cancelSubmittedRef.current.delete(requestId);
      }
      setIsCancelling(null);
    }
  };

  const handlePrivateKeyCancel = async (requestId: number) => {
    const privateKeyString = activeKey;
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Active key required for this operation",
        variant: "destructive",
      });
      cancelSubmittedRef.current.delete(requestId);
      setIsCancelling(null);
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      await steemOperations.cancelTransferFromSavings(username!, requestId, privateKey);
      
      toast({
        title: "Withdrawal Cancelled",
        description: "Your savings withdrawal has been cancelled",
        variant: "success",
      });
      // Remove from local state
      setWithdrawals(prev => prev.filter(w => w.request_id !== requestId));
      onUpdate?.();
      setIsCancelling(null);
      // Keep requestId in cancelSubmittedRef to prevent any accidental double submissions
    } catch (error: any) {
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Withdrawal Already Cancelled",
          description: "This cancellation was already processed.",
          variant: "success",
        });
        setWithdrawals(prev => prev.filter(w => w.request_id !== requestId));
        onUpdate?.();
        setIsCancelling(null);
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
      cancelSubmittedRef.current.delete(requestId);
      setIsCancelling(null);
    }
  };

  // Calculate total pending
  const totalsByAsset = withdrawals.reduce((acc, w) => {
    const { value, currency } = formatAmount(w.amount);
    if (!acc[currency]) acc[currency] = 0;
    acc[currency] += parseFloat(value);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-2">
      {withdrawals.map((withdrawal) => {
        const { value, currency } = formatAmount(withdrawal.amount);
        const daysUntil = getDaysUntil(withdrawal.complete);
        const completeDate = new Date(withdrawal.complete);

        return (
          <div 
            key={withdrawal.request_id}
            className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30">
                <PiggyBank className="w-3 h-3 mr-1" />
                Savings Withdraw
              </Badge>
              
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-blue-300 font-medium">{value} {currency}</span>
                  {withdrawal.to !== withdrawal.from && (
                    <span className="text-blue-400/70 ml-1">→ @{withdrawal.to}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400/70" />
                  <span className="text-blue-300 font-medium">
                    {completeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-blue-400/70">({daysUntil} days)</span>
                </div>
              </div>
            </div>

            {isOwnAccount && (
              <Button
                onClick={() => {
                  setPendingCancelId(withdrawal.request_id);
                  setConfirmDialogOpen(true);
                }}
                variant="outline"
                size="sm"
                className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/50 text-xs"
                disabled={isCancelling === withdrawal.request_id}
              >
                {isCancelling === withdrawal.request_id ? (
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
          </div>
        );
      })}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="bg-slate-950/95 border-slate-800/70">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <AlertDialogTitle className="text-lg">Cancel Savings Withdrawal?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-slate-300 leading-relaxed">
                <span>Are you sure you want to cancel this savings withdrawal? This action will:</span>
                <ul className="mt-3 space-y-2 ml-4 list-disc text-sm">
                  <li>Stop the withdrawal process immediately</li>
                  <li>Keep your funds in savings account</li>
                  <li>Require starting a new withdrawal if you change your mind</li>
                </ul>
                <div className="mt-4 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400">Note: This operation requires your active key and cannot be undone.</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-900 border-slate-700 hover:bg-slate-800">Keep Withdrawal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingCancelId) {
                  handleCancelWithdrawal(pendingCancelId);
                  setPendingCancelId(null);
                }
              }}
              className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 hover:text-red-300"
            >
              Yes, Cancel Withdrawal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SavingsWithdrawStatus;
