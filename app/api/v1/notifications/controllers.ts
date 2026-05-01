import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"
import { logAdminActivity } from "@/lib/audit-logs"
import {
  createAnnouncementNotifications,
  ensureStaffReminderNotification,
  NOTIFICATIONS_COLLECTION,
  type NotificationRole,
} from "@/lib/notifications"

const DATABASE_NAME = "healthcare"
const ANNOUNCEMENTS_COLLECTION = "announcements"

function normalizeRole(value: unknown): NotificationRole | null {
  return value === "standard" || value === "staff" || value === "admin" ? value : null
}

async function requireUser() {
  const session = await getServerSession(authConfig)
  const userId = (session?.user as any)?.id as string | undefined
  const role = normalizeRole((session?.user as any)?.role)

  if (!userId || !role) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  }

  return { session, userId, role }
}

export async function listNotifications() {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)

    if (auth.role === "staff") {
      await ensureStaffReminderNotification(db, auth.userId!)
    }

    const [notifications, unreadCount] = await Promise.all([
      db
        .collection(NOTIFICATIONS_COLLECTION)
        .find(
          { recipientId: auth.userId },
          {
            projection: {
              recipientId: 1,
              recipientRole: 1,
              type: 1,
              title: 1,
              message: 1,
              href: 1,
              inquiryId: 1,
              actorId: 1,
              actorName: 1,
              readAt: 1,
              createdAt: 1,
            },
          }
        )
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray(),
      db.collection(NOTIFICATIONS_COLLECTION).countDocuments({
        recipientId: auth.userId,
        readAt: null,
      }),
    ])

    return NextResponse.json({
      success: true,
      unreadCount,
      data: notifications.map((notification) => ({
        ...notification,
        _id: notification._id.toString(),
      })),
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function markNotificationsRead(request: NextRequest) {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    const body = await request.json()
    const now = new Date()
    const client = await clientPromise
    const db = client.db(DATABASE_NAME)

    if (body.all === true) {
      await db.collection(NOTIFICATIONS_COLLECTION).updateMany(
        { recipientId: auth.userId, readAt: null },
        { $set: { readAt: now, updatedAt: now } }
      )
      return NextResponse.json({ success: true })
    }

    const notificationId = typeof body.notificationId === "string" ? body.notificationId : ""
    if (!ObjectId.isValid(notificationId)) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
    }

    const result = await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
      {
        _id: new ObjectId(notificationId),
        recipientId: auth.userId,
      },
      { $set: { readAt: now, updatedAt: now } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating notification:", error)
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
  }
}

export async function createAnnouncement(request: NextRequest) {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : ""
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : ""
    const href = typeof body.href === "string" && body.href.trim() ? body.href.trim() : "/"
    const targetRole = body.targetRole === "all" ? "all" : normalizeRole(body.targetRole)

    if (!title || !message) {
      return NextResponse.json({ error: "Announcement title and message are required" }, { status: 400 })
    }

    if (!targetRole) {
      return NextResponse.json({ error: "Target role is required" }, { status: 400 })
    }

    const roles: NotificationRole[] = targetRole === "all" ? ["standard", "staff"] : [targetRole]
    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const now = new Date()
    const adminName = auth.session?.user?.name || auth.session?.user?.email || "Admin"
    const result = await db.collection(ANNOUNCEMENTS_COLLECTION).insertOne({
      title,
      message,
      href,
      audienceRoles: roles,
      createdBy: auth.userId,
      createdByName: adminName,
      createdAt: now,
      updatedAt: now,
    })

    await createAnnouncementNotifications(db, roles, {
      title,
      message,
      href,
      actorId: auth.userId,
      actorName: adminName,
    })

    await logAdminActivity(db, {
      action: "announcement.sent",
      adminId: auth.userId,
      adminName,
      title: "Announcement sent",
      description: `${adminName} sent an announcement.`,
      metadata: {
        announcementId: result.insertedId.toString(),
        audienceRoles: roles,
        href,
        messageLength: message.length,
      },
      createdAt: now,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Error creating announcement notifications:", error)
    return NextResponse.json({ error: "Failed to send announcement" }, { status: 500 })
  }
}
