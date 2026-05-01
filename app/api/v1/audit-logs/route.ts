import { listAuditLogs } from "./controllers"

export async function GET() {
  return listAuditLogs()
}
