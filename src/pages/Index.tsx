import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import WalletHeader from "@/components/layout/WalletHeader";
import WalletOverview from "@/components/wallet/WalletOverview";
import AppLoadingScreen from "@/components/wallet/AppLoadingScreen";
import WitnessOperations from "@/components/wallet/WitnessOperations";
import DelegationOperations from "@/components/wallet/DelegationOperations";
import AccountOperations from "@/components/wallet/AccountOperations";
import MarketOperations from "@/components/wallet/MarketOperations";
import GovernanceOperations from "@/components/wallet/GovernanceOperations";
import AppSettingsOperations from "@/components/wallet/AppSettingsOperations";
import TransferPopup from "@/components/wallet/TransferPopup";
import AppLockSetupDialog from "@/components/wallet/AppLockSetupDialog";
import AppLockScreen from "@/components/wallet/AppLockScreen";
import WelcomePage from "@/components/wallet/WelcomePage";
import { useWalletData } from "@/contexts/WalletDataContext";
import { useToast } from "@/hooks/use-toast";
import { useAutoLock } from "@/hooks/useAutoLock";
import { useAutoRewardClaiming } from "@/hooks/useAutoRewardClaiming";
import { SecureStorageFactory } from "@/services/secureStorage";
import { AppLockService } from "@/services/appLockService";
import { accountManager } from "@/services/accountManager";
import { AlertCircle, UserX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [activeTab, setActiveTabLocal] = useState("overview");
  const [isTransferPopupOpen, setIsTransferPopupOpen] = useState(false);
  const [isPowerDownPopupOpen, setIsPowerDownPopupOpen] = useState(false);
  const [isPowerUpPopupOpen, setIsPowerUpPopupOpen] = useState(false);
  const [isSavingsPopupOpen, setIsSavingsPopupOpen] = useState(false);
  const [savingsPopupCurrency, setSavingsPopupCurrency] = useState<
    "STEEM" | "SBD"
  >("STEEM");
  const [isWithdrawSavingsPopupOpen, setIsWithdrawSavingsPopupOpen] =
    useState(false);
  const [loginMethod, setLoginMethod] = useState<
    "privatekey" | "masterpassword" | null
  >(null);

  // App lock states
  const [isAppLockSetup, setIsAppLockSetup] = useState<boolean | null>(null); // null = loading
  const [isAppLocked, setIsAppLocked] = useState(true); // Start locked until verified
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  // Auto reward claiming state
  const [autoRewardClaimingEnabled, setAutoRewardClaimingEnabled] =
    useState(false);

  // Auto lock state
  const [autoAppLockEnabled, setAutoAppLockEnabled] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(15);

  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use centralized wallet data context
  const {
    data: walletContextData,
    isInitialLoading,
    isRefreshing,
    loadingProgress,
    loadingStage,
    error,
    refreshAll,
    setSelectedAccount,
    selectedAccount: contextSelectedAccount,
    loggedInUser,
    setLoggedInUser,
    setActiveTab: setContextActiveTab,
  } = useWalletData();

  // Wrapper function to update both local and context activeTab
  const setActiveTab = useCallback(
    (tab: string) => {
      setActiveTabLocal(tab);
      setContextActiveTab(tab);
    },
    [setContextActiveTab]
  );

  // Extract data from context
  const accountData = walletContextData.account;
  const walletData = walletContextData.walletData;
  const outgoingDelegations = walletContextData.outgoingDelegations;

  let username = "";
  if (location.pathname === "/") {
    username = "";
  } else if (location.pathname.startsWith("/@")) {
    username = location.pathname.slice(2);
  } else if (params.username) {
    username = params.username;
  }

  const selectedAccount = username || loggedInUser || "";

  // Check if app lock is set up on mount
  useEffect(() => {
    const checkAppLockSetup = async () => {
      try {
        const appLock = AppLockService.getInstance();
        const isSetup = await appLock.isSetupComplete();

        if (!isSetup) {
          // First time - show preload screen for 2 seconds before password setup
          await new Promise((resolve) => setTimeout(resolve, 2000));
          setIsAppLockSetup(false);
          setShowSetupDialog(true);
          setIsAppLocked(false);
        } else {
          setIsAppLockSetup(true);
          // If setup is complete, keep locked until user enters password
        }
      } catch (error) {
        console.error("Error checking app lock setup:", error);
        // Show preload screen for 2 seconds even on error
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setIsAppLockSetup(false);
        setShowSetupDialog(true);
        setIsAppLocked(false);
      }
    };
    checkAppLockSetup();
  }, []);

  // Auto-lock handler - locks app after inactivity
  const handleAutoLock = useCallback(() => {
    if (isAppLockSetup) {
      setIsAppLocked(true);
      toast({
        title: "Wallet Locked",
        description: "Your wallet has been locked due to inactivity.",
        variant: "success",
      });
    }
  }, [isAppLockSetup, toast]);

  // Auto-lock warning handler
  const handleLockWarning = useCallback(
    (remainingSeconds: number) => {
      toast({
        title: "Wallet Locking Soon",
        description: `Your wallet will lock in ${remainingSeconds} seconds due to inactivity.`,
      });
    },
    [toast]
  );

  // Handle app unlock (from lock screen)
  const handleAppUnlock = useCallback(() => {
    setIsAppLocked(false);
  }, []);

  // Handle app reset (forgot password)
  const handleAppReset = useCallback(() => {
    setIsAppLockSetup(false);
    setIsAppLocked(false);
    setShowSetupDialog(true);
    setLoggedInUser(null);
    setLoginMethod(null);
  }, [setLoggedInUser]);

  // Handle app lock setup complete
  const handleSetupComplete = useCallback(() => {
    setShowSetupDialog(false);
    setIsAppLockSetup(true);
    setIsAppLocked(false); // Unlock after setup
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      if (!loggedInUser) {
        return;
      }

      // Remove only the current account (not all accounts)
      await accountManager.removeAccount(loggedInUser);

      // Check if there are remaining accounts
      const remainingAccounts = await accountManager.getAccounts();

      if (remainingAccounts.length > 0) {
        // Switch to another account
        const newActiveAccount = remainingAccounts[0].username;
        setLoggedInUser(newActiveAccount);
        setSelectedAccount(newActiveAccount);

        toast({
          title: "Account Removed",
          description: `@${loggedInUser} has been removed. Switched to @${newActiveAccount}.`,
          variant: "success",
        });
      } else {
        // No accounts remaining, clear account data but keep app lock intact
        // App lock is a separate security layer and should persist
        await accountManager.clearAllAccounts();

        // Reset all local state
        setLoggedInUser(null);
        setSelectedAccount("");
        setLoginMethod(null);
        setActiveTab("overview");

        navigate("/");
        toast({
          title: "Logged Out",
          description: "All Steem account data has been cleared.",
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Error during logout:", error);
      toast({
        title: "Logout Failed",
        description: "Could not logout. Please try again.",
        variant: "destructive",
      });
    }
  }, [loggedInUser, navigate, toast, setLoggedInUser, setSelectedAccount, setActiveTab]);

  // Initialize auto-lock (user-configurable timeout)
  useAutoLock({
    onLock: handleAutoLock,
    onWarning: handleLockWarning,
    enabled: isAppLockSetup === true && !isAppLocked && autoAppLockEnabled,
    timeout: autoLockTimeout * 60 * 1000, // Convert minutes to milliseconds
  });

  // Load app settings (including auto reward claiming and auto lock timeout)
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const savedSettings = await storage.getItem("app_settings");
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setAutoRewardClaimingEnabled(settings.autoRewardClaiming || false);
          setAutoAppLockEnabled(settings.autoAppLock || false);
          setAutoLockTimeout(settings.autoLockTimeout || 15);
        }
      } catch (error) {
        console.error("Error loading app settings:", error);
      }
    };
    loadAppSettings();

    // Listen for custom settings change event (immediate sync within same tab)
    const handleSettingsChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const settings = customEvent.detail;
        setAutoRewardClaimingEnabled(settings.autoRewardClaiming || false);
        setAutoAppLockEnabled(settings.autoAppLock || false);
        setAutoLockTimeout(settings.autoLockTimeout || 15);
      }
    };

    // Listen for storage changes (when settings are updated in different tabs)
    const handleStorageChange = () => {
      loadAppSettings();
    };

    window.addEventListener("app-settings-changed", handleSettingsChange);
    window.addEventListener("storage", handleStorageChange);

    // Also check settings periodically as a fallback
    const intervalId = setInterval(loadAppSettings, 10000);

    return () => {
      window.removeEventListener("app-settings-changed", handleSettingsChange);
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  // Auto reward claiming - runs when enabled and user is logged in
  // Pass account data from context to avoid redundant API calls
  useAutoRewardClaiming({
    enabled: autoRewardClaimingEnabled && !isAppLocked && !!loggedInUser,
    username: loggedInUser,
    accountData: accountData,
    onRewardsClaimed: refreshAll,
  });

  // Sync selected account with context when URL changes
  useEffect(() => {
    if (selectedAccount && selectedAccount !== contextSelectedAccount) {
      setSelectedAccount(selectedAccount);
    }
  }, [selectedAccount, contextSelectedAccount, setSelectedAccount]);

  // Load login method from storage
  useEffect(() => {
    const loadLoginMethod = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const savedLoginMethod = (await storage.getItem(
          "steem_login_method"
        )) as "privatekey" | "masterpassword" | null;
        if (savedLoginMethod) {
          setLoginMethod(savedLoginMethod);
        }
      } catch (error) {
        console.error("Error loading login method from storage:", error);
      }
    };
    loadLoginMethod();
  }, []);

  useEffect(() => {
    if (loggedInUser && location.pathname === "/") {
      navigate(`/@${loggedInUser}`);
    }
  }, [loggedInUser, location.pathname, navigate]);

  const handleLoginSuccess = (
    username: string,
    method: "privatekey" | "masterpassword"
  ) => {
    setLoggedInUser(username);
    setSelectedAccount(username);
    setLoginMethod(method);

    navigate(`/@${username}`);

    toast({
      title: "Login Successful",
      description: `Welcome to your wallet, @${username}!`,
      variant: "success",
    });
  };

  const handleAccountSwitch = useCallback(
    (username: string) => {
      // Reset to overview tab for fresh start with new account
      setActiveTab("overview");
      setLoggedInUser(username);
      setSelectedAccount(username);
      // Login method will be loaded from storage by accountManager
    },
    [setLoggedInUser, setSelectedAccount, setActiveTab]
  );

  // Show preloading screen while initial data is loading
  if (isInitialLoading && selectedAccount) {
    return <AppLoadingScreen progress={loadingProgress} stage={loadingStage} />;
  }

  // Show loading while checking app lock status
  if (isAppLockSetup === null) {
    return <AppLoadingScreen progress={10} stage="Checking security..." />;
  }

  // Show lock screen if app is locked
  if (isAppLocked && isAppLockSetup) {
    return (
      <AppLockScreen onUnlock={handleAppUnlock} onReset={handleAppReset} />
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "witness":
        return <WitnessOperations loggedInUser={loggedInUser} />;
      case "delegation":
        return <DelegationOperations />;
      case "market":
        return <MarketOperations />;
      case "governance":
        return <GovernanceOperations />;
      case "account":
        return <AccountOperations />;
      case "settings":
        return <AppSettingsOperations loggedInUser={loggedInUser} />;
      default:
        return (
          <WalletOverview
            selectedAccount={selectedAccount}
            loggedInUser={loggedInUser}
            accountData={accountData}
            walletData={walletData}
            outgoingDelegations={outgoingDelegations || []}
            onTransferClick={() => setIsTransferPopupOpen(true)}
            onDelegationClick={() => setActiveTab("delegation")}
            onPowerDownClick={() => setIsPowerDownPopupOpen(true)}
            onPowerUpClick={() => setIsPowerUpPopupOpen(true)}
            onSavingsClick={(currency) => {
              setSavingsPopupCurrency(currency);
              setIsSavingsPopupOpen(true);
            }}
            onWithdrawSavingsClick={() => setIsWithdrawSavingsPopupOpen(true)}
            onRefetch={refreshAll}
            isRefreshing={isRefreshing}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Show Welcome Page without header if no user is logged in */}
      {!loggedInUser ? (
        <WelcomePage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <WalletHeader
            selectedAccount={selectedAccount}
            loggedInUser={loggedInUser}
            onLoginSuccess={handleLoginSuccess}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
            onAccountSwitch={handleAccountSwitch}
          />
          <div className="container mx-auto px-4 pt-5 pb-8">
            {renderTabContent()}
          </div>

          {/* Error Popup Modal with Blurred Background */}
          {error && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Blurred backdrop */}
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

              {/* Error popup */}
              <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="rounded-2xl border border-red-900/50 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/30 shadow-2xl shadow-red-900/20 overflow-hidden">
                  {/* Red glow effect at top */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/20 rounded-full blur-3xl -translate-y-1/2" />

                  <div className="relative p-6">
                    {/* Icon */}
                    <div className="flex justify-center mb-5">
                      <div className="relative">
                        <div className="absolute inset-0 bg-red-500/30 rounded-full blur-xl animate-pulse" />
                        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 flex items-center justify-center">
                          {error.message.toLowerCase().includes("not found") ? (
                            <UserX className="w-8 h-8 text-red-400" />
                          ) : (
                            <AlertCircle className="w-8 h-8 text-red-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-white text-center mb-2">
                      {error.message.toLowerCase().includes("not found")
                        ? "Account Not Found"
                        : "Error Loading Data"}
                    </h2>

                    {/* Message */}
                    <p className="text-sm text-slate-400 text-center mb-6 leading-relaxed">
                      {error.message.toLowerCase().includes("not found") ? (
                        <>
                          The account{" "}
                          <span className="text-red-400 font-medium">
                            @{selectedAccount}
                          </span>{" "}
                          doesn't exist on the Steem blockchain. Please check
                          the username and try again.
                        </>
                      ) : (
                        error.message
                      )}
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={refreshAll}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>

                      {error.message.toLowerCase().includes("not found") && (
                        <Button
                          variant="ghost"
                          onClick={() => navigate("/")}
                          className="w-full text-slate-400 hover:text-white hover:bg-slate-800/50"
                        >
                          Go to Home
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Transfer Popup */}
      <TransferPopup
        isOpen={isTransferPopupOpen}
        onClose={() => setIsTransferPopupOpen(false)}
        username={loggedInUser || ""}
      />

      {/* Power Down Popup */}
      <TransferPopup
        isOpen={isPowerDownPopupOpen}
        onClose={() => setIsPowerDownPopupOpen(false)}
        username={loggedInUser || ""}
        defaultOperation="powerdown"
      />

      {/* Power Up Popup */}
      <TransferPopup
        isOpen={isPowerUpPopupOpen}
        onClose={() => setIsPowerUpPopupOpen(false)}
        username={loggedInUser || ""}
        defaultOperation="powerup"
      />

      {/* Savings Popup */}
      <TransferPopup
        isOpen={isSavingsPopupOpen}
        onClose={() => setIsSavingsPopupOpen(false)}
        username={loggedInUser || ""}
        defaultOperation="savings"
        defaultCurrency={savingsPopupCurrency}
      />

      {/* Withdraw Savings Popup - both STEEM and SBD available */}
      <TransferPopup
        isOpen={isWithdrawSavingsPopupOpen}
        onClose={() => setIsWithdrawSavingsPopupOpen(false)}
        username={loggedInUser || ""}
        defaultOperation="withdraw_savings"
      />

      {/* App Lock Setup Dialog - shown on first launch */}
      <AppLockSetupDialog
        isOpen={showSetupDialog}
        onSetupComplete={handleSetupComplete}
      />
    </div>
  );
};

export default Index;
