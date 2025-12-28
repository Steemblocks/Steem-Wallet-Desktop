import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, TrendingUp, PiggyBank, ArrowDown, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SecureStorageFactory } from '@/services/secureStorage';
import TransferConfirmDialog from "./TransferConfirmDialog";
import { useQueryClient } from "@tanstack/react-query";

export type OperationType = 'transfer' | 'powerup' | 'powerdown' | 'savings' | 'withdraw_savings';

const TransferOperations = () => {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("STEEM");
  const [memo, setMemo] = useState("");
  const [operationType, setOperationType] = useState<OperationType>('transfer');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load login status from secure storage
  useEffect(() => {
    const loadLoginStatus = async () => {
      const storage = SecureStorageFactory.getInstance();
      const username = await storage.getItem('steem_username');
      setIsLoggedIn(!!username);
    };
    loadLoginStatus();
  }, []);

  const handleOperation = () => {
    // Check if user is logged in first
    if (!isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please login to perform blockchain operations. You can view wallet information without logging in.",
        variant: "destructive",
      });
      return;
    }

    if (!amount) {
      toast({
        title: "Amount Required",
        description: "Please enter an amount",
        variant: "destructive",
      });
      return;
    }

    if ((operationType === 'transfer' || operationType === 'powerup' || operationType === 'savings') && !recipient) {
      toast({
        title: "Recipient Required", 
        description: "Please enter a recipient username",
        variant: "destructive",
      });
      return;
    }

    setIsConfirmDialogOpen(true);
  };

  const handleSuccess = () => {
    setRecipient("");
    setAmount("");
    setMemo("");
    toast({
      title: "Operation Successful",
      description: `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} completed successfully`,
    });
    
    // Invalidate account history cache to show new transaction immediately
    // Small delay to allow blockchain to process the transaction
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['accountHistory'] });
      queryClient.invalidateQueries({ queryKey: ['steemAccount'] });
    }, 2000);
  };

  const getOperationTitle = () => {
    switch (operationType) {
      case 'transfer': return 'Transfer Assets';
      case 'powerup': return 'Power Up';
      case 'powerdown': return 'Power Down';
      case 'savings': return 'Transfer to Savings';
      case 'withdraw_savings': return 'Withdraw from Savings';
      default: return 'Transfer Assets';
    }
  };

  const getOperationDescription = () => {
    switch (operationType) {
      case 'transfer': return 'Send STEEM or SBD to other accounts instantly';
      case 'powerup': return 'Convert STEEM to STEEM Power for increased voting influence';
      case 'powerdown': return 'Start the 13-week power down process';
      case 'savings': return 'Move assets to savings with 3-day withdrawal period';
      case 'withdraw_savings': return 'Withdraw assets from savings (3-day delay)';
      default: return 'Send STEEM or SBD to other accounts instantly';
    }
  };

  const getIcon = () => {
    switch (operationType) {
      case 'transfer': return <ArrowRight className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      case 'powerup': return <TrendingUp className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      case 'powerdown': return <ArrowDown className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      case 'savings': 
      case 'withdraw_savings': return <PiggyBank className="w-5 h-5" style={{ color: '#07d7a9' }} />;
      default: return <ArrowRight className="w-5 h-5" style={{ color: '#07d7a9' }} />;
    }
  };

  const showRecipientField = operationType === 'transfer' || operationType === 'powerup' || operationType === 'savings';
  const showCurrencySelect = operationType === 'transfer' || operationType === 'savings' || operationType === 'withdraw_savings';

  return (
    <div className="space-y-6">
      {/* Modern Operation Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { type: 'transfer' as OperationType, icon: ArrowRight, label: 'Transfer', desc: 'Send Assets' },
          { type: 'powerup' as OperationType, icon: TrendingUp, label: 'Power Up', desc: 'Increase Voting' },
          { type: 'powerdown' as OperationType, icon: ArrowDown, label: 'Power Down', desc: '13-Week Process' },
          { type: 'savings' as OperationType, icon: PiggyBank, label: 'To Savings', desc: 'Secure Storage' },
          { type: 'withdraw_savings' as OperationType, icon: PiggyBank, label: 'From Savings', desc: '3-Day Wait' },
        ].map(({ type, icon: Icon, label, desc }) => (
          <button
            key={type}
            onClick={() => setOperationType(type)}
            className={`p-4 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
              operationType === type
                ? 'bg-gradient-to-br from-steemit-500 to-steemit-600 border-steemit-500 text-white shadow-lg'
                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-steemit-500'
            }`}
            disabled={!isLoggedIn}
          >
            <Icon className={`w-6 h-6 mx-auto mb-2 ${operationType === type ? 'text-white' : 'text-steemit-500'}`} />
            <p className={`font-semibold text-sm ${operationType === type ? 'text-white' : 'text-white'}`}>{label}</p>
            <p className={`text-xs mt-1 ${operationType === type ? 'text-steemit-100' : 'text-slate-400'}`}>{desc}</p>
          </button>
        ))}
      </div>

      {/* Login Notice */}
      {!isLoggedIn && (
        <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-900/50 flex gap-4">
          <div className="p-3 rounded-xl bg-blue-900/50 h-fit">
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-300 mb-1">Login Required</h3>
            <p className="text-sm text-blue-400">You need to log in to perform blockchain operations. View-only mode is available without authentication.</p>
          </div>
        </div>
      )}

      {/* Main Operation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-800/50 border border-slate-700 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-900/50 border-b border-slate-700 pb-4">
              <CardTitle className="text-white text-xl font-bold">{getOperationTitle()}</CardTitle>
              <CardDescription className="text-slate-400 mt-1">{getOperationDescription()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {showRecipientField && (
                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    {operationType === 'powerup' ? '👤 Power Up For (Optional)' : '👤 Recipient'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">@</span>
                    <Input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder={operationType === 'powerup' ? "Leave empty for yourself" : "username"}
                      className="pl-8 bg-slate-900/50 border-slate-700 rounded-xl focus:bg-slate-900 focus:border-steemit-500 focus:ring-2 focus:ring-steemit-500/20 transition-all h-11 text-white placeholder:text-slate-500"
                      disabled={!isLoggedIn}
                    />
                  </div>
                </div>
              )}

              <div className={showCurrencySelect ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-1'}>
                <div className={showCurrencySelect ? 'col-span-2' : ''}>
                  <label className="block text-sm font-semibold text-white mb-3">💰 Amount</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.000"
                      className="bg-slate-900/50 border-slate-700 rounded-xl focus:bg-slate-900 focus:border-steemit-500 focus:ring-2 focus:ring-steemit-500/20 transition-all h-11 text-white placeholder:text-slate-500"
                      disabled={!isLoggedIn}
                    />
                  </div>
                </div>

                {showCurrencySelect && (
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">💵 Currency</label>
                    <Select value={currency} onValueChange={setCurrency} disabled={!isLoggedIn}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 rounded-xl focus:bg-slate-900 focus:border-steemit-500 focus:ring-2 focus:ring-steemit-500/20 transition-all h-11 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
                        <SelectItem value="STEEM">STEEM</SelectItem>
                        <SelectItem value="SBD">SBD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {(operationType === 'transfer' || operationType === 'savings' || operationType === 'withdraw_savings') && (
                <div>
                  <label className="block text-sm font-semibold text-white mb-3">📝 Memo (Optional)</label>
                  <Textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Add a message or note..."
                    className="bg-slate-800 border-slate-700 rounded-xl focus:bg-slate-900 focus:border-steemit-500 focus:ring-2 focus:ring-steemit-500/20 transition-all resize-none text-white placeholder:text-slate-500"
                    rows={3}
                    disabled={!isLoggedIn}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Alerts */}
          {operationType === 'powerdown' && (
            <div className="p-5 rounded-2xl bg-amber-900/30 border-2 border-amber-700 space-y-3">
              <h4 className="font-bold text-amber-300 flex items-center gap-2">⚠️ Important Information</h4>
              <ul className="text-sm text-amber-200 space-y-2 ml-6">
                <li>• Takes 13 weeks (91 days) to complete</li>
                <li>• Receive 1/13 of your amount each week</li>
                <li>• Can cancel anytime during the process</li>
                <li>• Your voting power reduces immediately</li>
              </ul>
            </div>
          )}

          {(operationType === 'savings' || operationType === 'withdraw_savings') && (
            <div className="p-5 rounded-2xl bg-blue-900/30 border-2 border-blue-700 space-y-3">
              <h4 className="font-bold text-blue-300 flex items-center gap-2">💡 How Savings Work</h4>
              <ul className="text-sm text-blue-200 space-y-2 ml-6">
                <li>• 3-day withdrawal delay for security</li>
                <li>• Protected from unauthorized access</li>
                <li>• Earn interest on holdings</li>
                <li>• Perfect for long-term storage</li>
              </ul>
            </div>
          )}
        </div>

        {/* Right: Summary & Action */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            {/* Summary Card */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">Transaction Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {showRecipientField && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">To</span>
                    <span className="font-semibold text-white">@{recipient || (operationType === 'powerup' ? 'self' : 'N/A')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Amount</span>
                  <span className="font-bold text-lg text-steemit-500">{amount || '0.000'} {operationType === 'powerdown' ? 'SP' : currency}</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-400 text-sm">Fee</span>
                  <span className="font-bold text-steemit-500">FREE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Balance</span>
                  <span className="text-sm text-slate-300">{currency === 'STEEM' ? '1,250.000' : '425.750'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Action Button */}
            <Button
              onClick={handleOperation}
              disabled={!isLoggedIn || !amount || (showRecipientField && operationType !== 'powerup' && !recipient)}
              className="w-full h-12 rounded-xl font-bold text-white text-base transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isLoggedIn ? '#07d7a9' : '#9ca3af',
              }}
            >
              {!isLoggedIn ? (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Login Required
                </>
              ) : (
                <>
                  {getIcon()}
                  <span className="ml-2">{getOperationTitle()}</span>
                </>
              )}
            </Button>

            {/* Available Balance Card */}
            <Card className="bg-slate-800/50 border border-slate-700 rounded-2xl">
              <CardContent className="p-4">
                <p className="text-xs text-slate-400 mb-2">Available Balance</p>
                <p className="text-2xl font-bold text-white">
                  {currency === 'STEEM' ? '1,250.000' : '425.750'}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  ≈ ${((currency === 'STEEM' ? 1250 : 425.75) * (currency === 'STEEM' ? 0.076 : 0.559)).toFixed(2)} USD
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <TransferConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        recipient={recipient}
        amount={amount}
        currency={currency}
        memo={memo}
        operationType={operationType}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default TransferOperations;
