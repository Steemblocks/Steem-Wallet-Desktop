import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SavingsOperations = () => {
  const [transferAmount, setTransferAmount] = useState("");
  const [transferCurrency, setTransferCurrency] = useState("STEEM");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState("STEEM");
  const { toast } = useToast();

  const handleTransferToSavings = () => {
    if (!transferAmount) return;
    toast({
      title: "Transfer to Savings",
      description: `Moving ${transferAmount} ${transferCurrency} to savings`,
    });
    setTransferAmount("");
  };

  const handleWithdrawFromSavings = () => {
    if (!withdrawAmount) return;
    toast({
      title: "Withdrawal Initiated",
      description: `Withdrawing ${withdrawAmount} ${withdrawCurrency} from savings (3-day delay)`,
    });
    setWithdrawAmount("");
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-white">Savings Overview</CardTitle>
          <CardDescription className="text-slate-400">
            Secure your assets with a 3-day withdrawal delay for added security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-900/50">
              <h3 className="font-medium text-white mb-2">STEEM Savings</h3>
              <p className="text-2xl font-bold text-steemit-500">500.000</p>
              <p className="text-sm text-slate-400">Secured STEEM</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/50">
              <h3 className="font-medium text-white mb-2">SBD Savings</h3>
              <p className="text-2xl font-bold text-steemit-500">200.000</p>
              <p className="text-sm text-slate-400">Secured SBD</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="deposit" className="data-[state=active]:bg-steemit-500 data-[state=active]:text-white">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw" className="data-[state=active]:bg-steemit-500 data-[state=active]:text-white">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="space-y-4">
          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-steemit-500" />
                Transfer to Savings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Move funds to savings for enhanced security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transfer-amount" className="text-slate-300">Amount</Label>
                  <Input
                    id="transfer-amount"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.000"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transfer-currency" className="text-slate-300">Currency</Label>
                  <Select value={transferCurrency} onValueChange={setTransferCurrency}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="STEEM">STEEM</SelectItem>
                      <SelectItem value="SBD">SBD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-sm text-slate-400">
                Available: {transferCurrency === "STEEM" ? "1,250.000 STEEM" : "425.750 SBD"}
              </p>
              
              <div className="p-4 rounded-lg border bg-steemit-950/30 border-steemit-700">
                <h4 className="font-medium mb-2 text-steemit-400">💡 Savings Benefits:</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Enhanced security with 3-day withdrawal delay</li>
                  <li>• Protection against unauthorized access</li>
                  <li>• Instant deposits, delayed withdrawals</li>
                  <li>• No fees for savings operations</li>
                </ul>
              </div>

              <Button 
                onClick={handleTransferToSavings} 
                className="w-full text-white bg-steemit-500 hover:bg-steemit-600"
                disabled={!transferAmount}
              >
                Transfer to Savings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-4">
          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white">Withdraw from Savings</CardTitle>
              <CardDescription className="text-slate-400">
                Withdraw funds from savings (3-day processing time)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount" className="text-slate-300">Amount</Label>
                  <Input
                    id="withdraw-amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.000"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="withdraw-currency" className="text-slate-300">Currency</Label>
                  <Select value={withdrawCurrency} onValueChange={setWithdrawCurrency}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="STEEM">STEEM</SelectItem>
                      <SelectItem value="SBD">SBD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-sm text-slate-400">
                Available: {withdrawCurrency === "STEEM" ? "500.000 STEEM" : "200.000 SBD"} in savings
              </p>

              <div className="bg-yellow-900/30 border border-yellow-700 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-300 mb-2">⏰ Withdrawal Process:</h4>
                <ul className="text-sm text-yellow-200 space-y-1">
                  <li>• 3-day security delay before funds are released</li>
                  <li>• You can cancel withdrawal during this period</li>
                  <li>• Funds will appear in your main balance after 3 days</li>
                </ul>
              </div>

              <Button 
                onClick={handleWithdrawFromSavings} 
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                disabled={!withdrawAmount}
              >
                Initiate Withdrawal
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white">Pending Withdrawals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-slate-400">No pending withdrawals</p>
                <p className="text-sm text-slate-500 mt-2">All your savings are secure</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SavingsOperations;
