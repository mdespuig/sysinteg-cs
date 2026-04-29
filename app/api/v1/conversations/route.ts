import { NextRequest } from "next/server"
import { createConversationMessage, getConversation, updateConversationInquiryStatus, updateTypingStatus } from "./controllers"

export async function GET(request: NextRequest) {
  return getConversation(request)
}

export async function POST(request: NextRequest) {
  return createConversationMessage(request)
}

export async function PATCH(request: NextRequest) {
  return updateConversationInquiryStatus(request)
}

export async function PUT(request: NextRequest) {
  return updateTypingStatus(request)
}
