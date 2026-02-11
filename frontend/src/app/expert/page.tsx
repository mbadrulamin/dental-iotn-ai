"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { CheckCircle2, XCircle, SkipForward, Loader2, Activity } from "lucide-react"
import type { AssessmentValue } from "@/types"

// Helper to create default assessment object
const createDefaultAssessment = () => ({
    crossbite_present: "no" as AssessmentValue,
    overbite_present: "no" as AssessmentValue,
    openbite_present: "no" as AssessmentValue,
    displacement_present: "no" as AssessmentValue,
    overjet_present: "no" as AssessmentValue,
    notes: "",
})

export default function ExpertPage() {
    const { user, isAuthenticated, checkAuth } = useAuthStore()
    const [currentImage, setCurrentImage] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [assessment, setAssessment] = useState(createDefaultAssessment())

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    useEffect(() => {
        if (isAuthenticated && (user?.role === "expert" || user?.role === "admin")) {
            loadNextImage()
        }
    }, [isAuthenticated, user])

    const loadNextImage = async () => {
        try {
            const img = await api.getNextImage()
            setCurrentImage(img)
            setAssessment(createDefaultAssessment()) // Reset to default
        } catch (err) {
            console.error("Failed to load image")
        }
    }

    const handleSubmit = async () => {
        if (!currentImage) return
        setIsSubmitting(true)
        try {
            await api.submitAssessment({ image_id: currentImage.id, ...assessment })
            loadNextImage()
        } catch (err) {
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isAuthenticated || (user?.role !== "expert" && user?.role !== "admin")) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Card className="w-full max-w-sm">
                    <CardContent className="pt-6 text-center">
                        <Activity className="h-12 w-12 mx-auto text-primary mb-4" />
                        <h2 className="text-xl font-bold">Expert Access Required</h2>
                        <p className="text-muted-foreground mb-4">
                            You need to be logged in as an expert to access this page.
                        </p>
                        <Button asChild>
                            <a href="/login">Login</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!currentImage) {
        return (
            <div className="container py-12 text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <CheckCircle2 className="h-8 w-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">All Caught Up!</h1>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                    You have reviewed all assigned images. Great job!
                </p>
                <Button asChild variant="outline">
                    <a href="/">Return to Home</a>
                </Button>
            </div>
        )
    }

    return (
        <div className="container py-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Expert Blind Review</h1>
                    <p className="text-muted-foreground">Review images and identify orthodontic conditions.</p>
                </div>
                <Badge variant="secondary" className="text-sm py-1 px-3">
                    {user?.email}
                </Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 items-start">
                {/* Left: Image Display (Full width on mobile) */}
                <Card>
                    <CardContent className="p-0">
                        <img
                            src={`${process.env.NEXT_PUBLIC_API_URL}${currentImage.image_url}`}
                            alt="Dental image for review"
                            className="w-full h-auto object-contain bg-muted/20 min-h-[300px] md:min-h-[500px]"
                        />
                        <div className="p-4 border-t bg-muted/30 text-sm text-muted-foreground flex justify-between">
                            <span>Filename: {currentImage.original_filename}</span>
                            <span>Dataset: {currentImage.dataset_name || 'General'}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Assessment Form (Full width on mobile) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Expert Assessment</CardTitle>
                        <CardDescription>
                            Review the image and identify conditions present.
                            Default is "No" (Assumed Negative).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Condition Toggles */}
                        <div className="space-y-4">
                            {(["crossbite_present", "overbite_present", "openbite_present", "displacement_present", "overjet_present"] as const).map((key) => (
                                <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-4 bg-card gap-4">
                                    <span className="font-semibold text-base min-w-[120px]">{key.replace("_present", "")}</span>

                                    <div className="flex gap-2 w-full sm:w-auto">
                                        {(["yes", "no", "na"] as const).map((val) => (
                                            <Button
                                                key={val}
                                                variant={assessment[key] === val ? "default" : "outline"}
                                                size="sm"
                                                className={`
                          flex-1 sm:flex-none min-w-[60px]
                          ${val === 'yes' && assessment[key] === 'yes' ? 'bg-green-600 hover:bg-green-700' : ''}
                          ${val === 'no' && assessment[key] === 'no' ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : ''}
                        `}
                                                onClick={() => setAssessment(prev => ({ ...prev, [key]: val }))}
                                            >
                                                {val.toUpperCase()}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Additional Notes</label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Any additional observations..."
                                value={assessment.notes}
                                onChange={(e) => setAssessment(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>

                        {/* Messages */}
                        {/* (Optional: You can add error handling here similar to Admin page if needed) */}

                        {/* Submit Button */}
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full" size="lg">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit & Next
                        </Button>

                        <Button variant="ghost" onClick={loadNextImage} className="w-full">
                            Skip Image
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}