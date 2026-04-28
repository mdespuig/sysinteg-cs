export interface Inquiry {
  id: string
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
  | "feedback"

export const inquiryTypes: { value: InquiryType; label: string; description: string }[] = [
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

// Generate a unique inquiry ID
export function generateInquiryId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let randomId = ''
  for (let i = 0; i < 5; i++) {
    randomId += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `INQ-${randomId}`
}

// Mock inquiries for demo
export const mockInquiries: Inquiry[] = [
  {
    id: "INQ-M5K2X9-AB12",
    type: "appointment",
    patientName: "Maria Santos",
    contactNumber: "+63 917 123 4567",
    email: "maria.santos@email.com",
    address: "123 Rizal Street, Makati City",
    relationship: "Self",
    details: "I would like to schedule a follow-up appointment with Dr. Cruz for my annual check-up. My previous appointment was last March.",
    status: "in-progress",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "INQ-L4J8Y7-CD34",
    type: "billing",
    patientName: "Juan Dela Cruz",
    contactNumber: "+63 918 234 5678",
    email: "juan.delacruz@email.com",
    address: "456 Bonifacio Avenue, Quezon City",
    relationship: "Self",
    details: "I received a bill that seems higher than expected. I would like to request an itemized breakdown of the charges from my recent hospital stay.",
    status: "pending",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "INQ-N3H6W5-EF56",
    type: "medical-records",
    patientName: "Ana Reyes",
    contactNumber: "+63 919 345 6789",
    email: "ana.reyes@email.com",
    address: "789 Mabini Road, Pasig City",
    relationship: "Parent",
    details: "I need to obtain my mother's medical records for her visa application. She was admitted last December for heart surgery.",
    status: "resolved",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "INQ-P2G4V3-GH78",
    type: "prescription",
    patientName: "Pedro Fernandez",
    contactNumber: "+63 920 456 7890",
    email: "pedro.fernandez@email.com",
    address: "321 Luna Street, Manila",
    relationship: "Self",
    details: "I need a refill for my blood pressure medication (Losartan 50mg). My current prescription runs out next week.",
    status: "closed",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
  },
]

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
