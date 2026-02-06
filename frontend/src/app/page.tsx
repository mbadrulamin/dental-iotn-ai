"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, LayoutDashboard, FileEdit, Moon, Sun } from "lucide-react"
import { useAuthStore } from "@/lib/auth"
import { useEffect } from "react"

export default function HomePage() {
    const { isAuthenticated, checkAuth, user } = useAuthStore()

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    const features = [
        {
            icon: Activity,
            title: "AI Classification",
            description: "5 specialized models detect orthodontic conditions with high accuracy.",
        },
        {
            icon: LayoutDashboard,
            title: "IOTN DHC Grading",
            description: "Accurate Grade 1-5 calculation based on clinical standards.",
        },
        {
            icon: FileEdit,
            title: "Expert Validation",
            description: "Blind review system for research-grade data validation.",
        },
    ]

    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <section className="container py-24 md:py-32 lg:py-40 flex flex-col items-center text-center gap-6">
                <div className="space-y-4 max-w-3xl">
                    <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                        AI-Powered Dental Diagnostics
                    </h1>
                    <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                        Get instant IOTN DHC grading powered by advanced AI models. Upload dental images and receive comprehensive diagnostic results.
                    </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                    {isAuthenticated ? (
                        <Button size="lg" asChild>
                            <Link href="/diagnostic">Start Diagnostic</Link>
                        </Button>
                    ) : (
                        <Button size="lg" asChild>
                            <Link href="/login">Get Started</Link>
                        </Button>
                    )}
                    <Button variant="outline" size="lg" asChild>
                        <Link href="#features">Learn More</Link>
                    </Button>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="container py-24 bg-muted/50 rounded-3xl my-12">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-16">
                    Platform Features
                </h2>
                <div className="grid gap-6 md:grid-cols-3">
                    {features.map((feature, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                    <feature.icon className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle>{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-base">
                                    {feature.description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-6 md:py-0">
                <div className="container flex h-16 items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        © 2024 Dental IOTN AI. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    )
}