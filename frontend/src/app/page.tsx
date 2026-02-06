'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';

export default function HomePage() {
    const { user, isAuthenticated, checkAuth, logout } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Hero Section */}
            <header style={{
                background: 'var(--gradient-dark)',
                color: 'white',
                padding: '1rem 0',
            }}>
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span style={{ fontSize: '1.5rem' }}>🦷</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>Dental IOTN AI</span>
                    </div>
                    <nav className="flex items-center gap-4">
                        {isAuthenticated ? (
                            <>
                                <Link href="/diagnostic" className="btn btn-secondary" style={{ color: 'white', border: 'none', background: 'transparent' }}>
                                    Diagnostic Tool
                                </Link>
                                {(user?.role === 'expert' || user?.role === 'admin') && (
                                    <Link href="/expert" className="btn btn-secondary" style={{ color: 'white', border: 'none', background: 'transparent' }}>
                                        Expert Review
                                    </Link>
                                )}
                                {user?.role === 'admin' && (
                                    <Link href="/admin" className="btn btn-secondary" style={{ color: 'white', border: 'none', background: 'transparent' }}>
                                        Admin
                                    </Link>
                                )}
                                <span style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                                    {user?.email}
                                </span>
                                <button
                                    onClick={logout}
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
                            <>
                                <Link href="/login" className="btn btn-secondary" style={{ color: 'white', border: 'none', background: 'transparent' }}>
                                    Login
                                </Link>
                                <Link href="/register" className="btn btn-accent">
                                    Register
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {/* Hero Content */}
            <section style={{
                background: 'var(--gradient-primary)',
                padding: '6rem 0',
                textAlign: 'center',
                color: 'white',
            }}>
                <div className="container">
                    <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem', fontWeight: 700 }}>
                        AI-Powered Dental Diagnostic Platform
                    </h1>
                    <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '700px', margin: '0 auto 2rem' }}>
                        Get instant IOTN DHC grading powered by advanced AI models.
                        Upload dental images, input clinical measurements, and receive comprehensive diagnostic results.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link href="/diagnostic" className="btn" style={{
                            background: 'white',
                            color: 'var(--primary-700)',
                            padding: '1rem 2rem',
                            fontSize: '1.1rem',
                        }}>
                            Start Diagnostic →
                        </Link>
                        {!isAuthenticated && (
                            <Link href="/register" className="btn btn-secondary" style={{
                                background: 'transparent',
                                border: '2px solid white',
                                color: 'white',
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                            }}>
                                Create Account
                            </Link>
                        )}
                        {isAuthenticated && user?.role === 'admin' && (
                            <Link href="/admin" className="btn btn-secondary" style={{
                                background: 'transparent',
                                border: '2px solid white',
                                color: 'white',
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                            }}>
                                Admin Dashboard
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section style={{ padding: '5rem 0', background: 'var(--gray-50)' }}>
                <div className="container">
                    <h2 style={{ textAlign: 'center', marginBottom: '3rem' }}>Platform Features</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        <div className="card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔬</div>
                            <h3 style={{ marginBottom: '0.75rem' }}>AI Classification</h3>
                            <p className="text-muted">
                                5 specialized models detect Crossbite, Overbite, Openbite, Displacement, and Overjet.
                            </p>
                        </div>
                        <div className="card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📏</div>
                            <h3 style={{ marginBottom: '0.75rem' }}>IOTN DHC Grading</h3>
                            <p className="text-muted">
                                Accurate Grade 1-5 calculation based on clinical measurements and AI detection.
                            </p>
                        </div>
                        <div className="card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                            <h3 style={{ marginBottom: '0.75rem' }}>Teeth Segmentation</h3>
                            <p className="text-muted">
                                Precise segmentation of occlusal view images with interactive mask overlay.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* IOTN Grades Info */}
            <section style={{ padding: '5rem 0', background: 'white' }}>
                <div className="container">
                    <h2 style={{ textAlign: 'center', marginBottom: '3rem' }}>IOTN DHC Grades</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                        {[
                            { grade: 1, title: 'No Need', desc: 'Normal occlusion' },
                            { grade: 2, title: 'Little Need', desc: 'Minor irregularities' },
                            { grade: 3, title: 'Borderline', desc: 'Moderate problems' },
                            { grade: 4, title: 'Treatment Needed', desc: 'Health grounds' },
                            { grade: 5, title: 'Very Great Need', desc: 'Severe issues' },
                        ].map(({ grade, title, desc }) => (
                            <div key={grade} className={`card grade-${grade}`} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>Grade {grade}</div>
                                <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>{title}</div>
                                <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                background: 'var(--gray-900)',
                color: 'var(--gray-400)',
                padding: '2rem 0',
                textAlign: 'center',
            }}>
                <div className="container">
                    <p>© 2024 Dental IOTN AI Platform - Research & Diagnostic Tool</p>
                </div>
            </footer>
        </div>
    );
}
