import { listAuditLogs } from "./controllers"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return listAuditLogs(request)
}
