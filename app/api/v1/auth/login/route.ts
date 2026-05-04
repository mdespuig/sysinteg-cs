import { NextRequest } from "next/server"
import { loginUser } from "./controllers"

export async function POST(request: NextRequest) {
  return loginUser(request)
}
