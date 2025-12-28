
// Navigation is now in WalletHeader - this component is kept for compatibility
interface WalletNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const WalletNavigation = ({
  activeTab,
  onTabChange,
}: WalletNavigationProps) => {
  // Navigation moved to header, return null to keep component structure
  return null;
};

export default WalletNavigation;
