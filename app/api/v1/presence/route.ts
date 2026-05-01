import { NextRequest } from "next/server"
import { updatePresence } from "./controllers"

export async function POST(request: NextRequest) {
  return updatePresence(request)
}
