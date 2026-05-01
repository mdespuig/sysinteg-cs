import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"
import type { AssignedStaffInfo } from "@/lib/conversation-data"
import { logAdminActivity, logStaffActivity } from "@/lib/audit-logs"
import { createNotification, createNotificationsForRole } from "@/lib/notifications"

const DATABASE_NAME = "healthcare"
const INQUIRIES_COLLECTION = "inquiries"
const CONVERSATIONS_COLLECTION = "conversations"
const MESSAGES_COLLECTION = "conversationMessages"
const USERS_COLLECTION = "users"
const PRESENCE_COLLECTION = "presence"
const TYPING_COLLECTION = "conversationTyping"
const PROFILE_COLLECTION = "profile"
const STAFF_RATINGS_COLLECTION = "staffRatings"

async function requireConversationUser() {
  const session = await getServerSession(authConfig)
  const userId = (session?.user as any)?.id
  const role = (session?.user as any)?.role

  if (!userId) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  }

  if (role !== "standard" && role !== "staff" && role !== "admin") {
    return { error: NextResponse.json({ error: "Conversation access requires an authorized account" }, { status: 403 }) }
  }

  return { session, userId, role }
}

function normalizeInquiryId(value: string | null | undefined) {
  return value?.trim().toUpperCase() || ""
}

function formatLastSeen(value?: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return "Offline"

  const diffSeconds = Math.max(0, Math.floor((Date.now() - value.getTime()) / 1000))

  if (diffSeconds < 60) return "less than a second ago"

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return diffHours === 1 ? "1 hr ago" : `${diffHours} hrs ago`

  const diffDays = Math.floor(diffHours / 24)
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`
}

async function getUserPresence(db: any, userId?: string | null) {
  if (!userId) {
    return {
      isOnline: false,
      lastSeenAt: null,
      statusText: "Offline",
    }
  }

  const presence = await db.collection(PRESENCE_COLLECTION).findOne({ userId })
  const lastSeen = presence?.lastSeenAt ? new Date(presence.lastSeenAt) : null
  const hasRecentHeartbeat = Boolean(lastSeen && !Number.isNaN(lastSeen.getTime()) && Date.now() - lastSeen.getTime() <= 12000)
  const isOnline = presence?.isOnline !== false && hasRecentHeartbeat

  return {
    isOnline,
    lastSeenAt: lastSeen && !Number.isNaN(lastSeen.getTime()) ? lastSeen.toISOString() : null,
    statusText: isOnline ? "Active now" : formatLastSeen(lastSeen),
  }
}

async function getUserProfile(db: any, userId?: string | null) {
  if (!userId) return null
  return db.collection(PROFILE_COLLECTION).findOne({ userId })
}

async function getConversationInquiryForUser(db: any, inquiryId: string, userId: string, role: string) {
  if (!inquiryId) return null

  if (role === "admin") {
    return db.collection(INQUIRIES_COLLECTION).findOne({ id: inquiryId })
  }

  if (role === "staff") {
    return db.collection(INQUIRIES_COLLECTION).findOne({
      id: inquiryId,
      assignedStaffId: userId,
    })
  }

  return db.collection(INQUIRIES_COLLECTION).findOne({
    id: inquiryId,
    userId,
    status: { $in: ["in-progress", "resolved", "closed"] },
  })
}

async function resolveInquiryUser(db: any, inquiry: any): Promise<AssignedStaffInfo> {
  const inquiryUserId = inquiry.userId

  if (typeof inquiryUserId === "string" && ObjectId.isValid(inquiryUserId)) {
    const user = await db.collection(USERS_COLLECTION).findOne(
      { _id: new ObjectId(inquiryUserId) },
      { projection: { username: 1, email: 1, contactNumber: 1, profileImage: 1 } }
    )

    if (user) {
      const presence = await getUserPresence(db, user._id.toString())
      const profile = await getUserProfile(db, user._id.toString())
      return {
        id: user._id.toString(),
        name: user.username || user.email || inquiry.patientName || "Inquiry User",
        email: profile?.email || user.email || inquiry.email || null,
        contactNumber: profile?.personalData?.contactNumber || user.contactNumber || inquiry.contactNumber || null,
        profileImage: profile?.profileImage || user.profileImage || null,
        statusText: presence.statusText,
        isOnline: presence.isOnline,
        lastSeenAt: presence.lastSeenAt,
      }
    }
  }

  return {
    id: inquiryUserId || null,
    name: inquiry.patientName || inquiry.email || "Inquiry User",
    email: inquiry.email || null,
    contactNumber: inquiry.contactNumber || null,
    profileImage: null,
    statusText: "Offline",
    isOnline: false,
    lastSeenAt: null,
  }
}

async function resolveAssignedStaff(db: any, inquiry: any): Promise<AssignedStaffInfo> {
  const assignedStaffId = inquiry.assignedStaffId || inquiry.staffId
  const assignedStaffName = inquiry.assignedStaff

  if (typeof assignedStaffId === "string" && ObjectId.isValid(assignedStaffId)) {
    const staff = await db.collection(USERS_COLLECTION).findOne(
      { _id: new ObjectId(assignedStaffId) },
      { projection: { username: 1, email: 1, contactNumber: 1, profileImage: 1 } }
    )

    if (staff) {
      const presence = await getUserPresence(db, staff._id.toString())
      const profile = await getUserProfile(db, staff._id.toString())
      return {
        id: staff._id.toString(),
        name: staff.username || staff.email || "Assigned Staff",
        email: profile?.email || staff.email || null,
        contactNumber: profile?.personalData?.contactNumber || staff.contactNumber || null,
        profileImage: profile?.profileImage || staff.profileImage || null,
        statusText: presence.statusText,
        isOnline: presence.isOnline,
        lastSeenAt: presence.lastSeenAt,
      }
    }
  }

  if (typeof assignedStaffName === "string" && assignedStaffName.trim().length > 0 && assignedStaffName !== "Unassigned") {
    return {
      id: null,
      name: assignedStaffName,
      email: null,
      contactNumber: null,
      profileImage: null,
      statusText: "Offline",
      isOnline: false,
      lastSeenAt: null,
    }
  }

  return {
    id: null,
    name: "Unassigned Staff",
    email: null,
    contactNumber: null,
    profileImage: null,
    statusText: "Waiting for assignment",
    isOnline: false,
    lastSeenAt: null,
  }
}

async function ensureConversation(db: any, inquiry: any, userId: string) {
  const now = new Date()
  const existing = await db.collection(CONVERSATIONS_COLLECTION).findOne({ inquiryId: inquiry.id })

  if (existing) {
    return existing
  }

  const conversation = {
    inquiryId: inquiry.id,
    userId,
    staffId: inquiry.assignedStaffId || inquiry.staffId || null,
    status: "open",
    createdAt: now,
    updatedAt: now,
  }

  const result = await db.collection(CONVERSATIONS_COLLECTION).insertOne(conversation)
  return { ...conversation, _id: result.insertedId }
}

export async function getConversation(request: NextRequest) {
  try {
    const auth = await requireConversationUser()
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const inquiryId = normalizeInquiryId(searchParams.get("inquiryId"))

    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const inquiry = await getConversationInquiryForUser(db, inquiryId, auth.userId!, auth.role!)

    if (!inquiry) {
      return NextResponse.json(
        { error: "Conversation is only available for your active assigned inquiry" },
        { status: 403 }
      )
    }

    const conversation = await ensureConversation(db, inquiry, auth.userId!)
    const messages = await db
      .collection(MESSAGES_COLLECTION)
      .find({ conversationId: conversation._id.toString() })
      .sort({ createdAt: 1 })
      .toArray()

    const assignedStaff = await resolveAssignedStaff(db, inquiry)
    const inquiryUser = await resolveInquiryUser(db, inquiry)
    const staffRating = await db.collection(STAFF_RATINGS_COLLECTION).findOne({ inquiryId: inquiry.id })
    const conversationPeer = auth.role === "staff" || auth.role === "admin" ? inquiryUser : assignedStaff
    const peerTyping = conversationPeer.id
      ? await db.collection(TYPING_COLLECTION).findOne({
          inquiryId: inquiry.id,
          userId: conversationPeer.id,
        })
      : null
    const isPeerTyping = peerTyping?.updatedAt
      ? Date.now() - new Date(peerTyping.updatedAt).getTime() <= 5000
      : false

    return NextResponse.json(
      {
        success: true,
        data: {
          conversation: {
            id: conversation._id.toString(),
            inquiryId: inquiry.id,
            status: conversation.status,
            socketEndpoint: `/api/v1/conversations/socket?inquiryId=${encodeURIComponent(inquiry.id)}`,
          },
          inquiry: {
            id: inquiry.id,
            type: inquiry.type,
            status: inquiry.status,
            patientName: inquiry.patientName,
            email: inquiry.email,
            contactNumber: inquiry.contactNumber,
            relationship: inquiry.relationship,
            details: inquiry.details,
            staffRating: staffRating
              ? {
                  id: staffRating._id.toString(),
                  staffId: staffRating.staffId,
                  staffName: staffRating.staffName,
                  userId: staffRating.userId,
                  userName: staffRating.userName,
                  rating: staffRating.rating,
                  messageDetails: staffRating.messageDetails,
                  createdAt: staffRating.createdAt,
                }
              : null,
          },
          assignedStaff,
          inquiryUser,
          conversationPeer,
          typing: {
            isPeerTyping,
          },
          messages: messages.map((message: any) => ({
            ...message,
            _id: message._id.toString(),
          })),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching conversation:", error)
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 })
  }
}

export async function updateTypingStatus(request: NextRequest) {
  try {
    const auth = await requireConversationUser()
    if (auth.error) return auth.error

    const body = await request.json()
    const inquiryId = normalizeInquiryId(body.inquiryId)
    const isTyping = Boolean(body.isTyping)

    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const inquiry = await getConversationInquiryForUser(db, inquiryId, auth.userId!, auth.role!)

    if (!inquiry) {
      return NextResponse.json({ error: "Conversation unavailable" }, { status: 403 })
    }

    await db.collection(TYPING_COLLECTION).updateOne(
      {
        inquiryId,
        userId: auth.userId!,
      },
      {
        $set: {
          inquiryId,
          userId: auth.userId!,
          isTyping,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error updating typing status:", error)
    return NextResponse.json({ error: "Failed to update typing status" }, { status: 500 })
  }
}

export async function createConversationMessage(request: NextRequest) {
  try {
    const auth = await requireConversationUser()
    if (auth.error) return auth.error

    if (auth.role === "admin") {
      return NextResponse.json(
        { error: "Admins can only view conversation history" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const inquiryId = normalizeInquiryId(body.inquiryId)
    const content = typeof body.content === "string" ? body.content.trim() : ""
    const attachments = Array.isArray(body.attachments)
      ? body.attachments
          .filter((attachment: any) => {
            return (
              typeof attachment?.name === "string" &&
              typeof attachment?.type === "string" &&
              typeof attachment?.size === "number" &&
              typeof attachment?.url === "string" &&
              (attachment.kind === "image" || attachment.kind === "file")
            )
          })
          .slice(0, 5)
          .map((attachment: any) => ({
            kind: attachment.kind,
            name: attachment.name.slice(0, 180),
            type: attachment.type.slice(0, 120),
            size: attachment.size,
            url: attachment.url,
          }))
      : []

    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    if (!content && attachments.length === 0) {
      return NextResponse.json({ error: "Message content or attachment is required" }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "Message must be 2000 characters or fewer" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const inquiry = await getConversationInquiryForUser(db, inquiryId, auth.userId!, auth.role!)

    if (!inquiry) {
      return NextResponse.json(
        { error: "Messages can only be sent for your active assigned inquiry" },
        { status: 403 }
      )
    }

    const conversation = await ensureConversation(db, inquiry, auth.userId!)
    const now = new Date()
    const message = {
      inquiryId: inquiry.id,
      conversationId: conversation._id.toString(),
      senderId: auth.userId!,
      senderName: auth.session!.user?.name || (auth.role === "staff" ? "Staff" : "User"),
      senderRole: auth.role,
      content,
      attachments,
      createdAt: now,
    }

    const result = await db.collection(MESSAGES_COLLECTION).insertOne(message)
    await db.collection(CONVERSATIONS_COLLECTION).updateOne(
      { _id: conversation._id },
      { $set: { updatedAt: now, lastMessageAt: now } }
    )

    if (auth.role === "staff" && inquiry.userId) {
      await createNotification(db, {
        recipientId: inquiry.userId,
        recipientRole: "standard",
        type: "message-received",
        title: "Staff messaged you",
        message: `${message.senderName} sent a message on inquiry ${inquiry.id}.`,
        href: `/support/messages/${encodeURIComponent(inquiry.id)}`,
        inquiryId: inquiry.id,
        actorId: auth.userId!,
        actorName: message.senderName,
      })

      await logStaffActivity(db, {
        action: "conversation.message.sent",
        staffId: auth.userId!,
        staffName: message.senderName,
        inquiryId: inquiry.id,
        title: "Staff message sent",
        description: `${message.senderName} sent a message on inquiry ${inquiry.id}.`,
        metadata: {
          attachmentCount: attachments.length,
          messageLength: content.length,
          userId: inquiry.userId || null,
        },
        createdAt: now,
      })
    }

    if (auth.role === "standard" && inquiry.assignedStaffId) {
      await createNotification(db, {
        recipientId: inquiry.assignedStaffId,
        recipientRole: "staff",
        type: "message-received",
        title: "User messaged you",
        message: `${message.senderName} sent a message on inquiry ${inquiry.id}.`,
        href: `/support/messages/${encodeURIComponent(inquiry.id)}`,
        inquiryId: inquiry.id,
        actorId: auth.userId!,
        actorName: message.senderName,
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...message,
          _id: result.insertedId.toString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating conversation message:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}

export async function deleteConversation(request: NextRequest) {
  try {
    const auth = await requireConversationUser()
    if (auth.error) return auth.error

    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const inquiryId = normalizeInquiryId(body.inquiryId)

    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const conversation = await db.collection(CONVERSATIONS_COLLECTION).findOne({ inquiryId })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    await Promise.all([
      db.collection(MESSAGES_COLLECTION).deleteMany({ conversationId: conversation._id.toString() }),
      db.collection(TYPING_COLLECTION).deleteMany({ inquiryId }),
      db.collection(CONVERSATIONS_COLLECTION).deleteOne({ _id: conversation._id }),
    ])

    const adminName = auth.session!.user?.name || auth.session!.user?.email || "Admin"
    await logAdminActivity(db, {
      action: "conversation.deleted",
      adminId: auth.userId!,
      adminName,
      inquiryId,
      title: "Conversation deleted",
      description: `${adminName} deleted the conversation for inquiry ${inquiryId}.`,
      metadata: {
        conversationId: conversation._id.toString(),
      },
    })

    return NextResponse.json(
      { success: true, message: "Conversation deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting conversation:", error)
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 })
  }
}

export async function updateConversationInquiryStatus(request: NextRequest) {
  try {
    const auth = await requireConversationUser()
    if (auth.error) return auth.error

    const body = await request.json()
    const inquiryId = normalizeInquiryId(body.inquiryId)
    const nextStatus = typeof body.status === "string" ? body.status : ""

    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    if (nextStatus !== "resolved" && nextStatus !== "closed") {
      return NextResponse.json({ error: "Status must be resolved or closed" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const inquiry = await db.collection(INQUIRIES_COLLECTION).findOne({ id: inquiryId })

    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 })
    }

    const isAssignedStaff = auth.role === "staff" && inquiry.assignedStaffId === auth.userId
    const isAdmin = auth.role === "admin"

    if (!isAdmin && !isAssignedStaff) {
      return NextResponse.json(
        { error: "Only the assigned staff or an admin can update this inquiry" },
        { status: 403 }
      )
    }

    const now = new Date()
    const updateFields: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: now,
    }

    if (nextStatus === "resolved") {
      updateFields.resolvedAt = now
      updateFields.resolvedBy = auth.userId
    }

    if (nextStatus === "closed") {
      updateFields.closedAt = now
      updateFields.closedBy = auth.userId
    }

    await db.collection(INQUIRIES_COLLECTION).updateOne(
      { id: inquiryId },
      { $set: updateFields }
    )

    const conversation = await ensureConversation(db, inquiry, inquiry.userId || auth.userId!)
    const existingStatusMessage = await db.collection(MESSAGES_COLLECTION).findOne({
      conversationId: conversation._id.toString(),
      type: `inquiry-${nextStatus}`,
    })

    if (!existingStatusMessage) {
      const actorName = auth.session!.user?.name || (auth.role === "staff" ? "Staff" : "Admin")
      const content =
        nextStatus === "resolved"
          ? `Hello, ${inquiry.patientName || "there"}. Kindly be informed that your inquiry ${inquiry.id} has been successfully resolved. Thank you for allowing us to assist you. We would greatly appreciate your feedback and service rating.`
          : `Hello, ${inquiry.patientName || "there"}. This is ${actorName}. Your inquiry ${inquiry.id} has been closed. Thank you for contacting us about this concern.`

      await db.collection(MESSAGES_COLLECTION).insertOne({
        type: `inquiry-${nextStatus}`,
        inquiryId: inquiry.id,
        conversationId: conversation._id.toString(),
        senderId: auth.userId!,
        senderName: actorName,
        senderRole: auth.role,
        content,
        createdAt: now,
      })

      await db.collection(CONVERSATIONS_COLLECTION).updateOne(
        { _id: conversation._id },
        { $set: { updatedAt: now, lastMessageAt: now } }
      )
    }

    if (inquiry.userId) {
      await createNotification(db, {
        recipientId: inquiry.userId,
        recipientRole: "standard",
        type: nextStatus === "resolved" ? "inquiry-resolved" : "inquiry-closed",
        title: nextStatus === "resolved" ? "Your inquiry was resolved" : "Your inquiry was closed",
        message: `Inquiry ${inquiry.id} has been ${nextStatus}.`,
        href: `/support/messages/${encodeURIComponent(inquiry.id)}`,
        inquiryId: inquiry.id,
        actorId: auth.userId!,
        actorName: auth.session!.user?.name || (auth.role === "staff" ? "Staff" : "Admin"),
        dedupeKey: `inquiry-${nextStatus}:${inquiry.id}`,
      })

      if (nextStatus === "resolved") {
        await createNotification(db, {
          recipientId: inquiry.userId,
          recipientRole: "standard",
          type: "rating-requested",
          title: "Rate your support experience",
          message: `Please rate the assistance you received for inquiry ${inquiry.id}.`,
          href: `/support/messages/${encodeURIComponent(inquiry.id)}`,
          inquiryId: inquiry.id,
          actorId: auth.userId!,
          actorName: auth.session!.user?.name || "Staff",
          dedupeKey: `rating-requested:${inquiry.id}`,
        })
      }
    }

    if (auth.role === "staff") {
      const actorName = auth.session!.user?.name || "Staff"
      await createNotificationsForRole(db, ["admin"], {
        type: nextStatus === "resolved" ? "inquiry-resolved" : "inquiry-closed",
        title: nextStatus === "resolved" ? "Staff resolved an inquiry" : "Staff closed an inquiry",
        message: `${actorName} marked inquiry ${inquiry.id} as ${nextStatus}.`,
        href: "/dashboard/records",
        inquiryId: inquiry.id,
        actorId: auth.userId!,
        actorName,
        dedupeKey: `admin-inquiry-${nextStatus}:${inquiry.id}`,
      })

      await logStaffActivity(db, {
        action: nextStatus === "resolved" ? "inquiry.resolved" : "inquiry.closed",
        staffId: auth.userId!,
        staffName: actorName,
        inquiryId: inquiry.id,
        title: nextStatus === "resolved" ? "Inquiry resolved" : "Inquiry closed",
        description: `${actorName} marked inquiry ${inquiry.id} as ${nextStatus}.`,
        metadata: {
          previousStatus: inquiry.status || null,
          nextStatus,
          userId: inquiry.userId || null,
        },
        createdAt: now,
      })
    }

    if (auth.role === "admin") {
      const adminName = auth.session!.user?.name || auth.session!.user?.email || "Admin"
      await logAdminActivity(db, {
        action: nextStatus === "resolved" ? "inquiry.resolved" : "inquiry.closed",
        adminId: auth.userId!,
        adminName,
        inquiryId: inquiry.id,
        title: nextStatus === "resolved" ? "Inquiry resolved" : "Inquiry closed",
        description: `${adminName} marked inquiry ${inquiry.id} as ${nextStatus}.`,
        metadata: {
          previousStatus: inquiry.status || null,
          nextStatus,
          userId: inquiry.userId || null,
        },
        createdAt: now,
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          inquiryId,
          status: nextStatus,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error updating conversation inquiry status:", error)
    return NextResponse.json({ error: "Failed to update inquiry status" }, { status: 500 })
  }
}
