import { NextRequest } from "next/server"
import { getProfile, updateProfile } from "./controllers"

export async function GET(request: NextRequest) {
  return getProfile(request)
}

export async function PUT(request: NextRequest) {
  return updateProfile(request)
}
