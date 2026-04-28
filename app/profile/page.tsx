"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertCircle,
  Camera,
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
import { Separator } from "@/components/ui/separator"

interface PersonalData {
  firstName: string
  lastName: string
  birthdate: string
  contactNumber: string
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

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = (session?.user as any)?.role
  const isPrivilegedUser = role === "admin" || role === "staff"
  const isAdmin = role === "admin"
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [imageError, setImageError] = useState("")
  const [useDefaultAvatarPreview, setUseDefaultAvatarPreview] = useState(false)

  const [profileData, setProfileData] = useState<ProfileData>({
    profileImage: null,
    personalData: {
      firstName: "",
      lastName: "",
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

    const loadProfile = async () => {
      if (!session?.user?.id) return

      try {
        const response = await fetch(`/api/v1/profile?userId=${session.user.id}`)
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
          setProfileData({
            profileImage: nextImage,
            personalData: {
              firstName: data.data.personalData?.firstName ?? "",
              lastName: data.data.personalData?.lastName ?? "",
              birthdate: data.data.personalData?.birthdate ?? "",
              contactNumber: data.data.personalData?.contactNumber ?? "",
              address: data.data.personalData?.address ?? "",
            },
            emergencyContact: {
              firstName: data.data.emergencyContact?.firstName ?? "",
              lastName: data.data.emergencyContact?.lastName ?? "",
              contactNumber: data.data.emergencyContact?.contactNumber ?? "",
              address: data.data.emergencyContact?.address ?? "",
            },
          })
        }
      } catch (error) {
        console.error("Failed to load profile:", error)
      }
    }

    loadProfile()
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
      setProfileData((prev) => ({
        ...prev,
        profileImage: reader.result as string,
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

  const updatePersonalData = (field: keyof PersonalData, value: string) => {
    setProfileData((prev) => ({
      ...prev,
      personalData: { ...prev.personalData, [field]: value },
    }))
    if (errors.personalData[field]) {
      setErrors((prev) => ({
        ...prev,
        personalData: { ...prev.personalData, [field]: undefined },
      }))
    }
  }

  const updateEmergencyContact = (field: keyof EmergencyContact, value: string) => {
    setProfileData((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: value },
    }))
    if (errors.emergencyContact[field]) {
      setErrors((prev) => ({
        ...prev,
        emergencyContact: { ...prev.emergencyContact, [field]: undefined },
      }))
    }
  }

  const validateForm = () => {
    if (isAdmin) {
      setErrors({
        personalData: {},
        emergencyContact: {},
      })
      return true
    }

    const newErrors = {
      personalData: {} as Partial<Record<keyof PersonalData, string>>,
      emergencyContact: {} as Partial<Record<keyof EmergencyContact, string>>,
    }

    if (!profileData.personalData.firstName.trim()) newErrors.personalData.firstName = "First name is required"
    if (!profileData.personalData.lastName.trim()) newErrors.personalData.lastName = "Last name is required"
    if (!profileData.personalData.birthdate) newErrors.personalData.birthdate = "Birthdate is required"
    if (!profileData.personalData.contactNumber.trim()) newErrors.personalData.contactNumber = "Contact number is required"
    if (!profileData.personalData.address.trim()) newErrors.personalData.address = "Address is required"

    if (!profileData.emergencyContact.firstName.trim()) newErrors.emergencyContact.firstName = "First name is required"
    if (!profileData.emergencyContact.lastName.trim()) newErrors.emergencyContact.lastName = "Last name is required"
    if (!profileData.emergencyContact.contactNumber.trim()) newErrors.emergencyContact.contactNumber = "Contact number is required"
    if (!profileData.emergencyContact.address.trim()) newErrors.emergencyContact.address = "Address is required"

    setErrors(newErrors)
    return Object.keys(newErrors.personalData).length === 0 && Object.keys(newErrors.emergencyContact).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSaving(true)

    try {
      const response = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user?.id,
          isAdmin,
          ...profileData,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save profile")

      if (data.data) setProfileData(data.data)
      if (session?.user?.id) {
        const nextImage = data.data?.profileImage ?? null
        window.localStorage.setItem(`profile-avatar:${session.user.id}`, nextImage ?? "")
        window.dispatchEvent(
          new CustomEvent("profile-avatar-updated", {
            detail: { userId: session.user.id, profileImage: nextImage },
          })
        )
      }
      toast.success("Profile saved successfully!")
    } catch (error) {
      console.error("Profile save failed:", error)
      toast.error("Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = () => {
    const username = session?.user?.name?.trim() || ""
    return username.charAt(0).toUpperCase() || "U"
  }

  const defaultAvatarSrc = createDefaultAvatarDataUrl(session?.user?.name ?? "U")
  const avatarSrc = useDefaultAvatarPreview ? defaultAvatarSrc : profileData.profileImage

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-background">Loading...</div>
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">My Profile</h1>
            <p className="text-muted-foreground">Manage your personal information and emergency contact details.</p>
          </div>

          <form onSubmit={handleSubmit}>
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
                      disabled={!profileData.profileImage}
                      className="w-44 cursor-pointer border border-input bg-zinc-700 text-white hover:border-[#006AEE] hover:bg-[#006AEE] hover:text-white disabled:opacity-50"
                    >
                      Restore Default
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG or PNG, max 5MB</p>
                    {imageError && (
                      <p className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {imageError}
                      </p>
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
                  <CardDescription>Update your personal details and emergency contact information.</CardDescription>
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
                        {errors.personalData.firstName && <p className="text-sm text-destructive">{errors.personalData.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personal-last-name">Last Name</Label>
                        <Input id="personal-last-name" placeholder="Enter last name" value={profileData.personalData.lastName} onChange={(e) => updatePersonalData("lastName", e.target.value)} className={errors.personalData.lastName ? "border-destructive" : ""} />
                        {errors.personalData.lastName && <p className="text-sm text-destructive">{errors.personalData.lastName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birthdate">Birthdate</Label>
                        <Input id="birthdate" type="date" value={profileData.personalData.birthdate} onChange={(e) => updatePersonalData("birthdate", e.target.value)} className={errors.personalData.birthdate ? "border-destructive" : ""} />
                        {errors.personalData.birthdate && <p className="text-sm text-destructive">{errors.personalData.birthdate}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personal-contact">Contact Number</Label>
                        <Input id="personal-contact" type="tel" placeholder="+63 9XX XXX XXXX" value={profileData.personalData.contactNumber} onChange={(e) => updatePersonalData("contactNumber", e.target.value)} className={errors.personalData.contactNumber ? "border-destructive" : ""} />
                        {errors.personalData.contactNumber && <p className="text-sm text-destructive">{errors.personalData.contactNumber}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="personal-address">Address</Label>
                      <Input id="personal-address" placeholder="Enter complete address" value={profileData.personalData.address} onChange={(e) => updatePersonalData("address", e.target.value)} className={errors.personalData.address ? "border-destructive" : ""} />
                      {errors.personalData.address && <p className="text-sm text-destructive">{errors.personalData.address}</p>}
                    </div>
                  </div>

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
                        {errors.emergencyContact.firstName && <p className="text-sm text-destructive">{errors.emergencyContact.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency-last-name">Last Name</Label>
                        <Input id="emergency-last-name" placeholder="Enter last name" value={profileData.emergencyContact.lastName} onChange={(e) => updateEmergencyContact("lastName", e.target.value)} className={errors.emergencyContact.lastName ? "border-destructive" : ""} />
                        {errors.emergencyContact.lastName && <p className="text-sm text-destructive">{errors.emergencyContact.lastName}</p>}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="emergency-contact">Contact Number</Label>
                        <Input id="emergency-contact" type="tel" placeholder="+63 9XX XXX XXXX" value={profileData.emergencyContact.contactNumber} onChange={(e) => updateEmergencyContact("contactNumber", e.target.value)} className={errors.emergencyContact.contactNumber ? "border-destructive" : ""} />
                        {errors.emergencyContact.contactNumber && <p className="text-sm text-destructive">{errors.emergencyContact.contactNumber}</p>}
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
                      {errors.emergencyContact.address && (
                        <p className="text-sm text-destructive">{errors.emergencyContact.address}</p>
                      )}
                    </div>
                  </div>

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
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      Admins can only modify their avatar icon.
                    </p>
                    <Button
                      type="submit"
                      className="cursor-pointer hover:bg-[#006AEE] hover:text-white"
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
            {isPrivilegedUser && (
              <div className="mt-6">
                <Button
                  type="button"
                  className="w-full cursor-pointer hover:bg-[#006AEE] hover:text-white"
                  asChild
                >
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              </div>
            )}
          </form>

        </div>
      </main>
    </div>
  )
}
