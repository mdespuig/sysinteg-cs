import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/db"
import { generateInquiryId, type InquiryType } from "@/lib/inquiry-data"

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

    const client = await clientPromise
    const db = client.db("healthcare")
    const inquiriesCollection = db.collection("inquiries")

    const inquiryId = generateInquiryId()

    const inquiry = {
      id: inquiryId,
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
      { success: true, inquiryId },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error submitting inquiry:", error)
    return NextResponse.json(
      { error: "Failed to submit inquiry" },
      { status: 500 }
    )
  }
}