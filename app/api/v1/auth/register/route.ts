import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import clientPromise from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    let { username, email, password, confirmPassword, role } = await request.json()

    if (typeof username === "string") {
      username = username.trim().toLowerCase()
    }

    const usernameRegex = /^[a-z0-9_]+$/

    if (!username || !email || !password || !confirmPassword || !role) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: "Username may only contain lowercase letters, numbers, and underscores" },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const usersCollection = db.collection("users")

    const existingUser = await usersCollection.findOne({
      $or: [{ username }, { email }],
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await usersCollection.insertOne({
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date(),
    })

    return NextResponse.json(
      {
        message: "User registered successfully",
        userId: result.insertedId,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    )
  }
}
