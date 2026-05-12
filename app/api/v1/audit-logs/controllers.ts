import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"
import { AUDIT_LOGS_COLLECTION } from "@/lib/audit-logs"
import { ObjectId } from "mongodb"

const DATABASE_NAME = "healthcare"

function isValidApiKey(request: NextRequest) {
  const configuredKey = process.env.AUDIT_LOGS_API_KEY || process.env.AUTH_SUBSYSTEM_API_KEY
  if (!configuredKey) return false

  const apiKey = request.headers.get("x-api-key")
  return apiKey === configuredKey
}

async function requireAdminSession() {
  const session = await getServerSession(authConfig)
  const userId = (session?.user as any)?.id as string | undefined
  const role = (session?.user as any)?.role

  if (!userId || role !== "admin") {
    return null
  }

  return session
}

export async function listAuditLogs(request: NextRequest) {
  try {
    const hasApiKey = isValidApiKey(request)
    const session = hasApiKey ? null : await requireAdminSession()

    if (!hasApiKey && !session) {
      return NextResponse.json({ error: "Valid API key required" }, { status: 403 })
    }

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const logs = await db
      .collection(AUDIT_LOGS_COLLECTION)
      .find(
        {},
        {
          projection: {
            action: 1,
            actorId: 1,
            actorName: 1,
            actorRole: 1,
            staffId: 1,
            staffName: 1,
            inquiryId: 1,
            title: 1,
            description: 1,
            metadata: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()

    const actorIds = Array.from(
      new Set(
        logs
          .map((log) => String(log.actorId || log.staffId || "").trim())
          .filter((id) => id.length > 0)
      )
    )

    const [profiles, users] = await Promise.all([
      actorIds.length > 0
        ? db
            .collection("profile")
            .find(
              { userId: { $in: actorIds } },
              { projection: { userId: 1, "personalData.firstName": 1, "personalData.lastName": 1 } }
            )
            .toArray()
        : Promise.resolve([]),
      actorIds.length > 0
        ? db
            .collection("users")
            .find(
              { _id: { $in: actorIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
              { projection: { username: 1 } }
            )
            .toArray()
        : Promise.resolve([]),
    ])

    const profileNameByUserId = new Map<string, string>()
    for (const profile of profiles) {
      const firstName = String(profile?.personalData?.firstName || "").trim()
      const lastName = String(profile?.personalData?.lastName || "").trim()
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
      if (profile?.userId && fullName) {
        profileNameByUserId.set(String(profile.userId), fullName)
      }
    }

    const usernameByUserId = new Map<string, string>()
    for (const user of users) {
      const id = user?._id ? String(user._id) : ""
      const username = String(user?.username || "").trim()
      if (id && username) {
        usernameByUserId.set(id, username)
      }
    }

    return NextResponse.json({
      success: true,
      count: logs.length,
      data: logs.map((log) => {
        const actorId = String(log.actorId || log.staffId || "")
        const resolvedActorName =
          profileNameByUserId.get(actorId) ||
          log.actorName ||
          log.staffName ||
          usernameByUserId.get(actorId) ||
          "Unknown"
        const rawDescription = String(log.description || "")
        const namesToReplace = [
          String(log.actorName || "").trim(),
          String(log.staffName || "").trim(),
          String(usernameByUserId.get(actorId) || "").trim(),
        ].filter(Boolean)
        const resolvedDescription = namesToReplace.reduce((text, name) => {
          return text.split(name).join(resolvedActorName)
        }, rawDescription)

        return {
          ...log,
          _id: log._id.toString(),
          actorId: log.actorId || log.staffId || null,
          actorName: resolvedActorName,
          description: resolvedDescription,
          actorRole: log.actorRole || "staff",
        }
      }),
    })
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
  }
}
