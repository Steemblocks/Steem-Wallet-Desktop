/**
 * WebSocket Status Indicator
 * Shows the current WebSocket connection status
 */

import { memo } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useWebSocketConnection } from '@/hooks/useWebSocket';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface WebSocketStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const WebSocketStatus = memo(({ showLabel = false, size = 'sm' }: WebSocketStatusProps) => {
  const { isConnected, isConnecting, error, reconnect } = useWebSocketConnection();

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  if (isConnecting) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <RefreshCw className={`${iconSize} text-yellow-400 animate-spin`} />
            {showLabel && <span className="text-xs text-yellow-400">Connecting...</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Connecting to real-time server...</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isConnected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <div className="relative">
              <Wifi className={`${iconSize} text-emerald-400`} />
              <span className={`absolute -top-0.5 -right-0.5 ${dotSize} rounded-full bg-emerald-400 animate-pulse`} />
            </div>
            {showLabel && <span className="text-xs text-emerald-400">Live</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Real-time data streaming active</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          onClick={reconnect}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <WifiOff className={`${iconSize} text-slate-500`} />
          {showLabel && <span className="text-xs text-slate-500">Offline</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">
          {error ? 'Connection failed. Click to retry.' : 'Using polling mode. Click to reconnect.'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

WebSocketStatus.displayName = 'WebSocketStatus';

export default WebSocketStatus;
