import { memo } from "react";
import { ThumbsUp, ThumbsDown, Battery, RefreshCw, Clock } from "lucide-react";
import { useWalletData } from "@/contexts/WalletDataContext";

// Horizontal bar meter with gradient and glow effect
const PowerBar = memo(({ 
  value, 
  label,
  icon,
  color,
  glowColor,
  rechargeTime
}: { 
  value: number; 
  label: string;
  icon: React.ReactNode;
  color: string;
  glowColor: string;
  rechargeTime?: string;
}) => {
  const percentage = Math.min(value, 100);
  const isLow = percentage < 30;
  const isFull = percentage >= 99.5;
  
  return (
    <div className="flex items-center gap-3 group">
      {/* Icon with background */}
      <div className={`w-8 h-8 rounded-lg ${color} bg-opacity-15 flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      
      {/* Progress section */}
      <div className="flex-1 min-w-0">
        {/* Label row */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-300">{label}</span>
          <div className="flex items-center gap-2">
            {rechargeTime && rechargeTime !== "Full" && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {rechargeTime}
              </span>
            )}
            <span className={`text-sm font-bold tabular-nums ${
              isLow ? 'text-red-400' : isFull ? 'text-emerald-400' : color.replace('bg-', 'text-')
            }`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-2.5 bg-slate-800/80 rounded-full overflow-hidden relative">
          {/* Glow effect */}
          <div 
            className={`absolute inset-y-0 left-0 ${glowColor} blur-sm opacity-50 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
          {/* Main bar */}
          <div 
            className={`h-full rounded-full relative ${color} transition-all duration-700 ease-out overflow-hidden`}
            style={{ width: `${percentage}%` }}
          >
            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 rounded-full" />
            
            {/* Animated effects - only when not full */}
            {!isFull && (
              <>
                {/* Rising bubbles */}
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full bg-white/60 will-change-transform"
                      style={{
                        width: `${3 + (i % 3)}px`,
                        height: `${3 + (i % 3)}px`,
                        left: `${15 + i * 15}%`,
                        bottom: '-4px',
                        animation: `bubble ${1.5 + (i * 0.3)}s ease-in infinite ${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
                
                {/* Scanning light beam */}
                <div 
                  className="absolute inset-y-0 w-8 rounded-full will-change-transform"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    animation: 'scanBeam 2s ease-in-out infinite',
                    left: 0,
                  }}
                />
                
                {/* Subtle wave on top edge */}
                <div 
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 25%, transparent 50%, rgba(255,255,255,0.8) 75%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'waveShine 1.5s linear infinite',
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PowerBar.displayName = 'PowerBar';

interface AccountPowerMetersProps {
  username: string;
}

// Memoized component to prevent unnecessary re-renders
const AccountPowerMeters = memo(({ username }: AccountPowerMetersProps) => {
  // Use preloaded data from context
  const { data, isInitialLoading, isRefreshing } = useWalletData();
  const manaData = data.powerMeterData;

  // Show loading only if we're still in initial loading AND don't have data yet
  const isLoading = isInitialLoading && !manaData;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700/40 animate-pulse overflow-hidden flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Account Status</h3>
              <p className="text-xs text-slate-500">Resource meters</p>
            </div>
          </div>
          <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        {/* Loading skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-700/40 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <div className="w-20 h-3 bg-slate-700/40 rounded animate-pulse" />
                  <div className="w-12 h-3 bg-slate-700/40 rounded animate-pulse" />
                </div>
                <div className="h-2.5 bg-slate-700/40 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        {/* Vote value skeleton */}
        <div className="mt-5 pt-4 border-t border-slate-700/30">
          <div className="flex items-center justify-between">
            <div className="w-24 h-4 bg-slate-700/40 rounded animate-pulse" />
            <div className="w-28 h-6 bg-slate-700/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!manaData) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-5">
        <div className="flex items-center gap-3">
          <img 
            src={`https://steemitimages.com/u/${username}/avatar`}
            alt={username}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 border-slate-600"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${username}`;
            }}
          />
          <span className="text-sm text-slate-400">Unable to load account status</span>
        </div>
      </div>
    );
  }

  // Calculate vote power percentage for the vote value indicator
  const vpPercent = manaData.votingPower;
  
  // Calculate a "power score" based on all three metrics
  const powerScore = Math.round((manaData.votingPower + manaData.downvotePower + manaData.resourceCredits) / 3);
  
  // Determine overall status
  const getStatusInfo = () => {
    if (powerScore >= 90) return { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    if (powerScore >= 70) return { label: 'Good', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (powerScore >= 50) return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (powerScore >= 30) return { label: 'Low', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    return { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20' };
  };
  const statusInfo = getStatusInfo();

  return (
    <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-5 h-full flex flex-col">
      {/* Header with Power Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={`https://steemitimages.com/u/${username}/avatar`}
              alt={username}
              className="w-11 h-11 rounded-full object-cover flex-shrink-0 border-2 border-emerald-500/30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${username}`;
              }}
            />
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">@{username}</h3>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] text-slate-500">{powerScore}% Power</span>
            </div>
          </div>
        </div>
        {isRefreshing ? (
          <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" style={{ animationDuration: '2s' }} />
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Live</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Power Meters - Compact */}
      <div className="space-y-3 flex-1">
        <PowerBar
          value={manaData.votingPower}
          label="Voting Power"
          icon={<ThumbsUp className="w-4 h-4 text-emerald-400" />}
          color="bg-emerald-500"
          glowColor="bg-emerald-400"
          rechargeTime={manaData.votingRechargeTime}
        />
        <PowerBar
          value={manaData.downvotePower}
          label="Downvote Power"
          icon={<ThumbsDown className="w-4 h-4 text-orange-400" />}
          color="bg-orange-500"
          glowColor="bg-orange-400"
          rechargeTime={manaData.downvoteRechargeTime}
        />
        <PowerBar
          value={manaData.resourceCredits}
          label="Resource Credits"
          icon={<Battery className="w-4 h-4 text-blue-400" />}
          color="bg-blue-500"
          glowColor="bg-blue-400"
          rechargeTime={manaData.rcRechargeTime}
        />
      </div>

      {/* Vote Value Section - Enhanced */}
      <div className="mt-4 pt-4 border-t border-slate-700/30">
        <div className="grid grid-cols-2 gap-3">
          {/* Current Vote Value */}
          <div className="rounded-lg bg-slate-800/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Current Vote</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                ${manaData.voteValue.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">at {vpPercent.toFixed(0)}% VP</span>
          </div>
          
          {/* Max Vote Value */}
          <div className="rounded-lg bg-slate-800/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Max Vote</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                ${manaData.fullVoteValue.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">at 100% VP</span>
          </div>
        </div>
      </div>
    </div>
  );
});

AccountPowerMeters.displayName = 'AccountPowerMeters';

export default AccountPowerMeters;
