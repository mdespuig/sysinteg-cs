import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import clientPromise from "@/lib/db"
import { generateInquiryId, type InquiryType } from "@/lib/inquiry-data"
import { authConfig } from "@/auth"

export async function POST(request: NextRequest) {
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

    const validTypes = ["appointment", "billing", "medical-records", "prescription", "insurance", "general", "complaint", "feedback"]
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiriesCollection = db.collection("inquiries")

    if (id) {
      const inquiry = await inquiriesCollection.findOne({ id: id.toUpperCase() })
      if (!inquiry) {
        return NextResponse.json(
          { error: "Inquiry not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: true, data: inquiry },
        { status: 200 }
      )
    }

    const session = await getServerSession(authConfig)

    if (!(session?.user as any)?.id) {
      return NextResponse.json(
        { error: "Authentication required to view inquiries" },
        { status: 401 }
      )
    }

    const inquiries = await inquiriesCollection
      .find({ userId: (session?.user as any)?.id! })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json(
      {
        success: true,
        count: inquiries.length,
        data: inquiries,
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

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)

    if (!(session?.user as any)?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
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
      { id: inquiryId, userId: (session?.user as any)?.id! },
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)

    if (!(session?.user as any)?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
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
      userId: (session?.user as any)?.id!,
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
