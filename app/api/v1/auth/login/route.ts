import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/db"

const NEXTAUTH_CSRF_URL = "/api/auth/csrf"
const NEXTAUTH_CREDENTIALS_URL = "/api/auth/callback/credentials"

async function getCsrfCookieOrigin(request: NextRequest) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

async function getRedirectForUser(username: string) {
  const client = await clientPromise
  const db = client.db("healthcare")
  const user = await db.collection("users").findOne(
    { username: username.trim().toLowerCase() },
    { projection: { role: 1, _id: 1 } }
  )

  const role = user?.role
  if (role === "staff" || role === "admin") return "/dashboard"
  return "/"
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const username = formData.get("username")
    const password = formData.get("password")
    const csrfToken = formData.get("csrfToken")
    const callbackUrl = formData.get("callbackUrl") || "/dashboard"

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Username and password are required" }, { status: 400 })
    }

    const origin = await getCsrfCookieOrigin(request)

    if (typeof csrfToken !== "string" || !csrfToken) {
      const csrfResponse = await fetch(`${origin}${NEXTAUTH_CSRF_URL}`, {
        headers: { cookie: request.headers.get("cookie") || "" },
        cache: "no-store",
      })
      if (!csrfResponse.ok) {
        return NextResponse.json({ success: false, error: "Failed to initialize login" }, { status: 500 })
      }
      const csrfPayload = await csrfResponse.json()
      if (!csrfPayload?.csrfToken) {
        return NextResponse.json({ success: false, error: "Failed to initialize login" }, { status: 500 })
      }
      formData.set("csrfToken", csrfPayload.csrfToken)
    }

    formData.set("callbackUrl", String(callbackUrl))
    formData.set("json", "true")
    formData.set("redirect", "false")

    const authResponse = await fetch(`${origin}${NEXTAUTH_CREDENTIALS_URL}`, {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(formData as any).toString(),
      redirect: "manual",
      cache: "no-store",
    })

    const contentType = authResponse.headers.get("content-type") || ""
    const location = authResponse.headers.get("location") || ""
    const setCookie = authResponse.headers.get("set-cookie")

    const responseBody = contentType.includes("application/json")
      ? await authResponse.json().catch(() => null)
      : null

    if (!authResponse.ok || (location && location.includes("/api/auth/signin?csrf=true"))) {
      const message =
        responseBody?.error ||
        "Login failed"

      const failureResponse = NextResponse.json(
        { success: false, error: message },
        { status: authResponse.status === 200 ? 401 : authResponse.status }
      )
      if (setCookie) failureResponse.headers.set("set-cookie", setCookie)
      return failureResponse
    }

    const successResponse = NextResponse.json(
      {
        success: true,
        message: "Logged in successfully",
        redirectTo: await getRedirectForUser(username),
      },
      { status: 200 }
    )

    if (setCookie) successResponse.headers.set("set-cookie", setCookie)
    return successResponse
  } catch (error) {
    console.error("Custom login failed:", error)
    return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 })
  }
}
