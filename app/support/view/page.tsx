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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Header } from "@/components/header"
import {
  inquiryTypes,
  getStatusColor,
  getStatusLabel,
  type Inquiry,
} from "@/lib/inquiry-data"

export default function ViewInquiriesPage() {
  const { data: session, status } = useSession()

  if (status === "unauthenticated") {
    redirect("/auth/login")
  }

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResult, setSearchResult] = useState<Inquiry | null>(null)
  const [searchError, setSearchError] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const [expandedInquiry, setExpandedInquiry] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")

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

        const parsed: Inquiry[] = raw.map((item: any) => ({
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

  const filteredHistory =
    statusFilter === "all"
      ? inquiries
      : inquiries.filter((inq) => inq.status === statusFilter)

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

  const InquiryCard = ({
    inquiry,
    isExpanded,
    onToggle,
  }: {
    inquiry: Inquiry
    isExpanded: boolean
    onToggle: () => void
  }) => (
    <Card className={`transition-all ${isExpanded ? "ring-2 ring-primary/20" : ""}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer transition-colors hover:bg-muted/50">
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
              <Button variant="ghost" size="sm" className="shrink-0 cursor-pointer">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex justify-start">
            <Button variant="ghost" asChild className="cursor-pointer px-0">
              <Link href="/support">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Support
              </Link>
            </Button>
          </div>

          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              View Inquiries
            </h1>
            <p className="text-muted-foreground">
              Search for an inquiry by ID or browse your inquiry history.
            </p>
          </div>

          {loading && (
            <Card className="mb-8">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading your inquiries...</p>
              </CardContent>
            </Card>
          )}

          {!loading && fetchError && (
            <Card className="mb-8 border-destructive/30">
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
            <>
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Search by Inquiry ID
                  </CardTitle>
                  <CardDescription>
                    Enter your inquiry ID to check its status (e.g., INQ-AB12)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Enter inquiry ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setSearchError("")
                      }}
                      onKeyDown={handleKeyDown}
                      className="flex-1 uppercase"
                    />
                    <Button className="cursor-pointer" onClick={handleSearch}>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </Button>
                  </div>

                  {hasSearched && (
                    <div className="mt-4">
                      {searchError ? (
                        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          <p className="text-sm text-destructive">{searchError}</p>
                        </div>
                      ) : searchResult ? (
                        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-1">
                          <InquiryCard
                            inquiry={searchResult}
                            isExpanded={expandedInquiry === searchResult.id}
                            onToggle={() =>
                              setExpandedInquiry(
                                expandedInquiry === searchResult.id
                                  ? null
                                  : searchResult.id
                              )
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div>
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 bg-background">
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
                    <Button variant="outline" size="sm" asChild className="cursor-pointer bg-background">
                      <Link href="/support/request">
                        <Plus className="mr-1 h-4 w-4" />
                        New
                      </Link>
                    </Button>
                  </div>
                </div>

                {filteredHistory.length === 0 ? (
                  <Card className="border-dashed">
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
                  <div className="space-y-4">
                    {filteredHistory.map((inquiry) => (
                      <InquiryCard
                        key={inquiry.id}
                        inquiry={inquiry}
                        isExpanded={expandedInquiry === inquiry.id}
                        onToggle={() =>
                          setExpandedInquiry(
                            expandedInquiry === inquiry.id ? null : inquiry.id
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
