import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!(session?.user as any)?.id || (session?.user as any)?.role !== "admin") {
    return null
  }
  return session
}

export async function getAdminInquiries() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
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
