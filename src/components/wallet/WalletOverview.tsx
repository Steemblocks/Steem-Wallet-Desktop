import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { TrendingUp, Wallet, Zap, PiggyBank, BarChart3, ArrowRight, CheckCircle2, Users, ArrowDownToLine, ArrowUpFromLine, DollarSign, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import WalletCard from "./WalletCard";
import PendingRewards from "./PendingRewards";
import PowerDownStatus from "./PowerDownStatus";
import SavingsWithdrawStatus from "./SavingsWithdrawStatus";
import AccountHistory from "./AccountHistory";
import AccountPowerMeters from "./AccountPowerMeters";
import { WalletData } from "@/contexts/WalletDataContext";
import { FormattedDelegation } from "@/contexts/WalletDataContext";
import { SteemAccount } from "@/services/steemApi";
import { priceApi, MarketPriceData } from "@/services/priceApi";
import { useIsMobile } from "@/hooks/use-mobile";
import { openExternalUrl } from "@/utils/utility";

interface WalletOverviewProps {
  selectedAccount: string;
  loggedInUser: string | null;
  accountData: SteemAccount | null;
  walletData: WalletData;
  outgoingDelegations: FormattedDelegation[];
  onTransferClick: () => void;
  onDelegationClick: () => void;
  onPowerDownClick: () => void;
  onPowerUpClick: () => void;
  onSavingsClick: (currency: 'STEEM' | 'SBD') => void;
  onWithdrawSavingsClick: () => void;
  onRefetch: () => void;
  isRefreshing?: boolean;
}

const WalletOverview = ({
  selectedAccount,
  loggedInUser,
  accountData,
  walletData,
  outgoingDelegations,
  onTransferClick,
  onDelegationClick,
  onPowerDownClick,
  onPowerUpClick,
  onSavingsClick,
  onWithdrawSavingsClick,
  onRefetch,
  isRefreshing = false
}: WalletOverviewProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const showWelcomeMessage = loggedInUser && !selectedAccount;
  
  // Check if user is viewing their own account
  const isOwnAccount = loggedInUser && selectedAccount && loggedInUser === selectedAccount;

  // Fetch CoinGecko price data independently (not part of preload)
  const { data: priceData, isLoading: isPriceLoading } = useQuery({
    queryKey: ['coingecko-prices'],
    queryFn: () => priceApi.getMarketData(),
    refetchInterval: 60000, // Refresh every 60 seconds (prices don't change that fast)
    staleTime: 30000, // Consider stale after 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Default market data for fallback
  const defaultMarketData: MarketPriceData = {
    price: 0,
    priceChange24h: 0,
    marketCap: 0,
    volume24h: 0,
    high24h: 0,
    low24h: 0,
    image: '',
    lastUpdated: new Date().toISOString()
  };

  // Use CoinGecko data if available, fallback to defaults
  const steemMarketData = priceData?.steem || defaultMarketData;
  const sbdMarketData = priceData?.sbd || defaultMarketData;
  const steemPrice = steemMarketData.price || 0.25;
  const sbdPrice = sbdMarketData.price || 1.0;

  // Calculate USD values based on CoinGecko prices
  const steemBalanceUsd = parseFloat(walletData.steem) * steemPrice;
  const steemPowerUsd = parseFloat(walletData.steemPower) * steemPrice;
  const sbdBalanceUsd = parseFloat(walletData.sbd) * sbdPrice;
  const savingsSteemUsd = parseFloat(walletData.savings.steem) * steemPrice;
  const savingsSbdUsd = parseFloat(walletData.savings.sbd) * sbdPrice;
  const totalUsdValue = steemBalanceUsd + steemPowerUsd + sbdBalanceUsd + savingsSteemUsd + savingsSbdUsd;

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      {showWelcomeMessage && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-steemit-500 to-steemit-600 text-white shadow-lg">
          {/* Decorative elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mb-32"></div>
          </div>
          
          <div className="relative px-8 py-10 sm:px-10 sm:py-12">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold text-white/80">Account Active</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold">Welcome back, @{loggedInUser}!</h2>
              </div>
            </div>
            <p className="text-white/90 mb-6 max-w-2xl leading-relaxed">
              Your wallet is ready to manage your Steem assets. View your account details, manage delegations, and track your portfolio performance.
            </p>
            <Button 
              onClick={() => navigate(`/@${loggedInUser}`)}
              className="bg-slate-900 text-steemit-400 hover:bg-slate-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              size="lg"
            >
              View My Wallet
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick Actions & Price Info */}
      {selectedAccount && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Prices - Redesigned */}
          <Card className="lg:col-span-2 overflow-hidden border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm h-full">
            <CardContent className="p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-steemit-500" />
                  <span className="text-sm font-medium text-slate-300">Market Overview</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">Live</span>
                  </div>
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" style={{ animationDuration: '5s' }} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* STEEM Price Card */}
                <div className="rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/40 p-4 relative overflow-hidden">
                  {/* Subtle gradient accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-steemit-500/5 rounded-full -mr-12 -mt-12" />
                  
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img 
                            src="/steem-icon.png" 
                            alt="STEEM" 
                            className="w-10 h-10"
                          />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white">STEEM</h4>
                          <p className="text-[11px] text-slate-500">Steem</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/20">
                            BUY
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-slate-900/95 border-slate-700/50 backdrop-blur-sm">
                          <DropdownMenuLabel className="text-slate-300">Buy STEEM on Exchanges</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-slate-700/50" />
                          <DropdownMenuItem
                            onClick={() => openExternalUrl("https://www.binance.com/en/trade/STEEM_USDT?type=spot")}
                            className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                          >
                            <span>Binance</span>
                            <ExternalLink className="w-3 h-3" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openExternalUrl("https://upbit.com/exchange?code=CRIX.UPBIT.KRW-STEEM")}
                            className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                          >
                            <span>Upbit</span>
                            <ExternalLink className="w-3 h-3" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openExternalUrl("https://www.gate.com/trade/STEEM_USDT")}
                            className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                          >
                            <span>Gate.io</span>
                            <ExternalLink className="w-3 h-3" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openExternalUrl("https://www.mexc.com/exchange/STEEM_USDT")}
                            className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                          >
                            <span>MEXC</span>
                            <ExternalLink className="w-3 h-3" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openExternalUrl("https://www.htx.com/trade/steem_usdt")}
                            className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                          >
                            <span>HTX</span>
                            <ExternalLink className="w-3 h-3" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openExternalUrl("https://www.poloniex.com/trade/STEEM_USDT?type=spot")}
                            className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                          >
                            <span>Poloniex</span>
                            <ExternalLink className="w-3 h-3" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Price */}
                    <div className="mb-3">
                      <p className="text-3xl font-bold text-white tracking-tight">${steemPrice.toFixed(4)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${steemMarketData.priceChange24h >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {steemMarketData.priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(steemMarketData.priceChange24h).toFixed(2)}%
                        </span>
                        <span className="text-[11px] text-slate-500">24h</span>
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700/50">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Market Cap</span>
                        <p className="text-sm font-semibold text-slate-200">
                          ${steemMarketData.marketCap >= 1000000 
                            ? (steemMarketData.marketCap / 1000000).toFixed(2) + 'M'
                            : steemMarketData.marketCap.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">24h Volume</span>
                        <p className="text-sm font-semibold text-slate-200">
                          ${steemMarketData.volume24h >= 1000000 
                            ? (steemMarketData.volume24h / 1000000).toFixed(2) + 'M'
                            : steemMarketData.volume24h >= 1000
                            ? (steemMarketData.volume24h / 1000).toFixed(1) + 'K'
                            : steemMarketData.volume24h.toFixed(0)}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">24h High</span>
                        <p className="text-sm font-semibold text-emerald-400">${steemMarketData.high24h.toFixed(4)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">24h Low</span>
                        <p className="text-sm font-semibold text-red-400">${steemMarketData.low24h.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* SBD Price Card */}
                <div className="rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/40 p-4 relative overflow-hidden">
                  {/* Subtle gradient accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12" />
                  
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 flex items-center justify-center border border-emerald-500/20">
                          <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white">SBD</h4>
                          <p className="text-[11px] text-slate-500">Steem Dollars</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/20">
                            BUY
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-slate-900/95 border-slate-700/50 backdrop-blur-sm">
                          <DropdownMenuLabel className="text-slate-300">Buy SBD on Exchanges</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-slate-700/50" />
                          <DropdownMenuItem asChild>
                            <a
                              href="https://www.htx.com/trade/sbd_usdt"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                            >
                              <span>HTX</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href="https://steemitwallet.com/market"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between cursor-pointer text-slate-200 hover:text-white"
                            >
                              <span>Steemit Wallet</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Price */}
                    <div className="mb-3">
                      <p className="text-3xl font-bold text-white tracking-tight">${sbdPrice.toFixed(4)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${sbdMarketData.priceChange24h >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {sbdMarketData.priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(sbdMarketData.priceChange24h).toFixed(2)}%
                        </span>
                        <span className="text-[11px] text-slate-500">24h</span>
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700/50">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Market Cap</span>
                        <p className="text-sm font-semibold text-slate-200">
                          ${sbdMarketData.marketCap >= 1000000 
                            ? (sbdMarketData.marketCap / 1000000).toFixed(2) + 'M'
                            : sbdMarketData.marketCap.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">24h Volume</span>
                        <p className="text-sm font-semibold text-slate-200">
                          ${sbdMarketData.volume24h >= 1000000 
                            ? (sbdMarketData.volume24h / 1000000).toFixed(2) + 'M'
                            : sbdMarketData.volume24h >= 1000
                            ? (sbdMarketData.volume24h / 1000).toFixed(1) + 'K'
                            : sbdMarketData.volume24h.toFixed(0)}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">24h High</span>
                        <p className="text-sm font-semibold text-emerald-400">${sbdMarketData.high24h.toFixed(4)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">24h Low</span>
                        <p className="text-sm font-semibold text-red-400">${sbdMarketData.low24h.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Power Status - Voting Power, Downvote Power, RC */}
          {selectedAccount && (
            <AccountPowerMeters username={selectedAccount} />
          )}
        </div>
      )}

      {/* Pending Rewards */}
      {selectedAccount && accountData && (
        <PendingRewards 
          account={accountData} 
          onUpdate={onRefetch} 
        />
      )}

      {/* Main Wallet Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-steemit-500" />
          <h3 className="text-xl font-bold text-white">Your Assets</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* STEEM Card */}
          <WalletCard
            title="STEEM"
            description="Liquid tokens • Tradeable"
            amount={walletData.steem}
            currency="STEEM"
            variant="steem"
            icon={<img src="/steem-icon.png" alt="STEEM" className="w-5 h-5" />}
            subtitle={`≈ $${steemBalanceUsd.toFixed(2)} USD`}
            priceChange={steemMarketData.priceChange24h}
            actionButton={isOwnAccount ? (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTransferClick}
                  className="text-xs flex items-center justify-center gap-1 bg-steemit-500/10 border-steemit-500/30 text-steemit-400 hover:bg-steemit-500/20 hover:text-steemit-300 hover:border-steemit-500/50"
                >
                  <ArrowRight className="w-3 h-3" />
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPowerUpClick}
                  className="text-xs flex items-center justify-center gap-1 bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50"
                >
                  <Zap className="w-3 h-3" />
                  Power Up
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSavingsClick('STEEM')}
                  className="text-xs flex items-center justify-center gap-1 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/50"
                >
                  <PiggyBank className="w-3 h-3" />
                  Save
                </Button>
              </div>
            ) : undefined}
          />

          {/* STEEM POWER Card */}
          <WalletCard
            title="STEEM POWER"
            description="Influence & voting strength"
            amount={walletData.steemPower}
            currency="SP"
            variant="sp"
            icon={<Zap className="w-5 h-5" />}
            subtitle={`+${walletData.received} received • -${walletData.delegated} delegated • ≈ $${steemPowerUsd.toFixed(2)} USD`}
            headerAction={
              isOwnAccount ? (
                <button
                  onClick={onPowerDownClick}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition-all duration-200"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300" />
                  <span className="text-xs font-medium text-red-400 group-hover:text-red-300">Power Down</span>
                </button>
              ) : undefined
            }
            actionButton={
              outgoingDelegations && outgoingDelegations.length > 0 ? (
                <button
                  onClick={onDelegationClick}
                  className="group w-full relative overflow-hidden rounded-lg bg-slate-900/60 border border-blue-500/30 p-3 transition-all duration-300 hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
                          <Users className="w-3 h-3 text-blue-400" />
                        </div>
                        <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-xs font-bold text-white">
                          {outgoingDelegations.length}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                        Active Delegations
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ) : undefined
            }
          />

          {/* STEEM DOLLARS Card */}
          <WalletCard
            title="STEEM DOLLARS"
            description="Stable value tokens"
            amount={walletData.sbd}
            currency="SBD"
            variant="sbd"
            icon={<DollarSign className="w-5 h-5" />}
            subtitle={`≈ $${sbdBalanceUsd.toFixed(2)} USD`}
            priceChange={sbdMarketData.priceChange24h}
            actionButton={isOwnAccount ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTransferClick}
                  className="text-xs flex items-center justify-center gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/50"
                >
                  <ArrowRight className="w-3 h-3" />
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSavingsClick('SBD')}
                  className="text-xs flex items-center justify-center gap-1 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/50"
                >
                  <PiggyBank className="w-3 h-3" />
                  Save
                </Button>
              </div>
            ) : undefined}
          />

          {/* SAVINGS Card */}
          <WalletCard
            title="SAVINGS"
            description="3-day withdrawal protection"
            amount={walletData.savings.steem}
            currency="STEEM"
            variant="savings"
            icon={<PiggyBank className="w-5 h-5" />}
            secondaryAmount={walletData.savings.sbd}
            secondaryCurrency="SBD"
            subtitle={`Total ≈ $${(savingsSteemUsd + savingsSbdUsd).toFixed(2)} USD`}
            headerAction={
              isOwnAccount ? (
                <button
                  onClick={onWithdrawSavingsClick}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all duration-200"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />
                  <span className="text-xs font-medium text-amber-400 group-hover:text-amber-300">Withdraw</span>
                </button>
              ) : undefined
            }
          />

          {/* Estimated Account Value - Spanning */}
          <Card className="md:col-span-2 overflow-hidden shadow-md border-0 bg-gradient-to-br from-green-950/50 to-emerald-950/50 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div>
                  <CardTitle className="text-lg text-white">Portfolio Value</CardTitle>
                  <CardDescription className="text-slate-400">Total account worth in USD</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-5xl font-bold text-green-500">${totalUsdValue.toFixed(2)}</p>
                <p className="text-sm text-slate-400">Based on current market prices</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Power Down Status */}
      {selectedAccount && accountData && (
        <PowerDownStatus 
          account={accountData} 
          onUpdate={onRefetch} 
        />
      )}

      {/* Savings Withdraw Status */}
      {selectedAccount && accountData && (
        <SavingsWithdrawStatus 
          account={accountData} 
          onUpdate={onRefetch} 
        />
      )}

      {/* Transaction History */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-steemit-500" />
          <h3 className="text-xl font-bold text-white">Recent Activity</h3>
        </div>
        
        {selectedAccount ? (
          <AccountHistory account={selectedAccount} />
        ) : (
          <Card className="overflow-hidden shadow-md border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50">
            <CardContent className="pt-12 pb-12">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-8 h-8 text-slate-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">No Activity Yet</h3>
                  <p className="text-slate-400 max-w-xs mx-auto">
                    {loggedInUser ? `Logged in as @${loggedInUser}` : 'Enter a username above to load account data and view transactions'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WalletOverview;
