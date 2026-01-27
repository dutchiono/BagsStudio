'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const Scanner = dynamic(() => import('@/components/Scanner'), {
    ssr: false,
});

export default function ScannerPage() {
    return (
        <div className="min-h-screen bg-black relative">
            {/* Navigation Layer */}
            <div className="absolute top-0 right-0 p-6 z-50 pointer-events-none">
                <Link
                    href="/"
                    className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-black border border-[#00ff00] text-[#00ff00] font-mono font-bold hover:bg-[#00ff00] hover:text-black transition-colors rounded-sm uppercase text-sm"
                >
                    <ArrowLeft size={16} />
                    Back to Studio
                </Link>
            </div>

            <Scanner />
        </div>
    );
}
