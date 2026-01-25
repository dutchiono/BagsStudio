"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Default styles
import "@solana/wallet-adapter-react-ui/styles.css";


export default function MinimalWalletProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. Network: Devnet (Alignment with Cookbook for now, can switch to Mainnet later)
    const network = WalletAdapterNetwork.Devnet;

    // 2. RPC Endpoint – must be http(s) URL or we fall back to avoid runtime crashes.
    const endpoint = useMemo(() => {
        const raw = (typeof process.env.NEXT_PUBLIC_SOLANA_RPC_HOST === "string" && process.env.NEXT_PUBLIC_SOLANA_RPC_HOST.trim()) || "";
        if (raw && (raw.startsWith("http://") || raw.startsWith("https://"))) {
            return raw;
        }
        return clusterApiUrl(network);
    }, [network]);

    // 3. Wallets: Standard Standard (Empty array = Auto-Detect)
    const wallets = useMemo(
        () => [],
        [network]
    );

    const onError = React.useCallback((error: any) => {
        console.error("WALLET_STANDARD_ERROR:", error);
    }, []);

    return (
        <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
            <WalletProvider wallets={wallets} onError={onError} autoConnect>
                {/* @ts-expect-error: WalletModalProvider type definition mismatch with React 18 */}
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
