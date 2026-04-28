"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/header"
import { User, Mail, CircleDot, PlayCircle, CheckCircle2, Clock3 } from "lucide-react"
import { toast } from "sonner"

type InquiryCounts = {
  total: number
  pending: number
  "in-progress": number
  resolved: number
  closed: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = (session?.user as any)?.role === "admin"
  const [counts, setCounts] = useState<InquiryCounts>({
    total: 0,
    pending: 0,
    "in-progress": 0,
    resolved: 0,
    closed: 0,
  })

  useEffect(() => {
    if (session?.user) {
      const checkUserRole = async () => {
        try {
          if ((session.user as any)?.role === "standard") {
            router.push("/")
          }
        } catch (error) {
          console.error("Error checking user role:", error)
        }
      }

      checkUserRole()
    }
  }, [session, router])

  useEffect(() => {
    if (!isAdmin) return

    const loadCounts = async () => {
      try {
        const res = await fetch("/api/v1/inquiries/admin", {
          credentials: "include",
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to load inquiry counts")
        }

        const inquiries = Array.isArray(data.data) ? data.data : []
        const nextCounts = inquiries.reduce(
          (acc: InquiryCounts, inquiry: any) => {
            acc.total += 1
            if (inquiry.status === "pending") acc.pending += 1
            if (inquiry.status === "in-progress") acc["in-progress"] += 1
            if (inquiry.status === "resolved") acc.resolved += 1
            if (inquiry.status === "closed") acc.closed += 1
            return acc
          },
          { total: 0, pending: 0, "in-progress": 0, resolved: 0, closed: 0 }
        )

        setCounts(nextCounts)
      } catch (error) {
        console.error("Failed to load inquiry counts:", error)
        toast.error("Failed to load inquiry counts")
      }
    }

    loadCounts()
    const interval = setInterval(loadCounts, 10000)
    return () => clearInterval(interval)
  }, [isAdmin])

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

                {isAdmin ? (
                  <Button variant="outline" className="shrink-0" asChild>
                    <Link href="/dashboard/records">View Records</Link>
                  </Button>
                ) : null}
              </div>

              {isAdmin ? (
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
      </main>
    </div>
  )
}
