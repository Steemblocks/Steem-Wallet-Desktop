import * as React from "react"

// Desktop app - always return false for mobile detection
// Minimum window size is enforced in tauri.conf.json (900x650)
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Always return false since this is a desktop-only Tauri app
  return false
}
