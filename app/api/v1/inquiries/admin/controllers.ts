import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"

const CONVERSATIONS_COLLECTION = "conversations"
const MESSAGES_COLLECTION = "conversationMessages"

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

export async function getAdminInquiries() {
  try {
    const session = await requireRecordsAccess()
    if (!session) {
      return NextResponse.json({ error: "Staff or admin access required" }, { status: 403 })
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiries = await db.collection("inquiries").find({}).sort({ createdAt: -1 }).toArray()

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

    const data = inquiries.map((inquiry) => {
      const linkedUser = typeof inquiry.userId === "string" ? userMap.get(inquiry.userId) : null

      return {
        ...inquiry,
        userLabel: linkedUser?.username || linkedUser?.email || inquiry.email || "Unknown User",
      }
    })

    return NextResponse.json(
      { success: true, count: data.length, data },
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
    const result = await db.collection("inquiries").deleteOne({ id: inquiryId })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 })
    }

    return NextResponse.json(
      { success: true, message: "Inquiry deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting admin inquiry:", error)
    return NextResponse.json({ error: "Failed to delete inquiry" }, { status: 500 })
  }
}
