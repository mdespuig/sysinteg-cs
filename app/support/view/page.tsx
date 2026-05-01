"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  Search,
  FileText,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  History,
  Plus,
  Filter,
  Loader2,
  LogIn,
  MessageCircle,
  Star,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Header } from "@/components/header"
import {
  inquiryTypes,
  getStatusColor,
  getStatusLabel,
  type Inquiry,
} from "@/lib/inquiry-data"

type StaffRating = {
  id?: string
  staffId?: string | null
  staffName?: string | null
  userId?: string | null
  userName: string
  rating: number
  messageDetails?: string
  createdAt: string
}

type InquiryWithRating = Inquiry & {
  assignedStaff?: string | null
  assignedStaffId?: string | null
  staffRating?: StaffRating | null
}

export default function ViewInquiriesPage() {
  const { data: session, status } = useSession()

  if (status === "unauthenticated") {
    redirect("/auth/login")
  }

  const [inquiries, setInquiries] = useState<InquiryWithRating[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResult, setSearchResult] = useState<InquiryWithRating | null>(null)
  const [searchError, setSearchError] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const [expandedInquiry, setExpandedInquiry] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateSort, setDateSort] = useState<"latest" | "oldest">("latest")
  const [ratingInquiry, setRatingInquiry] = useState<InquiryWithRating | null>(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingMessage, setRatingMessage] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") return

    let isActive = true
    const controller = new AbortController()

    const fetchInquiries = async () => {
      try {
        if (!isActive) return
        setLoading(true)
        setFetchError("")

        const res = await fetch("/api/v1/inquiries", {
          credentials: "include",
          signal: controller.signal,
        })

        if (!isActive) return

        if (!res.ok) {
          if (res.status === 401) {
            setFetchError("You must be signed in to view your inquiries.")
          } else {
            const data = await res.json().catch(() => ({}))
            setFetchError(data.error || "Failed to fetch inquiries.")
          }
          setInquiries([])
          return
        }

        const data = await res.json()
        const raw: unknown[] = data.data || []

        const parsed: InquiryWithRating[] = raw.map((item: any) => ({
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        }))

        setInquiries(parsed)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        console.error("Error fetching inquiries:", err)
        if (isActive) {
          setFetchError("An unexpected error occurred while fetching your inquiries.")
          setInquiries([])
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void fetchInquiries()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [status])

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter an inquiry ID")
      setSearchResult(null)
      setHasSearched(false)
      return
    }

    setHasSearched(true)
    const found = inquiries.find(
      (inq) => inq.id.toLowerCase() === searchQuery.trim().toLowerCase()
    )

    if (found) {
      setSearchResult(found)
      setSearchError("")
    } else {
      setSearchResult(null)
      setSearchError("No inquiry found with that ID. Please check and try again.")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const filteredHistory = (statusFilter === "all"
    ? inquiries
    : inquiries.filter((inq) => inq.status === statusFilter)
  ).slice().sort((a, b) => {
    const aTime = a.createdAt.getTime()
    const bTime = b.createdAt.getTime()
    return dateSort === "latest" ? bTime - aTime : aTime - bTime
  })
  const unratedInquiries = inquiries.filter((inq) => inq.status === "resolved" && !inq.staffRating)

  const getInquiryTypeLabel = (type: string) => {
    return inquiryTypes.find((t) => t.value === type)?.label || type
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const formatDateTimeValue = (value?: Date | string) => {
    const parsed = value instanceof Date ? value : value ? new Date(value) : new Date()
    if (Number.isNaN(parsed.getTime())) return "N/A"
    return formatDate(parsed)
  }

  const openRatingModal = (inquiry: InquiryWithRating) => {
    setRatingInquiry(inquiry)
    setRatingValue(inquiry.staffRating?.rating || 0)
    setRatingMessage(inquiry.staffRating?.messageDetails || "")
  }

  const updateInquiryRating = (inquiryId: string, staffRating: StaffRating) => {
    setInquiries((current) =>
      current.map((inquiry) =>
        inquiry.id === inquiryId
          ? {
              ...inquiry,
              staffRating,
            }
          : inquiry
      )
    )
    setSearchResult((current) =>
      current?.id === inquiryId
        ? {
            ...current,
            staffRating,
          }
        : current
    )
    setRatingInquiry((current) =>
      current?.id === inquiryId
        ? {
            ...current,
            staffRating,
          }
        : current
    )
  }

  const handleSubmitRating = async () => {
    if (!ratingInquiry || !ratingValue || ratingInquiry.staffRating || submittingRating) return

    setSubmittingRating(true)
    try {
      const res = await fetch("/api/v1/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          inquiryId: ratingInquiry.id,
          rating: ratingValue,
          messageDetails: ratingMessage,
        }),
      })
      const payload = await res.json()

      if (!res.ok) {
        throw new Error(payload.error || "Failed to submit rating")
      }

      const staffRating: StaffRating = {
        staffId: ratingInquiry.assignedStaffId || payload.data?.staffId || null,
        staffName: ratingInquiry.assignedStaff || "Assigned Staff",
        userId: (session?.user as any)?.id || null,
        userName: session?.user?.name || session?.user?.email || "Standard User",
        rating: ratingValue,
        messageDetails: ratingMessage.trim(),
        createdAt: payload.data?.createdAt || new Date().toISOString(),
      }

      updateInquiryRating(ratingInquiry.id, staffRating)
      toast.success("Feedback rating submitted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit rating")
    } finally {
      setSubmittingRating(false)
    }
  }

  const InquiryCard = ({
    inquiry,
    isExpanded,
    onToggle,
  }: {
    inquiry: InquiryWithRating
    isExpanded: boolean
    onToggle: () => void
  }) => (
    <Card className={`transition-all ${isExpanded ? "ring-2 ring-primary/20" : ""}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-muted px-2 py-0.5 text-sm font-medium text-primary">
                  {inquiry.id}
                </code>
                <Badge variant="outline" className={getStatusColor(inquiry.status)}>
                  {getStatusLabel(inquiry.status)}
                </Badge>
              </div>
              <CardTitle className="text-lg">
                {getInquiryTypeLabel(inquiry.type)}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(inquiry.createdAt)}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="cursor-pointer">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
                </Button>
              </CollapsibleTrigger>
              {inquiry.status !== "pending" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 cursor-pointer text-[#006AEE] hover:bg-[#006AEE] hover:text-white"
                      asChild
                    >
                      <Link href={`/support/messages/${encodeURIComponent(inquiry.id)}`} aria-label="Access Inquiry messages">
                        <MessageCircle className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Access Inquiry messages</TooltipContent>
                </Tooltip>
              )}
              {inquiry.status === "resolved" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 cursor-pointer text-amber-500 hover:bg-[#006AEE] hover:text-white"
                      onClick={() => openRatingModal(inquiry)}
                      aria-label={inquiry.staffRating ? "View your rating" : "Rate inquiry"}
                    >
                      <Star className={`h-4 w-4 ${inquiry.staffRating ? "fill-amber-400" : "fill-none"}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{inquiry.staffRating ? "View your rating" : "Rate inquiry"}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Patient Name</p>
                    <p className="font-medium text-foreground">
                      {inquiry.patientName}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contact Number</p>
                    <p className="font-medium text-foreground">
                      {inquiry.contactNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{inquiry.email}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium text-foreground">{inquiry.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Relationship</p>
                    <p className="font-medium text-foreground">
                      {inquiry.relationship}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="font-medium text-foreground">
                      {formatDate(inquiry.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-muted/50 p-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Details</p>
              <p className="text-sm leading-relaxed text-foreground">
                {inquiry.details}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )

  const SearchResultCard = ({ inquiry }: { inquiry: InquiryWithRating }) => (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-2">
            <code className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-primary">
              {inquiry.id}
            </code>
            <div>
              <Badge variant="outline" className={getStatusColor(inquiry.status)}>
                {getStatusLabel(inquiry.status)}
              </Badge>
            </div>
            <CardTitle className="line-clamp-2 text-base">
              {getInquiryTypeLabel(inquiry.type)}
            </CardTitle>
            <CardDescription className="flex items-start gap-2 text-xs">
              <Calendar className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{formatDate(inquiry.createdAt)}</span>
            </CardDescription>
          </div>
          {inquiry.status !== "pending" ? (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer" asChild>
              <Link href={`/support/messages/${encodeURIComponent(inquiry.id)}`} aria-label="Access Inquiry messages">
                <MessageCircle className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1 cursor-pointer text-xs"
            onClick={() => {
              setExpandedInquiry(inquiry.id)
              document.getElementById(`history-${inquiry.id}`)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })
            }}
          >
            View details
          </Button>
          {inquiry.status === "resolved" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 cursor-pointer text-amber-500 hover:bg-[#006AEE] hover:text-white"
              onClick={() => openRatingModal(inquiry)}
              aria-label={inquiry.staffRating ? "View your rating" : "Rate inquiry"}
            >
              <Star className={`h-4 w-4 ${inquiry.staffRating ? "fill-amber-400" : "fill-none"}`} />
            </Button>
          ) : null}
        </div>
      </CardHeader>
    </Card>
  )

  const ratingReadOnly = Boolean(ratingInquiry?.staffRating)

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Header />

      <main className="container mx-auto flex h-[calc(100vh-4rem)] flex-col overflow-hidden px-4 py-4 md:py-6">
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
          <div className="shrink-0 bg-background pb-4">
          <div className="mb-4 flex justify-start">
            <Button variant="ghost" asChild className="cursor-pointer px-0">
              <Link href="/support">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Support
              </Link>
            </Button>
          </div>

          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              View Inquiries
            </h1>
            <p className="text-muted-foreground">
              Search for an inquiry by ID or browse your inquiry history.
            </p>
          </div>
          </div>

          {loading && (
            <Card className="shrink-0">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading your inquiries...</p>
              </CardContent>
            </Card>
          )}

          {!loading && fetchError && (
            <Card className="shrink-0 border-destructive/30">
              <CardContent className="py-12 text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive/70" />
                <p className="mb-2 font-medium text-destructive">{fetchError}</p>
                <Button className="mt-4 cursor-pointer" asChild>
                  <Link href="/auth/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && !fetchError && (
            <div className="grid min-h-0 flex-1 overflow-hidden gap-6 lg:grid-cols-[300px_minmax(0,1fr)_300px] lg:items-stretch">
              <aside className="space-y-6 overflow-hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      Search by Inquiry ID
                    </CardTitle>
                    <CardDescription>
                      Enter your inquiry ID to check its status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      <Input
                        placeholder="Enter inquiry ID..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setSearchError("")
                        }}
                        onKeyDown={handleKeyDown}
                        className="uppercase"
                      />
                      <Button className="w-full cursor-pointer" onClick={handleSearch}>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </Button>
                    </div>

                    {hasSearched && (
                      <div className="mt-4">
                        {searchError ? (
                          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                            <p className="text-sm text-destructive">{searchError}</p>
                          </div>
                        ) : searchResult ? (
                          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-1">
                            <SearchResultCard inquiry={searchResult} />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </aside>

              <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                <div className="mb-4 shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Inquiry History
                    </h2>
                    <Badge variant="secondary" className="ml-1">
                      {filteredHistory.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Select value={dateSort} onValueChange={(value) => setDateSort(value as "latest" | "oldest")}>
                        <SelectTrigger className="h-9 w-30 rounded-lg border-blue-100 bg-[#D2F1FF] text-slate-700 shadow-none">
                          <SelectValue placeholder="Date" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="latest">Latest</SelectItem>
                          <SelectItem value="oldest">Oldest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-36 rounded-lg border-blue-100 bg-[#D2F1FF] text-slate-700 shadow-none">
                          <SelectValue placeholder="Filter status" />
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
                    <Button asChild className="cursor-pointer">
                      <Link href="/support/request">
                        <Plus className="mr-1 h-4 w-4" />
                        New
                      </Link>
                    </Button>
                  </div>
                </div>

                {filteredHistory.length === 0 ? (
                  <Card className="min-h-0 border-dashed">
                    <CardContent className="py-12 text-center">
                      <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="mb-2 font-medium text-foreground">
                        No inquiries found
                      </p>
                      <p className="mb-4 text-sm text-muted-foreground">
                        {statusFilter === "all"
                          ? "You haven't submitted any inquiries yet."
                          : `No inquiries with status "${getStatusLabel(
                              statusFilter as Inquiry["status"]
                            )}".`}
                      </p>
                      <Button className="cursor-pointer" asChild>
                        <Link href="/support/request">
                          <Plus className="mr-2 h-4 w-4" />
                          Submit New Inquiry
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 pb-4">
                    {filteredHistory.map((inquiry) => (
                      <div key={inquiry.id} id={`history-${inquiry.id}`} className="scroll-mt-24">
                        <InquiryCard
                          inquiry={inquiry}
                          isExpanded={expandedInquiry === inquiry.id}
                          onToggle={() =>
                            setExpandedInquiry(
                              expandedInquiry === inquiry.id ? null : inquiry.id
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <aside className="space-y-6 overflow-hidden">
                {unratedInquiries.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                        Inquiries to rate
                      </CardTitle>
                      <CardDescription>
                        Resolved inquiries waiting for your staff feedback.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {unratedInquiries.map((inquiry) => (
                          <div
                            key={inquiry.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-primary">
                                  {inquiry.id}
                                </code>
                                <span className="truncate text-sm font-medium text-foreground">
                                  {getInquiryTypeLabel(inquiry.type)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Resolved by {inquiry.assignedStaff || "staff"} · {formatDate(inquiry.updatedAt)}
                              </p>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 cursor-pointer text-amber-500 hover:bg-[#006AEE] hover:text-white"
                                  onClick={() => openRatingModal(inquiry)}
                                  aria-label="Rate inquiry"
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">Rate inquiry</TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </aside>
            </div>
          )}
        </div>
      </main>

      <Dialog
        open={ratingInquiry !== null}
        onOpenChange={(open) => {
          if (!open && !submittingRating) {
            setRatingInquiry(null)
            setRatingValue(0)
            setRatingMessage("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle>{ratingReadOnly ? "Your Staff Rating" : "Rate Staff Support"}</DialogTitle>
            <DialogDescription>
              {ratingReadOnly
                ? `Rating submitted for inquiry ${ratingInquiry?.id ?? ""}.`
                : `Share your feedback for ${ratingInquiry?.assignedStaff || "the assigned staff"} on inquiry ${ratingInquiry?.id ?? ""}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Rated by</p>
                  <p className="font-medium text-slate-950">
                    {ratingInquiry?.staffRating?.userName || session?.user?.name || session?.user?.email || "Standard User"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Timestamp</p>
                  <p className="font-medium text-slate-950">
                    {formatDateTimeValue(ratingInquiry?.staffRating?.createdAt || new Date())}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-950">Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (!ratingReadOnly) setRatingValue(value)
                    }}
                    disabled={ratingReadOnly}
                    className="cursor-pointer rounded-md p-1 text-amber-400 hover:bg-[#006AEE] hover:text-white disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-amber-400"
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  >
                    <Star className={`h-8 w-8 ${value <= ratingValue ? "fill-amber-400" : "fill-none"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-950">Message details</p>
              <Textarea
                value={ratingMessage}
                onChange={(event) => setRatingMessage(event.target.value)}
                readOnly={ratingReadOnly}
                placeholder="Add feedback about the support you received..."
                rows={4}
                className="resize-none bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={submittingRating}
              onClick={() => {
                setRatingInquiry(null)
                setRatingValue(0)
                setRatingMessage("")
              }}
            >
              {ratingReadOnly ? "Close" : "Later"}
            </Button>
            {!ratingReadOnly ? (
              <Button
                type="button"
                className="cursor-pointer bg-[#006AEE] text-white hover:bg-[#0054BB]"
                disabled={ratingValue === 0 || submittingRating}
                onClick={() => void handleSubmitRating()}
              >
                {submittingRating ? "Submitting..." : "Submit Rating"}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
