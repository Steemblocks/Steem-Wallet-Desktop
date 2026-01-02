import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Vote, UserCheck, Settings, ExternalLink, AlertCircle, Info, Loader2, Shield, TrendingUp, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWitnessData } from "@/hooks/useWitnesses";
import { useSteemAccount } from '@/hooks/useSteemAccount';
import { steemOperations } from '@/services/steemOperations';
import { useQueryClient } from '@tanstack/react-query';
import * as dsteem from 'dsteem';
import { SecureStorageFactory } from '@/services/secureStorage';
import { getDecryptedKey } from '@/hooks/useSecureKeys';

interface WitnessOperationsProps {
  loggedInUser?: string | null;
}

const WitnessOperations = ({ loggedInUser }: WitnessOperationsProps) => {
  const [proxyAccount, setProxyAccount] = useState("");
  const [filterVotes, setFilterVotes] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingWitness, setProcessingWitness] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Ref to track if a transaction has been submitted
  const transactionSubmittedRef = useRef(false);

  const { witnesses, isLoading, error, userVoteCount } = useWitnessData(loggedInUser);
  const { data: userAccountData } = useSteemAccount(loggedInUser || '');

  const currentProxy = userAccountData?.proxy || '';
  const filteredWitnesses = filterVotes ? witnesses.filter(w => w.voted) : witnesses;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['witnesses'] });
    queryClient.invalidateQueries({ queryKey: ['userWitnessVotes', loggedInUser] });
    queryClient.invalidateQueries({ queryKey: ['account', loggedInUser] });
  };

  const handleVote = async (witnessName: string, isVoting: boolean) => {
    if (!loggedInUser) {
      toast({
        title: "Login Required",
        description: "Please log in to vote for witnesses",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent duplicate submissions - use witness name as part of check
    if (processingWitness) {
      console.log('Blocking duplicate witness vote - already processing');
      return;
    }

    setProcessingWitness(witnessName);

    try {
      await handlePrivateKeyWitnessVote(loggedInUser, witnessName, isVoting);
    } catch (error: any) {
      console.error('Witness vote error:', error);
      
      // Check for duplicate transaction
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Vote Already Processed",
          description: "This witness vote was already submitted.",
          variant: "success",
        });
        setTimeout(() => invalidateQueries(), 1000);
      }
    } finally {
      setProcessingWitness(null);
    }
  };

  const handlePrivateKeyWitnessVote = async (account: string, witness: string, approve: boolean) => {
    // Get decrypted key from secure storage
    const privateKeyString = await getDecryptedKey(account, 'active');
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Private key not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      await steemOperations.voteWitness(account, witness, approve, privateKey);
      
      toast({
        title: "Vote Successful",
        description: `${approve ? "Voted for" : "Removed vote from"} witness @${witness}`,
        variant: "success",
      });
      
      // Invalidate queries to refresh data
      setTimeout(() => {
        invalidateQueries();
      }, 1000);
    } catch (error: any) {
      console.error('Witness vote error:', error);
      toast({
        title: "Vote Failed",
        description: error.message || "Failed to vote for witness",
        variant: "destructive",
      });
    }
  };

  const handleSetProxy = async () => {
    if (!proxyAccount) return;
    if (!loggedInUser) {
      toast({
        title: "Login Required",
        description: "Please log in to set a witness proxy",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent duplicate submissions
    if (transactionSubmittedRef.current || isProcessing) {
      console.log('Blocking duplicate proxy set submission');
      return;
    }
    
    transactionSubmittedRef.current = true;
    setIsProcessing(true);

    try {
      await handlePrivateKeyProxy(loggedInUser, proxyAccount);
      transactionSubmittedRef.current = false;
    } catch (error: any) {
      console.error('Proxy set error:', error);
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Proxy Already Set",
          description: "This proxy setting was already submitted.",
          variant: "success",
        });
      }
      transactionSubmittedRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveProxy = async () => {
    if (!loggedInUser || !currentProxy) return;
    
    // Prevent duplicate submissions
    if (transactionSubmittedRef.current || isProcessing) {
      console.log('Blocking duplicate proxy remove submission');
      return;
    }
    
    transactionSubmittedRef.current = true;
    setIsProcessing(true);

    try {
      await handlePrivateKeyProxy(loggedInUser, '');
      transactionSubmittedRef.current = false;
    } catch (error: any) {
      console.error('Proxy remove error:', error);
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Proxy Already Removed",
          description: "This proxy removal was already submitted.",
          variant: "success",
        });
      }
      transactionSubmittedRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrivateKeyProxy = async (account: string, proxy: string) => {
    // Get decrypted key from secure storage
    const privateKeyString = await getDecryptedKey(account, 'active');
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Private key not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      
      if (proxy) {
        await steemOperations.setWitnessProxy(account, proxy, privateKey);
      } else {
        await steemOperations.removeWitnessProxy(account, privateKey);
      }
      
      toast({
        title: "Proxy Updated",
        description: proxy ? `Set @${proxy} as your witness proxy` : "Removed witness proxy",
        variant: "success",
      });
      
      if (proxy) setProxyAccount("");
      
      // Invalidate queries to refresh data
      setTimeout(() => {
        invalidateQueries();
      }, 1000);
    } catch (error: any) {
      console.error('Proxy update error:', error);
      toast({
        title: "Proxy Update Failed",
        description: error.message || "Failed to update proxy",
        variant: "destructive",
      });
    }
  };

  const handleWitnessInfo = (witnessUrl: string, witnessName: string) => {
    if (witnessUrl && witnessUrl !== '') {
      window.open(witnessUrl, '_blank');
    } else {
      toast({
        title: "No Information Available",
        description: `@${witnessName} has not provided a witness information URL`,
      });
    }
  };

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-900/50 to-red-950/50 border border-red-800 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-300 mb-1">Error Loading Witness Data</h3>
              <p className="text-red-400 text-sm">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-steemit-500" />
            <h2 className="text-2xl font-bold text-white">Witness Network</h2>
          </div>
          <p className="text-slate-400 text-sm">Secure the Steem blockchain by voting for up to 30 witnesses</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="witnesses" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-800/50 shadow-sm border border-slate-700 rounded-lg p-1">
            <TabsTrigger 
              value="witnesses" 
              className="h-full data-[state=active]:text-white data-[state=active]:bg-steemit-500 data-[state=inactive]:text-slate-300 text-sm sm:text-base font-medium rounded-md"
            >
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Witnesses</span>
              <span className="sm:hidden">Votes</span>
            </TabsTrigger>
            <TabsTrigger 
              value="proxy" 
              className="h-full data-[state=active]:text-white data-[state=active]:bg-steemit-500 data-[state=inactive]:text-slate-300 text-sm sm:text-base font-medium rounded-md"
            >
              <Settings className="w-4 h-4 mr-2" />
              Proxy
            </TabsTrigger>
          </TabsList>

          {/* Witnesses Tab */}
          <TabsContent value="witnesses" className="space-y-6 mt-6">
            <Card className="shadow-md border-0 bg-slate-800/50">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 pb-4 rounded-t-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Vote className="w-5 h-5 text-steemit-500" />
                    <div>
                      <CardTitle className="text-lg text-white">Witness Voting</CardTitle>
                      <CardDescription className="text-slate-400">Vote for witnesses to secure the blockchain</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    {loggedInUser && (
                      <Badge className="bg-green-900/50 text-green-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        @{loggedInUser}
                      </Badge>
                    )}
                    {loggedInUser && (
                      <Badge variant="outline" className="font-semibold border-steemit-500 text-steemit-400">
                        {userVoteCount}/30 Votes
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex items-center space-x-3 px-4 py-2 bg-slate-700/50 rounded-lg">
                    <Switch
                      id="filter-votes"
                      checked={filterVotes}
                      onCheckedChange={setFilterVotes}
                    />
                    <Label htmlFor="filter-votes" className="text-sm font-medium cursor-pointer text-slate-300">Show only my votes</Label>
                  </div>
                </div>

                {/* Show proxy warning if user has a proxy set */}
                {currentProxy && (
                  <div className="bg-orange-900/30 border border-orange-700 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-300">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Proxy Active: @{currentProxy} is voting for you
                      </span>
                    </div>
                  </div>
                )}

                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className="border border-slate-700 rounded-lg p-3 sm:p-4 animate-pulse bg-slate-800/30">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="h-4 bg-slate-700 rounded w-1/3 mb-2"></div>
                            <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                          </div>
                          <div className="flex gap-2">
                            <div className="h-8 w-16 bg-slate-700 rounded"></div>
                            <div className="h-8 w-12 bg-slate-700 rounded"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {filteredWitnesses.map((witness) => {
                      return (
                        <div key={witness.name} className={`border border-slate-700 rounded-lg p-3 sm:p-4 bg-slate-800/30 ${witness.isDisabled ? 'opacity-60' : ''}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                <span className={`font-medium text-slate-300 text-sm sm:text-base ${witness.isDisabled ? 'line-through' : ''}`}>#{witness.rank}</span>
                                <span className={`font-semibold text-white truncate text-sm sm:text-base ${witness.isDisabled ? 'line-through' : ''}`}>@{witness.name}</span>
                                {witness.voted && (
                                  <Badge className="bg-[#07d7a9] text-white text-xs">
                                    <UserCheck className="w-3 h-3 mr-1" />
                                    Voted
                                  </Badge>
                                )}
                                {witness.isDisabledByKey && (
                                  <Badge variant="outline" className="text-red-500 border-red-300 text-xs">
                                    Disabled
                                  </Badge>
                                )}
                                {witness.hasInvalidVersion && (
                                  <>
                                    <Badge variant="outline" className="text-orange-500 border-orange-300 text-xs">
                                      Invalid Version
                                    </Badge>
                                    <Badge variant="outline" className="text-red-500 border-red-300 text-xs">
                                      Rejected
                                    </Badge>
                                  </>
                                )}
                              </div>
                              <div className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-slate-400 ${witness.isDisabled ? 'line-through' : ''}`}>
                                <div className="flex items-center gap-1">
                                  <span>Votes: {witness.votes}</span>
                                </div>
                                <span className="hidden sm:inline">•</span>
                                <span>Version: {witness.version}</span>
                                <span className="hidden sm:inline">•</span>
                                <span>Missed: {witness.missedBlocks}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={witness.voted ? "destructive" : "default"}
                                onClick={() => handleVote(witness.name, !witness.voted)}
                                className={`text-xs sm:text-sm px-2 sm:px-4 ${
                                  !witness.voted 
                                    ? 'text-white' 
                                    : ''
                                }`}
                                style={!witness.voted ? { backgroundColor: '#07d7a9' } : {}}
                                disabled={!loggedInUser || !!currentProxy || processingWitness === witness.name}
                              >
                                {processingWitness === witness.name ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  witness.voted ? "Unvote" : "Vote"
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-xs sm:text-sm px-2 sm:px-3"
                                onClick={() => handleWitnessInfo(witness.url, witness.name)}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Info
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proxy" className="space-y-4 mt-6">
            <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 text-lg sm:text-xl">
                  <Settings className="w-5 h-5 text-steemit-500" />
                  Witness Voting Proxy
                </CardTitle>
                <CardDescription className="text-slate-400 text-sm sm:text-base">
                  Delegate your witness voting power to a trusted account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proxy-account" className="text-slate-300">Proxy Account</Label>
                  <Input
                    id="proxy-account"
                    value={proxyAccount}
                    onChange={(e) => setProxyAccount(e.target.value)}
                    placeholder="username"
                    className="bg-slate-800 border-slate-700 text-white"
                    disabled={isProcessing}
                  />
                </div>

                <div className="bg-blue-900/30 border border-blue-700 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-medium text-blue-300 mb-2 text-sm sm:text-base">ℹ️ About Proxy Voting:</h4>
                  <ul className="text-xs sm:text-sm text-blue-200 space-y-1">
                    <li>• Your proxy will vote for witnesses on your behalf</li>
                    <li>• You can change or remove your proxy anytime</li>
                    <li>• Setting a proxy removes all your individual votes</li>
                    <li>• Choose someone you trust with voting decisions</li>
                  </ul>
                </div>

                <div className="bg-slate-900/50 border border-slate-700 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-medium text-white mb-2 text-sm sm:text-base">Current Proxy:</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Set to:</span>
                    <Badge variant={currentProxy ? "default" : "outline"} className={currentProxy ? "bg-[#07d7a9] text-white" : "text-slate-400 border-slate-600"}>
                      {currentProxy || "None"}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSetProxy} 
                    className="flex-1 text-white text-sm sm:text-base"
                    style={{ backgroundColor: '#07d7a9' }}
                    disabled={!proxyAccount || !loggedInUser || isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting...
                      </>
                    ) : (
                      'Set Proxy'
                    )}
                  </Button>
                  
                  {currentProxy && (
                    <Button 
                      onClick={handleRemoveProxy}
                      variant="outline"
                      className="flex-1 text-sm sm:text-base"
                      disabled={!loggedInUser || isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        'Remove Proxy'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default WitnessOperations;
