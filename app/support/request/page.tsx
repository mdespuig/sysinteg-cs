"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  HeartPulse,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { inquiryTypes, relationshipOptions, type InquiryType } from "@/lib/inquiry-data"

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
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [generatedId, setGeneratedId] = useState("")
  const [copied, setCopied] = useState(false)
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

      if (!response.ok) {
        setErrors({ details: data.error || "Failed to submit inquiry" })
        setIsSubmitting(false)
        return
      }

      if (data.inquiryId) {
        setGeneratedId(data.inquiryId)
        setIsSubmitted(true)
      } else {
        setErrors({ details: "No inquiry ID returned from server" })
      }
    } catch (error) {
      console.error("Error submitting inquiry:", error)
      setErrors({ details: error instanceof Error ? error.message : "Failed to submit inquiry. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const selectedInquiryType = inquiryTypes.find((t) => t.value === formData.inquiryType)

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <HeartPulse className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">MediCare Health</span>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 md:py-20">
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
                  <Button variant="ghost" size="sm" onClick={handleCopyId}>
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
                  <Link href="/">
                    Back to Home
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <HeartPulse className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">MediCare Health</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href="/support">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Support
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Submit an Inquiry
            </h1>
            <p className="text-muted-foreground">
              Fill out the form below and our team will get back to you within 24-48 hours.
            </p>
          </div>

          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clipboard className="h-5 w-5 text-primary" />
                Inquiry Form
              </CardTitle>
              <CardDescription>
                All fields marked with * are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Inquiry Type */}
                <div className="space-y-2">
                  <Label htmlFor="inquiry-type" className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Type of Inquiry *
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

                {/* Patient Name */}
                <div className="space-y-2">
                  <Label htmlFor="patient-name" className="flex items-center gap-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Name of Patient *
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

                {/* Contact Number & Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-number" className="flex items-center gap-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Contact Number *
                    </Label>
                    <Input
                      id="contact-number"
                      type="tel"
                      placeholder="+63 9XX XXX XXXX"
                      value={formData.contactNumber}
                      onChange={(e) => updateField("contactNumber", e.target.value)}
                      className={errors.contactNumber ? "border-destructive" : ""}
                    />
                    {errors.contactNumber && (
                      <p className="text-sm text-destructive">{errors.contactNumber}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="example@email.com"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Address *
                  </Label>
                  <Input
                    id="address"
                    placeholder="Enter complete address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className={errors.address ? "border-destructive" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive">{errors.address}</p>
                  )}
                </div>

                {/* Relationship to Patient */}
                <div className="space-y-2">
                  <Label htmlFor="relationship" className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Relationship to Patient *
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

                {/* Details */}
                <div className="space-y-2">
                  <Label htmlFor="details" className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Details *
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

                {/* Submit Button */}
                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/support">Cancel</Link>
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
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
