'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, Users, Clock, Zap, RefreshCw, Filter, ArrowUp, ArrowDown, ExternalLink, Lock, Wallet, Info } from 'lucide-react';
import clsx from 'clsx';
import { BagsToken } from '@bagsscan/shared';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

// Use relative URL in production, localhost in development
const API_URL = process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? '' // Use relative URLs in production, nginx routes /scanner/updates and /scanner/tokens correctly if they are under /api or if I adjust the nginx config.
            // Actually, if I map /api/scanner -> 3041, then I should set this to 'https://bagsstudio.xyz/api' or just '/api'
            // But wait, the existing API might expect /scanner/... at the root of 3041.
            // If I proxy /api/scanner -> 3041/scanner, that works.
            // If I proxy /api/scanner -> 3041/, that changes the path.
            // The safest is: Frontend requests /api/scanner/..., Nginx sends /api/scanner/... -> 3041/scanner/...
            ? '/api'
            : 'http://localhost:3041');
const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT || ''; // Set in .env if using token gating
const GATING_MINUTES = 10; // Token gate launches newer than 10 minutes
const SCANNER_FREE_ACCESS = true; // Scanner is free - no token gating

// Whitelisted wallets that bypass token gating
const WHITELISTED_WALLETS = [
    'BAGSibi8KiJDBK6Djxvpq9c1AzDzboLFpN7y5mSuTF4j',
    '3Qgq3XyJR7TeP6aFrrgqou14vkNg4uUUe4t53xnDS4sr',
    'CiNCMJwsKejTz6C5igVu1dUEAuQ3kFv3fe6DkpPtRW4P',
];

export default function Scanner() {
    const { publicKey, signMessage, connected } = useWallet();
    const [hasToken, setHasToken] = useState<boolean | null>(null); // null = checking, true/false = result
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [tokens, setTokens] = useState<BagsToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [sortField, setSortField] = useState<string>('age');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Filter states - defaults for non-token holders (older tokens only)
    const [isDefaultFilter, setIsDefaultFilter] = useState(true);
    const [minMcap, setMinMcap] = useState(3000); // Minimum 3k mcap
    const [maxMcap, setMaxMcap] = useState(100000000); // 100M default max

    // Logarithmic scale helpers for slider (0-100K takes up more space)
    const linearToLog = (value: number, min: number, max: number) => {
        // Map linear value to logarithmic position (0-100)
        const logMin = Math.log10(min + 1); // +1 to avoid log(0)
        const logMax = Math.log10(max + 1);
        const logValue = Math.log10(value + 1);
        return ((logValue - logMin) / (logMax - logMin)) * 100;
    };

    const logToLinear = (position: number, min: number, max: number) => {
        // Map slider position (0-100) back to linear value
        const logMin = Math.log10(min + 1);
        const logMax = Math.log10(max + 1);
        const logValue = logMin + (position / 100) * (logMax - logMin);
        return Math.round(Math.pow(10, logValue) - 1);
    };
    const [minHolders, setMinHolders] = useState(0);
    const [minMcapGrowth, setMinMcapGrowth] = useState(-100); // % change in market cap over 24h
    const [minHolderGrowth, setMinHolderGrowth] = useState(-100); // % change in holder count over 24h
    const [maxAgeHours, setMaxAgeHours] = useState(720);
    const [opportunities, setOpportunities] = useState<any[]>([]);
    const [loadingOpportunities, setLoadingOpportunities] = useState(false);
    const [buyingToken, setBuyingToken] = useState<string | null>(null);

    // Runner filter settings
    const [runnerMinMcapGrowth, setRunnerMinMcapGrowth] = useState(5); // % growth in 5m (default: 5%)
    const [runnerMinMcapGrowthEnabled, setRunnerMinMcapGrowthEnabled] = useState(true);
    const [runnerMinHolders, setRunnerMinHolders] = useState(20); // min holder count (default: 20)
    const [runnerMinHoldersEnabled, setRunnerMinHoldersEnabled] = useState(true);
    const [runnerMinVolume, setRunnerMinVolume] = useState(1000); // $ volume (default: $1K)
    const [runnerMinVolumeEnabled, setRunnerMinVolumeEnabled] = useState(true);
    const [runnerMinMcap, setRunnerMinMcap] = useState(3000); // min mcap (default: $3K)
    const [buyAmountSOL, setBuyAmountSOL] = useState(0.1); // SOL per trade (default: 0.1 SOL)
    const [tradingStatus, setTradingStatus] = useState<{ monitoring: boolean; enabled: boolean } | null>(null);


    const handleSync = async () => {
        setSyncing(true);
        try {
            await fetch(`${API_URL}/scanner/update-all`, { method: 'POST' });
            await fetchTokensWithFilters();
        } catch (error) {
            console.error('Failed to update:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedTokens = [...tokens].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        // Map frontend sort fields to backend fields
        if (sortField === 'mcap') {
            aVal = a.marketCap;
            bVal = b.marketCap;
        } else if (sortField === 'holders') {
            aVal = a.holderCount;
            bVal = b.holderCount;
        } else if (sortField === 'age') {
            aVal = a.createdAt;
            bVal = b.createdAt;
        } else if (sortField === 'mcapGrowth5m') {
            aVal = a.mcapGrowth5m || 0;
            bVal = b.mcapGrowth5m || 0;
        } else if (sortField === 'holderGrowth5m') {
            aVal = a.holderGrowth5m || 0;
            bVal = b.holderGrowth5m || 0;
        } else if (sortField === 'volume24h') {
            aVal = a.volume24h || 0;
            bVal = b.volume24h || 0;
        } else {
            aVal = a[sortField as keyof BagsToken];
            bVal = b[sortField as keyof BagsToken];
        }

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Fetch tokens function (with current filter values)
    const fetchTokensWithFilters = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                minMcap: minMcap.toString(),
                maxMcap: maxMcap.toString(),
                minHolders: minHolders.toString(),
                minMcapGrowth: minMcapGrowth.toString(),
                minHolderGrowth: minHolderGrowth.toString(),
                maxAgeHours: maxAgeHours.toString(),
            });

            const url = `${API_URL}/scanner/tokens?${params}`;
            console.log('[Scanner] Fetching tokens from:', url);

            const response = await fetch(url);
            console.log('[Scanner] Response status:', response.status, response.statusText);

            if (response.ok) {
                const data = await response.json();
                console.log('[Scanner] Received data:', {
                    success: data.success,
                    tokenCount: data.tokens?.length || 0,
                    count: data.count
                });
                setTokens(data.tokens || []);
            } else {
                const errorText = await response.text();
                console.error('[Scanner] Request failed:', response.status, errorText);
            }
        } catch (error) {
            console.error('[Scanner] Failed to fetch tokens:', error);
        } finally {
            setLoading(false);
        }
    }, [minMcap, maxMcap, minHolders, minMcapGrowth, minHolderGrowth, maxAgeHours, API_URL]);

    // WebSocket for live updates - only connect once, use ref for latest fetch function
    const fetchRef = useRef(fetchTokensWithFilters);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchRef.current = fetchTokensWithFilters;
    }, [fetchTokensWithFilters]);

    useEffect(() => {
        // Prevent duplicate connections
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
            return;
        }

        const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/scanner/updates';
        let isMounted = true;

        const connect = () => {
            if (!isMounted) return;

            // Close existing connection if any
            if (wsRef.current) {
                try {
                    wsRef.current.onclose = null;
                    wsRef.current.close();
                } catch (e) {
                    // Ignore errors
                }
                wsRef.current = null;
            }

            try {
                wsRef.current = new WebSocket(wsUrl);

                wsRef.current.onopen = () => {
                    if (isMounted) {
                        console.log('✅ Connected to scanner updates');
                    }
                };

                wsRef.current.onmessage = (event) => {
                    if (!isMounted) return;
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'new_token' || data.type === 'token_updated') {
                            // Use ref to get latest fetch function without causing re-renders
                            fetchRef.current();
                        }
                    } catch (error) {
                        console.error('Failed to parse WebSocket message:', error);
                    }
                };

                wsRef.current.onerror = (error) => {
                    if (isMounted) {
                        console.error('WebSocket error:', error);
                    }
                };

                wsRef.current.onclose = () => {
                    if (!isMounted) return;
                    console.log('❌ Scanner WebSocket disconnected, reconnecting in 5s...');
                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (isMounted && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
                            connect();
                        }
                    }, 5000);
                };
            } catch (error) {
                console.error('Failed to create WebSocket:', error);
            }
        };

        connect();

        return () => {
            isMounted = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect on cleanup
                try {
                    wsRef.current.close();
                } catch (e) {
                    // Ignore errors
                }
                wsRef.current = null;
            }
        };
    }, []); // Only run once on mount

    // Handle client-side mounting to prevent hydration errors
    useEffect(() => {
        setMounted(true);
    }, []);

    // Check if wallet has token or is whitelisted
    useEffect(() => {
        if (!connected || !publicKey) {
            setHasToken(false);
            setIsDefaultFilter(true);
            setMaxAgeHours(720); // 30 days for non-connected
            return;
        }

        const walletAddress = publicKey.toBase58();

        // Check if wallet is whitelisted (bypasses token requirement)
        const isWhitelisted = WHITELISTED_WALLETS.includes(walletAddress);
        if (isWhitelisted) {
            console.log('✅ Wallet is whitelisted - full access granted');
            setHasToken(true); // Treat whitelisted as having token
            setIsDefaultFilter(false);
            setMaxAgeHours(720); // Full range
            return;
        }

        // If no token mint configured, allow all
        if (!TOKEN_MINT) {
            setHasToken(true);
            setIsDefaultFilter(false);
            return;
        }

        // Check token balance
        const checkToken = async () => {
            try {
                const connection = new Connection(
                    process.env.NEXT_PUBLIC_SOLANA_RPC_HOST || 'https://mainnet.helius-rpc.com/?api-key=10f7605c-3004-4638-9562-b911c4714150',
                    'confirmed'
                );

                const tokenMintPubkey = new PublicKey(TOKEN_MINT);
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    mint: tokenMintPubkey,
                });

                const hasBalance = tokenAccounts.value.length > 0 &&
                    tokenAccounts.value.some(account =>
                        account.account.data.parsed.info.tokenAmount.uiAmount > 0
                    );

                setHasToken(hasBalance);
                setIsDefaultFilter(!hasBalance);

                // Set default filters if no token
                if (!hasBalance) {
                    setMaxAgeHours(720); // 30 days for non-token holders
                } else {
                    setMaxAgeHours(720); // Reset to full range
                }
            } catch (error) {
                console.error('Error checking token balance:', error);
                setHasToken(false);
                setIsDefaultFilter(true);
            }
        };

        checkToken();
    }, [connected, publicKey]);

    // Fetch tokens when filters change
    useEffect(() => {
        fetchTokensWithFilters();
    }, [fetchTokensWithFilters]);

    // Update age display every second
    useEffect(() => {
        const interval = setInterval(() => {
            // Force re-render to update age display by creating new array reference
            setTokens(prev => [...prev]);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
    };

    const formatPercent = (num: number) => {
        const formatted = num.toFixed(2);
        return num >= 0 ? `+${formatted}%` : `${formatted}%`;
    };

    const formatAge = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ${minutes % 60}m`;
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    };

    // Helper to check if token should be blurred (newer than 10 min and user doesn't have token)
    const shouldBlurToken = (token: BagsToken) => {
        // Scanner is free - no gating
        if (SCANNER_FREE_ACCESS) return false;
        if (hasToken) return false; // Token holders see everything
        const createdAt = token.createdAt || Date.now();
        const tokenAgeMinutes = (Date.now() - createdAt) / (1000 * 60);
        return tokenAgeMinutes < GATING_MINUTES;
    };

    // Calculate how many tokens are blurred
    const blurredCount = tokens.filter(t => shouldBlurToken(t)).length;

    // Fetch trading opportunities
    const fetchOpportunities = async () => {
        setLoadingOpportunities(true);
        try {
            const response = await fetch(`${API_URL}/trading/opportunities`);
            const data = await response.json();
            if (data.success) {
                setOpportunities(data.opportunities || []);
            }
        } catch (error) {
            console.error('Failed to fetch opportunities:', error);
        } finally {
            setLoadingOpportunities(false);
        }
    };

    // Manual buy button handler
    const handleManualBuy = async (opportunity: any) => {
        if (buyingToken) return; // Prevent double-clicks
        setBuyingToken(opportunity.mintAddress);
        try {
            const response = await fetch(`${API_URL}/trading/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mintAddress: opportunity.mintAddress,
                    tokenName: opportunity.name,
                    tokenSymbol: opportunity.symbol,
                }),
            });
            const data = await response.json();
            if (data.success) {
                alert(`✅ Buy executed! Transaction: ${data.signature}\nView on Solscan: https://solscan.io/tx/${data.signature}`);
                // Refresh opportunities
                fetchOpportunities();
            } else {
                alert(`❌ Buy failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error: any) {
            alert(`❌ Buy failed: ${error.message}`);
        } finally {
            setBuyingToken(null);
        }
    };

    // Fetch opportunities on mount and set interval
    useEffect(() => {
        fetchOpportunities();
        const interval = setInterval(fetchOpportunities, 30000);
        return () => clearInterval(interval);
    }, []);

    // Fetch trading status
    const fetchTradingStatus = async () => {
        try {
            const response = await fetch(`${API_URL}/trading/status`);
            const data = await response.json();
            if (data.success) {
                setTradingStatus({
                    monitoring: data.monitoring,
                    enabled: data.enabled,
                });
                // Update runner filter settings from config
                if (data.config) {
                    setRunnerMinMcapGrowth(data.config.minMcapGrowth || 20);
                    setRunnerMinMcapGrowthEnabled(data.config.minMcapGrowthEnabled !== undefined ? data.config.minMcapGrowthEnabled : true);
                    setRunnerMinHolders(data.config.minHolders || 20);
                    setRunnerMinHoldersEnabled(data.config.minHoldersEnabled !== undefined ? data.config.minHoldersEnabled : true);
                    setRunnerMinVolume(data.config.minVolume || 1000);
                    setRunnerMinVolumeEnabled(data.config.minVolumeEnabled !== undefined ? data.config.minVolumeEnabled : true);
                    setRunnerMinMcap(data.config.minMcap || 3000);
                    setBuyAmountSOL(data.config.buyAmountSOL || 0.1);
                }
            }
        } catch (error) {
            console.error('Failed to fetch trading status:', error);
        }
    };

    // Update runner filter config
    const updateRunnerConfig = async () => {
        try {
            const response = await fetch(`${API_URL}/trading/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    minMcapGrowth: runnerMinMcapGrowthEnabled ? runnerMinMcapGrowth : null,
                    minMcapGrowthEnabled: runnerMinMcapGrowthEnabled,
                    minHolders: runnerMinHoldersEnabled ? runnerMinHolders : null,
                    minHoldersEnabled: runnerMinHoldersEnabled,
                    minVolume: runnerMinVolumeEnabled ? runnerMinVolume : null,
                    minVolumeEnabled: runnerMinVolumeEnabled,
                    minMcap: runnerMinMcap,
                    buyAmountSOL: buyAmountSOL,
                }),
            });
            const data = await response.json();
            if (data.success) {
                alert('✅ Runner filters updated!');
                fetchOpportunities(); // Refresh opportunities with new filters
            } else {
                alert(`❌ Failed to update: ${data.error || 'Unknown error'}`);
            }
        } catch (error: any) {
            alert(`❌ Failed to update: ${error.message}`);
        }
    };

    // Fetch trading status on mount
    useEffect(() => {
        fetchTradingStatus();
    }, []);

    return <div className="min-h-screen bg-black text-green-400 font-mono selection:bg-green-400 selection:text-black">

        {/* Header (Unified with Studio) */}
        <header className="fixed top-0 left-0 right-0 h-16 bg-black border-b-2 border-green-400 z-50 flex items-center justify-between px-6">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <Zap className="w-6 h-6 text-green-400" fill="currentColor" />
                    <h1 className="text-xl font-bold tracking-wider">BAGS.FM SCANNER</h1>
                </div>

                <nav className="flex items-center gap-1">
                    <div className="flex items-center border border-green-400 rounded-sm overflow-hidden">
                        <a
                            href="/"
                            className="px-4 py-1.5 bg-black text-green-400 hover:bg-green-400/10 font-medium text-xs uppercase transition-colors"
                        >
                            Studio
                        </a>
                        <button className="px-4 py-1.5 bg-green-400 text-black font-bold text-xs uppercase">
                            Scanner
                        </button>
                    </div>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 border border-green-400 rounded-sm text-xs transition-colors uppercase hover:bg-green-400 hover:text-black',
                            syncing && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        <RefreshCw className={clsx('w-3 h-3', syncing && 'animate-spin')} />
                        {syncing ? 'SYNCING...' : 'SYNC'}
                    </button>
                </div>

                {mounted ? (
                    <WalletMultiButton className="!bg-purple-700 hover:!bg-purple-600 !h-9 !rounded-sm !font-mono !uppercase !text-xs" />
                ) : (
                    <div className="h-9 w-32 bg-black border border-green-400 animate-pulse rounded-sm" />
                )}
            </div>
        </header>

        <div className="pt-24 px-6 pb-12 max-w-[1600px] mx-auto">
            {/* Token Gating Message - Only show if scanner is NOT free */}
            {!SCANNER_FREE_ACCESS && (
                <div className="border-2 border-green-400 p-6 mb-8 relative">
                    <div className="absolute -top-3 left-4 bg-black px-2 text-green-400 font-bold flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        TOKEN GATED ACCESS
                    </div>
                    {/* Token Gating Message Content */}
                    <div className="flex items-center justify-between">
                        <div className="text-sm opacity-90 leading-relaxed">
                            Launches newer than <span className="text-yellow-400 font-bold">{GATING_MINUTES} minutes</span> are token-gated.
                            Connect a wallet holding the project token to see all launches in real-time.
                        </div>
                        {/* Control Panel / Auto Update Info was here, moved to header or simplified */}
                        <div className="relative group">
                            <Info className="w-4 h-4 text-green-400 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-black border-2 border-green-400 text-xs text-green-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                <div className="font-bold mb-1">AUTO-UPDATE INFO</div>
                                <div>Tokens are automatically updated every 30 seconds. SYNC button triggers manual refresh.</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanner Info Banner - Show when scanner is free */}
            {SCANNER_FREE_ACCESS && (
                <div className="border-2 border-green-400 p-4 mb-8 bg-black bg-opacity-30">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-green-400">
                            <span className="font-bold">✓ FREE ACCESS:</span> All token launches are visible in real-time. No token required.
                        </div>
                        <div className="relative group">
                            <Info className="w-4 h-4 text-green-400 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-black border-2 border-green-400 text-xs text-green-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                <div className="font-bold mb-1">AUTO-UPDATE INFO</div>
                                <div>Tokens are automatically updated every 30 seconds. SYNC button triggers manual refresh.</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trading Opportunities Section */}
            <div className="border-2 border-yellow-400 p-6 mb-6 bg-black bg-opacity-50">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Zap className="w-6 h-6 text-yellow-400" />
                        🚀 RUNNER OPPORTUNITIES
                    </h2>
                    <div className="flex items-center gap-3">
                        {tradingStatus && (
                            <div className="text-sm">
                                <span className={tradingStatus.enabled ? 'text-green-400' : 'text-gray-500'}>
                                    {tradingStatus.enabled ? '🟢 TRADING ON' : '⚪ TRADING OFF'}
                                </span>
                                {tradingStatus.monitoring && (
                                    <span className="text-blue-400 ml-2">👁️ MONITORING</span>
                                )}
                            </div>
                        )}
                        <button
                            onClick={fetchOpportunities}
                            disabled={loadingOpportunities}
                            className="px-4 py-2 border-2 border-yellow-400 hover:bg-yellow-400 hover:text-black transition-colors text-sm"
                        >
                            {loadingOpportunities ? 'LOADING...' : 'REFRESH'}
                        </button>
                    </div>
                </div>

                {/* Runner Filter Settings */}
                <div className="border border-yellow-400 p-4 mb-4 bg-black bg-opacity-30">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Filter className="w-5 h-5" />
                            RUNNER DETECTION FILTERS
                        </h2>
                        <button
                            onClick={updateRunnerConfig}
                            className="px-4 py-2 border-2 border-yellow-400 hover:bg-yellow-400 hover:text-black transition-colors text-sm font-bold"
                        >
                            SAVE SETTINGS
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm">MIN MCAP GROWTH (5m): {runnerMinMcapGrowth}%</label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={runnerMinMcapGrowthEnabled}
                                        onChange={(e) => setRunnerMinMcapGrowthEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                                </label>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={linearToLog(runnerMinMcapGrowth, 1, 1000)}
                                onChange={(e) => {
                                    const logPos = Number(e.target.value);
                                    const linearValue = logToLinear(logPos, 1, 1000);
                                    setRunnerMinMcapGrowth(Math.round(linearValue));
                                }}
                                disabled={!runnerMinMcapGrowthEnabled}
                                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="flex justify-between text-xs mt-1 text-green-500">
                                <span>1%</span>
                                <span>5%</span>
                                <span>10%</span>
                                <span>25%</span>
                                <span>50%</span>
                                <span>100%</span>
                                <span>250%</span>
                                <span>1000%</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm">MIN HOLDERS: {runnerMinHolders}</label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={runnerMinHoldersEnabled}
                                        onChange={(e) => setRunnerMinHoldersEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                                </label>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={linearToLog(runnerMinHolders, 1, 10000)}
                                onChange={(e) => {
                                    const logPos = Number(e.target.value);
                                    const linearValue = logToLinear(logPos, 1, 10000);
                                    setRunnerMinHolders(Math.round(linearValue));
                                }}
                                disabled={!runnerMinHoldersEnabled}
                                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="flex justify-between text-xs mt-1 text-green-500">
                                <span>1</span>
                                <span>10</span>
                                <span>50</span>
                                <span>100</span>
                                <span>500</span>
                                <span>1K</span>
                                <span>5K</span>
                                <span>10K</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm">MIN VOLUME (24h): {formatNumber(runnerMinVolume)}</label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={runnerMinVolumeEnabled}
                                        onChange={(e) => setRunnerMinVolumeEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                                </label>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={linearToLog(runnerMinVolume, 100, 1000000)}
                                onChange={(e) => {
                                    const logPos = Number(e.target.value);
                                    const linearValue = logToLinear(logPos, 100, 1000000);
                                    setRunnerMinVolume(Math.round(linearValue / 100) * 100); // Round to nearest 100
                                }}
                                disabled={!runnerMinVolumeEnabled}
                                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="flex justify-between text-xs mt-1 text-green-500">
                                <span>$100</span>
                                <span>$500</span>
                                <span>$1K</span>
                                <span>$5K</span>
                                <span>$10K</span>
                                <span>$50K</span>
                                <span>$100K</span>
                                <span>$1M</span>
                            </div>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm">MIN MCAP: {formatNumber(runnerMinMcap)}</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={linearToLog(runnerMinMcap, 1000, 10000000)}
                                onChange={(e) => {
                                    const logPos = Number(e.target.value);
                                    const linearValue = logToLinear(logPos, 1000, 10000000);
                                    setRunnerMinMcap(Math.round(linearValue / 100) * 100); // Round to nearest 100
                                }}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs mt-1 text-green-500">
                                <span>$1K</span>
                                <span>$5K</span>
                                <span>$10K</span>
                                <span>$50K</span>
                                <span>$100K</span>
                                <span>$500K</span>
                                <span>$1M</span>
                                <span>$10M</span>
                            </div>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm">BUY AMOUNT: {buyAmountSOL} SOL</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.1"
                                value={linearToLog(buyAmountSOL, 0.01, 10)}
                                onChange={(e) => {
                                    const logPos = Number(e.target.value);
                                    const linearValue = logToLinear(logPos, 0.01, 10);
                                    setBuyAmountSOL(Math.round(linearValue * 100) / 100); // Round to 2 decimals
                                }}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs mt-1 text-green-500">
                                <span>0.01</span>
                                <span>0.05</span>
                                <span>0.1</span>
                                <span>0.25</span>
                                <span>0.5</span>
                                <span>1</span>
                                <span>2.5</span>
                                <span>10</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-green-500">
                        💡 Tokens must meet <strong>all enabled filters</strong>, or <strong>at least 2 of 3</strong> if all three are enabled (mcap growth, holders, volume).
                    </div>
                </div>

                {opportunities.length === 0 ? (
                    <div className="text-center py-8 text-green-400 opacity-75">
                        {loadingOpportunities ? 'Scanning for runners...' : 'No runner opportunities found. Check back soon!'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {opportunities.map((opp) => (
                            <div
                                key={opp.mintAddress}
                                className="border border-yellow-400 p-4 hover:bg-yellow-400 hover:bg-opacity-10 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="font-bold text-lg">{opp.symbol}</div>
                                            <div className="text-sm opacity-75">{opp.name}</div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <div className="opacity-75">MCAP</div>
                                                <div className="font-bold">{formatNumber(opp.marketCap)}</div>
                                            </div>
                                            <div>
                                                <div className="opacity-75">MCAP Δ5m</div>
                                                <div className={clsx('font-bold', opp.mcapGrowth5m >= 0 ? 'text-green-400' : 'text-red-400')}>
                                                    {formatPercent(opp.mcapGrowth5m)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="opacity-75">HOLDERS</div>
                                                <div className="font-bold text-green-400">
                                                    {opp.holderCount || 0}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="opacity-75">VOLUME 24h</div>
                                                <div className="font-bold">{formatNumber(opp.volume24h)}</div>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-xs text-yellow-400">
                                            ✅ {opp.reason}
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        <button
                                            onClick={() => handleManualBuy(opp)}
                                            disabled={buyingToken === opp.mintAddress}
                                            className={clsx(
                                                'px-6 py-3 border-2 border-yellow-400 font-bold transition-colors',
                                                buyingToken === opp.mintAddress
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : 'hover:bg-yellow-400 hover:text-black'
                                            )}
                                        >
                                            {buyingToken === opp.mintAddress ? 'BUYING...' : '💰 BUY'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="border-t-2 border-green-400 pt-4">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5" />
                    <h2 className="text-xl font-bold">FILTERS</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block mb-1 text-sm">MIN MCAP: {formatNumber(minMcap)}</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={linearToLog(minMcap, 0, 100000000)}
                            onChange={(e) => {
                                const logPos = Number(e.target.value);
                                const linearValue = logToLinear(logPos, 0, 100000000);
                                setMinMcap(linearValue);
                            }}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs mt-1 text-green-500">
                            <span>0</span>
                            <span>1K</span>
                            <span>10K</span>
                            <span>50K</span>
                            <span>100K</span>
                            <span>500K</span>
                            <span>1M</span>
                            <span>10M</span>
                            <span>100M</span>
                        </div>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm">MAX MCAP: {formatNumber(maxMcap)}</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={linearToLog(maxMcap, 0, 100000000)}
                            onChange={(e) => {
                                const logPos = Number(e.target.value);
                                const linearValue = logToLinear(logPos, 0, 100000000);
                                setMaxMcap(linearValue);
                            }}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs mt-1 text-green-500">
                            <span>0</span>
                            <span>1K</span>
                            <span>10K</span>
                            <span>50K</span>
                            <span>100K</span>
                            <span>500K</span>
                            <span>1M</span>
                            <span>10M</span>
                            <span>100M</span>
                        </div>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm">MIN HOLDERS: {minHolders}</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={linearToLog(minHolders, 1, 10000)}
                            onChange={(e) => {
                                const logPos = Number(e.target.value);
                                const linearValue = logToLinear(logPos, 1, 10000);
                                setMinHolders(Math.round(linearValue));
                            }}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs mt-1 text-green-500">
                            <span>1</span>
                            <span>10</span>
                            <span>50</span>
                            <span>100</span>
                            <span>500</span>
                            <span>1K</span>
                            <span>5K</span>
                            <span>10K</span>
                        </div>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm" title="Minimum % change in market cap over the last 5 minutes. Example: +50% means the token must have grown by at least 50% in the last 5 minutes">
                            MIN MCAP GROWTH (5m): {formatPercent(minMcapGrowth)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={minMcapGrowth >= 0 ? linearToLog(minMcapGrowth, 1, 1000) : 0}
                            onChange={(e) => {
                                if (Number(e.target.value) === 0) {
                                    setMinMcapGrowth(-100); // Allow negative to disable filter
                                } else {
                                    const logPos = Number(e.target.value);
                                    const linearValue = logToLinear(logPos, 1, 1000);
                                    setMinMcapGrowth(Math.round(linearValue));
                                }
                            }}
                            className="w-full"
                            title="Minimum % change in market cap over the last 5 minutes"
                        />
                        <div className="flex justify-between text-xs mt-1 text-green-500">
                            <span>-100%</span>
                            <span>1%</span>
                            <span>5%</span>
                            <span>10%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>100%</span>
                            <span>1000%</span>
                        </div>
                        <div className="text-xs text-green-500 mt-1">
                            Filters tokens by 5m market cap change (e.g., +50% = grown 50% in last 5 minutes)
                        </div>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm" title="Minimum % change in holder count over the last 5 minutes. Example: +20% means the token must have gained at least 20% more holders in the last 5 minutes">
                            MIN HOLDER GROWTH (5m): {formatPercent(minHolderGrowth)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={minHolderGrowth >= 0 ? linearToLog(minHolderGrowth, 1, 1000) : 0}
                            onChange={(e) => {
                                if (Number(e.target.value) === 0) {
                                    setMinHolderGrowth(-100); // Allow negative to disable filter
                                } else {
                                    const logPos = Number(e.target.value);
                                    const linearValue = logToLinear(logPos, 1, 1000);
                                    setMinHolderGrowth(Math.round(linearValue));
                                }
                            }}
                            className="w-full"
                            title="Minimum % change in holder count over the last 5 minutes"
                        />
                        <div className="flex justify-between text-xs mt-1 text-green-500">
                            <span>-100%</span>
                            <span>1%</span>
                            <span>5%</span>
                            <span>10%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>100%</span>
                            <span>1000%</span>
                        </div>
                        <div className="text-xs text-green-500 mt-1">
                            Filters tokens by 5m holder count change (e.g., +20% = gained 20% more holders in last 5 minutes)
                        </div>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm">MAX AGE: {maxAgeHours}h</label>
                        <input
                            type="range"
                            min="1"
                            max="720"
                            step="1"
                            value={maxAgeHours}
                            onChange={(e) => setMaxAgeHours(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="border-2 border-green-400">
            {
                loading ? (
                    <div className="p-12 text-center" >
                        <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" />
                        <p className="text-xl">LOADING TOKENS...</p>
                    </div>
                ) : sortedTokens.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-xl">NO TOKENS FOUND</p>
                        <p className="text-sm mt-2">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b-2 border-green-400">
                                <tr>
                                    <th className="p-4 text-left cursor-pointer hover:bg-green-400 hover:text-black" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-2">
                                            TOKEN
                                            {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="p-4 text-left cursor-pointer hover:bg-green-400 hover:text-black" onClick={() => handleSort('mcap')}>
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" />
                                            MCAP
                                            {sortField === 'mcap' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="p-4 text-left cursor-pointer hover:bg-green-400 hover:text-black" onClick={() => handleSort('holders')}>
                                        <div className="flex items-center gap-1">
                                            <Users className="w-3 h-3 text-gray-500" />
                                            <span>HOLDERS</span>
                                        </div>
                                        {sortField === 'holders' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                                    </th>
                                    <th className="p-4 text-left cursor-pointer hover:bg-green-400 hover:text-black" onClick={() => handleSort('mcapGrowth5m')}>
                                        <div className="flex items-center gap-2">
                                            MCAP Δ5m
                                            {sortField === 'mcapGrowth5m' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="p-4 text-left cursor-pointer hover:bg-green-400 hover:text-black" onClick={() => handleSort('holderGrowth5m')}>
                                        <div className="flex items-center gap-2">
                                            HOLDER Δ5m
                                            {sortField === 'holderGrowth5m' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="p-4 text-left cursor-pointer hover:bg-green-400 hover:text-black" onClick={() => handleSort('volume24h')}>
                                        <div className="flex items-center gap-1" title="Volume 24h">
                                            <span className="text-gray-500 text-xs">VOL:</span>
                                            <span>VOLUME</span>
                                        </div>
                                        {sortField === 'volume24h' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                                    </th>
                                    <th className="p-4 text-left cursor-pointer hover:bg-green-400 hover:text-black" onClick={() => handleSort('age')}>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            AGE
                                            {sortField === 'age' && (sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="p-4 text-left">LINKS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTokens.map((token) => {
                                    const isBlurred = shouldBlurToken(token);
                                    return (
                                        <tr
                                            key={token.mintAddress}
                                            className={clsx(
                                                "border-b border-green-400 hover:bg-green-400 hover:bg-opacity-10 relative",
                                                isBlurred && "select-none"
                                            )}
                                        >
                                            <td className={clsx("p-4", isBlurred && "blur-sm pointer-events-none")}>
                                                <div className="flex items-center gap-3">
                                                    {token.imageUrl && (
                                                        <img src={token.imageUrl} alt={token.name} className="w-10 h-10 rounded-full border border-green-400" />
                                                    )}
                                                    <div>
                                                        <div className="font-bold">{token.name}</div>
                                                        <div className="text-sm opacity-75">{token.symbol}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={clsx("p-4", isBlurred && "blur-sm pointer-events-none")}>
                                                {formatNumber(token.marketCap || 0)}
                                            </td>
                                            <td className={clsx("p-4", isBlurred && "blur-sm pointer-events-none")}>
                                                {(token.holderCount || 0).toLocaleString()}
                                            </td>
                                            <td className={clsx(
                                                "p-4",
                                                (token.mcapGrowth5m || 0) >= 0 ? 'text-green-400' : 'text-red-400',
                                                isBlurred && "blur-sm pointer-events-none"
                                            )}>
                                                {formatPercent(token.mcapGrowth5m || 0)}
                                            </td>
                                            <td className={clsx(
                                                "p-4",
                                                (token.holderGrowth5m || 0) >= 0 ? 'text-green-400' : 'text-red-400',
                                                isBlurred && "blur-sm pointer-events-none"
                                            )}>
                                                {formatPercent(token.holderGrowth5m || 0)}
                                            </td>
                                            <td className={clsx("p-4", isBlurred && "blur-sm pointer-events-none")}>
                                                {formatNumber(token.volume24h || 0)}
                                            </td>
                                            <td className={clsx("p-4", isBlurred && "blur-sm pointer-events-none")}>
                                                {formatAge(token.createdAt || Date.now())}
                                            </td>
                                            <td className={clsx("p-4", isBlurred && "blur-sm pointer-events-none opacity-50")}>
                                                <div className="flex gap-2">
                                                    <a
                                                        href={`https://bags.fm/${token.mintAddress}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2 py-1 border border-green-400 hover:bg-green-400 hover:text-black text-xs flex items-center gap-1"
                                                        title="View on bags.fm"
                                                        onClick={(e) => isBlurred && e.preventDefault()}
                                                    >
                                                        BAGS
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                    <a
                                                        href={`https://solscan.io/token/${token.mintAddress}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2 py-1 border border-green-400 hover:bg-green-400 hover:text-black text-xs flex items-center gap-1"
                                                        title="View on Solscan"
                                                        onClick={(e) => isBlurred && e.preventDefault()}
                                                    >
                                                        SCAN
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                    <a
                                                        href={`https://www.defined.fi/sol/${token.mintAddress}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2 py-1 border border-green-400 hover:bg-green-400 hover:text-black text-xs flex items-center gap-1"
                                                        title="View chart on Defined.fi"
                                                        onClick={(e) => isBlurred && e.preventDefault()}
                                                    >
                                                        CHART
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            </td>
                                            {isBlurred && !SCANNER_FREE_ACCESS && (
                                                <td colSpan={8} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                                    <div className="bg-black bg-opacity-90 border-2 border-yellow-400 px-6 py-3 text-yellow-400 text-sm font-bold flex items-center gap-2 rounded">
                                                        <Lock className="w-4 h-4" />
                                                        TOKEN GATED - CONNECT WALLET WITH PROJECT TOKEN
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            }
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm border-2 border-green-400 p-4">
            <p>
                Powered by{' '}
                <a
                    href="https://bags.fm/?ref=fathomabyss"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white"
                >
                    bags.fm API
                </a>
                {' '}• Auto-refreshes every 10s
            </p>
        </div>
    </div>



        ;
}
