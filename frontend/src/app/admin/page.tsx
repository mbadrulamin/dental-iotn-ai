'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import type { Dataset, PerformanceMetrics, KappaResult } from '@/types';

export default function AdminPage() {
    const { user, isAuthenticated, checkAuth, logout } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<'datasets' | 'analytics' | 'users'>('datasets');
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
    const [kappa, setKappa] = useState<KappaResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newDatasetName, setNewDatasetName] = useState('');
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
        try {
            const [datasetsData, metricsData, kappaData] = await Promise.all([
                api.getDatasets(),
                api.getPerformanceMetrics().catch(() => []),
                api.getKappaResults().catch(() => []),
            ]);
            setDatasets(datasetsData);
            setMetrics(metricsData);
            setKappa(kappaData);
        } catch (err) {
            console.error('Failed to load data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateDataset = async () => {
        if (!newDatasetName.trim()) return;
        try {
            await api.createDataset(newDatasetName.trim());
            setNewDatasetName('');
            loadData();
        } catch (err) {
            console.error('Failed to create dataset', err);
        }
    };

    const handleUploadImages = async (files: FileList) => {
        if (!selectedDataset || !files.length) return;
        try {
            await api.uploadImages(selectedDataset, files);
            loadData();
        } catch (err) {
            console.error('Failed to upload', err);
        }
    };

    const handleExportCSV = async (type: 'validation' | 'sus' | 'metrics') => {
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
        } catch (err) {
            console.error('Export failed', err);
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

            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                {activeTab === 'datasets' && (
                    <div>
                        {/* Create Dataset */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Create New Dataset</h3>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Dataset name..."
                                    value={newDatasetName}
                                    onChange={(e) => setNewDatasetName(e.target.value)}
                                    style={{ flexGrow: 1 }}
                                />
                                <button onClick={handleCreateDataset} className="btn btn-primary">
                                    Create
                                </button>
                            </div>
                        </div>

                        {/* Dataset List */}
                        <div className="grid grid-cols-3 gap-4">
                            {datasets.map(dataset => (
                                <div key={dataset.id} className="card" style={{ padding: '1.5rem' }}>
                                    <h4>{dataset.name}</h4>
                                    <p className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>
                                        {dataset.image_count} images
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
                            <h3 style={{ marginBottom: '1rem' }}>Cohen's Kappa (Inter-rater Agreement)</h3>
                            {kappa.length === 0 ? (
                                <p className="text-muted">No kappa data available yet.</p>
                            ) : (
                                <div className="grid grid-cols-5 gap-3">
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
                        <p className="text-muted">
                            User management features will be available here.
                            This includes viewing all users, changing roles, and deactivating accounts.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
