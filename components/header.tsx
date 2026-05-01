"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { HeartPulse, LogOut, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { NotificationMenu } from "@/components/notification-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

type HeaderProps = {
  showRecordsNav?: boolean
  hidePrivilegedNav?: boolean
}

export function Header({ showRecordsNav = false, hidePrivilegedNav = false }: HeaderProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role
  const isPrivilegedUser = role === "admin" || role === "staff"
  const isAdmin = role === "admin"
  const showDashboardLink = pathname === "/"
  const [profileImage, setProfileImage] = useState<string | null>(null)

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: "/auth/login", redirect: true })
      toast.success("Logged out successfully")
    } catch (error) {
      console.error("Logout failed:", error)
      toast.error("Failed to log out. Please try again.")
    }
  }

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfileImage(null)
      return
    }

    let isActive = true
    const controller = new AbortController()
    const cacheKey = `profile-avatar:${userId}`
    const cachedImage = window.localStorage.getItem(cacheKey)
    setProfileImage(cachedImage || null)

    const syncAvatar = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string; profileImage?: string | null }>
      if (customEvent.detail?.userId === userId) {
        setProfileImage(customEvent.detail.profileImage ?? null)
      }
    }

    window.addEventListener("profile-avatar-updated", syncAvatar)

    const loadAvatar = async () => {
      try {
        const response = await fetch(`/api/v1/profile?userId=${userId}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!isActive) return

        const data = await response.json()
        const nextImage = response.ok ? data.data?.profileImage ?? null : null
        setProfileImage(nextImage)
        window.localStorage.setItem(cacheKey, nextImage ?? "")
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        console.error("Failed to load header avatar:", error)
      }
    }

    loadAvatar()

    return () => {
      isActive = false
      controller.abort()
      window.removeEventListener("profile-avatar-updated", syncAvatar)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return

    let isActive = true

    const sendHeartbeat = async () => {
      try {
        if (!isActive) return
        await fetch("/api/v1/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ state: "online" }),
        })
      } catch {
        return
      }
    }

    const sendOffline = () => {
      const payload = new Blob([JSON.stringify({ state: "offline" })], {
        type: "application/json",
      })
      navigator.sendBeacon?.("/api/v1/presence", payload)
    }

    void sendHeartbeat()
    const interval = window.setInterval(sendHeartbeat, 15000)
    window.addEventListener("pagehide", sendOffline)

    return () => {
      isActive = false
      window.clearInterval(interval)
      window.removeEventListener("pagehide", sendOffline)
    }
  }, [session?.user?.id])

  const avatarLetter = session?.user?.name?.[0]?.toUpperCase() || "U"

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
      <div className="container mx-auto grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4">
        <Link href="/" className="flex items-center gap-2 justify-self-start">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <HeartPulse className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">Linepoint</span>
        </Link>

        <nav className="hidden grid-flow-col auto-cols-[8.75rem] items-center justify-center gap-2 md:grid justify-self-center">
          {isPrivilegedUser && !hidePrivilegedNav ? (
            <>
              {showDashboardLink ? (
                <Link href="/dashboard" className="flex h-9 items-center justify-center whitespace-nowrap rounded-md text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-[#006AEE]/10 hover:text-foreground">
                  Dashboard
                </Link>
              ) : null}
              {isAdmin && showRecordsNav ? (
                <Link href="/dashboard/records" className="flex h-9 items-center justify-center whitespace-nowrap rounded-md text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-[#006AEE]/10 hover:text-foreground">
                  Medical Records
                </Link>
              ) : null}
            </>
          ) : !isPrivilegedUser ? (
            <>
              <Link href="/support" className="flex h-9 items-center justify-center whitespace-nowrap rounded-md text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-[#006AEE]/10 hover:text-foreground">
                Contact Support
              </Link>
              <Link href="/#about" className="flex h-9 items-center justify-center whitespace-nowrap rounded-md text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-[#006AEE]/10 hover:text-foreground">
                About Us
              </Link>
              <Link href="/#services" className="flex h-9 items-center justify-center whitespace-nowrap rounded-md text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-[#006AEE]/10 hover:text-foreground">
                Other Systems
              </Link>
            </>
          ) : null}
        </nav>

        <div className="flex items-center justify-self-end gap-2">
          {session?.user ? (
            <>
              <NotificationMenu />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[#006AEE]/10 hover:text-foreground cursor-pointer">
                    <Avatar className="h-8 w-8">
                      {profileImage ? (
                        <AvatarImage src={profileImage} alt="Profile avatar" className="h-full w-full object-cover" />
                      ) : (
                        <AvatarFallback
                          className="bg-[#006AEE] text-sm font-semibold text-white"
                        >
                          {avatarLetter}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="text-sm font-medium text-foreground hidden sm:inline">
                      {session.user.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link
                      href="/profile"
                      className="cursor-pointer flex items-center gap-2 data-highlighted:bg-[#006AEE]/10 data-highlighted:text-foreground hover:bg-[#006AEE]/10 hover:text-foreground"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer flex items-center gap-2 text-red-600 data-highlighted:bg-[#006AEE]/10 data-highlighted:text-red-600 hover:bg-[#006AEE]/10 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
