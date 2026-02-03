import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Dental IOTN AI Platform',
    description: 'AI-powered dental diagnostic platform with IOTN DHC grading',
    keywords: ['dental', 'IOTN', 'orthodontic', 'AI', 'diagnostic'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
