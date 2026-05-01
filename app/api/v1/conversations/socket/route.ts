import { NextRequest } from "next/server"
import { getConversationSocket } from "./controllers"

export async function GET(request: NextRequest) {
  return getConversationSocket(request)
}
