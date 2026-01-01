import { useToast } from "@/hooks/use-toast"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const toastContent = (
    <ToastProvider duration={3000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} duration={3000} {...props}>
            <div className="grid gap-1 w-full" style={{ overflow: "visible" }}>
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )

  // Render directly to document body - completely independent
  return createPortal(toastContent, document.body)
}
