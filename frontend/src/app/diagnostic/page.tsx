"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { api } from "@/lib/api"
import { useAuthStore } from "@/lib/auth"
import type { DiagnosticResponse, MeasurementInput } from "@/types"
import { Upload, Loader2, CheckCircle2, XCircle } from "lucide-react"

export default function DiagnosticPage() {
    const router = useRouter()
    const { user, isAuthenticated, logout } = useAuthStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [imageType, setImageType] = useState<string>("frontal")
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [result, setResult] = useState<DiagnosticResponse | null>(null)
    const [error, setError] = useState("")
    const [measurements, setMeasurements] = useState<MeasurementInput>({})

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
            setPreview(URL.createObjectURL(file))
            setResult(null)
            setError("")
        }
    }

    const handleMeasurementChange = (field: keyof MeasurementInput, value: string) => {
        const numValue = value === "" ? null : parseFloat(value)
        setMeasurements((prev) => ({ ...prev, [field]: numValue }))
    }

    const handleAnalyze = async () => {
        if (!selectedFile) return
        setIsAnalyzing(true)
        setError("")

        try {
            const response = await api.analyzeDiagnostic(selectedFile, imageType, measurements)
            setResult(response)
        } catch (err: any) {
            setError(err.response?.data?.detail || "Analysis failed. Please try again.")
        } finally {
            setIsAnalyzing(false)
        }
    }

    return (
        <div className="container py-8 md:py-12">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Diagnostic Tool</h1>
                <p className="text-muted-foreground">Upload an image and input clinical measurements to get an IOTN grade.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Input Section */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Upload Image</CardTitle>
                            <CardDescription>Supports JPG, PNG, WebP up to 50MB</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:bg-muted/50 transition-colors"
                            >
                                {preview ? (
                                    <img src={preview} alt="Preview" className="h-full w-full object-contain" />
                                ) : (
                                    <>
                                        <Upload className="h-12 w-12 text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">Click to upload</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div>
                                <label className="text-sm font-medium mb-2 block">View Type</label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={imageType}
                                    onChange={(e) => setImageType(e.target.value)}
                                >
                                    <option value="frontal">Frontal View</option>
                                    <option value="lateral">Lateral View</option>
                                    <option value="occlusal">Occlusal View</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>2. Clinical Measurements (mm)</CardTitle>
                            <CardDescription>Enter available measurements. Leave blank if unknown.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Overjet</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g. 5.5"
                                        onChange={(e) => handleMeasurementChange("overjet_mm", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Overbite</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g. 4.0"
                                        onChange={(e) => handleMeasurementChange("overbite_mm", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Displacement</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g. 2.5"
                                        onChange={(e) => handleMeasurementChange("displacement_mm", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Open Bite</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g. 3.0"
                                        onChange={(e) => handleMeasurementChange("open_bite_mm", e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Crossbite Displacement</label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="e.g. 1.5"
                                    onChange={(e) => handleMeasurementChange("crossbite_displacement_mm", e.target.value)}
                                />
                            </div>
                            <Button onClick={handleAnalyze} disabled={!selectedFile || isAnalyzing} className="w-full" size="lg">
                                {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Analyze Image
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Section */}
                <div>
                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <XCircle className="h-4 w-4" />
                            {error}
                        </Alert>
                    )}

                    {!result ? (
                        <Card className="h-full flex items-center justify-center text-center p-12">
                            <div className="space-y-4">
                                <div className="mx-auto h-16 w-16 rounded-full bg-muted p-4 text-muted-foreground">
                                    <Upload className="h-full w-full" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">No Results Yet</h3>
                                    <p className="text-sm text-muted-foreground">Upload an image and click Analyze.</p>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* IOTN Result Card */}
                            <Card className="border-primary/50 bg-primary/5">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>IOTN Grade</span>
                                        <Badge variant="secondary" className="text-2xl px-4 py-1">
                                            {result.iotn.grade}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-base font-medium text-foreground">
                                        {result.iotn.grade_description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-semibold">Determining Factor:</span> {result.iotn.determining_factor}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-semibold">Treatment Need:</span> {result.iotn.treatment_need}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Classifications */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>AI Classifications</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {result.classifications.map((cls) => (
                                            <div key={cls.model_name} className="flex items-center justify-between rounded-lg border p-3">
                                                <span className="capitalize font-medium">{cls.model_name}</span>
                                                <div className="flex items-center gap-2">
                                                    {cls.detected ? (
                                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-5 w-5 text-gray-400" />
                                                    )}
                                                    <Badge variant={cls.detected ? "default" : "secondary"}>
                                                        {(cls.confidence * 100).toFixed(1)}%
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Segmentation */}
                            {result.segmentation?.mask_url && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Segmentation Mask</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <img
                                            src={`${process.env.NEXT_PUBLIC_API_URL}${result.segmentation.mask_url}`}
                                            alt="Segmentation"
                                            className="w-full rounded-lg border"
                                        />
                                        <p className="mt-2 text-center text-sm text-muted-foreground">
                                            Teeth Detected: {result.segmentation.tooth_count}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}