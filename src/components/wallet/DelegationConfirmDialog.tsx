import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Handshake, Loader2, AlertTriangle, User, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
import { SecureStorageFactory } from '@/services/secureStorage';

interface DelegationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  delegator: string;
  delegatee: string;
  amount: string;
  vestingShares: string;
  onSuccess: () => void;
}

const DelegationConfirmDialog = ({ 
  isOpen, 
  onClose, 
  delegator,
  delegatee, 
  amount, 
  vestingShares,
  onSuccess
}: DelegationConfirmDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionComplete, setTransactionComplete] = useState(false);
  const { toast } = useToast();
  
  // Ref to track if a transaction has been submitted for this dialog session
  const transactionSubmittedRef = useRef(false);
  // Track previous open state to detect true open/close transitions
  const wasOpenRef = useRef(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const justClosed = !isOpen && wasOpenRef.current;
    
    if (justOpened) {
      transactionSubmittedRef.current = false;
      setTransactionComplete(false);
      setIsProcessing(false);
    }
    
    if (justClosed) {
      transactionSubmittedRef.current = false;
      setIsProcessing(false);
    }
    
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleConfirm = async () => {
    // Prevent duplicate submissions
    if (transactionSubmittedRef.current || isProcessing) {
      console.log('Blocking duplicate delegation submission');
      return;
    }
    
    transactionSubmittedRef.current = true;
    setIsProcessing(true);

    try {
      const storage = SecureStorageFactory.getInstance();
      const activeKey = await storage.getItem('steem_active_key');
      const ownerKey = await storage.getItem('steem_owner_key');
      
      let privateKeyString = activeKey || ownerKey;
      
      if (!privateKeyString) {
        toast({
          title: "Private Key Not Found",
          description: "Active or Owner key required for delegation operations",
          variant: "destructive",
        });
        transactionSubmittedRef.current = false;
        setIsProcessing(false);
        return;
      }

      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      
      await steemOperations.delegateVestingShares({
        delegator,
        delegatee,
        vesting_shares: vestingShares
      }, privateKey);
      
      setTransactionComplete(true);
      
      toast({
        title: "Delegation Successful",
        description: `Delegated ${amount} SP to @${delegatee}`,
      });
      
      // Short delay to show success state
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('Delegation error:', error);
      
      // Check if it's a duplicate transaction error
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      
      if (isDuplicate) {
        toast({
          title: "Transaction Already Processed",
          description: "This delegation was already submitted successfully.",
        });
        onSuccess();
        onClose();
        return;
      }
      
      let errorMessage = "Failed to delegate STEEM Power. Please try again.";
      
      if (error?.message?.includes('min_delegation')) {
        const match = error.message.match(/"amount":"(\d+)"/);
        if (match) {
          const minVests = parseInt(match[1]) / 1000000;
          errorMessage = `Minimum delegation required. Please increase your delegation amount.`;
        } else {
          errorMessage = "The delegation amount is below the minimum required. Please try at least 1 SP.";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Delegation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      transactionSubmittedRef.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-steemit-500/20">
              <Handshake className="w-5 h-5 text-steemit-400" />
            </div>
            Confirm Delegation
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Please review the delegation details below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Delegation Details Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
            {/* From */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">From</span>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-white font-medium">@{delegator}</span>
              </div>
            </div>
            
            {/* Arrow indicator */}
            <div className="flex justify-center">
              <div className="p-2 rounded-full bg-steemit-500/20">
                <Handshake className="w-5 h-5 text-steemit-400" />
              </div>
            </div>
            
            {/* To */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">To</span>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-white font-medium">@{delegatee}</span>
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-slate-700"></div>
            
            {/* Amount */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Amount</span>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-steemit-400" />
                <span className="text-steemit-400 font-bold text-lg">{amount} SP</span>
              </div>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-300 font-medium">Important</p>
              <p className="text-amber-200/80 mt-1">
                Delegated SP can be revoked anytime, but will take ~5 days to return to your account.
              </p>
            </div>
          </div>

          {/* Success Message */}
          {transactionComplete && (
            <div className="flex items-center justify-center gap-2 text-steemit-400 bg-steemit-500/10 border border-steemit-500/20 rounded-lg p-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Delegation Successful!</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || transactionComplete}
            className="flex-1 bg-gradient-to-r from-steemit-500 to-steemit-600 hover:from-steemit-600 hover:to-steemit-700 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : transactionComplete ? (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Done
              </>
            ) : (
              <>
                <Handshake className="w-4 h-4 mr-2" />
                Confirm Delegation
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DelegationConfirmDialog;
