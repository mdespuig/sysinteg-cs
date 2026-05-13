"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertCircle,
  Camera,
  ChevronLeft,
  Loader2,
  Save,
  Upload,
  User,
} from "lucide-react"
import { Header } from "@/components/header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { AnimatedError } from "@/components/ui/animated-error"

interface PersonalData {
  firstName: string
  lastName: string
  gender: string
  birthdate: string
  contactNumber: string
  email: string
  address: string
}

interface EmergencyContact {
  firstName: string
  lastName: string
  contactNumber: string
  address: string
}

interface ProfileData {
  profileImage: string | null
  personalData: PersonalData
  emergencyContact: EmergencyContact
}

type ProfileResponse = Partial<ProfileData> & {
  email?: string | null
}

type AdminProfileData = {
  email: string
}

const PHONE_PREFIX = "+639"
const PHONE_DIGIT_LIMIT = 9
const PHONE_PREFIX_DIGITS = PHONE_PREFIX.replace(/\D/g, "")
const DUPLICATE_CONTACT_ERROR = "Personal and emergency contact numbers must be different"

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
const toCapitalizedName = (value: string) => {
  if (!value) return ""
  return value
    .split(" ")
    .map((part) =>
      part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part
    )
    .join(" ")
}

const createDefaultAvatarDataUrl = (label: string) => {
  const initial = (label.trim().charAt(0).toUpperCase() || "U").replace(/&/g, "&amp;")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
      <circle cx="128" cy="128" r="128" fill="#006AEE" />
      <text
        x="128"
        y="158"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="112"
        font-weight="700"
        fill="#FFFFFF"
      >${initial}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const normalizeProfileData = (profile?: ProfileResponse | null): ProfileData => ({
  profileImage: profile?.profileImage ?? null,
  personalData: {
    firstName: profile?.personalData?.firstName ?? "",
    lastName: profile?.personalData?.lastName ?? "",
    gender: profile?.personalData?.gender ?? "",
    birthdate: profile?.personalData?.birthdate ?? "",
    contactNumber: extractPhoneDigits(profile?.personalData?.contactNumber ?? ""),
    email: profile?.email ?? profile?.personalData?.email ?? "",
    address: profile?.personalData?.address ?? "",
  },
  emergencyContact: {
    firstName: profile?.emergencyContact?.firstName ?? "",
    lastName: profile?.emergencyContact?.lastName ?? "",
    contactNumber: extractPhoneDigits(profile?.emergencyContact?.contactNumber ?? ""),
    address: profile?.emergencyContact?.address ?? "",
  },
})

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = (session?.user as any)?.role
  const isPrivilegedUser = role === "admin" || role === "staff"
  const isAdmin = role === "admin"
  const isStaff = role === "staff"
  const showEmergencyContact = !isAdmin && !isStaff
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [imageError, setImageError] = useState("")
  const [useDefaultAvatarPreview, setUseDefaultAvatarPreview] = useState(false)
  const [adminProfileData, setAdminProfileData] = useState<AdminProfileData>({
    email: "",
  })
  const [adminEmailError, setAdminEmailError] = useState("")

  const [profileData, setProfileData] = useState<ProfileData>({
    profileImage: null,
    personalData: {
      firstName: "",
      lastName: "",
      gender: "",
      birthdate: "",
      contactNumber: "",
      email: "",
      address: "",
    },
    emergencyContact: {
      firstName: "",
      lastName: "",
      contactNumber: "",
      address: "",
    },
  })

  useEffect(() => {
    if (!session?.user?.id) return

    const cacheKey = `profile-avatar:${session.user.id}`
    const cachedImage = window.localStorage.getItem(cacheKey)
    if (cachedImage !== null) {
      setProfileData((prev) => ({
        ...prev,
        profileImage: cachedImage || null,
      }))
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!isAdmin) return
    setAdminProfileData((prev) => ({
      ...prev,
      email: session?.user?.email || "",
    }))
  }, [isAdmin, session?.user?.email])

  const [errors, setErrors] = useState<{
    personalData: Partial<Record<keyof PersonalData, string>>
    emergencyContact: Partial<Record<keyof EmergencyContact, string>>
  }>({
    personalData: {},
    emergencyContact: {},
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login")
      return
    }

    let isActive = true
    const controller = new AbortController()

    const loadProfile = async () => {
      if (!session?.user?.id) return

      try {
        const response = await fetch("/api/v1/profile", {
          signal: controller.signal,
        })
        if (!isActive) return
        const data = await response.json()
        if (response.ok && data.data) {
          setUseDefaultAvatarPreview(false)
          const nextImage = data.data.profileImage ?? null
          window.localStorage.setItem(`profile-avatar:${session.user.id}`, nextImage ?? "")
          window.dispatchEvent(
            new CustomEvent("profile-avatar-updated", {
              detail: { userId: session.user.id, profileImage: nextImage },
            })
          )
          setProfileData(normalizeProfileData({ ...data.data, profileImage: nextImage }))
          if (isAdmin) {
            setAdminProfileData({
              email: data.data.email ?? data.data.personalData?.email ?? "",
            })
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        console.error("Failed to load profile:", error)
      }
    }

    loadProfile()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [session?.user?.id, status, router])

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setImageError("")

    if (!file) return

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"]
    if (!allowedTypes.includes(file.type)) {
      setImageError("Only JPG and PNG files are allowed")
      return
    }

    if (file.size >= 5 * 1024 * 1024) {
      setImageError("Image size must be less than 5MB")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setUseDefaultAvatarPreview(false)
      const nextImage = reader.result as string
      setProfileData((prev) => ({
        ...prev,
        profileImage: nextImage,
      }))
    }
    reader.readAsDataURL(file)
  }

  const restoreDefaultPhoto = () => {
    setProfileData((prev) => ({ ...prev, profileImage: null }))
    setUseDefaultAvatarPreview(true)
    setImageError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const updateAdminEmail = (value: string) => {
    setAdminProfileData((prev) => ({ ...prev, email: value }))
    if (adminEmailError) {
      setAdminEmailError("")
    }
  }

  const handleAdminEmailSave = async () => {
    if (!isAdmin) return
    if (!validateForm()) return

    setIsSaving(true)

    try {
      const response = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileImage: profileData.profileImage,
          personalData: {
            email: adminProfileData.email.trim(),
          },
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save profile")

      if (data.data) {
        setAdminProfileData((prev) => ({
          ...prev,
          email: data.data?.email ?? data.data?.personalData?.email ?? prev.email,
        }))
      }
      toast.success("Profile saved successfully!")
    } catch (error) {
      console.error("Profile save failed:", error)
      toast.error("Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  const updatePersonalData = (field: keyof PersonalData, value: string) => {
    const nextValue =
      field === "firstName" || field === "lastName" ? toCapitalizedName(value) : value
    setProfileData((prev) => ({
      ...prev,
      personalData: { ...prev.personalData, [field]: nextValue },
    }))
    if (errors.personalData[field]) {
      setErrors((prev) => ({
        ...prev,
        personalData: { ...prev.personalData, [field]: undefined },
      }))
    }
  }

  const updateEmergencyContact = (field: keyof EmergencyContact, value: string) => {
    const nextValue =
      field === "firstName" || field === "lastName" ? toCapitalizedName(value) : value
    setProfileData((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: nextValue },
    }))
    if (errors.emergencyContact[field]) {
      setErrors((prev) => ({
        ...prev,
        emergencyContact: { ...prev.emergencyContact, [field]: undefined },
      }))
    }
  }

  const handlePhoneNumberChange = (
    section: "personalData" | "emergencyContact",
    value: string
  ) => {
    const otherSection = section === "personalData" ? "emergencyContact" : "personalData"
    const digitsOnly = value.replace(/\D/g, "")
    const normalizedDigits = extractPhoneDigits(value)
    const otherContactNumber = profileData[otherSection].contactNumber.trim()

    if (value && digitsOnly.length !== value.length) {
      toast.error("Contact number can only contain numerical characters")
    } else if (digitsOnly.length > PHONE_DIGIT_LIMIT) {
      toast.error("Contact number can only contain 9 digits after +639")
    }

    if (
      normalizedDigits.length === PHONE_DIGIT_LIMIT &&
      otherContactNumber.length === PHONE_DIGIT_LIMIT &&
      normalizedDigits === otherContactNumber
    ) {
      toast.error(DUPLICATE_CONTACT_ERROR)
      setErrors((prev) => ({
        ...prev,
        [section]: { ...prev[section], contactNumber: DUPLICATE_CONTACT_ERROR },
        [otherSection]: { ...prev[otherSection], contactNumber: DUPLICATE_CONTACT_ERROR },
      }))
      return
    }

    setProfileData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        contactNumber: normalizedDigits,
      },
    }))

    setErrors((prev) => {
      const nextErrors = {
        ...prev,
        [section]: { ...prev[section], contactNumber: undefined },
        [otherSection]: { ...prev[otherSection] },
      }

      if (nextErrors[otherSection].contactNumber === DUPLICATE_CONTACT_ERROR) {
        nextErrors[otherSection].contactNumber = undefined
      }

      return nextErrors
    })
  }

  const handlePhoneNumberBlur = (section: "personalData" | "emergencyContact") => {
    const otherSection = section === "personalData" ? "emergencyContact" : "personalData"
    const contactNumber = profileData[section].contactNumber.trim()
    const otherContactNumber = profileData[otherSection].contactNumber.trim()
    if (!contactNumber) return

    if (contactNumber.length !== PHONE_DIGIT_LIMIT) {
      const message = "Contact number must contain exactly 9 digits after +639"
      toast.error(message)
      setErrors((prev) => ({
        ...prev,
        [section]: { ...prev[section], contactNumber: message },
      }))
      return
    }

    if (
      otherContactNumber.length === PHONE_DIGIT_LIMIT &&
      contactNumber === otherContactNumber
    ) {
      toast.error(DUPLICATE_CONTACT_ERROR)
      setErrors((prev) => ({
        ...prev,
        [section]: { ...prev[section], contactNumber: DUPLICATE_CONTACT_ERROR },
        [otherSection]: { ...prev[otherSection], contactNumber: DUPLICATE_CONTACT_ERROR },
      }))
      return
    }

    setErrors((prev) => {
      const nextErrors = {
        ...prev,
        [section]: { ...prev[section], contactNumber: undefined },
        [otherSection]: { ...prev[otherSection] },
      }

      if (nextErrors[otherSection].contactNumber === DUPLICATE_CONTACT_ERROR) {
        nextErrors[otherSection].contactNumber = undefined
      }

      return nextErrors
    })
  }

  const validateForm = () => {
    if (isAdmin) {
      if (!adminProfileData.email.trim()) {
        setAdminEmailError("Email is required")
        return false
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminProfileData.email.trim())) {
        setAdminEmailError("Enter a valid email address")
        return false
      }
      setAdminEmailError("")
      setErrors({
        personalData: {},
        emergencyContact: {},
      })
      return true
    }

    let phoneErrorMessage: string | null = null
    const newErrors = {
      personalData: {} as Partial<Record<keyof PersonalData, string>>,
      emergencyContact: {} as Partial<Record<keyof EmergencyContact, string>>,
    }

    if (!profileData.personalData.firstName.trim()) newErrors.personalData.firstName = "First name is required"
    if (!profileData.personalData.lastName.trim()) newErrors.personalData.lastName = "Last name is required"
    if (!profileData.personalData.gender.trim()) newErrors.personalData.gender = "Gender is required"
    if (!profileData.personalData.birthdate) newErrors.personalData.birthdate = "Birthdate is required"
    if (!profileData.personalData.contactNumber.trim()) {
      newErrors.personalData.contactNumber = "Contact number is required"
    } else if (!isCompletePhoneDigits(profileData.personalData.contactNumber)) {
      newErrors.personalData.contactNumber = "Contact number must contain exactly 9 digits after +639"
      phoneErrorMessage = "Contact number must contain exactly 9 digits after +639"
    }
    if (!profileData.personalData.email.trim()) {
      newErrors.personalData.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.personalData.email.trim())) {
      newErrors.personalData.email = "Enter a valid email address"
    }
    if (!profileData.personalData.address.trim()) newErrors.personalData.address = "Address is required"

    if (showEmergencyContact) {
      if (!profileData.emergencyContact.firstName.trim()) newErrors.emergencyContact.firstName = "First name is required"
      if (!profileData.emergencyContact.lastName.trim()) newErrors.emergencyContact.lastName = "Last name is required"
      if (!profileData.emergencyContact.contactNumber.trim()) {
        newErrors.emergencyContact.contactNumber = "Contact number is required"
      } else if (!isCompletePhoneDigits(profileData.emergencyContact.contactNumber)) {
        newErrors.emergencyContact.contactNumber = "Contact number must contain exactly 9 digits after +639"
        phoneErrorMessage = "Contact number must contain exactly 9 digits after +639"
      }
      if (!profileData.emergencyContact.address.trim()) newErrors.emergencyContact.address = "Address is required"

      if (
        isCompletePhoneDigits(profileData.personalData.contactNumber) &&
        isCompletePhoneDigits(profileData.emergencyContact.contactNumber) &&
        profileData.personalData.contactNumber === profileData.emergencyContact.contactNumber
      ) {
        newErrors.personalData.contactNumber = DUPLICATE_CONTACT_ERROR
        newErrors.emergencyContact.contactNumber = DUPLICATE_CONTACT_ERROR
        phoneErrorMessage = DUPLICATE_CONTACT_ERROR
      }
    }

    setErrors(newErrors)
    if (phoneErrorMessage) {
      toast.error(phoneErrorMessage)
    }
    return Object.keys(newErrors.personalData).length === 0 && Object.keys(newErrors.emergencyContact).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSaving(true)

    try {
      const payload: Record<string, unknown> = {
        profileImage: profileData.profileImage,
        personalData: {
          ...profileData.personalData,
          email: profileData.personalData.email.trim(),
          contactNumber: `${PHONE_PREFIX}${profileData.personalData.contactNumber}`,
        },
      }
      if (showEmergencyContact) {
        payload.emergencyContact = {
          ...profileData.emergencyContact,
          contactNumber: `${PHONE_PREFIX}${profileData.emergencyContact.contactNumber}`,
        }
      }
      if (isAdmin) {
        payload.personalData = {
          email: adminProfileData.email.trim(),
        }
      }

      const response = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save profile")

      if (data.data) setProfileData(normalizeProfileData(data.data))
      if (session?.user?.id) {
        const nextImage = data.data?.profileImage ?? null
        window.localStorage.setItem(`profile-avatar:${session.user.id}`, nextImage ?? "")
        window.dispatchEvent(
          new CustomEvent("profile-avatar-updated", {
            detail: { userId: session.user.id, profileImage: nextImage },
          })
        )
      }
      if (isAdmin) {
        setAdminProfileData((prev) => ({
          ...prev,
          email: data.data?.email ?? data.data?.personalData?.email ?? prev.email,
        }))
      }
      toast.success("Profile saved successfully!")
    } catch (error) {
      console.error("Profile save failed:", error)
      toast.error("Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarSave = async () => {
    if (!session?.user?.id) return

    setIsSavingAvatar(true)

    try {
      const response = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarOnly: true,
          profileImage: profileData.profileImage,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save avatar")

      const nextImage = data.data?.profileImage ?? null
      setUseDefaultAvatarPreview(false)
      setProfileData((prev) => ({ ...prev, profileImage: nextImage }))
      window.localStorage.setItem(`profile-avatar:${session.user.id}`, nextImage ?? "")
      window.dispatchEvent(
        new CustomEvent("profile-avatar-updated", {
          detail: { userId: session.user.id, profileImage: nextImage },
        })
      )
      toast.success("Avatar saved successfully!")
    } catch (error) {
      console.error("Avatar save failed:", error)
      toast.error("Failed to save avatar")
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const getInitials = () => {
    const username = session?.user?.name?.trim() || ""
    return username.charAt(0).toUpperCase() || "U"
  }

  const defaultAvatarSrc = createDefaultAvatarDataUrl(session?.user?.name ?? "U")
  const avatarSrc = useDefaultAvatarPreview ? defaultAvatarSrc : profileData.profileImage

  if (status === "loading") {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <Header />

        <main className="container mx-auto flex h-[calc(100vh-4rem)] flex-col overflow-hidden px-4 py-4">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            <div className="mb-6 mt-6 flex shrink-0 items-center justify-between animate-pulse">
              <div className="h-10 w-10 rounded-lg bg-slate-200/80" />
              <div className="flex flex-1 flex-col items-center gap-3">
                <div className="h-8 w-40 rounded bg-slate-200/80" />
                <div className="h-4 w-72 max-w-full rounded bg-slate-200/70" />
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-200/80" />
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2 pb-4">
              <Card className="mb-6 animate-pulse">
                <CardHeader>
                  <div className="h-6 w-40 rounded bg-slate-200/80" />
                  <div className="h-4 w-80 max-w-full rounded bg-slate-200/70" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="h-28 w-28 rounded-full bg-slate-200/80" />
                    <div className="flex flex-col items-center gap-2 sm:items-start">
                      <div className="h-10 w-44 rounded-md bg-slate-200/70" />
                      <div className="h-10 w-44 rounded-md bg-slate-200/70" />
                      <div className="h-10 w-44 rounded-md bg-slate-200/70" />
                      <div className="h-4 w-28 rounded bg-slate-200/70" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-pulse">
                <CardHeader>
                  <div className="h-6 w-48 rounded bg-slate-200/80" />
                  <div className="h-4 w-72 max-w-full rounded bg-slate-200/70" />
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <div className="h-5 w-40 rounded bg-slate-200/80" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="space-y-2">
                          <div className="h-4 w-24 rounded bg-slate-200/80" />
                          <div className="h-10 w-full rounded-lg bg-slate-200/70" />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-slate-200/80" />
                      <div className="h-10 w-full rounded-lg bg-slate-200/70" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Header />

      <main className="container mx-auto flex h-[calc(100vh-4rem)] flex-col overflow-hidden px-4 py-4">
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <div className="mb-6 mt-6 flex shrink-0 items-center justify-between">
            {isPrivilegedUser ? (
              <Button variant="ghost" asChild className="cursor-pointer">
                <Link href="/dashboard" aria-label="Back">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <span aria-hidden="true" className="w-21" />
            )}
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">My Profile</h1>
              <p className="mt-2 text-muted-foreground">Manage your personal information and emergency contact details.</p>
            </div>
            <span aria-hidden="true" className="w-21" />
          </div>

          <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto pr-2 pb-4">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  Profile Picture
                </CardTitle>
                <CardDescription>Upload a profile photo. Only JPG and PNG files are allowed (max 5MB).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative">
                    <Avatar className="h-28 w-28 border-4 border-muted">
                      {avatarSrc ? (
                        <AvatarImage
                          src={avatarSrc}
                          alt="Profile"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-[#006AEE] text-2xl font-semibold text-white">
                          {getInitials()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                  <div className="flex flex-col items-center gap-2 sm:items-start">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={handleImageChange}
                      className="hidden"
                      aria-label="Upload profile picture"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleImageClick}
                      className="w-44 cursor-pointer border border-input hover:border-[#006AEE] hover:bg-[#006AEE] hover:text-white"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {profileData.profileImage ? "Change Photo" : "Upload Photo"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={restoreDefaultPhoto}
                      disabled={!profileData.profileImage || isSavingAvatar}
                      className="w-44 cursor-pointer border border-input bg-zinc-700 text-white hover:border-[#006AEE] hover:bg-[#006AEE] hover:text-white disabled:opacity-50"
                    >
                      Restore Default
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAvatarSave}
                      disabled={isSavingAvatar || isSaving}
                      className="w-44 cursor-pointer hover:bg-[#006AEE] hover:text-white"
                    >
                      {isSavingAvatar ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Avatar
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG or PNG, max 5MB</p>
                    {imageError && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <AnimatedError message={imageError} className="text-sm text-destructive" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {!isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    {showEmergencyContact
                      ? "Update your personal details and emergency contact information."
                      : "Update your personal details."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
                      Personal Data
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="personal-first-name">First Name</Label>
                        <Input id="personal-first-name" placeholder="Enter first name" value={profileData.personalData.firstName} onChange={(e) => updatePersonalData("firstName", e.target.value)} className={errors.personalData.firstName ? "border-destructive" : ""} />
                        <AnimatedError message={errors.personalData.firstName} className="text-sm text-destructive" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personal-last-name">Last Name</Label>
                        <Input id="personal-last-name" placeholder="Enter last name" value={profileData.personalData.lastName} onChange={(e) => updatePersonalData("lastName", e.target.value)} className={errors.personalData.lastName ? "border-destructive" : ""} />
                        <AnimatedError message={errors.personalData.lastName} className="text-sm text-destructive" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personal-gender">Gender</Label>
                        <Select value={profileData.personalData.gender} onValueChange={(value) => updatePersonalData("gender", value)}>
                          <SelectTrigger
                            id="personal-gender"
                            className={`h-10 w-full rounded-lg border-input bg-background px-3 text-sm shadow-none ${
                              errors.personalData.gender ? "border-destructive" : ""
                            }`}
                          >
                            <SelectValue placeholder="Select gender" className="text-foreground" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                        <AnimatedError message={errors.personalData.gender} className="text-sm text-destructive" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birthdate">Birthdate</Label>
                        <Input id="birthdate" type="date" value={profileData.personalData.birthdate} onChange={(e) => updatePersonalData("birthdate", e.target.value)} className={errors.personalData.birthdate ? "border-destructive" : ""} />
                        <AnimatedError message={errors.personalData.birthdate} className="text-sm text-destructive" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personal-contact">Contact Number</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#006AEE]">
                            {PHONE_PREFIX}
                          </span>
                          <Input
                            id="personal-contact"
                            type="tel"
                            inputMode="numeric"
                            placeholder="912345678"
                            value={profileData.personalData.contactNumber}
                            onChange={(e) => handlePhoneNumberChange("personalData", e.target.value)}
                            onBlur={() => handlePhoneNumberBlur("personalData")}
                            minLength={PHONE_DIGIT_LIMIT}
                            maxLength={PHONE_DIGIT_LIMIT}
                            pattern="[0-9]{9}"
                            className={`pl-20 ${errors.personalData.contactNumber ? "border-destructive" : ""}`}
                          />
                        </div>
                        <AnimatedError message={errors.personalData.contactNumber} className="text-sm text-destructive" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personal-email">Email</Label>
                        <Input
                          id="personal-email"
                          type="email"
                          value={profileData.personalData.email}
                          onChange={(e) => updatePersonalData("email", e.target.value)}
                          className={errors.personalData.email ? "border-destructive" : ""}
                        />
                        <AnimatedError message={errors.personalData.email} className="text-sm text-destructive" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="personal-address">Address</Label>
                      <Input id="personal-address" placeholder="Enter complete address" value={profileData.personalData.address} onChange={(e) => updatePersonalData("address", e.target.value)} className={errors.personalData.address ? "border-destructive" : ""} />
                      <AnimatedError message={errors.personalData.address} className="text-sm text-destructive" />
                    </div>
                  </div>

                  {showEmergencyContact && (
                    <>
                  <Separator />

                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">2</div>
                      Emergency Contact
                    </h3>
                    <p className="text-sm text-muted-foreground">Provide details of a person we can contact in case of emergency.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="emergency-first-name">First Name</Label>
                        <Input id="emergency-first-name" placeholder="Enter first name" value={profileData.emergencyContact.firstName} onChange={(e) => updateEmergencyContact("firstName", e.target.value)} className={errors.emergencyContact.firstName ? "border-destructive" : ""} />
                        <AnimatedError message={errors.emergencyContact.firstName} className="text-sm text-destructive" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency-last-name">Last Name</Label>
                        <Input id="emergency-last-name" placeholder="Enter last name" value={profileData.emergencyContact.lastName} onChange={(e) => updateEmergencyContact("lastName", e.target.value)} className={errors.emergencyContact.lastName ? "border-destructive" : ""} />
                        <AnimatedError message={errors.emergencyContact.lastName} className="text-sm text-destructive" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="emergency-contact">Contact Number</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#006AEE]">
                            {PHONE_PREFIX}
                          </span>
                          <Input
                            id="emergency-contact"
                            type="tel"
                            inputMode="numeric"
                            placeholder="912345678"
                            value={profileData.emergencyContact.contactNumber}
                            onChange={(e) => handlePhoneNumberChange("emergencyContact", e.target.value)}
                            onBlur={() => handlePhoneNumberBlur("emergencyContact")}
                            minLength={PHONE_DIGIT_LIMIT}
                            maxLength={PHONE_DIGIT_LIMIT}
                            pattern="[0-9]{9}"
                            className={`pl-20 ${errors.emergencyContact.contactNumber ? "border-destructive" : ""}`}
                          />
                        </div>
                        <AnimatedError message={errors.emergencyContact.contactNumber} className="text-sm text-destructive" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency-address">Address</Label>
                      <Input
                        id="emergency-address"
                        placeholder="Enter complete address"
                        value={profileData.emergencyContact.address}
                        onChange={(e) => updateEmergencyContact("address", e.target.value)}
                        className={errors.emergencyContact.address ? "border-destructive" : ""}
                      />
                      <AnimatedError message={errors.emergencyContact.address} className="text-sm text-destructive" />
                    </div>
                  </div>
                    </>
                  )}

                  <div className="pt-4">
                    <Button
                      type="submit"
                      className="w-full cursor-pointer hover:bg-[#006AEE] hover:text-white"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Admin Profile
                  </CardTitle>
                  <CardDescription>
                    Update your account email.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={adminProfileData.email}
                      onChange={(e) => updateAdminEmail(e.target.value)}
                      className={adminEmailError ? "border-destructive" : ""}
                    />
                    <AnimatedError message={adminEmailError} className="text-sm text-destructive" />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={() => void handleAdminEmailSave()}
                      disabled={isSaving || isSavingAvatar}
                      className="w-full cursor-pointer hover:bg-[#006AEE] hover:text-white"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </form>

        </div>
      </main>
    </div>
  )
}

