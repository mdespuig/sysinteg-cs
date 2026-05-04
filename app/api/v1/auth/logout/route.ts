import { NextRequest } from "next/server"
import { logoutUser } from "./controllers"

export async function POST(request: NextRequest) {
  return logoutUser(request)
}
