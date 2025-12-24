"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export type NotificationType = "success" | "error" | "info" | "warning"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationToastProps {
  notification: Notification | null
  onDismiss: () => void
}

export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (notification) {
      setIsVisible(true)
      const duration = notification.duration || 5000
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Wait for animation
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [notification, onDismiss])

  if (!notification) return null

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
  }

  const colors = {
    success: "bg-green-500/10 border-green-500/20 text-green-400",
    error: "bg-red-500/10 border-red-500/20 text-red-400",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  }

  const Icon = icons[notification.type]

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 right-4 z-50 w-full max-w-md"
        >
          <div className={`rounded-lg border p-4 shadow-lg ${colors[notification.type]}`}>
            <div className="flex items-start gap-3">
              <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{notification.title}</h4>
                {notification.message && (
                  <p className="text-xs mt-1 opacity-90">{notification.message}</p>
                )}
                {notification.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-6 text-xs"
                    onClick={notification.action.onClick}
                  >
                    {notification.action.label}
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => {
                  setIsVisible(false)
                  setTimeout(onDismiss, 300)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Hook to manage notifications
 */
export function useNotifications() {
  const [notification, setNotification] = useState<Notification | null>(null)

  const showNotification = (notif: Omit<Notification, "id">) => {
    const id = `notification-${Date.now()}-${Math.random()}`
    setNotification({ ...notif, id })
  }

  const dismissNotification = () => {
    setNotification(null)
  }

  return {
    notification,
    showNotification,
    dismissNotification,
  }
}

