"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"

type Notification = {
  _id: string
  title: string
  message: string
  href: string
  readAt?: string | null
  createdAt: string
}

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) return "Now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
}

export function NotificationMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const isMountedRef = useRef(true)

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/notifications", {
        credentials: "include",
        cache: "no-store",
      })
      const payload = await response.json()
      if (!response.ok || !isMountedRef.current) return

      setNotifications(payload.data || [])
      setUnreadCount(payload.unreadCount || 0)
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    void loadNotifications()
    const interval = window.setInterval(loadNotifications, 15000)
    const refresh = () => void loadNotifications()

    window.addEventListener("focus", refresh)
    return () => {
      isMountedRef.current = false
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
    }
  }, [loadNotifications])

  useEffect(() => {
    if (open) void loadNotifications()
  }, [open, loadNotifications])

  const hasNotifications = notifications.length > 0
  const unreadLabel = useMemo(() => (unreadCount > 9 ? "9+" : String(unreadCount)), [unreadCount])

  const markRead = async (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification._id === notificationId
          ? { ...notification, readAt: new Date().toISOString() }
          : notification
      )
    )
    setUnreadCount((current) => Math.max(0, current - 1))

    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ notificationId }),
    })
  }

  const markAllRead = async () => {
    if (loading || unreadCount === 0) return

    setLoading(true)
    const now = new Date().toISOString()
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || now })))
    setUnreadCount(0)

    try {
      await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ all: true }),
      })
    } finally {
      setLoading(false)
    }
  }

  const openNotification = async (notification: Notification) => {
    if (!notification.readAt) {
      await markRead(notification._id)
    }

    setOpen(false)
    router.push(notification.href || "/")
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 cursor-pointer rounded-lg text-foreground hover:bg-[#006AEE]/10 hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
              {unreadLabel}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <DropdownMenuLabel className="px-0 py-0">Notifications</DropdownMenuLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer gap-1 px-2 text-xs"
            disabled={unreadCount === 0 || loading}
            onClick={(event) => {
              event.preventDefault()
              void markAllRead()
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="my-0" />
        {hasNotifications ? (
          <ScrollArea className="max-h-[24rem]">
            <div className="p-1">
              {notifications.map((notification) => {
                const unread = !notification.readAt

                return (
                  <button
                    key={notification._id}
                    type="button"
                    className="flex w-full cursor-pointer gap-3 rounded-md px-3 py-2 text-left hover:bg-[#006AEE]/10 focus:bg-[#006AEE]/10 focus:outline-none"
                    onClick={() => void openNotification(notification)}
                  >
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-[#006AEE]" : "bg-transparent"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                        {notification.title}
                      </span>
                      <span className={`mt-0.5 line-clamp-2 block text-xs ${unread ? "font-semibold text-slate-700" : "text-muted-foreground"}`}>
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
