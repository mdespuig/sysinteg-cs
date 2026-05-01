import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"
import { AUDIT_LOGS_COLLECTION } from "@/lib/audit-logs"

const DATABASE_NAME = "healthcare"

function isValidApiKey(request: NextRequest) {
  const configuredKey = process.env.AUDIT_LOGS_API_KEY
  if (!configuredKey) return false

  const apiKey = request.headers.get("x-api-key")
  return apiKey === configuredKey
}

export async function listAuditLogs(request: NextRequest) {
  try {
    if (!isValidApiKey(request)) {
      const session = await getServerSession(authConfig)
      const role = (session?.user as any)?.role

      if (!(session?.user as any)?.id || role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 })
      }
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

    return NextResponse.json({
      success: true,
      count: logs.length,
      data: logs.map((log) => ({
        ...log,
        _id: log._id.toString(),
        actorId: log.actorId || log.staffId || null,
        actorName: log.actorName || log.staffName || "Unknown",
        actorRole: log.actorRole || "staff",
      })),
    })
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
  }
}
