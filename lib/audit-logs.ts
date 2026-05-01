import type { Db } from "mongodb"

export const AUDIT_LOGS_COLLECTION = "auditLogs"

export type AuditActorRole = "admin" | "staff"

export type AuditAction =
  | "inquiry.assigned"
  | "inquiry.rejected"
  | "inquiry.resolved"
  | "inquiry.closed"
  | "inquiry.deleted"
  | "conversation.message.sent"
  | "conversation.deleted"
  | "announcement.sent"

type AuditLogInput = {
  action: AuditAction
  actorId: string
  actorName: string
  actorRole: AuditActorRole
  inquiryId?: string | null
  title: string
  description: string
  metadata?: Record<string, unknown>
  createdAt?: Date
}

async function logActivity(db: Db, input: AuditLogInput) {
  const now = input.createdAt || new Date()

  await db.collection(AUDIT_LOGS_COLLECTION).insertOne({
    action: input.action,
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    staffId: input.actorRole === "staff" ? input.actorId : null,
    staffName: input.actorRole === "staff" ? input.actorName : null,
    inquiryId: input.inquiryId || null,
    title: input.title,
    description: input.description,
    metadata: input.metadata || {},
    createdAt: now,
  })
}

export async function logStaffActivity(
  db: Db,
  input: Omit<AuditLogInput, "actorId" | "actorName" | "actorRole"> & {
    staffId: string
    staffName: string
  }
) {
  await logActivity(db, {
    ...input,
    actorId: input.staffId,
    actorName: input.staffName,
    actorRole: "staff",
  })
}

export async function logAdminActivity(
  db: Db,
  input: Omit<AuditLogInput, "actorId" | "actorName" | "actorRole"> & {
    adminId: string
    adminName: string
  }
) {
  await logActivity(db, {
    ...input,
    actorId: input.adminId,
    actorName: input.adminName,
    actorRole: "admin",
  })
}
