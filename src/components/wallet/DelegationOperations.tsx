
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Users, TrendingUp, Loader2, Zap, Send, CheckCircle2, AlertCircle, Handshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDelegations } from "@/hooks/useDelegations";
import { useSteemAccount, formatWalletData } from "@/hooks/useSteemAccount";
import { steemApi } from "@/services/steemApi";
import { SecureStorageFactory } from '@/services/secureStorage';
import DelegationEditDialog from "./DelegationEditDialog";
import DelegationConfirmDialog from "./DelegationConfirmDialog";
import { getSteemPerMvests, vestsToSteem } from "@/utils/utility";

const DelegationOperations = () => {
  const { username: urlUsername } = useParams();
  const [delegateAmount, setDelegateAmount] = useState("");
  const [delegateRecipient, setDelegateRecipient] = useState("");
  const [displayUsername, setDisplayUsername] = useState<string | null>(null);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [availableSP, setAvailableSP] = useState<number>(0);
  const [expiringDelegationsSP, setExpiringDelegationsSP] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingVestingShares, setPendingVestingShares] = useState("");
  const { toast } = useToast();

  // Load usernames from secure storage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        setLoggedInUsername(user);
        setDisplayUsername(urlUsername?.replace('@', '') || user);
      } catch (error) {
        console.error('Error loading user data from storage:', error);
      }
    };
    loadUserData();
  }, [urlUsername]);

  const isOwnAccount = loggedInUsername && displayUsername === loggedInUsername;

  const {
    outgoingDelegations,
    isLoading,
    error,
    totalDelegatedOut,
    steemPerMvests,
    refetchAll
  } = useDelegations(displayUsername);

  // Get account data for received delegations
  const { data: accountData, isLoading: accountLoading } = useSteemAccount(displayUsername);

  // Calculate available SP for new delegation when account data changes
  useEffect(() => {
    const calculateAvailableSP = async () => {
      if (!accountData || !loggedInUsername) return;
      
      try {
        // Get wallet data for SP and delegated amounts
        const walletData = await formatWalletData(accountData);
        const totalSP = parseFloat(walletData.steemPower);
        const delegatedSP = parseFloat(walletData.delegated);
        
        // Fetch expiring delegations (cancelled delegations in cooldown period)
        let expiringSP = 0;
        try {
          const expiringDelegations = await steemApi.getExpiringVestingDelegations(accountData.name);
          if (expiringDelegations && expiringDelegations.length > 0) {
            const steemPerMvestsValue = await getSteemPerMvests();
            // Sum up all expiring delegations in VESTS and convert to SP
            const totalExpiringVests = expiringDelegations.reduce((sum, delegation) => {
              const vests = parseFloat(delegation.vesting_shares?.split(' ')[0] || '0');
              return sum + vests;
            }, 0);
            expiringSP = vestsToSteem(totalExpiringVests, steemPerMvestsValue);
          }
        } catch (error) {
          console.error('Error fetching expiring delegations:', error);
        }
        
        setExpiringDelegationsSP(expiringSP);
        // Available SP = Total SP - Delegated SP - Expiring Delegations SP
        const available = Math.max(0, totalSP - delegatedSP - expiringSP);
        setAvailableSP(available);
      } catch (error) {
        console.error('Error calculating available SP:', error);
        setAvailableSP(0);
      }
    };
    
    calculateAvailableSP();
  }, [accountData, loggedInUsername]);

  const handleDelegate = () => {
    if (!delegateRecipient || !delegateAmount || !loggedInUsername || !isOwnAccount) return;
    
    // Convert SP to VESTS for the confirmation dialog
    const steemAmount = parseFloat(delegateAmount);
    const vestsAmount = (steemAmount * 1000000) / steemPerMvests;
    const vestingShares = `${vestsAmount.toFixed(6)} VESTS`;
    
    setPendingVestingShares(vestingShares);
    setShowConfirmDialog(true);
  };

  const handleDelegationSuccess = () => {
    setDelegateRecipient("");
    setDelegateAmount("");
    setPendingVestingShares("");
    refetchAll();
  };

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-900/50 to-red-950/50 border border-red-800 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-300 mb-1">Error Loading Delegation Data</h3>
              <p className="text-red-400 text-sm">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-steemit-500" />
          <h2 className="text-2xl font-bold text-white">Delegation Manager</h2>
        </div>
        <p className="text-slate-400 text-sm">Manage your STEEM Power delegations and help the community grow</p>
      </div>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-800/50 shadow-sm border border-slate-700 rounded-lg p-1">
          <TabsTrigger 
            value="overview" 
            className="h-full data-[state=active]:text-white data-[state=active]:bg-steemit-500 data-[state=inactive]:text-slate-300 text-xs sm:text-sm font-medium rounded-md"
          >
            <TrendingUp className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger 
            value="outgoing" 
            className="h-full data-[state=active]:text-white data-[state=active]:bg-steemit-500 data-[state=inactive]:text-slate-300 text-xs sm:text-sm font-medium rounded-md"
          >
            <ArrowRight className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Outgoing</span>
            <span className="sm:hidden">Out</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                  Total Delegated Out
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-slate-700 rounded mb-2"></div>
                    <div className="h-4 bg-slate-700 rounded"></div>
                  </div>
                ) : (
                  <>
                    <p className="text-xl sm:text-2xl font-bold text-amber-400">
                      {totalDelegatedOut.toFixed(3)} SP
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">To {outgoingDelegations.length} accounts</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4 text-steemit-500" />
                  Total Received
                </CardTitle>
              </CardHeader>
              <CardContent>
                {accountLoading || isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-slate-700 rounded mb-2"></div>
                    <div className="h-4 bg-slate-700 rounded"></div>
                  </div>
                ) : (
                  <>
                    <p className="text-xl sm:text-2xl font-bold" style={{ color: '#07d7a9' }}>
                      {accountData && steemPerMvests > 0 
                        ? ((steemApi.parseAmount(accountData.received_vesting_shares) / 1000000) * steemPerMvests).toFixed(3)
                        : '0.000'} SP
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">Delegated to you by others</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Only show delegation form for logged-in users on their own account */}
          {isOwnAccount && (
            <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 shadow-lg overflow-hidden relative">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-steemit-500/10 rounded-full -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-steemit-500/5 rounded-full -ml-16 -mb-16"></div>
              
              <CardHeader className="relative z-10 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-steemit-500/20">
                      <Send className="w-5 h-5 text-steemit-400" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg sm:text-xl">New Delegation</CardTitle>
                      <CardDescription className="text-slate-400 text-sm">
                        Share your voting power with others
                      </CardDescription>
                    </div>
                  </div>
                  {/* Available SP Badge */}
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Available</p>
                    <p className="text-lg font-bold text-steemit-400">{availableSP.toFixed(3)} <span className="text-sm font-normal text-slate-400">SP</span></p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-5 relative z-10">
                {/* Expiring delegations notice */}
                {expiringDelegationsSP > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                    <p className="text-xs text-amber-300">
                      <span className="font-semibold">{expiringDelegationsSP.toFixed(3)} SP</span> returning from cancelled delegations (~5 days)
                    </p>
                  </div>
                )}

                {/* Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="delegate-recipient" className="text-slate-300 text-sm font-medium">
                        Recipient
                      </Label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">@</span>
                      <Input
                        id="delegate-recipient"
                        value={delegateRecipient}
                        onChange={(e) => setDelegateRecipient(e.target.value)}
                        placeholder="username"
                        className="bg-slate-900/50 border-slate-600 text-white pl-8 focus:border-steemit-500 focus:ring-steemit-500/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="delegate-amount" className="text-slate-300 text-sm font-medium">
                        Amount
                      </Label>
                      <button 
                        type="button"
                        onClick={() => setDelegateAmount(availableSP.toFixed(3))}
                        className="text-xs text-steemit-400 hover:text-steemit-300 transition-colors cursor-pointer hover:underline"
                      >
                        Use Max
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="delegate-amount"
                        value={delegateAmount}
                        onChange={(e) => setDelegateAmount(e.target.value)}
                        placeholder="0.000"
                        type="number"
                        step="0.001"
                        min="1"
                        max={availableSP}
                        className="bg-slate-900/50 border-slate-600 text-white pr-12 focus:border-steemit-500 focus:ring-steemit-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">SP</span>
                    </div>
                    <p className="text-xs text-slate-500">Minimum: 1 SP</p>
                  </div>
                </div>

                {/* Benefits Section */}
                <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-steemit-400" />
                    <h4 className="font-medium text-slate-200 text-sm">Why Delegate?</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-steemit-500" />
                      <span>Share voting power</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-steemit-500" />
                      <span>Support creators</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-steemit-500" />
                      <span>Revoke anytime</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-steemit-500" />
                      <span>Keep ownership</span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  onClick={handleDelegate} 
                  className="w-full h-11 text-white font-medium text-sm sm:text-base bg-gradient-to-r from-steemit-500 to-steemit-600 hover:from-steemit-600 hover:to-steemit-700 shadow-lg shadow-steemit-500/20 transition-all duration-200"
                  disabled={!delegateRecipient || !delegateAmount || parseFloat(delegateAmount) < 0.5 || parseFloat(delegateAmount) > availableSP}
                >
                  <Handshake className="w-4 h-4 mr-2" />
                  Delegate STEEM Power
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-4 mt-6">
          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white text-lg sm:text-xl">
                My Delegations
                {displayUsername && (
                  <span className="text-sm font-normal text-slate-400 ml-2">by @{displayUsername}</span>
                )}
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm sm:text-base">
                STEEM Power delegated to others
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="border border-slate-700 rounded-lg p-3 sm:p-4 animate-pulse">
                      <div className="flex justify-between items-center">
                        <div className="space-y-2">
                          <div className="h-4 bg-slate-700 rounded w-24"></div>
                          <div className="h-3 bg-slate-700 rounded w-32"></div>
                        </div>
                        <div className="h-8 bg-slate-700 rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : outgoingDelegations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400">No delegations found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {outgoingDelegations.map((delegation, index) => (
                    <div key={index} className="border border-slate-700 rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white truncate text-sm sm:text-base">@{delegation.delegatee}</span>
                            <Badge variant="outline" className="text-[#07d7a9] border-[#07d7a9] text-xs">
                              Active
                            </Badge>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-slate-400">
                            <span className="font-medium">{delegation.steemPower} SP</span>
                            <span className="hidden sm:inline">•</span>
                            <span>Since {delegation.formattedDate}</span>
                          </div>
                        </div>
                        {/* Only show edit button for own account */}
                        {isOwnAccount && (
                          <div className="flex gap-2">
                            <DelegationEditDialog 
                              delegation={delegation} 
                              onSuccess={refetchAll}
                              steemPerMvests={steemPerMvests}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Delegation Confirmation Dialog */}
      <DelegationConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        delegator={loggedInUsername || ""}
        delegatee={delegateRecipient}
        amount={delegateAmount}
        vestingShares={pendingVestingShares}
        onSuccess={handleDelegationSuccess}
      />
    </div>
  );
};

export default DelegationOperations;
