/**
 * Change App Lock Password Dialog
 * Allows users to change their app lock password
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Eye, EyeOff, AlertTriangle, Check } from "lucide-react";
import { AppLockService } from '@/services/appLockService';
import { useToast } from '@/hooks/use-toast';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordDialog = ({ isOpen, onClose }: ChangePasswordDialogProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Password validation
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const isStrongPassword = hasMinLength && hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar;
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleChangePassword = async () => {
    setError('');

    if (!currentPassword.trim()) {
      setError('Please enter your current password');
      return;
    }

    if (!hasMinLength) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (!hasUpperCase) {
      setError('New password must contain at least one uppercase letter (A-Z)');
      return;
    }

    if (!hasLowerCase) {
      setError('New password must contain at least one lowercase letter (a-z)');
      return;
    }

    if (!hasDigit) {
      setError('New password must contain at least one digit (0-9)');
      return;
    }

    if (!hasSpecialChar) {
      setError('New password must contain at least one special character (!@#$%^&*...)');
      return;
    }

    if (!passwordsMatch) {
      setError('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setIsChanging(true);

    try {
      const appLock = AppLockService.getInstance();
      
      // First verify current password
      const isCurrentValid = await appLock.verifyPassword(currentPassword);
      if (!isCurrentValid) {
        setError('Current password is incorrect');
        setIsChanging(false);
        return;
      }

      // Change the password
      const success = await appLock.changePassword(currentPassword, newPassword);

      if (success) {
        toast({
          title: "Password Changed",
          description: "Your app lock password has been updated successfully.",
        });
        handleClose();
      } else {
        setError('Failed to change password. Please try again.');
      }
    } catch (err) {
      console.error('Change password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsChanging(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasMinLength && passwordsMatch && currentPassword && !isChanging) {
      handleChangePassword();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Key className="h-5 w-5 text-steemit-500" />
            Change App Lock Password
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Enter your current password and choose a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current password */}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-slate-300">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isChanging}
                className="pr-10 bg-slate-800 border-slate-700 text-white"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-slate-300">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter strong password (8+ chars, uppercase, lowercase, digit, special char)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isChanging}
                className="pr-10 bg-slate-800 border-slate-700 text-white"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Confirm new password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password" className="text-slate-300">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isChanging}
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

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={handleClose}
              disabled={isChanging}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-steemit-500 hover:bg-steemit-600 text-white"
              onClick={handleChangePassword}
              disabled={!hasMinLength || !passwordsMatch || !currentPassword || isChanging}
            >
              {isChanging ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Changing...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
