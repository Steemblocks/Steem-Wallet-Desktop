import { useEffect, useRef } from "react"

/**
 * Smart toast positioning hook that ensures toasts are always visible
 * regardless of screen size or window minimization
 */
export function useSmartToastPosition() {
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Find the toast viewport element
    const findViewport = () => {
      const viewport = document.querySelector(
        "[data-radix-toast-viewport]"
      ) as HTMLDivElement | null
      return viewport
    }

    let viewport = findViewport()

    const updateToastVisibility = () => {
      viewport = viewport || findViewport()
      if (!viewport) return

      const rect = viewport.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth

      // Calculate if toast is visible in viewport
      const isPartiallyVisible = rect.bottom > 0 && rect.right > 0
      const isFullyVisible = rect.bottom < viewportHeight && rect.right < viewportWidth

      // If toast is cut off at bottom, move it up
      if (rect.bottom > viewportHeight) {
        const overshoot = rect.bottom - viewportHeight
        viewport.style.bottom = `${16 + overshoot}px`
        viewport.style.position = "fixed"
      }

      // If toast is cut off at right, move it left
      if (rect.right > viewportWidth) {
        const overshoot = rect.right - viewportWidth
        viewport.style.right = `${16 + overshoot}px`
        viewport.style.position = "fixed"
      }

      // If viewport is very small, center it
      if (viewportWidth < 480) {
        viewport.style.left = "50%"
        viewport.style.transform = "translateX(-50%)"
        viewport.style.right = "auto"
      } else {
        viewport.style.left = "auto"
        viewport.style.transform = "none"
      }
    }

    // Initial setup
    const timer = setTimeout(updateToastVisibility, 100)

    // Update on resize
    window.addEventListener("resize", updateToastVisibility)
    // Update when toasts change
    const observer = new MutationObserver(updateToastVisibility)

    viewport = viewport || findViewport()
    if (viewport) {
      observer.observe(viewport, { childList: true, subtree: true })
    }

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", updateToastVisibility)
      observer.disconnect()
    }
  }, [])

  return viewportRef
}
