'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import type { Dataset, PerformanceMetrics, KappaResult } from '@/types';

interface UserItem {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
}

interface DatasetImage {
    id: string;
    filename: string;
    image_url: string;
    image_type: string | null;
    is_processed: boolean;
    uploaded_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AdminPage() {
    const { user, isAuthenticated, checkAuth, logout } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<'datasets' | 'analytics' | 'users' | 'sus'>('datasets');
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
    const [kappa, setKappa] = useState<KappaResult[]>([]);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Dataset form state
    const [newDatasetName, setNewDatasetName] = useState('');
    const [newDatasetDescription, setNewDatasetDescription] = useState('');
    const [selectedDataset, setSelectedDataset] = useState<string | null>(null);

    // Dataset detail view
    const [viewingDataset, setViewingDataset] = useState<Dataset | null>(null);
    const [datasetImages, setDatasetImages] = useState<DatasetImage[]>([]);
    const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // User management
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState('guest');

    // Add state for SUS questions
    const [susQuestions, setSusQuestions] = useState<Record<string, string>>({});
    const [editingSus, setEditingSus] = useState(false);

    // Add state for available experts (for the dropdown)
    const [experts, setExperts] = useState<any[]>([]);

    // Add state for selected experts (for the dropdown)
    const [selectedExperts, setSelectedExperts] = useState<string[]>([]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'admin') {
            loadData();
            loadExperts();
            loadSUSQuestions();
        }
    }, [isAuthenticated, user]);

    const loadData = async () => {
        setIsLoading(true);
        setError('');
        try {
            const [datasetsData, metricsData, kappaData] = await Promise.all([
                api.getDatasets().catch(() => []),
                api.getPerformanceMetrics().catch(() => []),
                api.getKappaResults().catch(() => []),
            ]);
            setDatasets(datasetsData);
            setMetrics(metricsData);
            setKappa(kappaData);
        } catch (err) {
            console.error('Failed to load data', err);
            setError('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                setUsers(await response.json());
            }
        } catch (err) {
            console.error('Failed to load users', err);
        }
    };

    const loadExperts = async () => {
        try {
            // You might need a GET /users endpoint or filter locally if you already have them
            // Assuming you load all users in users tab, let's just fetch users with role expert
            // Reusing the user list from the users tab logic or a new fetch
            const response = await fetch(`${API_URL}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const allUsers = await response.json();
                setExperts(allUsers.filter((u: any) => u.role === 'expert'));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadSUSQuestions = async () => {
        try {
            const qs = await api.getSUSQuestions();
            setSusQuestions(qs);
        } catch (err) {
            console.error(err);
        }
    };

    const loadDatasetImages = async (datasetId: string) => {
        try {
            const response = await fetch(`${API_URL}/api/admin/datasets/${datasetId}/images`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setDatasetImages(data.images || []);
            }
        } catch (err) {
            console.error('Failed to load images', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'users' && isAuthenticated && user?.role === 'admin') {
            loadUsers();
        }
    }, [activeTab, isAuthenticated, user]);


    const handleUpdateSUS = async () => {
        try {
            await api.updateSUSQuestions(susQuestions);
            setSuccess('SUS Questions updated!');
            setEditingSus(false);
        } catch (err) {
            setError('Failed to update SUS');
        }
    };

    const handleCreateDataset = async () => {
        if (!newDatasetName.trim()) return;
        setError('');
        setSuccess('');

        try {
            await api.createDataset(newDatasetName.trim(), newDatasetDescription.trim() || undefined, selectedExperts);
            setNewDatasetName('');
            setNewDatasetDescription('');
            setSuccess('Dataset created successfully!');
            loadData();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create dataset');
        }
    };

    const handleUploadImages = async (files: FileList) => {
        if (!selectedDataset || !files.length) return;
        setError('');
        setSuccess('');

        try {
            const result = await api.uploadImages(selectedDataset, files);
            setSuccess(`Uploaded ${result.uploaded} images successfully!`);
            loadData();
            if (viewingDataset) {
                loadDatasetImages(viewingDataset.id);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to upload images');
        }
    };

    const handleDeleteDataset = async (datasetId: string) => {
        if (!confirm('Are you sure you want to delete this dataset?')) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/datasets/${datasetId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                setSuccess('Dataset deleted');
                setViewingDataset(null);
                loadData();
            } else {
                setError('Failed to delete dataset');
            }
        } catch (err) {
            setError('Failed to delete dataset');
        }
    };

    const handleUpdateDataset = async () => {
        if (!editingDataset) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/datasets/${editingDataset.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: editName, description: editDescription }),
            });
            if (response.ok) {
                setSuccess('Dataset updated');
                setEditingDataset(null);
                loadData();
            } else {
                setError('Failed to update dataset');
            }
        } catch (err) {
            setError('Failed to update dataset');
        }
    };

    const handleDeleteImage = async (imageId: string) => {
        if (!confirm('Delete this image?')) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/images/${imageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                setSuccess('Image deleted');
                if (viewingDataset) {
                    loadDatasetImages(viewingDataset.id);
                    loadData();
                }
            } else {
                setError('Failed to delete image');
            }
        } catch (err) {
            setError('Failed to delete image');
        }
    };

    const handleExportCSV = async (type: 'validation' | 'sus') => {
        setError('');
        try {
            let blob: Blob;
            let filename: string;

            if (type === 'validation') {
                blob = await api.downloadValidationCSV();
                filename = 'validation_data.csv';
            } else {
                blob = await api.downloadSUSCSV();
                filename = 'sus_scores.csv';
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            setSuccess(`${filename} downloaded!`);
        } catch (err) {
            setError('Export failed');
        }
    };

    const handleAddUser = async () => {
        if (!newUserEmail || !newUserPassword) {
            setError('Email and password required');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: newUserEmail,
                    password: newUserPassword,
                    full_name: newUserName || undefined,
                    role: newUserRole,
                }),
            });
            if (response.ok) {
                setSuccess('User created');
                setShowAddUser(false);
                setNewUserEmail('');
                setNewUserPassword('');
                setNewUserName('');
                setNewUserRole('guest');
                loadUsers();
            } else {
                const data = await response.json();
                setError(data.detail || 'Failed to create user');
            }
        } catch (err) {
            setError('Failed to create user');
        }
    };

    const handleUpdateUserRole = async (userId: string, newRole: string) => {
        try {
            const response = await fetch(`${API_URL}/api/admin/users/${userId}/role?role=${newRole}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                setSuccess('Role updated');
                loadUsers();
            } else {
                setError('Failed to update role');
            }
        } catch (err) {
            setError('Failed to update role');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                setSuccess('User deleted');
                loadUsers();
            } else {
                setError('Failed to delete user');
            }
        } catch (err) {
            setError('Failed to delete user');
        }
    };


    if (!isAuthenticated || user?.role !== 'admin') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                    <h2>Admin Access Required</h2>
                    <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Only administrators can access this panel.</p>
                    <Link href="/login" className="btn btn-primary">Login</Link>
                </div>
            </div>
        );
    }

    // Dataset detail view
    if (viewingDataset) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--gray-100)' }}>
                <header style={{ background: 'var(--gray-900)', color: 'white', padding: '1rem 0' }}>
                    <div className="container flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setViewingDataset(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                                ← Back
                            </button>
                            <span style={{ fontWeight: 600 }}>Dataset: {viewingDataset.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setSelectedDataset(viewingDataset.id); fileInputRef.current?.click(); }}
                                className="btn btn-primary"
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                Upload Images
                            </button>
                            <button
                                onClick={() => { setEditingDataset(viewingDataset); setEditName(viewingDataset.name); setEditDescription(viewingDataset.description || ''); }}
                                className="btn btn-secondary"
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => handleDeleteDataset(viewingDataset.id)}
                                className="btn"
                                style={{ padding: '0.5rem 1rem', background: '#991b1b', color: 'white' }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </header>

                {(error || success) && (
                    <div className="container" style={{ padding: '1rem 1.5rem 0' }}>
                        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '0.5rem' }}>{error}</div>}
                        {success && <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px' }}>{success}</div>}
                    </div>
                )}

                <main className="container" style={{ padding: '2rem 1.5rem' }}>
                    {viewingDataset.description && (
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>{viewingDataset.description}</p>
                    )}

                    <h3 style={{ marginBottom: '1rem' }}>Images ({datasetImages.length})</h3>

                    {datasetImages.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <p className="text-muted">No images in this dataset. Upload some above.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                            {datasetImages.map(img => (
                                <div key={img.id} className="card" style={{ padding: '0.5rem', position: 'relative' }}>
                                    <img
                                        src={`${API_URL}${img.image_url}`}
                                        alt={img.filename}
                                        style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }}
                                    />
                                    <div style={{ padding: '0.5rem' }}>
                                        <p style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {img.filename}
                                        </p>
                                        <p className="text-muted" style={{ fontSize: '0.7rem' }}>
                                            {img.image_type || 'Unknown type'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteImage(img.id)}
                                        style={{
                                            position: 'absolute', top: '0.75rem', right: '0.75rem',
                                            background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                                            width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => e.target.files && handleUploadImages(e.target.files)}
                    style={{ display: 'none' }}
                />

                {/* Edit Dataset Modal */}
                {editingDataset && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div className="card" style={{ padding: '2rem', width: '400px' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Edit Dataset</h3>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Name</label>
                                <input type="text" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="label">Description</label>
                                <textarea className="input" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleUpdateDataset} className="btn btn-primary" style={{ flex: 1 }}>Save</button>
                                <button onClick={() => setEditingDataset(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-100)' }}>
            {/* Header */}
            <header style={{ background: 'var(--gray-900)', color: 'white', padding: '1rem 0' }}>
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/" style={{ color: 'white' }}>
                            <span style={{ fontSize: '1.5rem' }}>🦷</span>
                        </Link>
                        <span style={{ fontWeight: 600 }}>Admin Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="badge badge-warning">Admin</span>
                        <button onClick={logout} className="btn" style={{ background: 'transparent', color: 'var(--gray-400)', border: 'none', padding: '0.5rem 1rem' }}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)' }}>
                <div className="container flex gap-1" style={{ padding: '0 1.5rem' }}>
                    {[
                        { id: 'datasets', label: '📁 Datasets' },
                        { id: 'analytics', label: '📊 Analytics' },
                        { id: 'users', label: '👥 Users' },
                        { id: 'sus', label: '📝 SUS Settings' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className="btn"
                            style={{
                                background: activeTab === tab.id ? 'var(--primary-50)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--primary-700)' : 'var(--gray-600)',
                                border: 'none', borderRadius: 0,
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary-500)' : '2px solid transparent',
                                padding: '1rem 1.5rem',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages */}
            {(error || success) && (
                <div className="container" style={{ padding: '1rem 1.5rem 0' }}>
                    {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '0.5rem' }}>{error}</div>}
                    {success && <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px' }}>{success}</div>}
                </div>
            )}

            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                {/* DATASETS TAB */}
                {activeTab === 'datasets' && (
                    <div>
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Create New Dataset</h3>
                            <div className="flex gap-3">
                                <input type="text" className="input" placeholder="Dataset name..." value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} style={{ flex: 1 }} />
                                <input type="text" className="input" placeholder="Description (optional)..." value={newDatasetDescription} onChange={(e) => setNewDatasetDescription(e.target.value)} style={{ flex: 2 }} />
                                <button onClick={handleCreateDataset} className="btn btn-primary">Create</button>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Assign Experts</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                                    {experts.length === 0 && <p className="text-sm text-muted">No experts found.</p>}
                                    {experts.map(expert => (
                                        <label key={expert.id} style={{ display: 'block', marginBottom: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedExperts.includes(expert.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedExperts([...selectedExperts, expert.id]);
                                                    } else {
                                                        setSelectedExperts(selectedExperts.filter(id => id !== expert.id));
                                                    }
                                                }}
                                                style={{ marginRight: '0.5rem' }}
                                            />
                                            {expert.email} {expert.full_name && `(${expert.full_name})`}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
                        ) : datasets.length === 0 ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                                <p className="text-muted">No datasets yet. Create one above.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                {datasets.map(dataset => (
                                    <div key={dataset.id} className="card" style={{ padding: '1.5rem' }}>
                                        <h4>{dataset.name}</h4>
                                        {dataset.description && <p className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>{dataset.description}</p>}
                                        <p className="text-sm" style={{ marginTop: '0.5rem', fontWeight: 500 }}>📷 {dataset.image_count} images</p>
                                        <div className="flex gap-2" style={{ marginTop: '1rem' }}>
                                            <button
                                                onClick={() => { setViewingDataset(dataset); loadDatasetImages(dataset.id); }}
                                                className="btn btn-primary"
                                                style={{ flex: 1, padding: '0.5rem' }}
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => { setSelectedDataset(dataset.id); fileInputRef.current?.click(); }}
                                                className="btn btn-secondary"
                                                style={{ flex: 1, padding: '0.5rem' }}
                                            >
                                                Upload
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => e.target.files && handleUploadImages(e.target.files)} style={{ display: 'none' }} />
                    </div>
                )}

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div>
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Export Data for SPSS</h3>
                            <div className="flex gap-3">
                                <button onClick={() => handleExportCSV('validation')} className="btn btn-primary">📥 Export Validation Data</button>
                                <button onClick={() => handleExportCSV('sus')} className="btn btn-secondary">📥 Export SUS Scores</button>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Performance Metrics</h3>
                            {metrics.length === 0 ? (
                                <p className="text-muted">No metrics yet.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--gray-100)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.75rem' }}>Condition</th>
                                            <th style={{ padding: '0.75rem' }}>Sensitivity</th>
                                            <th style={{ padding: '0.75rem' }}>Specificity</th>
                                            <th style={{ padding: '0.75rem' }}>Accuracy</th>
                                            <th style={{ padding: '0.75rem' }}>F1</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metrics.map(m => (
                                            <tr key={m.condition} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 500 }}>{m.condition}</td>
                                                <td style={{ padding: '0.75rem' }}>{(m.sensitivity * 100).toFixed(1)}%</td>
                                                <td style={{ padding: '0.75rem' }}>{(m.specificity * 100).toFixed(1)}%</td>
                                                <td style={{ padding: '0.75rem' }}>{(m.accuracy * 100).toFixed(1)}%</td>
                                                <td style={{ padding: '0.75rem' }}>{(m.f1_score * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Cohen&apos;s Kappa</h3>
                            {kappa.length === 0 ? (
                                <p className="text-muted">No kappa data yet.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                                    {kappa.map(k => (
                                        <div key={k.condition} style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 600 }}>{k.condition}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-600)' }}>{k.kappa.toFixed(3)}</div>
                                            <div className="text-sm text-muted">{k.interpretation}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div>
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <div className="flex justify-between items-center">
                                <h3>User Management</h3>
                                <button onClick={() => setShowAddUser(true)} className="btn btn-primary">+ Add User</button>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '1.5rem' }}>
                            {users.length === 0 ? (
                                <p className="text-muted">Loading users...</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--gray-100)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.75rem' }}>Email</th>
                                            <th style={{ padding: '0.75rem' }}>Name</th>
                                            <th style={{ padding: '0.75rem' }}>Role</th>
                                            <th style={{ padding: '0.75rem' }}>Status</th>
                                            <th style={{ padding: '0.75rem' }}>Joined</th>
                                            <th style={{ padding: '0.75rem' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                                <td style={{ padding: '0.75rem' }}>{u.email}</td>
                                                <td style={{ padding: '0.75rem' }}>{u.full_name || '-'}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <select
                                                        value={u.role}
                                                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                                        className="input"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', width: 'auto' }}
                                                        disabled={u.id === user?.id}
                                                    >
                                                        <option value="guest">Guest</option>
                                                        <option value="expert">Expert</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{ color: u.is_active ? 'var(--success)' : 'var(--gray-400)' }}>
                                                        {u.is_active ? '● Active' : '○ Inactive'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                    {new Date(u.created_at).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {u.id !== user?.id && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id)}
                                                            className="btn"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#991b1b', color: 'white' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Add User Modal */}
                        {showAddUser && (
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                                <div className="card" style={{ padding: '2rem', width: '400px' }}>
                                    <h3 style={{ marginBottom: '1rem' }}>Add New User</h3>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label className="label">Email *</label>
                                        <input type="email" className="input" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label className="label">Password *</label>
                                        <input type="password" className="input" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label className="label">Full Name</label>
                                        <input type="text" className="input" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                                    </div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label className="label">Role</label>
                                        <select className="input" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                                            <option value="guest">Guest</option>
                                            <option value="expert">Expert</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleAddUser} className="btn btn-primary" style={{ flex: 1 }}>Add User</button>
                                        <button onClick={() => setShowAddUser(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SUS TAB */}
                {activeTab === 'sus' && (
                    <div>
                        <div className="card" style={{ padding: '2rem' }}>
                            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                                <h3>System Usability Scale (SUS) Questions</h3>
                                <button onClick={() => setEditingSus(!editingSus)} className="btn btn-primary">
                                    {editingSus ? 'Cancel' : 'Edit Questions'}
                                </button>
                            </div>

                            {editingSus ? (
                                <div>
                                    {Object.entries(susQuestions || {}).sort().map(([key, value]) => (
                                        <div key={key} style={{ marginBottom: '1rem' }}>
                                            <label className="label" style={{ textTransform: 'uppercase', fontWeight: 700 }}>{key}</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={value}
                                                onChange={(e) => setSusQuestions(prev => ({ ...prev, [key]: e.target.value }))}
                                            />
                                        </div>
                                    ))}
                                    <div className="flex gap-2" style={{ marginTop: '1.5rem' }}>
                                        <button onClick={handleUpdateSUS} className="btn btn-success">Save Changes</button>
                                    </div>
                                </div>
                            ) : (
                                <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
                                    {Object.entries(susQuestions || {}).sort().map(([key, value]) => (
                                        <li key={key}><strong>{key}:</strong> {value}</li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
