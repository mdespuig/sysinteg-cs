import { NextRequest } from "next/server"
import { claimStaffInquiry, deleteAdminInquiry, getAdminInquiries } from "./controllers"

export async function GET() {
  return getAdminInquiries()
}

export async function DELETE(request: NextRequest) {
  return deleteAdminInquiry(request)
}

export async function PATCH(request: NextRequest) {
  return claimStaffInquiry(request)
}
