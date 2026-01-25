import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useState, useRef } from 'react';

// BAGS Token CA
const BAGS_TOKEN_MINT = new PublicKey('ByDynkVWNYENQNYcZsrDMWEPSS2ZxYM922sPyaxsBAGS');

// Rate limit handling with exponential backoff
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const MAX_DELAY = 30000; // 30 seconds

export function useTokenBalance() {
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
                // Get Token Accounts for this mint
                const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    mint: BAGS_TOKEN_MINT
                });

                if (response.value.length > 0) {
                    // Sum up balance (decimals handled by uiAmount)
                    const total = response.value.reduce((acc, account) => {
                        return acc + (account.account.data.parsed.info.tokenAmount.uiAmount || 0);
                    }, 0);
                    setBalance(total);
                } else {
                    setBalance(0);
                }

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
                    console.error("Failed to fetch token balance", e);
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

        // Poll every 60s (reduced from 30s to reduce rate limit issues)
        const interval = setInterval(() => {
            if (retryCountRef.current === 0) {
                fetchBalance();
            }
        }, 60000);

        return () => clearInterval(interval);

    }, [connection, publicKey]);

    return { balance, loading, hasAccess: balance > 0 };
}
