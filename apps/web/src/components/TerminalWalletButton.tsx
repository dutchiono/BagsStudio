"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";

export function TerminalWalletButton() {
    // Handling hydration mismatch
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="h-10 w-32 bg-primary/10 animate-pulse" />;
    }

    return (
        <div className="terminal-wallet-wrapper">
            <WalletMultiButton style={{
                backgroundColor: 'black',
                color: '#00ff41',
                border: '1px solid #00ff41',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                maxWidth: '100%',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis'
            }} />
        </div>
    );
}
