"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CheckCircle2,
  Clock3,
  ListTodo,
  Loader2,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { getStatusLabel, type Inquiry } from "@/lib/inquiry-data"
import { Header } from "@/components/header"
import Link from "next/link"

type SortableInquiry = Inquiry & {
  _id?: string
  userLabel?: string
  assignedStaff?: string
  assignedStaffId?: string | null
  resolvedBy?: string | null
}

export default function RecordsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<SortableInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState("5")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [assigningInquiryId, setAssigningInquiryId] = useState<string | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedInquiry, setSelectedInquiry] = useState<SortableInquiry | null>(null)
  const isMountedRef = useRef(true)
  const inquiriesControllerRef = useRef<AbortController | null>(null)

  const isAdmin = (session?.user as any)?.role === "admin"
  const isStaff = (session?.user as any)?.role === "staff"
  const staffId = (session?.user as any)?.id as string | undefined
  const canViewRecords = isAdmin || isStaff

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      inquiriesControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.replace("/auth/login")
      return
    }

    const role = (session.user as any)?.role

    if (role === "standard") {
      router.replace("/")
      return
    }

    if (!canViewRecords) {
      router.replace("/")
    }
  }, [status, session, canViewRecords, router])

  const loadData = useCallback(async (showLoader = false) => {
    try {
      inquiriesControllerRef.current?.abort()
      const controller = new AbortController()
      inquiriesControllerRef.current = controller

      if (showLoader) {
        if (isMountedRef.current) {
          setLoading(true)
        }
      }
      const res = await fetch("/api/v1/inquiries/admin", {
        credentials: "include",
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load inquiries")
      if (isMountedRef.current) {
        setItems((data.data || []).map((item: any) => ({
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          userLabel: item.userLabel || item.email || "Unknown User",
          assignedStaff: item.assignedStaff || "Unassigned",
        })))
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      if (isMountedRef.current) {
        toast.error(error instanceof Error ? error.message : "Failed to load inquiries")
        setItems([])
      }
    } finally {
      if (showLoader) {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (!canViewRecords) return

    void loadData(true)
    const interval = setInterval(() => {
      void loadData()
    }, 10000)

    return () => clearInterval(interval)
  }, [canViewRecords, loadData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesSearch = [item.id, item.userLabel, item.email, item.status, item.type, item.assignedStaff].some((v) =>
        String(v).toLowerCase().includes(q)
      )
      const matchesType = typeFilter === "all" || item.type === typeFilter
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [items, search, typeFilter, statusFilter])

  const hasSearch = search.trim().length > 0
  const hasTypeFilter = typeFilter !== "all"
  const hasStatusFilter = statusFilter !== "all"
  const activeFilters = [hasSearch, hasTypeFilter, hasStatusFilter].filter(Boolean).length
  const emptyStateTitle =
    activeFilters === 3
      ? "No inquiries match your search, type, and status"
      : activeFilters === 2 && hasSearch && hasTypeFilter
        ? "No inquiries match your search and type"
        : activeFilters === 2 && hasSearch && hasStatusFilter
          ? "No inquiries match your search and status"
          : activeFilters === 2 && hasTypeFilter && hasStatusFilter
            ? "No inquiries match the selected type and status"
            : hasSearch
              ? "No inquiries match your search"
              : hasTypeFilter
                ? "No inquiries match the selected type"
                : hasStatusFilter
                  ? "No inquiries match the selected status"
                  : "No inquiries found"
  const emptyStateMessage =
    activeFilters >= 2
      ? "Try adjusting your search or filters."
      : hasSearch
        ? "Try adjusting your search terms."
        : hasTypeFilter || hasStatusFilter
          ? "Try selecting a different filter."
          : "There are no inquiries to show right now."

  const size = Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(filtered.length / size))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * size, safePage * size)
  const selectedCount = selectedIds.length
  const selectedTotal = filtered.length
  const staffCurrentInquiry = useMemo(() => {
    if (!staffId) return null
    return items.find((item) => item.assignedStaffId === staffId && item.status === "in-progress") || null
  }, [items, staffId])
  const staffStats = useMemo(() => {
    if (!staffId) {
      return {
        available: 0,
        unresolved: 0,
        resolved: 0,
      }
    }

    return {
      available: items.filter((item) => item.status === "pending").length,
      unresolved: staffCurrentInquiry ? 1 : 0,
      resolved: items.filter((item) => item.assignedStaffId === staffId && item.status === "resolved").length,
    }
  }, [items, staffCurrentInquiry, staffId])
  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.status === "pending") acc.pending += 1
        if (item.status === "in-progress") acc.inProgress += 1
        if (item.status === "resolved") acc.resolved += 1
        if (item.status === "closed") acc.closed += 1
        return acc
      },
      {
        total: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
      }
    )
  }, [items])

  const formatInquiryType = (type: string) => {
    return type.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const formatDateTime = (value?: Date | string) => {
    const parsed = value instanceof Date ? value : value ? new Date(value) : null
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return "N/A"
    }
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed)
  }

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, typeFilter, statusFilter])

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filtered.some((item) => item.id === id)))
  }, [filtered])

  const openDeleteDialog = (ids: string[]) => {
    if (ids.length === 0) {
      toast.error("Select at least one inquiry to delete")
      return
    }

    setDeleteTargetIds(ids)
    setDeleteDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    openDeleteDialog([id])
  }

  const handleBulkDelete = () => {
    openDeleteDialog(selectedIds)
  }

  const openInquiryDetails = (inquiry: SortableInquiry) => {
    setSelectedInquiry(inquiry)
    setDetailsDialogOpen(true)
  }

  const handleSeeMessagesPlaceholder = () => {
    toast("See Messages is coming soon.")
  }

  const handleAssignInquiry = async (inquiryId: string) => {
    if (assigningInquiryId) return

    setAssigningInquiryId(inquiryId)
    try {
      const res = await fetch("/api/v1/inquiries/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inquiryId }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to assign inquiry")
      }

      toast.success("Inquiry assigned to you")
      await loadData()
      const assigned = items.find((item) => item.id === inquiryId)
      if (assigned) {
        setSelectedInquiry({
          ...assigned,
          status: "in-progress",
          assignedStaffId: staffId,
          assignedStaff: session?.user?.name || "Assigned Staff",
          updatedAt: new Date(),
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign inquiry")
    } finally {
      setAssigningInquiryId(null)
    }
  }

  const confirmDelete = async () => {
    if (deleteTargetIds.length === 0) return

    setIsDeleting(true)
    try {
      await Promise.all(
        deleteTargetIds.map((id) =>
          fetch("/api/v1/inquiries/admin", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inquiryId: id }),
          })
        )
      )
      toast.success(deleteTargetIds.length === 1 ? "Inquiry deleted" : "Selected inquiries deleted")
      setSelectedIds((current) => current.filter((id) => !deleteTargetIds.includes(id)))
      setDeleteDialogOpen(false)
      setDeleteTargetIds([])
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setIsDeleting(false)
    }
  }

  if (status === "loading" || (session && !canViewRecords)) {
    return <div className="min-h-screen flex items-center justify-center bg-white" />
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4">

        <div className="mt-6 mb-6 flex items-center justify-between">
          <Button variant="ghost" asChild className="cursor-pointer">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="flex-1 text-center text-3xl font-bold">List of Inquiries</h1>
          <div className="w-[84px]" />
        </div>

        <div className={isStaff ? "grid gap-4 lg:grid-cols-[252px_minmax(0,1fr)_130px]" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_130px]"}>
        {isStaff ? (
          <aside className="h-fit rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.08),0_12px_30px_rgba(59,130,246,0.08)]">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-950">Your Inquiries</h2>
              <p className="mt-1 text-xs text-slate-500">Current staff workload</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <CircleDot className="h-4 w-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground">Available Issues</p>
                </div>
                <p className="text-2xl font-semibold">{staffStats.available}</p>
                <p className="mt-1 text-[11px] text-slate-500">Pending inquiries</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-blue-500" />
                  <p className="text-xs text-muted-foreground">Unresolved</p>
                </div>
                <p className="text-2xl font-semibold">{staffStats.unresolved}</p>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {staffCurrentInquiry ? staffCurrentInquiry.id : "No current ticket"}
                </p>
                {staffCurrentInquiry ? (
                  <Button asChild size="sm" className="mt-3 h-8 w-full cursor-pointer rounded-lg bg-[#006AEE] text-xs text-white hover:bg-[#0054BB]">
                    <Link href={`/support/messages/${encodeURIComponent(staffCurrentInquiry.id)}`}>
                      Work on your current ticket
                    </Link>
                  </Button>
                ) : null}
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
                <p className="text-2xl font-semibold">{staffStats.resolved}</p>
                <p className="mt-1 text-[11px] text-slate-500">Resolved by you</p>
              </div>
            </div>
          </aside>
        ) : null}

        <div className="min-w-0 rounded-3xl border border-blue-100 bg-[#F8FFFE] p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.08),0_12px_30px_rgba(59,130,246,0.08)]">
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-end gap-4 lg:flex-nowrap">
                <div>
                  <div className="mb-1 text-xs font-semibold text-blue-600">Show</div>
                  <Select value={pageSize} onValueChange={setPageSize}>
                    <SelectTrigger className="h-10 w-28 rounded-lg border-blue-100 bg-[#D2F1FF] px-3 text-sm">
                      <SelectValue className="text-slate-700" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-blue-600">Type</div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-10 w-36 rounded-lg border-blue-100 bg-[#D2F1FF] px-3 text-sm">
                      <SelectValue placeholder="Type" className="text-slate-700" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Type</SelectItem>
                      <SelectItem value="appointment">Appointment</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="medical-records">Medical Records</SelectItem>
                      <SelectItem value="prescription">Prescription</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="complaint">Complaint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-blue-600">Filter</div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 w-32 rounded-lg border-blue-100 bg-[#D2F1FF] px-3 text-sm">
                      <SelectValue placeholder="Status" className="text-slate-700" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-blue-600">Search</div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-sky-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                      className="h-10 w-48 rounded-lg border-0 bg-[#D2F1FF] pl-9 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-3 items-end">
                {isAdmin ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={handleBulkDelete}
                          disabled={selectedIds.length === 0}
                          className="h-10 w-10 cursor-pointer rounded-lg border-blue-500 bg-[#F8FFFE] text-blue-600 hover:bg-[#006AEE] hover:text-[#F8FFFE] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#F8FFFE] disabled:hover:text-blue-600 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => loadData()} className="h-10 w-10 cursor-pointer rounded-lg bg-[#006AEE] text-[#F8FFFE] border border-[#006AEE] hover:bg-[#F8FFFE] hover:text-[#006AEE] hover:border-[#006AEE] p-0">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="text-slate-600">Showing {filtered.length === 0 ? 0 : (safePage - 1) * size + 1} - {Math.min(safePage * size, filtered.length)} of {filtered.length}</div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Page {safePage} of {totalPages}</span>
                <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <p className="text-base font-medium text-slate-700">{emptyStateTitle}</p>
              <p className="mt-1 text-sm text-slate-500">{emptyStateMessage}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-blue-100 bg-[#F8FFFE]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#F8FFFE] text-blue-600">
                  <tr className="border-b border-blue-100">
                    {isAdmin ? (
                      <th className="w-10 px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-blue-300 accent-[#006AEE] transition-transform duration-200 ease-out checked:scale-110"
                          checked={pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((current) => Array.from(new Set([...current, ...pageItems.map((item) => item.id)])))
                            } else {
                              setSelectedIds((current) => current.filter((id) => !pageItems.some((item) => item.id === id)))
                            }
                          }}
                        />
                      </th>
                    ) : null}
                    <th className="px-4 py-3 text-left font-semibold">Issue ID</th>
                    <th className="px-4 py-3 text-left font-semibold">User</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Assigned Staff</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 bg-[#F8FFFE] transition-colors hover:bg-[#ABE4FD]">
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer rounded border-blue-300 accent-[#006AEE] transition-transform duration-200 ease-out checked:scale-110"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => {
                              setSelectedIds((current) =>
                                e.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id)
                              )
                            }}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openInquiryDetails(item)}
                          className="cursor-pointer font-medium text-[#006AEE] underline-offset-2 transition-colors hover:text-[#0054BB] hover:underline"
                        >
                          {item.id}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.userLabel}</td>
                      <td className="px-4 py-3 text-slate-700">{formatInquiryType(item.type)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{getStatusLabel(item.status)}</span>
                          {isStaff && item.status === "resolved" && (item.resolvedBy === staffId || item.assignedStaffId === staffId) ? (
                            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                              Resolved by you
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.assignedStaff}</td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin ? (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="cursor-pointer rounded-md border border-blue-100 bg-[#F8FFFE] px-3 py-1 text-xs font-medium text-blue-600 hover:border-[#006AEE] hover:bg-[#006AEE] hover:text-[#F8FFFE]"
                          >
                            <Trash2 className="inline-block h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white px-2.5 py-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-center text-xs font-semibold uppercase leading-tight tracking-[0.1em] text-slate-500">
              <span className="block">Record</span>
              <span className="block">Summary</span>
            </h2>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] text-muted-foreground">Total Inquiries</p>
              </div>
              <p className="text-lg font-semibold">{summary.total}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <p className="text-lg font-semibold">{summary.pending}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <PlayCircle className="h-3.5 w-3.5 text-blue-500" />
                <p className="text-[10px] text-muted-foreground">In Progress</p>
              </div>
              <p className="text-lg font-semibold">{summary.inProgress}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <p className="text-[10px] text-muted-foreground">Resolved</p>
              </div>
              <p className="text-lg font-semibold">{summary.resolved}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[10px] text-muted-foreground">Closed</p>
              </div>
              <p className="text-lg font-semibold">{summary.closed}</p>
            </div>
          </div>
        </aside>
        </div>
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open && !isDeleting) {
            setDeleteTargetIds([])
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTargetIds.length === 1 ? "inquiry" : "inquiries"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetIds.length === 1
                ? `This will permanently delete inquiry ${deleteTargetIds[0]}. This action cannot be undone.`
                : `This will permanently delete ${deleteTargetIds.length} selected inquiries. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          setDetailsDialogOpen(open)
          if (!open) {
            setSelectedInquiry(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inquiry Details</DialogTitle>
            <DialogDescription>
              Full details for inquiry {selectedInquiry?.id ?? "N/A"}.
            </DialogDescription>
          </DialogHeader>

          {selectedInquiry && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Issue ID</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium text-foreground">{getStatusLabel(selectedInquiry.status)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm font-medium text-foreground">{formatInquiryType(selectedInquiry.type)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned Staff</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.assignedStaff ?? "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created By</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.userLabel ?? "Unknown User"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Patient Name</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.patientName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact Number</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.contactNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.email}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Relationship</p>
                  <p className="text-sm font-medium text-foreground">{selectedInquiry.relationship}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created At</p>
                  <p className="text-sm font-medium text-foreground">{formatDateTime(selectedInquiry.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Updated At</p>
                  <p className="text-sm font-medium text-foreground">{formatDateTime(selectedInquiry.updatedAt)}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Details</p>
                <p className="whitespace-pre-wrap text-sm font-light font-mono text-foreground">
                  {selectedInquiry.details}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDetailsDialogOpen(false)}
            >
              Close
            </Button>
            {isStaff && selectedInquiry ? (
              selectedInquiry.assignedStaffId === staffId &&
              (selectedInquiry.status === "in-progress" || selectedInquiry.status === "resolved") ? (
                <Button type="button" className="cursor-pointer" asChild>
                  <Link href={`/support/messages/${encodeURIComponent(selectedInquiry.id)}`}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    See Messages
                  </Link>
                </Button>
              ) : selectedInquiry.status === "pending" && !selectedInquiry.assignedStaffId && !staffCurrentInquiry ? (
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={assigningInquiryId === selectedInquiry.id}
                  onClick={() => void handleAssignInquiry(selectedInquiry.id)}
                >
                  {assigningInquiryId === selectedInquiry.id ? "Assigning..." : "Assign to Me"}
                </Button>
              ) : (
                <Button type="button" disabled>
                  {staffCurrentInquiry
                    ? "Current ticket active"
                    : selectedInquiry.assignedStaffId
                      ? "Assigned to another staff"
                      : "Messages unavailable"}
                </Button>
              )
            ) : (
              <Button
                type="button"
                className="cursor-pointer"
                onClick={handleSeeMessagesPlaceholder}
              >
                See Messages
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
