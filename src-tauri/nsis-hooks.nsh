; NSIS Hooks for Steem Wallet Desktop
; This file contains hooks that run during install/uninstall

; Hook that runs after uninstall completes
; Removes all app data including wallet storage, keys, and settings
!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove app data directory (contains wallet_storage.json with encrypted keys and settings)
  RMDir /r "$APPDATA\com.steemwallet.desktop"
  RMDir /r "$LOCALAPPDATA\com.steemwallet.desktop"
  
  ; Also clean up any WebView2 data
  RMDir /r "$LOCALAPPDATA\Steem Wallet Desktop"
!macroend
