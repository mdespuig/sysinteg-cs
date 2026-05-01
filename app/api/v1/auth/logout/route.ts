import { NextRequest, NextResponse } from "next/server"

const NEXTAUTH_CSRF_URL = "/api/auth/csrf"
const NEXTAUTH_SIGNOUT_URL = "/api/auth/signout"

async function getOrigin(request: NextRequest) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function POST(request: NextRequest) {
  try {
    const origin = await getOrigin(request)
    const csrfResponse = await fetch(`${origin}${NEXTAUTH_CSRF_URL}`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    })

    if (!csrfResponse.ok) {
      return NextResponse.json({ success: false, error: "Failed to initialize logout" }, { status: 500 })
    }

    const csrfData = await csrfResponse.json()
    if (!csrfData?.csrfToken) {
      return NextResponse.json({ success: false, error: "Failed to initialize logout" }, { status: 500 })
    }

    const body = new URLSearchParams({
      csrfToken: csrfData.csrfToken,
      callbackUrl: "/auth/login",
      json: "true",
    }).toString()

    const signOutResponse = await fetch(`${origin}${NEXTAUTH_SIGNOUT_URL}`, {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      redirect: "manual",
      cache: "no-store",
    })

    const setCookie = signOutResponse.headers.get("set-cookie")

    const response = NextResponse.json(
      {
        success: true,
        message: "You have successfully logged out",
        redirectTo: "/auth/login",
      },
      { status: 200 }
    )

    if (setCookie) response.headers.set("set-cookie", setCookie)
    return response
  } catch (error) {
    console.error("Custom logout failed:", error)
    return NextResponse.json({ success: false, error: "Logout failed" }, { status: 500 })
  }
}
