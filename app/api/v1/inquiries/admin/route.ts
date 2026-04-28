import { NextRequest } from "next/server"
import { deleteAdminInquiry, getAdminInquiries } from "./controllers"

export async function GET() {
  return getAdminInquiries()
}

export async function DELETE(request: NextRequest) {
  return deleteAdminInquiry(request)
}
