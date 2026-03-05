"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2, Plus, Settings, FileText, BarChart3, Users, ArrowLeft, Upload, CheckCircle, UserPlus, Shield, Activity, Loader2, CheckCircle2, XCircle } from "lucide-react"
import Swal from "sweetalert2"

export default function AdminPage() {
    const { user, isAuthenticated, checkAuth } = useAuthStore()

    // Navigation & Data
    const [activeTab, setActiveTab] = useState<"datasets" | "analytics" | "users" | "sus">("datasets")
    const [datasets, setDatasets] = useState<any[]>([])
    const [metrics, setMetrics] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [expertUsers, setExpertUsers] = useState<any[]>([]) // For assignment
    const [isLoading, setIsLoading] = useState(false)

    // Dataset State
    const [viewingDataset, setViewingDataset] = useState<any>(null) // Object if viewing details
    const [datasetImages, setDatasetImages] = useState<any[]>([])
    const [editDatasetModal, setEditDatasetModal] = useState(false)
    const [editName, setEditName] = useState("")
    const [editDesc, setEditDesc] = useState("")

    // Assignment State
    const [assignModal, setAssignModal] = useState(false)
    const [selectedExperts, setSelectedExperts] = useState<string[]>([])

    // User Management State
    const [showAddUser, setShowAddUser] = useState(false)
    const [newUserEmail, setNewUserEmail] = useState("")
    const [newUserPassword, setNewUserPassword] = useState("")
    const [newUserName, setNewUserName] = useState("")
    const [newUserRole, setNewUserRole] = useState("guest")

    // SUS State
    const [susQuestions, setSusQuestions] = useState<Record<string, string>>({})

    // Analytics State
    const [analyticsDatasetId, setAnalyticsDatasetId] = useState<string | null>(null)
    const [comparisonData, setComparisonData] = useState<any[]>([])
    const [loadingComparison, setLoadingComparison] = useState(false)

    // const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "" //empty string for automatic relative path (Nginx will catch)

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    const loadData = async () => {
        setIsLoading(true)
        try {
            const [datasetsData, metricsData, usersData] = await Promise.all([
                api.getDatasets().catch(() => []),
                api.getPerformanceMetrics().catch(() => []),
                fetch(`${API_URL}/api/admin/users`, {
                    headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
                }).then(res => res.json()).catch(() => []),
            ])
            setDatasets(datasetsData)
            setMetrics(metricsData)
            setUsers(usersData)

            // Filter experts
            setExpertUsers(usersData.filter((u: any) => u.role === 'expert'))

            try {
                const qs = await api.getSUSQuestions()
                setSusQuestions(qs)
            } catch (e) { console.error(e) }
        } catch (err: any) {
            Swal.fire('Error', 'Failed to load data', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthenticated && user?.role === "admin") {
            loadData()
        }
    }, [isAuthenticated, user])

    // --- DATASET ACTIONS ---

    const handleCreateDataset = async () => {
        const { value: name } = await Swal.fire({
            title: 'Create Dataset',
            input: 'text',
            inputLabel: 'Dataset Name',
            inputPlaceholder: 'Enter name',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'You need to write something!'
                return null
            }
        })

        if (name) {
            try {
                await api.createDataset(name, "")
                Swal.fire('Success', 'Dataset created', 'success')
                loadData()
            } catch (err: any) {
                Swal.fire('Error', err.response?.data?.detail || 'Failed', 'error')
            }
        }
    }

    const openDataset = async (dataset: any) => {
        setViewingDataset(dataset)
        setEditName(dataset.name)
        setEditDesc(dataset.description || "")

        // Fetch Images
        try {
            const res = await fetch(`${API_URL}/api/admin/datasets/${dataset.id}/images`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
            })
            if (res.ok) {
                const data = await res.json()
                setDatasetImages(data.images || [])
            }
        } catch (err) {
            console.error("Failed to load images", err)
        }

        // NEW: Fetch Assigned Experts
        try {
            const expRes = await fetch(`${API_URL}/api/admin/datasets/${dataset.id}/experts`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
            })
            if (expRes.ok) {
                const assignedIds = await expRes.json()
                setSelectedExperts(assignedIds || [])
            }
        } catch (err) {
            console.error("Failed to load experts", err)
        }
    }

    const handleUpdateDataset = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/datasets/${viewingDataset.id}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: editName, description: editDesc }),
            })
            if (res.ok) {
                Swal.fire('Saved', 'Dataset updated', 'success')
                setEditDatasetModal(false)
                // Update local state to avoid reload
                setViewingDataset({ ...viewingDataset, name: editName, description: editDesc })
                loadData() // Refresh list
            } else {
                Swal.fire('Error', 'Update failed', 'error')
            }
        } catch (err) {
            Swal.fire('Error', 'Failed', 'error')
        }
    }

    const handleDeleteDataset = async () => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        })

        if (result.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/admin/datasets/${viewingDataset.id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
                })
                Swal.fire('Deleted!', 'Dataset has been deleted.', 'success')
                setViewingDataset(null)
                loadData()
            } catch (err) {
                Swal.fire('Error', 'Failed to delete', 'error')
            }
        }
    }


    const handleProcessDataset = async () => {
        const result = await Swal.fire({
            title: 'Run AI Analysis?',
            text: "This will run all 5 AI models on unprocessed images. It may take a while depending on your GPU.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Start Processing',
            confirmButtonColor: '#3085d6',
        })

        if (result.isConfirmed) {
            Swal.fire({
                title: 'Processing...',
                text: 'Please wait while the AI models analyze the images.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading()
                }
            });

            try {
                const res = await fetch(`${API_URL}/api/admin/datasets/${viewingDataset.id}/process`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
                })

                if (res.ok) {
                    const data = await res.json()
                    Swal.fire('Completed!', data.message, 'success')
                    loadData() // Reload stats and datasets
                    openDataset(viewingDataset) // Reload images to update status
                } else {
                    throw new Error("Failed")
                }
            } catch (err) {
                Swal.fire('Error', 'Processing failed. Check backend logs.', 'error')
            }
        }
    }

    const loadComparisonData = async (datasetId: string) => {
        setLoadingComparison(true)
        setComparisonData([])
        setAnalyticsDatasetId(datasetId)
        try {
            const res = await fetch(`${API_URL}/api/analytics/dataset-comparison/${datasetId}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
            })
            if (res.ok) {
                const data = await res.json()
                setComparisonData(data)
            }
        } catch (err) {
            Swal.fire('Error', 'Failed to load comparison data', 'error')
        } finally {
            setLoadingComparison(false)
        }
    }


    const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        try {
            await api.uploadImages(viewingDataset.id, e.target.files)
            Swal.fire('Uploaded', 'Images added successfully', 'success')
            openDataset(viewingDataset) // Reload images
            loadData() // Update counts
        } catch (err) {
            Swal.fire('Error', 'Upload failed', 'error')
        }
    }

    const handleDeleteImage = async (imageId: string) => {
        const result = await Swal.fire({
            title: 'Delete Image?',
            icon: 'question',
            showCancelButton: true,
        })

        if (result.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/admin/images/${imageId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
                })
                Swal.fire('Deleted', '', 'success')
                openDataset(viewingDataset) // Refresh
                loadData()
            } catch (err) {
                Swal.fire('Error', 'Failed', 'error')
            }
        }
    }

    // --- EXPERT ASSIGNMENT ACTIONS ---

    const openAssignModal = () => {
        setAssignModal(true)
    }

    const handleSaveAssignments = async () => {
        try {
            await fetch(`${API_URL}/api/admin/datasets/${viewingDataset.id}/experts`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ expert_ids: selectedExperts }),
            })
            Swal.fire('Success', 'Experts assigned', 'success')
            setAssignModal(false)
        } catch (err) {
            Swal.fire('Error', 'Assignment failed', 'error')
        }
    }

    // --- USER MANAGEMENT ACTIONS ---

    const handleAddUser = async () => {
        if (!newUserEmail || !newUserPassword) {
            Swal.fire('Validation', 'Email and password required', 'warning')
            return
        }
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: newUserEmail,
                    password: newUserPassword,
                    full_name: newUserName,
                    role: newUserRole,
                }),
            })
            if (res.ok) {
                Swal.fire('Success', 'User created', 'success')
                setShowAddUser(false)
                setNewUserEmail("")
                setNewUserPassword("")
                setNewUserName("")
                loadData()
            } else {
                const data = await res.json()
                Swal.fire('Error', data.detail || 'Failed', 'error')
            }
        } catch (err) {
            Swal.fire('Error', 'Failed', 'error')
        }
    }

    const handleDeleteUser = async (userId: string) => {
        const result = await Swal.fire({
            title: 'Delete User?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
        })

        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
                })
                if (res.ok) {
                    Swal.fire('Deleted', 'User removed', 'success')
                    loadData()
                } else {
                    Swal.fire('Error', 'Failed', 'error')
                }
            } catch (err) {
                Swal.fire('Error', 'Failed', 'error')
            }
        }
    }

    const handleUpdateUserRole = async (userId: string, newRole: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${userId}/role?role=${newRole}`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
            })
            if (!res.ok) throw new Error("Failed")
        } catch (err) {
            Swal.fire('Error', 'Could not update role', 'error')
        }
    }

    // --- RENDER ---

    if (!isAuthenticated || user?.role !== "admin") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Card>
                    <CardContent className="pt-6 text-center">
                        <h2 className="text-xl font-bold">Access Denied</h2>
                        <p className="text-muted-foreground">Admin access required.</p>
                        <Button asChild className="mt-4">
                            <a href="/login">Login</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Helper component to render condition badges consistently
    const ConditionBadge = ({ type, condition, value }: { type: 'ai' | 'expert', condition: string, value: string }) => {
        // Value is 'present'/'absent' for AI, 'yes'/'no' for Expert

        // AI Styling (Blue/Gray)
        if (type === 'ai') {
            if (value === 'present') {
                return <Badge variant="default" className="text-xs">{condition} (Yes)</Badge>
            } else {
                return <Badge variant="outline" className="text-xs border-gray-300 text-gray-500">{condition} (No)</Badge>
            }
        }

        // Expert Styling (Green/Gray)
        if (type === 'expert') {
            if (value === 'yes') {
                return <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">{condition} (Yes)</Badge>
            } else {
                return <Badge variant="secondary" className="text-xs">{condition} (No)</Badge>
            }
        }

        return <span className="text-xs text-muted-foreground">{condition} (N/A)</span>
    };

    return (
        <div className="container py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Manage datasets, users, and settings.</p>
                </div>
            </div>

            <Tabs defaultValue="datasets" onValueChange={(v) => {
                setActiveTab(v as any)
                setViewingDataset(null) // Reset detail view when switching tabs
            }}>
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                    <TabsTrigger value="datasets" className="flex gap-2">
                        <FileText className="h-4 w-4" /> Datasets
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex gap-2">
                        <BarChart3 className="h-4 w-4" /> Analytics
                    </TabsTrigger>
                    <TabsTrigger value="users" className="flex gap-2">
                        <Users className="h-4 w-4" /> Users
                    </TabsTrigger>
                    <TabsTrigger value="sus" className="flex gap-2">
                        <Settings className="h-4 w-4" /> SUS
                    </TabsTrigger>
                </TabsList>

                {/* --- DATASETS TAB --- */}
                <TabsContent value="datasets" className="space-y-6">
                    {!viewingDataset ? (
                        // LIST VIEW
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button onClick={handleCreateDataset}><Plus className="mr-2 h-4 w-4" /> Create Dataset</Button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {datasets.map((ds) => (
                                    <Card key={ds.id} className="hover:shadow-md transition-shadow">
                                        <CardHeader>
                                            <CardTitle className="text-lg truncate">{ds.name}</CardTitle>
                                            <CardDescription>{ds.image_count} images</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Button onClick={() => openDataset(ds)} className="w-full" variant="secondary">
                                                Manage
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // DETAIL VIEW - REDESIGNED
                        <div className="space-y-6">

                            {/* 1. Navigation Row */}
                            <div>
                                <Button variant="ghost" onClick={() => setViewingDataset(null)}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Datasets
                                </Button>
                            </div>

                            {/* 2. Header Card: Contains Info & Actions */}
                            <Card>
                                <CardHeader className="pb-4">
                                    <div className="flex flex-col gap-2">
                                        {/* Dataset Name & Description */}
                                        <div>
                                            <CardTitle className="text-3xl font-bold tracking-tight">{viewingDataset.name}</CardTitle>
                                            <CardDescription className="text-base mt-1">
                                                {viewingDataset.description || "No description provided for this dataset."}
                                            </CardDescription>
                                        </div>

                                        {/* Assigned Experts Section */}
                                        <div className="bg-muted/50 rounded-lg p-4 border border-muted">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Shield className="h-4 w-4 text-primary" />
                                                <span className="text-sm font-semibold text-foreground">Assigned Experts</span>
                                            </div>
                                            {selectedExperts.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedExperts.map((expertId) => {
                                                        const expert = expertUsers.find(u => u.id === expertId)
                                                        return expert ? (
                                                            <Badge key={expertId} variant="secondary" className="px-3 py-1">
                                                                {expert.email}
                                                            </Badge>
                                                        ) : null
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">No experts assigned yet.</p>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>

                                {/* 3. Action Bar (Card Footer) - Improved Alignment */}
                                <CardContent className="pt-0">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t pt-6">

                                        {/* Left Side: Management Actions */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Dialog open={editDatasetModal} onOpenChange={setEditDatasetModal}>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="default">
                                                        <span className="flex items-center gap-2">
                                                            <Settings className="h-4 w-4" /> Edit Details
                                                        </span>
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Edit Dataset</DialogTitle>
                                                        <DialogDescription>Update name and description.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4">
                                                        <div>
                                                            <Label>Dataset Name</Label>
                                                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Clinical Set A" />
                                                        </div>
                                                        <div>
                                                            <Label>Description</Label>
                                                            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Brief description..." />
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button onClick={handleUpdateDataset}>Save Changes</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog open={assignModal} onOpenChange={setAssignModal}>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="default">
                                                        <span className="flex items-center gap-2">
                                                            <UserPlus className="h-4 w-4" /> Assign Experts
                                                        </span>
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-lg">
                                                    <DialogHeader>
                                                        <DialogTitle>Assign Experts</DialogTitle>
                                                        <DialogDescription>Select experts who can review this dataset.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="max-h-60 overflow-y-auto space-y-2 py-4 border rounded-md p-2">
                                                        {expertUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No experts available in the system.</p>}
                                                        {expertUsers.map(exp => (
                                                            <label key={exp.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded cursor-pointer transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedExperts.includes(exp.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedExperts([...selectedExperts, exp.id])
                                                                        else setSelectedExperts(selectedExperts.filter(id => id !== exp.id))
                                                                    }}
                                                                    className="h-4 w-4"
                                                                />
                                                                <span className="text-sm font-medium">{exp.email}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <DialogFooter>
                                                        <Button onClick={handleSaveAssignments} className="w-full">Save Assignments</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            {/* Run AI Analysis Button */}
                                            <Button
                                                onClick={handleProcessDataset}
                                                className="bg-blue-600 hover:bg-blue-700"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Activity className="h-4 w-4" /> Run AI Analysis
                                                </span>
                                            </Button>
                                        </div>

                                        {/* Right Side: Data Operations */}
                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <input
                                                type="file"
                                                multiple
                                                id="file-upload"
                                                className="hidden"
                                                onChange={handleUploadImages}
                                            />
                                            <label htmlFor="file-upload" className="flex-1 md:flex-none">
                                                <Button asChild className="w-full md:w-auto">
                                                    <span className="flex items-center gap-2 cursor-pointer justify-center">
                                                        <Upload className="h-4 w-4" /> Upload Images
                                                    </span>
                                                </Button>
                                            </label>

                                            <Button variant="destructive" onClick={handleDeleteDataset} className="w-full md:w-auto">
                                                <span className="flex items-center gap-2">
                                                    <Trash2 className="h-4 w-4" /> Delete Dataset
                                                </span>
                                            </Button>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>

                            {/* 4. Images Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Dataset Images ({datasetImages.length})</CardTitle>
                                    <CardDescription>Manage images within this dataset.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {datasetImages.length === 0 ? (
                                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                            <p className="text-muted-foreground font-medium">No images uploaded yet.</p>
                                            <label htmlFor="file-upload-mobile" className="mt-4">
                                                <Button variant="link" asChild>
                                                    <span className="flex items-center gap-2 cursor-pointer">
                                                        <Upload className="h-4 w-4" /> Upload first image
                                                    </span>
                                                </Button>
                                            </label>
                                            {/* Hidden input to trigger the same file handler for the empty state button */}
                                            <input type="file" multiple id="file-upload-mobile" className="hidden" onChange={handleUploadImages} />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {datasetImages.map((img) => (
                                                <div key={img.id} className="relative group rounded-md overflow-hidden border bg-background">
                                                    <img
                                                        src={`${API_URL}${img.image_url}`}
                                                        alt="Dental"
                                                        className="w-full h-40 object-cover"
                                                    />

                                                    {/* Overlay Actions on Hover */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => handleDeleteImage(img.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="p-2 bg-background border-t">
                                                        <p className="text-xs text-center truncate font-medium" title={img.original_filename}>
                                                            {img.original_filename}
                                                        </p>
                                                        <p className="text-[10px] text-center text-muted-foreground">
                                                            {img.image_type || 'Unknown Type'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* --- ANALYTICS TAB --- */}
                <TabsContent value="analytics" className="space-y-6">
                    {/* Dataset Selector */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detailed Comparison</CardTitle>
                            <CardDescription>Select a dataset to view image-by-image AI vs. Expert results for all 5 conditions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <Label htmlFor="analytics-dataset-select">Select Dataset:</Label>
                                <select
                                    id="analytics-dataset-select"
                                    className="flex h-10 w-full max-w-md items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={analyticsDatasetId || ""}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            loadComparisonData(e.target.value)
                                        } else {
                                            setComparisonData([])
                                            setAnalyticsDatasetId(null)
                                        }
                                    }}
                                >
                                    <option value="">-- Choose a dataset --</option>
                                    {datasets.map((ds) => (
                                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Detailed Comparison Table */}
                    {loadingComparison ? (
                        <div className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : comparisonData.length > 0 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Image-by-Image Analysis ({comparisonData.length} Images)</CardTitle>
                                <CardDescription>Full comparison: Overjet, Overbite, Crossbite, Displacement, Openbite.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[200px]">Image</TableHead>
                                                <TableHead>AI Analysis (5 Models)</TableHead>
                                                <TableHead>Expert Review</TableHead>
                                                <TableHead className="text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {comparisonData.map((item, idx) => {
                                                // 1. Calculate Status
                                                let statusIcon = <span className="text-xs text-muted-foreground">Pending</span>;
                                                let statusColor = "text-muted-foreground";

                                                if (item.expert_results && Object.keys(item.expert_results).length > 0) {
                                                    let matches = 0;
                                                    let total = 0;
                                                    const conditions = ['overjet', 'overbite', 'crossbite', 'displacement', 'openbite'];

                                                    conditions.forEach(cond => {
                                                        const aiVal = item.ai_results[cond]; // 'present' or 'absent'
                                                        const expVal = item.expert_results[cond]; // 'yes' or 'no'

                                                        if (aiVal && expVal) {
                                                            total++;
                                                            if ((aiVal === 'present' && expVal === 'yes') || (aiVal === 'absent' && expVal === 'no')) {
                                                                matches++;
                                                            }
                                                        }
                                                    });

                                                    if (total > 0) {
                                                        if (matches === total) {
                                                            statusIcon = <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />;
                                                            statusColor = "text-green-500";
                                                        } else if (matches === 0) {
                                                            statusIcon = <XCircle className="h-5 w-5 mx-auto text-red-500" />;
                                                            statusColor = "text-red-500";
                                                        } else {
                                                            statusIcon = <span className="text-xs font-bold text-orange-500">Partial</span>;
                                                            statusColor = "text-orange-500";
                                                        }
                                                    }
                                                }

                                                return (
                                                    <TableRow key={idx}>
                                                        {/* Image Column */}
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <img
                                                                    src={`${API_URL}${item.image_url}`}
                                                                    alt="thumb"
                                                                    className="w-10 h-10 rounded object-cover border"
                                                                />
                                                                <span className="truncate max-w-[120px]" title={item.filename}>{item.filename}</span>
                                                            </div>
                                                        </TableCell>

                                                        {/* AI Analysis Column (All 5 Conditions) */}
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                <ConditionBadge type="ai" condition="Overjet" value={item.ai_results.overjet} />
                                                                <ConditionBadge type="ai" condition="Overbite" value={item.ai_results.overbite} />
                                                                <ConditionBadge type="ai" condition="Crossbite" value={item.ai_results.crossbite} />
                                                                <ConditionBadge type="ai" condition="Displacement" value={item.ai_results.displacement} />
                                                                <ConditionBadge type="ai" condition="Openbite" value={item.ai_results.openbite} />
                                                            </div>
                                                        </TableCell>

                                                        {/* Expert Review Column (All 5 Conditions) */}
                                                        <TableCell>
                                                            {Object.keys(item.expert_results).length > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    <ConditionBadge type="expert" condition="Overjet" value={item.expert_results.overjet} />
                                                                    <ConditionBadge type="expert" condition="Overbite" value={item.expert_results.overbite} />
                                                                    <ConditionBadge type="expert" condition="Crossbite" value={item.expert_results.crossbite} />
                                                                    <ConditionBadge type="expert" condition="Displacement" value={item.expert_results.displacement} />
                                                                    <ConditionBadge type="expert" condition="Openbite" value={item.expert_results.openbite} />
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">No Review</span>
                                                            )}
                                                        </TableCell>

                                                        {/* Status Column */}
                                                        <TableCell className="text-center">
                                                            <div className={statusColor}>{statusIcon}</div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg">
                            Select a dataset above to view detailed comparison.
                        </div>
                    )}

                    {/* Aggregate Metrics */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Overall Performance Metrics</CardTitle>
                            <CardDescription>Aggregated statistics across the entire system.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Condition</TableHead>
                                        <TableHead className="text-right">Sensitivity</TableHead>
                                        <TableHead className="text-right">Specificity</TableHead>
                                        <TableHead className="text-right">Accuracy</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.map((m) => (
                                        <TableRow key={m.condition}>
                                            <TableCell className="font-medium">{m.condition}</TableCell>
                                            <TableCell className="text-right">{(m.sensitivity * 100).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right">{(m.specificity * 100).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right">{(m.accuracy * 100).toFixed(1)}%</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- USERS TAB --- */}
                <TabsContent value="users" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>User Management</CardTitle>
                                <Button onClick={() => setShowAddUser(true)}><UserPlus className="mr-2 h-4 w-4" /> Add User</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {showAddUser && (
                                <div className="mb-6 p-4 border rounded-md bg-muted/50 space-y-4">
                                    <h4 className="font-semibold">Add New User</h4>
                                    <div className="grid gap-2">
                                        <div><Label>Email</Label><Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} /></div>
                                        <div><Label>Password</Label><Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} /></div>
                                        <div><Label>Full Name</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} /></div>
                                        <div>
                                            <Label>Role</Label>
                                            <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                                                <option value="guest">Guest</option>
                                                <option value="expert">Expert</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={handleAddUser}>Save</Button>
                                            <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u) => (
                                        <TableRow key={u.id}>
                                            <TableCell>{u.email}</TableCell>
                                            <TableCell><Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
                                            <TableCell>{u.is_active ? "Active" : "Inactive"}</TableCell>
                                            <TableCell className="text-right">
                                                <select className="h-8 rounded border bg-background px-2 text-xs" value={u.role} onChange={(e) => handleUpdateUserRole(u.id, e.target.value)} disabled={u.id === user.id}>
                                                    <option value="guest">Guest</option>
                                                    <option value="expert">Expert</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                                {u.id !== user.id && (
                                                    <Button variant="ghost" size="icon" className="ml-2 h-8 w-8 text-destructive" onClick={() => handleDeleteUser(u.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- SUS TAB --- */}
                <TabsContent value="sus" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>SUS Questions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Object.entries(susQuestions || {}).sort().map(([key, value]) => (
                                    <div key={key}>
                                        <Label className="text-sm font-medium mb-1 block uppercase text-muted-foreground">{key}</Label>
                                        <Input value={value} onChange={(e) => setSusQuestions(prev => ({ ...prev, [key]: e.target.value }))} />
                                    </div>
                                ))}
                                <Button onClick={async () => {
                                    await api.updateSUSQuestions(susQuestions)
                                    Swal.fire('Saved', 'Questions updated', 'success')
                                }}>Save Changes</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}