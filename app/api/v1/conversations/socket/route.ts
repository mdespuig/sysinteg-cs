import { NextRequest, NextResponse } from "next/server"
import { CONVERSATION_SOCKET_PATH } from "@/lib/conversation-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const inquiryId = searchParams.get("inquiryId")

  return NextResponse.json(
    {
      success: false,
      endpoint: `${CONVERSATION_SOCKET_PATH}${inquiryId ? `?inquiryId=${encodeURIComponent(inquiryId)}` : ""}`,
      events: {
        incoming: ["conversation.message.created", "conversation.typing"],
        outgoing: ["conversation.message.create", "conversation.typing"],
      },
      message:
        "WebSocket upgrade handling must be attached to the Next.js server runtime. The chat UI targets this v1 socket endpoint and falls back to REST polling when upgrade is unavailable.",
    },
    { status: 426 }
  )
}
