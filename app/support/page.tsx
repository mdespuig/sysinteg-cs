"use client"

import Link from "next/link"
import {
  FilePlus,
  Search,
  Headphones,
  ClipboardList,
  FileSearch,
  HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/header"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

export default function SupportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    const isStandard = (session?.user as any)?.role === "standard"

    if (!session || !isStandard) {
      toast.error("You have no access to this page")
      router.push("/")
    }
  }, [session, status, router])

  if (status === "loading") {
    return null
  }

  if (!session || (session?.user as any)?.role !== "standard") {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Headphones className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Customer Support
            </h1>
            <p className="text-lg text-muted-foreground">
              How can we assist you today? Choose an option below.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="group relative flex h-full flex-col overflow-hidden transition-all hover:border-primary hover:shadow-lg">
              <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-primary/10 transition-transform group-hover:scale-150" />
              <CardHeader className="relative">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <FilePlus className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-xl">Request an Inquiry</CardTitle>
                <CardDescription className="text-base">
                  Submit a new inquiry for appointments, billing, medical records, prescriptions, or general concerns.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative flex flex-1 flex-col">
                <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Schedule or manage appointments
                  </li>
                  <li className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Billing and payment questions
                  </li>
                  <li className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Request medical records
                  </li>
                  <li className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Prescription refills
                  </li>
                </ul>
                <Button className="mt-auto w-full cursor-pointer" size="lg" asChild>
                  <Link href="/support/request">Request Inquiry</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative flex h-full flex-col overflow-hidden transition-all hover:border-accent hover:shadow-lg">
              <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-accent/10 transition-transform group-hover:scale-150" />
              <CardHeader className="relative">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/20">
                  <Search className="h-7 w-7 text-accent" />
                </div>
                <CardTitle className="text-xl">View an Inquiry</CardTitle>
                <CardDescription className="text-base">
                  Check the status of your existing inquiries or view your inquiry history.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative flex flex-1 flex-col">
                <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-accent" />
                    Search by inquiry ID
                  </li>
                  <li className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-accent" />
                    Track inquiry status
                  </li>
                  <li className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-accent" />
                    View inquiry history
                  </li>
                  <li className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-accent" />
                    See response details
                  </li>
                </ul>
                <Button className="mt-auto w-full cursor-pointer bg-accent text-accent-foreground hover:bg-accent/90" size="lg" asChild>
                  <Link href="/support/view">View Inquiries</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-8 border-dashed">
            <CardContent className="flex items-start gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Need immediate assistance?</p>
                <p className="text-sm text-muted-foreground">
                  For emergencies, please call our 24/7 hotline at{" "}
                  <span className="font-medium text-primary">+63 (2) 8888-1234</span> or visit our Emergency Department.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
