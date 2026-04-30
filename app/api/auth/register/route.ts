import { NextRequest } from "next/server"
import { registerUser } from "@/app/api/v1/auth/register/controllers"

export async function POST(request: NextRequest) {
  return registerUser(request)
}
