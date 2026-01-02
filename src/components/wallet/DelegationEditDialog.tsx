
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { steemOperations } from '@/services/steemOperations';
import * as dsteem from 'dsteem';
import { FormattedDelegation } from '@/hooks/useDelegations';
import { SecureStorageFactory } from '@/services/secureStorage';
import { getDecryptedKey } from '@/hooks/useSecureKeys';

interface DelegationEditDialogProps {
  delegation: FormattedDelegation;
  onSuccess: () => void;
  steemPerMvests: number;
}

const DelegationEditDialog = ({ delegation, onSuccess, steemPerMvests }: DelegationEditDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newAmount, setNewAmount] = useState(delegation.steemPower);
  const [isProcessing, setIsProcessing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Ref to track if a transaction has been submitted for this dialog session
  const transactionSubmittedRef = useRef(false);
  
  // Reset state when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      transactionSubmittedRef.current = false;
      setIsProcessing(false);
      setNewAmount(delegation.steemPower);
    }
  }, [isOpen, delegation.steemPower]);

  // Load credentials from secure storage
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        setUsername(user);
      } catch (error) {
        console.error('Error loading credentials from storage:', error);
      }
    };
    loadCredentials();
  }, []);

  const handleEditDelegation = async () => {
    if (!username) {
      toast({
        title: "Authentication Required",
        description: "Please log in to edit delegations",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent duplicate submissions - CRITICAL: check ref first
    if (transactionSubmittedRef.current || isProcessing) {
      console.log('Blocking duplicate delegation edit submission');
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY before any async work
    transactionSubmittedRef.current = true;
    setIsProcessing(true);

    try {
      // Convert SP to VESTS
      const steemAmount = parseFloat(newAmount);
      const vestsAmount = (steemAmount * 1000000) / steemPerMvests;
      const vestingShares = `${vestsAmount.toFixed(6)} VESTS`;

      await handlePrivateKeyDelegation(username, delegation.delegatee, vestingShares);
    } catch (error: any) {
      console.error('Edit delegation error:', error);
      
      // Check if it's a duplicate transaction error (means it actually succeeded)
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      
      if (isDuplicate) {
        toast({
          title: "Transaction Already Processed",
          description: "This delegation update was already submitted successfully.",
          variant: "success",
        });
        setIsOpen(false);
        onSuccess();
        return;
      }
      
      // Parse minimum delegation error
      let errorMessage = "Failed to update delegation. Please try again.";
      
      if (error?.message?.includes('min_delegation')) {
        const match = error.message.match(/"amount":"(\d+)"/);
        if (match) {
          const minVests = parseInt(match[1]) / 1000000;
          const minSP = (minVests * steemPerMvests) / 1000000;
          errorMessage = `Minimum delegation required: ${minSP.toFixed(3)} SP. Please increase your delegation amount or remove it completely.`;
        } else {
          errorMessage = "The delegation amount is below the minimum required. Please try a larger amount or remove the delegation.";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Operation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsProcessing(false);
      // DO NOT reset transactionSubmittedRef - user must close and reopen dialog to retry
    }
  };

  const handlePrivateKeyDelegation = async (delegator: string, delegatee: string, vestingShares: string) => {
    // Get decrypted keys from secure storage
    const activeKey = await getDecryptedKey(delegator, 'active');
    const ownerKey = await getDecryptedKey(delegator, 'owner');
    
    let privateKeyString = activeKey || ownerKey;
    
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Active or Owner key required for delegation operations",
        variant: "destructive",
      });
      return;
    }

    const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
    
    await steemOperations.delegateVestingShares({
      delegator,
      delegatee,
      vesting_shares: vestingShares
    }, privateKey);
    
    toast({
      title: "Delegation Updated",
      description: `Successfully updated delegation to @${delegatee}`,
      variant: "success",
    });
    setIsOpen(false);
    onSuccess();
  };

  const handleRemoveDelegation = async () => {
    if (!username) return;
    
    // Prevent duplicate submissions - CRITICAL: check ref first
    if (transactionSubmittedRef.current || isProcessing) {
      console.log('Blocking duplicate delegation remove submission');
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    transactionSubmittedRef.current = true;
    setIsProcessing(true);

    try {
      await handlePrivateKeyDelegation(username, delegation.delegatee, "0.000000 VESTS");
    } catch (error: any) {
      console.error('Remove delegation error:', error);
      
      // Check if it's a duplicate transaction error
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      
      if (isDuplicate) {
        toast({
          title: "Transaction Already Processed",
          description: "This delegation removal was already submitted successfully.",
          variant: "success",
        });
        setIsOpen(false);
        onSuccess();
        return;
      }
      
      toast({
        title: "Operation Failed",
        description: "Failed to remove delegation. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
      // DO NOT reset transactionSubmittedRef
    }
  };

  // Handle dialog close - prevent closing while processing
  const handleOpenChange = (open: boolean) => {
    if (!open && (isProcessing || transactionSubmittedRef.current)) {
      console.log('Preventing dialog close during transaction');
      return;
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs sm:text-sm px-2 sm:px-4">
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Delegation to @{delegation.delegatee}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Update or remove your delegation. Changes take effect immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-slate-300">New Amount (SP)</Label>
            <Input
              id="amount"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0.000"
              type="number"
              step="0.001"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="text-sm text-slate-400">
            Current delegation: {delegation.steemPower} SP
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleEditDelegation}
            disabled={isProcessing || !newAmount || parseFloat(newAmount) < 0}
            className="flex-1 bg-steemit-500 hover:bg-steemit-600 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Delegation'
            )}
          </Button>
          <Button
            onClick={handleRemoveDelegation}
            disabled={isProcessing}
            variant="destructive"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Remove'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DelegationEditDialog;
