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

export default function AdminPage() {
    const { user, isAuthenticated, checkAuth, logout } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<'datasets' | 'analytics' | 'users'>('datasets');
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
    const [kappa, setKappa] = useState<KappaResult[]>([]);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newDatasetName, setNewDatasetName] = useState('');
    const [newDatasetDescription, setNewDatasetDescription] = useState('');
    const [selectedDataset, setSelectedDataset] = useState<string | null>(null);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'admin') {
            loadData();
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
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('Failed to load users', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'users' && isAuthenticated && user?.role === 'admin') {
            loadUsers();
        }
    }, [activeTab, isAuthenticated, user]);

    const handleCreateDataset = async () => {
        if (!newDatasetName.trim()) return;
        setError('');
        setSuccess('');

        try {
            await api.createDataset(newDatasetName.trim(), newDatasetDescription.trim() || undefined);
            setNewDatasetName('');
            setNewDatasetDescription('');
            setSuccess('Dataset created successfully!');
            loadData();
        } catch (err: any) {
            console.error('Failed to create dataset', err);
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
        } catch (err: any) {
            console.error('Failed to upload', err);
            setError(err.response?.data?.detail || 'Failed to upload images');
        }
    };

    const handleExportCSV = async (type: 'validation' | 'sus') => {
        setError('');
        try {
            let blob: Blob;
            let filename: string;

            switch (type) {
                case 'validation':
                    blob = await api.downloadValidationCSV();
                    filename = 'validation_data.csv';
                    break;
                case 'sus':
                    blob = await api.downloadSUSCSV();
                    filename = 'sus_scores.csv';
                    break;
                default:
                    return;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            setSuccess(`${filename} downloaded!`);
        } catch (err) {
            console.error('Export failed', err);
            setError('Export failed. Check if there is data to export.');
        }
    };

    const handleUpdateUserRole = async (userId: string, newRole: string) => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/admin/users/${userId}/role?role=${newRole}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    },
                }
            );
            if (response.ok) {
                setSuccess('User role updated!');
                loadUsers();
            } else {
                setError('Failed to update role');
            }
        } catch (err) {
            console.error('Failed to update role', err);
            setError('Failed to update role');
        }
    };

    if (!isAuthenticated || user?.role !== 'admin') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--gray-50)',
            }}>
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                    <h2>Admin Access Required</h2>
                    <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                        Only administrators can access this panel.
                    </p>
                    <Link href="/login" className="btn btn-primary">Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-100)' }}>
            {/* Header */}
            <header style={{
                background: 'var(--gray-900)',
                color: 'white',
                padding: '1rem 0',
            }}>
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/" style={{ color: 'white' }}>
                            <span style={{ fontSize: '1.5rem' }}>🦷</span>
                        </Link>
                        <span style={{ fontWeight: 600 }}>Admin Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="badge badge-warning">Admin</span>
                        <button onClick={logout} className="btn" style={{
                            background: 'transparent',
                            color: 'var(--gray-400)',
                            border: 'none',
                            padding: '0.5rem 1rem',
                        }}>
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
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className="btn"
                            style={{
                                background: activeTab === tab.id ? 'var(--primary-50)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--primary-700)' : 'var(--gray-600)',
                                border: 'none',
                                borderRadius: 0,
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
                    {error && (
                        <div style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '0.5rem',
                        }}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div style={{
                            background: '#d1fae5',
                            color: '#065f46',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            {success}
                        </div>
                    )}
                </div>
            )}

            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                {activeTab === 'datasets' && (
                    <div>
                        {/* Create Dataset */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Create New Dataset</h3>
                            <div className="flex gap-3" style={{ marginBottom: '0.75rem' }}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Dataset name..."
                                    value={newDatasetName}
                                    onChange={(e) => setNewDatasetName(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Description (optional)..."
                                    value={newDatasetDescription}
                                    onChange={(e) => setNewDatasetDescription(e.target.value)}
                                    style={{ flex: 2 }}
                                />
                                <button onClick={handleCreateDataset} className="btn btn-primary">
                                    Create
                                </button>
                            </div>
                        </div>

                        {/* Dataset List */}
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
                                        {dataset.description && (
                                            <p className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>
                                                {dataset.description}
                                            </p>
                                        )}
                                        <p className="text-sm" style={{ marginTop: '0.5rem', fontWeight: 500 }}>
                                            📷 {dataset.image_count} images
                                        </p>
                                        <div className="flex gap-2" style={{ marginTop: '1rem' }}>
                                            <button
                                                onClick={() => {
                                                    setSelectedDataset(dataset.id);
                                                    fileInputRef.current?.click();
                                                }}
                                                className="btn btn-secondary"
                                                style={{ flex: 1, padding: '0.5rem' }}
                                            >
                                                Upload Images
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => e.target.files && handleUploadImages(e.target.files)}
                            style={{ display: 'none' }}
                        />
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div>
                        {/* Export Buttons */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Export Data for SPSS</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleExportCSV('validation')}
                                    className="btn btn-primary"
                                >
                                    📥 Export Validation Data (CSV)
                                </button>
                                <button
                                    onClick={() => handleExportCSV('sus')}
                                    className="btn btn-secondary"
                                >
                                    📥 Export SUS Scores (CSV)
                                </button>
                            </div>
                        </div>

                        {/* Performance Metrics */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Performance Metrics (AI vs Expert)</h3>
                            {metrics.length === 0 ? (
                                <p className="text-muted">No metrics available yet. Complete some expert reviews first.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--gray-100)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.75rem' }}>Condition</th>
                                            <th style={{ padding: '0.75rem' }}>Sensitivity</th>
                                            <th style={{ padding: '0.75rem' }}>Specificity</th>
                                            <th style={{ padding: '0.75rem' }}>Accuracy</th>
                                            <th style={{ padding: '0.75rem' }}>F1 Score</th>
                                            <th style={{ padding: '0.75rem' }}>Samples</th>
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
                                                <td style={{ padding: '0.75rem' }}>{m.total_samples}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Cohen's Kappa */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Cohen&apos;s Kappa (Inter-rater Agreement)</h3>
                            {kappa.length === 0 ? (
                                <p className="text-muted">No kappa data available yet.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                                    {kappa.map(k => (
                                        <div key={k.condition} style={{
                                            background: 'var(--gray-50)',
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-md)',
                                            textAlign: 'center',
                                        }}>
                                            <div style={{ fontWeight: 600 }}>{k.condition}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-600)' }}>
                                                {k.kappa.toFixed(3)}
                                            </div>
                                            <div className="text-sm text-muted">{k.interpretation}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>User Management</h3>
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
                                                <span className={`badge ${u.role === 'admin' ? 'badge-warning' :
                                                        u.role === 'expert' ? 'badge-success' : 'badge-info'
                                                    }`}>
                                                    {u.role}
                                                </span>
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
                                                <select
                                                    value={u.role}
                                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                                    className="input"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                                    disabled={u.id === user?.id}
                                                >
                                                    <option value="guest">Guest</option>
                                                    <option value="expert">Expert</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
