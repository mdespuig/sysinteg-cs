import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/db"

const COLLECTION = "profile"

const isValidObjectId = (value: string) =>
  ObjectId.isValid(value) && String(new ObjectId(value)) === value

export async function getProfile(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId || !isValidObjectId(userId)) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const [profile, user] = await Promise.all([
      db.collection(COLLECTION).findOne({ userId }),
      db.collection("users").findOne(
        { _id: new ObjectId(userId) },
        { projection: { email: 1 } }
      ),
    ])

    return NextResponse.json(
      {
        data: profile
          ? {
              ...profile,
              email: profile.email ?? user?.email ?? null,
            }
          : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Failed to load profile:", error)
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }
}

export async function updateProfile(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, isAdmin, profileImage = null, personalData, emergencyContact, cropMode = false } = body

    if (!userId || !isValidObjectId(userId)) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 })
    }

    if (!isAdmin && (!personalData || !emergencyContact)) {
      return NextResponse.json({ error: "Profile data is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const profiles = db.collection(COLLECTION)
    const [existingProfile, user] = await Promise.all([
      profiles.findOne({ userId }),
      db.collection("users").findOne(
        { _id: new ObjectId(userId) },
        { projection: { email: 1 } }
      ),
    ])

    if (cropMode && !existingProfile?.profileImage) {
      return NextResponse.json(
        { error: "Upload a custom profile photo before cropping" },
        { status: 403 }
      )
    }

    const now = new Date()

    const setData: Record<string, unknown> = {
      userId,
      profileImage,
      email: user?.email ?? existingProfile?.email ?? null,
      updatedAt: now,
    }

    if (!isAdmin) {
      setData.personalData = personalData
      setData.emergencyContact = emergencyContact
    }

    await profiles.updateOne(
      { userId },
      {
        $set: setData,
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    )

    const savedProfile = await profiles.findOne({ userId })
    return NextResponse.json(
      { message: "Profile saved successfully", data: savedProfile },
      { status: 200 }
    )
  } catch (error) {
    console.error("Failed to save profile:", error)
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}
