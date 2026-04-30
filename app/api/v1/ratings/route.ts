import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import clientPromise from "@/lib/db"

const DATABASE_NAME = "healthcare"
const INQUIRIES_COLLECTION = "inquiries"
const USERS_COLLECTION = "users"
const STAFF_RATINGS_COLLECTION = "staffRatings"

function normalizeInquiryId(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    const userId = (session?.user as any)?.id as string | undefined
    const role = (session?.user as any)?.role

    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    if (role !== "standard") {
      return NextResponse.json({ error: "Only standard users can submit ratings" }, { status: 403 })
    }

    const body = await request.json()
    const inquiryId = normalizeInquiryId(body.inquiryId)
    const rating = Number(body.rating)
    const messageDetails = typeof body.messageDetails === "string" ? body.messageDetails.trim().slice(0, 1000) : ""

    if (!inquiryId) {
      return NextResponse.json({ error: "Inquiry ID is required" }, { status: 400 })
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(DATABASE_NAME)
    const inquiry = await db.collection(INQUIRIES_COLLECTION).findOne({
      id: inquiryId,
      userId,
      status: { $in: ["resolved", "closed"] },
    })

    if (!inquiry) {
      return NextResponse.json({ error: "Resolved inquiry not found" }, { status: 404 })
    }

    const staffId = inquiry.assignedStaffId || inquiry.staffId
    if (!staffId) {
      return NextResponse.json({ error: "This inquiry has no assigned staff to rate" }, { status: 400 })
    }

    const now = new Date()
    const userName = session!.user?.name || session!.user?.email || inquiry.patientName || "Standard User"
    const staffName = inquiry.assignedStaff || "Assigned Staff"
    const ratingDoc = {
      inquiryId: inquiry.id,
      staffId,
      staffName,
      userId,
      userName,
      rating,
      messageDetails,
      inquiryDetails: inquiry.details || "",
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection(STAFF_RATINGS_COLLECTION).updateOne(
      { inquiryId: inquiry.id, userId },
      { $setOnInsert: ratingDoc },
      { upsert: true }
    )

    if (result.matchedCount > 0) {
      return NextResponse.json({ error: "You have already rated this inquiry" }, { status: 409 })
    }

    const aggregate = await db
      .collection(STAFF_RATINGS_COLLECTION)
      .aggregate([
        { $match: { staffId } },
        {
          $group: {
            _id: "$staffId",
            totalRatings: { $sum: 1 },
            ratingSum: { $sum: "$rating" },
            averageRating: { $avg: "$rating" },
          },
        },
      ])
      .next()

    if (ObjectId.isValid(staffId)) {
      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(staffId) },
        {
          $set: {
            staffTotalRatings: aggregate?.totalRatings || 0,
            staffRatingSum: aggregate?.ratingSum || 0,
            staffAverageRating: aggregate?.averageRating || 0,
            staffRatingsUpdatedAt: now,
          },
        }
      )
    }

    await db.collection(INQUIRIES_COLLECTION).updateOne(
      { id: inquiry.id },
      {
        $set: {
          staffRating: {
            staffId,
            staffName,
            userId,
            userName,
            rating,
            messageDetails,
            createdAt: now,
          },
          updatedAt: now,
        },
      }
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          inquiryId: inquiry.id,
          staffId,
          rating,
          messageDetails,
          createdAt: now,
          totalRatings: aggregate?.totalRatings || 1,
          averageRating: aggregate?.averageRating || rating,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error submitting staff rating:", error)
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 })
  }
}
