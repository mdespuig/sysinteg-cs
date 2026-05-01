"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  HeartPulse,
  Shield,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Activity,
  Building2,
  BrainCircuit,
  Boxes,
  ReceiptText,
  UserCog,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/header"

const homepageSections = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Our Systems" },
  { id: "about", label: "About Linepoint" },
  { id: "contact", label: "Contact Us" },
] as const

type HomepageSectionId = (typeof homepageSections)[number]["id"]

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState<HomepageSectionId>("overview")
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const sectionRefs = useRef<Record<HomepageSectionId, HTMLElement | null>>({
    overview: null,
    services: null,
    about: null,
    contact: null,
  })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visibleEntry?.target.id) {
          const nextSection = visibleEntry.target.id as HomepageSectionId
          setActiveSection(nextSection)
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "-20% 0px -30% 0px",
        threshold: [0.35, 0.6, 0.8],
      }
    )

    homepageSections.forEach(({ id }) => {
      const section = sectionRefs.current[id]
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  const setSectionRef = (id: HomepageSectionId) => (node: HTMLElement | null) => {
    sectionRefs.current[id] = node
  }

  const contentClass = (id: HomepageSectionId) =>
    `transition-all duration-700 ease-out ${
      activeSection === id
        ? "translate-y-0 opacity-100"
        : "pointer-events-none translate-y-8 opacity-0"
    }`

  const scrollToSection = (id: HomepageSectionId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Header />

      <div className="fixed right-10 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex">
        {homepageSections.map((section, index) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className={`group flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
              activeSection === section.id ? "bg-[#006AEE]/10" : "bg-transparent hover:bg-[#006AEE]/10"
            }`}
            aria-label={`Scroll to ${section.label}`}
          >
            <span
              className={`block rounded-full transition-all ${
                activeSection === section.id
                  ? "h-3 w-3 bg-[#006AEE]"
                  : "h-1 w-4 bg-slate-300 group-hover:bg-[#006AEE]"
              }`}
            />
            <span className="sr-only">{index + 1}</span>
          </button>
        ))}
      </div>

      <main ref={scrollContainerRef} className="h-[calc(100vh-4rem)] snap-y snap-mandatory overflow-y-auto scroll-smooth">
        <section
          id="overview"
          ref={setSectionRef("overview")}
          className="relative flex min-h-full snap-start snap-always flex-col justify-center overflow-hidden border-b bg-[#F8FFFE]"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-accent/5" />
          <div className={`container relative mx-auto px-4 py-12 md:py-16 ${contentClass("overview")}`}>
              <div className="mx-auto max-w-3xl text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Trusted Healthcare Provider</span>
                </div>
                <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                  <span className="text-balance">Your Health, Our Priority</span>
                </h1>
                <p className="mb-8 text-lg leading-relaxed text-muted-foreground md:text-xl">
                  Providing comprehensive healthcare services with compassion, expertise, and dedication. 
                  Experience world-class medical care tailored to your needs.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/support">
                      Contact Support
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="#services">
                      Main Portal
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-4 rounded-2xl border border-blue-100 bg-[#D2F1FF] p-5 shadow-[0_12px_30px_rgba(59,130,246,0.08)] md:grid-cols-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary md:text-4xl">25+</p>
                  <p className="mt-1 text-sm text-slate-600">Years of Excellence</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary md:text-4xl">150+</p>
                  <p className="mt-1 text-sm text-slate-600">Expert Doctors</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary md:text-4xl">50K+</p>
                  <p className="mt-1 text-sm text-slate-600">Patients Served</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary md:text-4xl">24/7</p>
                  <p className="mt-1 text-sm text-slate-600">Emergency Care</p>
                </div>
              </div>
          </div>
        </section>

        <section
          id="services"
          ref={setSectionRef("services")}
          className="flex min-h-full snap-start snap-always items-center border-b bg-white"
        >
          <div className={`container mx-auto px-4 py-12 md:py-16 ${contentClass("services")}`}>
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">Our Systems</h2>
            <p className="mx-auto max-w-4xl text-muted-foreground lg:whitespace-nowrap">
              Comprehensive healthcare subsystems designed to meet all your medical needs under one roof.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-6">
            <Card className="transition-shadow hover:shadow-md lg:col-span-2">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BrainCircuit className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Predictive Analysis</CardTitle>
                <CardDescription>
                  Forecast patient trends, identify risks early, and support data-driven care decisions.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md lg:col-span-2">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <UsersRound className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Patient Management</CardTitle>
                <CardDescription>
                  Centralize patient profiles, appointments, and care workflows in one secure system.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md lg:col-span-2">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Boxes className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Inventory & Pharmaceutical</CardTitle>
                <CardDescription>
                  Track stock, medications, and supplies to reduce waste and avoid shortages.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md lg:col-span-3">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <ReceiptText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Billing & Finance</CardTitle>
                <CardDescription>
                  Manage invoices, payments, and financial reporting with clarity and control.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md lg:col-span-3">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <UserCog className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Healthcare Staff Management</CardTitle>
                <CardDescription>
                  Organize roles, shifts, and team access across departments and facilities.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          </div>
        </section>

        <section
          id="about"
          ref={setSectionRef("about")}
          className="flex min-h-full snap-start snap-always items-center border-b bg-muted/30"
        >
          <div className={`container mx-auto px-4 py-12 md:py-16 ${contentClass("about")}`}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-foreground">About Linepoint</h2>
              <p className="mb-6 leading-relaxed text-muted-foreground">
                For over 25 years, Linepoint has been at the forefront of healthcare excellence. 
                Our commitment to patient-centered care, combined with cutting-edge technology and 
                a team of dedicated professionals, makes us a trusted partner in your health journey.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-online/20">
                    <Shield className="h-3.5 w-3.5 text-online" />
                  </div>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Accredited Facility:</strong> Certified by international healthcare standards
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-online/20">
                    <Shield className="h-3.5 w-3.5 text-online" />
                  </div>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Expert Team:</strong> Board-certified physicians and healthcare professionals
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-online/20">
                    <Shield className="h-3.5 w-3.5 text-online" />
                  </div>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Modern Technology:</strong> Latest medical equipment and digital health solutions
                  </span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <Card className="border-2">
                <CardContent className="p-8">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">Need Assistance?</h3>
                  <p className="mb-6 text-muted-foreground">
                    Our support team is here to help you with appointments, billing inquiries, 
                    medical records, and more.
                  </p>
                  <Button className="w-full" size="lg" asChild>
                    <Link href="/support">
                      Contact Us
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
          </div>
        </section>

        <section
          id="contact"
          ref={setSectionRef("contact")}
          className="flex min-h-full snap-start snap-always flex-col justify-center border-b bg-white"
        >
          <div className={`container mx-auto px-4 py-12 md:py-16 ${contentClass("contact")}`}>
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">Contact Us</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Do you have any questions? Reach out to us through any of the following channels.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="text-center transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">Call Us</h3>
                <p className="text-sm text-muted-foreground">+63 (2) 8888-1234</p>
                <p className="text-sm text-muted-foreground">+63 917 123 4567</p>
              </CardContent>
            </Card>

            <Card className="text-center transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">Email Us</h3>
                <p className="text-sm text-muted-foreground">info@medicare.health</p>
                <p className="text-sm text-muted-foreground">support@medicare.health</p>
              </CardContent>
            </Card>

            <Card className="text-center transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">Visit Us</h3>
                <p className="text-sm text-muted-foreground">123 Healthcare Avenue</p>
                <p className="text-sm text-muted-foreground">Makati City, Metro Manila</p>
              </CardContent>
            </Card>
          </div>

          <footer className="mt-10 border-t border-blue-100 pt-6">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <HeartPulse className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">Linepoint</span>
              </div>
              <div className="text-center md:text-right">
                <p className="text-sm text-muted-foreground">
                  2026 Linepoint. All rights reserved.
                </p>
                <p className="text-sm text-muted-foreground">
                  Cobilla, Despuig, Esmabe, Mapa | ITMC321 - ZT32
                </p>
              </div>
            </div>
          </footer>
          </div>
        </section>
      </main>
    </div>
  )
}
