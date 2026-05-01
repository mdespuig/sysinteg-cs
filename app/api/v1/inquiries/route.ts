import { NextRequest } from "next/server"
import { createInquiry, deleteInquiry, listOrGetInquiry, updateInquiry } from "./controllers"

export async function POST(request: NextRequest) {
  return createInquiry(request)
}

export async function GET(request: NextRequest) {
  return listOrGetInquiry(request)
}

export async function PUT(request: NextRequest) {
  return updateInquiry(request)
}

export async function DELETE(request: NextRequest) {
  return deleteInquiry(request)
}
