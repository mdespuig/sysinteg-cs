import { ObjectId } from "mongodb"
import bcrypt from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import clientPromise from "@/lib/db"

const USERS_COLLECTION = "users"
const PROFILE_COLLECTION = "profile"
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false
const sessionCookieName = `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`

function buildDisplayName(profile: any, user: any) {
  const firstName = String(profile?.personalData?.firstName || "").trim()
  const lastName = String(profile?.personalData?.lastName || "").trim()
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

  if (fullName) return fullName

  return String(user?.email || "").trim()
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
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Please provide both username and password")
        }

        try {
          const client = await clientPromise
          const db = client.db("healthcare")
          const usersCollection = db.collection(USERS_COLLECTION)
          const profileCollection = db.collection(PROFILE_COLLECTION)

          const user = await usersCollection.findOne({
            username: (credentials.username as string).trim().toLowerCase(),
          })

          if (!user) {
            throw new Error("Invalid credentials")
          }

          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.password as string
          )

          if (!passwordMatch) {
            throw new Error("Invalid credentials")
          }

          const profile = user?._id
            ? await profileCollection.findOne({ userId: user._id.toString() })
            : null
          const displayName =
            user?.role === "admin"
              ? String(user.username || "").trim()
              : buildDisplayName(profile, user)

          return {
            id: user._id?.toString(),
            name: displayName,
            email: user.email,
            image: null,
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
        try {
          const client = await clientPromise
          const db = client.db("healthcare")
          const usersCollection = db.collection(USERS_COLLECTION)
          const profileCollection = db.collection(PROFILE_COLLECTION)
          if (ObjectId.isValid(user.id)) {
            const dbUser = await usersCollection.findOne({
              _id: new ObjectId(user.id),
            })
            if (dbUser) {
              token.role = dbUser.role
              const profile = await profileCollection.findOne({ userId: user.id })
              token.name =
                dbUser.role === "admin"
                  ? String(dbUser.username || token.name || "").trim()
                  : buildDisplayName(profile, dbUser) || token.name
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = (token.name as string) || session.user.name
        ;(session.user as any).role = token.role as string
      }
      return session
    },
  },
}
