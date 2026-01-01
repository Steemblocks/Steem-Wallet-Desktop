/**
 * App Lock Screen
 * Shown when app is locked (on open or after auto-lock)
 * User must enter their app lock password to continue
 */

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Lock, Eye, EyeOff, AlertTriangle, RefreshCw, Wallet } from "lucide-react";
import { AppLockService } from '@/services/appLockService';
import { useToast } from '@/hooks/use-toast';

interface AppLockScreenProps {
  onUnlock: () => void;
  onReset: () => void;
}

export const AppLockScreen = ({ onUnlock, onReset }: AppLockScreenProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

  // Check if locked out
  const isLockedOut = lockoutUntil && Date.now() < lockoutUntil;
  const remainingLockoutTime = lockoutUntil ? Math.ceil((lockoutUntil - Date.now()) / 1000) : 0;

  // Countdown for lockout
  useEffect(() => {
    if (!isLockedOut) return;
    
    const interval = setInterval(() => {
      if (lockoutUntil && Date.now() >= lockoutUntil) {
        setLockoutUntil(null);
        setAttempts(0);
        setError('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLockedOut, lockoutUntil]);

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    if (isLockedOut) {
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const appLock = AppLockService.getInstance();
      const isValid = await appLock.verifyPassword(password);

      if (isValid) {
        setAttempts(0);
        toast({
          title: "Wallet Unlocked",
          description: "Welcome back!",
          variant: "success",
        });
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION);
          setError(`Too many failed attempts. Locked for 5 minutes.`);
        } else {
          setError(`Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
        }
        setPassword('');
      }
    } catch (err) {
      console.error('Unlock verification error:', err);
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const appLock = AppLockService.getInstance();
      await appLock.resetApp();
      toast({
        title: "App Reset Complete",
        description: "All data has been cleared. Please set up your wallet again.",
        variant: "destructive",
      });
      onReset();
    } catch (err) {
      console.error('Reset error:', err);
      toast({
        title: "Reset Failed",
        description: "Could not reset the app. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isVerifying && !isLockedOut) {
      handleUnlock();
    }
  };

  const formatLockoutTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/50 border-slate-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center">
            <Wallet className="h-8 w-8 text-green-500" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-orange-500" />
            Steem Wallet Locked
          </CardTitle>
          <CardDescription>
            Enter your app lock password to access your wallet
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Lockout warning */}
          {isLockedOut && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-400">
                Too many attempts. Try again in {formatLockoutTime(remainingLockoutTime)}
              </span>
            </div>
          )}

          {/* Password input */}
          <div className="space-y-2">
            <Label htmlFor="app-lock-password">App Lock Password</Label>
            <div className="relative">
              <Input
                id="app-lock-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isVerifying || isLockedOut}
                className="pr-10"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {error}
            </p>
          )}

          {/* Unlock button */}
          <Button
            className="w-full"
            onClick={handleUnlock}
            disabled={isVerifying || isLockedOut || !password.trim()}
          >
            {isVerifying ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Verifying...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Unlock Wallet
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-muted-foreground">Forgot password?</span>
            </div>
          </div>

          {/* Reset app option */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full text-red-400 border-red-900/50 hover:bg-red-950/50">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset App
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Reset Entire App?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>This will permanently delete:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Your app lock password</li>
                    <li>All saved Steem accounts</li>
                    <li>All stored private keys</li>
                    <li>All app settings</li>
                  </ul>
                  <p className="font-medium text-amber-400 mt-2">
                    You will need to log in again with your Steem master password or private keys.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isResetting}
                >
                  {isResetting ? 'Resetting...' : 'Yes, Reset Everything'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Security note */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            Your wallet automatically locks after 15 minutes of inactivity for security.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppLockScreen;
