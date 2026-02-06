'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { DiagnosticResponse, MeasurementInput } from '@/types';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';

export default function DiagnosticPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [imageType, setImageType] = useState<string>('frontal');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<DiagnosticResponse | null>(null);
    const [error, setError] = useState('');
    const { user, isAuthenticated, logout } = useAuthStore();

    // Measurement toggles
    const [showSegmentation, setShowSegmentation] = useState(true);
    const [measurements, setMeasurements] = useState<MeasurementInput>({
        overjet_mm: null,
        overbite_mm: null,
        displacement_mm: null,
        crossbite_displacement_mm: null,
        open_bite_mm: null,
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreview(URL.createObjectURL(file));
            setResult(null);
            setError('');
        }
    };

    const handleMeasurementChange = (field: keyof MeasurementInput, value: string) => {
        const numValue = value === '' ? null : parseFloat(value);
        setMeasurements(prev => ({ ...prev, [field]: numValue }));
    };

    const handleAnalyze = async () => {
        if (!selectedFile) return;

        setIsAnalyzing(true);
        setError('');

        try {
            const response = await api.analyzeDiagnostic(selectedFile, imageType, measurements);
            setResult(response);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const gradeColors: Record<number, string> = {
        1: '#d1fae5',
        2: '#dbeafe',
        3: '#fef3c7',
        4: '#fed7aa',
        5: '#fee2e2',
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
            {/* Header */}
            <header style={{
                background: 'var(--gray-900)',
                color: 'white',
                padding: '1rem 0',
            }}>
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Link href="/" style={{ color: 'white' }}>
                            <span style={{ fontSize: '1.5rem' }}>🦷</span>
                        </Link>
                        <span style={{ fontWeight: 600 }}>Diagnostic Tool</span>
                    </div>
                    <nav className="flex items-center gap-4">
                        {isAuthenticated && user ? (
                            <>
                                <span style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                                    {user.email}
                                </span>
                                <button
                                    onClick={() => {
                                        logout();
                                        router.push('/');
                                    }}
                                    className="btn"
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        padding: '0.5rem 1rem',
                                    }}
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link href="/login" style={{ color: 'white' }}>Login</Link>
                        )}
                    </nav>
                </div>
            </header>

            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Left Panel - Upload & Measurements */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Upload Dental Image</h2>

                        {/* File Upload */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--gray-300)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '2rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)',
                                marginBottom: '1.5rem',
                            }}
                        >
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="Preview"
                                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: 'var(--radius-md)' }}
                                />
                            ) : (
                                <>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                                    <p>Click to upload or drag and drop</p>
                                    <p className="text-sm text-muted">PNG, JPG, WebP up to 50MB</p>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />

                        {/* Image Type */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="label">Image Type</label>
                            <select
                                className="input"
                                value={imageType}
                                onChange={(e) => setImageType(e.target.value)}
                            >
                                <option value="frontal">Frontal View</option>
                                <option value="lateral">Lateral View</option>
                                <option value="occlusal">Occlusal View</option>
                            </select>
                        </div>

                        {/* Measurements */}
                        <h3 style={{ marginBottom: '1rem', marginTop: '2rem' }}>Clinical Measurements (mm)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label className="label">Overjet</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    className="input"
                                    placeholder="e.g., 5.5"
                                    onChange={(e) => handleMeasurementChange('overjet_mm', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Overbite</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    className="input"
                                    placeholder="e.g., 4.0"
                                    onChange={(e) => handleMeasurementChange('overbite_mm', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Displacement</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    className="input"
                                    placeholder="e.g., 2.5"
                                    onChange={(e) => handleMeasurementChange('displacement_mm', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Open Bite</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    className="input"
                                    placeholder="e.g., 3.0"
                                    onChange={(e) => handleMeasurementChange('open_bite_mm', e.target.value)}
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label className="label">Crossbite Displacement</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    className="input"
                                    placeholder="e.g., 1.5"
                                    onChange={(e) => handleMeasurementChange('crossbite_displacement_mm', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Analyze Button */}
                        <button
                            onClick={handleAnalyze}
                            disabled={!selectedFile || isAnalyzing}
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '2rem', padding: '1rem' }}
                        >
                            {isAnalyzing ? (
                                <span className="animate-pulse">🔄 Analyzing...</span>
                            ) : (
                                '🔬 Analyze Image'
                            )}
                        </button>

                        {error && (
                            <div style={{
                                marginTop: '1rem',
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '1rem',
                                borderRadius: 'var(--radius-md)',
                            }}>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Results */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Diagnostic Results</h2>

                        {!result ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '4rem 2rem',
                                color: 'var(--gray-400)',
                            }}>
                                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
                                <p>Upload an image and click Analyze to see results</p>
                            </div>
                        ) : (
                            <div className="animate-fadeIn">
                                {/* IOTN Grade */}
                                <div style={{
                                    background: gradeColors[result.iotn.grade],
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    marginBottom: '1.5rem',
                                }}>
                                    <div style={{ fontSize: '3rem', fontWeight: 700 }}>
                                        Grade {result.iotn.grade}
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                        {result.iotn.grade_description}
                                    </div>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                        {result.iotn.treatment_need}
                                    </div>
                                </div>

                                {/* Determining Factor */}
                                <div style={{
                                    background: 'var(--gray-100)',
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '1.5rem',
                                }}>
                                    <span className="text-sm text-muted">Determining Factor:</span>
                                    <p style={{ fontWeight: 500 }}>{result.iotn.determining_factor}</p>
                                </div>

                                {/* Classifications */}
                                <h3 style={{ marginBottom: '1rem' }}>AI Classification Results</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {result.classifications.map((cls) => (
                                        <div
                                            key={cls.model_name}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '0.75rem 1rem',
                                                background: cls.detected ? '#d1fae5' : 'var(--gray-100)',
                                                borderRadius: 'var(--radius-md)',
                                            }}
                                        >
                                            <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                                                {cls.model_name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`badge ${cls.detected ? 'badge-success' : 'badge-info'}`}>
                                                    {cls.detected ? 'Detected' : 'Not Detected'}
                                                </span>
                                                <span className="text-sm text-muted">
                                                    {(cls.confidence * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Segmentation Toggle */}
                                {result.segmentation?.mask_url && (
                                    <div style={{ marginTop: '1.5rem' }}>
                                        <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
                                            <h3>Segmentation Mask</h3>
                                            <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={showSegmentation}
                                                    onChange={(e) => setShowSegmentation(e.target.checked)}
                                                />
                                                <span className="text-sm">Show Overlay</span>
                                            </label>
                                        </div>
                                        {showSegmentation && (
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_API_URL}${result.segmentation.mask_url}`}
                                                alt="Segmentation mask"
                                                style={{
                                                    width: '100%',
                                                    borderRadius: 'var(--radius-md)',
                                                }}
                                            />
                                        )}
                                        <p className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>
                                            Teeth detected: {result.segmentation.tooth_count}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
