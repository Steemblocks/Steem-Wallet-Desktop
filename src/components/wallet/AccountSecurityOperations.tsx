import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  Key,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Users,
  Download,
  Lock,
  Trash2,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as dsteem from "dsteem";
import {
  steemOperations,
  UpdatePostingAuthOperation,
} from "@/services/steemOperations";
import { SecureStorageFactory } from "@/services/secureStorage";
import { AppLockService } from "@/services/appLockService";
import { getDecryptedKey } from "@/hooks/useSecureKeys";
import { accountManager } from "@/services/accountManager";
import ChangePasswordDialog from "./ChangePasswordDialog";

interface AccountSecurityOperationsProps {
  loggedInUser: string | null;
  accountData?: any;
}

const AccountSecurityOperations = ({
  loggedInUser,
  accountData,
}: AccountSecurityOperationsProps) => {
  const [activeTab, setActiveTab] = useState("keys");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPrivateKeys, setShowPrivateKeys] = useState(false);
  const [revealedPrivateKeys, setRevealedPrivateKeys] = useState<any>(null);
  const { toast } = useToast();

  // CRITICAL: Track transaction submission to prevent duplicate transactions
  const passwordChangeSubmittedRef = useRef(false);
  const resetAccountSubmittedRef = useRef(false);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmReady: false,
  });
  const [generatedKeys, setGeneratedKeys] = useState<any>(null);

  // Reset Account State
  const [resetAccountData, setResetAccountData] = useState({
    currentResetAccount: "",
    newResetAccount: "",
  });

  // Master Password Import Dialog State
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPassword, setImportPassword] = useState("");
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // App Lock State
  const [showChangePasswordDialog, setShowChangePasswordDialog] =
    useState(false);
  const [isResettingApp, setIsResettingApp] = useState(false);

  // Manual Key Import State
  const [showManualKeyDialog, setShowManualKeyDialog] = useState(false);
  const [manualKeyData, setManualKeyData] = useState({
    keyType: "posting" as "owner" | "active" | "posting" | "memo",
    privateKey: "",
  });
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);
  const [isImportingManualKey, setIsImportingManualKey] = useState(false);
  const [missingKeyTypes, setMissingKeyTypes] = useState<
    ("owner" | "active" | "posting" | "memo")[]
  >([]);

  // Check which keys are missing
  const checkMissingKeys = useCallback(async () => {
    if (!loggedInUser) return;

    const types: ("owner" | "active" | "posting" | "memo")[] = [
      "owner",
      "active",
      "posting",
      "memo",
    ];
    const missing: ("owner" | "active" | "posting" | "memo")[] = [];

    for (const type of types) {
      const hasKey = await accountManager.hasKey(loggedInUser, type);
      if (!hasKey) {
        missing.push(type);
      }
    }
    setMissingKeyTypes(missing);
  }, [loggedInUser]);

  useEffect(() => {
    checkMissingKeys();
  }, [checkMissingKeys]);

  // Revoke Authorized Account State
  const [isRevokingAccount, setIsRevokingAccount] = useState<string | null>(
    null
  );
  const revokeSubmittedRef = useRef(false);

  const canRevealPrivateKeys = () => {
    return true; // Always allow for privatekey or masterpassword logins
  };

  // Import all keys from master password
  const handleImportKeys = async () => {
    if (!loggedInUser || !importPassword) {
      toast({
        title: "Missing Information",
        description: "Please enter your master password",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      // Derive all 4 keys from master password using Steem's standard key derivation
      const ownerKey = dsteem.PrivateKey.fromLogin(
        loggedInUser,
        importPassword,
        "owner"
      );
      const activeKey = dsteem.PrivateKey.fromLogin(
        loggedInUser,
        importPassword,
        "active"
      );
      const postingKey = dsteem.PrivateKey.fromLogin(
        loggedInUser,
        importPassword,
        "posting"
      );
      const memoKey = dsteem.PrivateKey.fromLogin(
        loggedInUser,
        importPassword,
        "memo"
      );

      // Verify at least one key matches the account's public keys
      const activePublic = activeKey.createPublic().toString();
      const accountActiveKey = accountData?.active?.key_auths?.[0]?.[0];

      if (accountActiveKey && activePublic !== accountActiveKey) {
        throw new Error(
          "The master password does not match this account. Please check your password."
        );
      }

      // Store all keys securely using accountManager (encrypts if app lock is set)
      await accountManager.addAccount({
        username: loggedInUser,
        loginMethod: "masterpassword",
        ownerKey: ownerKey.toString(),
        activeKey: activeKey.toString(),
        postingKey: postingKey.toString(),
        memoKey: memoKey.toString(),
        masterPassword: importPassword,
      });

      // Generate the revealed keys structure
      const privateKeys = steemOperations.generateKeys(
        loggedInUser,
        importPassword,
        ["owner", "active", "posting", "memo"]
      );
      setRevealedPrivateKeys(privateKeys);
      setShowPrivateKeys(true);

      toast({
        title: "Keys Imported Successfully",
        description:
          "All 4 keys (owner, active, posting, memo) have been imported and are now revealed.",
        variant: "success",
      });

      // Close dialog and reset
      setShowImportDialog(false);
      setImportPassword("");
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description:
          error.message || "Failed to import keys from master password",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleTogglePrivateKeys = async () => {
    // If keys are already shown, hide them
    if (showPrivateKeys) {
      setShowPrivateKeys(false);
      setRevealedPrivateKeys(null);
      return;
    }

    // Otherwise, reveal the keys
    if (!loggedInUser || !canRevealPrivateKeys()) {
      toast({
        title: "Access Denied",
        description:
          "Private key revelation requires master password or private key login",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get decrypted keys from encrypted storage (including master password)
      const storedKeys = {
        owner: await getDecryptedKey(loggedInUser, "owner"),
        active: await getDecryptedKey(loggedInUser, "active"),
        posting: await getDecryptedKey(loggedInUser, "posting"),
        memo: await getDecryptedKey(loggedInUser, "memo"),
        master: await accountManager.getDecryptedKey(loggedInUser, "master"),
      };

      let privateKeys: any = {};

      if (storedKeys.master) {
        // Generate keys from master password using the same mechanism as steemitwallet.com:
        // private_key = PrivateKey.fromSeed(username + role + password)
        privateKeys = steemOperations.generateKeys(
          loggedInUser,
          storedKeys.master,
          ["owner", "active", "posting", "memo"]
        );
      } else {
        // Use stored private keys (when logged in with individual private key)
        Object.entries(storedKeys).forEach(([role, key]) => {
          if (key && role !== "master") {
            privateKeys[role] = {
              private: key,
              public: steemOperations.wifToPublic(key),
            };
          }
        });
      }

      setRevealedPrivateKeys(privateKeys);
      setShowPrivateKeys(true);

      toast({
        title: "Private Keys Revealed",
        description: "Handle with extreme care! Never share your private keys.",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Reveal Keys",
        description: error.message || "Could not retrieve private keys",
        variant: "destructive",
      });
    }
  };

  // Generate a secure random password (Steem-compatible format, ~52 characters)
  const generateSecurePassword = () => {
    // Steem passwords are typically 52 characters starting with P5
    // They use base58 characters (no 0, O, I, l to avoid confusion)
    const base58Chars =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let password = "P5"; // Standard Steem password prefix

    // Generate 50 more characters for a total of 52
    const array = new Uint8Array(50);
    crypto.getRandomValues(array);

    for (let i = 0; i < 50; i++) {
      password += base58Chars.charAt(array[i] % base58Chars.length);
    }

    return password;
  };

  const handleGenerateNewPassword = async () => {
    if (!loggedInUser || !passwordData.oldPassword) {
      toast({
        title: "Missing Information",
        description: "Please enter your current password",
        variant: "destructive",
      });
      return;
    }

    const ownerKey = await getDecryptedKey(loggedInUser, "owner");
    const activeKey = await getDecryptedKey(loggedInUser, "active");

    if (!ownerKey && !activeKey) {
      toast({
        title: "Key Required",
        description: "Owner or Active key is required for password change",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Generate a new secure password
      const newPassword = generateSecurePassword();

      // Generate new keys from the new password using the correct method
      const newKeys = steemOperations.generateKeys(loggedInUser, newPassword, [
        "owner",
        "active",
        "posting",
        "memo",
      ]);

      setPasswordData({ ...passwordData, newPassword, confirmReady: true });
      setGeneratedKeys(newKeys);

      toast({
        title: "New Password Generated",
        description:
          "Please copy your new password and keys before confirming the change",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Password Generation Failed",
        description: error.message || "Failed to generate new password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPasswordChange = async () => {
    if (!generatedKeys || !loggedInUser || !passwordData.confirmReady) return;

    // CRITICAL: Prevent duplicate submissions
    if (passwordChangeSubmittedRef.current || isLoading) {
      console.log("Blocking duplicate password change submission");
      return;
    }

    // CRITICAL: Mark as submitted IMMEDIATELY
    passwordChangeSubmittedRef.current = true;
    setIsLoading(true);

    try {
      // Try owner key first, then active key (decrypted from secure storage)
      const ownerKeyString = await getDecryptedKey(loggedInUser, "owner");
      const activeKeyString = await getDecryptedKey(loggedInUser, "active");

      let privateKey: dsteem.PrivateKey;
      if (ownerKeyString) {
        privateKey = dsteem.PrivateKey.fromString(ownerKeyString);
      } else if (activeKeyString) {
        privateKey = dsteem.PrivateKey.fromString(activeKeyString);
      } else {
        toast({
          title: "Key Required",
          description: "Owner or Active key is required for password change",
          variant: "destructive",
        });
        passwordChangeSubmittedRef.current = false;
        setIsLoading(false);
        return;
      }

      // Create new authorities
      const newOwnerAuth = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[generatedKeys.owner.public, 1]],
      };

      const newActiveAuth = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[generatedKeys.active.public, 1]],
      };

      const newPostingAuth = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[generatedKeys.posting.public, 1]],
      };

      // Update account with new keys
      const accountUpdateOp: dsteem.Operation = [
        "account_update",
        {
          account: loggedInUser,
          owner: newOwnerAuth,
          active: newActiveAuth,
          posting: newPostingAuth,
          memo_key: generatedKeys.memo.public,
          json_metadata: "",
        },
      ];

      await steemOperations.broadcastOperation([accountUpdateOp], privateKey);

      toast({
        title: "Password Changed Successfully",
        description:
          "Your account password has been updated. Please save your new keys!",
        variant: "success",
      });

      // Clear sensitive data
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmReady: false,
      });
      setGeneratedKeys(null);
      setIsLoading(false);
      // Keep ref as true to prevent accidental double submissions
    } catch (error: any) {
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate =
        error?.message?.includes("duplicate") ||
        error?.jse_shortmsg?.includes("duplicate");
      if (isDuplicate) {
        toast({
          title: "Password Already Changed",
          description:
            "Your password change was already submitted. Please save your new keys!",
          variant: "success",
        });
        setPasswordData({
          oldPassword: "",
          newPassword: "",
          confirmReady: false,
        });
        setGeneratedKeys(null);
        setIsLoading(false);
        return;
      }

      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
      // CRITICAL: Reset ref so user can retry on genuine errors
      passwordChangeSubmittedRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSetResetAccount = async () => {
    if (!loggedInUser || !resetAccountData.newResetAccount) {
      toast({
        title: "Missing Information",
        description: "Please enter the reset account username",
        variant: "destructive",
      });
      return;
    }

    // CRITICAL: Prevent duplicate submissions
    if (resetAccountSubmittedRef.current || isLoading) {
      console.log("Blocking duplicate reset account submission");
      return;
    }

    // CRITICAL: Mark as submitted IMMEDIATELY
    resetAccountSubmittedRef.current = true;
    setIsLoading(true);

    try {
      const ownerKeyString = await getDecryptedKey(loggedInUser, "owner");
      if (!ownerKeyString) {
        toast({
          title: "Owner Key Required",
          description: "Owner key is required for this operation",
          variant: "destructive",
        });
        resetAccountSubmittedRef.current = false;
        setIsLoading(false);
        return;
      }

      const ownerKey = dsteem.PrivateKey.fromString(ownerKeyString);

      await steemOperations.setResetAccount(
        {
          account: loggedInUser,
          current_reset_account: resetAccountData.currentResetAccount,
          reset_account: resetAccountData.newResetAccount,
        },
        ownerKey
      );

      toast({
        title: "Reset Account Updated",
        description: "Your recovery account has been set successfully",
        variant: "success",
      });

      setResetAccountData({ currentResetAccount: "", newResetAccount: "" });
      setIsLoading(false);
      // Reset ref after successful operation
      resetAccountSubmittedRef.current = false;
    } catch (error: any) {
      // Check for duplicate transaction - treat as SUCCESS
      const isDuplicate =
        error?.message?.includes("duplicate") ||
        error?.jse_shortmsg?.includes("duplicate");
      if (isDuplicate) {
        toast({
          title: "Reset Account Already Updated",
          description: "Your recovery account change was already submitted.",
          variant: "success",
        });
        setResetAccountData({ currentResetAccount: "", newResetAccount: "" });
        setIsLoading(false);
        resetAccountSubmittedRef.current = false;
        return;
      }

      toast({
        title: "Operation Failed",
        description: error.message || "Failed to set reset account",
        variant: "destructive",
      });
      // CRITICAL: Reset ref so user can retry on genuine errors
      resetAccountSubmittedRef.current = false;
      setIsLoading(false);
    }
  };

  const handleManualKeyImport = async () => {
    if (!loggedInUser || !manualKeyData.privateKey) return;

    setIsImportingManualKey(true);
    try {
      // 1. Validate WIF format
      if (!steemOperations.isWif(manualKeyData.privateKey)) {
        throw new Error(
          "Invalid private key format. Key must be in WIF format (starts with 5...)"
        );
      }

      const privateKey = dsteem.PrivateKey.fromString(manualKeyData.privateKey);
      const publicKey = privateKey.createPublic().toString();

      // 2. Validate against account public keys
      let expectedPublicKey: string | undefined;

      switch (manualKeyData.keyType) {
        case "owner":
          expectedPublicKey = accountData?.owner?.key_auths?.[0]?.[0];
          break;
        case "active":
          expectedPublicKey = accountData?.active?.key_auths?.[0]?.[0];
          break;
        case "posting":
          expectedPublicKey = accountData?.posting?.key_auths?.[0]?.[0];
          break;
        case "memo":
          expectedPublicKey = accountData?.memo_key;
          break;
      }

      if (!expectedPublicKey) {
        // Fallback/Warning if we can't fetch account data to verify (shouldn't happen often)
        console.warn(
          `Could not verify ${manualKeyData.keyType} key against account data`
        );
      } else if (publicKey !== expectedPublicKey) {
        throw new Error(
          `The provided private key does not match your account's ${manualKeyData.keyType} public key.`
        );
      }

      // 3. Store the key securely
      const credentials: any = {
        username: loggedInUser,
        loginMethod: "privatekey", // Or 'mixed' if we supported that flag, but 'privatekey' is fine
      };

      // Dynamically add the specific key
      if (manualKeyData.keyType === "owner")
        credentials.ownerKey = manualKeyData.privateKey;
      if (manualKeyData.keyType === "active")
        credentials.activeKey = manualKeyData.privateKey;
      if (manualKeyData.keyType === "posting")
        credentials.postingKey = manualKeyData.privateKey;
      if (manualKeyData.keyType === "memo")
        credentials.memoKey = manualKeyData.privateKey;

      await accountManager.addAccount(credentials);

      toast({
        title: "Key Added Successfully",
        description: `Your ${manualKeyData.keyType} key has been securely stored.`,
        variant: "success",
      });

      setShowManualKeyDialog(false);
      setManualKeyData({ keyType: "posting", privateKey: "" });

      // Refresh available keys
      await checkMissingKeys();
    } catch (error: any) {
      console.error("Error importing manual key:", error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import private key",
        variant: "destructive",
      });
    } finally {
      setIsImportingManualKey(false);
    }
  };

  const handleRevokeAuthorizedAccount = async (authorizedAccount: string) => {
    // Check if duplicate submission
    if (revokeSubmittedRef.current) return;
    if (isRevokingAccount) return;

    if (!loggedInUser || !accountData) return;

    try {
      setIsRevokingAccount(authorizedAccount);
      revokeSubmittedRef.current = true;

      // We need Active or Owner key to update account
      const activeKey = await getDecryptedKey(loggedInUser, "active");
      const ownerKey = await getDecryptedKey(loggedInUser, "owner");

      const signingKey = activeKey || ownerKey;

      if (!signingKey) {
        throw new Error(
          "Active or Owner key is required to revoke authorization."
        );
      }

      const privKey = dsteem.PrivateKey.fromString(signingKey);

      // Filter out the account to remove from posting.account_auths
      // accountData.posting.account_auths is array of [username, weight]
      const currentAuths = accountData.posting.account_auths || [];
      const newAuths = currentAuths.filter(
        (auth: any) => auth[0] !== authorizedAccount
      );

      // Construct the update operation
      // specific to posting authority update
      const updateOp: UpdatePostingAuthOperation = {
        account: loggedInUser,
        posting: {
          weight_threshold: accountData.posting.weight_threshold,
          account_auths: newAuths,
          key_auths: accountData.posting.key_auths,
        },
        memo_key: accountData.memo_key,
        json_metadata: accountData.json_metadata,
      };

      await steemOperations.updatePostingAuth(updateOp, privKey);

      toast({
        title: "Access Revoked",
        description: `Successfully revoked access for @${authorizedAccount}`,
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error revoking authorized account:", error);
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke access",
        variant: "destructive",
      });
    } finally {
      setIsRevokingAccount(null);
      revokeSubmittedRef.current = false;
    }
  };

  const copyToClipboard = async (text: string, keyType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyType);
      setTimeout(() => setCopiedKey(null), 2000);

      toast({
        title: "Copied to Clipboard",
        description: `${keyType} copied successfully`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (!loggedInUser) {
    return (
      <Card className="bg-slate-800/50 border border-slate-700">
        <CardContent className="p-6">
          <div className="text-center">
            <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Account Security
            </h3>
            <p className="text-slate-400">
              Please log in to access account security features
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Shield className="w-5 h-5 text-blue-400" />
            Account Security
          </CardTitle>
          <CardDescription className="text-slate-400">
            Manage your account security settings, keys, and recovery options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 h-auto p-0 bg-transparent gap-0 rounded-xl overflow-hidden border border-slate-700/50">
              <TabsTrigger
                value="keys"
                className="relative py-3.5 px-4 text-sm font-semibold rounded-none border-r border-slate-700/50 transition-all duration-200
                  data-[state=active]:bg-gradient-to-b data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20
                  data-[state=inactive]:bg-slate-800/60 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-slate-700/80"
              >
                Keys
              </TabsTrigger>
              <TabsTrigger
                value="recovery"
                className="relative py-3.5 px-4 text-sm font-semibold rounded-none border-r border-slate-700/50 transition-all duration-200
                  data-[state=active]:bg-gradient-to-b data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20
                  data-[state=inactive]:bg-slate-800/60 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-slate-700/80"
              >
                Recovery
              </TabsTrigger>
              <TabsTrigger
                value="password"
                className="relative py-3.5 px-4 text-sm font-semibold rounded-none border-r border-slate-700/50 transition-all duration-200
                  data-[state=active]:bg-gradient-to-b data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20
                  data-[state=inactive]:bg-slate-800/60 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-slate-700/80"
              >
                Password
              </TabsTrigger>
              <TabsTrigger
                value="applock"
                className="relative py-3.5 px-4 text-sm font-semibold rounded-none transition-all duration-200
                  data-[state=active]:bg-gradient-to-b data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20
                  data-[state=inactive]:bg-slate-800/60 data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-slate-700/80"
              >
                App Lock
              </TabsTrigger>
            </TabsList>

            <TabsContent value="keys" className="space-y-6">
              {/* Current Account Keys Section */}
              {accountData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">
                      Current Account Keys
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          if (missingKeyTypes.length > 0) {
                            setManualKeyData({
                              keyType: missingKeyTypes[0],
                              privateKey: "",
                            });
                            setShowManualKeyDialog(true);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        disabled={missingKeyTypes.length === 0}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Private Key
                      </Button>
                      <Button
                        onClick={() => setShowImportDialog(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Import All Keys
                      </Button>
                      {canRevealPrivateKeys() && (
                        <Button
                          onClick={handleTogglePrivateKeys}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          {showPrivateKeys ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          {showPrivateKeys ? "Hide" : "Reveal"} Private Keys
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {/* Owner Key */}
                    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-semibold text-red-400">
                          Owner Key
                        </Label>
                        <Badge variant="destructive">Highest Authority</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-16">
                            Public:
                          </span>
                          <Input
                            value={
                              accountData.owner?.key_auths?.[0]?.[0] || "N/A"
                            }
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                accountData.owner?.key_auths?.[0]?.[0] || "",
                                "owner public"
                              )
                            }
                          >
                            {copiedKey === "owner public" ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {showPrivateKeys && revealedPrivateKeys?.owner && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-16">
                              Private:
                            </span>
                            <Input
                              value={revealedPrivateKeys.owner.private}
                              readOnly
                              className="font-mono text-xs bg-red-950/30 border-red-900/50 text-red-400"
                              type="password"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyToClipboard(
                                  revealedPrivateKeys.owner.private,
                                  "owner private"
                                )
                              }
                            >
                              {copiedKey === "owner private" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Key */}
                    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-semibold text-orange-400">
                          Active Key
                        </Label>
                        <Badge variant="secondary">Financial Operations</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-16">
                            Public:
                          </span>
                          <Input
                            value={
                              accountData.active?.key_auths?.[0]?.[0] || "N/A"
                            }
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                accountData.active?.key_auths?.[0]?.[0] || "",
                                "active public"
                              )
                            }
                          >
                            {copiedKey === "active public" ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {showPrivateKeys && revealedPrivateKeys?.active && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-16">
                              Private:
                            </span>
                            <Input
                              value={revealedPrivateKeys.active.private}
                              readOnly
                              className="font-mono text-xs bg-orange-950/30 border-orange-900/50 text-orange-400"
                              type="password"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyToClipboard(
                                  revealedPrivateKeys.active.private,
                                  "active private"
                                )
                              }
                            >
                              {copiedKey === "active private" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Posting Key */}
                    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-semibold text-blue-400">
                          Posting Key
                        </Label>
                        <Badge variant="outline">Content & Social</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-16">
                            Public:
                          </span>
                          <Input
                            value={
                              accountData.posting?.key_auths?.[0]?.[0] || "N/A"
                            }
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                accountData.posting?.key_auths?.[0]?.[0] || "",
                                "posting public"
                              )
                            }
                          >
                            {copiedKey === "posting public" ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {showPrivateKeys && revealedPrivateKeys?.posting && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-16">
                              Private:
                            </span>
                            <Input
                              value={revealedPrivateKeys.posting.private}
                              readOnly
                              className="font-mono text-xs bg-blue-950/30 border-blue-900/50 text-blue-400"
                              type="password"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyToClipboard(
                                  revealedPrivateKeys.posting.private,
                                  "posting private"
                                )
                              }
                            >
                              {copiedKey === "posting private" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        )}
                        {accountData.posting?.account_auths?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-medium text-slate-300">
                                  Authorized Apps/Accounts
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {accountData.posting.account_auths.length}{" "}
                                authorized
                              </span>
                            </div>
                            <div className="space-y-2">
                              {accountData.posting.account_auths.map(
                                ([account, weight]: [string, number]) => (
                                  <div
                                    key={account}
                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-400"
                                      >
                                        @{account}
                                      </Badge>
                                      <span className="text-xs text-slate-500">
                                        weight: {weight}
                                      </span>
                                    </div>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                          disabled={
                                            isRevokingAccount === account
                                          }
                                        >
                                          {isRevokingAccount === account ? (
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-3 h-3" />
                                          )}
                                          <span className="ml-1 text-xs">
                                            Revoke
                                          </span>
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="flex items-center gap-2 text-red-400">
                                            <AlertTriangle className="h-5 w-5" />
                                            Revoke Authorization?
                                          </AlertDialogTitle>
                                          <AlertDialogDescription className="space-y-2">
                                            <p>
                                              This will remove{" "}
                                              <strong>@{account}</strong>'s
                                              access to post and vote on your
                                              behalf.
                                            </p>
                                            <p className="text-amber-400">
                                              This action requires your Active
                                              or Owner key.
                                            </p>
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="bg-slate-800 border-slate-700 hover:bg-slate-700">
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() =>
                                              handleRevokeAuthorizedAccount(
                                                account
                                              )
                                            }
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Revoke Access
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Memo Key */}
                    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-semibold text-green-400">
                          Memo Key
                        </Label>
                        <Badge variant="outline">Private Messages</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-16">
                            Public:
                          </span>
                          <Input
                            value={accountData.memo_key || "N/A"}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                accountData.memo_key || "",
                                "memo public"
                              )
                            }
                          >
                            {copiedKey === "memo public" ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {showPrivateKeys && revealedPrivateKeys?.memo && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-16">
                              Private:
                            </span>
                            <Input
                              value={revealedPrivateKeys.memo.private}
                              readOnly
                              className="font-mono text-xs bg-green-950/30 border-green-900/50 text-green-400"
                              type="password"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyToClipboard(
                                  revealedPrivateKeys.memo.private,
                                  "memo private"
                                )
                              }
                            >
                              {copiedKey === "memo private" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {showPrivateKeys && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>SECURITY WARNING:</strong> Private keys are now
                        visible. Never share them with anyone and ensure you're
                        in a secure environment.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="recovery" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  The recovery account can help you recover your account if you
                  lose access. The reset account is part of the recovery
                  process.
                </AlertDescription>
              </Alert>

              {/* Current Status */}
              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <Label className="font-semibold mb-2 block">
                    Current Recovery Status
                  </Label>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">
                        Recovery Account:
                      </span>
                      <Badge variant="outline">
                        @{accountData?.recovery_account || "steemit"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">
                        Reset Account:
                      </span>
                      <Badge
                        variant={
                          accountData?.reset_account === "null"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {accountData?.reset_account === "null"
                          ? "Not Set"
                          : `@${accountData?.reset_account}`}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentResetAccount">
                    Current Reset Account
                  </Label>
                  <Input
                    id="currentResetAccount"
                    value={resetAccountData.currentResetAccount}
                    onChange={(e) =>
                      setResetAccountData({
                        ...resetAccountData,
                        currentResetAccount: e.target.value,
                      })
                    }
                    placeholder={
                      accountData?.reset_account === "null"
                        ? "Leave empty if none set"
                        : accountData?.reset_account || ""
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="newResetAccount">New Reset Account</Label>
                  <Input
                    id="newResetAccount"
                    value={resetAccountData.newResetAccount}
                    onChange={(e) =>
                      setResetAccountData({
                        ...resetAccountData,
                        newResetAccount: e.target.value,
                      })
                    }
                    placeholder="Enter new reset account username"
                  />
                </div>

                <Button
                  onClick={handleSetResetAccount}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Setting Reset Account...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Set Reset Account
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="password" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will generate a new secure password and keys for your
                  account. This requires owner or active key access.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="oldPassword">Current Password</Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    value={passwordData.oldPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        oldPassword: e.target.value,
                      })
                    }
                    placeholder="Enter current password"
                  />
                </div>

                {!passwordData.confirmReady ? (
                  <Button
                    onClick={handleGenerateNewPassword}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating New Password...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4 mr-2" />
                        Generate New Password & Keys
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>IMPORTANT:</strong> Copy and save your new
                        password and keys securely before confirming!
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        New Password
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={passwordData.newPassword}
                          readOnly
                          className="font-mono text-sm bg-yellow-50"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(
                              passwordData.newPassword,
                              "new password"
                            )
                          }
                        >
                          {copiedKey === "new password" ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {generatedKeys &&
                      Object.entries(generatedKeys).map(
                        ([role, keys]: [string, any]) => (
                          <div key={role} className="space-y-2">
                            <Label className="text-sm font-medium capitalize">
                              {role} Key
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={keys.private}
                                readOnly
                                className="font-mono text-xs"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  copyToClipboard(
                                    keys.private,
                                    `${role} private`
                                  )
                                }
                              >
                                {copiedKey === `${role} private` ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )
                      )}

                    <Button
                      onClick={handleConfirmPasswordChange}
                      disabled={isLoading}
                      variant="destructive"
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        "Confirm Password Change"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* App Lock Tab */}
            <TabsContent value="applock" className="space-y-6">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  App Lock is a separate password that protects access to this
                  wallet app. It's different from your Steem account password.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {/* Change App Lock Password */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-500" />
                      Change App Lock Password
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Update your app lock password while keeping your Steem
                      credentials intact.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setShowChangePasswordDialog(true)}
                      className="w-full"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Change Password
                    </Button>
                  </CardContent>
                </Card>

                {/* Lock Wallet Now */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="h-4 w-4 text-orange-500" />
                      Lock Wallet Now
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Manually lock the wallet. You'll need to enter your app
                      lock password to continue.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        // Reload the page to trigger the lock screen
                        window.location.reload();
                      }}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Lock Wallet
                    </Button>
                  </CardContent>
                </Card>

                {/* Reset App (Danger Zone) */}
                <Card className="bg-red-950/30 border-red-900/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-400">
                      <Trash2 className="h-4 w-4" />
                      Reset Wallet App
                    </CardTitle>
                    <CardDescription className="text-sm text-red-300/70">
                      Forgot your app lock password? Reset the entire app. This
                      will delete all saved data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Alert
                      variant="destructive"
                      className="bg-red-950/50 border-red-900"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Warning:</strong> This will permanently delete:
                        <ul className="list-disc list-inside mt-1 text-sm">
                          <li>Your app lock password</li>
                          <li>All saved Steem accounts</li>
                          <li>All stored private keys</li>
                          <li>All app settings</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full"
                          disabled={isResettingApp}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Reset Entire App
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            Reset Entire App?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>
                              This action cannot be undone. All your data will
                              be permanently deleted.
                            </p>
                            <p className="font-medium text-amber-400">
                              You will need to set up a new app lock password
                              and log in again with your Steem credentials.
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              setIsResettingApp(true);
                              try {
                                const appLock = AppLockService.getInstance();
                                await appLock.resetApp();
                                toast({
                                  title: "App Reset Complete",
                                  description:
                                    "All data has been cleared. The app will reload.",
                                  variant: "destructive",
                                });
                                setTimeout(() => {
                                  window.location.reload();
                                }, 1500);
                              } catch (error) {
                                console.error("Reset error:", error);
                                toast({
                                  title: "Reset Failed",
                                  description:
                                    "Could not reset the app. Please try again.",
                                  variant: "destructive",
                                });
                              } finally {
                                setIsResettingApp(false);
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isResettingApp}
                          >
                            {isResettingApp
                              ? "Resetting..."
                              : "Yes, Reset Everything"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>

                {/* Auto-lock Info */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      Auto-Lock Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      Your wallet automatically locks after{" "}
                      <strong>15 minutes</strong> of inactivity.
                    </p>
                    <p className="mt-2">
                      A warning notification appears 1 minute before auto-lock.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Change App Lock Password Dialog */}
      <ChangePasswordDialog
        isOpen={showChangePasswordDialog}
        onClose={() => setShowChangePasswordDialog(false)}
      />

      {/* Import Keys Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-500" />
              Import All Keys from Master Password
            </DialogTitle>
            <DialogDescription>
              Enter your master password to derive and import all 4 keys (owner,
              active, posting, memo). This uses the same key derivation as
              steemitwallet.com.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your master password will be stored securely to allow key
                revelation. Make sure you're in a secure environment.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="masterPassword">Master Password</Label>
              <div className="relative">
                <Input
                  id="masterPassword"
                  type={showImportPassword ? "text" : "password"}
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter your master password"
                  className="bg-slate-800 border-slate-700 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowImportPassword(!showImportPassword)}
                >
                  {showImportPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                The master password will be used to derive: owner, active,
                posting, and memo keys.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportKeys}
              disabled={!importPassword || isImporting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Import Keys
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Private Key Import Dialog */}
      <Dialog open={showManualKeyDialog} onOpenChange={setShowManualKeyDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-500" />
              Add Private Key
            </DialogTitle>
            <DialogDescription>
              Manually add a specific private key to your wallet. You can add
              keys one by one if you prefer not to use the master password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Note:</strong> Your private key will be
                encrypted with your app lock password and stored locally. Never
                share this key.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyType">Key Type</Label>
                <Select
                  value={manualKeyData.keyType}
                  onValueChange={(
                    value: "owner" | "active" | "posting" | "memo"
                  ) => setManualKeyData({ ...manualKeyData, keyType: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Select key type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {missingKeyTypes.includes("posting") && (
                      <SelectItem value="posting">
                        Posting Key (Social Actions)
                      </SelectItem>
                    )}
                    {missingKeyTypes.includes("active") && (
                      <SelectItem value="active">
                        Active Key (Wallet Actions)
                      </SelectItem>
                    )}
                    {missingKeyTypes.includes("owner") && (
                      <SelectItem value="owner">
                        Owner Key (Account Actions)
                      </SelectItem>
                    )}
                    {missingKeyTypes.includes("memo") && (
                      <SelectItem value="memo">
                        Memo Key (Private Messages)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="privateKey">Private Key</Label>
                <div className="relative">
                  <Input
                    id="privateKey"
                    type={showManualKeyInput ? "text" : "password"}
                    value={manualKeyData.privateKey}
                    onChange={(e) =>
                      setManualKeyData({
                        ...manualKeyData,
                        privateKey: e.target.value,
                      })
                    }
                    placeholder="Enter private key (starts with 5...)"
                    className="bg-slate-800 border-slate-700 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowManualKeyInput(!showManualKeyInput)}
                  >
                    {showManualKeyInput ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowManualKeyDialog(false);
                setManualKeyData({ keyType: "posting", privateKey: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualKeyImport}
              disabled={!manualKeyData.privateKey || isImportingManualKey}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isImportingManualKey ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountSecurityOperations;
