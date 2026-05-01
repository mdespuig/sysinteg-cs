import { NextRequest } from "next/server"
import { createAnnouncement, getLatestAnnouncement } from "./controllers"

export async function GET() {
  return getLatestAnnouncement()
}

export async function POST(request: NextRequest) {
  return createAnnouncement(request)
}

export async function PUT(request: NextRequest) {
  return createAnnouncement(request)
}
