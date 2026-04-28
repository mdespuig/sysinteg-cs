import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import clientPromise from "@/lib/db"
import { generateIssueId, type IssueType } from "@/lib/issue-data"
import { authConfig } from "@/auth"

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authConfig)
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { issueType, patientName, contactNumber, email, address, relationship, details } = body

    // Validation
    if (!issueType || !patientName || !contactNumber || !email || !address || !relationship || !details) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const issuesCollection = db.collection("issues")

    // Generate unique issue ID
    const issueId = generateIssueId()

    // Create issue document
    const issue = {
      id: issueId,
      userId: session.user.id,
      type: issueType as IssueType,
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

    // Insert into database
    await issuesCollection.insertOne(issue)

    return NextResponse.json(
      { success: true, issueId },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error submitting issue:", error)
    return NextResponse.json(
      { error: "Failed to submit issue" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authConfig)
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const client = await clientPromise
    const db = client.db("healthcare")
    const issuesCollection = db.collection("issues")

    // Fetch only user's issues
    const issues = await issuesCollection
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json(
      { 
        success: true, 
        issues: issues.map(issue => ({
          ...issue,
          _id: issue._id?.toString() || ""
        }))
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching issues:", error)
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    )
  }
}
