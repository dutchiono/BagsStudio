'use client';

import DraggableWindow from '@/components/DraggableWindow';
import SplashScreen from '@/components/SplashScreen';
import { TerminalWalletButton } from "@/components/TerminalWalletButton";
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useSolBalance } from '@/hooks/useSolBalance';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { Terminal, Zap, Rocket, Image as ImageIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, useEffect, useRef } from 'react';

// Centralized Project Config interface
interface ProjectConfig {
    name: string;
    ticker: string;
    type: 'MEME COIN' | 'UTILITY' | 'NFT';
    description: string;
    twitterHandle: string;
    telegramLink: string;
    websiteUrl: string;
    logoUrl: string | null;
    layout: 'classic' | 'hero' | 'minimal' | 'brutalist';
}

const initialConfig: ProjectConfig = {
    name: '',
    ticker: '',
    type: 'MEME COIN',
    description: '',
    twitterHandle: '',
    telegramLink: '',
    websiteUrl: '',
    logoUrl: null,
    layout: 'classic'
};

// Payment Modal Component
function PaymentModal({ isOpen, onClose, cost, address, onConfirm }: any) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-[400px] border-2 border-green-400 bg-black p-4 sm:p-6 shadow-[0_0_30px_rgba(74,222,128,0.3)]">
                <h3 className="text-xl font-bold text-green-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Zap size={24} /> Payment Required
                </h3>
                <div className="space-y-4 text-green-400/80 font-mono text-sm">
                    <p>Free image generations limit reached.</p>
                    <div className="border border-green-400/30 p-3 bg-green-400/5">
                        <div className="flex justify-between mb-2">
                            <span>COST:</span>
                            <span className="font-bold text-green-400">{cost} SOL</span>
                        </div>
                        <div className="flex justify-between">
                            <span>TO:</span>
                            <span className="font-bold text-green-400 truncate w-32">{address}</span>
                        </div>
                    </div>
                    <p className="text-xs text-green-400/50 uppercase">
                        By confirming, you verify this transaction has been sent.
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-green-400/50 text-green-400 hover:bg-green-400/10 transition-colors uppercase text-sm">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-green-400 text-black font-bold hover:bg-green-300 transition-colors uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                        Verify Payment
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function StudioPage() {
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { balance: tokenBalance, loading: tokenLoading } = useTokenBalance();
    const [isWhitelisted, setIsWhitelisted] = useState(false);

    // GATING THRESHOLDS (1M tokens = a quarter to play)
    const DEMO_THRESHOLD = 1_000_000;
    const LAUNCH_THRESHOLD = 1_000_000;

    const canDemo = isWhitelisted || tokenBalance >= DEMO_THRESHOLD;
    const canLaunch = isWhitelisted || tokenBalance >= LAUNCH_THRESHOLD;

    // API URL - Robust handling to prevent double /api
    const rawApiUrl = process.env.NEXT_PUBLIC_BUILDER_API_URL ||
        (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
            ? ''
            : 'http://localhost:3042');
    const BUILDER_API = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

    // Renderer URL for preview iframe
    const RENDERER_URL = process.env.NEXT_PUBLIC_RENDERER_URL ||
        (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
            ? ''
            : 'http://localhost:3003');

    const [activeTab, setActiveTab] = useState<'chat' | 'launchpad'>('chat');

    // Config & State
    const [config, setConfig] = useState<ProjectConfig>(initialConfig);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isCreatingProject, setIsCreatingProject] = useState(false);

    // Launch State
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchStatus, setLaunchStatus] = useState<string>('');
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Chat State
    const [chatInput, setChatInput] = useState('');
    const [hasInitialized, setHasInitialized] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ type: string; content: string; isLoading?: boolean }[]>([
        { type: 'ai', content: 'Connect your wallet, then click **Initialize website** to create your project. I will help you build it.' }
    ]);
    const [isStreaming, setIsStreaming] = useState(false);

    // SLOPMACHINE STATE
    const [projects, setProjects] = useState<any[]>([]);
    const [username, setUsername] = useState<string>('');

    // Load a specific project into state
    const loadProject = (project: any) => {
        setProjectId(project.id);
        const content = project.content || {}; // Builder-service might return it differently, handle both
        // If content is missing, might be legacy or just created
        const restoredConfig: ProjectConfig = {
            ...initialConfig,
            name: content.name || project.name || '',
            ticker: content.symbol || '',
            description: content.description || content.tagline || '',
            twitterHandle: content.twitterHandle || '',
            telegramLink: content.telegramLink || '',
            websiteUrl: content.websiteUrl || '',
            logoUrl: content.logoUrl || null,
            layout: content.layout || 'classic'
        };
        setConfig(restoredConfig);
        setPreviewUrl(`${RENDERER_URL}/${project.username}/${project.id}`);
        setHasInitialized(true);

        // Chat welcome msg
        const projectName = project.name || 'Untitled Project';
        setChatMessages(prev => [
            ...prev,
            { type: 'ai', content: `Loaded project "${projectName}".` }
        ]);
    };

    const handleSwitchProject = async (pid: string) => {
        if (pid === 'NEW') {
            setIsCreatingProject(true);
            try {
                // Ensure wallet
                if (!publicKey) return;
                const response = await fetch(`${BUILDER_API}/api/projects/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletAddress: publicKey.toBase58(), name: `Project-${Date.now()}` }),
                });
                const data = await response.json();
                if (data.project) {
                    // Refresh list
                    const listRes = await fetch(`${BUILDER_API}/api/projects/wallet/${publicKey.toBase58()}`);
                    const listData = await listRes.json();
                    if (listData.projects) {
                        setProjects(listData.projects);
                        const newProj = listData.projects.find((p: any) => p.id === data.project.id);
                        if (newProj) loadProject(newProj);
                    }
                }
            } finally {
                setIsCreatingProject(false);
            }
            return;
        }

        const target = projects.find(p => p.id === pid);
        if (target) {
            loadProject(target);
        }
    };

    // RESTORE SESSION & CHECK AUTHORITY
    useEffect(() => {
        if (publicKey) {
            // 1. Check Whitelist
            fetch(`${BUILDER_API}/api/auth/whitelist/${publicKey.toBase58()}`)
                .then(res => res.json())
                .then(data => setIsWhitelisted(data.isWhitelisted))
                .catch(err => console.error('Whitelist check failed', err));

            // 2. Restore Session (Fix Refresh Issue)
            if (!hasInitialized) {
                fetch(`${BUILDER_API}/api/projects/wallet/${publicKey.toBase58()}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.projects && data.projects.length > 0) {
                            setProjects(data.projects);
                            // Set Username from first project (it's per-wallet usually)
                            if (data.projects[0].username) setUsername(data.projects[0].username);

                            // Auto-load most recent if not selected
                            if (!projectId) {
                                const lastProject = data.projects[data.projects.length - 1]; // Last created is usually last in list
                                loadProject(lastProject);
                            }
                        }
                    })
                    .catch(e => console.error('Session restore failed', e));
            }
        } else {
            setIsWhitelisted(false);
            setHasInitialized(false);
            setProjectId(null);
            setProjects([]);
            setUsername('');
        }
    }, [publicKey, BUILDER_API, projectId, hasInitialized]);

    // Create or load project for current wallet
    const ensureProject = async (): Promise<string> => {
        if (projectId) return projectId;
        setIsCreatingProject(true);
        try {
            if (!publicKey || !connected) throw new Error('Connect wallet first');
            const walletAddress = publicKey.toBase58();
            const name = config.name || `Project-${Date.now()}`;

            // Simplified: Always try create or get latest
            const response = await fetch(`${BUILDER_API}/api/projects/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, name }),
            });

            if (!response.ok) throw new Error('Failed to create project');
            const data = await response.json();
            const newPid = data.project?.id || data.projectId;
            setProjectId(newPid);
            if (data.previewUrl) {
                setPreviewUrl(data.previewUrl);
            } else {
                setPreviewUrl(`${RENDERER_URL}/${username}/${newPid}`);
            }
            return newPid;
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleInitializeWebsite = async () => {
        if (!publicKey || !connected) return;
        if (!canDemo) {
            alert(`Access Denied. You need 10M STUDIO tokens to use the Architect.`);
            return;
        }
        try {
            await ensureProject();
            setHasInitialized(true);
            setChatMessages(prev => [
                { type: 'ai', content: 'Ready! Tell me what to build (e.g. "Space Dog Coin"). I\'ll fill in the details.' }
            ]);
        } catch (e) {
            console.error(e);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setLogoBase64(base64);
                // Also update config for preview
                setConfig(prev => ({ ...prev, logoUrl: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLaunch = async () => {
        if (!publicKey || !connected) {
            alert('Please connect your wallet first');
            return;
        }
        if (!config.name || !config.ticker || !config.description) {
            alert('Please fill in Name, Ticker, and Description');
            return;
        }
        if (!logoBase64) {
            alert('Please upload a token image');
            return;
        }

        setIsLaunching(true);
        setLaunchStatus('Preparing metadata...');

        try {
            // Step 1: Prepare Launch (Upload Metadata)
            const prepareResponse = await fetch(`${BUILDER_API}/api/launch/prepare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: config.name,
                    symbol: config.ticker,
                    description: config.description,
                    websiteUrl: config.websiteUrl,
                    twitter: config.twitterHandle,
                    telegram: config.telegramLink,
                    imageBase64: logoBase64
                })
            });

            if (!prepareResponse.ok) {
                const err = await prepareResponse.json();
                throw new Error(err.error || 'Failed to upload metadata');
            }

            const { tokenMetadata, tokenMint } = await prepareResponse.json();
            setLaunchStatus('Constructing transaction...');

            // Step 2: Get Launch Transaction
            const txResponse = await fetch(`${BUILDER_API}/api/launch/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ipfs: tokenMetadata,
                    tokenMint,
                    walletAddress: publicKey.toBase58(),
                    initialBuyLamports: 0
                })
            });

            if (!txResponse.ok) {
                const err = await txResponse.json();
                throw new Error(err.error || 'Failed to create transaction');
            }

            const { transaction } = await txResponse.json();
            setLaunchStatus('Please sign transaction...');

            // Step 3: Deserialize and Sign
            // Transaction from API is base64 encoded serialized transaction
            const txBuffer = Buffer.from(transaction, 'base64');
            const versionedTx = VersionedTransaction.deserialize(txBuffer);

            const signature = await sendTransaction(versionedTx, connection);

            setLaunchStatus('Confirming transaction...');
            await connection.confirmTransaction(signature, 'confirmed');

            // Step 4: Update project config with contract address
            if (projectId) {
                setLaunchStatus('Updating website with CA...');
                try {
                    await fetch(`${BUILDER_API}/api/projects/${projectId}/config`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contractAddress: tokenMint })
                    });
                    // Refresh preview to show new CA
                    setPreviewUrl(prev => {
                        if (!prev) return prev;
                        const cleanUrl = prev.split('?')[0];
                        return `${cleanUrl}?t=${Date.now()}`;
                    });
                } catch (e) {
                    console.error('Failed to update CA on website:', e);
                }
            }

            setLaunchStatus('LAUNCH SUCCESSFUL! 🚀');
            alert(`Token Launched! Mint: ${tokenMint}`);
            window.open(`https://solscan.io/tx/${signature}`, '_blank');

        } catch (error: any) {
            console.error('Launch failed:', error);
            alert(`Launch failed: ${error.message}`);
            setLaunchStatus('Launch Failed');
        } finally {
            setIsLaunching(false);
        }
    };

    const updateConfig = useCallback((updates: Partial<ProjectConfig>, force = false) => {
        setConfig(prev => {
            if (!updates) return { ...prev };
            const merged = { ...prev };
            for (const [key, value] of Object.entries(updates)) {
                const k = key as keyof ProjectConfig;
                if (force || !prev[k] || k === 'type') {
                    (merged as any)[k] = value;
                }
            }
            return merged;
        });
    }, []);

    const handleLayoutChange = async (newLayout: ProjectConfig['layout']) => {
        // Optimistic update
        updateConfig({ layout: newLayout }, true);

        if (projectId) {
            try {
                await fetch(`${BUILDER_API}/api/projects/${projectId}/config`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ layout: newLayout })
                });
                // Force preview refresh
                setPreviewUrl(prev => {
                    if (!prev) return prev;
                    const cleanUrl = prev.split('?')[0];
                    return `${cleanUrl}?t=${Date.now()}`;
                });
            } catch (e) {
                console.error('Failed to save layout', e);
            }
        }
    };

    const handleSendMessage = async () => {
        if (!hasInitialized || !chatInput.trim() || isStreaming) return;
        const userMessage = chatInput;
        setChatMessages(prev => [...prev, { type: 'user', content: userMessage }]);
        setChatInput('');
        setChatMessages(prev => [...prev, { type: 'ai', content: '⚙️ Working on it...', isLoading: true }]);
        setIsStreaming(true);

        try {
            const pid = await ensureProject();
            const response = await fetch(`${BUILDER_API}/api/projects/${pid}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    llmConfig: { provider: 'openai', model: 'gpt-4o' },
                    projectConfig: config,
                }),
            });

            if (!response.ok) throw new Error('Chat request failed');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
                let fullResponse = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'chunk') {
                                    fullResponse += parsed.content;
                                    setChatMessages(prev => {
                                        const upd = [...prev];
                                        upd[upd.length - 1] = { type: 'ai', content: fullResponse, isLoading: false };
                                        return upd;
                                    });
                                } else if (parsed.type === 'config_update') {
                                    // Map builder schema fields to web app fields
                                    const updates = parsed.updates;
                                    if (updates.symbol) {
                                        updates.ticker = updates.symbol;
                                    }
                                    if (updates.tagline && !updates.description) {
                                        updates.description = updates.tagline;
                                    }
                                    updateConfig(updates);
                                    setPreviewUrl(prev => {
                                        if (!prev) return prev;
                                        const cleanUrl = prev.split('?')[0];
                                        return `${cleanUrl}?t=${Date.now()}`;
                                    });
                                }
                            } catch (e) { }
                        }
                    }
                }
            }

        } catch (e: any) {
            setChatMessages(prev => [...prev, { type: 'ai', content: `Error: ${e.message}` }]);
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && hasInitialized && !isStreaming) handleSendMessage();
    };


    return (
        <div className="min-h-screen bg-black text-green-400 font-mono selection:bg-green-400 selection:text-black overflow-hidden fixed inset-0">
            <SplashScreen />

            {/* Header - Fixed Mobile & Layout */}
            <header className="fixed top-0 left-0 right-0 h-14 bg-black border-b-2 border-green-400 z-[100] flex items-center justify-between px-2 sm:px-4">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-400" fill="currentColor" />
                    <h1 className="text-sm sm:text-lg font-bold tracking-wider">BAGS STUDIO</h1>
                </div>

                <div className="flex items-center gap-2">
                    {/* Mobile Wallet Fix: Ensure button is visible */}
                    <div className="scale-90 sm:scale-100 flex-shrink-0">
                        <TerminalWalletButton />
                    </div>
                </div>
            </header>

            {/* Canvas / Preview Area */}
            <div className="absolute inset-0 top-14 bg-black/90">
                {previewUrl ? (
                    <iframe src={previewUrl} className="w-full h-full border-0" />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center opacity-30">
                        <Terminal size={48} className="mb-4" />
                        <h2 className="text-xl font-bold">WAITING FOR INPUT</h2>
                        <p className="max-w-md mt-2 text-sm">Initialize the architect to begin generating your website.</p>
                    </div>
                )}
            </div>

            {/* slopMachine WINDOW (Unified) */}
            <DraggableWindow
                title={`slopMachine ${username ? `// ${username}` : ''}`}
                defaultPosition={{ x: 20, y: 80 }}
                defaultSize={{ width: 400, height: 600 }}
                className="!bg-black/80 !backdrop-blur-xl !border-2 !border-green-400 !shadow-[8px_8px_0px_0px_rgba(74,222,128,0.2)]"
                headerClassName="!bg-green-400/10 !h-12"
            >
                <div className="h-full flex flex-col">
                    {/* Tab Bar */}
                    <div className="flex border-b border-green-400/30">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'chat' ? 'bg-green-400 text-black' : 'text-green-400 hover:bg-green-400/10'}`}
                        >
                            <Terminal size={14} /> Agent
                        </button>
                        <button
                            onClick={() => setActiveTab('launchpad')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'launchpad' ? 'bg-green-400 text-black' : 'text-green-400 hover:bg-green-400/10'}`}
                        >
                            <Rocket size={14} /> Launch
                        </button>
                    </div>

                    {/* TOOLBAR: Projects & Layout */}
                    <div className="bg-black/40 border-b border-green-400/30 p-2 flex items-center gap-2">
                        {/* Project Selector */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-green-400/60 whitespace-nowrap">Proj:</span>
                            <select
                                value={projectId || ''}
                                onChange={(e) => handleSwitchProject(e.target.value)}
                                className="w-full bg-black border border-green-400/30 text-green-400 text-xs p-1 rounded font-mono uppercase focus:outline-none hover:border-green-400 cursor-pointer text-ellipsis"
                            >
                                <option value="" disabled>Select...</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name || 'Untitled'}</option>
                                ))}
                                <option value="NEW">+ New Project</option>
                            </select>
                        </div>

                        {/* Layout Selector */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-green-400/60 pl-2">Layout:</span>
                            <select
                                value={config.layout || 'classic'}
                                onChange={(e) => handleLayoutChange(e.target.value as any)}
                                className="bg-black border border-green-400/30 text-green-400 text-xs p-1 rounded font-mono uppercase focus:outline-none hover:border-green-400 cursor-pointer"
                            >
                                <option value="classic">Classic (Meme)</option>
                                <option value="hero">Hero (Bold)</option>
                                <option value="minimal">Minimal (Clean)</option>
                                <option value="brutalist">Brutalist (Raw)</option>
                            </select>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden relative">

                        {/* CHAT TAB */}
                        {activeTab === 'chat' && (
                            <div className="absolute inset-0 flex flex-col">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {chatMessages.map((msg, idx) => (
                                        <div key={idx} className={`flex flex-col ${msg.type === 'ai' ? 'items-start' : 'items-end'}`}>
                                            <div className={`max-w-[90%] p-3 text-xs leading-relaxed border ${msg.type === 'ai' ? 'border-green-400 bg-green-400/5 text-green-400 rounded-tr-lg rounded-bl-lg rounded-br-lg' : 'border-purple-500 bg-purple-500/10 text-purple-300 rounded-tl-lg rounded-bl-lg rounded-br-lg'}`}>
                                                {msg.content}
                                                {msg.isLoading && <span className="animate-pulse ml-2">_</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {!hasInitialized && connected && (
                                        <button
                                            onClick={handleInitializeWebsite}
                                            disabled={!canDemo}
                                            className={`w-full py-4 border-2 border-dashed font-bold uppercase transition-all ${canDemo
                                                ? 'border-green-400 text-green-400 hover:bg-green-400 hover:text-black'
                                                : 'border-green-400/30 text-green-400/30 cursor-not-allowed'
                                                }`}
                                        >
                                            {canDemo ? '[ Initialize System ]' : `[ Locked - Hold 1M STUDIO ]`}
                                        </button>
                                    )}
                                </div>
                                <div className="p-3 border-t border-green-400/30 bg-black">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={hasInitialized ? "Command the Architect..." : "Initialize first..."}
                                            disabled={!hasInitialized}
                                            className="w-full bg-black border border-green-400/50 p-3 pr-10 text-xs text-green-400 focus:border-green-400 focus:outline-none placeholder-green-400/30"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            className="absolute right-2 top-2 p-1 text-green-400 hover:text-white"
                                        >
                                            <Zap size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LAUNCHPAD TAB */}
                        {activeTab === 'launchpad' && (
                            <div className="absolute inset-0 overflow-y-auto p-6 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-green-400/60 mb-1 block">Token Name</label>
                                        <input
                                            type="text"
                                            value={config.name}
                                            onChange={(e) => updateConfig({ name: e.target.value }, true)}
                                            className="w-full bg-black border border-green-400/50 p-3 text-sm font-bold text-green-400 focus:border-green-400 focus:outline-none"
                                            placeholder="Automatically filled..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-green-400/60 mb-1 block">Ticker</label>
                                        <input
                                            type="text"
                                            value={config.ticker}
                                            onChange={(e) => updateConfig({ ticker: e.target.value }, true)}
                                            className="w-full bg-black border border-green-400/50 p-3 text-sm font-bold text-green-400 focus:border-green-400 focus:outline-none"
                                            placeholder="$SYMBOL"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-green-400/60 mb-1 block">Tagline / Description</label>
                                        <textarea
                                            value={config.description}
                                            onChange={(e) => updateConfig({ description: e.target.value }, true)}
                                            className="w-full bg-black border border-green-400/50 p-3 text-xs text-green-400 focus:border-green-400 focus:outline-none h-20 resize-none"
                                            placeholder="The story of the coin..."
                                        />
                                    </div>

                                    {/* Social Links */}
                                    <div className="space-y-3 border-t border-green-400/20 pt-3">
                                        <p className="text-[10px] uppercase font-bold text-green-400/80">Social Links (Optional)</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            <input
                                                type="text"
                                                value={config.websiteUrl}
                                                onChange={(e) => updateConfig({ websiteUrl: e.target.value }, true)}
                                                className="w-full bg-black border border-green-400/30 p-2 text-xs text-green-400 focus:border-green-400 focus:outline-none"
                                                placeholder="Website URL"
                                            />
                                            <input
                                                type="text"
                                                value={config.twitterHandle}
                                                onChange={(e) => updateConfig({ twitterHandle: e.target.value }, true)}
                                                className="w-full bg-black border border-green-400/30 p-2 text-xs text-green-400 focus:border-green-400 focus:outline-none"
                                                placeholder="Twitter / X Label"
                                            />
                                            <input
                                                type="text"
                                                value={config.telegramLink}
                                                onChange={(e) => updateConfig({ telegramLink: e.target.value }, true)}
                                                className="w-full bg-black border border-green-400/30 p-2 text-xs text-green-400 focus:border-green-400 focus:outline-none"
                                                placeholder="Telegram URL"
                                            />
                                        </div>
                                    </div>

                                    {/* Minimal Image Upload */}
                                    {/* Minimal Image Upload */}
                                    <div
                                        className="border border-green-400/30 border-dashed p-4 text-center hover:bg-green-400/5 cursor-pointer transition-colors group relative overflow-hidden"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                        />
                                        {logoBase64 ? (
                                            <img src={logoBase64} alt="Preview" className="w-16 h-16 mx-auto object-cover rounded-full border border-green-400 mb-2" />
                                        ) : (
                                            <ImageIcon className="w-8 h-8 text-green-400/40 mx-auto mb-2 group-hover:text-green-400" />
                                        )}
                                        <p className="text-[10px] uppercase font-bold text-green-400/60 group-hover:text-green-400">
                                            {logoBase64 ? 'Click to Change Image' : 'Drag Image or Click to Upload'}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleLaunch}
                                        disabled={isLaunching || !canLaunch}
                                        className="w-full py-4 bg-green-400 text-black font-black text-lg uppercase tracking-widest hover:bg-green-300 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(74,222,128,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLaunching ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                {launchStatus}
                                            </>
                                        ) : !canLaunch ? (
                                            'LOCKED (HOLD 1M STUDIO)'
                                        ) : (
                                            'LAUNCH TOKEN'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Simplified Status Bar */}
                    <div className="h-8 border-t border-green-400/30 flex items-center justify-between px-3 text-[10px] uppercase bg-black text-green-400/50">
                        <span>Status: {hasInitialized ? 'ONLINE' : 'IDLE'}</span>
                        <span>{connected ? 'Wallet: Connected' : 'Wallet: Disconnected'}</span>
                    </div>
                </div>
            </DraggableWindow>
        </div>
    );
}
