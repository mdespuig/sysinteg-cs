import bcrypt from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import clientPromise from "@/lib/db"

const USERS_COLLECTION = "users"
const PROFILE_COLLECTION = "profile"
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false
const sessionCookieName = `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`
const subsystemLoginUrl = process.env.AUTH_SUBSYSTEM_VERIFY_URL || ""
const subsystemApiKey = process.env.AUTH_SUBSYSTEM_API_KEY || ""
const roleSelectionRequiredMessage = "Choose Staff or Administrator before logging in"

type SupportRole = "staff" | "admin"

function buildDisplayName(profile: any, user: any) {
  const firstName = String(profile?.personalData?.firstName || "").trim()
  const lastName = String(profile?.personalData?.lastName || "").trim()
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

  if (fullName) return fullName

  return String(user?.email || "").trim()
}

function normalizeRequestedRole(value: unknown): SupportRole | null {
  const role = String(value || "").trim().toLowerCase()

  if (role === "staff") return "staff"
  if (role === "admin" || role === "administrator") return "admin"

  return null
}

function normalizeSubsystemRole(value: unknown): SupportRole | null {
  const role = String(value || "").trim().toLowerCase()

  if (!role) return null
  if (role.includes("admin") || role.includes("administrator")) return "admin"
  if (role.includes("staff")) return "staff"

  return null
}

function readSubsystemUser(payload: any) {
  return payload?.data?.user || payload?.user || payload?.data || payload || {}
}

function readSubsystemRole(payload: any): SupportRole | null {
  const user = readSubsystemUser(payload)
  const candidates = [
    user?.role,
    user?.userRole,
    user?.accountType,
    user?.type,
    user?.position,
    user?.accessLevel,
    user?.subsystemRole,
    payload?.role,
    payload?.userRole,
    payload?.accountType,
  ]

  for (const candidate of candidates) {
    const role = normalizeSubsystemRole(candidate)
    if (role) return role
  }

  return null
}

function buildRoleMismatchMessage(actualRole: SupportRole, requestedRole: SupportRole) {
  if (actualRole === "admin" && requestedRole === "staff") {
    return "This account is an administrator. Use Login as Administrator."
  }

  return "This account is staff. Use Login as Staff."
}

async function authenticateLocally(username: string, password: string) {
  const client = await clientPromise
  const db = client.db("healthcare")
  const usersCollection = db.collection(USERS_COLLECTION)
  const profileCollection = db.collection(PROFILE_COLLECTION)

  const user = await usersCollection.findOne({
    username: username.trim().toLowerCase(),
  })

  if (!user) return null

  const passwordMatch = await bcrypt.compare(password, user.password as string)
  if (!passwordMatch) return null

  const profile = user?._id ? await profileCollection.findOne({ userId: user._id.toString() }) : null
  const displayName =
    user?.role === "admin" ? String(user.username || "").trim() : buildDisplayName(profile, user)

  return {
    id: user._id?.toString(),
    name: displayName,
    email: user.email,
    image: null,
    role: user.role,
  }
}

async function authenticateExternally(username: string, password: string, subsystem: string) {
  const response = await fetch(subsystemLoginUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Subsystem-Key": subsystemApiKey,
    },
    body: JSON.stringify({
      username: username.trim(),
      password,
      subsystem,
    }),
    cache: "no-store",
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Invalid credentials")
  }

  return payload
}

async function upsertExternalUser({
  username,
  email,
  name,
  role,
}: {
  username: string
  email: string | null
  name: string
  role: SupportRole
}) {
  const client = await clientPromise
  const db = client.db("healthcare")
  const usersCollection = db.collection(USERS_COLLECTION)
  const profilesCollection = db.collection(PROFILE_COLLECTION)
  const now = new Date()

  const normalizedUsername = username.trim().toLowerCase()
  const externalKey = `subsystem:customer:${normalizedUsername}:${role}`
  const localUsername = `${normalizedUsername}.${role}`
  const existingUser = await usersCollection.findOne({
    "externalAuth.key": externalKey,
  })

  const userDoc = {
    username: localUsername,
    displayUsername: normalizedUsername,
    email: email || null,
    role,
    name,
    source: "subsystem",
    externalAuth: {
      key: externalKey,
      provider: "subsystem",
      username: normalizedUsername,
      subsystem: "Customer",
      role,
    },
    updatedAt: now,
  }

  let userId: string

  if (existingUser?._id) {
    await usersCollection.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          ...userDoc,
          createdAt: existingUser.createdAt || now,
        },
      }
    )
    userId = existingUser._id.toString()
  } else {
    const result = await usersCollection.insertOne({
      ...userDoc,
      createdAt: now,
    })
    userId = result.insertedId.toString()
  }

  await profilesCollection.updateOne(
    { userId },
    {
      $setOnInsert: {
        userId,
        createdAt: now,
      },
      $set: {
        email: email || null,
        updatedAt: now,
      },
    },
    { upsert: true }
  )

  return userId
}

export const authConfig: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        subsystem: { label: "Subsystem", type: "hidden" },
        loginAs: { label: "Login As", type: "hidden" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Please provide both username and password")
        }

        try {
          const username = String(credentials.username)
          const password = String(credentials.password)
          const subsystem = String(credentials.subsystem || "Customer").trim() || "Customer"
          const requestedRole = normalizeRequestedRole(credentials.loginAs)

          if (!requestedRole) {
            const localUser = await authenticateLocally(username, password)
            if (localUser) return localUser

            if (subsystem !== "Customer") {
              throw new Error("Invalid credentials")
            }

            const payload = await authenticateExternally(username, password, subsystem)
            const actualRole = readSubsystemRole(payload)

            if (!actualRole) {
              throw new Error("This account is not authorized for staff or administrator access")
            }

            throw new Error(roleSelectionRequiredMessage)
          }

          if (subsystem !== "Customer") {
            throw new Error("Invalid subsystem")
          }

          const payload = await authenticateExternally(username, password, subsystem)
          const actualRole = readSubsystemRole(payload)
          if (!actualRole) {
            throw new Error("This account is not authorized for staff or administrator access")
          }

          if (actualRole !== requestedRole) {
            throw new Error(buildRoleMismatchMessage(actualRole, requestedRole))
          }

          const subsystemUser = readSubsystemUser(payload)
          const displayName =
            String(subsystemUser?.name || subsystemUser?.fullName || subsystemUser?.displayName || "").trim() ||
            username.trim()
          const normalizedUsername = username.trim().toLowerCase()
          const email = String(subsystemUser?.email || "").trim() || null
          const localUserId = await upsertExternalUser({
            username: normalizedUsername,
            email,
            name: displayName,
            role: actualRole,
          })

          return {
            id: localUserId,
            name: displayName,
            email,
            username: normalizedUsername,
            image: null,
            role: actualRole,
          }
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : "Authentication failed")
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name ?? token.name
        token.role = (user as any).role ?? token.role
        token.username = (user as any).username ?? token.username
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = (token.name as string) || session.user.name
        ;(session.user as any).role = token.role as string
        ;(session.user as any).username = token.username as string | undefined
      }
      return session
    },
  },
}
