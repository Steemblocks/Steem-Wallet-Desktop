/**
 * App Lock Setup Dialog
 * Shown on first launch to create the app lock password
 * Redesigned for a modern, professional look
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Eye, EyeOff, AlertTriangle, Check, Lock, Loader2, KeyRound } from "lucide-react";
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

  // Calculate password strength percentage
  const strengthChecks = [hasMinLength, hasUpperCase, hasLowerCase, hasDigit, hasSpecialChar];
  const strengthPercentage = (strengthChecks.filter(Boolean).length / strengthChecks.length) * 100;

  const getStrengthColor = () => {
    if (strengthPercentage <= 20) return 'bg-red-500';
    if (strengthPercentage <= 40) return 'bg-orange-500';
    if (strengthPercentage <= 60) return 'bg-yellow-500';
    if (strengthPercentage <= 80) return 'bg-lime-500';
    return 'bg-emerald-500';
  };

  const getStrengthLabel = () => {
    if (strengthPercentage <= 20) return 'Very Weak';
    if (strengthPercentage <= 40) return 'Weak';
    if (strengthPercentage <= 60) return 'Fair';
    if (strengthPercentage <= 80) return 'Good';
    return 'Strong';
  };

  const handleSetup = async () => {
    setError('');

    if (!isStrongPassword) {
      setError('Please meet all password requirements');
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
          variant: "success",
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
    if (e.key === 'Enter' && isStrongPassword && passwordsMatch && !isCreating) {
      handleSetup();
    }
  };

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center gap-1.5 transition-all duration-200 ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
      <div className={`flex items-center justify-center w-3.5 h-3.5 rounded-full transition-all duration-200 ${
        met 
          ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' 
          : 'bg-slate-700/50 ring-1 ring-slate-600/50'
      }`}>
        <Check className={`h-2 w-2 transition-all duration-200 ${met ? 'opacity-100' : 'opacity-0'}`} />
      </div>
      <span className="text-xs">{text}</span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-700/50 text-white sm:max-w-md p-0 gap-0 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto" 
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header Section with Icon */}
        <div className="relative px-6 pt-5 pb-3">
          <div className="flex flex-col items-center text-center">
            {/* Icon Container */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-steemit-500/15 ring-1 ring-steemit-500/30 mb-3">
              <Shield className="h-6 w-6 text-steemit-400" />
            </div>
            
            <DialogTitle className="text-lg font-semibold text-white mb-1">
              Create App Lock Password
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400 max-w-sm">
              Set up a password to protect your wallet. You'll need this every time you open the app.
            </DialogDescription>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-6 pb-4 space-y-3">
          {/* Warning Notice */}
          <div className="flex gap-2.5 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                <span className="font-medium text-amber-300">Important:</span> If you forget this password, you'll need to reset the app.
              </p>
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <KeyRound className="h-3 w-3 text-slate-500" />
              Password
            </label>
            <div className="relative group">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isCreating}
                className="h-9 pr-9 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-slate-700/50 focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:ring-offset-transparent focus-visible:ring-offset-0 focus-visible:ring-offset-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-slate-700/50 transition-all text-sm !ring-0 !ring-offset-0 !outline-none shadow-none focus:shadow-none"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-700/50"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>
            
            {/* Password Strength Bar */}
            {password.length > 0 && (
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Password Strength</span>
                  <span className={`text-xs font-medium ${
                    strengthPercentage <= 40 ? 'text-orange-400' : 
                    strengthPercentage <= 60 ? 'text-yellow-400' : 
                    strengthPercentage <= 80 ? 'text-lime-400' : 'text-emerald-400'
                  }`}>
                    {getStrengthLabel()}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getStrengthColor()} transition-all duration-300 ease-out rounded-full`}
                    style={{ width: `${strengthPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-slate-500" />
              Confirm Password
            </label>
            <div className="relative group">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isCreating}
                className="h-9 pr-9 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-slate-700/50 focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:ring-offset-transparent focus-visible:ring-offset-0 focus-visible:ring-offset-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-slate-700/50 transition-all text-sm !ring-0 !ring-offset-0 !outline-none shadow-none focus:shadow-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-700/50"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Passwords do not match
              </p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Passwords match
              </p>
            )}
          </div>

          {/* Password Requirements */}
          <div className="p-2.5 bg-slate-800/30 rounded-lg border border-slate-700/30">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
              Requirements
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <RequirementItem met={hasMinLength} text="8+ characters" />
              <RequirementItem met={hasUpperCase} text="Uppercase (A-Z)" />
              <RequirementItem met={hasLowerCase} text="Lowercase (a-z)" />
              <RequirementItem met={hasDigit} text="Number (0-9)" />
              <RequirementItem met={hasSpecialChar} text="Special (!@#$...)" />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Create button */}
          <Button
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSetup}
            disabled={!isStrongPassword || !passwordsMatch || isCreating}
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Create App Lock
              </span>
            )}
          </Button>

          {/* Security tip */}
          <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
            <Lock className="h-2.5 w-2.5" />
            Encrypted and stored securely on your device
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppLockSetupDialog;