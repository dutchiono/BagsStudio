'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';

// Dynamically import Scanner to avoid SSR issues
const Scanner = dynamic(() => import('@/components/Scanner'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-screen text-green-500 font-mono">
            <div className="animate-pulse">Initializing Neural Link...</div>
        </div>
    ),
});

export default function ScannerClient() {
    const { connected } = useWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return <Scanner />;
}
