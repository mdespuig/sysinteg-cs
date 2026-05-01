import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import clientPromise from "@/lib/db"
import { generateInquiryId, type InquiryType } from "@/lib/inquiry-data"
import { authConfig } from "@/auth"
import { createNotification, createNotificationsForRole } from "@/lib/notifications"

const STAFF_RATINGS_COLLECTION = "staffRatings"

export async function createInquiry(request: NextRequest) {
  try {
    const body = await request.json()
    const { inquiryType, patientName, contactNumber, email, address, relationship, details } = body

    if (!inquiryType || !patientName || !contactNumber || !email || !address || !relationship || !details) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    const validTypes = ["appointment", "billing", "medical-records", "prescription", "insurance", "general", "complaint"]
    if (!validTypes.includes(inquiryType)) {
      return NextResponse.json(
        { error: "Invalid inquiry type" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiriesCollection = db.collection("inquiries")

    const inquiryId = generateInquiryId()

    let userId = null
    try {
      const session = await getServerSession(authConfig)
      userId = (session?.user as any)?.id || null
    } catch {
      userId = null
    }

    const inquiry = {
      id: inquiryId,
      userId,
      type: inquiryType as InquiryType,
      patientName: patientName.trim(),
      contactNumber: contactNumber.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      relationship,
      details: details.trim(),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await inquiriesCollection.insertOne(inquiry)
    await createNotificationsForRole(db, ["admin", "staff"], {
      type: "inquiry-created",
      title: "New inquiry received",
      message: `Inquiry ${inquiry.id} is waiting for review.`,
      href: "/dashboard/records",
      inquiryId: inquiry.id,
      actorId: userId,
      actorName: patientName.trim(),
      dedupeKey: `inquiry-created:${inquiry.id}`,
    })

    return NextResponse.json(
      {
        success: true,
        inquiryId,
        message: "Inquiry submitted successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error submitting inquiry:", error)
    return NextResponse.json(
      { error: "Failed to submit inquiry. Please try again later." },
      { status: 500 }
    )
  }
}

export async function listOrGetInquiry(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const session = await getServerSession(authConfig)
    const currentUserId = (session?.user as any)?.id as string | undefined
    const role = (session?.user as any)?.role as string | undefined

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiriesCollection = db.collection("inquiries")

    if (id) {
      if (!currentUserId || !role) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        )
      }

      const inquiry =
        role === "admin"
          ? await inquiriesCollection.findOne({ id: id.toUpperCase() })
          : await inquiriesCollection.findOne({
              id: id.toUpperCase(),
              userId: currentUserId,
            })
      if (!inquiry) {
        return NextResponse.json(
          { error: "Inquiry not found or unauthorized" },
          { status: 403 }
        )
      }
      const rating = await db.collection(STAFF_RATINGS_COLLECTION).findOne({ inquiryId: inquiry.id })
      return NextResponse.json(
        {
          success: true,
          data: {
            ...inquiry,
            _id: inquiry._id?.toString(),
            staffRating: rating
              ? {
                  id: rating._id.toString(),
                  staffId: rating.staffId,
                  staffName: rating.staffName,
                  userId: rating.userId,
                  userName: rating.userName,
                  rating: rating.rating,
                  messageDetails: rating.messageDetails,
                  createdAt: rating.createdAt,
                }
              : inquiry.staffRating || null,
          },
        },
      { status: 200 }
      )
    }

    if (!currentUserId || !role) {
      return NextResponse.json(
        { error: "Authentication required to view inquiries" },
        { status: 401 }
      )
    }

    const inquiries = await inquiriesCollection
      .find(role === "admin" ? {} : { userId: currentUserId })
      .sort({ createdAt: -1 })
      .toArray()
    const inquiryIds = inquiries.map((inquiry) => inquiry.id).filter(Boolean)
    const ratings = inquiryIds.length
      ? await db
          .collection(STAFF_RATINGS_COLLECTION)
          .find(role === "admin" ? { inquiryId: { $in: inquiryIds } } : { inquiryId: { $in: inquiryIds }, userId: currentUserId })
          .toArray()
      : []
    const ratingMap = new Map(ratings.map((rating) => [rating.inquiryId, rating]))
    const data = inquiries.map((inquiry) => {
      const rating = ratingMap.get(inquiry.id)

      return {
        ...inquiry,
        _id: inquiry._id?.toString(),
        staffRating: rating
          ? {
              id: rating._id.toString(),
              staffId: rating.staffId,
              staffName: rating.staffName,
              userId: rating.userId,
              userName: rating.userName,
              rating: rating.rating,
              messageDetails: rating.messageDetails,
              createdAt: rating.createdAt,
            }
          : inquiry.staffRating || null,
      }
    })

    return NextResponse.json(
      {
        success: true,
        count: inquiries.length,
        data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching inquiries:", error)
    return NextResponse.json(
      { error: "Failed to fetch inquiries" },
      { status: 500 }
    )
  }
}

export async function updateInquiry(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    const role = (session?.user as any)?.role as string | undefined

    if (!(session?.user as any)?.id || role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { inquiryId, status, details } = body

    if (!inquiryId) {
      return NextResponse.json(
        { error: "Inquiry ID is required" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiriesCollection = db.collection("inquiries")

    const result = await inquiriesCollection.updateOne(
      { id: inquiryId },
      {
        $set: {
          ...(status && { status }),
          ...(details && { details }),
          updatedAt: new Date(),
        },
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Inquiry not found or unauthorized" },
        { status: 404 }
      )
    }

    const updatedInquiry = await inquiriesCollection.findOne({ id: inquiryId })
    if (updatedInquiry?.assignedStaffId) {
      await createNotification(db, {
        recipientId: updatedInquiry.assignedStaffId,
        recipientRole: "staff",
        type: "inquiry-updated",
        title: "Inquiry updated",
        message: `Inquiry ${updatedInquiry.id} was updated by the user.`,
        href: `/support/messages/${encodeURIComponent(updatedInquiry.id)}`,
        inquiryId: updatedInquiry.id,
        actorId: (session?.user as any)?.id!,
        actorName: session?.user?.name || session?.user?.email || "Standard User",
      })
    }

    return NextResponse.json(
      { success: true, message: "Inquiry updated successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error updating inquiry:", error)
    return NextResponse.json(
      { error: "Failed to update inquiry" },
      { status: 500 }
    )
  }
}

export async function deleteInquiry(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    const role = (session?.user as any)?.role as string | undefined

    if (!(session?.user as any)?.id || role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { inquiryId } = body

    if (!inquiryId) {
      return NextResponse.json(
        { error: "Inquiry ID is required" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiriesCollection = db.collection("inquiries")

    const result = await inquiriesCollection.deleteOne({
      id: inquiryId,
    })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Inquiry not found or unauthorized" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: true, message: "Inquiry deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting inquiry:", error)
    return NextResponse.json(
      { error: "Failed to delete inquiry" },
      { status: 500 }
    )
  }
}
