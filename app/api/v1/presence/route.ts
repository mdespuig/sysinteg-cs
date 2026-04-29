import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig)
  const userId = (session?.user as any)?.id

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  let state: "online" | "offline" = "online"
  try {
    const body = await request.json()
    if (body?.state === "offline") {
      state = "offline"
    }
  } catch {
    state = "online"
  }

  const userName = session?.user?.name || null
  const now = new Date()
  const client = await clientPromise
  const db = client.db("healthcare")
  await db.collection("presence").updateOne(
    { userId },
    {
      $set: {
        userId,
        role: (session?.user as any)?.role || null,
        name: userName,
        isOnline: state === "online",
        lastSeenAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  )

  return NextResponse.json({ success: true }, { status: 200 })
}
