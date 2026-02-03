'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import type { ImageForReview, AssessmentValue, ReviewProgress } from '@/types';

export default function ExpertReviewPage() {
    const router = useRouter();
    const { user, isAuthenticated, checkAuth } = useAuthStore();
    const [currentImage, setCurrentImage] = useState<ImageForReview | null>(null);
    const [progress, setProgress] = useState<ReviewProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [assessment, setAssessment] = useState({
        crossbite_present: 'no' as AssessmentValue,
        overbite_present: 'no' as AssessmentValue,
        openbite_present: 'no' as AssessmentValue,
        displacement_present: 'no' as AssessmentValue,
        overjet_present: 'no' as AssessmentValue,
        notes: '',
    });

    const loadNextImage = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            const [image, prog] = await Promise.all([
                api.getNextImage(),
                api.getReviewProgress(),
            ]);
            setCurrentImage(image);
            setProgress(prog);
            // Reset assessment for new image (Assumed Negative)
            setAssessment({
                crossbite_present: 'no',
                overbite_present: 'no',
                openbite_present: 'no',
                displacement_present: 'no',
                overjet_present: 'no',
                notes: '',
            });
        } catch (err) {
            setError('Failed to load image');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            await checkAuth();
        };
        init();
    }, [checkAuth]);

    useEffect(() => {
        if (isAuthenticated && user && (user.role === 'expert' || user.role === 'admin')) {
            loadNextImage();
        }
    }, [isAuthenticated, user, loadNextImage]);

    if (!isAuthenticated || (user?.role !== 'expert' && user?.role !== 'admin')) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--gray-50)',
            }}>
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h2>Expert Access Required</h2>
                    <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                        You need to be logged in as an expert to access this page.
                    </p>
                    <Link href="/login" className="btn btn-primary">Login</Link>
                </div>
            </div>
        );
    }

    const handleSubmit = async () => {
        if (!currentImage) return;

        setIsSubmitting(true);
        setError('');

        try {
            await api.submitAssessment({
                image_id: currentImage.id,
                ...assessment,
            });
            setSuccess('Assessment submitted successfully!');
            setTimeout(() => loadNextImage(), 1000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to submit assessment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const conditions = [
        { key: 'crossbite_present', label: 'Crossbite' },
        { key: 'overbite_present', label: 'Overbite' },
        { key: 'openbite_present', label: 'Openbite' },
        { key: 'displacement_present', label: 'Displacement' },
        { key: 'overjet_present', label: 'Overjet' },
    ] as const;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
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
                        <span style={{ fontWeight: 600 }}>Expert Blind Review</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {progress && (
                            <span className="text-sm">
                                {progress.reviewed}/{progress.total_images} reviewed ({progress.progress_percent}%)
                            </span>
                        )}
                        <span className="badge badge-success">{user?.email}</span>
                    </div>
                </div>
            </header>

            {/* Progress Bar */}
            {progress && (
                <div style={{
                    height: '4px',
                    background: 'var(--gray-200)',
                }}>
                    <div style={{
                        height: '100%',
                        width: `${progress.progress_percent}%`,
                        background: 'var(--accent-500)',
                        transition: 'width 0.3s ease',
                    }} />
                </div>
            )}

            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="animate-pulse" style={{ fontSize: '3rem' }}>⏳</div>
                        <p>Loading next image...</p>
                    </div>
                ) : !currentImage ? (
                    <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                        <h2>All Images Reviewed!</h2>
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                            You have completed reviewing all images in the validation set.
                        </p>
                        <Link href="/" className="btn btn-primary">Back to Home</Link>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                        {/* Image Panel */}
                        <div className="card" style={{ padding: '1rem' }}>
                            <img
                                src={`${process.env.NEXT_PUBLIC_API_URL}${currentImage.image_url}`}
                                alt="Dental image for review"
                                style={{
                                    width: '100%',
                                    maxHeight: '600px',
                                    objectFit: 'contain',
                                    borderRadius: 'var(--radius-md)',
                                }}
                            />
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-sm text-muted">
                                    Image Type: {currentImage.image_type || 'Unknown'}
                                </span>
                                <span className="text-sm text-muted">
                                    Dataset: {currentImage.dataset_name || 'General'}
                                </span>
                            </div>
                        </div>

                        {/* Assessment Panel */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>Expert Assessment</h3>

                            <p className="text-sm text-muted" style={{ marginBottom: '1.5rem' }}>
                                For each condition, indicate if it is present in the image.
                                Default is &quot;No&quot; (Assumed Negative).
                            </p>

                            {/* Condition Toggles */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {conditions.map(({ key, label }) => (
                                    <div
                                        key={key}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '1rem',
                                            background: 'var(--gray-50)',
                                            borderRadius: 'var(--radius-md)',
                                        }}
                                    >
                                        <span style={{ fontWeight: 500 }}>{label}</span>
                                        <div className="flex gap-2">
                                            {(['yes', 'no', 'na'] as AssessmentValue[]).map((value) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setAssessment(prev => ({ ...prev, [key]: value }))}
                                                    className="btn"
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        fontSize: '0.875rem',
                                                        background: assessment[key] === value
                                                            ? value === 'yes' ? 'var(--success)'
                                                                : value === 'no' ? 'var(--gray-400)'
                                                                    : 'var(--warning)'
                                                            : 'white',
                                                        color: assessment[key] === value ? 'white' : 'var(--gray-700)',
                                                        border: '1px solid var(--gray-300)',
                                                    }}
                                                >
                                                    {value.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Notes */}
                            <div style={{ marginTop: '1.5rem' }}>
                                <label className="label">Notes (Optional)</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Any additional observations..."
                                    value={assessment.notes}
                                    onChange={(e) => setAssessment(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>

                            {/* Messages */}
                            {error && (
                                <div style={{
                                    marginTop: '1rem',
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                }}>
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div style={{
                                    marginTop: '1rem',
                                    background: '#d1fae5',
                                    color: '#065f46',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                }}>
                                    {success}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '1.5rem', padding: '1rem' }}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit & Next →'}
                            </button>

                            <button
                                onClick={loadNextImage}
                                className="btn btn-secondary"
                                style={{ width: '100%', marginTop: '0.75rem' }}
                            >
                                Skip Image
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
