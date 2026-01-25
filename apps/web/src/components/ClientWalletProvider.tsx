"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
    WalletAdapterNetwork
} from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";

export default function ClientWalletProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. Network Determination
    // We default to Mainnet since that's where the "real" money/tokens are.
    const network = WalletAdapterNetwork.Mainnet;

    // 2. RPC Endpoint Strategy
    // Priority: Custom Env Var > Public Cluster API
    // Env must be a valid http(s) URL; otherwise we fall back to avoid "Endpoint URL must start with http:" crashes.
    const endpoint = useMemo(() => {
        const raw = (typeof process.env.NEXT_PUBLIC_SOLANA_RPC_HOST === "string" && process.env.NEXT_PUBLIC_SOLANA_RPC_HOST.trim()) || "";
        if (raw && (raw.startsWith("http://") || raw.startsWith("https://"))) {
            return raw;
        }
        return clusterApiUrl(network);
    }, [network]);

    // 3. Wallet Adapter Strategy
    // We use an empty array to enable the Standard Wallet Adapter protocol.
    // This automatically detects ALL installed wallets (Phantom, Solflare, Backpack, etc.)
    // without needing to manually instantiate adapters or bundle heavy dependencies.
    const wallets = useMemo(
        () => [],
        [network]
    );

    const onError = React.useCallback((error: any) => {
        console.error("BagsScan_WALLET_CRITICAL:", error);
    }, []);

    return (
        <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
            <WalletProvider wallets={wallets} onError={onError} autoConnect={false}>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider >
            </WalletProvider >
        </ConnectionProvider >
    );
}
