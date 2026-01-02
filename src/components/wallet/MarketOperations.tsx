
import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, BarChart3, DollarSign, Clock, Wallet, ArrowRightLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMarketData } from "@/hooks/useMarketData";
import { steemApi } from "@/services/steemApi";
import { steemOperations } from "@/services/steemOperations";
import { useWalletData } from "@/contexts/WalletDataContext";
import { getDecryptedKey } from "@/hooks/useSecureKeys";
import { SecureStorageFactory } from "@/services/secureStorage";
import * as dsteem from 'dsteem';
import MarketDepthChart from "./MarketDepthChart";
import MarketCharts from "./MarketCharts";

const MarketOperations = () => {
  const [tradeType, setTradeType] = useState("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const { toast } = useToast();
  const { orderBook, ticker, volume, tradeHistory, hourlyHistory, isLoading, error } = useMarketData();
  const { data: walletData, refreshAll } = useWalletData();

  // Get user's available balances
  const availableSteem = parseFloat(walletData?.walletData?.steem || "0");
  const availableSbd = parseFloat(walletData?.walletData?.sbd || "0");

  // Quick percentage helpers
  const setAmountPercentage = (percentage: number) => {
    if (tradeType === "sell") {
      // Selling STEEM - use STEEM balance
      const maxAmount = availableSteem * (percentage / 100);
      setAmount(maxAmount.toFixed(3));
    } else {
      // Buying STEEM - calculate from SBD balance and price
      const currentPrice = parseFloat(price) || parseFloat(ticker?.latest || "0");
      if (currentPrice > 0) {
        const maxSteem = (availableSbd * (percentage / 100)) / currentPrice;
        setAmount(maxSteem.toFixed(3));
      }
    }
  };

  const handleTradeOrder = async () => {
    if (!amount || !price) return;
    
    // Prevent duplicate submissions
    if (submittedRef.current || isSubmitting) {
      console.log('Blocking duplicate trade submission');
      return;
    }
    
    submittedRef.current = true;
    setIsSubmitting(true);

    try {
      // Get logged in user
      const storage = SecureStorageFactory.getInstance();
      const username = await storage.getItem('steem_username');
      
      if (!username) {
        toast({
          title: "Login Required",
          description: "Please log in to place trade orders",
          variant: "destructive",
        });
        return;
      }

      // Get the active key
      const activeKeyString = await getDecryptedKey(username, 'active');
      if (!activeKeyString) {
        toast({
          title: "Key Required",
          description: "Active key is required to place trade orders",
          variant: "destructive",
        });
        return;
      }

      const activeKey = dsteem.PrivateKey.fromString(activeKeyString);
      
      // Parse amounts
      const steemAmount = parseFloat(amount);
      const sbdPrice = parseFloat(price);
      const sbdAmount = steemAmount * sbdPrice;

      // Validate balances
      if (tradeType === "buy" && sbdAmount > availableSbd) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${sbdAmount.toFixed(3)} SBD but only have ${availableSbd.toFixed(3)} SBD`,
          variant: "destructive",
        });
        return;
      }
      
      if (tradeType === "sell" && steemAmount > availableSteem) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${steemAmount.toFixed(3)} STEEM but only have ${availableSteem.toFixed(3)} STEEM`,
          variant: "destructive",
        });
        return;
      }

      // Generate unique order ID based on timestamp
      const orderid = Math.floor(Date.now() / 1000);
      
      // Set expiration to 27 days from now (max is 28 days, use 27 for safety margin)
      const expiration = new Date(Date.now() + 27 * 24 * 60 * 60 * 1000);
      const expirationStr = expiration.toISOString().slice(0, 19);

      // Prepare amounts based on trade type
      let amountToSell: string;
      let minToReceive: string;

      if (tradeType === "buy") {
        // Buying STEEM: selling SBD, receiving STEEM
        amountToSell = `${sbdAmount.toFixed(3)} SBD`;
        minToReceive = `${steemAmount.toFixed(3)} STEEM`;
      } else {
        // Selling STEEM: selling STEEM, receiving SBD
        amountToSell = `${steemAmount.toFixed(3)} STEEM`;
        minToReceive = `${sbdAmount.toFixed(3)} SBD`;
      }

      // Broadcast the limit order
      await steemOperations.createLimitOrder(
        username,
        orderid,
        amountToSell,
        minToReceive,
        false, // fill_or_kill = false (allow partial fills)
        expirationStr,
        activeKey
      );

      toast({
        title: `${tradeType === "buy" ? "Buy" : "Sell"} Order Placed`,
        description: `Successfully placed order to ${tradeType === "buy" ? "buy" : "sell"} ${steemAmount.toFixed(3)} STEEM at ${sbdPrice.toFixed(6)} SBD/STEEM`,
        variant: "success",
      });
      
      setAmount("");
      setPrice("");
      
      // Refresh wallet data
      refreshAll();
      
    } catch (error: any) {
      console.error('Trade order error:', error);
      
      // Check for app lock / password not available
      const isLockError = error?.message?.includes('No password available') || 
                          error?.message?.includes('unlock the app') ||
                          error?.message?.includes('Please unlock');
      if (isLockError) {
        toast({
          title: "App Locked",
          description: "Please unlock the app to place trade orders",
          variant: "destructive",
        });
        return;
      }
      
      // Check for duplicate transaction
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Order Already Placed",
          description: "This order was already submitted",
          variant: "success",
        });
        setAmount("");
        setPrice("");
      } else {
        toast({
          title: "Order Failed",
          description: error?.message || error?.jse_shortmsg || "Failed to place order",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
      submittedRef.current = false;
    }
  };

  // Helper function to format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate current market stats
  const currentPrice = ticker?.latest ? parseFloat(ticker.latest) : 0;
  const percentChange = ticker?.percent_change ? parseFloat(ticker.percent_change) : 0;
  const steemVolume = volume?.steem_volume || "0";
  const sbdVolume = volume?.sbd_volume || "0";

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-slate-800/50 border border-slate-700 shadow-sm">
              <CardContent className="p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-slate-700 rounded w-20"></div>
                  <div className="h-8 bg-slate-700 rounded w-16"></div>
                </div>
              </CardContent>
            </Card>
          ))}
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
              <p>Error loading market data</p>
              <p className="text-sm text-slate-400 mt-2">Please check console for details</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Market Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400">STEEM Price</p>
                <p className="text-lg sm:text-2xl font-bold" style={{ color: '#07d7a9' }}>
                  {steemApi.formatMarketPrice(ticker?.latest || "0")} SBD
                </p>
              </div>
              {percentChange >= 0 ? (
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
              )}
            </div>
            <p className={`text-xs mt-1 ${percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}% (24h)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400">Spread</p>
                <p className="text-lg sm:text-2xl font-bold text-white">
                  {ticker ? ((parseFloat(ticker.lowest_ask) - parseFloat(ticker.highest_bid)) * 100 / parseFloat(ticker.highest_bid)).toFixed(2) : '0.00'}%
                </p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#07d7a9' }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Bid: {steemApi.formatMarketPrice(ticker?.highest_bid || "0")} SBD
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400">24h Volume</p>
                <p className="text-lg sm:text-2xl font-bold text-white">{steemVolume} STEEM</p>
              </div>
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            </div>
            <p className="text-xs text-slate-400 mt-1">{sbdVolume} SBD</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400">Ask Price</p>
                <p className="text-lg sm:text-2xl font-bold text-red-400">
                  {steemApi.formatMarketPrice(ticker?.lowest_ask || "0")} SBD
                </p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Lowest sell order
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Market Charts */}
      <MarketCharts hourlyHistory={hourlyHistory} ticker={ticker} />

      {/* Market Depth Chart */}
      <MarketDepthChart orderBook={orderBook} />

      <Tabs defaultValue="trade" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-0 bg-transparent gap-0 rounded-xl overflow-hidden border border-slate-700/50">
          <TabsTrigger 
            value="trade" 
            className="relative py-3.5 px-4 text-sm sm:text-base font-semibold rounded-none border-r border-slate-700/50 transition-all duration-200
              data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#07d7a9] data-[state=active]:to-[#06c49a] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#07d7a9]/20
              data-[state=inactive]:bg-slate-800/60 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-slate-700/80"
          >
            <BarChart3 className="w-4 h-4 mr-2 inline-block" />
            Trade
          </TabsTrigger>
          <TabsTrigger 
            value="orderbook" 
            className="relative py-3.5 px-4 text-sm sm:text-base font-semibold rounded-none border-r border-slate-700/50 transition-all duration-200
              data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#07d7a9] data-[state=active]:to-[#06c49a] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#07d7a9]/20
              data-[state=inactive]:bg-slate-800/60 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-slate-700/80"
          >
            <DollarSign className="w-4 h-4 mr-2 inline-block" />
            Order Book
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="relative py-3.5 px-4 text-sm sm:text-base font-semibold rounded-none transition-all duration-200
              data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#07d7a9] data-[state=active]:to-[#06c49a] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#07d7a9]/20
              data-[state=inactive]:bg-slate-800/60 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-slate-700/80"
          >
            <Clock className="w-4 h-4 mr-2 inline-block" />
            Trade History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trade" className="space-y-4 mt-4">
          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm overflow-hidden">
            {/* Buy/Sell Toggle Header */}
            <div className="grid grid-cols-2 border-b border-slate-700">
              <button
                onClick={() => setTradeType("buy")}
                className={`py-4 text-center font-semibold text-base transition-all ${
                  tradeType === "buy" 
                    ? "bg-green-600/20 text-green-400 border-b-2 border-green-500" 
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                }`}
              >
                <TrendingUp className="w-4 h-4 inline-block mr-2" />
                Buy STEEM
              </button>
              <button
                onClick={() => setTradeType("sell")}
                className={`py-4 text-center font-semibold text-base transition-all ${
                  tradeType === "sell" 
                    ? "bg-red-600/20 text-red-400 border-b-2 border-red-500" 
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                }`}
              >
                <TrendingDown className="w-4 h-4 inline-block mr-2" />
                Sell STEEM
              </button>
            </div>

            <CardContent className="p-5 space-y-5">
              {/* Available Balance Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg border ${tradeType === "buy" ? "bg-blue-950/30 border-blue-800/50" : "bg-slate-800/50 border-slate-700"}`}>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Wallet className="w-3 h-3" />
                    Available SBD
                  </div>
                  <div className="text-lg font-bold text-white">
                    {availableSbd.toFixed(3)} <span className="text-sm text-slate-400">SBD</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${tradeType === "sell" ? "bg-blue-950/30 border-blue-800/50" : "bg-slate-800/50 border-slate-700"}`}>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Wallet className="w-3 h-3" />
                    Available STEEM
                  </div>
                  <div className="text-lg font-bold text-white">
                    {availableSteem.toFixed(3)} <span className="text-sm text-slate-400">STEEM</span>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="trade-amount" className="text-sm font-medium text-slate-300">
                    Amount (STEEM)
                  </Label>
                  <div className="flex gap-1">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setAmountPercentage(pct)}
                        className="px-2 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                      >
                        {pct === 100 ? "MAX" : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <Input
                    id="trade-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.000"
                    className="bg-slate-900 border-slate-600 text-white text-lg h-12 pr-20 focus:border-[#07d7a9] focus:ring-[#07d7a9]/20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                    STEEM
                  </div>
                </div>
              </div>

              {/* Price Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="trade-price" className="text-sm font-medium text-slate-300">
                    Price per STEEM
                  </Label>
                  <button
                    onClick={() => setPrice(parseFloat(ticker?.latest || "0").toFixed(6))}
                    className="text-xs text-[#07d7a9] hover:text-[#06c49a] transition-colors flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    Market Price
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="trade-price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.000000"
                    step="0.000001"
                    className="bg-slate-900 border-slate-600 text-white text-lg h-12 pr-16 focus:border-[#07d7a9] focus:ring-[#07d7a9]/20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                    SBD
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="rounded-lg bg-slate-900/80 border border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                  <span className="text-sm font-medium text-slate-300">Order Summary</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">
                      {tradeType === "buy" ? "You Pay" : "You Sell"}
                    </span>
                    <span className="text-base font-semibold text-white">
                      {tradeType === "buy" 
                        ? `${amount && price ? (parseFloat(amount) * parseFloat(price)).toFixed(3) : "0.000"} SBD`
                        : `${amount || "0.000"} STEEM`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">
                      {tradeType === "buy" ? "You Receive" : "You Receive"}
                    </span>
                    <span className="text-base font-semibold" style={{ color: '#07d7a9' }}>
                      {tradeType === "buy" 
                        ? `${amount || "0.000"} STEEM`
                        : `${amount && price ? (parseFloat(amount) * parseFloat(price)).toFixed(3) : "0.000"} SBD`
                      }
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-700">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Market Price</span>
                      <span className="text-slate-400">
                        1 STEEM = {parseFloat(ticker?.latest || "0").toFixed(6)} SBD
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Place Order Button - Temporarily disabled while market trading is being improved */}
              <Button 
                onClick={handleTradeOrder} 
                className={`w-full h-12 text-white text-base font-semibold transition-all ${
                  tradeType === "buy" 
                    ? "bg-green-600 hover:bg-green-500 shadow-lg shadow-green-600/20" 
                    : "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={true} // Temporarily disabled - market trading under development
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : tradeType === "buy" ? (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Place Buy Order (Under Maintenance)
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Place Sell Order (Under Maintenance)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orderbook" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-green-400 text-lg sm:text-xl">Buy Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm font-medium text-slate-400 pb-2 border-b border-slate-700">
                    <span>Price (SBD)</span>
                    <span className="text-right">STEEM</span>
                    <span className="text-right">SBD</span>
                  </div>
                  {orderBook?.bids?.slice(0, 15).map((order, index) => {
                    const formatted = steemApi.formatOrderBookEntry(order);
                    return (
                      <div key={index} className="grid grid-cols-3 gap-2 text-xs sm:text-sm py-1 hover:bg-slate-700/50 rounded">
                        <span className="text-green-400 font-medium">
                          {formatted.price}
                        </span>
                        <span className="text-right text-white">{formatted.steem}</span>
                        <span className="text-right text-slate-400">{formatted.sbd}</span>
                      </div>
                    );
                  }) || (
                    <div className="text-center text-slate-400 py-4">Loading buy orders...</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-red-400 text-lg sm:text-xl">Sell Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm font-medium text-slate-400 pb-2 border-b border-slate-700">
                    <span>Price (SBD)</span>
                    <span className="text-right">STEEM</span>
                    <span className="text-right">SBD</span>
                  </div>
                  {orderBook?.asks?.slice(0, 15).map((order, index) => {
                    const formatted = steemApi.formatOrderBookEntry(order);
                    return (
                      <div key={index} className="grid grid-cols-3 gap-2 text-xs sm:text-sm py-1 hover:bg-slate-700/50 rounded">
                        <span className="text-red-400 font-medium">
                          {formatted.price}
                        </span>
                        <span className="text-right text-white">{formatted.steem}</span>
                        <span className="text-right text-slate-400">{formatted.sbd}</span>
                      </div>
                    );
                  }) || (
                    <div className="text-center text-slate-400 py-4">Loading sell orders...</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Trades
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm sm:text-base">
                Latest STEEM/SBD market trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Time</TableHead>
                      <TableHead className="text-xs sm:text-sm text-right">Price (SBD)</TableHead>
                      <TableHead className="text-xs sm:text-sm text-right">STEEM</TableHead>
                      <TableHead className="text-xs sm:text-sm text-right">Total (SBD)</TableHead>
                      <TableHead className="text-xs sm:text-sm text-center">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tradeHistory.slice(0, 20).map((trade, index) => (
                      <TableRow key={index} className="hover:bg-slate-700/50">
                        <TableCell className="text-xs sm:text-sm text-slate-400">
                          {formatTimeAgo(trade.date)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-right font-medium text-white">
                          {trade.price.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-right text-white">
                          {trade.steemAmount.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-right text-white">
                          {trade.sbdAmount.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            trade.type === 'sell' 
                              ? 'bg-red-900/50 text-red-400' 
                              : 'bg-green-900/50 text-green-400'
                          }`}>
                            {trade.type.toUpperCase()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tradeHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-400 py-4">
                          Loading trade history...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketOperations;
