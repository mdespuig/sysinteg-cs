export type ConversationParticipantRole = "standard" | "staff" | "admin"

export interface ConversationMessage {
  _id?: string
  inquiryId: string
  conversationId: string
  senderId: string
  senderName: string
  senderRole: ConversationParticipantRole
  content: string
  createdAt: Date
}

export interface AssignedStaffInfo {
  id?: string | null
  name: string
  email?: string | null
  contactNumber?: string | null
  profileImage?: string | null
  statusText: string
  isOnline?: boolean
  lastSeenAt?: string | null
}

export const CONVERSATION_SOCKET_PATH = "/api/v1/conversations/socket"
