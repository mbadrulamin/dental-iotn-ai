"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { useAuthStore } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    CheckCircle2,
    Circle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Activity,
    ArrowLeft,
    Send,
    ImageIcon,
    ClipboardList,
    Eye,
    AlertCircle,
} from "lucide-react"
import type { AssessmentValue } from "@/types"
import Swal from "sweetalert2"

// ─── Types ───────────────────────────────────────────────────────
interface ImageData {
    id: string
    filename: string
    image_url: string
    is_reviewed: boolean
    dataset_name: string | null
    assessment: {
        crossbite_present: string
        overbite_present: string
        openbite_present: string
        displacement_present: string
        overjet_present: string
        notes: string
    } | null
}

interface DatasetTask {
    id: string
    name: string
    images: ImageData[]
    totalImages: number
    reviewedImages: number
}

type ViewMode = "list" | "review"

// ─── Helpers ─────────────────────────────────────────────────────
const createDefaultAssessment = () => ({
    crossbite_present: "no" as AssessmentValue,
    overbite_present: "no" as AssessmentValue,
    openbite_present: "no" as AssessmentValue,
    displacement_present: "no" as AssessmentValue,
    overjet_present: "no" as AssessmentValue,
    notes: "",
})

const ASSESSMENT_KEYS = [
    "crossbite_present",
    "overbite_present",
    "openbite_present",
    "displacement_present",
    "overjet_present",
] as const

const CONDITION_LABELS: Record<string, string> = {
    crossbite_present: "Crossbite",
    overbite_present: "Overbite",
    openbite_present: "Open Bite",
    displacement_present: "Displacement",
    overjet_present: "Overjet",
}

// const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const API_URL = process.env.NEXT_PUBLIC_API_URL || "" //empty string for automatic relative path (Nginx will catch)

// ─── Component ───────────────────────────────────────────────────
export default function ExpertPage() {
    const router = useRouter()
    const { user, isAuthenticated, checkAuth } = useAuthStore()

    // ─── State ───────────────────────────────────────────────────
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<ViewMode>("list")
    const [activeTab, setActiveTab] = useState("active")

    // Task data
    const [activeTasks, setActiveTasks] = useState<DatasetTask[]>([])
    const [completedTasks, setCompletedTasks] = useState<DatasetTask[]>([])

    // Review workspace
    const [currentTask, setCurrentTask] = useState<DatasetTask | null>(null)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [assessment, setAssessment] = useState(createDefaultAssessment())
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [readOnlyMode, setReadOnlyMode] = useState(false)

    // ─── Initialization ──────────────────────────────────────────
    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    useEffect(() => {
        if (isAuthenticated && (user?.role === "expert" || user?.role === "admin")) {
            loadTasks()
        }
    }, [isAuthenticated, user])

    // ─── Keyboard navigation ─────────────────────────────────────
    useEffect(() => {
        if (viewMode !== "review" || !currentTask) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                e.preventDefault()
                navigateImage(-1)
            } else if (e.key === "ArrowRight") {
                e.preventDefault()
                navigateImage(1)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [viewMode, currentTask, currentImageIndex])

    // ─── Data Loading ────────────────────────────────────────────
    const loadTasks = async () => {
        setLoading(true)
        try {
            const datasets = await api.getMyDatasets()
            const tasks: DatasetTask[] = []

            for (const ds of datasets) {
                try {
                    const images = await api.getDatasetOverview(ds.id)
                    const reviewed = images.filter((img: any) => img.is_reviewed).length

                    tasks.push({
                        id: ds.id,
                        name: ds.name,
                        images,
                        totalImages: images.length,
                        reviewedImages: reviewed,
                    })
                } catch (e) {
                    console.error("Error fetching dataset overview for", ds.id, e)
                }
            }

            const active: DatasetTask[] = []
            const completed: DatasetTask[] = []

            for (const task of tasks) {
                if (task.totalImages > 0 && task.reviewedImages === task.totalImages) {
                    completed.push(task)
                } else {
                    active.push(task)
                }
            }

            setActiveTasks(active)
            setCompletedTasks(completed)
        } catch (err) {
            console.error("Failed to load tasks", err)
        } finally {
            setLoading(false)
        }
    }

    // ─── Task Actions ────────────────────────────────────────────
    const openTask = (task: DatasetTask, readOnly: boolean = false) => {
        if (task.images.length === 0) {
            Swal.fire("Empty Dataset", "This dataset has no images to review.", "info")
            return
        }

        setCurrentTask(task)
        setReadOnlyMode(readOnly)
        setViewMode("review")

        let startIdx = 0
        if (!readOnly) {
            const firstPendingIdx = task.images.findIndex((img) => !img.is_reviewed)
            startIdx = firstPendingIdx >= 0 ? firstPendingIdx : 0
        }

        setCurrentImageIndex(startIdx)
        loadAssessmentForImage(task.images[startIdx])
    }

    const goBackToList = async () => {
        if (currentTask && !readOnlyMode) {
            const reviewedCount = currentTask.images.filter((i) => i.is_reviewed).length
            const isAllDone = reviewedCount === currentTask.totalImages

            if (isAllDone) {
                const result = await Swal.fire({
                    title: "Submit Task?",
                    text: "You have answered all questions. Please confirm submission to finalize.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonColor: "#10b981",
                    confirmButtonText: "Submit & Exit",
                    cancelButtonText: "Stay",
                })

                if (result.isConfirmed) {
                    setCompletedTasks((prev) => [...prev, currentTask])
                    setActiveTasks((prev) => prev.filter((t) => t.id !== currentTask.id))
                } else {
                    return
                }
            }
        }

        setViewMode("list")
        setCurrentTask(null)
        setCurrentImageIndex(0)
        setAssessment(createDefaultAssessment())
        setReadOnlyMode(false)
        loadTasks()
    }

    // ─── Image Navigation ────────────────────────────────────────
    const navigateImage = useCallback(
        (direction: number) => {
            if (!currentTask) return
            const newIndex = currentImageIndex + direction
            if (newIndex >= 0 && newIndex < currentTask.images.length) {
                setCurrentImageIndex(newIndex)
                loadAssessmentForImage(currentTask.images[newIndex])
            }
        },
        [currentTask, currentImageIndex]
    )

    const selectImageByIndex = (index: number) => {
        if (!currentTask || index < 0 || index >= currentTask.images.length) return
        setCurrentImageIndex(index)
        loadAssessmentForImage(currentTask.images[index])
    }

    const loadAssessmentForImage = (image: ImageData | undefined) => {
        if (!image) {
            setAssessment(createDefaultAssessment())
            return
        }
        if (image.assessment) {
            setAssessment({
                crossbite_present: image.assessment.crossbite_present as AssessmentValue,
                overbite_present: image.assessment.overbite_present as AssessmentValue,
                openbite_present: image.assessment.openbite_present as AssessmentValue,
                displacement_present: image.assessment.displacement_present as AssessmentValue,
                overjet_present: image.assessment.overjet_present as AssessmentValue,
                notes: image.assessment.notes || "",
            })
        } else {
            setAssessment(createDefaultAssessment())
        }
    }

    // ─── Assessment Submission ───────────────────────────────────
    const handleSaveAssessment = async () => {
        if (!currentTask || readOnlyMode) return

        const currentImage = currentTask.images[currentImageIndex]
        if (!currentImage) return

        setIsSubmitting(true)
        try {
            await api.submitAssessment({
                image_id: currentImage.id,
                ...assessment,
            })

            const updatedImages = currentTask.images.map((img, idx) =>
                idx === currentImageIndex
                    ? { ...img, is_reviewed: true, assessment: { ...assessment } }
                    : img
            )

            const updatedTask = {
                ...currentTask,
                images: updatedImages,
                reviewedImages: updatedImages.filter((img) => img.is_reviewed).length,
            }

            setCurrentTask(updatedTask)
            setActiveTasks((prev) =>
                prev.map((t) => (t.id === currentTask.id ? updatedTask : t))
            )

            const nextPendingIdx = updatedImages.findIndex(
                (img, idx) => !img.is_reviewed && idx !== currentImageIndex
            )

            if (nextPendingIdx >= 0) {
                setCurrentImageIndex(nextPendingIdx)
                loadAssessmentForImage(updatedImages[nextPendingIdx])
            } else {
                if (updatedTask.reviewedImages === updatedTask.totalImages) {
                    await Swal.fire({
                        title: "All Images Reviewed!",
                        text: "You can now submit this task.",
                        icon: "success",
                        confirmButtonColor: "#10b981",
                    })
                }
            }
        } catch (err: any) {
            const detail = err?.response?.data?.detail || "Failed to save assessment."
            Swal.fire("Error", detail, "error")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSubmitTask = async () => {
        if (!currentTask) return

        const reviewedCount = currentTask.images.filter((i) => i.is_reviewed).length

        if (reviewedCount < currentTask.totalImages) {
            const remaining = currentTask.totalImages - reviewedCount
            Swal.fire({
                title: "Incomplete Task",
                html: `You still have <strong>${remaining}</strong> unanswered image(s).`,
                icon: "warning",
                confirmButtonColor: "#f59e0b",
            })
            return
        }

        const result = await Swal.fire({
            title: "Final Submission?",
            text: "Once submitted, all answers will be finalized and cannot be changed.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            confirmButtonText: "Yes, submit",
            cancelButtonText: "Cancel",
        })

        if (result.isConfirmed) {
            setCompletedTasks((prev) => [...prev, currentTask])
            setActiveTasks((prev) => prev.filter((t) => t.id !== currentTask.id))
            goBackToList()
            Swal.fire({
                title: "Submitted!",
                text: "Your task has been submitted successfully.",
                icon: "success",
                confirmButtonColor: "#10b981",
            })
        }
    }

    // ─── Computed Values ─────────────────────────────────────────
    const currentImage = currentTask?.images[currentImageIndex] ?? null
    const reviewedCount = currentTask
        ? currentTask.images.filter((i) => i.is_reviewed).length
        : 0
    const totalCount = currentTask?.images.length ?? 0
    const allReviewed = reviewedCount === totalCount && totalCount > 0

    // ─── Auth Guard ──────────────────────────────────────────────
    if (!isAuthenticated || (user?.role !== "expert" && user?.role !== "admin")) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                            <Activity className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold">Access Denied</h2>
                        <p className="text-muted-foreground mt-2">
                            Expert or admin access is required to view this page.
                        </p>
                        <Button asChild className="mt-6">
                            <a href="/login">Go to Login</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // ─── Loading State ───────────────────────────────────────────
    if (loading && viewMode === "list") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Loading your tasks...</p>
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // REVIEW WORKSPACE VIEW
    // ═══════════════════════════════════════════════════════════════
    if (viewMode === "review" && currentTask) {
        return (
            <div className="h-[calc(100vh-64px)] flex bg-muted/30 overflow-hidden">

                {/* ─── Left Sidebar: Thumbnail List ─────────────── */}
                <div className="w-24 md:w-32 lg:w-40 border-r bg-card flex flex-col">
                    <div className="p-2 border-b">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goBackToList}
                            className="w-full text-xs"
                        >
                            <ArrowLeft className="h-3 w-3 mr-1" />
                            Back
                        </Button>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                            {currentTask.images.map((img, idx) => (
                                <button
                                    key={img.id}
                                    onClick={() => selectImageByIndex(idx)}
                                    className={`
                                        relative w-full aspect-square rounded-md overflow-hidden border-2 transition-all
                                        ${idx === currentImageIndex
                                            ? "border-primary ring-2 ring-primary shadow-md"
                                            : img.is_reviewed
                                                ? "border-emerald-400 hover:border-emerald-500"
                                                : "border-transparent hover:border-muted-foreground/30"
                                        }
                                    `}
                                >
                                    <img
                                        src={`${API_URL}${img.image_url}`}
                                        alt={`Thumb ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                                        {idx + 1}
                                    </div>
                                    {img.is_reviewed && (
                                        <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                                            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* ─── Center: Image Viewer ─────────────────────── */}
                <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-muted/40 relative overflow-hidden">

                    {/* Image Container with Frame */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        {currentImage && (
                            <div className="relative bg-white rounded-lg shadow-2xl overflow-hidden max-w-full max-h-full border-4 border-white">
                                <img
                                    src={`${API_URL}${currentImage.image_url}`}
                                    alt={`Dental image ${currentImageIndex + 1}`}
                                    className="max-h-[calc(100vh-180px)] w-auto object-contain"
                                />

                                {/* Status Badge inside frame */}
                                <div className="absolute top-3 left-3">
                                    {currentImage?.is_reviewed ? (
                                        <Badge className="bg-emerald-500 text-white border-0 shadow">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Answered
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-amber-500 text-white border-0 shadow">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            Pending
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Floating Navigation Buttons */}
                        {currentImageIndex > 0 && (
                            <button
                                onClick={() => navigateImage(-1)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/50 text-white flex items-center justify-center transition-all backdrop-blur-sm shadow-lg"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                        )}
                        {currentImageIndex < totalCount - 1 && (
                            <button
                                onClick={() => navigateImage(1)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/50 text-white flex items-center justify-center transition-all backdrop-blur-sm shadow-lg"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* ─── Right: Assessment Panel ─────────────── */}
                <div className="w-[360px] flex-shrink-0 bg-card border-l flex flex-col h-full overflow-hidden">
                    <ScrollArea className="flex-1">
                        <div className="p-5 space-y-5">

                            {/* Header Info */}
                            <div>
                                <h2 className="font-bold text-lg text-foreground leading-tight">
                                    {currentTask.name}
                                </h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <p className="text-sm text-muted-foreground">
                                        Image <span className="font-semibold text-foreground">{currentImageIndex + 1}</span> of {totalCount}
                                    </p>
                                    <Badge variant="outline" className="ml-auto">
                                        {reviewedCount}/{totalCount} Done
                                    </Badge>
                                </div>
                                <Progress value={reviewedCount} max={totalCount} className="h-1.5 mt-2" />
                            </div>

                            {readOnlyMode && (
                                <div className="rounded-lg bg-secondary border p-3 text-sm text-secondary-foreground flex items-center gap-2">
                                    <Eye className="h-4 w-4 flex-shrink-0" />
                                    Read-only mode: Task submitted.
                                </div>
                            )}

                            {!readOnlyMode && (
                                <Button
                                    onClick={handleSubmitTask}
                                    disabled={!allReviewed}
                                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-muted"
                                >
                                    <Send className="h-4 w-4" />
                                    Submit Task
                                </Button>
                            )}

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-foreground mb-3">Assessment</h3>
                                <div className="space-y-3">
                                    {ASSESSMENT_KEYS.map((key) => (
                                        <div
                                            key={key}
                                            className="flex items-center justify-between rounded-lg border bg-muted/30 p-2.5"
                                        >
                                            <span className="text-sm font-medium text-foreground">
                                                {CONDITION_LABELS[key]}
                                            </span>
                                            <div className="flex gap-1">
                                                {(["yes", "no", "na"] as const).map((val) => (
                                                    <Button
                                                        key={val}
                                                        variant={assessment[key] === val ? "default" : "outline"}
                                                        size="sm"
                                                        disabled={readOnlyMode}
                                                        className={`
                                                            min-w-[44px] text-xs font-semibold
                                                            ${val === "yes" && assessment[key] === "yes" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                                                            ${val === "no" && assessment[key] === "no" ? "bg-slate-500 hover:bg-slate-600 text-white" : ""}
                                                            ${val === "na" && assessment[key] === "na" ? "bg-muted-foreground text-white" : ""}
                                                        `}
                                                        onClick={() =>
                                                            setAssessment((prev) => ({ ...prev, [key]: val }))
                                                        }
                                                    >
                                                        {val.toUpperCase()}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Notes</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-70"
                                    value={assessment.notes}
                                    disabled={readOnlyMode}
                                    onChange={(e) =>
                                        setAssessment((prev) => ({ ...prev, notes: e.target.value }))
                                    }
                                />
                            </div>

                            {!readOnlyMode && (
                                <Button
                                    onClick={handleSaveAssessment}
                                    disabled={isSubmitting}
                                    className="w-full"
                                    variant={currentImage?.is_reviewed ? "secondary" : "default"}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                    )}
                                    {currentImage?.is_reviewed ? "Update Assessment" : "Save Assessment"}
                                </Button>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // TASK LIST VIEW
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="container py-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-8">
                    <TabsTrigger value="active" className="gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Active Tasks
                        {activeTasks.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                {activeTasks.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed
                        {completedTasks.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                {completedTasks.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                    {activeTasks.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted flex items-center justify-center">
                                <ImageIcon className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                No Active Tasks
                            </h3>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                You don&apos;t have any datasets to review right now.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {activeTasks.map((task) => {
                                const pct = task.totalImages > 0
                                    ? Math.round((task.reviewedImages / task.totalImages) * 100)
                                    : 0
                                const isReady = task.reviewedImages === task.totalImages && task.totalImages > 0

                                return (
                                    <Card
                                        key={task.id}
                                        className={`group cursor-pointer hover:shadow-lg transition-all duration-300 ${isReady ? "ring-2 ring-emerald-400" : "hover:ring-2 hover:ring-ring"}`}
                                        onClick={() => openTask(task)}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                                                    {task.name}
                                                </CardTitle>
                                                {isReady ? (
                                                    <Badge className="bg-emerald-600 text-white border-0 text-xs">
                                                        Ready
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-xs">
                                                        In Progress
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <ImageIcon className="h-3.5 w-3.5" />
                                                        {task.totalImages} images
                                                    </span>
                                                    <span className="font-semibold text-foreground">
                                                        {task.reviewedImages}/{task.totalImages}
                                                    </span>
                                                </div>
                                                <Progress value={task.reviewedImages} max={task.totalImages} className="h-2" />
                                                <p className="text-xs text-muted-foreground">{pct}% complete</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completed">
                    {completedTasks.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted flex items-center justify-center">
                                <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                No Completed Tasks Yet
                            </h3>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {completedTasks.map((task) => (
                                <Card
                                    key={task.id}
                                    className="group cursor-pointer hover:shadow-lg transition-all duration-300"
                                    onClick={() => openTask(task, true)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                                                {task.name}
                                            </CardTitle>
                                            <Badge className="bg-emerald-600 text-white border-0 text-xs">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Submitted
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground flex items-center gap-1.5">
                                                    <ImageIcon className="h-3.5 w-3.5" />
                                                    {task.totalImages} images
                                                </span>
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <Progress value={100} max={100} className="h-2" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}