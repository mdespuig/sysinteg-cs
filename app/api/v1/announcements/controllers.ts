import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"
import { logAdminActivity } from "@/lib/audit-logs"
import { createAnnouncementNotifications, type NotificationRole } from "@/lib/notifications"

const DATABASE_NAME = "healthcare"
const ANNOUNCEMENTS_COLLECTION = "announcements"
const ANNOUNCEMENT_AUDIENCE_LABELS = {
  all: "all users",
  standard: "standard users",
  staff: "staff",
} as const

type AnnouncementAudience = keyof typeof ANNOUNCEMENT_AUDIENCE_LABELS

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  const userId = (session?.user as any)?.id as string | undefined

  if (!userId || (session?.user as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { session, userId }
}

export async function getLatestAnnouncement() {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const announcement = await db
      .collection(ANNOUNCEMENTS_COLLECTION)
      .find(
        {},
        {
          projection: {
            message: 1,
            title: 1,
            audienceRoles: 1,
            createdAt: 1,
            createdByName: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(1)
      .next()

    return NextResponse.json({
      success: true,
      data: announcement
        ? {
            id: announcement._id.toString(),
            title: announcement.title || "Announcement",
            message: announcement.message || "",
            audienceRoles: announcement.audienceRoles || ["standard", "staff"],
            createdAt: announcement.createdAt || null,
            createdByName: announcement.createdByName || null,
          }
        : {
            title: "Announcement",
            message: "",
            audienceRoles: ["standard", "staff"],
            createdAt: null,
            createdByName: null,
          },
    })
  } catch (error) {
    console.error("Error fetching announcement:", error)
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 })
  }
}

export async function createAnnouncement(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await request.json()
    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "Announcement"
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : ""
    const targetRole = body.targetRole === "all" || body.targetRole === "standard" || body.targetRole === "staff"
      ? body.targetRole as AnnouncementAudience
      : null

    if (!message) {
      return NextResponse.json({ error: "Announcement message is required" }, { status: 400 })
    }

    if (!targetRole) {
      return NextResponse.json({ error: "Announcement recipient group is required" }, { status: 400 })
    }

    const now = new Date()
    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const adminName = auth.session?.user?.name || auth.session?.user?.email || "Admin"
    const audienceRoles: NotificationRole[] =
      targetRole === "all" ? ["standard", "staff"] : [targetRole]
    const audienceLabel = ANNOUNCEMENT_AUDIENCE_LABELS[targetRole]

    const result = await db.collection(ANNOUNCEMENTS_COLLECTION).insertOne({
      title,
      message,
      audienceRoles: [...audienceRoles],
      createdBy: auth.userId,
      createdByName: adminName,
      createdAt: now,
      updatedAt: now,
    })

    await createAnnouncementNotifications(db, [...audienceRoles], {
      title,
      message,
      href: "/",
      actorId: auth.userId,
      actorName: adminName,
    })

    await logAdminActivity(db, {
      action: "announcement.sent",
      adminId: auth.userId,
      adminName,
      title: "Announcement sent",
      description: `${adminName} sent an announcement to ${audienceLabel}.`,
      metadata: {
        announcementId: result.insertedId.toString(),
        audienceRoles: [...audienceRoles],
        targetRole,
        messageLength: message.length,
      },
      createdAt: now,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.insertedId.toString(),
          title,
          message,
          audienceRoles: [...audienceRoles],
          createdAt: now,
          createdByName: adminName,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating announcement:", error)
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 })
  }
}
