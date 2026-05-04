import { NextRequest } from "next/server"
import { getProfile, updateProfile } from "./controllers"

export async function GET() {
  return getProfile()
}

export async function PUT(request: NextRequest) {
  return updateProfile(request)
}
