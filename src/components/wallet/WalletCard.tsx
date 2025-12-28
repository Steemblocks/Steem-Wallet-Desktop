
import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface WalletCardProps {
  title: string;
  description: string;
  amount: string;
  currency: string;
  subtitle?: string;
  variant?: 'default' | 'steem' | 'sbd' | 'sp' | 'savings';
  actionButton?: ReactNode;
  headerAction?: ReactNode;
  icon?: ReactNode;
  priceChange?: number;
  secondaryAmount?: string;
  secondaryCurrency?: string;
}

const WalletCard = ({ 
  title, 
  description, 
  amount, 
  currency, 
  subtitle, 
  variant = 'default',
  actionButton,
  headerAction,
  icon,
  priceChange,
  secondaryAmount,
  secondaryCurrency
}: WalletCardProps) => {
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'steem':
        return {
          card: 'bg-gradient-to-br from-slate-800/90 via-slate-800/70 to-steemit-950/50 border-steemit-500/20 hover:border-steemit-500/40',
          iconBg: 'bg-steemit-500/15 ring-1 ring-steemit-500/30',
          iconColor: 'text-steemit-400',
          amountColor: 'text-white',
          currencyColor: 'text-steemit-400',
          glow: 'shadow-steemit-500/5'
        };
      case 'sbd':
        return {
          card: 'bg-gradient-to-br from-slate-800/90 via-slate-800/70 to-emerald-950/50 border-emerald-500/20 hover:border-emerald-500/40',
          iconBg: 'bg-emerald-500/15 ring-1 ring-emerald-500/30',
          iconColor: 'text-emerald-400',
          amountColor: 'text-white',
          currencyColor: 'text-emerald-400',
          glow: 'shadow-emerald-500/5'
        };
      case 'sp':
        return {
          card: 'bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-purple-900/40 border-blue-500/20 hover:border-blue-500/40',
          iconBg: 'bg-blue-500/15 ring-1 ring-blue-500/30',
          iconColor: 'text-blue-400',
          amountColor: 'text-white',
          currencyColor: 'text-blue-400',
          glow: 'shadow-blue-500/5'
        };
      case 'savings':
        return {
          card: 'bg-gradient-to-br from-slate-800/90 via-amber-950/20 to-orange-950/30 border-amber-500/20 hover:border-amber-500/40',
          iconBg: 'bg-amber-500/15 ring-1 ring-amber-500/30',
          iconColor: 'text-amber-400',
          amountColor: 'text-white',
          currencyColor: 'text-amber-400',
          glow: 'shadow-amber-500/5'
        };
      default:
        return {
          card: 'bg-slate-800/50 border-slate-700 hover:border-slate-600',
          iconBg: 'bg-slate-700/50 ring-1 ring-slate-600/50',
          iconColor: 'text-slate-400',
          amountColor: 'text-white',
          currencyColor: 'text-slate-400',
          glow: ''
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${styles.card} ${styles.glow} border backdrop-blur-sm group`}>
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-white/5 to-transparent rounded-full -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-white/3 to-transparent rounded-full -ml-16 -mb-16"></div>
      </div>
      
      <CardContent className="p-5 relative z-10">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`p-2.5 rounded-xl ${styles.iconBg} ${styles.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
          {headerAction && (
            <div className="flex-shrink-0">
              {headerAction}
            </div>
          )}
        </div>
        
        {/* Amount Section */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold tracking-tight ${styles.amountColor}`}>
                  {amount}
                </span>
                <span className={`text-sm font-semibold ${styles.currencyColor}`}>
                  {currency}
                </span>
              </div>
              
              {/* Secondary Amount (for savings) */}
              {secondaryAmount && secondaryCurrency && (
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-lg font-semibold text-slate-300">
                    {secondaryAmount}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {secondaryCurrency}
                  </span>
                </div>
              )}
            </div>
            
            {/* Price Change Badge */}
            {priceChange !== undefined && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                priceChange >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
              }`}>
                {priceChange >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            )}
          </div>
          
          {/* Subtitle / USD Value */}
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium">
              {subtitle}
            </p>
          )}
          
          {/* Action Buttons */}
          {actionButton && (
            <div className="pt-3 border-t border-slate-700/50">
              {actionButton}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletCard;
