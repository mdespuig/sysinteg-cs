import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"
import { logAdminActivity, logStaffActivity } from "@/lib/audit-logs"
import { createNotification, createNotificationsForRole } from "@/lib/notifications"

const CONVERSATIONS_COLLECTION = "conversations"
const MESSAGES_COLLECTION = "conversationMessages"
const STAFF_RATINGS_COLLECTION = "staffRatings"

async function requireRecordsAccess() {
  const session = await getServerSession(authConfig)
  const role = (session?.user as any)?.role
  if (!(session?.user as any)?.id || (role !== "admin" && role !== "staff")) {
    return null
  }
  return session
}

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!(session?.user as any)?.id || (session?.user as any)?.role !== "admin") {
    return null
  }
  return session
}

async function requireStaff() {
  const session = await getServerSession(authConfig)
  if (!(session?.user as any)?.id || (session?.user as any)?.role !== "staff") {
    return null
  }
  return session
}

function emptyInquirySummary() {
  return {
    total: 0,
    pending: 0,
    "in-progress": 0,
    resolved: 0,
    closed: 0,
  }
}

export async function getAdminInquiries(request: NextRequest) {
  try {
    const session = await requireRecordsAccess()
    if (!session) {
      return NextResponse.json({ error: "Staff or admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const summaryOnly = searchParams.get("summary") === "true"
    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiriesCollection = db.collection("inquiries")

    if (summaryOnly) {
      const summary = emptyInquirySummary()
      const statusCounts = await inquiriesCollection
        .aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray()

      for (const item of statusCounts) {
        const status = item._id as keyof ReturnType<typeof emptyInquirySummary>
        if (status in summary) {
          summary[status] = item.count
        }
        summary.total += item.count
      }

      return NextResponse.json(
        {
          success: true,
          count: summary.total,
          summary,
          data: [],
        },
        { status: 200 }
      )
    }

    const inquiries = await inquiriesCollection.find({}).sort({ createdAt: -1 }).toArray()
    const role = (session.user as any).role
    const currentUserId = (session.user as any).id as string

    const userIds = Array.from(
      new Set(
        inquiries
          .map((inquiry) => inquiry.userId)
          .filter((userId): userId is string => typeof userId === "string" && userId.trim().length > 0)
      )
    )

    const objectIds = userIds.filter((userId) => ObjectId.isValid(userId)).map((userId) => new ObjectId(userId))
    const users = objectIds.length
      ? await db
          .collection("users")
          .find(
            { _id: { $in: objectIds } },
            { projection: { username: 1, email: 1 } }
          )
          .toArray()
      : []

    const userMap = new Map(users.map((user) => [user._id.toString(), user]))
    const inquiryIds = inquiries.map((inquiry) => inquiry.id).filter(Boolean)
    const ratings = inquiryIds.length
      ? await db
          .collection(STAFF_RATINGS_COLLECTION)
          .find({ inquiryId: { $in: inquiryIds } })
          .toArray()
      : []
    const ratingMap = new Map(ratings.map((rating) => [rating.inquiryId, rating]))
    const staffRatingSummary =
      role === "staff"
        ? await db
            .collection(STAFF_RATINGS_COLLECTION)
            .aggregate([
              { $match: { staffId: currentUserId } },
              {
                $group: {
                  _id: "$staffId",
                  totalRatings: { $sum: 1 },
                  averageRating: { $avg: "$rating" },
                },
              },
            ])
            .next()
        : null

    const data = inquiries.map((inquiry) => {
      const linkedUser = typeof inquiry.userId === "string" ? userMap.get(inquiry.userId) : null
      const rating = ratingMap.get(inquiry.id)

      return {
        ...inquiry,
        _id: inquiry._id?.toString(),
        userLabel: linkedUser?.username || linkedUser?.email || inquiry.email || "Unknown User",
        staffRating: rating
          ? {
              id: rating._id.toString(),
              staffId: rating.staffId,
              staffName: rating.staffName,
              userId: rating.userId,
              userName: rating.userName,
              rating: rating.rating,
              messageDetails: rating.messageDetails,
              createdAt: rating.createdAt,
            }
          : inquiry.staffRating || null,
      }
    })

    return NextResponse.json(
      {
        success: true,
        count: data.length,
        data,
        staffRatingSummary: staffRatingSummary
          ? {
              totalRatings: staffRatingSummary.totalRatings || 0,
              averageRating: staffRatingSummary.averageRating || 0,
            }
          : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching admin inquiries:", error)
    return NextResponse.json({ error: "Failed to fetch inquiries" }, { status: 500 })
  }
}

export async function claimStaffInquiry(request: NextRequest) {
  try {
    const session = await requireStaff()
    if (!session) {
      return NextResponse.json({ error: "Staff access required" }, { status: 403 })
    }

    const { inquiryId } = await request.json()
    const staffId = (session.user as any).id as string
    const staffName = session.user?.name || session.user?.email || "Assigned Staff"

    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiries = db.collection("inquiries")

    const currentInquiry = await inquiries.findOne({
      assignedStaffId: staffId,
      status: { $in: ["in-progress"] },
    })

    if (currentInquiry) {
      return NextResponse.json(
        { error: "You already have an unresolved inquiry assigned" },
        { status: 409 }
      )
    }

    const targetInquiryId = String(inquiryId).trim().toUpperCase()
    const now = new Date()
    const result = await inquiries.updateOne(
      {
        id: targetInquiryId,
        status: "pending",
        $or: [
          { assignedStaffId: { $exists: false } },
          { assignedStaffId: null },
          { assignedStaffId: "" },
        ],
      },
      {
        $set: {
          status: "in-progress",
          assignedStaffId: staffId,
          assignedStaff: staffName,
          assignedAt: now,
          updatedAt: now,
        },
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Inquiry is no longer available to assign" },
        { status: 409 }
      )
    }

    const inquiry = await inquiries.findOne({ id: targetInquiryId })
    if (inquiry) {
      const existingConversation = await db.collection(CONVERSATIONS_COLLECTION).findOne({ inquiryId: inquiry.id })
      const conversation =
        existingConversation ||
        {
          inquiryId: inquiry.id,
          userId: inquiry.userId || null,
          staffId,
          status: "open",
          createdAt: now,
          updatedAt: now,
        }

      const conversationId = existingConversation
        ? existingConversation._id.toString()
        : (await db.collection(CONVERSATIONS_COLLECTION).insertOne(conversation)).insertedId.toString()

      if (existingConversation && existingConversation.staffId !== staffId) {
        await db.collection(CONVERSATIONS_COLLECTION).updateOne(
          { _id: existingConversation._id },
          { $set: { staffId, updatedAt: now } }
        )
      }

      const existingAutoMessage = await db.collection(MESSAGES_COLLECTION).findOne({
        conversationId,
        type: "staff-claim-introduction",
      })

      if (!existingAutoMessage) {
        const inquiryType = String(inquiry.type || "general").replace(/-/g, " ")
        const message = [
          `Hello, ${inquiry.patientName || inquiry.email || "there"}!`,
          "",
          `I'm ${staffName}, and I have been assigned to your inquiry ${inquiry.id}. I will review your ${inquiryType} concern and assist you from here.`,
          "",
          "Inquiry details:",
          `Patient: ${inquiry.patientName || "N/A"}`,
          `Contact: ${inquiry.contactNumber || "N/A"}`,
          `Email: ${inquiry.email || "N/A"}`,
          `Relationship: ${inquiry.relationship || "N/A"}`,
          `Details: ${inquiry.details || "N/A"}`,
          "",
          "You can reply here with any updates or additional information related to this inquiry.",
        ].join("\n")

        await db.collection(MESSAGES_COLLECTION).insertOne({
          type: "staff-claim-introduction",
          inquiryId: inquiry.id,
          conversationId,
          senderId: staffId,
          senderName: staffName,
          senderRole: "staff",
          content: message,
          createdAt: now,
        })

        await db.collection(CONVERSATIONS_COLLECTION).updateOne(
          { _id: existingConversation?._id ?? new ObjectId(conversationId) },
          { $set: { updatedAt: now, lastMessageAt: now, staffId } }
        )
      }

      if (inquiry.userId) {
        await createNotification(db, {
          recipientId: inquiry.userId,
          recipientRole: "standard",
          type: "inquiry-assigned",
          title: "Your inquiry was taken",
          message: `${staffName} is now handling inquiry ${inquiry.id}.`,
          href: `/support/messages/${encodeURIComponent(inquiry.id)}`,
          inquiryId: inquiry.id,
          actorId: staffId,
          actorName: staffName,
          dedupeKey: `inquiry-assigned:${inquiry.id}:${staffId}`,
        })

        await createNotification(db, {
          recipientId: inquiry.userId,
          recipientRole: "standard",
          type: "message-received",
          title: "Staff sent you a message",
          message: `${staffName} sent an introduction for inquiry ${inquiry.id}.`,
          href: `/support/messages/${encodeURIComponent(inquiry.id)}`,
          inquiryId: inquiry.id,
          actorId: staffId,
          actorName: staffName,
          dedupeKey: `staff-introduction:${inquiry.id}:${staffId}`,
        })
      }

      await logStaffActivity(db, {
        action: "inquiry.assigned",
        staffId,
        staffName,
        inquiryId: inquiry.id,
        title: "Inquiry assigned",
        description: `${staffName} accepted and started handling inquiry ${inquiry.id}.`,
        metadata: {
          inquiryType: inquiry.type || null,
          patientName: inquiry.patientName || null,
          userId: inquiry.userId || null,
        },
        createdAt: now,
      })
    }

    return NextResponse.json(
      { success: true, message: "Inquiry assigned successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error assigning staff inquiry:", error)
    return NextResponse.json({ error: "Failed to assign inquiry" }, { status: 500 })
  }
}

export async function updateStaffInquiry(request: NextRequest) {
  const payload = await request.json()

  if (payload?.action === "reject") {
    return rejectStaffInquiryPayload(payload)
  }

  return claimStaffInquiryPayload(payload)
}

async function claimStaffInquiryPayload(payload: { inquiryId?: unknown }) {
  const request = new NextRequest("http://localhost/api/v1/inquiries/admin", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })

  return claimStaffInquiry(request)
}

export async function rejectStaffInquiry(request: NextRequest) {
  const payload = await request.json()
  return rejectStaffInquiryPayload(payload)
}

async function rejectStaffInquiryPayload(payload: { inquiryId?: unknown }) {
  try {
    const session = await requireStaff()
    if (!session) {
      return NextResponse.json({ error: "Staff access required" }, { status: 403 })
    }

    const { inquiryId } = payload
    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    const staffId = (session.user as any).id as string
    const staffName = session.user?.name || session.user?.email || "Assigned Staff"
    const targetInquiryId = String(inquiryId).trim().toUpperCase()
    const now = new Date()
    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiries = db.collection("inquiries")

    const result = await inquiries.updateOne(
      {
        id: targetInquiryId,
        status: "pending",
        $or: [
          { assignedStaffId: { $exists: false } },
          { assignedStaffId: null },
          { assignedStaffId: "" },
        ],
      },
      {
        $set: {
          status: "closed",
          closedAt: now,
          closedBy: staffId,
          closedReason: "rejected",
          assignedStaffId: staffId,
          assignedStaff: staffName,
          updatedAt: now,
        },
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Inquiry is no longer available to reject" },
        { status: 409 }
      )
    }

    const inquiry = await inquiries.findOne({ id: targetInquiryId })
    if (inquiry?.userId) {
      await createNotification(db, {
        recipientId: inquiry.userId,
        recipientRole: "standard",
        type: "inquiry-rejected",
        title: "Your inquiry was rejected",
        message: `Inquiry ${inquiry.id} was reviewed and rejected by staff.`,
        href: `/support/messages/${encodeURIComponent(inquiry.id)}`,
        inquiryId: inquiry.id,
        actorId: staffId,
        actorName: staffName,
        dedupeKey: `inquiry-rejected-user:${inquiry.id}:${staffId}`,
      })
    }

    await createNotificationsForRole(db, ["admin"], {
      type: "inquiry-rejected",
      title: "Staff rejected an inquiry",
      message: `${staffName} rejected inquiry ${targetInquiryId}.`,
      href: "/dashboard/records",
      inquiryId: targetInquiryId,
      actorId: staffId,
      actorName: staffName,
      dedupeKey: `inquiry-rejected-admin:${targetInquiryId}:${staffId}`,
    })

    await logStaffActivity(db, {
      action: "inquiry.rejected",
      staffId,
      staffName,
      inquiryId: targetInquiryId,
      title: "Inquiry rejected",
      description: `${staffName} rejected inquiry ${targetInquiryId}.`,
      metadata: {
        userId: inquiry?.userId || null,
        patientName: inquiry?.patientName || null,
        inquiryType: inquiry?.type || null,
        closedReason: "rejected",
      },
      createdAt: now,
    })

    return NextResponse.json(
      { success: true, message: "Inquiry rejected and closed successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error rejecting inquiry:", error)
    return NextResponse.json({ error: "Failed to reject inquiry" }, { status: 500 })
  }
}

export async function deleteAdminInquiry(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { inquiryId } = await request.json()
    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiry = await db.collection("inquiries").findOne({ id: inquiryId })
    const result = await db.collection("inquiries").deleteOne({ id: inquiryId })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 })
    }

    const adminId = (session.user as any).id as string
    const adminName = session.user?.name || session.user?.email || "Admin"
    await logAdminActivity(db, {
      action: "inquiry.deleted",
      adminId,
      adminName,
      inquiryId,
      title: "Inquiry deleted",
      description: `${adminName} deleted inquiry ${inquiryId}.`,
      metadata: {
        previousStatus: inquiry?.status || null,
        userId: inquiry?.userId || null,
        inquiryType: inquiry?.type || null,
      },
    })

    return NextResponse.json(
      { success: true, message: "Inquiry deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting admin inquiry:", error)
    return NextResponse.json({ error: "Failed to delete inquiry" }, { status: 500 })
  }
}
