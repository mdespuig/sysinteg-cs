"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  ArrowLeft,
  Send,
  CheckCircle,
  User,
  Phone,
  Mail,
  MapPin,
  Users,
  FileText,
  Clipboard,
  Loader2,
  Copy,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Header } from "@/components/header"
import { inquiryTypes, relationshipOptions, type InquiryType } from "@/lib/inquiry-data"
import { toast } from "sonner"

const PHONE_PREFIX = "+639"
const PHONE_DIGIT_LIMIT = 9

const extractPhoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, "")

  if (digits.startsWith("639") && digits.length >= 12) {
    return digits.slice(3, 12)
  }

  if (digits.startsWith("09") && digits.length >= 11) {
    return digits.slice(2, 11)
  }

  return digits.slice(0, PHONE_DIGIT_LIMIT)
}

interface FormData {
  inquiryType: InquiryType | ""
  patientName: string
  contactNumber: string
  email: string
  address: string
  relationship: string
  details: string
}

export default function RequestInquiryPage() {
  const { data: session, status } = useSession()
  const isMountedRef = useRef(true)
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [generatedId, setGeneratedId] = useState("")
  const [copied, setCopied] = useState(false)
  const [fillInformationFields, setFillInformationFields] = useState(false)
  const [isLoadingProfileInfo, setIsLoadingProfileInfo] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    inquiryType: "",
    patientName: "",
    contactNumber: "",
    email: "",
    address: "",
    relationship: "",
    details: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const handleContactNumberChange = (rawValue: string) => {
    if (rawValue && !/^\d+$/.test(rawValue)) {
      toast.error("Contact number can only contain numerical characters")
      return
    }

    if (rawValue.length > PHONE_DIGIT_LIMIT) {
      toast.error("Contact number can only contain 9 digits after +639")
      return
    }

    updateField("contactNumber", rawValue)
  }

  const handleContactNumberBlur = () => {
    if (!formData.contactNumber) return

    if (formData.contactNumber.length !== PHONE_DIGIT_LIMIT) {
      const message = "Contact number must contain exactly 9 digits after +639"
      setErrors((prev) => ({ ...prev, contactNumber: message }))
      toast.error(message)
      return
    }

    if (errors.contactNumber) {
      setErrors((prev) => ({ ...prev, contactNumber: undefined }))
    }
  }

  const clearAutoFilledFields = () => {
    setFormData((prev) => ({
      ...prev,
      contactNumber: "",
      email: "",
      address: "",
    }))
    setErrors((prev) => ({
      ...prev,
      contactNumber: undefined,
      email: undefined,
      address: undefined,
    }))
  }

  const handleFillInformationFieldsChange = async (checked: boolean | "indeterminate") => {
    if (checked !== true) {
      setFillInformationFields(false)
      clearAutoFilledFields()
      return
    }

    if (status !== "authenticated" || !session?.user?.id) {
      toast.error("Sign in to fill information fields")
      return
    }

    setFillInformationFields(true)
    setIsLoadingProfileInfo(true)

    try {
      const response = await fetch(`/api/v1/profile?userId=${session.user.id}`)
      const data = await response.json().catch(() => ({}))

      if (!isMountedRef.current) return

      const contactNumber =
        typeof data?.data?.personalData?.contactNumber === "string"
          ? data.data.personalData.contactNumber.trim()
          : ""
      const email =
        typeof data?.data?.email === "string"
          ? data.data.email.trim()
          : ""
      const address =
        typeof data?.data?.personalData?.address === "string"
          ? data.data.personalData.address.trim()
          : ""

      if (!response.ok || !contactNumber || !email || !address) {
        toast.error("Complete your profile contact information first")
        setFillInformationFields(false)
        clearAutoFilledFields()
        return
      }

      setFormData((prev) => ({
        ...prev,
        contactNumber: extractPhoneDigits(contactNumber),
        email,
        address,
      }))
      setErrors((prev) => ({
        ...prev,
        contactNumber: undefined,
        email: undefined,
        address: undefined,
      }))
      setFillInformationFields(true)
    } catch (error) {
      if (!isMountedRef.current) return
      console.error("Failed to load profile information:", error)
      toast.error("Failed to load profile information")
      setFillInformationFields(false)
      clearAutoFilledFields()
    } finally {
      if (isMountedRef.current) {
        setIsLoadingProfileInfo(false)
      }
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.inquiryType) {
      newErrors.inquiryType = "Please select an issue type"
    }
    if (!formData.patientName.trim()) {
      newErrors.patientName = "Patient name is required"
    }
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = "Contact number is required"
    } else if (!/^\d{9}$/.test(formData.contactNumber)) {
      newErrors.contactNumber = "Contact number must contain exactly 9 digits after +639"
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    if (!formData.address.trim()) {
      newErrors.address = "Address is required"
    }
    if (!formData.relationship) {
      newErrors.relationship = "Please select your relationship to the patient"
    }
    if (!formData.details.trim()) {
      newErrors.details = "Please provide details about your inquiry"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsSubmitting(true)
    setErrors({})
    
    try {
      const response = await fetch("/api/v1/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })
      
      const data = await response.json()

      if (!isMountedRef.current) return

      if (!response.ok) {
        setErrors({ details: data.error || "Failed to submit inquiry" })
        return
      }

      if (data.inquiryId) {
        setGeneratedId(data.inquiryId)
        setIsSubmitted(true)
      } else {
        setErrors({ details: "No inquiry ID returned from server" })
      }
    } catch (error) {
      if (!isMountedRef.current) return
      console.error("Error submitting inquiry:", error)
      setErrors({ details: error instanceof Error ? error.message : "Failed to submit inquiry. Please try again." })
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId)
    setCopied(true)

    if (copyResetTimeoutRef.current) {
      clearTimeout(copyResetTimeoutRef.current)
    }

    copyResetTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const selectedInquiryType = inquiryTypes.find((t) => t.value === formData.inquiryType)

  if (isSubmitted) {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <Header />

        <main className="container mx-auto flex h-[calc(100vh-4rem)] items-center px-4 py-4">
          <Card className="mx-auto max-w-lg border-2 border-online/30">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-online/10">
                <CheckCircle className="h-10 w-10 text-online" />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-foreground">Inquiry Submitted!</h1>
              <p className="mb-6 text-muted-foreground">
                Your inquiry has been successfully submitted. Please save your inquiry ID for future reference.
              </p>
              
              <div className="mb-6 rounded-lg border-2 border-dashed bg-muted/50 p-4">
                <p className="mb-2 text-sm text-muted-foreground">Your Inquiry ID</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-xl font-bold tracking-wider text-primary">{generatedId}</code>
                  <Button variant="ghost" size="sm" className="cursor-pointer" onClick={handleCopyId}>
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-online" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="mb-8 text-sm text-muted-foreground">
                You can use this ID to track the status of your inquiry. Our team will respond within 24-48 hours.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/support/view">
                    <Clipboard className="mr-2 h-4 w-4" />
                    View Inquiries
                  </Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href="/support">
                    Back to Support
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Header />

      <main className="container mx-auto flex h-[calc(100vh-4rem)] flex-col overflow-hidden px-4 py-4">
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
          <div className="shrink-0 bg-background pb-4">
          <div className="mb-3 flex justify-start">
            <Button variant="ghost" asChild className="px-0">
              <Link href="/support">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Support
              </Link>
            </Button>
          </div>

          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Submit an Inquiry
            </h1>
            <p className="text-muted-foreground">
              Fill out the form below and our team will get back to you within 24-48 hours.
            </p>
          </div>
          </div>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <Clipboard className="h-5 w-5 text-primary" />
                Inquiry Form
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto pr-3">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="inquiry-type" className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Type of Inquiry
                  </Label>
                  <Select
                    value={formData.inquiryType}
                    onValueChange={(value) => updateField("inquiryType", value)}
                  >
                    <SelectTrigger id="inquiry-type" className={errors.inquiryType ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select inquiry type" />
                    </SelectTrigger>
                    <SelectContent>
                      {inquiryTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col items-start">
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedInquiryType && (
                    <p className="text-sm text-muted-foreground">{selectedInquiryType.description}</p>
                  )}
                  {errors.inquiryType && (
                    <p className="text-sm text-destructive">{errors.inquiryType}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patient-name" className="flex items-center gap-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Name of Patient
                  </Label>
                  <Input
                    id="patient-name"
                    placeholder="Enter patient's full name"
                    value={formData.patientName}
                    onChange={(e) => updateField("patientName", e.target.value)}
                    className={errors.patientName ? "border-destructive" : ""}
                  />
                  {errors.patientName && (
                    <p className="text-sm text-destructive">{errors.patientName}</p>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="fill-information-fields"
                      checked={fillInformationFields}
                      onCheckedChange={handleFillInformationFieldsChange}
                      disabled={isLoadingProfileInfo || status === "loading"}
                      className="mt-1 h-4 w-4 cursor-pointer rounded border-blue-300 shadow-none transition-transform duration-200 ease-out data-[state=checked]:scale-110 data-[state=checked]:border-[#006AEE] data-[state=checked]:bg-[#006AEE] data-[state=checked]:text-white"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="fill-information-fields"
                          className="cursor-pointer font-medium"
                        >
                          Fill information fields
                        </Label>
                        {isLoadingProfileInfo && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Automatically use your saved contact number, email address, and address from your profile.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-number" className="flex items-center gap-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Contact Number
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#006AEE]">
                        {PHONE_PREFIX}
                      </span>
                      <Input
                        id="contact-number"
                        type="tel"
                        inputMode="numeric"
                        placeholder="912345678"
                        value={formData.contactNumber}
                        onChange={(e) => handleContactNumberChange(e.target.value)}
                        onBlur={handleContactNumberBlur}
                        minLength={PHONE_DIGIT_LIMIT}
                        maxLength={PHONE_DIGIT_LIMIT}
                        pattern="[0-9]{9}"
                        disabled={fillInformationFields || isLoadingProfileInfo}
                        className={`pl-20 ${errors.contactNumber ? "border-destructive" : ""}`}
                      />
                    </div>
                    {errors.contactNumber && (
                      <p className="text-sm text-destructive">{errors.contactNumber}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="example@email.com"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      disabled={fillInformationFields || isLoadingProfileInfo}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    placeholder="Enter complete address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    disabled={fillInformationFields || isLoadingProfileInfo}
                    className={errors.address ? "border-destructive" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive">{errors.address}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationship" className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Relationship to Patient
                  </Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) => updateField("relationship", value)}
                  >
                    <SelectTrigger id="relationship" className={errors.relationship ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.relationship && (
                    <p className="text-sm text-destructive">{errors.relationship}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details" className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Details
                  </Label>
                  <Textarea
                    id="details"
                    placeholder="Please provide detailed information about your inquiry..."
                    rows={5}
                    value={formData.details}
                    onChange={(e) => updateField("details", e.target.value)}
                    className={errors.details ? "border-destructive" : ""}
                  />
                  {errors.details && (
                    <p className="text-sm text-destructive">{errors.details}</p>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/support">Cancel</Link>
                  </Button>
                  <Button type="submit" className="flex-1 cursor-pointer" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Inquiry
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
