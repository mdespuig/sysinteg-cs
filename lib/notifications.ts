import type { Db } from "mongodb"

export const NOTIFICATIONS_COLLECTION = "notifications"
export const NOTIFICATION_REMINDER_INTERVAL_MS = 3 * 60 * 60 * 1000

export type NotificationRole = "standard" | "staff" | "admin"
export type NotificationType =
  | "inquiry-created"
  | "inquiry-assigned"
  | "inquiry-updated"
  | "inquiry-resolved"
  | "inquiry-closed"
  | "inquiry-rejected"
  | "message-received"
  | "rating-requested"
  | "rating-received"
  | "announcement"
  | "staff-reminder"

type NotificationInput = {
  recipientId: string
  recipientRole: NotificationRole
  type: NotificationType
  title: string
  message: string
  href: string
  inquiryId?: string | null
  actorId?: string | null
  actorName?: string | null
  dedupeKey?: string | null
  createdAt?: Date
}

export async function createNotification(db: Db, input: NotificationInput) {
  const now = input.createdAt || new Date()
  const notification = {
    ...input,
    inquiryId: input.inquiryId || null,
    actorId: input.actorId || null,
    actorName: input.actorName || null,
    dedupeKey: input.dedupeKey || null,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  }

  if (notification.dedupeKey) {
    await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
      {
        recipientId: notification.recipientId,
        dedupeKey: notification.dedupeKey,
      },
      { $setOnInsert: notification },
      { upsert: true }
    )
    return
  }

  await db.collection(NOTIFICATIONS_COLLECTION).insertOne(notification)
}

export async function createNotificationsForRole(
  db: Db,
  roles: NotificationRole[],
  input: Omit<NotificationInput, "recipientId" | "recipientRole">
) {
  const users = await db
    .collection("users")
    .find({ role: { $in: roles } }, { projection: { _id: 1, role: 1 } })
    .toArray()

  await Promise.all(
    users.map((user) =>
      createNotification(db, {
        ...input,
        recipientId: user._id.toString(),
        recipientRole: user.role,
      })
    )
  )
}

export async function createAnnouncementNotifications(
  db: Db,
  roles: NotificationRole[],
  input: Pick<NotificationInput, "title" | "message" | "href" | "actorId" | "actorName">
) {
  await createNotificationsForRole(db, roles, {
    ...input,
    type: "announcement",
    inquiryId: null,
    dedupeKey: null,
  })
}

export async function ensureStaffReminderNotification(db: Db, staffId: string) {
  const now = new Date()
  const pendingCount = await db.collection("inquiries").countDocuments({ status: "pending" })
  const assignedCount = await db.collection("inquiries").countDocuments({
    assignedStaffId: staffId,
    status: "in-progress",
  })
  const remainingCount = pendingCount + assignedCount

  if (remainingCount === 0) return

  const recentReminder = await db.collection(NOTIFICATIONS_COLLECTION).findOne({
    recipientId: staffId,
    type: "staff-reminder",
    createdAt: { $gte: new Date(now.getTime() - NOTIFICATION_REMINDER_INTERVAL_MS) },
  })

  if (recentReminder) return

  await createNotification(db, {
    recipientId: staffId,
    recipientRole: "staff",
    type: "staff-reminder",
    title: "Remaining inquiries need attention",
    message: `${remainingCount} ${remainingCount === 1 ? "inquiry is" : "inquiries are"} still waiting or in progress.`,
    href: "/dashboard/records",
    dedupeKey: `staff-reminder:${staffId}:${Math.floor(now.getTime() / NOTIFICATION_REMINDER_INTERVAL_MS)}`,
    createdAt: now,
  })
}
