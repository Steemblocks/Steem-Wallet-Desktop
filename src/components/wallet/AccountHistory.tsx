import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Download, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Gift,
  Award,
  TrendingUp,
  Users,
  PiggyBank,
  Radio,
  Settings,
  Vote,
  UserCheck,
  Coins,
  Clock,
  Route
} from 'lucide-react';
import { useAccountHistory } from '@/hooks/useAccountHistory';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getSteemPerMvests, vestsToSteem } from '@/utils/utility';

interface AccountHistoryProps {
  account: string;
}

const AccountHistory: React.FC<AccountHistoryProps> = ({ account }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [steemPerMvests, setSteemPerMvests] = useState<number>(0);
  const {
    transactions,
    isLoading,
    error,
    filter,
    setFilter,
    page,
    setPage,
    totalPages,
    loadMore,
    hasMore,
    refresh,
    availableOperationTypes
  } = useAccountHistory(account, 100);

  // Fetch Steem per Mvests on component mount
  useEffect(() => {
    const fetchSteemPerMvests = async () => {
      try {
        const value = await getSteemPerMvests();
        setSteemPerMvests(value);
      } catch (error) {
        console.error('Error fetching Steem per Mvests:', error);
      }
    };
    fetchSteemPerMvests();
  }, []);

  const handleOperationTypeToggle = (opType: string, checked: boolean) => {
    setFilter(prev => ({
      ...prev,
      operationTypes: checked
        ? [...prev.operationTypes, opType]
        : prev.operationTypes.filter(type => type !== opType)
    }));
    setPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilter({ operationTypes: [] });
    setPage(1);
  };

  const selectAllFinancialOps = () => {
    const financialOps = [
      'account_witness_proxy',
      'account_witness_vote',
      'author_reward',
      'cancel_transfer_from_savings',
      'claim_reward_balance',
      'comment_benefactor_reward',
      'curation_reward',
      'delegate_vesting_shares',
      'escrow_approve',
      'escrow_dispute',
      'escrow_release',
      'escrow_transfer',
      'feed_publish',
      'fill_convert_request',
      'fill_transfer_from_savings',
      'fill_vesting_withdraw',
      'limit_order_cancel',
      'limit_order_create',
      'limit_order_create2',
      'producer_reward',
      'proposal_pay',
      'set_withdraw_vesting_route',
      'transfer',
      'transfer_from_savings',
      'transfer_to_savings',
      'transfer_to_vesting',
      'withdraw_vesting',
      'witness_set_properties',
      'witness_update'
    ];
    setFilter(prev => ({ ...prev, operationTypes: financialOps }));
    setPage(1);
  };

  const getOperationColor = (type: string): string => {
    const colorMap: { [key: string]: string } = {
      'transfer': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'transfer_to_vesting': 'bg-green-500/20 text-green-400 border-green-500/30',
      'withdraw_vesting': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'delegate_vesting_shares': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'claim_reward_balance': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'author_reward': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'curation_reward': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      'producer_reward': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
      'witness_set_properties': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      'witness_update': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      'feed_publish': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'account_witness_vote': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'account_witness_proxy': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'transfer_from_savings': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'transfer_to_savings': 'bg-lime-500/20 text-lime-400 border-lime-500/30',
      'fill_transfer_from_savings': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'set_withdraw_vesting_route': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    };
    return colorMap[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getOperationIcon = (type: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'transfer': <ArrowUpRight className="w-4 h-4" />,
      'transfer_to_vesting': <Zap className="w-4 h-4" />,
      'withdraw_vesting': <TrendingUp className="w-4 h-4" />,
      'delegate_vesting_shares': <Users className="w-4 h-4" />,
      'claim_reward_balance': <Gift className="w-4 h-4" />,
      'author_reward': <Award className="w-4 h-4" />,
      'curation_reward': <Award className="w-4 h-4" />,
      'producer_reward': <Coins className="w-4 h-4" />,
      'witness_set_properties': <Settings className="w-4 h-4" />,
      'witness_update': <Settings className="w-4 h-4" />,
      'feed_publish': <Radio className="w-4 h-4" />,
      'account_witness_vote': <Vote className="w-4 h-4" />,
      'account_witness_proxy': <UserCheck className="w-4 h-4" />,
      'transfer_from_savings': <PiggyBank className="w-4 h-4" />,
      'transfer_to_savings': <PiggyBank className="w-4 h-4" />,
      'fill_transfer_from_savings': <PiggyBank className="w-4 h-4" />,
      'set_withdraw_vesting_route': <Route className="w-4 h-4" />,
    };
    return iconMap[type] || <Coins className="w-4 h-4" />;
  };

  const getOperationLabel = (type: string): string => {
    const labelMap: { [key: string]: string } = {
      'transfer': 'Transfer',
      'transfer_to_vesting': 'Power Up',
      'withdraw_vesting': 'Power Down',
      'delegate_vesting_shares': 'Delegation',
      'claim_reward_balance': 'Claim Rewards',
      'author_reward': 'Author Reward',
      'curation_reward': 'Curation Reward',
      'producer_reward': 'Block Reward',
      'witness_set_properties': 'Witness Config',
      'witness_update': 'Witness Update',
      'feed_publish': 'Price Feed',
      'account_witness_vote': 'Witness Vote',
      'account_witness_proxy': 'Voting Proxy',
      'transfer_from_savings': 'Savings Withdraw',
      'transfer_to_savings': 'Savings Deposit',
      'fill_transfer_from_savings': 'Savings Complete',
      'set_withdraw_vesting_route': 'Withdraw Route',
    };
    return labelMap[type] || type.replace(/_/g, ' ');
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatVestsToSP = (vestsString: string): string => {
    if (!vestsString || steemPerMvests === 0) return vestsString;
    
    const vestsValue = parseFloat(vestsString.split(' ')[0]);
    if (isNaN(vestsValue)) return vestsString;
    
    const spValue = vestsToSteem(vestsValue, steemPerMvests);
    return `${spValue.toFixed(3)} SP`;
  };

  const formatCurrency = (amountString: string): string => {
    if (!amountString) return '0';
    
    // If it already contains the currency, just return the value part
    const parts = amountString.split(' ');
    if (parts.length >= 2) {
      return parts[0];
    }
    return amountString;
  };

  const formatRewardAmounts = (steemAmount: string, sbdAmount: string, vestsAmount: string): string => {
    const amounts = [];
    
    const steem = parseFloat(formatCurrency(steemAmount || '0'));
    const sbd = parseFloat(formatCurrency(sbdAmount || '0'));
    
    if (steem > 0) {
      amounts.push(`${steem.toFixed(3)} STEEM`);
    }
    
    if (sbd > 0) {
      amounts.push(`${sbd.toFixed(3)} SBD`);
    }
    
    const spFormatted = formatVestsToSP(vestsAmount || '0');
    const spValue = parseFloat(spFormatted.split(' ')[0]);
    if (spValue > 0) {
      amounts.push(spFormatted);
    }
    
    return amounts.length > 0 ? amounts.join(', ') : 'No rewards';
  };

  const formatOperationData = (type: string, data: any, currentAccount: string): { 
    title: string; 
    subtitle?: string; 
    amount?: string; 
    amountType?: 'positive' | 'negative' | 'neutral';
    memo?: string;
    details?: { label: string; value: string }[];
  } => {
    switch (type) {
      case 'transfer':
        const isIncoming = data.to === currentAccount;
        return {
          title: isIncoming ? `From @${data.from}` : `To @${data.to}`,
          amount: data.amount,
          amountType: isIncoming ? 'positive' : 'negative',
          memo: data.memo || undefined,
          details: [
            { label: 'From', value: `@${data.from}` },
            { label: 'To', value: `@${data.to}` },
          ]
        };
      case 'transfer_to_vesting':
        const isPowerUpSelf = data.from === data.to;
        return {
          title: isPowerUpSelf ? 'Power Up' : `Power Up to @${data.to}`,
          subtitle: !isPowerUpSelf ? `From @${data.from}` : undefined,
          amount: data.amount,
          amountType: 'positive',
          details: [
            { label: 'From', value: `@${data.from}` },
            { label: 'To', value: `@${data.to}` },
          ]
        };
      case 'withdraw_vesting':
        return {
          title: 'Power Down Started',
          subtitle: `Weekly: ${formatVestsToSP(String(parseFloat(data.vesting_shares?.split(' ')[0] || '0') / 13))} VESTS`  ,
          amount: formatVestsToSP(data.vesting_shares),
          amountType: 'negative',
          details: [
            { label: 'Total', value: formatVestsToSP(data.vesting_shares) },
            { label: 'Account', value: `@${data.account}` },
          ]
        };
      case 'delegate_vesting_shares':
        const isDelegating = data.delegator === currentAccount;
        const vestsSP = formatVestsToSP(data.vesting_shares);
        const isUndelegation = parseFloat(data.vesting_shares?.split(' ')[0] || '0') === 0;
        return {
          title: isUndelegation 
            ? (isDelegating ? `Undelegated from @${data.delegatee}` : `Undelegation from @${data.delegator}`)
            : (isDelegating ? `Delegated to @${data.delegatee}` : `Received from @${data.delegator}`),
          amount: isUndelegation ? 'Removed' : vestsSP,
          amountType: isDelegating ? 'negative' : 'positive',
          details: [
            { label: 'Delegator', value: `@${data.delegator}` },
            { label: 'Delegatee', value: `@${data.delegatee}` },
          ]
        };
      case 'claim_reward_balance':
        const rewardParts = [];
        const steemReward = parseFloat(data.reward_steem?.split(' ')[0] || '0');
        const sbdReward = parseFloat(data.reward_sbd?.split(' ')[0] || '0');
        const vestsReward = parseFloat(data.reward_vests?.split(' ')[0] || '0');
        if (steemReward > 0) rewardParts.push({ label: 'STEEM', value: data.reward_steem });
        if (sbdReward > 0) rewardParts.push({ label: 'SBD', value: data.reward_sbd });
        if (vestsReward > 0) rewardParts.push({ label: 'SP', value: formatVestsToSP(data.reward_vests) });
        return {
          title: 'Rewards Claimed',
          subtitle: `@${data.account}`,
          amount: formatRewardAmounts(data.reward_steem, data.reward_sbd, data.reward_vests),
          amountType: 'positive',
          details: rewardParts.length > 0 ? rewardParts : undefined
        };
      case 'author_reward':
        const authorParts = [];
        const authorSteem = parseFloat(data.steem_payout?.split(' ')[0] || '0');
        const authorSbd = parseFloat(data.sbd_payout?.split(' ')[0] || '0');
        const authorVests = parseFloat(data.vesting_payout?.split(' ')[0] || '0');
        if (authorSteem > 0) authorParts.push({ label: 'STEEM', value: data.steem_payout });
        if (authorSbd > 0) authorParts.push({ label: 'SBD', value: data.sbd_payout });
        if (authorVests > 0) authorParts.push({ label: 'SP', value: formatVestsToSP(data.vesting_payout) });
        return {
          title: 'Author Reward',
          subtitle: data.permlink ? `📝 ${data.permlink.substring(0, 40)}${data.permlink.length > 40 ? '...' : ''}` : undefined,
          amount: formatRewardAmounts(data.steem_payout, data.sbd_payout, data.vesting_payout),
          amountType: 'positive',
          details: authorParts.length > 0 ? authorParts : undefined
        };
      case 'curation_reward':
        return {
          title: 'Curation Reward',
          subtitle: data.comment_author && data.comment_permlink 
            ? `@${data.comment_author}/${data.comment_permlink.substring(0, 25)}${data.comment_permlink.length > 25 ? '...' : ''}`
            : data.comment_author ? `@${data.comment_author}` : undefined,
          amount: formatVestsToSP(data.reward),
          amountType: 'positive',
          details: [
            { label: 'Author', value: `@${data.comment_author}` },
            { label: 'Earned', value: formatVestsToSP(data.reward) },
          ]
        };
      case 'producer_reward':
        return {
          title: 'Block Production Reward',
          subtitle: `Producer: @${data.producer}`,
          amount: formatVestsToSP(data.vesting_shares),
          amountType: 'positive',
          details: [
            { label: 'Producer', value: `@${data.producer}` },
            { label: 'Reward', value: formatVestsToSP(data.vesting_shares) },
          ]
        };
      case 'witness_set_properties':
        const propsCount = data.props ? data.props.length : 0;
        return {
          title: 'Witness Properties Updated',
          subtitle: `${propsCount} ${propsCount === 1 ? 'property' : 'properties'} changed`,
          amountType: 'neutral',
          details: [
            { label: 'Owner', value: `@${data.owner}` },
            { label: 'Properties', value: `${propsCount} updated` },
          ]
        };
      case 'witness_update':
        return {
          title: 'Witness Profile Updated',
          subtitle: data.url ? `🔗 ${data.url.substring(0, 30)}${data.url.length > 30 ? '...' : ''}` : undefined,
          amountType: 'neutral',
          details: [
            { label: 'Owner', value: `@${data.owner}` },
            ...(data.url ? [{ label: 'URL', value: data.url.substring(0, 40) }] : []),
          ]
        };
      case 'feed_publish':
        const rate = data.exchange_rate;
        return {
          title: 'Price Feed Published',
          subtitle: `@${data.publisher}`,
          amount: rate ? `${rate.base}` : undefined,
          amountType: 'neutral',
          details: rate ? [
            { label: 'Base', value: rate.base },
            { label: 'Quote', value: rate.quote },
            { label: 'Publisher', value: `@${data.publisher}` },
          ] : [{ label: 'Publisher', value: `@${data.publisher}` }]
        };
      case 'account_witness_vote':
        return {
          title: data.approve ? `Voted for Witness` : `Removed Vote`,
          subtitle: `@${data.witness}`,
          amountType: data.approve ? 'positive' : 'negative',
          details: [
            { label: 'Account', value: `@${data.account}` },
            { label: 'Witness', value: `@${data.witness}` },
            { label: 'Action', value: data.approve ? 'Approved' : 'Removed' },
          ]
        };
      case 'account_witness_proxy':
        return {
          title: data.proxy ? `Set Voting Proxy` : 'Removed Proxy',
          subtitle: data.proxy ? `@${data.proxy}` : undefined,
          amountType: 'neutral',
          details: [
            { label: 'Account', value: `@${data.account}` },
            ...(data.proxy ? [{ label: 'Proxy', value: `@${data.proxy}` }] : []),
          ]
        };
      case 'transfer_to_savings':
        return {
          title: 'Deposited to Savings',
          subtitle: data.memo || undefined,
          amount: data.amount,
          amountType: 'neutral',
          memo: data.memo || undefined,
          details: [
            { label: 'From', value: `@${data.from}` },
            { label: 'To', value: `@${data.to}` },
            { label: 'Amount', value: data.amount },
          ]
        };
      case 'transfer_from_savings':
        return {
          title: 'Savings Withdrawal Started',
          subtitle: `Request ID: ${data.request_id}`,
          amount: data.amount,
          amountType: 'neutral',
          memo: data.memo || undefined,
          details: [
            { label: 'From', value: `@${data.from}` },
            { label: 'To', value: `@${data.to}` },
            { label: 'Request ID', value: String(data.request_id) },
          ]
        };
      case 'fill_transfer_from_savings':
        return {
          title: 'Savings Withdrawal Complete',
          subtitle: `Request ID: ${data.request_id}`,
          amount: data.amount,
          amountType: 'positive',
          details: [
            { label: 'From', value: `@${data.from}` },
            { label: 'To', value: `@${data.to}` },
            { label: 'Request ID', value: String(data.request_id) },
          ]
        };
      case 'fill_vesting_withdraw':
        return {
          title: 'Power Down Payment',
          subtitle: `@${data.from_account} → @${data.to_account}`,
          amount: data.deposited ? `${data.deposited}` : formatVestsToSP(data.withdrawn),
          amountType: 'positive',
          details: [
            { label: 'From', value: `@${data.from_account}` },
            { label: 'To', value: `@${data.to_account}` },
            { label: 'Withdrawn', value: data.withdrawn },
            ...(data.deposited ? [{ label: 'Deposited', value: data.deposited }] : []),
          ]
        };
      case 'comment_benefactor_reward':
        return {
          title: 'Benefactor Reward',
          subtitle: data.permlink ? `📝 ${data.permlink.substring(0, 35)}${data.permlink.length > 35 ? '...' : ''}` : undefined,
          amount: formatVestsToSP(data.vesting_payout || data.reward),
          amountType: 'positive',
          details: [
            { label: 'Benefactor', value: `@${data.benefactor}` },
            { label: 'Author', value: `@${data.author}` },
          ]
        };
      case 'limit_order_create':
        return {
          title: 'Limit Order Created',
          subtitle: `Order #${data.orderid}`,
          amount: data.amount_to_sell,
          amountType: 'neutral',
          details: [
            { label: 'Selling', value: data.amount_to_sell },
            { label: 'For Min', value: data.min_to_receive },
            { label: 'Order ID', value: String(data.orderid) },
          ]
        };
      case 'limit_order_cancel':
        return {
          title: 'Limit Order Cancelled',
          subtitle: `Order #${data.orderid}`,
          amountType: 'neutral',
          details: [
            { label: 'Owner', value: `@${data.owner}` },
            { label: 'Order ID', value: String(data.orderid) },
          ]
        };
      case 'fill_order':
        return {
          title: 'Order Filled',
          subtitle: `Order #${data.current_orderid}`,
          amount: data.current_pays,
          amountType: 'neutral',
          details: [
            { label: 'Paid', value: data.current_pays },
            { label: 'Received', value: data.open_pays },
          ]
        };
      case 'set_withdraw_vesting_route':
        const routePercent = (data.percent / 100).toFixed(1);
        const isRemovingRoute = data.percent === 0;
        return {
          title: isRemovingRoute ? 'Withdraw Route Removed' : 'Set Withdraw Route',
          subtitle: isRemovingRoute 
            ? `Removed route to @${data.to_account}` 
            : `${routePercent}% to @${data.to_account}`,
          amountType: isRemovingRoute ? 'negative' : 'neutral',
          details: [
            { label: 'From', value: `@${data.from_account}` },
            { label: 'To', value: `@${data.to_account}` },
            { label: 'Percent', value: `${routePercent}%` },
            { label: 'Auto Vest', value: data.auto_vest ? 'Yes' : 'No' },
          ]
        };
      default:
        // For unknown operations, try to extract useful info
        const defaultDetails: { label: string; value: string }[] = [];
        if (data.account) defaultDetails.push({ label: 'Account', value: `@${data.account}` });
        if (data.from) defaultDetails.push({ label: 'From', value: `@${data.from}` });
        if (data.to) defaultDetails.push({ label: 'To', value: `@${data.to}` });
        if (data.amount) defaultDetails.push({ label: 'Amount', value: data.amount });
        
        return {
          title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          subtitle: defaultDetails.length === 0 ? JSON.stringify(data).substring(0, 60) + '...' : undefined,
          amountType: 'neutral',
          details: defaultDetails.length > 0 ? defaultDetails : undefined
        };
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm bg-slate-950/90 border-slate-800/50">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Loading account history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm bg-slate-950/90 border-slate-800/50">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Error loading transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load transaction history: {error.message}</p>
          <Button onClick={() => refresh()} className="mt-4 bg-slate-900 border-slate-800 hover:bg-slate-800">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm bg-slate-950/90 border-slate-800/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              Financial transactions for @{account}
              {filter.operationTypes.length > 0 && (
                <span className="ml-2">
                  ({filter.operationTypes.length} operation type{filter.operationTypes.length !== 1 ? 's' : ''} selected)
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refresh()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent className="mt-4 p-4 border border-slate-800/50 rounded-lg bg-slate-950/80">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filter by Operation Type</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllFinancialOps}>
                    Select Financial
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {availableOperationTypes.map(opType => (
                  <div key={opType} className="flex items-center space-x-2">
                    <Checkbox
                      id={opType}
                      checked={filter.operationTypes.includes(opType)}
                      onCheckedChange={(checked) => handleOperationTypeToggle(opType, checked as boolean)}
                    />
                    <label htmlFor={opType} className="text-sm font-medium cursor-pointer">
                      {opType.replace(/_/g, ' ')}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>

      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center">
              <Clock className="w-8 h-8 text-slate-700" />
            </div>
            <p className="text-slate-300 text-lg font-medium">No transactions found</p>
            <p className="text-slate-500 text-sm mt-1">
              {filter.operationTypes.length > 0 
                ? 'Try adjusting your filters to see more transactions.'
                : 'Transaction history will appear here.'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {transactions.map((transaction, index) => {
                const opData = formatOperationData(transaction.type, transaction.data, account);
                const colorClass = getOperationColor(transaction.type);
                
                return (
                  <div 
                    key={`${transaction.index}-${index}`}
                    className="group relative flex items-start gap-3 p-4 rounded-lg bg-slate-950/80 hover:bg-slate-900/90 border border-slate-900/60 hover:border-slate-800 transition-all duration-200"
                  >
                    {/* Icon Container */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${colorClass} border`}>
                      {getOperationIcon(transaction.type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm">
                          {getOperationLabel(transaction.type)}
                        </span>
                        <span className="text-[10px] text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/50">
                          #{transaction.index}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200">
                        {opData.title}
                      </p>
                      {opData.subtitle && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {opData.subtitle}
                        </p>
                      )}
                      {opData.memo && (
                        <p className="text-xs text-blue-400/80 mt-1.5 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 truncate">
                          💬 {opData.memo}
                        </p>
                      )}
                      {/* Details Row */}
                      {opData.details && opData.details.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          {opData.details.slice(0, 4).map((detail, idx) => (
                            <span key={idx} className="text-xs">
                              <span className="text-slate-500">{detail.label}:</span>{' '}
                              <span className="text-slate-300">{detail.value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Amount & Time */}
                    <div className="flex-shrink-0 text-right min-w-[100px]">
                      {opData.amount && (
                        <p className={`font-bold text-sm ${
                          opData.amountType === 'positive' ? 'text-emerald-400' : 
                          opData.amountType === 'negative' ? 'text-rose-400' : 
                          'text-slate-200'
                        }`}>
                          {opData.amountType === 'positive' && '+ '}
                          {opData.amountType === 'negative' && '- '}
                          {opData.amount}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-1">
                        {formatRelativeTime(transaction.timestamp)}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {transaction.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-900">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="h-8 px-3 bg-slate-950 border-slate-800 hover:bg-slate-900"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev
                </Button>
                <div className="flex items-center gap-1 px-3 py-1 bg-slate-950 rounded-md border border-slate-900">
                  <span className="text-sm font-semibold text-white">{page}</span>
                  <span className="text-sm text-slate-600">/</span>
                  <span className="text-sm text-slate-400">{totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3 bg-slate-950 border-slate-800 hover:bg-slate-900"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  className="h-8 bg-slate-950 border-slate-800 hover:bg-slate-900"
                >
                  Load More History
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AccountHistory;
