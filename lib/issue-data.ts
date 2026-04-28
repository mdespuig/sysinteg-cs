export interface Issue {
  _id?: string
  id: string
  userId: string
  type: IssueType
  patientName: string
  contactNumber: string
  email: string
  address: string
  relationship: string
  details: string
  status: "pending" | "in-progress" | "resolved" | "closed"
  createdAt: Date
  updatedAt: Date
}

export type IssueType =
  | "appointment"
  | "billing"
  | "medical-records"
  | "prescription"
  | "insurance"
  | "general"
  | "complaint"
  | "feedback"

export const issueTypes: { value: IssueType; label: string; description: string }[] = [
  { value: "appointment", label: "Appointment Inquiry", description: "Schedule, reschedule, or cancel appointments" },
  { value: "billing", label: "Billing & Payments", description: "Questions about bills, payments, or charges" },
  { value: "medical-records", label: "Medical Records", description: "Request copies or updates to medical records" },
  { value: "prescription", label: "Prescription Refill", description: "Request prescription refills or renewals" },
  { value: "insurance", label: "Insurance & Coverage", description: "Insurance verification and coverage questions" },
  { value: "general", label: "General Inquiry", description: "General questions about services or facilities" },
  { value: "complaint", label: "File a Complaint", description: "Report issues or concerns" },
  { value: "feedback", label: "Provide Feedback", description: "Share your experience or suggestions" },
]

export const relationshipOptions = [
  "Self",
  "Parent",
  "Child",
  "Spouse",
  "Sibling",
  "Guardian",
  "Caregiver",
  "Other",
]

// Generate a unique issue ID
export function generateIssueId(): string {
  const prefix = "ISS"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function getStatusColor(status: Issue["status"]): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "in-progress":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "resolved":
      return "bg-green-100 text-green-800 border-green-200"
    case "closed":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export function getStatusLabel(status: Issue["status"]): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "in-progress":
      return "In Progress"
    case "resolved":
      return "Resolved"
    case "closed":
      return "Closed"
    default:
      return status
  }
}
