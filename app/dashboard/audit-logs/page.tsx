"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { redirect, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type AuditLog = {
  _id: string
  action: string
  actorId?: string | null
  actorName?: string | null
  actorRole?: "admin" | "staff"
  staffId?: string | null
  staffName?: string | null
  inquiryId?: string | null
  title: string
  description: string
  metadata?: Record<string, unknown>
  createdAt: string
}

function formatDateTime(value?: string) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return "N/A"

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

function formatAction(value: string) {
  return value.replace(/\./g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function AuditLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)
  const isAdmin = (session?.user as any)?.role === "admin"

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      redirect("/auth/login")
    }
    if (session && !isAdmin) {
      router.replace("/dashboard")
    }
  }, [status, session, isAdmin, router])

  const loadAuditLogs = useCallback(async (showLoader = false) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    if (showLoader) setLoading(true)

    try {
      const res = await fetch("/api/v1/audit-logs", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load audit logs")

      setLogs(data.data || [])
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      toast.error(error instanceof Error ? error.message : "Failed to load audit logs")
      setLogs([])
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return

    void loadAuditLogs(true)
    return () => {
      controllerRef.current?.abort()
    }
  }, [isAdmin, loadAuditLogs])

  const emptyState = useMemo(() => {
    if (loading) return "Loading audit logs..."
    return "No audit activity has been logged yet."
  }, [loading])

  if (status === "loading" || (session && !isAdmin)) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pb-8">
        <div className="mb-6 mt-6 flex shrink-0 items-center justify-between">
          <Button variant="ghost" asChild className="cursor-pointer">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="flex-1 text-center text-3xl font-bold">Audit Logs</h1>
          <span aria-hidden="true" className="w-21" />
        </div>

        <div className="rounded-3xl border border-blue-100 bg-[#F8FFFE] p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.08),0_12px_30px_rgba(59,130,246,0.08)]">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Activity Records</h2>
              <p className="mt-1 text-xs text-slate-500">
                Admin and staff activity with complete details and timestamps.
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => void loadAuditLogs(true)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-[#006AEE] bg-[#006AEE] p-0 text-[#F8FFFE] hover:border-[#006AEE] hover:bg-[#F8FFFE] hover:text-[#006AEE]"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="max-h-[calc(100vh-17rem)] overflow-auto rounded-3xl border border-blue-100 bg-[#F8FFFE]">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {emptyState}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <p className="text-base font-medium text-slate-700">{emptyState}</p>
              </div>
            ) : (
              <table className="w-full table-auto border-collapse text-sm">
                <thead className="bg-[#F8FFFE] text-blue-600">
                  <tr className="border-b border-blue-100">
                    <th className="w-44 px-4 py-3 text-left font-semibold">Timestamp</th>
                    <th className="w-40 px-4 py-3 text-left font-semibold">Actor</th>
                    <th className="w-28 px-4 py-3 text-left font-semibold">Action</th>
                    <th className="w-24 px-4 py-3 text-left font-semibold">Inquiry</th>
                    <th className="px-4 py-3 text-left font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-b border-slate-100 bg-[#F8FFFE] transition-colors hover:bg-[#ABE4FD]">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-36">
                          <p className="font-medium text-slate-950">{log.actorName || log.staffName || "Unknown"}</p>
                          <p className="text-xs text-slate-500">{log.actorRole || "staff"}</p>
                        </div>
                      </td>
                      <td className="w-28 px-4 py-3">
                        <span className="inline-flex max-w-24 items-center justify-center rounded-md border border-blue-100 bg-[#D2F1FF] px-2 py-0.5 text-center text-[11px] font-medium leading-tight text-blue-700">
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                        {log.inquiryId || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-md whitespace-normal">
                          <p className="text-xs text-slate-500">{log.description}</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
