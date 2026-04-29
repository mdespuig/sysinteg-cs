import { ObjectId } from "mongodb"
import bcrypt from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import clientPromise from "@/lib/db"

const USERS_COLLECTION = "users"
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") || process.env.NODE_ENV === "production"
const sessionCookieName = `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`

export const authConfig: NextAuthOptions = {
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

          return {
            id: user._id?.toString(),
            name: (user.username as string).toLowerCase(),
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
        try {
          const client = await clientPromise
          const db = client.db("healthcare")
          const usersCollection = db.collection(USERS_COLLECTION)
          const dbUser = await usersCollection.findOne({
            _id: new ObjectId(user.id),
          })
          if (dbUser) {
            token.role = dbUser.role
          }
        } catch (error) {
          console.error("Error fetching user role:", error)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        ;(session.user as any).role = token.role as string
      }
      return session
    },
  },
}
