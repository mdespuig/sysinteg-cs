export interface Inquiry {
  id: string
  userId?: string | null
  type: InquiryType
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

export type InquiryType =
  | "appointment"
  | "billing"
  | "medical-records"
  | "prescription"
  | "insurance"
  | "general"
  | "complaint"

export const inquiryTypes: { value: InquiryType; label: string; description: string }[] = [
  { value: "appointment", label: "Appointment Inquiry", description: "Schedule, reschedule, or cancel appointments" },
  { value: "billing", label: "Billing & Payments", description: "Questions about bills, payments, or charges" },
  { value: "medical-records", label: "Medical Records", description: "Request copies or updates to medical records" },
  { value: "prescription", label: "Prescription Refill", description: "Request prescription refills or renewals" },
  { value: "insurance", label: "Insurance & Coverage", description: "Insurance verification and coverage questions" },
  { value: "general", label: "General Inquiry", description: "General questions about services or facilities" },
  { value: "complaint", label: "File a Complaint", description: "Report issues or concerns" },
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

export function generateInquiryId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let randomId = ''
  for (let i = 0; i < 5; i++) {
    randomId += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `INQ-${randomId}`
}

export function getStatusColor(status: Inquiry["status"]): string {
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

export function getStatusLabel(status: Inquiry["status"]): string {
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
