"use client"

import Link from "next/link"
import {
  HeartPulse,
  Stethoscope,
  Users,
  Clock,
  Shield,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Activity,
  Clipboard,
  UserCheck,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/header"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-4 py-20 md:py-28">
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
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary md:text-4xl">25+</p>
              <p className="mt-1 text-sm text-muted-foreground">Years of Excellence</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary md:text-4xl">150+</p>
              <p className="mt-1 text-sm text-muted-foreground">Expert Doctors</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary md:text-4xl">50K+</p>
              <p className="mt-1 text-sm text-muted-foreground">Patients Served</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary md:text-4xl">24/7</p>
              <p className="mt-1 text-sm text-muted-foreground">Emergency Care</p>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-16 border-b">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">Our Services</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Comprehensive healthcare services designed to meet all your medical needs under one roof.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Primary Care</CardTitle>
                <CardDescription>
                  Comprehensive health check-ups, preventive care, and treatment for common illnesses.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <HeartPulse className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Cardiology</CardTitle>
                <CardDescription>
                  Advanced heart care including diagnostics, treatment, and cardiac rehabilitation.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Family Medicine</CardTitle>
                <CardDescription>
                  Healthcare for the whole family, from pediatrics to geriatric care.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Emergency Services</CardTitle>
                <CardDescription>
                  24/7 emergency care with rapid response and life-saving treatments.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Clipboard className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Laboratory Services</CardTitle>
                <CardDescription>
                  State-of-the-art diagnostic testing and imaging services.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Specialist Consultations</CardTitle>
                <CardDescription>
                  Access to expert specialists across various medical fields.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-16 border-b bg-muted/30">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-foreground">About MediCare Health</h2>
              <p className="mb-6 leading-relaxed text-muted-foreground">
                For over 25 years, MediCare Health has been at the forefront of healthcare excellence. 
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
                    <Link href="#contact">
                      Contact Us
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-16 border-b">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">Contact Us</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Have questions? Reach out to us through any of the following channels.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">Call Us</h3>
                <p className="text-sm text-muted-foreground">+63 (2) 8888-1234</p>
                <p className="text-sm text-muted-foreground">+63 917 123 4567</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">Email Us</h3>
                <p className="text-sm text-muted-foreground">info@medicare.health</p>
                <p className="text-sm text-muted-foreground">support@medicare.health</p>
              </CardContent>
            </Card>

            <Card className="text-center">
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
        </div>
      </section>

      <footer className="bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <HeartPulse className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">MediCare Health</span>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              2026 MediCare Health System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
