import { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface AppLoadingScreenProps {
  progress: number;
  stage: string;
}

const AppLoadingScreen = memo(({ progress, stage }: AppLoadingScreenProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 p-8">
        {/* Logo/Brand - Same size as initial loader (64px) for seamless transition */}
        <div className="relative">
          <div className="flex items-center justify-center">
            <img 
              src="/steem-logo.png" 
              alt="Steem Wallet Logo" 
              className="object-contain drop-shadow-2xl"
              width={64}
              height={64}
              style={{ 
                width: 64, 
                height: 64, 
                maxWidth: 64, 
                maxHeight: 64,
                minWidth: 64,
                minHeight: 64,
                transform: 'translateZ(0)',
              }}
            />
          </div>
          {/* Pulsing ring animation */}
          <div className="absolute inset-0 rounded-full bg-steemit-500/20 animate-ping opacity-30" style={{ animationDuration: '2s' }} />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Steem Wallet</h1>
          <p className="text-slate-400 text-sm">Secure & Fast</p>
        </div>

        {/* Progress Section */}
        <div className="w-72 space-y-3">
          {/* Progress Bar */}
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-steemit-500 to-steemit-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
            {/* Shimmer effect */}
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Progress Text */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {stage}
            </span>
            <span className="text-slate-500 font-mono">{progress}%</span>
          </div>
        </div>

        {/* Loading Tips */}
        <div className="text-center max-w-xs">
          <p className="text-slate-500 text-xs">
            Loading all data at once for faster navigation...
          </p>
        </div>
      </div>

      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-steemit-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-steemit-600/10 rounded-full blur-3xl" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>
    </div>
  );
});

AppLoadingScreen.displayName = 'AppLoadingScreen';

export default AppLoadingScreen;
