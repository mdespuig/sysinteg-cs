"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { redirect, useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  FileImage,
  FileText,
  Image,
  LinkIcon,
  Mail,
  MessageCircle,
  MessageCircleX,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Star,
  Trash2,
  UserCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Header } from "@/components/header"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type { AssignedStaffInfo } from "@/lib/conversation-data"

type Message = {
  _id: string
  senderId: string
  senderName: string
  senderRole: "standard" | "staff" | "admin"
  content: string
  attachments?: MessageAttachment[]
  createdAt: string
  pending?: boolean
}

type MessageAttachment = {
  kind: "image" | "file"
  name: string
  type: string
  size: number
  url: string
}

type MediaModal = "images" | "files" | "links" | null

type ParticipantInfoSelection = {
  participant?: AssignedStaffInfo | null
  fallbackColor: string
  label: string
}

type ParticipantInfoSide = "top" | "right" | "bottom" | "left"
type ParticipantInfoAlign = "start" | "center" | "end"

type ConversationPayload = {
  conversation: {
    id: string
    inquiryId: string
    status: string
    socketEndpoint: string
  }
  inquiry: {
    id: string
    type: string
    status: string
    patientName: string
    email?: string
    contactNumber?: string
    relationship?: string
    details?: string
    staffRating?: StaffRating | null
  }
  assignedStaff: AssignedStaffInfo
  inquiryUser: AssignedStaffInfo
  conversationPeer: AssignedStaffInfo
  typing?: {
    isPeerTyping: boolean
  }
  messages: Message[]
}

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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "S"
}

function formatMessageTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDateTime(value?: string) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return "N/A"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDateDivider(value?: string) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return "Today"

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
    .format(date)
    .toUpperCase()
}

function formatActiveDuration(value?: string) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return "No activity yet"

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMinutes < 1) return "Active now"
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Active ${diffHours}h ago`

  return `Active ${Math.floor(diffHours / 24)}d ago`
}

export default function InquiryMessagesPage() {
  const params = useParams<{ inquiryId: string }>()
  const inquiryId = decodeURIComponent(params.inquiryId || "").toUpperCase()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<ConversationPayload | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<"resolved" | "closed" | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<"resolved" | "closed" | null>(null)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingMessage, setRatingMessage] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)
  const [deleteConversationOpen, setDeleteConversationOpen] = useState(false)
  const [isDeletingConversation, setIsDeletingConversation] = useState(false)
  const [participantInfo, setParticipantInfo] = useState<ParticipantInfoSelection | null>(null)
  const [mediaModal, setMediaModal] = useState<MediaModal>(null)
  const [imagePreview, setImagePreview] = useState<MessageAttachment | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [peerTyping, setPeerTyping] = useState(false)
  const [error, setError] = useState("")
  const [socketState, setSocketState] = useState<"connecting" | "connected" | "polling">("connecting")
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const messagesRef = useRef<Message[]>([])
  const shouldStickToBottomRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const typingActiveRef = useRef(false)

  if (status === "unauthenticated") {
    redirect("/auth/login")
  }

  const role = (session?.user as any)?.role
  const canAccessConversation = role === "standard" || role === "staff" || role === "admin"

  useEffect(() => {
    if (status === "loading") return
    if (session && !canAccessConversation) {
      toast.error("You have no access to this conversation")
      redirect("/")
    }
  }, [status, session, canAccessConversation])

  const loadConversation = useCallback(
    async (showLoader = false) => {
      if (!inquiryId) return

      try {
        if (showLoader) setLoading(true)
        const res = await fetch(`/api/v1/conversations?inquiryId=${encodeURIComponent(inquiryId)}`, {
          credentials: "include",
          cache: "no-store",
        })
        const payload = await res.json()

        if (!res.ok) {
          throw new Error(payload.error || "Failed to load conversation")
        }

        const nextMessages = payload.data.messages || []
        setData(payload.data)
        setPeerTyping(Boolean(payload.data.typing?.isPeerTyping))
        setMessages((current) => {
          const pendingMessages = current.filter((message) => message.pending)
          const nextIds = new Set(nextMessages.map((message: Message) => message._id))
          return [
            ...nextMessages,
            ...pendingMessages.filter((message) => !nextIds.has(message._id)),
          ]
        })
        setError("")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load conversation")
        if (showLoader) {
          setData(null)
          setMessages([])
        }
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [inquiryId]
  )

  useEffect(() => {
    if (status !== "authenticated" || !canAccessConversation) return
    void loadConversation(true)
  }, [status, canAccessConversation, loadConversation])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const viewport = viewportRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (viewport && shouldStickToBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    const viewport = viewportRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (!viewport) return

    const handleScroll = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      shouldStickToBottomRef.current = distanceFromBottom < 120
    }

    viewport.addEventListener("scroll", handleScroll)
    handleScroll()

    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [loading])

  useEffect(() => {
    if (!data?.conversation.socketEndpoint) return

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const socketUrl = `${protocol}//${window.location.host}${data.conversation.socketEndpoint}`
    const socket = new WebSocket(socketUrl)
    socketRef.current = socket

    socket.onopen = () => {
      setSocketState("connected")
      socket.send(JSON.stringify({ type: "conversation.subscribe", inquiryId }))
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === "conversation.message.created" && payload.message) {
          setMessages((current) => {
            if (current.some((message) => message._id === payload.message._id)) return current
            return [...current, payload.message]
          })
        }
      } catch {
        return
      }
    }

    socket.onerror = () => {
      setSocketState("polling")
    }

    socket.onclose = () => {
      setSocketState((current) => (current === "connected" ? "polling" : current))
    }

    return () => {
      socket.close()
    }
  }, [data?.conversation.socketEndpoint, inquiryId])

  useEffect(() => {
    if (status !== "authenticated" || !canAccessConversation || socketState === "connected") return

    const interval = window.setInterval(() => {
      void loadConversation()
    }, 1000)

    return () => window.clearInterval(interval)
  }, [status, canAccessConversation, socketState, loadConversation])

  useEffect(() => {
    if (status !== "authenticated" || !canAccessConversation) return

    const sendPresenceHeartbeat = async () => {
      try {
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

    void sendPresenceHeartbeat()
    const refreshOnFocus = () => {
      void sendPresenceHeartbeat()
      void loadConversation()
    }

    const heartbeatInterval = window.setInterval(sendPresenceHeartbeat, 3000)
    window.addEventListener("focus", refreshOnFocus)
    document.addEventListener("visibilitychange", refreshOnFocus)

    return () => {
      window.clearInterval(heartbeatInterval)
      window.removeEventListener("focus", refreshOnFocus)
      document.removeEventListener("visibilitychange", refreshOnFocus)
    }
  }, [status, canAccessConversation, loadConversation])

  const firstMessageDate = useMemo(() => formatDateDivider(messages[0]?.createdAt), [messages])
  const peer = data?.conversationPeer
  const peerName = peer?.name || "Conversation"
  const inquiryUser = data?.inquiryUser
  const assignedStaff = data?.assignedStaff
  const isAdminView = role === "admin"
  const lastActivityLabel = useMemo(
    () => formatActiveDuration(messages[messages.length - 1]?.createdAt),
    [messages]
  )
  const backHref = role === "staff" || role === "admin" ? "/dashboard/records" : "/support/view"
  const canManageInquiry = role === "staff"
  const issueClosedStatus =
    data?.inquiry.status === "resolved" || data?.inquiry.status === "closed"
      ? data.inquiry.status
      : null
  const canSubmitStaffRating =
    role === "standard" && data?.inquiry.status === "resolved" && !data.inquiry.staffRating && Boolean(assignedStaff?.id)
  const imageAttachments = useMemo(
    () => messages.flatMap((message) => message.attachments?.filter((attachment) => attachment.kind === "image") || []),
    [messages]
  )
  const fileAttachments = useMemo(
    () => messages.flatMap((message) => message.attachments?.filter((attachment) => attachment.kind === "file") || []),
    [messages]
  )
  const conversationLinks = useMemo(() => {
    const urlRegex = /https?:\/\/[^\s]+/g
    return messages.flatMap((message) => message.content.match(urlRegex) || [])
  }, [messages])
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []

    return messages.filter((message) => message.content.toLowerCase().includes(q))
  }, [messages, searchQuery])

  useEffect(() => {
    setActiveSearchIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (canSubmitStaffRating) {
      setRatingDialogOpen(true)
    }
  }, [canSubmitStaffRating])

  useEffect(() => {
    if (!searchOpen || searchMatches.length === 0) return

    const active = searchMatches[Math.min(activeSearchIndex, searchMatches.length - 1)]
    document.getElementById(`message-${active._id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }, [activeSearchIndex, searchMatches, searchOpen])

  const renderHighlightedText = (text: string) => {
    const q = searchQuery.trim()
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const renderLinkified = (value: string, keyPrefix: string) =>
      value.split(urlRegex).map((part, index) =>
        urlRegex.test(part) ? (
          <a
            key={`${keyPrefix}-link-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            {part}
          </a>
        ) : (
          <span key={`${keyPrefix}-text-${index}`}>{part}</span>
        )
      )

    if (!q) return renderLinkified(text, "plain")

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const parts = text.split(new RegExp(`(${escaped})`, "gi"))

    return parts.map((part, index) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={`${part}-${index}`} className="rounded bg-green-500 px-1 text-white">{part}</mark>
      ) : (
        <span key={`${part}-${index}`}>{renderLinkified(part, `part-${index}`)}</span>
      )
    )
  }

  const getAdminMessageParticipant = (message: Message) => {
    if (message.senderId && inquiryUser?.id === message.senderId) {
      return { participant: inquiryUser, fallbackColor: "#006AEE" }
    }

    if (message.senderId && assignedStaff?.id === message.senderId) {
      return { participant: assignedStaff, fallbackColor: "#F5B400" }
    }

    if (message.senderRole === "standard" && inquiryUser) {
      return { participant: inquiryUser, fallbackColor: "#006AEE" }
    }

    if (message.senderRole === "staff" && assignedStaff) {
      return { participant: assignedStaff, fallbackColor: "#F5B400" }
    }

    return {
      participant: {
        id: message.senderId,
        name: message.senderName || "Conversation participant",
        profileImage: null,
        statusText: "Offline",
        isOnline: false,
        lastSeenAt: null,
      } satisfies AssignedStaffInfo,
      fallbackColor: "#64748B",
    }
  }

  const searchControls = searchOpen ? (
    <div className="flex shrink-0 justify-end border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
      <div className="flex h-9 w-full max-w-xs items-center gap-2 rounded-md bg-slate-100 px-3 text-sm text-slate-700">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search..."
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal"
          autoFocus
        />
        <span className="min-w-8 text-right text-xs font-semibold text-slate-500">
          {searchQuery.trim() ? `${searchMatches.length ? activeSearchIndex + 1 : 0}/${searchMatches.length}` : "0/0"}
        </span>
        <span className="h-5 w-px bg-slate-300" />
        <button
          type="button"
          className="cursor-pointer rounded p-1 hover:bg-slate-200"
          disabled={searchMatches.length === 0}
          onClick={() => setActiveSearchIndex((current) => Math.max(0, current - 1))}
          aria-label="Previous search result"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="cursor-pointer rounded p-1 hover:bg-slate-200"
          disabled={searchMatches.length === 0}
          onClick={() => setActiveSearchIndex((current) => Math.min(searchMatches.length - 1, current + 1))}
          aria-label="Next search result"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="cursor-pointer rounded p-1 hover:bg-slate-200"
          onClick={() => {
            setSearchOpen(false)
            setSearchQuery("")
          }}
          aria-label="Close search"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  ) : null

  const handleStatusUpdate = async (nextStatus: "resolved" | "closed") => {
    if (updatingStatus) return

    setUpdatingStatus(nextStatus)
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inquiryId, status: nextStatus }),
      })
      const payload = await res.json()

      if (!res.ok) {
        throw new Error(payload.error || "Failed to update inquiry")
      }

      setData((current) =>
        current
          ? {
              ...current,
              inquiry: {
                ...current.inquiry,
                status: nextStatus,
              },
            }
          : current
      )
      await loadConversation()
      toast.success(nextStatus === "resolved" ? "Inquiry marked as resolved" : "Inquiry marked as closed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update inquiry")
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleDeleteConversation = async () => {
    if (role !== "admin" || isDeletingConversation) return

    setIsDeletingConversation(true)
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inquiryId }),
      })
      const payload = await res.json()

      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete conversation")
      }

      toast.success("Conversation deleted")
      router.replace("/dashboard/records")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete conversation")
    } finally {
      setIsDeletingConversation(false)
      setDeleteConversationOpen(false)
    }
  }

  const handleSubmitRating = async () => {
    if (!ratingValue || submittingRating) return

    setSubmittingRating(true)
    try {
      const res = await fetch("/api/v1/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          inquiryId,
          rating: ratingValue,
          messageDetails: ratingMessage,
        }),
      })
      const payload = await res.json()

      if (!res.ok) {
        throw new Error(payload.error || "Failed to submit rating")
      }

      const createdAt = payload.data?.createdAt || new Date().toISOString()
      setData((current) =>
        current
          ? {
              ...current,
              inquiry: {
                ...current.inquiry,
                staffRating: {
                  staffId: assignedStaff?.id || null,
                  staffName: assignedStaff?.name || "Assigned Staff",
                  userId: (session?.user as any)?.id || null,
                  userName: session?.user?.name || session?.user?.email || "Standard User",
                  rating: ratingValue,
                  messageDetails: ratingMessage.trim(),
                  createdAt,
                },
              },
            }
          : current
      )
      setRatingDialogOpen(false)
      toast.success("Feedback rating submitted")
      await loadConversation()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit rating")
    } finally {
      setSubmittingRating(false)
    }
  }

  const handleSend = async () => {
    if (role === "admin") {
      toast.error("Admins can only view conversation history")
      return
    }

    const content = draft.trim()
    if ((!content && attachments.length === 0) || sending) return

    setSending(true)
    setDraft("")
    void sendTypingStatus(false)
    shouldStickToBottomRef.current = true
    const nextAttachments = attachments
    setAttachments([])
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: Message = {
      _id: tempId,
      senderId: (session?.user as any)?.id || "me",
      senderName: session?.user?.name || (role === "staff" ? "Staff" : "User"),
      senderRole: role,
      content,
      attachments: nextAttachments,
      createdAt: new Date().toISOString(),
      pending: true,
    }

    setMessages((current) => [...current, optimisticMessage])

    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inquiryId, content, attachments: nextAttachments }),
      })
      const payload = await res.json()

      if (!res.ok) {
        throw new Error(payload.error || "Failed to send message")
      }

      setMessages((current) =>
        current.map((message) => (message._id === tempId ? payload.data : message))
      )
      void loadConversation()

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "conversation.message.create",
            inquiryId,
            content,
          })
        )
      }
    } catch (err) {
      setDraft(content)
      setAttachments(nextAttachments)
      setMessages((current) => current.filter((message) => message._id !== tempId))
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const readFileAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })
  }

  const handleAttachmentSelect = async (files: FileList | null, kind: "image" | "file") => {
    if (!files?.length) return

    const selected = Array.from(files).slice(0, 5 - attachments.length)
    if (selected.length === 0) {
      toast.error("You can attach up to 5 files per message")
      return
    }

    try {
      const next = await Promise.all(
        selected.map(async (file) => {
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`${file.name} is larger than 10MB`)
          }

          if (kind === "image" && !file.type.startsWith("image/")) {
            throw new Error(`${file.name} is not an image`)
          }

          return {
            kind,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            url: await readFileAsDataUrl(file),
          }
        })
      )

      setAttachments((current) => [...current, ...next])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to attach file")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (imageInputRef.current) imageInputRef.current.value = ""
    }
  }

  const removeAttachment = (name: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.name !== name))
  }

  const insertEmoji = (emoji: string) => {
    const input = textareaRef.current
    const start = input?.selectionStart ?? draft.length
    const end = input?.selectionEnd ?? draft.length
    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`

    setDraft(nextDraft)
    setEmojiOpen(false)

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const nextCursor = start + emoji.length
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const sendTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (typingActiveRef.current === isTyping && isTyping) return
      typingActiveRef.current = isTyping

      try {
        await fetch("/api/v1/conversations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ inquiryId, isTyping }),
        })
      } catch {
        return
      }
    },
    [inquiryId]
  )

  const handleDraftChange = (value: string) => {
    setDraft(value)

    if (issueClosedStatus) return
    void sendTypingStatus(value.trim().length > 0)

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      void sendTypingStatus(false)
    }, 2000)
  }

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current)
      }
      if (typingActiveRef.current) {
        void sendTypingStatus(false)
      }
    }
  }, [sendTypingStatus])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
          Loading conversation...
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock3 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">Conversation unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Button asChild className="mt-6 cursor-pointer">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inquiries
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  if (isAdminView) {
    return (
      <div className="h-screen overflow-hidden bg-white text-slate-950">
        <Header />
        <main className="h-[calc(100vh-4rem)]">
          <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="flex min-h-0 flex-col border-r border-slate-200">
              <div className="relative flex h-12 shrink-0 items-center border-b border-slate-200 px-3">
                <Button asChild size="icon" className="h-8 w-8 cursor-pointer rounded-md bg-transparent text-slate-500 hover:bg-[#006AEE] hover:text-white">
                  <Link href="/dashboard/records" aria-label="Back to inquiries">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-bold">
                  {data?.inquiry.id || inquiryId}
                </h1>
              </div>

              {searchControls}

              <ScrollArea ref={viewportRef} className="min-h-0 flex-1 bg-white px-5 py-7">
                <div className="flex min-h-full flex-col justify-end gap-4">
                  <div className="pb-6 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    {firstMessageDate}
                  </div>

                  {messages.length === 0 ? (
                    <div className="mx-auto mb-20 max-w-sm rounded-lg border border-dashed border-slate-200 px-5 py-6 text-center">
                      <MessageCircle className="mx-auto mb-3 h-8 w-8 text-[#006AEE]" />
                      <p className="text-sm font-medium text-slate-900">No conversation history yet</p>
                      <p className="mt-1 text-xs text-slate-500">Messages will appear here once staff and user communicate.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pb-4">
                      {messages.map((message) => {
                        const { participant, fallbackColor } = getAdminMessageParticipant(message)
                        const participantLabel =
                          message.senderRole === "standard"
                            ? "User"
                            : message.senderRole === "staff"
                              ? "Staff"
                              : "Admin"

                        return (
                          <div
                            id={`message-${message._id}`}
                            key={message._id}
                            className="flex w-full scroll-mt-20 items-start gap-3"
                          >
                            <ParticipantAvatar participant={participant} fallbackColor={fallbackColor} size="small" />
                            <div className="min-w-0 max-w-5xl">
                              <div className="mb-0.5 flex flex-wrap items-center gap-3">
                                <ParticipantNameAction
                                  name={message.senderName || participant.name}
                                  participant={participant}
                                  fallbackColor={fallbackColor}
                                  label={participantLabel}
                                  side="right"
                                  onOpenInfo={setParticipantInfo}
                                />
                                <p className="text-[10px] font-medium text-slate-300">
                                  {message.pending ? "Sending..." : formatMessageTime(message.createdAt)}
                                </p>
                              </div>
                              {message.content ? (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-950">
                                  {renderHighlightedText(message.content)}
                                </p>
                              ) : null}
                              {message.attachments?.length ? (
                                <div className="mt-2 flex max-w-xl flex-wrap gap-2">
                                  {message.attachments.map((attachment) =>
                                    attachment.kind === "image" ? (
                                      <button
                                        key={`${message._id}-${attachment.name}`}
                                        type="button"
                                        onClick={() => setImagePreview(attachment)}
                                        className="cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white text-left"
                                      >
                                        <img src={attachment.url} alt={attachment.name} className="h-28 w-36 object-cover" />
                                      </button>
                                    ) : (
                                      <a
                                        key={`${message._id}-${attachment.name}`}
                                        href={attachment.url}
                                        download={attachment.name}
                                        className="flex max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 underline-offset-2 hover:underline"
                                      >
                                        <FileText className="h-4 w-4 shrink-0 text-[#006AEE]" />
                                        <span className="truncate">{attachment.name}</span>
                                      </a>
                                    )
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-center sm:gap-20">
                  <ParticipantByline
                    label="Inquiry created by:"
                    participant={inquiryUser}
                    fallbackColor="#006AEE"
                    onOpenInfo={setParticipantInfo}
                  />
                  <ParticipantByline
                    label="Inquiry responded by:"
                    participant={assignedStaff}
                    fallbackColor="#F5B400"
                    onOpenInfo={setParticipantInfo}
                  />
                </div>
              </div>
            </section>

            <aside className="hidden min-h-0 bg-white lg:flex lg:flex-col">
              <div className="border-b border-slate-200 px-6 py-10 text-center">
                <div className="mb-3 flex items-start justify-center gap-5">
                  <ParticipantHoverCard participant={inquiryUser} fallbackColor="#006AEE" label="User" onOpenInfo={setParticipantInfo} />
                  <ParticipantHoverCard participant={assignedStaff} fallbackColor="#F5B400" label="Staff" onOpenInfo={setParticipantInfo} />
                </div>
                <h2 className="text-lg font-bold text-slate-950">{data?.inquiry.id}</h2>
                <p className="text-xs text-slate-400">{lastActivityLabel}</p>
              </div>

              <div className="border-b border-slate-200 px-6 py-4">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">Media</p>
                <div className="space-y-4">
                  <ActionRow icon={FileImage} label="Images" onClick={() => setMediaModal("images")} />
                  <ActionRow icon={FileText} label="Files" onClick={() => setMediaModal("files")} />
                  <ActionRow icon={LinkIcon} label="Links" onClick={() => setMediaModal("links")} />
                </div>
              </div>

              {data?.inquiry.staffRating ? (
                <div className="border-b border-slate-200 px-6 py-4">
                  <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">Feedback rating</p>
                  <RatingDetails rating={data.inquiry.staffRating} />
                </div>
              ) : null}

              <div className="px-6 py-4">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">Actions</p>
                <div className="space-y-4">
                  <ActionRow icon={Search} label="Search in Conversation" onClick={() => setSearchOpen(true)} />
                  <ActionRow icon={Trash2} label="Delete Conversation" onClick={() => setDeleteConversationOpen(true)} />
                </div>
              </div>
            </aside>
          </div>
        </main>

        <ConversationMediaDialogs
          mediaModal={mediaModal}
          setMediaModal={setMediaModal}
          imageAttachments={imageAttachments}
          fileAttachments={fileAttachments}
          conversationLinks={conversationLinks}
          imagePreview={imagePreview}
          setImagePreview={setImagePreview}
        />
        <ParticipantInfoDialog selection={participantInfo} onOpenChange={setParticipantInfo} />

        <AlertDialog open={deleteConversationOpen} onOpenChange={setDeleteConversationOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the message history for inquiry {data?.inquiry.id ?? inquiryId}. The inquiry record will remain.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer" disabled={isDeletingConversation}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeletingConversation}
                onClick={(event) => {
                  event.preventDefault()
                  void handleDeleteConversation()
                }}
              >
                {isDeletingConversation ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Header hidePrivilegedNav />

      <main className="h-[calc(100vh-4rem)] overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-h-0 flex-col border-r border-slate-200">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Button variant="ghost" size="icon" asChild className="mr-1 h-9 w-9 shrink-0 cursor-pointer">
                  <Link href={backHref} aria-label="Back">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={peer?.profileImage || undefined} alt={peerName} className="object-cover" />
                  <AvatarFallback className="bg-[#006AEE] font-semibold text-white">{getInitials(peerName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-sm font-semibold text-slate-950 sm:text-base">{peerName}</h1>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                      {data?.inquiry.id}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{peer?.statusText || "Conversation participant"}</p>
                </div>
              </div>

              {canManageInquiry ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setStatusConfirm("resolved")
                      setStatusDialogOpen(true)
                    }}
                    disabled={updatingStatus !== null || data?.inquiry.status === "resolved" || data?.inquiry.status === "closed"}
                    className="h-9 cursor-pointer rounded-lg bg-[#006AEE] px-3 text-xs text-white hover:bg-[#0054BB]"
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Mark as Resolved
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setStatusConfirm("closed")
                      setStatusDialogOpen(true)
                    }}
                    disabled={updatingStatus !== null || data?.inquiry.status === "closed"}
                    className="h-9 cursor-pointer rounded-lg bg-[#006AEE] px-3 text-xs text-white hover:bg-[#0054BB]"
                  >
                    <MessageCircleX className="mr-2 h-4 w-4" />
                    Mark as Closed
                  </Button>
                </div>
              ) : null}
            </div>

            {searchControls}

            <div className="relative min-h-0 flex-1">
            <ScrollArea ref={viewportRef} className="h-full bg-white px-4 py-6 sm:px-8">
              <div className="flex w-full flex-col gap-3">
                <div className="py-10 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                  {firstMessageDate}
                </div>

                {messages.length === 0 ? (
                  <div className="mx-auto max-w-sm rounded-lg border border-dashed border-slate-200 px-5 py-6 text-center">
                    <MessageCircle className="mx-auto mb-3 h-8 w-8 text-[#006AEE]" />
                    <p className="text-sm font-medium text-slate-900">No messages yet</p>
                    <p className="mt-1 text-xs text-slate-500">Start the conversation for this inquiry.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isMine = message.senderId === (session?.user as any)?.id

                      return (
                        <div
                          id={`message-${message._id}`}
                          key={message._id}
                          className={`flex w-full scroll-mt-20 ${
                            isMine
                              ? "justify-end"
                              : "justify-start pl-11 sm:pl-14 lg:pl-16"
                          }`}
                        >
                          <div
                            className={`w-fit max-w-[82%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[62%] lg:max-w-[52%] ${
                              isMine
                                ? "bg-[#006AEE] text-white"
                                : "bg-slate-100 text-slate-950"
                            }`}
                          >
                            {message.content ? (
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderHighlightedText(message.content)}</p>
                            ) : null}
                            {message.attachments?.length ? (
                              <div className="mt-3 space-y-2">
                                {message.attachments.map((attachment) =>
                                  attachment.kind === "image" ? (
                                  <button
                                    key={`${message._id}-${attachment.name}`}
                                    type="button"
                                    onClick={() => setImagePreview(attachment)}
                                    className="block cursor-pointer overflow-hidden rounded-lg border border-white/20 text-left"
                                  >
                                    <img src={attachment.url} alt={attachment.name} className="max-h-56 w-full object-cover" />
                                  </button>
                                  ) : (
                                    <a
                                      key={`${message._id}-${attachment.name}`}
                                      href={attachment.url}
                                      download={attachment.name}
                                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs underline-offset-2 hover:underline ${
                                        isMine ? "bg-white/15 text-white" : "bg-white text-slate-700"
                                      }`}
                                    >
                                      <FileText className="h-4 w-4 shrink-0" />
                                      <span className="truncate">{attachment.name}</span>
                                    </a>
                                  )
                                )}
                              </div>
                            ) : null}
                            <p className={`mt-2 text-right text-[10px] ${isMine ? "text-blue-100" : "text-slate-400"}`}>
                              {message.pending ? "Sending..." : formatMessageTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </ScrollArea>
            {peerTyping ? (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-600 shadow-lg backdrop-blur">
                  <span>{peerName} is typing</span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  </span>
                </div>
              </div>
            ) : null}
            </div>

            {issueClosedStatus ? (
              <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-7 text-center">
                <p className="text-lg font-semibold text-slate-600">
                  This issue has been {issueClosedStatus}
                </p>
                {role === "standard" && data?.inquiry.status === "resolved" && !data.inquiry.staffRating ? (
                  <Button
                    type="button"
                    onClick={() => setRatingDialogOpen(true)}
                    className="mt-3 h-9 cursor-pointer rounded-lg bg-[#006AEE] px-4 text-xs text-white hover:bg-[#0054BB]"
                  >
                    Rate Staff
                  </Button>
                ) : role === "standard" && data?.inquiry.staffRating ? (
                  <p className="mt-2 text-sm text-slate-500">Feedback submitted. Thank you.</p>
                ) : null}
              </div>
            ) : (
              <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                {attachments.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <button
                        key={attachment.name}
                        type="button"
                        onClick={() => removeAttachment(attachment.name)}
                        className="max-w-55 cursor-pointer truncate rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
                        title="Remove attachment"
                      >
                        {attachment.kind === "image" ? "Image: " : "File: "}
                        {attachment.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-end gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) => void handleAttachmentSelect(event.target.files, "file")}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    multiple
                    onChange={(event) => void handleAttachmentSelect(event.target.files, "image")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-9 shrink-0 cursor-pointer text-slate-400"
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => imageInputRef.current?.click()}
                    className="h-9 w-9 shrink-0 cursor-pointer text-slate-400"
                  >
                    <Image className="h-5 w-5" />
                  </Button>
                  <div className="relative min-w-0 flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(event) => handleDraftChange(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message ..."
                      rows={1}
                      className="max-h-28 min-h-10 resize-none rounded-full border-0 bg-slate-100 px-5 py-2.5 pr-11 text-sm shadow-none focus-visible:ring-1"
                    />
                    <button
                      type="button"
                      onClick={() => setEmojiOpen((open) => !open)}
                      className="absolute right-3 top-2.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                      aria-label="Open emoji picker"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                    {emojiOpen ? (
                      <div className="absolute bottom-12 right-0 z-20 grid w-56 grid-cols-8 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                        {["😀", "😁", "😂", "😊", "😍", "🙂", "🙌", "👍", "🙏", "💙", "✅", "📌", "📄", "🕒", "💬", "🏥", "🤝", "👌", "😅", "✨", "📎", "📝", "🔎", "❤️"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-base hover:bg-slate-100"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={(!draft.trim() && attachments.length === 0) || sending}
                    size="icon"
                    className="h-10 w-10 shrink-0 cursor-pointer rounded-full bg-[#006AEE] disabled:cursor-not-allowed"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </section>

          <aside className="hidden min-h-0 bg-white lg:flex lg:flex-col">
            <div className="border-b border-slate-200 px-6 py-10 text-center">
              <ParticipantHoverCard
                participant={peer}
                fallbackColor="#006AEE"
                label="Participant"
                avatarClassName="mx-auto mb-3 h-28 w-28"
                showName={false}
                centered={role === "standard" || role === "staff"}
                onOpenInfo={setParticipantInfo}
              />
              <HoverCard>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className="cursor-pointer text-lg font-bold text-slate-950 underline-offset-4 hover:underline"
                    onClick={() => setParticipantInfo({ participant: peer, fallbackColor: "#006AEE", label: "Participant" })}
                  >
                    {peerName}
                  </button>
                </HoverCardTrigger>
                <ParticipantInfoCard participant={peer} fallbackColor="#006AEE" />
              </HoverCard>
              <p className="text-xs text-slate-400">{peer?.statusText || "Conversation participant"}</p>
            </div>

            <div className="border-b border-slate-200 px-6 py-4">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">Contact Information</p>
              <div className="space-y-4">
                <InfoRow icon={Mail} label="Email Address" value={peer?.email || "Not available"} />
                <InfoRow icon={Phone} label="Contact Number" value={peer?.contactNumber || "Not available"} />
              </div>
            </div>

            <div className="border-b border-slate-200 px-6 py-4">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">Media</p>
              <div className="space-y-4">
                <ActionRow icon={FileImage} label="Images" onClick={() => setMediaModal("images")} />
                <ActionRow icon={FileText} label="Files" onClick={() => setMediaModal("files")} />
                <ActionRow icon={LinkIcon} label="Links" onClick={() => setMediaModal("links")} />
              </div>
            </div>

            <div className="px-6 py-4">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">Actions</p>
              <div className="space-y-4">
                <ActionRow icon={Search} label="Search in Conversation" onClick={() => setSearchOpen(true)} />
              </div>
            </div>
          </aside>
        </div>
      </main>

      <ConversationMediaDialogs
        mediaModal={mediaModal}
        setMediaModal={setMediaModal}
        imageAttachments={imageAttachments}
        fileAttachments={fileAttachments}
        conversationLinks={conversationLinks}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
      />
      <ParticipantInfoDialog selection={participantInfo} onOpenChange={setParticipantInfo} />

      <Dialog open={ratingDialogOpen && role === "standard" && data?.inquiry.status === "resolved" && !data.inquiry.staffRating} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="sm:max-w-md [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle>Rate Staff Support</DialogTitle>
            <DialogDescription>
              Share your feedback for {assignedStaff?.name || "the assigned staff"} on inquiry {data?.inquiry.id ?? inquiryId}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Username</p>
                  <p className="font-medium text-slate-950">{session?.user?.name || session?.user?.email || "Standard User"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Timestamp</p>
                  <p className="font-medium text-slate-950">{formatDateTime(new Date().toISOString())}</p>
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
                    onClick={() => setRatingValue(value)}
                    className="cursor-pointer rounded-md p-1 text-amber-400 hover:bg-[#006AEE] hover:text-white"
                    aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
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
              onClick={() => setRatingDialogOpen(false)}
            >
              Later
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-[#006AEE] text-white hover:bg-[#0054BB]"
              disabled={ratingValue === 0 || submittingRating}
              onClick={() => void handleSubmitRating()}
            >
              {submittingRating ? "Submitting..." : "Submit Rating"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent className="[&>button]:cursor-pointer">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark inquiry as {statusConfirm === "resolved" ? "resolved" : "closed"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update inquiry {data?.inquiry.id ?? inquiryId} to{" "}
              {statusConfirm === "resolved" ? "Resolved" : "Closed"}. You can continue to view the conversation after the status changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={updatingStatus !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-[#006AEE] text-white hover:bg-[#0054BB]"
              disabled={updatingStatus !== null}
              onClick={(event) => {
                event.preventDefault()
                if (!statusConfirm) return
                const nextStatus = statusConfirm
                setStatusDialogOpen(false)
                void handleStatusUpdate(nextStatus)
              }}
            >
              {updatingStatus ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#006AEE] text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-950">{label}</p>
        <p className="truncate text-[11px] text-slate-400">{value}</p>
      </div>
    </div>
  )
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-[22px] pr-4 text-left transition-all duration-300 ease-out hover:bg-[#ABE4FD]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[#006AEE] text-white transition-all duration-300 ease-out group-hover:rounded-[20px]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xs font-semibold text-slate-950 transition-transform duration-300 ease-out group-hover:translate-x-1">
        {label}
      </span>
    </button>
  )
}

function EmptyModalState({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-slate-500">
      {label}
    </div>
  )
}

function RatingDetails({ rating }: { rating: StaffRating }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3 text-left">
      <div className="mb-3 flex items-center gap-1 text-amber-400">
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            className={`h-4 w-4 ${value <= rating.rating ? "fill-amber-400" : "fill-none text-slate-300"}`}
          />
        ))}
      </div>
      <div className="space-y-2 text-xs">
        <div>
          <p className="text-slate-400">Rated by</p>
          <p className="font-semibold text-slate-950">{rating.userName || "Standard User"}</p>
        </div>
        <div>
          <p className="text-slate-400">Timestamp</p>
          <p className="font-semibold text-slate-950">{formatDateTime(rating.createdAt)}</p>
        </div>
        <div>
          <p className="text-slate-400">Message details</p>
          <p className="whitespace-pre-wrap text-slate-700">{rating.messageDetails || "No message details provided."}</p>
        </div>
      </div>
    </div>
  )
}

function ConversationMediaDialogs({
  mediaModal,
  setMediaModal,
  imageAttachments,
  fileAttachments,
  conversationLinks,
  imagePreview,
  setImagePreview,
}: {
  mediaModal: MediaModal
  setMediaModal: (value: MediaModal) => void
  imageAttachments: MessageAttachment[]
  fileAttachments: MessageAttachment[]
  conversationLinks: string[]
  imagePreview: MessageAttachment | null
  setImagePreview: (value: MessageAttachment | null) => void
}) {
  return (
    <>
      <Dialog open={mediaModal !== null} onOpenChange={(open) => !open && setMediaModal(null)}>
        <DialogContent className="sm:max-w-2xl [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle>
              {mediaModal === "images" ? "Images" : mediaModal === "files" ? "Files" : "Links"}
            </DialogTitle>
            <DialogDescription>
              {mediaModal === "images"
                ? "Images shared in this conversation."
                : mediaModal === "files"
                  ? "Files shared in this conversation."
                  : "Links shared in this conversation."}
            </DialogDescription>
          </DialogHeader>

          {mediaModal === "images" ? (
            imageAttachments.length > 0 ? (
              <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {imageAttachments.map((attachment, index) => (
                  <button
                    key={`${attachment.name}-${index}`}
                    type="button"
                    onClick={() => setImagePreview(attachment)}
                    className="cursor-pointer overflow-hidden rounded-lg border bg-slate-50 text-left transition hover:bg-slate-100"
                  >
                    <img src={attachment.url} alt={attachment.name} className="aspect-square w-full object-cover" />
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500">
                      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                      <Download className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyModalState label="No images shared yet." />
            )
          ) : null}

          {mediaModal === "files" ? (
            fileAttachments.length > 0 ? (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {fileAttachments.map((attachment, index) => (
                  <a
                    key={`${attachment.name}-${index}`}
                    href={attachment.url}
                    download={attachment.name}
                    className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[#006AEE]" />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{attachment.name}</span>
                    <Download className="h-4 w-4 shrink-0 text-slate-800" />
                    <span className="text-xs text-slate-400">{Math.ceil(attachment.size / 1024)} KB</span>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyModalState label="No files shared yet." />
            )
          ) : null}

          {mediaModal === "links" ? (
            conversationLinks.length > 0 ? (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {conversationLinks.map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    <LinkIcon className="h-4 w-4 shrink-0 text-[#006AEE]" />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{url}</span>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyModalState label="No links shared yet." />
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={imagePreview !== null} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="border-0 bg-[#F1FBFF] p-6 shadow-2xl sm:max-w-4xl [&>button]:cursor-pointer [&>button]:opacity-70 [&>button]:hover:opacity-100">
          <DialogHeader className="pr-14">
            <DialogTitle className="text-xl font-bold text-slate-950">{imagePreview?.name || "Image preview"}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">Image Preview</DialogDescription>
          </DialogHeader>
          {imagePreview ? (
            <Button asChild size="icon" className="absolute right-14 top-6 z-10 h-10 w-10 cursor-pointer rounded-lg bg-[#006AEE] text-white hover:bg-[#0054BB]">
              <a href={imagePreview.url} download={imagePreview.name} aria-label="Download image">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {imagePreview ? (
            <div className="mt-4 flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg bg-transparent p-4">
              <img src={imagePreview.url} alt={imagePreview.name} className="max-h-[64vh] w-auto max-w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ParticipantHoverCard({
  participant,
  fallbackColor,
  label,
  avatarClassName,
  showName = true,
  centered = false,
  onOpenInfo,
}: {
  participant?: AssignedStaffInfo | null
  fallbackColor: string
  label: string
  avatarClassName?: string
  showName?: boolean
  centered?: boolean
  onOpenInfo?: (selection: ParticipantInfoSelection) => void
}) {
  const name = participant?.name || label

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={`flex max-w-29.5 cursor-pointer flex-col items-center text-center outline-none focus-visible:ring-2 focus-visible:ring-[#006AEE] focus-visible:ring-offset-2 ${centered ? "mx-auto" : ""}`}
          aria-label={`View ${label.toLowerCase()} information`}
          onClick={() => onOpenInfo?.({ participant, fallbackColor, label })}
        >
          <ParticipantAvatar
            participant={participant}
            fallbackColor={fallbackColor}
            avatarClassName={avatarClassName}
          />
          {showName ? (
            <>
              <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{label}</span>
              <span className="mt-0.5 max-w-full truncate text-xs font-bold text-slate-950 underline-offset-4 hover:underline">
                {name}
              </span>
            </>
          ) : null}
        </button>
      </HoverCardTrigger>
      <ParticipantInfoCard participant={participant} fallbackColor={fallbackColor} />
    </HoverCard>
  )
}

function ParticipantByline({
  label,
  participant,
  fallbackColor,
  onOpenInfo,
}: {
  label: string
  participant?: AssignedStaffInfo | null
  fallbackColor: string
  onOpenInfo: (selection: ParticipantInfoSelection) => void
}) {
  const name = participant?.name || "Not assigned"

  return (
    <div className="flex min-w-0 items-center justify-center gap-2">
      <span className="shrink-0 text-xs font-semibold text-slate-500 sm:text-sm">{label}</span>
      <ParticipantNameAction
        name={name}
        participant={participant}
        fallbackColor={fallbackColor}
        label={label}
        side="top"
        align="center"
        className="min-w-0 cursor-pointer truncate text-xs font-bold text-slate-950 underline-offset-4 hover:underline sm:text-sm"
        onOpenInfo={onOpenInfo}
      />
    </div>
  )
}

function ParticipantNameAction({
  name,
  participant,
  fallbackColor,
  label,
  side = "left",
  align = "start",
  className = "cursor-pointer text-sm font-bold text-slate-950 underline-offset-4 hover:underline",
  onOpenInfo,
}: {
  name: string
  participant?: AssignedStaffInfo | null
  fallbackColor: string
  label: string
  side?: ParticipantInfoSide
  align?: ParticipantInfoAlign
  className?: string
  onOpenInfo: (selection: ParticipantInfoSelection) => void
}) {
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={className}
          onClick={() => onOpenInfo({ participant, fallbackColor, label })}
        >
          {name}
        </button>
      </HoverCardTrigger>
      <ParticipantInfoCard
        participant={participant}
        fallbackColor={fallbackColor}
        side={side}
        align={align}
      />
    </HoverCard>
  )
}

function ParticipantInfoDialog({
  selection,
  onOpenChange,
}: {
  selection: ParticipantInfoSelection | null
  onOpenChange: (selection: ParticipantInfoSelection | null) => void
}) {
  return (
    <Dialog open={selection !== null} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent className="sm:max-w-sm [&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle>User Information</DialogTitle>
        </DialogHeader>
        {selection ? (
          <ParticipantInfoPanel
            participant={selection.participant}
            fallbackColor={selection.fallbackColor}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ParticipantInfoCard({
  participant,
  fallbackColor,
  side = "left",
  align = "start",
}: {
  participant?: AssignedStaffInfo | null
  fallbackColor: string
  side?: ParticipantInfoSide
  align?: ParticipantInfoAlign
}) {
  return (
    <HoverCardContent side={side} align={align} sideOffset={10} className="w-72 p-4">
      <ParticipantInfoPanel participant={participant} fallbackColor={fallbackColor} />
    </HoverCardContent>
  )
}

function ParticipantInfoPanel({
  participant,
  fallbackColor,
}: {
  participant?: AssignedStaffInfo | null
  fallbackColor: string
}) {
  const name = participant?.name || "Participant"

  return (
    <>
      <div className="flex items-start gap-3">
        <ParticipantAvatar participant={participant} fallbackColor={fallbackColor} size="small" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-950">{name}</p>
          <p className="text-xs text-slate-500">{participant?.statusText || "Offline"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <InfoRow icon={Mail} label="Email Address" value={participant?.email || "Not available"} />
        <InfoRow icon={Phone} label="Contact Number" value={participant?.contactNumber || "Not available"} />
      </div>
    </>
  )
}

function ParticipantAvatar({
  participant,
  fallbackColor,
  size = "large",
  avatarClassName,
  fallbackText,
}: {
  participant?: AssignedStaffInfo | null
  fallbackColor: string
  size?: "small" | "large"
  avatarClassName?: string
  fallbackText?: string
}) {
  const name = participant?.name || "Participant"
  const avatarSize = size === "large" ? "h-[70px] w-[70px]" : "h-9 w-9"
  const fallbackTextSize = size === "large" ? "text-3xl" : "text-sm"
  const dotSize = size === "large" ? "h-5 w-5 border-4" : "h-3 w-3 border-2"
  const avatarFallbackText =
    fallbackText ||
    (participant?.name === "Unassigned Staff" ? "?" : getInitials(name))

  return (
    <div className="relative inline-flex">
      <Avatar className={avatarClassName || avatarSize}>
        <AvatarImage src={participant?.profileImage || undefined} alt={name} className="object-cover" />
        <AvatarFallback
          className={`${fallbackTextSize} font-bold text-white`}
          style={{ backgroundColor: fallbackColor }}
        >
          {avatarFallbackText}
        </AvatarFallback>
      </Avatar>
      <span
        className={`absolute bottom-1 right-0 rounded-full border-white ${
          participant?.isOnline ? "bg-green-500" : "bg-slate-300"
        } ${dotSize}`}
      />
    </div>
  )
}
