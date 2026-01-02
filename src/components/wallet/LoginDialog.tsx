/**
 * Updated LoginDialog with Tauri secure storage
 * Credentials are encrypted using AES-256-GCM and stored securely
 * Includes rate limiting and input validation for enhanced security
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Lock, Eye, EyeOff, LogOut, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import * as dsteem from 'dsteem';
import { SecureStorageFactory } from "@/services/secureStorage";
import { accountManager } from "@/services/accountManager";
import { encryptedKeyStorage } from "@/services/encryptedKeyStorage";
import { sanitizeUsername, isValidSteemUsername, loginRateLimiter } from "@/utils/security";
import { steemApi } from "@/services/steemApi";

interface LoginDialogProps {
  children: React.ReactNode;
  onLoginSuccess: (username: string, loginMethod: 'privatekey' | 'masterpassword') => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const LoginDialog = ({ children, onLoginSuccess, isOpen: controlledIsOpen, onOpenChange }: LoginDialogProps) => {
  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState("");
  const [showCredential, setShowCredential] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Support both controlled and uncontrolled modes
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  // Handle username input with sanitization
  const handleUsernameChange = (value: string) => {
    setUsername(sanitizeUsername(value));
  };

  const handleLogin = () => {
    // Check rate limiting
    if (!loginRateLimiter.isAllowed()) {
      const waitTime = Math.ceil(loginRateLimiter.getWaitTime() / 1000);
      setRateLimitWarning(`Too many login attempts. Please wait ${waitTime} seconds.`);
      toast({
        title: "Rate Limited",
        description: `Please wait ${waitTime} seconds before trying again.`,
        variant: "destructive",
      });
      return;
    }
    
    setRateLimitWarning(null);

    // Validate username
    const sanitizedUsername = sanitizeUsername(username);
    if (!sanitizedUsername) {
      toast({
        title: "Missing Username",
        description: "Please provide your username",
        variant: "destructive",
      });
      return;
    }

    if (!isValidSteemUsername(sanitizedUsername)) {
      toast({
        title: "Invalid Username",
        description: "Username must be 3-16 characters, start with a letter, and contain only lowercase letters, numbers, dots, or dashes.",
        variant: "destructive",
      });
      return;
    }

    // Record the login attempt for rate limiting
    loginRateLimiter.recordAttempt();

    if (!credential) {
      toast({
        title: "Missing Credential",
        description: "Please provide your master password",
        variant: "destructive",
      });
      return;
    }
    handleCredentialLogin();
  };

  const handleCredentialLogin = async () => {
    setIsLogging(true);
    
    try {
      const storage = SecureStorageFactory.getInstance();
      
      // Check if app lock password is cached, if not throw error
      if (!encryptedKeyStorage.isPasswordCached()) {
        throw new Error('Session expired. Please lock and unlock the app to continue.');
      }
      
      // Check if it's a private key (starts with '5') - still support but not advertised
      if (credential.startsWith('5')) {
        // Validate private key format
        if (credential.length < 50) {
          throw new Error('Private key is too short');
        }
        
        // Derive public key from the private key
        let derivedPublicKey: string;
        try {
          const privateKey = dsteem.PrivateKey.fromString(credential);
          derivedPublicKey = privateKey.createPublic().toString();
        } catch (e) {
          throw new Error('Invalid private key format');
        }
        
        // Fetch account data to determine which key type this is
        const accountData = await steemApi.getAccount(username);
        if (!accountData) {
          throw new Error('Account not found');
        }
        
        // Helper function to check if a public key exists in key_auths array
        const keyExistsInAuth = (keyAuths: [string, number][] | undefined, pubKey: string): boolean => {
          if (!keyAuths || !Array.isArray(keyAuths)) return false;
          return keyAuths.some(([key]) => key === pubKey);
        };
        
        // Determine which key type matches
        let keyType: 'owner' | 'active' | 'posting' | 'memo' | null = null;
        
        // Debug logging - only in development mode
        if (import.meta.env.DEV) {
          console.log('=== Private Key Login Debug ===');
          console.log('Derived public key:', derivedPublicKey);
          console.log('Account owner keys:', accountData.owner?.key_auths?.map(k => k[0]));
          console.log('Account active keys:', accountData.active?.key_auths?.map(k => k[0]));
          console.log('Account posting keys:', accountData.posting?.key_auths?.map(k => k[0]));
          console.log('Account memo key:', accountData.memo_key);
          console.log('===============================');
        }
        
        // Check owner key (check all keys in the authority)
        if (keyExistsInAuth(accountData.owner?.key_auths, derivedPublicKey)) {
          keyType = 'owner';
        }
        // Check active key (check all keys in the authority)
        else if (keyExistsInAuth(accountData.active?.key_auths, derivedPublicKey)) {
          keyType = 'active';
        }
        // Check posting key (check all keys in the authority)
        else if (keyExistsInAuth(accountData.posting?.key_auths, derivedPublicKey)) {
          keyType = 'posting';
        }
        // Check memo key
        else if (accountData.memo_key === derivedPublicKey) {
          keyType = 'memo';
        }
        
        if (!keyType) {
          throw new Error('Private key does not match any of the account\'s public keys. Please ensure you are using the correct key for this account.');
        }
        
        // Handle as private key - store securely using account manager
        const credentials: any = {
          username,
          loginMethod: 'privatekey' as const,
          importedKeyType: keyType,
        };
        credentials[`${keyType}Key`] = credential;
        
        await accountManager.addAccount(credentials);
        
        const keyTypeLabels = {
          owner: 'Owner',
          active: 'Active', 
          posting: 'Posting',
          memo: 'Memo'
        };
        
        toast({
          title: "Login Successful",
          description: `Logged in as @${username} with ${keyTypeLabels[keyType]} Key`,
          variant: "success",
        });
        
        onLoginSuccess(username, 'privatekey');
      } else {
        // Handle as master password - derive ALL 4 keys (owner, active, posting, memo)
        // This uses the same mechanism as steemitwallet.com:
        // private_key = PrivateKey.fromSeed(username + role + password)
        try {
          // Fetch account data to validate the derived keys
          const accountData = await steemApi.getAccount(username);
          if (!accountData) {
            throw new Error('Account not found');
          }
          
          // Derive all 4 keys from master password using Steem's standard key derivation
          const ownerKey = dsteem.PrivateKey.fromLogin(username, credential, 'owner');
          const activeKey = dsteem.PrivateKey.fromLogin(username, credential, 'active');
          const postingKey = dsteem.PrivateKey.fromLogin(username, credential, 'posting');
          const memoKey = dsteem.PrivateKey.fromLogin(username, credential, 'memo');
          
          // Derive public keys from the private keys
          const derivedOwnerPubKey = ownerKey.createPublic().toString();
          const derivedActivePubKey = activeKey.createPublic().toString();
          const derivedPostingPubKey = postingKey.createPublic().toString();
          const derivedMemoPubKey = memoKey.createPublic().toString();
          
          // Get account's actual public keys
          const accountOwnerPubKey = accountData.owner?.key_auths?.[0]?.[0];
          const accountActivePubKey = accountData.active?.key_auths?.[0]?.[0];
          const accountPostingPubKey = accountData.posting?.key_auths?.[0]?.[0];
          const accountMemoPubKey = accountData.memo_key;
          
          // Validate that at least one derived key matches the account's public keys
          // This ensures the password is correct for this account
          const ownerMatches = derivedOwnerPubKey === accountOwnerPubKey;
          const activeMatches = derivedActivePubKey === accountActivePubKey;
          const postingMatches = derivedPostingPubKey === accountPostingPubKey;
          const memoMatches = derivedMemoPubKey === accountMemoPubKey;
          
          if (!ownerMatches && !activeMatches && !postingMatches && !memoMatches) {
            throw new Error('Invalid master password. The derived keys do not match any of the account\'s public keys.');
          }
          
          // Store all keys securely using account manager
          await accountManager.addAccount({
            username,
            loginMethod: 'masterpassword',
            ownerKey: ownerKey.toString(),
            activeKey: activeKey.toString(),
            postingKey: postingKey.toString(),
            memoKey: memoKey.toString(),
            masterPassword: credential,
          });
          
          toast({
            title: "Login Successful",
            description: `Logged in as @${username} with Master Password. All keys imported.`,
            variant: "success",
          });
          
          onLoginSuccess(username, 'masterpassword');
        } catch (keyError) {
          const errorMsg = keyError instanceof Error ? keyError.message : 'Failed to derive keys from master password. Please check your username and password.';
          throw new Error(errorMsg);
        }
      }
      
      setIsOpen(false);
      setUsername("");
      setCredential("");
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid credentials. Please check your master password.';
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLogging(false);
    }
  };

  const handleLogout = async () => {
    const storage = SecureStorageFactory.getInstance();
    
    // Clear all stored credentials from secure storage
    await storage.removeItem('steem_username');
    await storage.removeItem('steem_master_password');
    await storage.removeItem('steem_owner_key');
    await storage.removeItem('steem_active_key');
    await storage.removeItem('steem_posting_key');
    await storage.removeItem('steem_memo_key');
    await storage.removeItem('steem_login_method');
    
    // Redirect to homepage after logout
    navigate('/');
    
    toast({
      title: "Logged Out",
      description: "Successfully logged out from Steem",
      variant: "success",
    });
    
    // Reload the page to refresh the state
    window.location.reload();
  };

  // Check if user is already logged in (using sessionStorage for backwards compatibility)
  const isLoggedIn = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('steem_username') : null;

  if (isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">@{isLoggedIn}</span>
        <Button 
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="text-red-400 border-red-900/50 hover:bg-red-950/50"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Logout
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="border-0 shadow-none p-0 bg-transparent" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Steem Wallet Login</DialogTitle>
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center">
              <LogIn className="h-8 w-8 text-steemit-500" />
            </div>
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Lock className="h-5 w-5 text-steemit-500" />
              Steem Wallet Login
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your wallet
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Rate Limit Warning */}
            {rateLimitWarning && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-yellow-300">{rateLimitWarning}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-300">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="Enter your username"
                maxLength={16}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential" className="text-sm font-medium text-slate-300">
                Master Password
              </Label>
              <div className="relative">
                <Input
                  id="credential"
                  type={showCredential ? "text" : "password"}
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="Enter your master password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCredential(!showCredential)}
                >
                  {showCredential ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                Enter your master password. The system will derive all necessary keys automatically.
              </p>
            </div>

            <Button 
              onClick={handleLogin}
              className="w-full bg-steemit-500 hover:bg-steemit-600 text-white"
              disabled={!username || !credential || isLogging}
            >
              {isLogging ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Logging in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Login
                </div>
              )}
            </Button>

            <div className="text-center">
              <p className="text-xs text-slate-400">
                Credentials are encrypted using AES-256-GCM and stored locally on your device
              </p>
              <p className="text-xs text-slate-400 mt-1">
                For desktop (Tauri), credentials are stored in secure native storage
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
