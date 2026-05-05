import { NextRequest } from "next/server"
import { createAnnouncement, deleteNotification, listNotifications, markNotificationsRead } from "./controllers"

export async function GET() {
  return listNotifications()
}

export async function PATCH(request: NextRequest) {
  return markNotificationsRead(request)
}

export async function DELETE(request: NextRequest) {
  return deleteNotification(request)
}

export async function POST(request: NextRequest) {
  return createAnnouncement(request)
}
