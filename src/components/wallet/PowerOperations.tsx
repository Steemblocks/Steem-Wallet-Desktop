import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from 'dsteem';
import { steemOperations } from '@/services/steemOperations';
import { Lock, Loader2, ArrowDown } from "lucide-react";
import { useSteemAccount } from "@/hooks/useSteemAccount";
import { SecureStorageFactory } from '@/services/secureStorage';
import { getDecryptedKey } from '@/hooks/useSecureKeys';
import PowerDownStatus from './PowerDownStatus';

const PowerOperations = () => {
  const [powerUpRecipient, setPowerUpRecipient] = useState("");
  const [powerUpAmount, setPowerUpAmount] = useState("");
  const [powerDownAmount, setPowerDownAmount] = useState("");
  const [isProcessingPowerUp, setIsProcessingPowerUp] = useState(false);
  const [isProcessingPowerDown, setIsProcessingPowerDown] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Refs to track if transactions have been submitted
  const powerUpSubmittedRef = useRef(false);
  const powerDownSubmittedRef = useRef(false);

  // Load credentials from secure storage
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        setUsername(user);
      } catch (error) {
        console.error('Error loading credentials from storage:', error);
      }
    };
    loadCredentials();
  }, []);

  // Check if user is logged in
  const isLoggedIn = username !== null;

  const { data: account, refetch } = useSteemAccount(username || '');

  // Check if power down is active
  const isPowerDownActive = account && 
    parseFloat(account.vesting_withdraw_rate?.split(' ')[0] || '0') > 0 && 
    new Date(account.next_vesting_withdrawal) > new Date('1970-01-01');

  const handlePowerUp = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please login to perform this operation",
        variant: "destructive",
      });
      return;
    }

    if (!powerUpAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter amount to power up",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent duplicate submissions - CRITICAL
    if (powerUpSubmittedRef.current || isProcessingPowerUp) {
      console.log('Blocking duplicate power up submission');
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    powerUpSubmittedRef.current = true;
    setIsProcessingPowerUp(true);

    try {
      const operation = {
        from: username!,
        to: powerUpRecipient || username!,
        amount: `${powerUpAmount} STEEM`
      };

      await handlePrivateKeyPowerUp(operation);
    } catch (error: any) {
      console.error('Power up error:', error);
      
      // Check for duplicate transaction
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Power Up Already Processed",
          description: "This power up transaction was already submitted.",
          variant: "success",
        });
        setPowerUpAmount("");
        setPowerUpRecipient("");
        refetch();
      } else {
        toast({
          title: "Operation Failed",
          description: "Failed to power up. Please try again.",
          variant: "destructive",
        });
      }
      powerUpSubmittedRef.current = false;
      setIsProcessingPowerUp(false);
    }
  };

  const handlePowerDown = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please login to perform this operation",
        variant: "destructive",
      });
      return;
    }

    if (isPowerDownActive) {
      toast({
        title: "Power Down Already Active",
        description: "You already have an active power down. Cancel it first to start a new one.",
        variant: "destructive",
      });
      return;
    }

    if (!powerDownAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter amount to power down",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent duplicate submissions - CRITICAL
    if (powerDownSubmittedRef.current || isProcessingPowerDown) {
      console.log('Blocking duplicate power down submission');
      return;
    }
    
    // CRITICAL: Mark as submitted IMMEDIATELY
    powerDownSubmittedRef.current = true;
    setIsProcessingPowerDown(true);

    try {
      const vestsAmount = await steemOperations.convertSteemToVests(`${powerDownAmount} STEEM`);

      await handlePrivateKeyPowerDown(username!, vestsAmount);
    } catch (error: any) {
      console.error('Power down error:', error);
      
      // Check for duplicate transaction
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Power Down Already Processed",
          description: "This power down transaction was already submitted.",
          variant: "success",
        });
        setPowerDownAmount("");
        refetch();
      } else {
        toast({
          title: "Operation Failed",
          description: "Failed to power down. Please try again.",
          variant: "destructive",
        });
      }
      powerDownSubmittedRef.current = false;
      setIsProcessingPowerDown(false);
    }
  };

  const handlePrivateKeyPowerUp = async (operation: any) => {
    // Get decrypted key from secure storage
    const privateKeyString = await getDecryptedKey(username!, 'active');
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Active key required for this operation",
        variant: "destructive",
      });
      setIsProcessingPowerUp(false);
      powerUpSubmittedRef.current = false;
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      await steemOperations.powerUp(operation, privateKey);
      
      toast({
        title: "Power Up Successful",
        description: `${powerUpAmount} STEEM has been powered up`,
        variant: "success",
      });
      setPowerUpAmount("");
      setPowerUpRecipient("");
      refetch();
      // DO NOT reset powerUpSubmittedRef on success - will be reset when form is reinitiated
      setIsProcessingPowerUp(false);
      powerUpSubmittedRef.current = false;
    } catch (error: any) {
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Power Up Already Processed",
          description: "This power up transaction was already submitted successfully.",
          variant: "success",
        });
        setPowerUpAmount("");
        setPowerUpRecipient("");
        refetch();
        setIsProcessingPowerUp(false);
        powerUpSubmittedRef.current = false;
        return;
      }
      
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
      setIsProcessingPowerUp(false);
      // CRITICAL: Reset ref so user can retry
      powerUpSubmittedRef.current = false;
    }
  };

  const handlePrivateKeyPowerDown = async (username: string, vestsAmount: string) => {
    // Get decrypted key from secure storage
    const privateKeyString = await getDecryptedKey(username, 'active');
    if (!privateKeyString) {
      toast({
        title: "Private Key Not Found",
        description: "Active key required for this operation",
        variant: "destructive",
      });
      setIsProcessingPowerDown(false);
      powerDownSubmittedRef.current = false;
      return;
    }

    try {
      const privateKey = dsteem.PrivateKey.fromString(privateKeyString);
      await steemOperations.powerDown(username, vestsAmount, privateKey);
      
      toast({
        title: "Power Down Initiated",
        description: `${powerDownAmount} STEEM power down started`,
        variant: "success",
      });
      setPowerDownAmount("");
      refetch();
      // DO NOT reset powerDownSubmittedRef on success - will be reset when form is reinitiated
      setIsProcessingPowerDown(false);
      powerDownSubmittedRef.current = false;
    } catch (error: any) {
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate = error?.message?.includes('duplicate') || error?.jse_shortmsg?.includes('duplicate');
      if (isDuplicate) {
        toast({
          title: "Power Down Already Processed",
          description: "This power down transaction was already submitted successfully.",
          variant: "success",
        });
        setPowerDownAmount("");
        refetch();
        setIsProcessingPowerDown(false);
        powerDownSubmittedRef.current = false;
        return;
      }
      
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
      setIsProcessingPowerDown(false);
      // CRITICAL: Reset ref so user can retry
      powerDownSubmittedRef.current = false;
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
                  You must be logged in to perform power operations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Power Down Status */}
      {isLoggedIn && account && (
        <PowerDownStatus 
          account={account} 
          onUpdate={() => {
            refetch();
          }} 
        />
      )}

      {/* Power Up Operations */}
      <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-white">Power Up</CardTitle>
          <CardDescription className="text-slate-400">
            Convert STEEM to STEEM Power
            {!isLoggedIn && <span className="text-blue-400"> (Login required)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="power-up-recipient" className="text-slate-300">Recipient (optional)</Label>
            <Input
              id="power-up-recipient"
              value={powerUpRecipient}
              onChange={(e) => setPowerUpRecipient(e.target.value)}
              placeholder="username (leave empty to power up to yourself)"
              className="bg-slate-800 border-slate-700 text-white"
              disabled={!isLoggedIn || isProcessingPowerUp}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="power-up-amount" className="text-slate-300">Amount (STEEM)</Label>
            <Input
              id="power-up-amount"
              type="number"
              value={powerUpAmount}
              onChange={(e) => setPowerUpAmount(e.target.value)}
              placeholder="0.000"
              step="0.001"
              className="bg-slate-800 border-slate-700 text-white"
              disabled={!isLoggedIn || isProcessingPowerUp}
            />
          </div>
          <Button 
            onClick={handlePowerUp}
            className="w-full text-white"
            style={{ backgroundColor: isLoggedIn ? '#07d7a9' : '#6b7280' }}
            disabled={!isLoggedIn || !powerUpAmount || isProcessingPowerUp}
          >
            {!isLoggedIn ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Login Required
              </>
            ) : isProcessingPowerUp ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Power Up'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Power Down Operations */}
      <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-white">Power Down</CardTitle>
          <CardDescription className="text-slate-400">
            Convert STEEM Power to STEEM
            {!isLoggedIn && <span className="text-blue-400"> (Login required)</span>}
            {isPowerDownActive && <span className="text-orange-400"> (Already active - cancel first)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="power-down-amount" className="text-slate-300">Amount (SP)</Label>
            <Input
              id="power-down-amount"
              type="number"
              value={powerDownAmount}
              onChange={(e) => setPowerDownAmount(e.target.value)}
              placeholder="0.000"
              step="0.001"
              className="bg-slate-800 border-slate-700 text-white"
              disabled={!isLoggedIn || isProcessingPowerDown || isPowerDownActive}
            />
          </div>
          <Button
            onClick={handlePowerDown}
            className="w-full text-white"
            style={{ backgroundColor: isLoggedIn && !isPowerDownActive ? '#07d7a9' : '#6b7280' }}
            disabled={!isLoggedIn || !powerDownAmount || isProcessingPowerDown || isPowerDownActive}
          >
            {!isLoggedIn ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Login Required
              </>
            ) : isPowerDownActive ? (
              <>
                <ArrowDown className="w-4 h-4 mr-2" />
                Power Down Active
              </>
            ) : isProcessingPowerDown ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Power Down'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PowerOperations;
