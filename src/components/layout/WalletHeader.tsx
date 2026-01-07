import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Menu,
  Wallet,
  Users,
  ArrowRightLeft,
  TrendingUp,
  Vote,
  User,
  LogOut,
  Plus,
  Check,
  Trash2,
  ChevronDown,
  Loader2,
  Settings,
} from "lucide-react";
import LoginDialog from "@/components/wallet/LoginDialog";
import { useToast } from "@/hooks/use-toast";
import { accountManager, StoredAccount } from "@/services/accountManager";
import { getAvatarUrl, handleAvatarError } from "@/utils/utility";
import { useWalletData } from "@/contexts/WalletDataContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WalletHeaderProps {
  selectedAccount: string;
  loggedInUser: string | null;
  onLoginSuccess: (
    username: string,
    method: "privatekey" | "masterpassword"
  ) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout?: () => void;
  onAccountSwitch?: (username: string) => void;
  onRefresh?: () => void;
}

// Account list item component with avatar caching
interface AccountListItemProps {
  username: string;
  isSwitching: boolean;
  onSwitch: (username: string) => void;
  onRemove: (username: string) => void;
}

const AccountListItem = ({ username, isSwitching, onSwitch, onRemove }: AccountListItemProps) => {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 cursor-pointer group ${
        isSwitching ? "opacity-50 pointer-events-none" : ""
      }`}
      onClick={() => !isSwitching && onSwitch(username)}
    >
      <img
        src={getAvatarUrl(username)}
        alt={`@${username}`}
        className="w-8 h-8 rounded-full object-cover"
        loading="lazy"
        onError={handleAvatarError}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-300 truncate">
          @{username}
        </p>
      </div>
      {isSwitching ? (
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(username);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
          title="Remove account"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      )}
    </div>
  );
};

const WalletHeader = ({
  selectedAccount,
  loggedInUser,
  onLoginSuccess,
  activeTab,
  onTabChange,
  onLogout,
  onAccountSwitch,
  onRefresh,
}: WalletHeaderProps) => {
  const [searchUsername, setSearchUsername] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showRemoveAccountDialog, setShowRemoveAccountDialog] = useState(false);
  const queryClient = useQueryClient();
  const [accountToRemove, setAccountToRemove] = useState<string | null>(null);
  const [storedAccounts, setStoredAccounts] = useState<StoredAccount[]>([]);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get switchAccount from context for comprehensive account switching
  const { switchAccount, isSwitchingAccount } = useWalletData();

  // Load stored accounts
  useEffect(() => {
    const loadAccounts = async () => {
      const accounts = await accountManager.getAccounts();
      setStoredAccounts(accounts);
    };
    loadAccounts();
  }, [loggedInUser]);

  const handleAccountSwitch = async (username: string) => {
    if (username === loggedInUser || isSwitchingAccount) return;

    try {
      // Navigate first to update URL
      navigate(`/@${username}`);
      
      // Start the context switch immediately (shows loading screen right away)
      // This handles: WebSocket cleanup, cache clearing, state reset, and fresh data fetch
      const switchPromise = switchAccount(username);
      
      // Update accountManager in parallel (persists the switch) - non-blocking
      accountManager.switchAccount(username).catch(console.warn);
      
      // Wait for the context switch to complete
      await switchPromise;
      
      // Notify parent component
      onAccountSwitch?.(username);
      
      toast({
        title: "Account Switched",
        description: `Successfully switched to @${username}.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error switching account:", error);
      toast({
        title: "Account Switch Failed",
        description: "Unable to switch accounts. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAccount = async (username: string) => {
    try {
      await accountManager.removeAccount(username);
      const accounts = await accountManager.getAccounts();
      setStoredAccounts(accounts);

      // If we removed the current account, trigger logout or switch
      if (username === loggedInUser) {
        if (accounts.length > 0) {
          handleAccountSwitch(accounts[0].username);
        } else {
          onLogout?.();
        }
      }

      toast({
        title: "Account Removed",
        description: `@${username} has been successfully removed from your wallet.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error removing account:", error);
      toast({
        title: "Account Removal Failed",
        description: "Unable to remove the account. Please try again.",
        variant: "destructive",
      });
    }
    setShowRemoveAccountDialog(false);
    setAccountToRemove(null);
  };

  const menuItems = [
    { id: "overview", label: "Wallet", icon: Wallet },
    { id: "witness", label: "Witness", icon: Users },
    { id: "delegation", label: "Delegation", icon: ArrowRightLeft },
    { id: "market", label: "Market", icon: TrendingUp },
    { id: "governance", label: "Governance", icon: Vote },
    { id: "account", label: "Account", icon: User },
    { id: "settings", label: "App Settings", icon: Settings },
  ];

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setIsMenuOpen(false);
  };

  const handleLogoClick = () => {
    // Silently refresh all data without showing loading state
    // Account data (includes pending rewards, power down status, savings balances)
    queryClient.invalidateQueries({
      queryKey: ["steemAccount"],
      refetchType: "active",
    });

    // Transaction history
    queryClient.invalidateQueries({
      queryKey: ["accountHistory"],
      refetchType: "active",
    });

    // Delegations (outgoing)
    queryClient.invalidateQueries({
      queryKey: ["outgoing-delegations"],
      refetchType: "active",
    });
    queryClient.invalidateQueries({
      queryKey: ["delegations"],
      refetchType: "active",
    });

    // Witnesses
    queryClient.invalidateQueries({
      queryKey: ["witnesses"],
      refetchType: "active",
    });
    queryClient.invalidateQueries({
      queryKey: ["userWitnessVotes"],
      refetchType: "active",
    });

    // Market data
    queryClient.invalidateQueries({
      queryKey: ["simplifiedMarketData"],
      refetchType: "active",
    });
    queryClient.invalidateQueries({
      queryKey: ["hourlyMarketHistory"],
      refetchType: "active",
    });
    queryClient.invalidateQueries({
      queryKey: ["dailyMarketHistory"],
      refetchType: "active",
    });
    queryClient.invalidateQueries({
      queryKey: ["marketData"],
      refetchType: "active",
    });

    // Call optional refresh callback
    onRefresh?.();

    // Navigate to appropriate page
    if (loggedInUser) {
      navigate(`/@${loggedInUser}`);
    } else {
      navigate("/");
    }
  };

  const handleSearch = () => {
    if (searchUsername.trim()) {
      navigate(`/@${searchUsername.trim()}`);
    }
  };

  return (
    <div className="bg-slate-900 shadow-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLogoClick}
          >
            <div className="flex-shrink-0 flex items-center justify-center">
              <img
                src="/steem-logo.png"
                alt="Steem Wallet Logo"
                className="object-contain object-center rounded-full"
                style={{ width: "49px", height: "49px" }}
                draggable={false}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                Steem Wallet
              </h1>
              {selectedAccount && (
                <p className="text-xs sm:text-sm text-slate-400 truncate">
                  @{selectedAccount}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 flex-1 justify-end">
            <div className="relative hidden sm:flex flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
              <Input
                placeholder="Search username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 w-full text-sm bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {loggedInUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                    <img
                      src={getAvatarUrl(loggedInUser)}
                      alt={`@${loggedInUser}`}
                      className="w-9 h-9 rounded-full border-2 border-steemit-500 object-cover"
                      loading="lazy"
                      onError={handleAvatarError}
                    />
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 bg-slate-900 border-slate-700"
                >
                  {/* Current account section */}
                  <div className="px-2 py-2">
                    <p className="text-xs text-slate-400 mb-2">
                      Current Account
                    </p>
                    <div
                      className="flex items-center gap-3 p-2 rounded-lg bg-steemit-500/10 cursor-pointer hover:bg-steemit-500/20"
                      onClick={() => navigate(`/@${loggedInUser}`)}
                    >
                      <img
                        src={getAvatarUrl(loggedInUser)}
                        alt={`@${loggedInUser}`}
                        className="w-8 h-8 rounded-full object-cover"
                        loading="lazy"
                        onError={handleAvatarError}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          @{loggedInUser}
                        </p>
                      </div>
                      <Check className="w-4 h-4 text-steemit-500" />
                    </div>
                  </div>

                  {/* Other accounts */}
                  {storedAccounts.filter((a) => a.username !== loggedInUser)
                    .length > 0 && (
                    <>
                      <DropdownMenuSeparator className="bg-slate-700" />
                      <div className="px-2 py-2">
                        <p className="text-xs text-slate-400 mb-2">
                          Switch Account
                        </p>
                        {storedAccounts
                          .filter((a) => a.username !== loggedInUser)
                          .map((account) => (
                            <AccountListItem
                              key={account.username}
                              username={account.username}
                              isSwitching={isSwitchingAccount}
                              onSwitch={handleAccountSwitch}
                              onRemove={(username) => {
                                setAccountToRemove(username);
                                setShowRemoveAccountDialog(true);
                              }}
                            />
                          ))}
                      </div>
                    </>
                  )}

                  <DropdownMenuSeparator className="bg-slate-700" />

                  {/* Add account button */}
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setShowAddAccountDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2 text-steemit-500" />
                    <span>Add Another Account</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <LoginDialog onLoginSuccess={onLoginSuccess}>
                <Button
                  className="text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap flex-shrink-0"
                  size="sm"
                >
                  LOGIN
                </Button>
              </LoginDialog>
            )}

            {/* Add Account Dialog */}
            <LoginDialog
              onLoginSuccess={(username, method) => {
                onLoginSuccess(username, method);
                setShowAddAccountDialog(false);
              }}
              isOpen={showAddAccountDialog}
              onOpenChange={setShowAddAccountDialog}
            >
              <span className="hidden" />
            </LoginDialog>

            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px]">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Select a section to view</SheetDescription>
                </SheetHeader>
                <nav className="mt-8 space-y-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          activeTab === item.id
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : "hover:bg-slate-800 text-slate-300 hover:text-white"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Logout Button - appears at bottom if logged in */}
                {loggedInUser && (
                  <div className="mt-8 pt-4 border-t border-slate-700">
                    <button
                      onClick={() => {
                        setShowLogoutDialog(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-red-400 hover:bg-red-950/30 hover:text-red-300"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Logout</span>
                    </button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-red-500" />
              Logout?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? You'll need to log in again to
              access your wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLogoutDialog(false);
                onLogout?.();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Account Confirmation Dialog */}
      <AlertDialog
        open={showRemoveAccountDialog}
        onOpenChange={setShowRemoveAccountDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Remove Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove @{accountToRemove} from the app?
              You'll need to log in again to use this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAccountToRemove(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                accountToRemove && handleRemoveAccount(accountToRemove)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WalletHeader;
