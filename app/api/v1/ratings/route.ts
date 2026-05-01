import { NextRequest } from "next/server"
import { createRating } from "./controllers"

export async function POST(request: NextRequest) {
  return createRating(request)
}
