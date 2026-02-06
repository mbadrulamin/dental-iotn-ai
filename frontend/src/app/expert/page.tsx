"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { CheckCircle2, XCircle, SkipForward, Loader2 } from "lucide-react"
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
    // State now correctly typed
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
        return <div className="p-8 text-center">Access Denied</div>
    }

    if (!currentImage) {
        return (
            <div className="container py-12 text-center space-y-4">
                <h1 className="text-3xl font-bold">All Caught Up!</h1>
                <p className="text-muted-foreground">You have reviewed all assigned images.</p>
            </div>
        )
    }

    return (
        <div className="container py-8">
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Image Display */}
                <Card>
                    <CardContent className="p-4">
                        <img
                            src={`${process.env.NEXT_PUBLIC_API_URL}${currentImage.image_url}`}
                            alt="Dental image"
                            className="w-full rounded-lg bg-muted"
                        />
                    </CardContent>
                </Card>

                {/* Assessment Form */}
                <Card>
                    <CardContent className="p-6 space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Expert Assessment</h2>
                            <p className="text-sm text-muted-foreground">Review the image and identify conditions.</p>
                        </div>

                        <div className="space-y-4">
                            {(["crossbite_present", "overbite_present", "openbite_present", "displacement_present", "overjet_present"] as const).map((key) => (
                                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                                    <span className="font-medium capitalize">{key.replace("_present", "")}</span>
                                    <div className="flex gap-2">
                                        {(["yes", "no", "na"] as const).map((val) => (
                                            <Button
                                                key={val}
                                                variant={assessment[key] === val ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setAssessment(prev => ({ ...prev, [key]: val }))}
                                            >
                                                {val.toUpperCase()}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

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