import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"

const COLLECTION = "profile"
const PHONE_PREFIX = "+639"
const PHONE_DIGIT_LIMIT = 9
const PHONE_PREFIX_DIGITS = PHONE_PREFIX.replace(/\D/g, "")

const isValidObjectId = (value: string) =>
  ObjectId.isValid(value) && String(new ObjectId(value)) === value

const normalizePhoneNumber = (value: unknown) => {
  if (typeof value !== "string") return null

  const digits = value.replace(/\D/g, "")
  if (digits.length === PHONE_DIGIT_LIMIT && /^\d{9}$/.test(digits)) {
    return `${PHONE_PREFIX}${digits}`
  }

  if (
    digits.length === PHONE_PREFIX_DIGITS.length + PHONE_DIGIT_LIMIT &&
    digits.startsWith(PHONE_PREFIX_DIGITS)
  ) {
    const phoneDigits = digits.slice(-PHONE_DIGIT_LIMIT)
    if (/^\d{9}$/.test(phoneDigits)) {
      return `${PHONE_PREFIX}${phoneDigits}`
    }
  }

  return null
}

async function requireSessionUser() {
  const session = await getServerSession(authConfig)
  const userId = (session?.user as any)?.id as string | undefined

  if (!userId || !isValidObjectId(userId)) {
    return null
  }

  return { session, userId }
}

export async function getProfile(request: NextRequest) {
  try {
    const auth = await requireSessionUser()
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const [profile, user] = await Promise.all([
      db.collection(COLLECTION).findOne({ userId: auth.userId }),
      db.collection("users").findOne(
        { _id: new ObjectId(auth.userId) },
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
    const auth = await requireSessionUser()
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const {
      userId,
      avatarOnly = false,
      profileImage = null,
      personalData,
      emergencyContact,
      cropMode = false,
    } = body

    if (userId && userId !== auth.userId) {
      return NextResponse.json({ error: "You can only update your own profile" }, { status: 403 })
    }

    if (!avatarOnly && (!personalData || !emergencyContact)) {
      return NextResponse.json({ error: "Profile data is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const profiles = db.collection(COLLECTION)
    const [existingProfile, user] = await Promise.all([
      profiles.findOne({ userId: auth.userId }),
      db.collection("users").findOne(
        { _id: new ObjectId(auth.userId) },
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

    if (avatarOnly) {
      await profiles.updateOne(
        { userId: auth.userId },
        {
          $set: {
            userId: auth.userId,
            profileImage,
            email: user?.email ?? existingProfile?.email ?? null,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      )

      const savedProfile = await profiles.findOne({ userId: auth.userId })
      return NextResponse.json(
        { message: "Avatar saved successfully", data: savedProfile },
        { status: 200 }
      )
    }

    const normalizedPersonalContactNumber = normalizePhoneNumber(personalData?.contactNumber)
    const normalizedEmergencyContactNumber = normalizePhoneNumber(emergencyContact?.contactNumber)

    if (!normalizedPersonalContactNumber || !normalizedEmergencyContactNumber) {
      return NextResponse.json(
        { error: "Contact numbers must contain exactly 9 digits after +639" },
        { status: 400 }
      )
    }

    const setData: Record<string, unknown> = {
      userId: auth.userId,
      profileImage,
      email: user?.email ?? existingProfile?.email ?? null,
      updatedAt: now,
    }

    setData.personalData = {
      ...personalData,
      contactNumber: normalizedPersonalContactNumber,
    }
    setData.emergencyContact = {
      ...emergencyContact,
      contactNumber: normalizedEmergencyContactNumber,
    }

    await profiles.updateOne(
      { userId: auth.userId },
      {
        $set: setData,
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    )

    const savedProfile = await profiles.findOne({ userId: auth.userId })
    return NextResponse.json(
      { message: "Profile saved successfully", data: savedProfile },
      { status: 200 }
    )
  } catch (error) {
    console.error("Failed to save profile:", error)
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}
