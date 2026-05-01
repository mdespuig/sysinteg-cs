import { NextRequest } from "next/server"
import { registerUser } from "./controllers"

export async function POST(request: NextRequest) {
  return registerUser(request)
}
