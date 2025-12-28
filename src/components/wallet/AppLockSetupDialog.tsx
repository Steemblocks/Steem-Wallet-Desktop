/**
 * App Lock Setup Dialog
 * Shown on first launch to create the app lock password
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, AlertTriangle, Check } from "lucide-react";
import { AppLockService } from '@/services/appLockService';
import { useToast } from '@/hooks/use-toast';

interface AppLockSetupDialogProps {
  isOpen: boolean;
  onSetupComplete: () => void;
}

export const AppLockSetupDialog = ({ isOpen, onSetupComplete }: AppLockSetupDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isStrongPassword = hasMinLength && hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar;
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSetup = async () => {
    setError('');

    if (!hasMinLength) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!hasUpperCase) {
      setError('Password must contain at least one uppercase letter (A-Z)');
      return;
    }

    if (!hasLowerCase) {
      setError('Password must contain at least one lowercase letter (a-z)');
      return;
    }

    if (!hasDigit) {
      setError('Password must contain at least one digit (0-9)');
      return;
    }

    if (!hasSpecialChar) {
      setError('Password must contain at least one special character (!@#$%^&*...)');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsCreating(true);

    try {
      const appLock = AppLockService.getInstance();
      const success = await appLock.setupPassword(password);

      if (success) {
        toast({
          title: "App Lock Created",
          description: "Your wallet is now protected with an app lock password.",
        });
        onSetupComplete();
      } else {
        setError('Failed to create app lock. Please try again.');
      }
    } catch (err) {
      console.error('App lock setup error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasMinLength && passwordsMatch && !isCreating) {
      handleSetup();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Shield className="h-5 w-5 text-steemit-500" />
            Create App Lock Password
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Set up a password to protect your wallet. You'll need this password every time you open the app or after auto-lock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning notice */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Important:</p>
              <p className="text-amber-200/80">If you forget this password, you'll need to reset the entire app and re-enter your Steem credentials.</p>
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-2">
            <Label htmlFor="setup-password" className="text-slate-300">App Lock Password</Label>
            <div className="relative">
              <Input
                id="setup-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isCreating}
                className="pr-10 bg-slate-800 border-slate-700 text-white"
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

          {/* Confirm password input */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-slate-300">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isCreating}
                className="pr-10 bg-slate-800 border-slate-700 text-white"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Password requirements */}
          <div className="space-y-1 text-sm">
            <div className={`flex items-center gap-2 ${hasMinLength ? 'text-green-500' : 'text-slate-500'}`}>
              <Check className={`h-3 w-3 ${hasMinLength ? 'opacity-100' : 'opacity-30'}`} />
              At least 8 characters
            </div>
            <div className={`flex items-center gap-2 ${hasUpperCase ? 'text-green-500' : 'text-slate-500'}`}>
              <Check className={`h-3 w-3 ${hasUpperCase ? 'opacity-100' : 'opacity-30'}`} />
              One uppercase letter (A-Z)
            </div>
            <div className={`flex items-center gap-2 ${hasLowerCase ? 'text-green-500' : 'text-slate-500'}`}>
              <Check className={`h-3 w-3 ${hasLowerCase ? 'opacity-100' : 'opacity-30'}`} />
              One lowercase letter (a-z)
            </div>
            <div className={`flex items-center gap-2 ${hasDigit ? 'text-green-500' : 'text-slate-500'}`}>
              <Check className={`h-3 w-3 ${hasDigit ? 'opacity-100' : 'opacity-30'}`} />
              One digit (0-9)
            </div>
            <div className={`flex items-center gap-2 ${hasSpecialChar ? 'text-green-500' : 'text-slate-500'}`}>
              <Check className={`h-3 w-3 ${hasSpecialChar ? 'opacity-100' : 'opacity-30'}`} />
              One special character (!@#$%^&*...)
            </div>
            <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-green-500' : 'text-slate-500'}`}>
              <Check className={`h-3 w-3 ${passwordsMatch ? 'opacity-100' : 'opacity-30'}`} />
              Passwords match
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {error}
            </p>
          )}

          {/* Create button */}
          <Button
            className="w-full bg-steemit-500 hover:bg-steemit-600 text-white"
            onClick={handleSetup}
            disabled={!isStrongPassword || !passwordsMatch || isCreating}
          >
            {isCreating ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Creating...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Create App Lock
              </>
            )}
          </Button>

          {/* Security tip */}
          <p className="text-xs text-slate-500 text-center">
            This password is stored securely on your device and never sent anywhere.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppLockSetupDialog;
