/**
 * Updated LoginDialog with Tauri secure storage
 * Credentials are encrypted using AES-256-GCM and stored securely
 * Includes rate limiting and input validation for enhanced security
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LogIn,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  AlertTriangle,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import * as dsteem from "dsteem";
import { openExternalUrl } from "@/utils/utility";
import { SecureStorageFactory } from "@/services/secureStorage";
import { accountManager } from "@/services/accountManager";
import { encryptedKeyStorage } from "@/services/encryptedKeyStorage";
import {
  sanitizeUsername,
  isValidSteemUsername,
  loginRateLimiter,
} from "@/utils/security";
import { steemApi } from "@/services/steemApi";

interface LoginDialogProps {
  children: React.ReactNode;
  onLoginSuccess: (
    username: string,
    loginMethod: "privatekey" | "masterpassword"
  ) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const LoginDialog = ({
  children,
  onLoginSuccess,
  isOpen: controlledIsOpen,
  onOpenChange,
}: LoginDialogProps) => {
  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState("");
  const [showCredential, setShowCredential] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  const { toast } = useToast();
  const navigate = useNavigate();

  // Support both controlled and uncontrolled modes
  const isOpen =
    controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
    // Reset to login tab when closing
    if (!open) {
      setTimeout(() => setActiveTab("login"), 300);
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
      setRateLimitWarning(
        `Too many login attempts. Please wait ${waitTime} seconds.`
      );
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
        description:
          "Username must be 3-16 characters, start with a letter, and contain only lowercase letters, numbers, dots, or dashes.",
        variant: "destructive",
      });
      return;
    }

    // Record the login attempt for rate limiting
    loginRateLimiter.recordAttempt();

    if (!credential) {
      toast({
        title: "Missing Credential",
        description: "Please provide your master password or private key",
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
        throw new Error(
          "Session expired. Please lock and unlock the app to continue."
        );
      }

      // Check if it's a private key (starts with '5') - still support but not advertised
      if (credential.startsWith("5")) {
        // Validate private key format
        if (credential.length < 50) {
          throw new Error("Private key is too short");
        }

        // Derive public key from the private key
        let derivedPublicKey: string;
        try {
          const privateKey = dsteem.PrivateKey.fromString(credential);
          derivedPublicKey = privateKey.createPublic().toString();
        } catch (e) {
          throw new Error("Invalid private key format");
        }

        // Fetch account data to determine which key type this is
        const accountData = await steemApi.getAccount(username);
        if (!accountData) {
          throw new Error("Account not found");
        }

        // Helper function to check if a public key exists in key_auths array
        const keyExistsInAuth = (
          keyAuths: [string, number][] | undefined,
          pubKey: string
        ): boolean => {
          if (!keyAuths || !Array.isArray(keyAuths)) return false;
          return keyAuths.some(([key]) => key === pubKey);
        };

        // Determine which key type matches
        let keyType: "owner" | "active" | "posting" | "memo" | null = null;

        // Debug logging - only in development mode
        if (import.meta.env.DEV) {
          console.log("=== Private Key Login Debug ===");
          console.log("Derived public key:", derivedPublicKey);
          console.log(
            "Account owner keys:",
            accountData.owner?.key_auths?.map((k) => k[0])
          );
          console.log(
            "Account active keys:",
            accountData.active?.key_auths?.map((k) => k[0])
          );
          console.log(
            "Account posting keys:",
            accountData.posting?.key_auths?.map((k) => k[0])
          );
          console.log("Account memo key:", accountData.memo_key);
          console.log("===============================");
        }

        // Check owner key (check all keys in the authority)
        if (keyExistsInAuth(accountData.owner?.key_auths, derivedPublicKey)) {
          keyType = "owner";
        }
        // Check active key (check all keys in the authority)
        else if (
          keyExistsInAuth(accountData.active?.key_auths, derivedPublicKey)
        ) {
          keyType = "active";
        }
        // Check posting key (check all keys in the authority)
        else if (
          keyExistsInAuth(accountData.posting?.key_auths, derivedPublicKey)
        ) {
          keyType = "posting";
        }
        // Check memo key
        else if (accountData.memo_key === derivedPublicKey) {
          keyType = "memo";
        }

        if (!keyType) {
          throw new Error(
            "Private key does not match any of the account's public keys. Please ensure you are using the correct key for this account."
          );
        }

        // Handle as private key - store securely using account manager
        const credentials: any = {
          username,
          loginMethod: "privatekey" as const,
          importedKeyType: keyType,
        };
        credentials[`${keyType}Key`] = credential;

        await accountManager.addAccount(credentials);

        const keyTypeLabels = {
          owner: "Owner",
          active: "Active",
          posting: "Posting",
          memo: "Memo",
        };

        toast({
          title: "Login Successful",
          description: `Logged in as @${username} with ${keyTypeLabels[keyType]} Key`,
          variant: "success",
        });

        onLoginSuccess(username, "privatekey");
      } else {
        // Handle as master password - derive ALL 4 keys (owner, active, posting, memo)
        // This uses the same mechanism as steemitwallet.com:
        // private_key = PrivateKey.fromSeed(username + role + password)
        try {
          // Fetch account data to validate the derived keys
          const accountData = await steemApi.getAccount(username);
          if (!accountData) {
            throw new Error("Account not found");
          }

          // Derive all 4 keys from master password using Steem's standard key derivation
          const ownerKey = dsteem.PrivateKey.fromLogin(
            username,
            credential,
            "owner"
          );
          const activeKey = dsteem.PrivateKey.fromLogin(
            username,
            credential,
            "active"
          );
          const postingKey = dsteem.PrivateKey.fromLogin(
            username,
            credential,
            "posting"
          );
          const memoKey = dsteem.PrivateKey.fromLogin(
            username,
            credential,
            "memo"
          );

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

          if (
            !ownerMatches &&
            !activeMatches &&
            !postingMatches &&
            !memoMatches
          ) {
            throw new Error(
              "Invalid master password. The derived keys do not match any of the account's public keys."
            );
          }

          // Store all keys securely using account manager
          await accountManager.addAccount({
            username,
            loginMethod: "masterpassword",
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

          onLoginSuccess(username, "masterpassword");
        } catch (keyError) {
          const errorMsg =
            keyError instanceof Error
              ? keyError.message
              : "Failed to derive keys from master password. Please check your username and password.";
          throw new Error(errorMsg);
        }
      }

      setIsOpen(false);
      setUsername("");
      setCredential("");
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Invalid credentials. Please check your master password.";
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

    // Clear password cache from encrypted key storage (security critical)
    accountManager.clearPasswordCache();
    encryptedKeyStorage.clearPasswordCache();

    // Clear all stored accounts and their encrypted keys
    await accountManager.clearAllAccounts();

    // Clear legacy stored credentials from secure storage
    await storage.removeItem("steem_username");
    await storage.removeItem("steem_master_password");
    await storage.removeItem("steem_owner_key");
    await storage.removeItem("steem_active_key");
    await storage.removeItem("steem_posting_key");
    await storage.removeItem("steem_memo_key");
    await storage.removeItem("steem_login_method");

    // Clear sessionStorage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("steem_username");
    }

    // Redirect to homepage after logout
    navigate("/");

    toast({
      title: "Logged Out",
      description: "Successfully logged out from Steem",
      variant: "success",
    });

    // Reload the page to refresh the state
    window.location.reload();
  };

  // Check if user is already logged in (using sessionStorage for backwards compatibility)
  const isLoggedIn =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("steem_username")
      : null;

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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="border-0 shadow-none p-0 bg-transparent w-full max-w-md"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Steem Wallet Login</DialogTitle>
        <Card className="w-full bg-slate-900 border-slate-800 backdrop-blur-sm shadow-2xl overflow-hidden">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-800/80 flex items-center justify-center shadow-inner">
              <LogIn className="h-8 w-8 text-steemit-500" />
            </div>

            {/* Sliding Switch Toggle */}
            <div className="flex justify-center mb-2">
              <div className="bg-slate-800/80 p-1 rounded-full flex relative w-48 shadow-inner border border-slate-700/50">
                {/* Animated pill background */}
                <div
                  className={`absolute top-1 bottom-1 w-[46%] rounded-full bg-steemit-600 transition-all duration-300 shadow-md ${
                    activeTab === "login" ? "left-1" : "left-[52%]"
                  }`}
                />

                <button
                  onClick={() => setActiveTab("login")}
                  className={`relative z-10 w-1/2 py-1 text-sm font-medium transition-colors duration-200 ${
                    activeTab === "login"
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setActiveTab("signup")}
                  className={`relative z-10 w-1/2 py-1 text-sm font-medium transition-colors duration-200 ${
                    activeTab === "signup"
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            <CardDescription>
              {activeTab === "login"
                ? "Enter your credentials to access your wallet"
                : "Create a new Steem account to get started"}
            </CardDescription>
          </CardHeader>

          <CardContent className="relative overflow-hidden min-h-[340px]">
            {/* Sliding Content Container */}
            <div
              className="flex w-[200%] transition-transform duration-300 ease-in-out"
              style={{
                transform:
                  activeTab === "login" ? "translateX(0)" : "translateX(-50%)",
              }}
            >
              {/* LOGIN SECTION */}
              <div
                className="w-1/2 px-1 space-y-4 flex-shrink-0 opacity-100 transition-opacity duration-300"
                style={{ opacity: activeTab === "login" ? 1 : 0 }}
              >
                {/* Rate Limit Warning */}
                {rateLimitWarning && (
                  <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-yellow-300">
                      {rateLimitWarning}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-sm font-medium text-slate-300"
                  >
                    Username
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="Enter your username"
                    maxLength={16}
                    autoComplete="username"
                    className="bg-slate-800/50 border-slate-700 text-white focus:border-slate-700 focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:ring-offset-transparent focus-visible:ring-offset-0 focus-visible:ring-offset-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-slate-700 transition-all text-sm !ring-0 !ring-offset-0 !outline-none shadow-none focus:shadow-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="credential"
                    className="text-sm font-medium text-slate-300"
                  >
                    Master Password or Private Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="credential"
                      type={showCredential ? "text" : "password"}
                      value={credential}
                      onChange={(e) => setCredential(e.target.value)}
                      placeholder="Enter master password or Private Key"
                      className="pr-10 bg-slate-800/50 border-slate-700 text-white focus:border-slate-700 focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:ring-offset-transparent focus-visible:ring-offset-0 focus-visible:ring-offset-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-slate-700 transition-all text-sm !ring-0 !ring-offset-0 !outline-none shadow-none focus:shadow-none [&::-ms-reveal]:hidden"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-slate-400 hover:text-white"
                      onClick={() => setShowCredential(!showCredential)}
                    >
                      {showCredential ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) =>
                      setTermsAccepted(checked as boolean)
                    }
                    className="border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <label
                    htmlFor="terms"
                    className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-400"
                  >
                    I agree to the{" "}
                    <span
                      className="text-blue-500 hover:text-blue-400 cursor-pointer underline hover:no-underline transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTerms(true);
                      }}
                    >
                      terms and conditions
                    </span>{" "}
                    of the app
                  </label>
                </div>

                <Button
                  onClick={handleLogin}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                  disabled={
                    !username || !credential || isLogging || !termsAccepted
                  }
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

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500">
                    Credentials are encrypted and stored locally.
                  </p>
                </div>
              </div>

              {/* SIGN UP SECTION */}
              <div
                className="w-1/2 px-4 flex flex-col justify-start pt-4 items-center text-center space-y-4 flex-shrink-0 opacity-100 transition-opacity duration-300"
                style={{ opacity: activeTab === "signup" ? 1 : 0 }}
              >
                <div className="w-24 h-24 bg-steemit-500/10 rounded-full ring-1 ring-steemit-500/30 flex items-center justify-center">
                  <UserPlus className="w-10 h-10 text-steemit-500" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    New to Steem?
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Create a Steem account to start blogging, earning rewards,
                    and joining the community.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    openExternalUrl("https://signup.steemit.com/");
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-none shadow-lg shadow-blue-900/20"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Create Account on Steemit
                </Button>

                <p className="text-xs text-slate-500 pt-4">
                  Registration is handled by Steemit.com. Once you have your
                  keys, return here to log in.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>

      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold mb-4">
              Terms and Conditions
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Please read the following terms and conditions carefully before
              using Steem Wallet Desktop.
            </DialogDescription>
          </DialogHeader>

          <div
            className="mt-4 max-h-[60vh] overflow-y-auto pr-4 space-y-6 text-sm leading-relaxed"
            style={{ scrollbarWidth: "thin" }}
          >
            <section>
              <h3 className="text-lg font-semibold text-white mb-2">
                1. Open Source Software
              </h3>
              <p className="text-slate-300">
                Steem Wallet Desktop is an open-source application developed by
                the community relative to the Steem blockchain. The source code
                is available for review and contribution. This software is
                provided "as is", without warranty of any kind, express or
                implied.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-white mb-2">
                2. Security and Keys
              </h3>
              <p className="text-slate-300">
                <span className="text-red-400 font-bold">Important:</span> Your
                Master Password and Private Keys are encrypted and stored{" "}
                <strong>LOCALLY</strong> on your device. This application does
                not transmit your keys to any external server or third party. We
                do not have access to your funds or account credentials. You are
                solely responsible for maintaining the security of your device
                and your backups.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-white mb-2">
                3. Limitation of Liability
              </h3>
              <p className="text-slate-300">
                To the maximum extent permitted by applicable law, the
                developers and contributors of Steem Wallet Desktop shall not be
                liable for any direct, indirect, incidental, special,
                consequential, or punitive damages, or any loss of profits or
                revenues, whether incurred directly or indirectly, or any loss
                of data, use, goodwill, or other intangible losses, resulting
                from your access to or use of or inability to use the
                application.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-white mb-2">
                4. User Responsibility
              </h3>
              <p className="text-slate-300">
                By using this application, you acknowledge that you understand
                the risks associated with blockchain technologies and
                cryptocurrencies. You verify that you have securely backed up
                your Master Password and Private Keys. If you lose access to
                your credentials, your account and funds cannot be recovered by
                anyone, including the developers of this application.
              </p>
            </section>

             <section>
              <h3 className="text-lg font-semibold text-white mb-2">
                5. Compliance
              </h3>
              <p className="text-slate-300">
                You agree to use this application in compliance with all
                applicable laws and regulations in your jurisdiction.
              </p>
            </section>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => {
                setShowTerms(false);
                setTermsAccepted(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              I Understand & Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default LoginDialog;
