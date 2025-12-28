
import { useState, useEffect } from "react";
import AccountSecurityOperations from "./AccountSecurityOperations";
import WitnessManagement from "./WitnessManagement";
import { useSteemAccount } from "@/hooks/useSteemAccount";
import { SecureStorageFactory } from '@/services/secureStorage';

const AccountOperations = () => {
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  
  // Load username from secure storage
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const user = await storage.getItem('steem_username');
        setLoggedInUser(user);
      } catch (error) {
        console.error('Error loading username from storage:', error);
      }
    };
    loadUsername();
  }, []);
  
  const { data: accountData } = useSteemAccount(loggedInUser || '');

  return (
    <div className="space-y-6">
      <AccountSecurityOperations 
        loggedInUser={loggedInUser}
        accountData={accountData}
      />
      <WitnessManagement loggedInUser={loggedInUser} />
    </div>
  );
};

export default AccountOperations;
