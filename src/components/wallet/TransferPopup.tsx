
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, TrendingUp, PiggyBank, ArrowDown, Route, Trash2, Loader2 } from "lucide-react";
import { useSteemAccount, formatWalletData, WalletData } from "@/hooks/useSteemAccount";
import TransferConfirmDialog from "./TransferConfirmDialog";
import { useQueryClient } from "@tanstack/react-query";
import { steemApi } from "@/services/steemApi";
import { steemOperations } from "@/services/steemOperations";
import { getSteemPerMvests, vestsToSteem } from "@/utils/utility";
import { useToast } from "@/hooks/use-toast";
import { SecureStorageFactory } from "@/services/secureStorage";
import { useWalletData } from "@/contexts/WalletDataContext";
import * as dsteem from 'dsteem';

export type OperationType = 'transfer' | 'powerup' | 'powerdown' | 'savings' | 'withdraw_savings' | 'withdraw_route';

interface TransferPopupProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  defaultOperation?: OperationType;
  defaultCurrency?: 'STEEM' | 'SBD';
}

const TransferPopup = ({ isOpen, onClose, username, defaultOperation = 'transfer', defaultCurrency }: TransferPopupProps) => {
  const [operationType, setOperationType] = useState<OperationType>(defaultOperation);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("STEEM");
  const [memo, setMemo] = useState("");
  const [percent, setPercent] = useState("");
  const [autoVest, setAutoVest] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [expiringDelegationsSP, setExpiringDelegationsSP] = useState<number>(0);
  const [currentRoutes, setCurrentRoutes] = useState<any[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [isRemovingRoute, setIsRemovingRoute] = useState<string | null>(null);

  const { data: account } = useSteemAccount(username);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { refreshAll } = useWalletData();

  // Load wallet data and expiring delegations when account changes
  useEffect(() => {
    const loadWalletData = async () => {
      if (account) {
        const data = await formatWalletData(account);
        setWalletData(data);
        
        // Fetch expiring delegations (cancelled delegations in cooldown period)
        try {
          const expiringDelegations = await steemApi.getExpiringVestingDelegations(account.name);
          if (expiringDelegations && expiringDelegations.length > 0) {
            const steemPerMvests = await getSteemPerMvests();
            // Sum up all expiring delegations in VESTS and convert to SP
            const totalExpiringVests = expiringDelegations.reduce((sum, delegation) => {
              const vests = parseFloat(delegation.vesting_shares?.split(' ')[0] || '0');
              return sum + vests;
            }, 0);
            const expiringSP = vestsToSteem(totalExpiringVests, steemPerMvests);
            setExpiringDelegationsSP(expiringSP);
          } else {
            setExpiringDelegationsSP(0);
          }
        } catch (error) {
          console.error('Error fetching expiring delegations:', error);
          setExpiringDelegationsSP(0);
        }
      }
    };
    loadWalletData();
  }, [account]);

  // Load withdraw routes when viewing withdraw_route operation
  const loadWithdrawRoutes = async () => {
    if (!username) return;
    setIsLoadingRoutes(true);
    try {
      const routes = await steemApi.getWithdrawVestingRoutes(username);
      setCurrentRoutes(routes || []);
    } catch (error) {
      console.error('Error loading withdraw routes:', error);
      setCurrentRoutes([]);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  // Remove a withdraw route
  const handleRemoveRoute = async (toAccount: string) => {
    if (isRemovingRoute) return;
    setIsRemovingRoute(toAccount);

    try {
      const storage = SecureStorageFactory.getInstance();
      const activeKey = await storage.getItem('steem_active_key');
      
      if (!activeKey) {
        toast({
          title: "Active Key Required",
          description: "Please login with your active key to remove routes.",
          variant: "destructive",
        });
        setIsRemovingRoute(null);
        return;
      }

      const privateKey = dsteem.PrivateKey.fromString(activeKey);
      await steemOperations.setWithdrawVestingRoute({
        from_account: username,
        to_account: toAccount,
        percent: 0,
        auto_vest: false
      }, privateKey);

      toast({
        title: "Route Removed",
        description: `Withdraw route to @${toAccount} has been removed.`,
        variant: "success",
      });

      // Reload routes after removal
      setTimeout(() => loadWithdrawRoutes(), 1500);
    } catch (error: any) {
      const isDuplicate = error?.message?.includes('duplicate');
      if (isDuplicate) {
        toast({ title: "Route Already Removed", description: "This route was already removed.", variant: "success" });
        setTimeout(() => loadWithdrawRoutes(), 1500);
      } else {
        toast({
          title: "Failed to Remove Route",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRemovingRoute(null);
    }
  };

  // Reset form when popup opens/closes
  useEffect(() => {
    if (isOpen) {
      setOperationType(defaultOperation);
      // Set currency based on defaultCurrency prop (for savings operations)
      if (defaultCurrency) {
        setCurrency(defaultCurrency);
      } else {
        setCurrency("STEEM");
      }
      // Load withdraw routes if opening with withdraw_route operation
      if (defaultOperation === 'powerdown') {
        loadWithdrawRoutes();
      }
    }
    if (!isOpen) {
      setRecipient("");
      setAmount("");
      setCurrency(defaultCurrency || "STEEM");
      setMemo("");
      setPercent("");
      setAutoVest(false);
      setCurrentRoutes([]);
    }
  }, [isOpen, defaultOperation, defaultCurrency]);

  // Check if currency should be locked (only for transfer to savings with a default currency, not withdraw)
  const isCurrencyLocked = defaultOperation === 'savings' && !!defaultCurrency;

  const handleConfirm = () => {
    setShowConfirm(true);
  };

  const handleSuccess = () => {
    setShowConfirm(false);
    onClose();
    
    // Refresh all wallet data to show updated balances immediately
    // Small delay to allow blockchain to process the transaction
    setTimeout(async () => {
      // Invalidate React Query caches
      queryClient.invalidateQueries({ queryKey: ['accountHistory'] });
      queryClient.invalidateQueries({ queryKey: ['steemAccount'] });
      // Also refresh the WalletDataContext to update balance cards
      await refreshAll();
    }, 2000);
  };

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
      default: return 'Transfer';
    }
  };

  // Get available operations based on the default operation (which button was clicked)
  const getAvailableOperations = (): OperationType[] => {
    switch (defaultOperation) {
      case 'powerdown':
        return ['powerdown', 'withdraw_route']; // Power Down button shows power down and withdraw route
      case 'withdraw_savings':
        return ['withdraw_savings']; // Withdraw Savings button shows only withdraw from savings
      case 'savings':
        return ['savings']; // Savings button shows only transfer to savings
      case 'powerup':
        return ['powerup']; // Power Up button shows only power up
      case 'transfer':
        return ['transfer']; // Transfer/Send button shows only transfer
      default:
        return ['transfer']; // Default to transfer only
    }
  };

  const availableOperations = getAvailableOperations();

  const getOperationDescription = (type: OperationType) => {
    switch (type) {
      case 'transfer': return 'Send STEEM or SBD to another account';
      case 'powerup': return 'Convert STEEM to STEEM Power (SP)';
      case 'powerdown': return 'Convert STEEM Power to STEEM over 4 weeks';
      case 'savings': return 'Move funds to savings account';
      case 'withdraw_savings': return 'Move funds from savings to balance';
      case 'withdraw_route': return 'Route future power down payments to another account';
      default: return '';
    }
  };

  const getCurrencyOptions = (type: OperationType) => {
    switch (type) {
      case 'powerup':
      case 'powerdown':
        return ['STEEM'];
      case 'transfer':
      case 'savings':
        return ['STEEM', 'SBD'];
      case 'withdraw_savings':
        return ['STEEM', 'SBD'];
      case 'withdraw_route':
        return ['STEEM'];
      default:
        return ['STEEM', 'SBD'];
    }
  };

  // Get the relevant balance based on operation type and currency
  const getRelevantBalance = (): string => {
    if (!walletData) return '0.000';
    
    switch (operationType) {
      case 'transfer':
      case 'powerup':
        // For transfer and power up, use main balance
        return currency === 'STEEM' ? walletData.steem : walletData.sbd;
      case 'powerdown':
        // For power down: SP - delegated SP - expiring delegations
        // Note: We subtract:
        // 1. delegated SP (outgoing delegations) - you cannot power down SP delegated to others
        // 2. expiring delegations (cancelled delegations in ~5 day cooldown period)
        //    - These are VESTS that will return to your account but are currently locked
        //    - They cannot be used for power down until the cooldown period ends
        // We do NOT subtract:
        // - Received SP (incoming delegations) - not included in walletData.steemPower
        // - Active power down amount - starting a new power down replaces any existing one
        const totalSP = parseFloat(walletData.steemPower);
        const delegatedSP = parseFloat(walletData.delegated);
        const availableSP = Math.max(0, totalSP - delegatedSP - expiringDelegationsSP);
        return availableSP.toFixed(3);
      case 'savings':
        // For transfer to savings, use main balance
        return currency === 'STEEM' ? walletData.steem : walletData.sbd;
      case 'withdraw_savings':
        // For withdraw from savings, use savings balance
        return currency === 'STEEM' ? walletData.savings.steem : walletData.savings.sbd;
      default:
        return currency === 'STEEM' ? walletData.steem : walletData.sbd;
    }
  };

  // Get the balance label based on operation type
  const getBalanceLabel = (): string => {
    switch (operationType) {
      case 'powerdown':
        return 'Available SP';
      case 'withdraw_savings':
        return `Savings ${currency}`;
      default:
        return currency;
    }
  };

  const showRecipientField = () => {
    return operationType === 'transfer' || operationType === 'powerup' || operationType === 'savings' || operationType === 'withdraw_route';
  };

  const showAmountField = () => {
    return operationType !== 'withdraw_route';
  };

  const showPercentField = () => {
    return operationType === 'withdraw_route';
  };

  const showMemoField = () => {
    return operationType === 'transfer' || operationType === 'savings' || operationType === 'withdraw_savings';
  };

  const showAutoVestField = () => {
    return operationType === 'withdraw_route';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md max-h-[90vh] overflow-y-auto" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="text-white">Transfer Assets</DialogTitle>
            <DialogDescription className="text-slate-400">
              Choose an operation and enter the details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Operation Type Selection - Only show if multiple options available */}
            {availableOperations.length > 1 && (
              <div className="space-y-2">
                <Label className="text-slate-300">Operation Type</Label>
                <Select 
                  value={operationType} 
                  onValueChange={(value: OperationType) => {
                    setOperationType(value);
                    // Reset currency when changing operation
                    const currencies = getCurrencyOptions(value);
                    if (!currencies.includes(currency)) {
                      setCurrency(currencies[0]);
                    }
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {getOperationIcon(operationType)}
                        <span>{getOperationTitle(operationType)}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border border-slate-700">
                    {availableOperations.includes('transfer') && (
                      <SelectItem value="transfer">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4" style={{ color: '#07d7a9' }} />
                          <span>Transfer</span>
                        </div>
                      </SelectItem>
                    )}
                    {availableOperations.includes('powerup') && (
                      <SelectItem value="powerup">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" style={{ color: '#07d7a9' }} />
                          <span>Power Up</span>
                        </div>
                      </SelectItem>
                    )}
                    {availableOperations.includes('powerdown') && (
                      <SelectItem value="powerdown">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="w-4 h-4" style={{ color: '#07d7a9' }} />
                          <span>Power Down</span>
                        </div>
                      </SelectItem>
                    )}
                    {availableOperations.includes('savings') && (
                      <SelectItem value="savings">
                        <div className="flex items-center gap-2">
                          <PiggyBank className="w-4 h-4" style={{ color: '#07d7a9' }} />
                          <span>Transfer to Savings</span>
                        </div>
                      </SelectItem>
                    )}
                    {availableOperations.includes('withdraw_savings') && (
                      <SelectItem value="withdraw_savings">
                        <div className="flex items-center gap-2">
                          <PiggyBank className="w-4 h-4" style={{ color: '#07d7a9' }} />
                          <span>Withdraw from Savings</span>
                        </div>
                      </SelectItem>
                    )}
                    {availableOperations.includes('withdraw_route') && (
                      <SelectItem value="withdraw_route">
                        <div className="flex items-center gap-2">
                          <Route className="w-4 h-4" style={{ color: '#07d7a9' }} />
                          <span>Set Withdraw Route</span>
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-400">{getOperationDescription(operationType)}</p>
              </div>
            )}

            {/* Show operation title when only one option */}
            {availableOperations.length === 1 && (
              <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                {getOperationIcon(operationType)}
                <div>
                  <p className="font-medium text-white">{getOperationTitle(operationType)}</p>
                  <p className="text-sm text-slate-400">{getOperationDescription(operationType)}</p>
                </div>
              </div>
            )}

            {/* Recipient Field */}
            {showRecipientField() && (
              <div className="space-y-2">
                <Label htmlFor="recipient" className="text-slate-300">
                  {operationType === 'powerup' ? 'Power Up To (optional)' : 
                   operationType === 'withdraw_route' ? 'Route To Account' : 'Recipient'}
                </Label>
                <Input
                  id="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={
                    operationType === 'powerup' ? "username (leave empty to power up to yourself)" : 
                    operationType === 'withdraw_route' ? "Account to receive power down payments" : "username"
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            )}

            {/* Amount and Currency */}
            {showAmountField() && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-slate-300">
                    Amount {operationType === 'powerdown' ? '(SP)' : ''}
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.000"
                    step="0.001"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  {/* Balance Display */}
                  <button
                    type="button"
                    onClick={() => setAmount(getRelevantBalance())}
                    className="text-xs text-steemit-500 hover:text-steemit-400 hover:underline cursor-pointer transition-colors"
                  >
                    Balance: {getRelevantBalance()} {getBalanceLabel()}
                  </button>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={isCurrencyLocked}>
                    <SelectTrigger className={`bg-slate-800 border-slate-700 text-white ${isCurrencyLocked ? 'opacity-70' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border border-slate-700">
                      {getCurrencyOptions(operationType).map((curr) => (
                        <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Percent Field for Withdraw Route */}
            {showPercentField() && (
              <div className="space-y-2">
                <Label htmlFor="percent" className="text-slate-300">Percentage (0-100%)</Label>
                <Input
                  id="percent"
                  type="number"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="100"
                  min="0"
                  max="100"
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-400">Percentage of power down payments to route to the specified account</p>
              </div>
            )}

            {/* Auto Vest Toggle for Withdraw Route */}
            {showAutoVestField() && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoVest"
                    checked={autoVest}
                    onChange={(e) => setAutoVest(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800"
                  />
                  <Label htmlFor="autoVest" className="text-slate-300">Auto Vest</Label>
                </div>
                <p className="text-xs text-slate-400">
                  When enabled, funds will be automatically converted to STEEM Power in the recipient account
                </p>
              </div>
            )}

            {/* Memo Field */}
            {showMemoField() && (
              <div className="space-y-2">
                <Label htmlFor="memo" className="text-slate-300">Memo (optional)</Label>
                <Textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Enter memo..."
                  className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                />
              </div>
            )}

            {/* Power Down Information */}
            {operationType === 'powerdown' && (
              <div className="p-4 rounded-lg bg-blue-900/30 border border-blue-800">
                <h4 className="font-medium text-blue-300 mb-2">⚠️ Power Down Information:</h4>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• Power down takes 4 weeks to complete</li>
                  <li>• You'll receive 1/4 of the amount each week</li>
                  <li>• You can cancel power down anytime</li>
                  <li>• Reduces your voting influence immediately</li>
                </ul>
              </div>
            )}

            {/* Current Withdraw Routes */}
            {operationType === 'withdraw_route' && (
              <div className="space-y-3">
                <Label className="text-slate-300">Current Withdraw Routes</Label>
                {isLoadingRoutes ? (
                  <div className="flex items-center justify-center p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <Loader2 className="w-4 h-4 animate-spin mr-2 text-slate-400" />
                    <span className="text-slate-400 text-sm">Loading routes...</span>
                  </div>
                ) : currentRoutes.length > 0 ? (
                  <div className="space-y-2">
                    {currentRoutes.map((route, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">@{route.to_account}</span>
                          <span className="text-slate-400 text-sm">({(route.percent / 100).toFixed(1)}%)</span>
                          {route.auto_vest && (
                            <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">Auto Vest</span>
                          )}
                        </div>
                        <Button
                          onClick={() => handleRemoveRoute(route.to_account)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-900/30 hover:text-red-300 h-8 w-8 p-0"
                          disabled={isRemovingRoute === route.to_account}
                        >
                          {isRemovingRoute === route.to_account ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-3 bg-slate-800/30 rounded-lg border border-slate-700/50">No active withdraw routes</p>
                )}
              </div>
            )}

            {/* Withdraw Route Information */}
            {operationType === 'withdraw_route' && (
              <div className="p-4 rounded-lg bg-yellow-900/30 border border-yellow-800">
                <h4 className="font-medium text-yellow-300 mb-2">ℹ️ Withdraw Route Information:</h4>
                <ul className="text-sm text-yellow-200 space-y-1">
                  <li>• This only sets up routing rules for future power downs</li>
                  <li>• You must still initiate power down separately</li>
                  <li>• 100% routes all future power down payments</li>
                  <li>• Auto-vest converts payments directly to STEEM Power</li>
                  <li>• Set percentage to 0% to remove an existing route</li>
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                className="flex-1 text-white"
                style={{ backgroundColor: '#07d7a9' }}
                disabled={
                  (showAmountField() && !amount) || 
                  (showRecipientField() && operationType !== 'powerup' && !recipient) ||
                  (showPercentField() && !percent)
                }
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TransferConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        recipient={recipient}
        amount={amount}
        currency={currency}
        memo={memo}
        operationType={operationType}
        percent={percent}
        autoVest={autoVest}
        onSuccess={handleSuccess}
      />
    </>
  );
};

export default TransferPopup;
