
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, Lock, Trash2, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
import { steemApi } from '@/services/steemApi';
import { SecureStorageFactory } from '@/services/secureStorage';
import { getDecryptedKey } from '@/hooks/useSecureKeys';

const WithdrawRouteOperations = () => {
  const [recipient, setRecipient] = useState("");
  const [percentage, setPercentage] = useState(0);
  const [autoVest, setAutoVest] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRoutes, setCurrentRoutes] = useState<any[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  
  const [username, setUsername] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const { toast } = useToast();
  
  // CRITICAL: Track transaction submission to prevent duplicate transactions
  const setRouteSubmittedRef = useRef(false);
  const removeRouteSubmittedRef = useRef<Set<string>>(new Set());

  // Load username from secure storage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        setUsername(user);
        setIsLoggedIn(!!user);
      } catch (error) {
        console.error('Error loading user data from storage:', error);
      }
    };
    loadUserData();
  }, []);

  const loadWithdrawRoutes = async () => {
    if (!username) return;
    
    setIsLoadingRoutes(true);
    try {
      const routes = await steemApi.getWithdrawVestingRoutes(username);
      setCurrentRoutes(routes);
    } catch (error) {
      console.error('Error loading withdraw routes:', error);
      // Continue with empty routes instead of showing error
      setCurrentRoutes([]);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  const handleSetWithdrawRoute = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Authentication Required",
        description: "Please log in to manage withdraw routes.",
        variant: "destructive",
      });
      return;
    }

    if (!recipient.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient account",
        variant: "destructive",
      });
      return;
    }

    if (percentage < 0 || percentage > 100) {
      toast({
        title: "Invalid Percentage",
        description: "Percentage must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    // CRITICAL: Prevent duplicate submissions
    if (setRouteSubmittedRef.current || isProcessing) {
      console.log('Blocking duplicate set withdraw route submission');
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    setRouteSubmittedRef.current = true;
    setIsProcessing(true);

    try {
      // Convert percentage to basis points (Steem uses 0-10000, where 10000 = 100%)
      const basisPoints = Math.round(percentage * 100);
      
      const operation = {
        from_account: username!,
        to_account: recipient.trim(),
        percent: basisPoints,
        auto_vest: autoVest
      };

      console.log('Setting withdraw route with operation:', operation);

      await handlePrivateKeyOperation(username!, operation, 'set');
    } catch (error: any) {
      console.error('Withdraw route error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Route Already Set",
          description: "This withdraw route was already configured.",
          variant: "success",
        });
        setRecipient("");
        setPercentage(0);
        setAutoVest(false);
        setTimeout(() => loadWithdrawRoutes(), 2000);
      } else {
        toast({
          title: "Route Configuration Failed",
          description: "Unable to set withdraw route. Please try again.",
          variant: "destructive",
        });
        setRouteSubmittedRef.current = false;
      }
      setIsProcessing(false);
    }
  };

  const handleRemoveRoute = async (toAccount: string) => {
    if (!isLoggedIn || !username) return;

    // CRITICAL: Prevent duplicate submissions for the same route
    if (removeRouteSubmittedRef.current.has(toAccount) || isProcessing) {
      console.log('Blocking duplicate remove route submission for:', toAccount);
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    removeRouteSubmittedRef.current.add(toAccount);
    setIsProcessing(true);

    try {
      const operation = {
        from_account: username,
        to_account: toAccount,
        percent: 0, // Set to 0 to remove route
        auto_vest: false
      };

      console.log('Removing withdraw route with operation:', operation);

      await handlePrivateKeyOperation(username, operation, 'remove');
    } catch (error: any) {
      console.error('Remove route error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Route Already Removed",
          description: "This withdraw route was already removed.",
          variant: "success",
        });
        setTimeout(() => loadWithdrawRoutes(), 2000);
      } else {
        toast({
          title: "Route Removal Failed",
          description: "Unable to remove withdraw route. Please try again.",
          variant: "destructive",
        });
        removeRouteSubmittedRef.current.delete(toAccount);
      }
      setIsProcessing(false);
    }
  };

  const handlePrivateKeyOperation = async (username: string, operation: any, action: 'set' | 'remove') => {
    // Get decrypted key from secure storage
    const privateKeyString = await getDecryptedKey(username, 'active');
    if (!privateKeyString) {
      toast({
        title: "Active Key Required",
        description: "An active key is required to manage withdraw routes. Please import your key in Account settings.",
        variant: "destructive",
      });
      if (action === 'set') {
        setRouteSubmittedRef.current = false;
      } else {
        removeRouteSubmittedRef.current.delete(operation.to_account);
      }
      setIsProcessing(false);
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      
      const result = await steemOperations.setWithdrawVestingRoute(operation, privateKey);
      
      if (operation.percent === 0) {
        toast({
          title: "Route Removed",
          description: `Withdraw route to @${operation.to_account} has been removed`,
          variant: "success",
        });
      } else {
        toast({
          title: "Withdraw Route Set",
          description: `${(operation.percent / 100).toFixed(1)}% of power down will go to @${operation.to_account}${operation.auto_vest ? ' (auto-vested)' : ''}`,
          variant: "success",
        });
      }
      
      // Reset form and reload routes
      setRecipient("");
      setPercentage(0);
      setAutoVest(false);
      setTimeout(() => loadWithdrawRoutes(), 2000); // Reload after 2 seconds
      setIsProcessing(false);
      
      // Reset refs after success
      if (action === 'set') {
        setRouteSubmittedRef.current = false;
      } else {
        removeRouteSubmittedRef.current.delete(operation.to_account);
      }
      
    } catch (error: any) {
      console.error('Private key withdraw route error:', error);
      
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        if (operation.percent === 0) {
          toast({
            title: "Route Already Removed",
            description: `Withdraw route to @${operation.to_account} was already removed.`,
            variant: "success",
          });
        } else {
          toast({
            title: "Route Already Set",
            description: `Withdraw route was already configured.`,
            variant: "success",
          });
        }
        setRecipient("");
        setPercentage(0);
        setAutoVest(false);
        setTimeout(() => loadWithdrawRoutes(), 2000);
        setIsProcessing(false);
        
        // Reset refs after duplicate (treated as success)
        if (action === 'set') {
          setRouteSubmittedRef.current = false;
        } else {
          removeRouteSubmittedRef.current.delete(operation.to_account);
        }
        return;
      }
      
      let errorMessage = "Operation failed";
      if (error.jse_shortmsg) {
        errorMessage = error.jse_shortmsg;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Route Configuration Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      // CRITICAL: Reset ref so user can retry on genuine errors
      if (action === 'set') {
        setRouteSubmittedRef.current = false;
      } else {
        removeRouteSubmittedRef.current.delete(operation.to_account);
      }
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Login requirement notice */}
      {!isLoggedIn && (
        <Card className="bg-blue-900/30 border border-blue-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-300">Login Required</p>
                <p className="text-xs text-blue-400">
                  You must be logged in to manage withdraw vesting routes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Routes */}
      {isLoggedIn && (
        <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
          <CardHeader>
            <CardTitle className="text-white">Current Withdraw Routes</CardTitle>
            <CardDescription className="text-slate-400">
              Your active power down routing configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRoutes ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-slate-400">Loading routes...</span>
              </div>
            ) : currentRoutes.length > 0 ? (
              <div className="space-y-3">
                {currentRoutes.map((route, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">@{route.to_account}</span>
                        {route.auto_vest && (
                          <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded">
                            Auto Vest
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{(route.percent / 100).toFixed(1)}% of power down</p>
                    </div>
                    <Button
                      onClick={() => handleRemoveRoute(route.to_account)}
                      variant="outline"
                      size="sm"
                      className="border-red-600 text-red-400 hover:bg-red-900/30"
                      disabled={isProcessing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">No active withdraw routes</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Set New Route */}
      <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" style={{ color: '#07d7a9' }} />
            <div>
              <CardTitle className="text-white">Set Withdraw Vesting Route</CardTitle>
              <CardDescription className="text-slate-400">
                Route your power down payments to another account
                {!isLoggedIn && <span className="text-blue-400"> (Login required)</span>}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient" className="text-slate-300">Recipient Account</Label>
            <Input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="username (without @)"
              className="bg-slate-800 border-slate-700 text-white"
              disabled={!isLoggedIn || isProcessing}
            />
          </div>
          
          <div className="space-y-3">
            <Label className="text-slate-300">Percentage (%)</Label>
            <div className="px-3">
              <Slider
                value={[percentage]}
                onValueChange={(value) => setPercentage(value[0])}
                max={100}
                min={0}
                step={0.1}
                className="w-full"
                disabled={!isLoggedIn || isProcessing}
              />
            </div>
            <div className="flex justify-between text-sm text-slate-400">
              <span>0%</span>
              <span className="font-medium text-slate-300">{percentage.toFixed(1)}%</span>
              <span>100%</span>
            </div>
            <Input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              placeholder="0-100"
              min="0"
              max="100"
              step="0.1"
              className="bg-slate-800 border-slate-700 text-white"
              disabled={!isLoggedIn || isProcessing}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto-vest"
              checked={autoVest}
              onCheckedChange={setAutoVest}
              disabled={!isLoggedIn || isProcessing}
            />
            <Label htmlFor="auto-vest" className="text-slate-300">
              Auto Vest (Convert to STEEM Power automatically)
            </Label>
          </div>

          <div className="p-4 rounded-lg bg-blue-900/30 border border-blue-800">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-300 mb-2">How it works:</h4>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• {percentage.toFixed(1)}% = {Math.round(percentage * 100)} basis points</li>
                  <li>• Steem uses basis points (0-10,000 where 10,000 = 100%)</li>
                  <li>• Set to 0% to remove an existing route</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-yellow-900/30 border border-yellow-800">
            <h4 className="font-medium text-yellow-300 mb-2">⚠️ Important Notes:</h4>
            <ul className="text-sm text-yellow-200 space-y-1">
              <li>• Routes percentage of weekly power down to recipient</li>
              <li>• Remaining percentage comes to your account</li>
              <li>• Multiple routes can be set (total ≤ 100%)</li>
              <li>• Auto vest converts routed amount to STEEM Power</li>
              <li>• Routes persist until manually changed or removed</li>
              <li>• Requires active authority to set routes</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-slate-700/50">
            <h4 className="font-medium text-white mb-2">Route Preview:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">To:</span>
                <span className="text-white">@{recipient || '...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Percentage:</span>
                <span className="text-white">{percentage.toFixed(1)}% ({Math.round(percentage * 100)} basis points)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Auto Vest:</span>
                <span className="text-white">{autoVest ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Remaining to you:</span>
                <span className="text-white">{(100 - percentage).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSetWithdrawRoute}
            className="w-full text-white"
            style={{ backgroundColor: isLoggedIn ? '#07d7a9' : '#6b7280' }}
            disabled={!isLoggedIn || !recipient.trim() || isProcessing}
          >
            {!isLoggedIn ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Login Required
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : percentage === 0 ? (
              'Remove Route'
            ) : (
              'Set Withdraw Route'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WithdrawRouteOperations;
