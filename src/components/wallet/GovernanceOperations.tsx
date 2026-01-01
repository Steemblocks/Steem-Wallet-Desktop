
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock, CheckCircle, XCircle, Users, ExternalLink, DollarSign, Vote, X, TrendingUp, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { steemApi, SteemProposal } from "@/services/steemApi";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
// Import your utility functions
import { getSteemPerMvests, vestsToSteem } from '@/utils/utility';
import { SecureStorageFactory } from '@/services/secureStorage';

/**
 * Formats a large number into a human-readable string with a suffix (K, M, B).
 */
const formatSteemPower = (sp: number): string => {
    if (sp >= 1_000_000_000) {
        return `${(sp / 1_000_000_000).toFixed(2)}B`;
    }
    if (sp >= 1_000_000) {
        return `${(sp / 1_000_000).toFixed(2)}M`;
    }
    if (sp >= 1_000) {
        return `${(sp / 1_000).toFixed(1)}K`;
    }
    return sp.toFixed(0);
};

/**
 * A small helper component to display votes converted to Steem Power.
 * It now accurately converts the raw vote string to a VESTS number
 * before using the conversion function.
 */
const VoteDisplay = ({ totalVotes, steemPerMvests }: { totalVotes: string, steemPerMvests: number | null }) => {
  // If the conversion rate isn't loaded, show a fallback
  if (steemPerMvests === null) {
    return <span className="text-slate-400">...</span>;
  }

  try {
    // 1. The raw 'total_votes' is VESTS scaled by 1,000,000.
    // We use BigInt to handle the large string, divide to get the actual
    // VESTS value, then convert it to a standard number.
    const vestsAsNumber = Number(BigInt(totalVotes) / 1_000_000n);

    // 2. Use the known-working vestsToSteem function from the utility file.
    const steemPower = vestsToSteem(vestsAsNumber, steemPerMvests);

    // 3. Format the final, correct SP value for readability.
    const formattedSp = formatSteemPower(steemPower);

    return (
      <>
        <span className="text-green-400 font-medium">
          ~{formattedSp}
        </span>
        <span className="text-slate-400 ml-1">SP</span>
      </>
    );
  } catch (error) {
      console.error("Could not format votes", error);
      return <span className="text-slate-400">N/A</span>
  }
};


const GovernanceOperations = () => {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<SteemProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnProposal, setReturnProposal] = useState<SteemProposal | null>(null);
  const [steemPerMvests, setSteemPerMvests] = useState<number | null>(null);
  const [userVotedProposals, setUserVotedProposals] = useState<number[]>([]);
  const [processingProposalId, setProcessingProposalId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  
  // CRITICAL: Track submitted proposals to prevent duplicate transactions
  const submittedProposalsRef = useRef<Set<string>>(new Set());

  // Load username from secure storage
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        setUsername(user);
        setIsLoggedIn(!!user);
      } catch (error) {
        console.error('Error loading username from storage:', error);
      }
    };
    loadUsername();
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch proposals and steem per mvests
        const [proposalData, spm] = await Promise.all([
          steemApi.getProposalsByVotes(),
          getSteemPerMvests()
        ]);
        
        setProposals(proposalData);
        setSteemPerMvests(spm);
        const returnProp = proposalData.find(p => p.proposal_id === 0);
        setReturnProposal(returnProp || null);

        // Fetch user votes if logged in
        if (username) {
          const userVotes = await steemApi.getUserProposalVotes(username);
          setUserVotedProposals(userVotes);
        }
      } catch (err) {
        console.error('Error fetching governance data:', err);
        setError('Failed to fetch governance data');
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [username]);

  const handleVoteProposal = async (proposalId: number, approve: boolean) => {
    if (!isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please login to vote on proposals",
        variant: "destructive",
      });
      return;
    }
    
    // Create unique key for this vote action
    const voteKey = `${proposalId}_${approve}`;
    
    // CRITICAL: Prevent duplicate submissions
    if (submittedProposalsRef.current.has(voteKey) || processingProposalId !== null) {
      console.log('Blocking duplicate proposal vote - already processing or submitted');
      return;
    }

    // CRITICAL: Mark as submitted IMMEDIATELY
    submittedProposalsRef.current.add(voteKey);
    setProcessingProposalId(proposalId);

    try {
      const operation = {
        voter: username!,
        proposal_ids: [proposalId],
        approve: approve,
        extensions: []
      };

      await handlePrivateKeyOperation(username!, operation, approve ? 'vote' : 'unvote', voteKey);
    } catch (error: any) {
      console.error('Proposal vote error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Vote Already Processed",
          description: "This proposal vote was already submitted.",
        });
        // Update local state anyway
        if (approve) {
          setUserVotedProposals(prev => [...prev, proposalId]);
        } else {
          setUserVotedProposals(prev => prev.filter(id => id !== proposalId));
        }
        // Allow voting on the opposite action
        submittedProposalsRef.current.delete(voteKey);
      } else {
        // Reset ref on genuine errors to allow retry
        submittedProposalsRef.current.delete(voteKey);
      }
      setProcessingProposalId(null);
    }
  };

  const handlePrivateKeyOperation = async (username: string, operation: any, action: string, voteKey: string) => {
    const storage = SecureStorageFactory.getInstance();
    const privateKeyString = await storage.getItem('steem_active_key');
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Active key required for proposal voting",
        variant: "destructive",
      });
      setProcessingProposalId(null);
      submittedProposalsRef.current.delete(voteKey);
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      const result = await steemOperations.updateProposalVotes(operation, privateKey);
      
      toast({
        title: `Proposal ${action} Successful`,
        description: `Successfully ${action}d on proposal(s) ${operation.proposal_ids.join(', ')}`,
        variant: "success",
      });
      
      // Update local vote state
      if (operation.approve) {
        setUserVotedProposals(prev => [...prev, ...operation.proposal_ids]);
      } else {
        setUserVotedProposals(prev => prev.filter(id => !operation.proposal_ids.includes(id)));
      }
      
      setProcessingProposalId(null);
      // Allow voting on the opposite action after success
      submittedProposalsRef.current.delete(voteKey);
      
    } catch (error: any) {
      console.error('Operation error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      
      if (isDuplicate) {
        toast({
          title: "Vote Already Processed",
          description: "This proposal vote was already submitted.",
          variant: "success",
        });
        // Update local state anyway
        if (operation.approve) {
          setUserVotedProposals(prev => [...prev, ...operation.proposal_ids]);
        } else {
          setUserVotedProposals(prev => prev.filter(id => !operation.proposal_ids.includes(id)));
        }
        // Allow opposite voting action
        submittedProposalsRef.current.delete(voteKey);
      } else {
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
        submittedProposalsRef.current.delete(voteKey);
      }
      setProcessingProposalId(null);
    }
  };

  const isProposalFunded = (proposal: SteemProposal): boolean => {
    if (!returnProposal) return false;
    try {
        const proposalVotes = BigInt(proposal.total_votes);
        const returnVotes = BigInt(returnProposal.total_votes);
        return proposalVotes > returnVotes;
    } catch (e) {
        return false;
    }
  };

  const getFundingBadge = (proposal: SteemProposal) => {
    if (proposal.proposal_id === 0) {
      return (
        <Badge variant="outline" className="text-xs text-orange-400 border-orange-600 bg-orange-950/50">
          <DollarSign className="w-3 h-3 mr-1" />
          Funding Threshold
        </Badge>
      );
    }
    const funded = isProposalFunded(proposal);
    return (
      <Badge variant="outline" className={`text-xs ${funded ? 'text-green-400 border-green-600 bg-green-950/50' : 'text-slate-400 border-slate-600 bg-slate-800/50'}`}>
        <DollarSign className="w-3 h-3 mr-1" />
        {funded ? 'Funded' : 'Not Funded'}
      </Badge>
    );
  };

  const getStatusIcon = (proposal: SteemProposal) => {
    const status = steemApi.getProposalStatus(proposal.start_date, proposal.end_date);
    switch (status) {
      case "active": return <Clock className="w-4 h-4 text-blue-500" />;
      case "expired": return <XCircle className="w-4 h-4 text-red-500" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (proposal: SteemProposal) => {
    const status = steemApi.getProposalStatus(proposal.start_date, proposal.end_date);
    switch (status) {
      case "active": return "text-blue-400 border-blue-600";
      case "expired": return "text-red-400 border-red-600";
      case "pending": return "text-yellow-400 border-yellow-600";
      default: return "text-slate-400 border-slate-600";
    }
  };

  const getCategoryColor = (dailyPay: string) => {
    const amount = parseFloat(dailyPay);
    if (amount >= 1000) return "text-red-400 border-red-600 bg-red-950/50";
    if (amount >= 100) return "text-orange-400 border-orange-600 bg-orange-950/50";
    return "text-green-400 border-green-600 bg-green-950/50";
  };

  const hasUserVoted = (proposalId: number) => {
    return userVotedProposals.includes(proposalId);
  };
  
  const activeProposals = proposals.filter(p => steemApi.getProposalStatus(p.start_date, p.end_date) === 'active');
  const fundedProposals = proposals.filter(p => isProposalFunded(p) && p.proposal_id !== 0);
  const completedProposals = proposals.filter(p => steemApi.getProposalStatus(p.start_date, p.end_date) !== 'active');


  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-[#07d7a9] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Loading DAO proposals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card className="bg-red-950/50 border border-red-900/50 shadow-sm">
          <CardContent className="p-4">
            <div className="text-center text-red-400">
              <p>Error loading proposals: {error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Vote className="w-6 h-6 text-steemit-500" />
          <h2 className="text-2xl font-bold text-white">DAO Governance</h2>
        </div>
        <p className="text-slate-400 text-sm">Vote on proposals and shape the future of the Steem ecosystem</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-800/50 shadow-sm border border-slate-700 rounded-lg p-1">
          <TabsTrigger value="active" className="h-full data-[state=active]:text-white data-[state=active]:bg-steemit-500 data-[state=inactive]:text-slate-300 text-sm sm:text-base font-medium rounded-md">
            <Clock className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Active ({activeProposals.length})</span>
            <span className="sm:hidden">Live</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="h-full data-[state=active]:text-white data-[state=active]:bg-steemit-500 data-[state=inactive]:text-slate-300 text-sm sm:text-base font-medium rounded-md">
            <CheckCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">All ({proposals.length})</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="h-full data-[state=active]:text-white data-[state=active]:bg-steemit-500 data-[state=inactive]:text-slate-300 text-sm sm:text-base font-medium rounded-md">
            <TrendingUp className="w-4 h-4 mr-2" />
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6 mt-6">
          <Card className="shadow-md border-0 bg-slate-800/50">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 pb-4 rounded-t-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-steemit-500" />
                  <div>
                    <CardTitle className="text-lg text-white">Active DAO Proposals</CardTitle>
                    <CardDescription className="text-slate-400">Vote on proposals that shape Steem's future</CardDescription>
                  </div>
                </div>
                {isLoggedIn && (
                  <Badge className="bg-green-900/50 text-green-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    @{username}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {activeProposals.map((proposal) => (
                  <div key={proposal.id} className="border border-slate-700 rounded-lg p-4 hover:shadow-md transition-all duration-300 hover:border-steemit-500 bg-slate-900/30">
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white text-sm sm:text-base">{proposal.subject}</h3>
                            <Badge variant="outline" className={`text-xs ${getCategoryColor(proposal.daily_pay)}`}>
                              {steemApi.formatDailyPay(proposal.daily_pay)} SBD/day
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
                            <span>by @{proposal.creator}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>to @{proposal.receiver}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>ID #{proposal.proposal_id}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>Ends {new Date(proposal.end_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(proposal)}
                          <Badge variant="outline" className={`text-xs ${getStatusColor(proposal)}`}>
                            {steemApi.getProposalStatus(proposal.start_date, proposal.end_date)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {getFundingBadge(proposal)}
                        {hasUserVoted(proposal.proposal_id) && (
                          <Badge variant="default" className="text-xs bg-green-600 text-white">
                            <Vote className="w-3 h-3 mr-1" />
                            You Voted
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-xs sm:text-sm">
                          <div className="flex items-center gap-1">
                            <VoteDisplay totalVotes={proposal.total_votes} steemPerMvests={steemPerMvests} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {hasUserVoted(proposal.proposal_id) ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleVoteProposal(proposal.proposal_id, false)}
                              disabled={!isLoggedIn || processingProposalId !== null}
                              className="bg-red-950/50 border-red-900/50 text-red-400 hover:bg-red-900/50 text-xs sm:text-sm px-3 sm:px-4"
                            >
                              {processingProposalId === proposal.proposal_id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <X className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Unvote</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => handleVoteProposal(proposal.proposal_id, true)}
                              disabled={!isLoggedIn || processingProposalId !== null}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm px-3 sm:px-4"
                            >
                              {processingProposalId === proposal.proposal_id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Vote className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Vote For</span>
                                </>
                              )}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-xs sm:text-sm px-2 sm:px-3" onClick={() => window.open(`https://steemit.com/@${proposal.creator}/${proposal.permlink}`, '_blank')}>
                            <ExternalLink className="w-3 h-3 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {activeProposals.length === 0 && (
                  <div className="text-center text-slate-400 py-8">No active proposals found</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-6">
          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white text-lg sm:text-xl">All Proposals</CardTitle>
              <CardDescription className="text-slate-400 text-sm sm:text-base">
                Review all DAO proposals ordered by total votes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proposals.slice(0, 20).map((proposal, index) => (
                  <div key={proposal.id} className="border border-slate-700 rounded-lg p-3 sm:p-4 bg-slate-900/30">
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-slate-500">#{index + 1}</span>
                            <h3 className="font-semibold text-white text-sm sm:text-base">{proposal.subject}</h3>
                            <Badge variant="outline" className={`text-xs ${getCategoryColor(proposal.daily_pay)}`}>
                              {steemApi.formatDailyPay(proposal.daily_pay)} SBD/day
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
                            <span>by @{proposal.creator}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>to @{proposal.receiver}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>ID #{proposal.proposal_id}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(proposal)}
                          <Badge variant="outline" className={`text-xs ${getStatusColor(proposal)}`}>
                            {steemApi.getProposalStatus(proposal.start_date, proposal.end_date)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {getFundingBadge(proposal)}
                        {hasUserVoted(proposal.proposal_id) && (
                          <Badge variant="default" className="text-xs bg-green-600 text-white">
                            <Vote className="w-3 h-3 mr-1" />
                            You Voted
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs sm:text-sm">
                          <VoteDisplay totalVotes={proposal.total_votes} steemPerMvests={steemPerMvests} />
                        </div>
                        <Button size="sm" variant="outline" className="text-xs sm:text-sm px-2 sm:px-3" onClick={() => window.open(`https://steemit.com/@${proposal.creator}/${proposal.permlink}`, '_blank')}>
                          <ExternalLink className="w-3 h-3 sm:mr-1" />
                          <span className="hidden sm:inline">View Post</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
               <CardContent className="p-4">
                 <div className="text-center">
                   <p className="text-lg sm:text-2xl font-bold" style={{ color: '#07d7a9' }}>{proposals.length}</p>
                   <p className="text-xs sm:text-sm text-slate-400">Total Proposals</p>
                 </div>
               </CardContent>
             </Card>
             <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
               <CardContent className="p-4">
                 <div className="text-center">
                   <p className="text-lg sm:text-2xl font-bold text-green-400">{activeProposals.length}</p>
                   <p className="text-xs sm:text-sm text-slate-400">Active</p>
                 </div>
               </CardContent>
             </Card>
             <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
               <CardContent className="p-4">
                 <div className="text-center">
                   <p className="text-lg sm:text-2xl font-bold text-blue-400">{fundedProposals.length}</p>
                   <p className="text-xs sm:text-sm text-slate-400">Funded</p>
                 </div>
               </CardContent>
             </Card>
             <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
               <CardContent className="p-4">
                 <div className="text-center">
                   <p className="text-lg sm:text-2xl font-bold text-yellow-400">
                     {proposals.filter(p => steemApi.getProposalStatus(p.start_date, p.end_date) === 'pending').length}
                   </p>
                   <p className="text-xs sm:text-sm text-slate-400">Pending</p>
                 </div>
               </CardContent>
             </Card>
           </div>
          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white text-lg sm:text-xl">Top Funded Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proposals.slice(0, 5).map((proposal, index) => (
                  <div key={proposal.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-400">#{index + 1}</span>
                      <span className="text-white text-sm truncate max-w-xs">{proposal.subject}</span>
                      {getFundingBadge(proposal)}
                      {hasUserVoted(proposal.proposal_id) && (
                        <Badge variant="default" className="text-xs bg-green-600 text-white">
                          <Vote className="w-3 h-3 mr-1" />
                          Voted
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      <VoteDisplay totalVotes={proposal.total_votes} steemPerMvests={steemPerMvests} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GovernanceOperations;
