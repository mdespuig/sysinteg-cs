"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { redirect } from "next/navigation"
import { useEffect } from "react"
import { HeartPulse, LogOut, User, Mail, Calendar } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session?.user) {
      const checkUserRole = async () => {
        try {
          if ((session.user as any)?.role === "standard") {
            router.push("/")
          }
        } catch (error) {
          console.error("Error checking user role:", error)
        }
      }
      
      checkUserRole()
    }
  }, [session, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (status === "unauthenticated") {
    redirect("/auth/login")
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    toast.success("Logged out successfully")
    router.push("/")
    router.refresh()
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
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/dashboard" className="text-sm font-medium text-foreground">
              Dashboard
            </Link>
            <Link href="#appointments" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Appointments
            </Link>
            <Link href="#records" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Medical Records
            </Link>
          </nav>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome back, {session?.user?.name}!
          </h1>
          <p className="text-muted-foreground">
            Here's your healthcare dashboard. Manage appointments, view medical records, and more.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="font-medium">{session?.user?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{session?.user?.email}</p>
              </div>
              <Button variant="outline" className="w-full">
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <Button className="w-full">
                Schedule Appointment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Medical Records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Available Records</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <Button variant="outline" className="w-full">
                View Records
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Your healthcare account is active and ready to use</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-muted-foreground">Account Status</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">Active</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-muted-foreground">Profile</p>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Complete</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-muted-foreground">Notifications</p>
                <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">Enabled</p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-muted-foreground">2FA</p>
                <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">Optional</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
