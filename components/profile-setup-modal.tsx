"use client"

import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Check, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AnimatedError } from "@/components/ui/animated-error"

type PersonalData = {
  firstName: string
  lastName: string
  gender: string
  birthdate: string
  contactNumber: string
  address: string
}

type EmergencyContact = {
  firstName: string
  lastName: string
  contactNumber: string
  address: string
}

type SetupData = {
  profileImage: string | null
  personalData: PersonalData
  emergencyContact: EmergencyContact
}

type SetupStepId = "personal" | "emergency" | "avatar" | "review"

const PHONE_PREFIX = "+639"
const PHONE_DIGIT_LIMIT = 9
const PHONE_PREFIX_DIGITS = PHONE_PREFIX.replace(/\D/g, "")

const defaultSetupData: SetupData = {
  profileImage: null,
  personalData: {
    firstName: "",
    lastName: "",
    gender: "",
    birthdate: "",
    contactNumber: "",
    address: "",
  },
  emergencyContact: {
    firstName: "",
    lastName: "",
    contactNumber: "",
    address: "",
  },
}

const extractPhoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, "")

  if (
    digits.startsWith(PHONE_PREFIX_DIGITS) &&
    digits.length === PHONE_PREFIX_DIGITS.length + PHONE_DIGIT_LIMIT
  ) {
    return digits.slice(PHONE_PREFIX_DIGITS.length, PHONE_PREFIX_DIGITS.length + PHONE_DIGIT_LIMIT)
  }

  if (digits.startsWith("09") && digits.length === 11) {
    return digits.slice(2, 2 + PHONE_DIGIT_LIMIT)
  }

  return digits.slice(0, PHONE_DIGIT_LIMIT)
}

const isCompletePhoneDigits = (value: string) => /^\d{9}$/.test(value)

const toCapitalizedName = (value: string) =>
  value
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ")

const normalizeProfile = (profile: any): SetupData => ({
  profileImage: profile?.profileImage ?? null,
  personalData: {
    firstName: profile?.personalData?.firstName ?? "",
    lastName: profile?.personalData?.lastName ?? "",
    gender: profile?.personalData?.gender ?? "",
    birthdate: profile?.personalData?.birthdate ?? "",
    contactNumber: extractPhoneDigits(profile?.personalData?.contactNumber ?? ""),
    address: profile?.personalData?.address ?? "",
  },
  emergencyContact: {
    firstName: profile?.emergencyContact?.firstName ?? "",
    lastName: profile?.emergencyContact?.lastName ?? "",
    contactNumber: extractPhoneDigits(profile?.emergencyContact?.contactNumber ?? ""),
    address: profile?.emergencyContact?.address ?? "",
  },
})

const hasCompletePersonalData = (data: SetupData) =>
  Boolean(
    data.personalData.firstName.trim() &&
      data.personalData.lastName.trim() &&
      data.personalData.gender.trim() &&
      data.personalData.birthdate &&
      isCompletePhoneDigits(data.personalData.contactNumber) &&
      data.personalData.address.trim()
  )

const hasCompleteEmergencyContact = (data: SetupData) =>
  Boolean(
    data.emergencyContact.firstName.trim() &&
      data.emergencyContact.lastName.trim() &&
      isCompletePhoneDigits(data.emergencyContact.contactNumber) &&
      data.emergencyContact.address.trim()
  )

const setupSteps = [
  { id: "personal" as const, label: "Personal Information" },
  { id: "emergency" as const, label: "Emergency Contact" },
  { id: "avatar" as const, label: "Profile Avatar" },
  { id: "review" as const, label: "Review" },
]

function ProfileSetupStepIndicator({
  steps,
  activeStep,
  onStepClick,
  canAccessStep,
  isStepCompleted,
}: {
  steps: Array<{ id: SetupStepId; label: string }>
  activeStep: number
  onStepClick: (index: number) => void
  canAccessStep: (stepId: SetupStepId, index: number) => boolean
  isStepCompleted: (stepId: SetupStepId) => boolean
}) {
  return (
    <div className={`grid gap-2 ${steps.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
      {steps.map((step, index) => {
        const completed = isStepCompleted(step.id)
        const active = index === activeStep
        const canNavigate = canAccessStep(step.id, index)
        const isAvailable = canNavigate || active || completed

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => canNavigate && onStepClick(index)}
            disabled={!canNavigate}
            className={`flex items-center gap-2 rounded-md px-1 py-1 text-left transition-all ${
              canNavigate ? "cursor-pointer hover:bg-[#006AEE]/10" : "cursor-default"
            }`}
            aria-label={`Go to ${step.label}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                completed
                  ? "bg-[#006AEE]/10 text-[#006AEE]"
                  : active
                    ? "bg-[#006AEE] text-white"
                    : isAvailable
                      ? "bg-[#006AEE]/10 text-[#006AEE]"
                      : "bg-slate-100 text-slate-400"
              } transition-all duration-300 ${active ? "scale-110 shadow-[0_0_0_4px_rgba(0,106,238,0.15)]" : "scale-100"}`}
            >
              {completed ? (
                <Check className="h-4 w-4 transition-transform duration-300 ease-out animate-in zoom-in-50" />
              ) : active ? (
                index + 1
              ) : (
                <span
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    isAvailable ? "bg-[#006AEE]" : "bg-slate-400"
                  }`}
                />
              )}
            </span>
            <span
              className={`truncate text-xs transition-colors ${
                isAvailable ? "font-semibold text-slate-950" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ProfileSetupModal() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role
  const userId = (session?.user as any)?.id as string | undefined
  const isStandard = role === "standard"
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(true)
  const [activeStep, setActiveStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward")
  const [imageError, setImageError] = useState("")
  const [setupData, setSetupData] = useState<SetupData>(defaultSetupData)
  const [errors, setErrors] = useState<{
    personalData: Partial<Record<keyof PersonalData, string>>
    emergencyContact: Partial<Record<keyof EmergencyContact, string>>
  }>({
    personalData: {},
    emergencyContact: {},
  })

  const steps = setupSteps
  const activeStepId = steps[activeStep]?.id || "personal"
  const avatarFallback = session?.user?.name?.charAt(0).toUpperCase() || "U"
  const showModalForRole = isStandard

  useEffect(() => {
    const closeForLogout = () => {
      setOpen(false)
      setChecking(false)
      setSaving(false)
      setSetupData(defaultSetupData)
      setErrors({ personalData: {}, emergencyContact: {} })
    }

    window.addEventListener("auth-logout-started", closeForLogout)
    return () => window.removeEventListener("auth-logout-started", closeForLogout)
  }, [])

  useEffect(() => {
    if (status !== "authenticated" || !showModalForRole || pathname === "/profile") {
      setChecking(false)
      setOpen(false)
      return
    }

    let isActive = true
    const controller = new AbortController()

    const loadProfile = async () => {
      setChecking(true)
      try {
        const response = await fetch("/api/v1/profile", {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!isActive) return

        const payload = await response.json()
        const nextData = normalizeProfile(payload.data)
        const needsSetup = !hasCompletePersonalData(nextData) || !hasCompleteEmergencyContact(nextData)

        setSetupData(nextData)
        setOpen(needsSetup)
        window.dispatchEvent(
          new CustomEvent("profile-setup-status", {
            detail: {
              userId,
              requiresSetup: needsSetup,
            },
          })
        )
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to check profile setup:", error)
          window.dispatchEvent(
            new CustomEvent("profile-setup-status", {
              detail: {
                userId,
                checkingFailed: true,
              },
            })
          )
        }
      } finally {
        if (isActive) setChecking(false)
      }
    }

    void loadProfile()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [isStandard, pathname, showModalForRole, status])

  const updatePersonalData = (field: keyof PersonalData, value: string) => {
    const nextValue = field === "firstName" || field === "lastName" ? toCapitalizedName(value) : value
    setSetupData((current) => ({
      ...current,
      personalData: { ...current.personalData, [field]: nextValue },
    }))
    setErrors((current) => ({
      ...current,
      personalData: { ...current.personalData, [field]: undefined },
    }))
  }

  const updateEmergencyContact = (field: keyof EmergencyContact, value: string) => {
    const nextValue = field === "firstName" || field === "lastName" ? toCapitalizedName(value) : value
    setSetupData((current) => ({
      ...current,
      emergencyContact: { ...current.emergencyContact, [field]: nextValue },
    }))
    setErrors((current) => ({
      ...current,
      emergencyContact: { ...current.emergencyContact, [field]: undefined },
    }))
  }

  const updatePhoneNumber = (section: "personalData" | "emergencyContact", value: string) => {
    const nextValue = extractPhoneDigits(value)
    setSetupData((current) => ({
      ...current,
      [section]: { ...current[section], contactNumber: nextValue },
    }))
    setErrors((current) => ({
      ...current,
      [section]: { ...current[section], contactNumber: undefined },
    }))
  }

  const validatePersonal = () => {
    const nextErrors: Partial<Record<keyof PersonalData, string>> = {}
    if (!setupData.personalData.firstName.trim()) nextErrors.firstName = "First name is required"
    if (!setupData.personalData.lastName.trim()) nextErrors.lastName = "Last name is required"
    if (!setupData.personalData.gender.trim()) nextErrors.gender = "Gender is required"
    if (!setupData.personalData.birthdate) nextErrors.birthdate = "Birthdate is required"
    if (!setupData.personalData.contactNumber.trim()) {
      nextErrors.contactNumber = "Contact number is required"
    } else if (!isCompletePhoneDigits(setupData.personalData.contactNumber)) {
      nextErrors.contactNumber = "Contact number must contain exactly 9 digits after +639"
    }
    if (!setupData.personalData.address.trim()) nextErrors.address = "Address is required"

    setErrors((current) => ({ ...current, personalData: nextErrors }))
    return Object.keys(nextErrors).length === 0
  }

  const validateEmergency = () => {
    const nextErrors: Partial<Record<keyof EmergencyContact, string>> = {}
    if (!setupData.emergencyContact.firstName.trim()) nextErrors.firstName = "First name is required"
    if (!setupData.emergencyContact.lastName.trim()) nextErrors.lastName = "Last name is required"
    if (!setupData.emergencyContact.contactNumber.trim()) {
      nextErrors.contactNumber = "Contact number is required"
    } else if (!isCompletePhoneDigits(setupData.emergencyContact.contactNumber)) {
      nextErrors.contactNumber = "Contact number must contain exactly 9 digits after +639"
    } else if (setupData.emergencyContact.contactNumber === setupData.personalData.contactNumber) {
      nextErrors.contactNumber = "Emergency contact must be different"
    }
    if (!setupData.emergencyContact.address.trim()) nextErrors.address = "Address is required"

    setErrors((current) => ({ ...current, emergencyContact: nextErrors }))
    return Object.keys(nextErrors).length === 0
  }

  const validateCurrentStep = () => {
    if (activeStepId === "personal") return validatePersonal()
    if (activeStepId === "emergency") return validateEmergency()
    return true
  }

  const canAccessStep = (stepId: SetupStepId, index: number) => {
    if (index === activeStep) return true
    if (stepId === "personal") return true
    if (stepId === "emergency") return hasCompletePersonalData(setupData)
    if (stepId === "avatar") {
      return hasCompletePersonalData(setupData) && hasCompleteEmergencyContact(setupData)
    }
    if (stepId === "review") {
      return hasCompletePersonalData(setupData) && hasCompleteEmergencyContact(setupData)
    }
    return false
  }

  const isStepCompleted = (stepId: SetupStepId) => {
    if (stepId === "personal") return hasCompletePersonalData(setupData)
    if (stepId === "emergency") return hasCompleteEmergencyContact(setupData)
    if (stepId === "avatar") return Boolean(setupData.profileImage)
    if (stepId === "review") {
      return hasCompletePersonalData(setupData) && hasCompleteEmergencyContact(setupData)
    }
    return false
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    setTransitionDirection("forward")
    setActiveStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const goBack = () => {
    setTransitionDirection("backward")
    setActiveStep((current) => Math.max(current - 1, 0))
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setImageError("")
    if (!file) return

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setImageError("Only JPG and PNG files are allowed")
      return
    }

    if (file.size >= 5 * 1024 * 1024) {
      setImageError("Image size must be less than 5MB")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setSetupData((current) => ({ ...current, profileImage: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const finalizeProfile = async () => {
    if (!validatePersonal()) {
      setActiveStep(0)
      return
    }

    if (isStandard && !validateEmergency()) {
      setActiveStep(1)
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        profileImage: setupData.profileImage,
        personalData: {
          ...setupData.personalData,
          contactNumber: `${PHONE_PREFIX}${setupData.personalData.contactNumber}`,
        },
      }

      payload.emergencyContact = {
        ...setupData.emergencyContact,
        contactNumber: `${PHONE_PREFIX}${setupData.emergencyContact.contactNumber}`,
      }

      const response = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to finalize profile")

      const nextImage = data.data?.profileImage ?? null
      if (userId) {
        window.localStorage.setItem(`profile-avatar:${userId}`, nextImage ?? "")
        window.dispatchEvent(
          new CustomEvent("profile-avatar-updated", {
            detail: {
              userId,
              profileImage: nextImage,
              firstName: setupData.personalData.firstName,
              lastName: setupData.personalData.lastName,
            },
          })
        )
      }
      window.dispatchEvent(new CustomEvent("profile-setup-complete"))
      setOpen(false)
      toast.success("Profile setup finalized")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to finalize profile")
    } finally {
      setSaving(false)
    }
  }

  if (checking || !showModalForRole || pathname === "/profile") return null

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        overlayClassName="bg-black/65 backdrop-blur-sm"
        className="max-h-[92vh] overflow-y-auto sm:max-w-2xl [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Complete your profile</DialogTitle>
          <DialogDescription>
            Step {activeStep + 1} of {steps.length}. Add the required information before continuing.
          </DialogDescription>
        </DialogHeader>

        <ProfileSetupStepIndicator
          steps={steps}
          activeStep={activeStep}
          canAccessStep={canAccessStep}
          isStepCompleted={isStepCompleted}
          onStepClick={(index) => {
            setTransitionDirection(index > activeStep ? "forward" : "backward")
            setActiveStep(index)
          }}
        />

        <div
          key={activeStepId}
          className={`mt-5 space-y-4 transition-all duration-300 ease-out ${
            transitionDirection === "forward" ? "animate-in slide-in-from-right-3 fade-in-0" : "animate-in slide-in-from-left-3 fade-in-0"
          }`}
        >
          {activeStepId === "personal" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name" error={errors.personalData.firstName}>
                <Input
                  value={setupData.personalData.firstName}
                  onChange={(event) => updatePersonalData("firstName", event.target.value)}
                  placeholder="Enter first name"
                  className={errors.personalData.firstName ? "border-destructive" : ""}
                />
              </Field>
              <Field label="Last Name" error={errors.personalData.lastName}>
                <Input
                  value={setupData.personalData.lastName}
                  onChange={(event) => updatePersonalData("lastName", event.target.value)}
                  placeholder="Enter last name"
                  className={errors.personalData.lastName ? "border-destructive" : ""}
                />
              </Field>
              <Field label="Gender" error={errors.personalData.gender}>
                <Select value={setupData.personalData.gender} onValueChange={(value) => updatePersonalData("gender", value)}>
                  <SelectTrigger className={errors.personalData.gender ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Birthdate" error={errors.personalData.birthdate}>
                <Input
                  type="date"
                  value={setupData.personalData.birthdate}
                  onChange={(event) => updatePersonalData("birthdate", event.target.value)}
                  className={errors.personalData.birthdate ? "border-destructive" : ""}
                />
              </Field>
              <Field label="Contact Number" error={errors.personalData.contactNumber}>
                <PhoneInput
                  value={setupData.personalData.contactNumber}
                  onChange={(value) => updatePhoneNumber("personalData", value)}
                  error={Boolean(errors.personalData.contactNumber)}
                />
              </Field>
              <Field label="Address" error={errors.personalData.address} className="sm:col-span-2">
                <Input
                  value={setupData.personalData.address}
                  onChange={(event) => updatePersonalData("address", event.target.value)}
                  placeholder="Enter complete address"
                  className={errors.personalData.address ? "border-destructive" : ""}
                />
              </Field>
            </div>
          ) : null}

          {activeStepId === "emergency" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name" error={errors.emergencyContact.firstName}>
                <Input
                  value={setupData.emergencyContact.firstName}
                  onChange={(event) => updateEmergencyContact("firstName", event.target.value)}
                  placeholder="Enter first name"
                  className={errors.emergencyContact.firstName ? "border-destructive" : ""}
                />
              </Field>
              <Field label="Last Name" error={errors.emergencyContact.lastName}>
                <Input
                  value={setupData.emergencyContact.lastName}
                  onChange={(event) => updateEmergencyContact("lastName", event.target.value)}
                  placeholder="Enter last name"
                  className={errors.emergencyContact.lastName ? "border-destructive" : ""}
                />
              </Field>
              <Field label="Contact Number" error={errors.emergencyContact.contactNumber} className="sm:col-span-2">
                <PhoneInput
                  value={setupData.emergencyContact.contactNumber}
                  onChange={(value) => updatePhoneNumber("emergencyContact", value)}
                  error={Boolean(errors.emergencyContact.contactNumber)}
                />
              </Field>
              <Field label="Address" error={errors.emergencyContact.address} className="sm:col-span-2">
                <Input
                  value={setupData.emergencyContact.address}
                  onChange={(event) => updateEmergencyContact("address", event.target.value)}
                  placeholder="Enter complete address"
                  className={errors.emergencyContact.address ? "border-destructive" : ""}
                />
              </Field>
            </div>
          ) : null}

          {activeStepId === "avatar" ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/20 p-5 text-center">
              <Avatar className="h-24 w-24 border-4 border-muted">
                {setupData.profileImage ? (
                  <AvatarImage src={setupData.profileImage} alt="Profile avatar preview" className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-[#006AEE] text-2xl font-semibold text-white">{avatarFallback}</AvatarFallback>
                )}
              </Avatar>
              <div>
                <p className="font-medium text-foreground">Profile picture avatar</p>
                <p className="mt-1 text-sm text-muted-foreground">Optional. JPG or PNG, max 5MB.</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" onChange={handleImageChange} className="hidden" />
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {setupData.profileImage ? "Change Avatar" : "Upload Avatar"}
              </Button>
              <AnimatedError
                message={imageError}
                className="text-sm text-destructive"
                wrapperClassName="mt-1"
              />
            </div>
          ) : null}

          {activeStepId === "review" ? (
            <div className="space-y-4">
              <ReviewSection title="Personal Information">
                <ReviewItem label="Name" value={`${setupData.personalData.firstName} ${setupData.personalData.lastName}`} />
                <ReviewItem label="Gender" value={setupData.personalData.gender} />
                <ReviewItem label="Birthdate" value={setupData.personalData.birthdate} />
                <ReviewItem label="Contact" value={`${PHONE_PREFIX}${setupData.personalData.contactNumber}`} />
                <ReviewItem label="Address" value={setupData.personalData.address} />
              </ReviewSection>
              <ReviewSection title="Emergency Contact">
                <ReviewItem label="Name" value={`${setupData.emergencyContact.firstName} ${setupData.emergencyContact.lastName}`} />
                <ReviewItem label="Contact" value={`${PHONE_PREFIX}${setupData.emergencyContact.contactNumber}`} />
                <ReviewItem label="Address" value={setupData.emergencyContact.address} />
              </ReviewSection>
              <ReviewSection title="Profile Avatar">
                <ReviewItem label="Status" value={setupData.profileImage ? "Avatar selected" : "Skipped"} />
              </ReviewSection>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="min-h-10">
            {activeStep > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer animate-in fade-in-0 zoom-in-95 duration-200"
                disabled={saving}
                onClick={goBack}
              >
                Previous
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {activeStepId === "avatar" ? (
              <Button type="button" variant="ghost" className="cursor-pointer" disabled={saving} onClick={goNext}>
                Skip
              </Button>
            ) : null}
            {activeStepId === "review" ? (
              <Button type="button" className="cursor-pointer bg-[#006AEE] text-white hover:bg-[#0054BB]" disabled={saving} onClick={() => void finalizeProfile()}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  "Finalize"
                )}
              </Button>
            ) : (
              <Button type="button" className="cursor-pointer bg-[#006AEE] text-white hover:bg-[#0054BB]" onClick={goNext}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
      <AnimatedError
        message={error}
        className="text-sm text-destructive"
        wrapperClassName="origin-top"
      />
    </div>
  )
}

function PhoneInput({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#006AEE]">
        {PHONE_PREFIX}
      </span>
      <Input
        type="tel"
        inputMode="numeric"
        placeholder="912345678"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={PHONE_DIGIT_LIMIT}
        className={`pl-20 ${error ? "border-destructive" : ""}`}
      />
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="wrap-break-word text-sm font-medium text-foreground">{value || "N/A"}</p>
    </div>
  )
}
