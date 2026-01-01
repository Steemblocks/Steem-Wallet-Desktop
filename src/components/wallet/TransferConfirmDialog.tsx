import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, PiggyBank, ArrowDown, Route, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
import { SecureStorageFactory } from '@/services/secureStorage';
import { OperationType } from './TransferPopup';

interface TransferConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: string;
  amount: string;
  currency: string;
  memo: string;
  operationType: OperationType;
  percent?: string;
  autoVest?: boolean;
  onSuccess: () => void;
}

const TransferConfirmDialog = ({ 
  isOpen, 
  onClose, 
  recipient, 
  amount, 
  currency, 
  memo, 
  operationType,
  percent = "",
  autoVest = false,
  onSuccess
}: TransferConfirmDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [transactionComplete, setTransactionComplete] = useState(false);
  const { toast } = useToast();
  
  // Ref to track if a transaction has been submitted for this dialog session
  const transactionSubmittedRef = useRef(false);
  // Unique transaction key to prevent duplicate submissions
  const transactionKeyRef = useRef<string>('');
  // Track previous open state to detect true open/close transitions
  const wasOpenRef = useRef(false);

  // Generate unique transaction key when dialog TRULY opens (from closed to open)
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const justClosed = !isOpen && wasOpenRef.current;
    
    if (justOpened) {
      // Dialog just opened - reset state for new transaction
      transactionKeyRef.current = `${operationType}-${recipient}-${amount}-${currency}-${Date.now()}`;
      transactionSubmittedRef.current = false;
      setTransactionComplete(false);
      setIsProcessing(false);
    }
    
    if (justClosed) {
      // Dialog just closed - reset for next time
      transactionSubmittedRef.current = false;
      setIsProcessing(false);
    }
    
    wasOpenRef.current = isOpen;
  }, [isOpen, operationType, recipient, amount, currency]);

  // Load credentials from secure storage
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        const method = await storage.getItem('steem_login_method');
        const key = await storage.getItem('steem_active_key');
        setUsername(user);
        setLoginMethod(method);
        setActiveKey(key);
      } catch (error) {
        console.error('Error loading credentials from storage:', error);
      }
    };
    loadCredentials();
  }, [isOpen]);

  const getOperationIcon = (type: OperationType) => {
    switch (type) {
      case 'transfer': return <ArrowRight className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      case 'powerup': return <TrendingUp className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      case 'powerdown': return <ArrowDown className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      case 'savings': 
      case 'withdraw_savings': return <PiggyBank className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      case 'withdraw_route': return <Route className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      default: return <ArrowRight className="w-5 h-5" style={{ color: '#07d7a9' }} />;
    }
  };

  const getOperationTitle = (type: OperationType) => {
    switch (type) {
      case 'transfer': return 'Transfer';
      case 'powerup': return 'Power Up';
      case 'powerdown': return 'Power Down';
      case 'savings': return 'Transfer to Savings';
      case 'withdraw_savings': return 'Withdraw from Savings';
      case 'withdraw_route': return 'Set Withdraw Route';
      default: return 'Operation';
    }
  };

  const handleConfirm = async () => {
    // Prevent duplicate submissions - check BOTH ref and state
    if (!username || transactionSubmittedRef.current || isProcessing) {
      console.log('Blocking duplicate submission:', { 
        hasUsername: !!username, 
        transactionSubmitted: transactionSubmittedRef.current, 
        isProcessing 
      });
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY before any async work
    transactionSubmittedRef.current = true;
    setIsProcessing(true);

    try {
      await handlePrivateKeyOperation();
    } catch (error) {
      console.error('Operation error:', error);
      toast({
        title: "Operation Failed",
        description: "Transaction failed. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
      // DO NOT reset transactionSubmittedRef here - the transaction may have been submitted
      // User must close and reopen dialog to retry
    }
  };

  const handlePrivateKeyOperation = async () => {
    const privateKeyString = activeKey;
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Active key required for this operation",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      
      // Format amount with exactly 3 decimal places
      const formattedAmount = parseFloat(amount).toFixed(3);

      switch (operationType) {
        case 'transfer':
          const transferOp = {
            from: username!,
            to: recipient,
            amount: `${formattedAmount} ${currency}`,
            memo: memo
          };
          console.log('Executing transfer:', transferOp);
          await steemOperations.transfer(transferOp, privateKey);
          break;

        case 'powerup':
          const powerUpOp = {
            from: username!,
            to: recipient || username!,
            amount: `${formattedAmount} ${currency}`
          };
          console.log('Executing power up:', powerUpOp);
          await steemOperations.powerUp(powerUpOp, privateKey);
          break;

        case 'powerdown':
          const vestsAmount = await steemOperations.convertSteemToVests(`${formattedAmount} STEEM`);
          console.log('Executing power down with vests:', vestsAmount);
          await steemOperations.powerDown(username!, vestsAmount, privateKey);
          break;

        case 'savings':
          const savingsOp = {
            from: username!,
            to: recipient,
            amount: `${formattedAmount} ${currency}`,
            memo: memo
          };
          console.log('Executing transfer to savings:', savingsOp);
          await steemOperations.transferToSavings(savingsOp, privateKey);
          break;

        case 'withdraw_savings':
          const withdrawOp = {
            from: username!,
            to: username!,
            amount: `${formattedAmount} ${currency}`,
            memo: memo,
            request_id: Date.now()
          };
          console.log('Executing withdraw from savings:', withdrawOp);
          await steemOperations.transferFromSavings(withdrawOp, privateKey);
          break;

        case 'withdraw_route':
          const withdrawRouteOp = {
            from_account: username!,
            to_account: recipient,
            percent: Math.round(parseFloat(percent) * 100), // Convert percentage to basis points
            auto_vest: autoVest
          };
          console.log('Executing set withdraw route:', withdrawRouteOp);
          await steemOperations.setWithdrawVestingRoute(withdrawRouteOp, privateKey);
          break;
      }
      
      toast({
        title: "Transaction Confirmed",
        description: `Your ${getOperationTitle(operationType)} transaction was successful!`,
        variant: "success",
      });
      
      // Mark transaction as complete before closing
      setTransactionComplete(true);
      
      // Close dialog first, then trigger success callback
      onClose();
      onSuccess();
      
    } catch (error: any) {
      console.error('Private key operation error:', error);
      
      let errorMessage = "Operation failed";
      let isDuplicateError = false;
      let isRetryableError = false;
      
      if (error.jse_shortmsg) {
        // Handle duplicate transaction error - this means transaction was ALREADY SUCCESSFUL
        if (error.jse_shortmsg.includes('duplicate')) {
          isDuplicateError = true;
          errorMessage = "This transaction was already submitted successfully. Check your transaction history.";
        } else if (error.jse_shortmsg.includes('get_savings_balance')) {
          // Insufficient savings balance - user can retry with different amount
          isRetryableError = true;
          errorMessage = "Insufficient savings balance. Please check your savings balance and try again.";
        } else if (error.jse_shortmsg.includes('get_balance')) {
          // Insufficient balance - user can retry with different amount  
          isRetryableError = true;
          errorMessage = "Insufficient balance. Please check your balance and try again.";
        } else {
          errorMessage = error.jse_shortmsg;
        }
      } else if (error.message) {
        if (error.message.includes('duplicate')) {
          isDuplicateError = true;
          errorMessage = "This transaction was already submitted successfully. Check your transaction history.";
        } else if (error.message.includes('get_savings_balance')) {
          isRetryableError = true;
          errorMessage = "Insufficient savings balance. Please check your savings balance and try again.";
        } else if (error.message.includes('get_balance')) {
          isRetryableError = true;
          errorMessage = "Insufficient balance. Please check your balance and try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      // If it's a duplicate error, the transaction actually succeeded
      // So we should treat it as success and close the dialog
      if (isDuplicateError) {
        toast({
          title: "Transaction Already Processed",
          description: errorMessage,
          variant: "success",
        });
        setTransactionComplete(true);
        onClose();
        onSuccess();
      } else {
        toast({
          title: "Operation Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setIsProcessing(false);
        // For retryable errors (like insufficient balance), allow user to close and fix the issue
        // For non-retryable errors, keep the ref to prevent accidental retries
        if (isRetryableError) {
          transactionSubmittedRef.current = false;
        }
      }
    }
  };

  // Handle dialog close - prevent closing while processing
  const handleOpenChange = (open: boolean) => {
    // Don't allow closing if we're processing or if transaction was submitted
    if (!open && (isProcessing || transactionSubmittedRef.current)) {
      console.log('Preventing dialog close during transaction');
      return;
    }
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 max-w-md border border-slate-700" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: '#07d7a9' }}>
            {getOperationIcon(operationType)}
            Confirm {getOperationTitle(operationType)}
          </DialogTitle>
          <DialogDescription>
            Please review the details below before confirming
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Operation:</span>
                <span className="font-medium text-white">{getOperationTitle(operationType)}</span>
              </div>
              
              {operationType !== 'withdraw_route' && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="font-medium text-white">
                    {amount} {operationType === 'powerdown' ? 'SP' : currency}
                  </span>
                </div>
              )}

              {operationType === 'withdraw_route' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Percentage:</span>
                    <span className="font-medium text-white">{percent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Auto Vest:</span>
                    <span className="font-medium text-white">{autoVest ? 'Yes' : 'No'}</span>
                  </div>
                </>
              )}
              
              {recipient && (
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {operationType === 'powerup' ? 'Power Up To:' : 
                     operationType === 'withdraw_route' ? 'Route To:' : 'To:'}
                  </span>
                  <span className="font-medium text-white">@{recipient}</span>
                </div>
              )}
              
              {memo && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Memo:</span>
                  <span className="font-medium text-white break-all">{memo}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            className="flex-1 text-white"
            style={{ backgroundColor: '#07d7a9' }}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferConfirmDialog;
