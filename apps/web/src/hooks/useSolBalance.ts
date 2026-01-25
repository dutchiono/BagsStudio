import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useRef } from 'react';

// Rate limit handling with exponential backoff
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const MAX_DELAY = 30000; // 30 seconds

// Minimum SOL requirements
const MIN_SOL_FOR_LAUNCH = 0.21; // 0.2 SOL for bags.fm + 0.01 SOL service fee
const DEPLOYMENT_FEE = 0.01; // Deployment fee
const MIN_SOL_FOR_DEPLOYMENT = 0.01; // Deployment fee + small buffer for tx fees

export function useSolBalance() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const retryCountRef = useRef(0);
    const lastFetchRef = useRef<number>(0);

    useEffect(() => {
        if (!publicKey) {
            setBalance(0);
            retryCountRef.current = 0;
            return;
        }

        const fetchBalance = async (retryCount = 0): Promise<void> => {
            // Rate limiting: Don't fetch if last fetch was less than 5 seconds ago (unless retry)
            const now = Date.now();
            if (retryCount === 0 && now - lastFetchRef.current < 5000) {
                return;
            }

            setLoading(true);
            try {
                const balanceLamports = await connection.getBalance(publicKey);
                const balanceSOL = balanceLamports / 1e9;
                setBalance(balanceSOL);

                // Reset retry count on success
                retryCountRef.current = 0;
                lastFetchRef.current = now;
            } catch (e: any) {
                // Check if it's a rate limit error (429)
                const isRateLimit = e?.message?.includes('429') ||
                                   e?.message?.includes('rate limit') ||
                                   e?.message?.includes('Too Many Requests') ||
                                   e?.code === -32429;

                if (isRateLimit && retryCount < MAX_RETRIES) {
                    // Exponential backoff: 1s, 2s, 4s, 8s...
                    const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCount), MAX_DELAY);
                    console.warn(`Rate limited. Retrying after ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);

                    setTimeout(() => {
                        fetchBalance(retryCount + 1);
                    }, delay);
                    return;
                }

                // Only log non-rate-limit errors or final failures
                if (!isRateLimit || retryCount >= MAX_RETRIES) {
                    console.error("Failed to fetch SOL balance", e);
                }

                // Don't reset balance on rate limit errors, keep last known value
                if (!isRateLimit) {
                    setBalance(0);
                }
            } finally {
                if (retryCount === 0) {
                    setLoading(false);
                }
            }
        };

        // Initial fetch
        fetchBalance();

        // Poll every 60s
        const interval = setInterval(() => {
            if (retryCountRef.current === 0) {
                fetchBalance();
            }
        }, 60000);

        return () => clearInterval(interval);

    }, [connection, publicKey]);

    return {
        balance,
        loading,
        hasEnoughForLaunch: balance >= MIN_SOL_FOR_LAUNCH,
        minRequiredForLaunch: MIN_SOL_FOR_LAUNCH,
        shortfallForLaunch: Math.max(0, MIN_SOL_FOR_LAUNCH - balance),
        hasEnoughForDeployment: balance >= MIN_SOL_FOR_DEPLOYMENT,
        deploymentFee: DEPLOYMENT_FEE,
        minRequiredForDeployment: MIN_SOL_FOR_DEPLOYMENT,
        shortfallForDeployment: Math.max(0, MIN_SOL_FOR_DEPLOYMENT - balance),
    };
}
