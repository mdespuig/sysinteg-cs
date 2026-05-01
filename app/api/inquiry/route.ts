import { NextRequest } from "next/server"
import { createInquiry } from "@/app/api/v1/inquiries/controllers"

export async function POST(request: NextRequest) {
  return createInquiry(request)
}
