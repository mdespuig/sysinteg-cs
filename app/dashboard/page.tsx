"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/header"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ClipboardList, User, Mail, CircleDot, PlayCircle, CheckCircle2, Clock3, Megaphone } from "lucide-react"
import { toast } from "sonner"

type InquiryCounts = {
  total: number
  pending: number
  "in-progress": number
  resolved: number
  closed: number
}

type AnnouncementAudience = "standard" | "staff"
type AnnouncementAudienceExtended = AnnouncementAudience | "all"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = (session?.user as any)?.role
  const isAdmin = role === "admin"
  const canViewRecords = role === "admin" || role === "staff"
  const [announcement, setAnnouncement] = useState("")
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)
  const [announcementConfirmOpen, setAnnouncementConfirmOpen] = useState(false)
  const [announcementTarget, setAnnouncementTarget] = useState<AnnouncementAudienceExtended>("all")
  const [counts, setCounts] = useState<InquiryCounts>({
    total: 0,
    pending: 0,
    "in-progress": 0,
    resolved: 0,
    closed: 0,
  })

  useEffect(() => {
    if (status !== "authenticated") return
    if ((session?.user as any)?.role === "standard") {
      router.replace("/")
    }
  }, [status, session?.user, router])

  useEffect(() => {
    if (!canViewRecords) return

    let isActive = true
    let controller: AbortController | null = null

    const loadCounts = async () => {
      controller?.abort()
      controller = new AbortController()

      try {
        const res = await fetch("/api/v1/inquiries/admin?summary=true", {
          credentials: "include",
          signal: controller.signal,
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to load inquiry counts")
        }

        const nextCounts = data.summary || {
          total: 0,
          pending: 0,
          "in-progress": 0,
          resolved: 0,
          closed: 0,
        }

        if (isActive) {
          setCounts(nextCounts)
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        console.error("Failed to load inquiry counts:", error)
        if (isActive) {
          toast.error("Failed to load inquiry counts")
        }
      }
    }

    void loadCounts()
    const interval = setInterval(loadCounts, 10000)
    return () => {
      isActive = false
      controller?.abort()
      clearInterval(interval)
    }
  }, [canViewRecords])

  const sendAnnouncement = async (targetRole: AnnouncementAudienceExtended) => {
    if (!announcement.trim() || savingAnnouncement) return

    setSavingAnnouncement(true)
    try {
      const res = await fetch("/api/v1/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "Announcement", message: announcement, targetRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send announcement")

      setAnnouncement("")
      setAnnouncementConfirmOpen(false)
      toast.success(
        targetRole === "standard"
          ? "Announcement sent to standard users"
          : targetRole === "staff"
          ? "Announcement sent to staff"
          : "Announcement sent to all users"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send announcement")
    } finally {
      setSavingAnnouncement(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    )
  }

  if (status === "unauthenticated") {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">
            Welcome back, {session?.user?.name}!
          </h1>
          <p className="text-muted-foreground">
            Here's your healthcare dashboard. View account details and inquiry status at a glance.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-medium">{session?.user?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{session?.user?.email}</p>
                </div>
              </div>
              <div className="mt-auto pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/profile">Edit Profile</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Medical Records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Inquiries</p>
                  <p className="text-2xl font-bold">{counts.total}</p>
                </div>

                {canViewRecords ? (
                  <Button variant="outline" className="shrink-0" asChild>
                    <Link href="/dashboard/records">View Records</Link>
                  </Button>
                ) : null}
              </div>

              {canViewRecords ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <CircleDot className="h-4 w-4 text-amber-500" />
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <p className="text-xl font-semibold">{counts.pending}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <PlayCircle className="h-4 w-4 text-blue-500" />
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                    <p className="text-xl font-semibold">{counts["in-progress"]}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <p className="text-xs text-muted-foreground">Resolved</p>
                    </div>
                    <p className="text-xl font-semibold">{counts.resolved}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-500" />
                      <p className="text-xs text-muted-foreground">Closed</p>
                    </div>
                    <p className="text-xl font-semibold">{counts.closed}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {isAdmin ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Announcements
                </CardTitle>
                <CardDescription>Send an announcement to users.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <Textarea
                  value={announcement}
                  onChange={(event) => setAnnouncement(event.target.value)}
                  placeholder="Write an announcement..."
                  rows={5}
                  className="resize-none bg-white"
                  maxLength={500}
                />
                <div className="mt-auto flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{announcement.trim().length}/500</p>
                  <Button
                    type="button"
                    className="cursor-pointer"
                    disabled={!announcement.trim() || savingAnnouncement}
                    onClick={() => setAnnouncementConfirmOpen(true)}
                  >
                    {savingAnnouncement ? "Sending..." : "Send Announcement"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Audit Logs
                </CardTitle>
                <CardDescription>Review staff activity with complete details and timestamps.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Track staff actions such as assigned inquiries, rejected tickets, status changes, and conversation activity.
                </p>
                <div className="mt-auto pt-4">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/dashboard/audit-logs">View Audit Logs</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>

      <Dialog open={announcementConfirmOpen} onOpenChange={setAnnouncementConfirmOpen}>
        <DialogContent className="sm:max-w-lg [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle>Send Announcement</DialogTitle>
            <DialogDescription>
              Review the announcement before choosing the recipient group.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
            <p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm text-foreground">
              {announcement.trim()}
            </p>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] text-muted-foreground">
                  Recipient
                </p>
                <p className="text-[10px] font-medium text-foreground">
                  {announcementTarget === "all"
                    ? "All"
                    : announcementTarget === "standard"
                    ? "Standard Users"
                    : "Staff"}
                </p>
              </div>

              <RadioGroup
                value={announcementTarget}
                onValueChange={(value) => setAnnouncementTarget(value as AnnouncementAudienceExtended)}
                className="grid gap-3 sm:grid-cols-3"
              >
                {[
                  {
                    value: "all",
                    title: "All",
                    description: "Send to all users",
                  },
                  {
                    value: "standard",
                    title: "Standard Users",
                    description: "Send to customers only",
                  },
                  {
                    value: "staff",
                    title: "Staff",
                    description: "Send to staff members only",
                  },
                ].map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`announcement-target-${option.value}`}
                    className={`group relative flex cursor-pointer flex-col gap-2 rounded-xl border bg-background p-3 transition-all hover:border-primary/50 hover:bg-primary/5 ${
                      announcementTarget === option.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="block text-sm font-medium text-foreground">
                          {option.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                      <RadioGroupItem
                        id={`announcement-target-${option.value}`}
                        value={option.value}
                        className="mt-0.5 size-5 border-muted-foreground/30 bg-background text-primary shadow-none transition-transform group-hover:scale-105"
                      />
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={savingAnnouncement}
              onClick={() => setAnnouncementConfirmOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={savingAnnouncement}
              onClick={() => void sendAnnouncement(announcementTarget)}
            >
              {savingAnnouncement ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
