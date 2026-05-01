import { NextRequest } from "next/server"
import { deleteAdminInquiry, getAdminInquiries, updateStaffInquiry } from "./controllers"

export async function GET(request: NextRequest) {
  return getAdminInquiries(request)
}

export async function DELETE(request: NextRequest) {
  return deleteAdminInquiry(request)
}

export async function PATCH(request: NextRequest) {
  return updateStaffInquiry(request)
}
