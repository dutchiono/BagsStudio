'use client';

import DraggableWindow from '@/components/DraggableWindow';
import SplashScreen from '@/components/SplashScreen';
import { TerminalWalletButton } from "@/components/TerminalWalletButton";
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useSolBalance } from '@/hooks/useSolBalance';
import { useWallet } from '@solana/wallet-adapter-react';
import { Terminal, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, useEffect } from 'react';

// Centralized Project Config interface
interface ProjectConfig {
    name: string; // Project name - matches Project.name in database
    ticker: string;
    type: 'MEME COIN' | 'UTILITY' | 'NFT';
    description: string;
    twitterHandle: string;
    telegramLink: string;
    websiteUrl: string;
    logoUrl: string | null; // Deprecated - use media assignments instead
}

interface MediaAssignment {
    filename: string;
    role: 'logo' | 'banner' | 'mascot' | 'icon' | 'background' | 'other';
}

const initialConfig: ProjectConfig = {
    name: '', // Project name - matches Project.name in database
    ticker: '',
    type: 'MEME COIN',
    description: '',
    twitterHandle: '',
    telegramLink: '',
    websiteUrl: '',
    logoUrl: null,
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
    const { connected, publicKey } = useWallet();

    // COMING SOON MODE (For GitHub Pages / Public Teaser)
    if (process.env.NEXT_PUBLIC_MODE === 'coming_soon') {
        return (
            <div className="min-h-screen bg-black text-green-400 font-mono flex flex-col items-center justify-center p-4 selection:bg-green-400 selection:text-black relative overflow-hidden">
                {/* Grid Background */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(#4ade80 1px, transparent 1px), linear-gradient(90deg, #4ade80 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                />

                <div className="z-10 text-center space-y-8 max-w-2xl">
                    <div className="animate-pulse">
                        <Zap className="w-24 h-24 mx-auto text-green-400 mb-6" />
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter glitch-text">
                        BAGS.FM
                    </h1>

                    <div className="border-2 border-green-400 p-8 bg-black/80 backdrop-blur-sm shadow-[0_0_50px_rgba(74,222,128,0.2)]">
                        <div className="flex items-center gap-3 justify-center mb-6 text-xl font-bold tracking-widest uppercase border-b border-green-400/30 pb-4">
                            <Terminal size={24} />
                            <span>System Upgrade In Progress</span>
                        </div>

                        <p className="text-lg md:text-xl text-green-400/80 leading-relaxed mb-6">
                            The Architect is reconstructing the reality engine.
                            <br />
                            We are preparing for the next cycle of meme coin generation.
                        </p>

                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-400/10 border border-green-400 rounded text-sm font-bold uppercase animate-pulse">
                            <span className="w-2 h-2 bg-green-400 rounded-full" />
                            Status: Building V2
                        </div>
                    </div>

                    <div className="flex justify-center gap-6 text-green-400/60">
                        <a href="#" className="hover:text-green-400 transition-colors uppercase text-sm tracking-wider">[ Twitter ]</a>
                        <a href="#" className="hover:text-green-400 transition-colors uppercase text-sm tracking-wider">[ Telegram ]</a>
                    </div>
                </div>
            </div>
        );
    }


    // Window states - simplified: only agent chat visible by default
    const [windows, setWindows] = useState({
        config: false,    // Project Config (hidden by default)
        agentChat: true,  // AI Chat (visible by default)
        media: false,     // Media Library (hidden by default)
        checklist: false, // Pre-Launch Checklist (hidden by default)
    });

    // Centralized Project Config state
    const [config, setConfig] = useState<ProjectConfig>(initialConfig);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isCreatingProject, setIsCreatingProject] = useState(false);

    // Media States (upload/generation moved to MediaWindow)
    const [mediaFiles, setMediaFiles] = useState<Array<{ role?: string }>>([]);
    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean, cost: number, address: string } | null>(null);

    // Gating
    const { hasAccess } = useTokenBalance();
    const {
        balance: solBalance,
        hasEnoughForLaunch,
        minRequiredForLaunch,
        shortfallForLaunch,
        hasEnoughForDeployment,
        deploymentFee,
        minRequiredForDeployment,
        shortfallForDeployment
    } = useSolBalance();
    const [tokenGateModal, setTokenGateModal] = useState({ isOpen: false });

    const handleDeployClick = () => {
        setTokenGateModal({ isOpen: true });
    };

    // Smart config update - only updates empty fields unless forced
    const updateConfig = useCallback((updates: Partial<ProjectConfig>, force = false) => {
        setConfig(prev => {
            const merged = { ...prev };
            for (const [key, value] of Object.entries(updates)) {
                const k = key as keyof ProjectConfig;
                // Only update if: field is empty, force is true, or it's a type change
                if (force || !prev[k] || k === 'type') {
                    (merged as any)[k] = value;
                }
            }
            return merged;
        });
    }, []);

    // Chat states
    const [chatInput, setChatInput] = useState('');
    const [hasInitialized, setHasInitialized] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ type: string; content: string; isLoading?: boolean }[]>([
        { type: 'ai', content: 'Connect your wallet, then click **Initialize website** to create your project. After that, tell me what you want to build (e.g. "Create a site about slopMachine" or "Build a meme coin page for DogCoin").' }
    ]);
    const [isStreaming, setIsStreaming] = useState(false);

    // Use relative URL in production, localhost in development
    const BUILDER_API = process.env.NEXT_PUBLIC_BUILDER_API_URL ||
        (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
            ? '' // Use relative URLs in production (nginx handles /api routing)
            : 'http://localhost:3042');

    const toggleWindow = (key: keyof typeof windows) => {
        setWindows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Create or load project for current wallet
    const ensureProject = async (): Promise<string> => {
        if (projectId) {
            console.log('[Project] Using existing project ID:', projectId);
            return projectId;
        }

        setIsCreatingProject(true);
        try {
            if (!publicKey || !connected) {
                throw new Error('Please connect your wallet first');
            }

            const walletAddress = publicKey.toBase58();
            const name = config.name || `Project-${Date.now()}`;

            // 1) Try existing project ID from localStorage for this wallet
            const storageKey = `bagsstudio:project:${walletAddress}`;
            const storedId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

            if (storedId) {
                try {
                    console.log('[Project] Attempting to reuse stored project ID from localStorage:', storedId);
                    const existingRes = await fetch(`${BUILDER_API}/api/projects/${storedId}`);
                    if (existingRes.ok) {
                        const existingData = await existingRes.json();
                        setProjectId(storedId);
                        if (existingData.previewUrl) {
                            setPreviewUrl(existingData.previewUrl);
                        }
                        console.log('[Project] Reused stored project from server:', existingData.project);
                        return storedId;
                    }
                } catch (e) {
                    console.warn('[Project] Stored project ID invalid, will create or load latest:', e);
                }
            }

            // 2) Try to find latest project for this wallet on the server
            try {
                console.log('[Project] Looking up latest project for wallet:', walletAddress);
                const walletRes = await fetch(`${BUILDER_API}/api/projects/wallet/${walletAddress}`);
                if (walletRes.ok) {
                    const walletData = await walletRes.json();
                    const latest = Array.isArray(walletData.projects) && walletData.projects.length > 0
                        ? walletData.projects[0]
                        : null;
                    if (latest?.id) {
                        console.log('[Project] Found existing project for wallet:', latest.id);
                        const projectRes = await fetch(`${BUILDER_API}/api/projects/${latest.id}`);
                        if (projectRes.ok) {
                            const projectData = await projectRes.json();
                            setProjectId(latest.id);
                            if (projectData.previewUrl) {
                                setPreviewUrl(projectData.previewUrl);
                            }
                            if (typeof window !== 'undefined') {
                                localStorage.setItem(storageKey, latest.id);
                            }
                            return latest.id;
                        }
                    }
                }
            } catch (e) {
                console.warn('[Project] Failed to load existing projects by wallet, will create new:', e);
            }

            // 3) Fallback: create a new project
            console.log('[Project Creation] Creating project with wallet:', walletAddress);

            const response = await fetch(`${BUILDER_API}/api/projects/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, name }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || 'Failed to create project';
                console.error('[Project Creation] Error:', {
                    error: errorMessage,
                    walletAddress,
                    status: response.status,
                    details: errorData
                });
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('[Project Creation] Response data:', data);

            const newProjectId = data.project?.id || data.projectId;
            if (!newProjectId) {
                console.error('[Project Creation] No project ID in response:', data);
                throw new Error('Project ID not returned from server');
            }
            setProjectId(newProjectId);
            if (data.previewUrl) {
                setPreviewUrl(data.previewUrl);
            }
            if (typeof window !== 'undefined') {
                localStorage.setItem(storageKey, newProjectId);
            }

            // Optionally load additional project details (config, etc.)
            try {
                const projectResponse = await fetch(`${BUILDER_API}/api/projects/${newProjectId}`);
                if (projectResponse.ok) {
                    const projectData = await projectResponse.json();
                    if (projectData.project) {
                        console.log('[Project] Loaded project:', projectData.project);
                    }
                }
            } catch (e) {
                console.warn('[Project] Could not load project details:', e);
            }

            console.log('[Project] Created project with ID:', newProjectId);
            return newProjectId;
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleInitializeWebsite = async () => {
        if (!publicKey || !connected) return;
        try {
            const pid = await ensureProject();
            if (pid) {
                setHasInitialized(true);
                setChatMessages(prev => prev.map((m, i) => i === 0
                    ? { ...m, content: 'Ready! Tell me what you want to create and I\'ll build it. For example: "Create a site about slopMachine" or "Build a meme coin page for DogCoin".' }
                    : m));
            }
        } catch (e) {
            console.error('[Init]', e);
            setChatMessages(prev => [...prev, { type: 'ai', content: `❌ Failed to initialize: ${(e as Error).message}` }]);
        }
    };

    const handleSendMessage = async () => {
        if (!hasInitialized || !chatInput.trim() || isStreaming) return;

        const userMessage = chatInput;

            // Add user message IMMEDIATELY
        setChatMessages(prev => [...prev, { type: 'user', content: userMessage }]);
        setChatInput('');

        // Add "working on it" message IMMEDIATELY (before any async operations)
        setChatMessages(prev => {
            console.log('[Chat] Adding loading message immediately, current messages:', prev.length);
            return [...prev, { type: 'ai', content: '⚙️ Working on it...', isLoading: true }];
        });

        setIsStreaming(true);

        // Small delay to ensure React renders both messages
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const pid = await ensureProject();

            if (!pid) {
                throw new Error('Failed to get project ID. Please create a project first.');
            }

            console.log('[Chat] Sending message to project:', pid);

            const response = await fetch(`${BUILDER_API}/api/projects/${pid}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    llmConfig: { provider: 'openai', model: 'gpt-4o' },
                    projectConfig: config, // Pass current config so AI knows what's filled
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Chat] Request failed:', response.status, errorText);
                throw new Error(`Chat request failed: ${response.status} - ${errorText}`);
            }

            // Handle SSE streaming
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let fullResponse = '';
                let hasReceivedFirstChunk = false;
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
                                console.log('[Chat] Received SSE message:', parsed.type, parsed.message || parsed.content?.substring(0, 50));

                                if (parsed.type === 'status') {
                                    // Status update from backend (play-by-play)
                                    setChatMessages(prev => {
                                        const updated = [...prev];
                                        if (updated.length > 0) {
                                            updated[updated.length - 1] = {
                                                type: 'ai',
                                                content: `⚙️ ${parsed.message}`,
                                                isLoading: true
                                            };
                                        }
                                        return updated;
                                    });
                                } else if (parsed.type === 'chunk') {
                                    // First chunk - replace loading message with actual content
                                    if (!hasReceivedFirstChunk) {
                                        hasReceivedFirstChunk = true;
                                        setChatMessages(prev => {
                                            const updated = [...prev];
                                            if (updated.length > 0) {
                                                updated[updated.length - 1] = { type: 'ai', content: '', isLoading: false };
                                            }
                                            return updated;
                                        });
                                    }
                                    fullResponse += parsed.content;
                                    setChatMessages(prev => {
                                        const updated = [...prev];
                                        if (updated.length > 0) {
                                            updated[updated.length - 1] = { type: 'ai', content: fullResponse, isLoading: false };
                                        }
                                        return updated;
                                    });
                                } else if (parsed.type === 'config_update') {
                                    console.log('Received config update:', parsed.updates);
                                    updateConfig(parsed.updates);
                                } else if (parsed.type === 'done') {
                                    const finalContent = (parsed.content || fullResponse || '').trim();
                                    const displayContent = finalContent
                                        ? finalContent
                                        : (parsed.previewUrl
                                            ? '✅ Done. Your preview is ready — check the panel on the left.'
                                            : '✅ Done. Check the preview panel on the left.');
                                    setChatMessages(prev => {
                                        const updated = [...prev];
                                        if (updated.length > 0) {
                                            updated[updated.length - 1] = { type: 'ai', content: displayContent, isLoading: false };
                                        }
                                        return updated;
                                    });

                                    if (parsed.previewUrl) {
                                        console.log('[Chat] Using preview URL from stream:', parsed.previewUrl);
                                        setPreviewUrl(parsed.previewUrl);
                                    } else {
                                        // Fallback: fetch project to get (and potentially start) preview
                                        const pid = projectId || await ensureProject();
                                        if (pid) {
                                            try {
                                                const projectRes = await fetch(`${BUILDER_API}/api/projects/${pid}`);
                                                if (projectRes.ok) {
                                                    const projectData = await projectRes.json();
                                                    if (projectData.previewUrl) {
                                                        console.log('[Chat] Fetched preview URL after completion:', projectData.previewUrl);
                                                        setPreviewUrl(projectData.previewUrl);
                                                    }
                                                }
                                            } catch (e) {
                                                console.warn('[Chat] Could not fetch preview URL:', e);
                                            }
                                        }
                                    }
                                } else if (parsed.type === 'error') {
                                    console.error('Stream error:', parsed.error);
                                    fullResponse += `\n[Error: ${parsed.error}]`;
                                    setChatMessages(prev => {
                                        const updated = [...prev];
                                        updated[updated.length - 1] = { type: 'ai', content: fullResponse, isLoading: false };
                                        return updated;
                                    });
                                }
                            } catch (e) {
                                console.error('Failed to parse SSE message:', e);
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            setChatMessages(prev => {
                const updated = [...prev];
                // Replace loading message with error
                if (updated.length > 0 && updated[updated.length - 1].isLoading) {
                    updated[updated.length - 1] = {
                type: 'ai',
                        content: `❌ Error: ${error.message || 'Failed to get response from AI'}`,
                        isLoading: false
                    };
                } else {
                    updated.push({
                        type: 'ai',
                        content: `❌ Error: ${error.message || 'Failed to get response from AI'}`,
                        isLoading: false
                    });
                }
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && hasInitialized && !isStreaming) handleSendMessage();
    };

    // Note: File upload and branding generation moved to MediaWindow component

    return (
        <div className="min-h-screen bg-black text-green-400 font-mono selection:bg-green-400 selection:text-black">

            <SplashScreen />

            <PaymentModal
                isOpen={paymentModal?.isOpen}
                cost={paymentModal?.cost}
                address={paymentModal?.address}
                onClose={() => setPaymentModal(null)}
                onConfirm={() => handleAIGenerate(true)}
            />

            {/* Header (Unified with Scanner) */}
            <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 bg-black border-b-2 border-green-400 z-[100] flex items-center justify-between px-2 sm:px-4 md:px-6 overflow-hidden">
                <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0 flex-1">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-400 flex-shrink-0" fill="currentColor" />
                        <h1 className="text-sm sm:text-base md:text-xl font-bold tracking-wider truncate">BAGS.FM STUDIO</h1>
                    </div>

                    <nav className="hidden sm:flex items-center gap-1 flex-shrink-0">
                        <div className="flex items-center border border-green-400 rounded-sm overflow-hidden">
                            <button className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 bg-green-400 text-black font-bold text-[10px] sm:text-xs uppercase">
                                Studio
                            </button>
                            <Link
                                href="/scanner"
                                className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 bg-black text-green-400 hover:bg-green-400/10 font-medium text-[10px] sm:text-xs uppercase transition-colors"
                            >
                                Scanner
                            </Link>
                        </div>
                    </nav>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
                    {/* Window Toggle - Chat only */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <button
                            onClick={() => toggleWindow('agentChat')}
                            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 border border-green-400 rounded-sm text-[10px] sm:text-xs transition-all uppercase ${windows.agentChat
                                ? 'bg-green-400 text-black font-bold'
                                : 'text-green-400 hover:bg-green-400/10'
                                }`}
                        >
                            <Terminal size={12} className="sm:w-3.5 sm:h-3.5 md:w-3.5 md:h-3.5" />
                            <span className="hidden md:inline">Chat</span>
                        </button>
                    </div>

                    <div className="hidden sm:block">
                        <TerminalWalletButton />
                    </div>
                </div>
            </header>

            {/* Main Content Area (Canvas) */}
            <div className="fixed inset-0 pt-14 sm:pt-16 z-0 bg-black">
                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.1] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(#4ade80 1px, transparent 1px), linear-gradient(90deg, #4ade80 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                />

                {/* Preview iframe or Waiting message */}
                {previewUrl ? (
                    <iframe
                        src={previewUrl}
                        className="w-full h-full border-0"
                        title="Project Preview"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                        <div className="text-center space-y-2 opacity-20 select-none">
                            <h2 className="text-4xl font-bold text-green-400">STUDIO ENVIRONMENT</h2>
                            <p className="text-sm text-green-400">
                                {hasInitialized && projectId ? 'INITIALIZING PREVIEW...' : !hasInitialized && connected ? 'INITIALIZE WEBSITE TO START' : 'CONNECT WALLET TO START'}
                            </p>
                        </div>
                        {connected && !hasInitialized && (
                            <button
                                onClick={handleInitializeWebsite}
                                disabled={isCreatingProject}
                                className="px-6 py-3 border-2 border-green-400 bg-green-400/10 text-green-400 font-bold uppercase tracking-wider hover:bg-green-400 hover:text-black transition-colors disabled:opacity-50 pointer-events-auto"
                            >
                                {isCreatingProject ? 'Initializing…' : 'Initialize website'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Floating Windows Layer - Agent Chat only */}
            <div className="fixed inset-0 pt-16 pointer-events-none z-10">

                {/* Agent Chat Window */}
                {windows.agentChat && (
                    <DraggableWindow
                        title="AI ARCHITECT"
                        defaultPosition={{ x: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 1080, y: 100 }}
                        defaultSize={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? window.innerWidth - 20 : 500, height: typeof window !== 'undefined' && window.innerHeight < 800 ? window.innerHeight - 100 : 700 }}
                        onClose={() => toggleWindow('agentChat')}
                        onFocus={() => { }}
                        zIndex={50}
                        className="!bg-black !border-2 !border-green-400 !rounded-none !shadow-[4px_4px_0px_0px_rgba(74,222,128,0.3)]"
                        headerClassName="!bg-black !border-b-2 !border-green-400 !h-12"
                    >
                        <div className="h-full flex flex-col bg-black">
                            <div className="p-4 border-b-2 border-green-400 flex items-center gap-4 bg-black/50">
                                <div className="w-10 h-10 border-2 border-green-400 flex items-center justify-center bg-green-400/10">
                                    <Terminal size={20} className="text-green-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-green-400">ARCHITECT v2.1</div>
                                    <div className="text-xs text-green-400/60 uppercase">System Online</div>
                                </div>
                            </div>

                            <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 sm:space-y-6 font-mono text-xs sm:text-sm">
                                {chatMessages.map((msg, idx) => (
                                    <div key={idx} className="flex gap-2 sm:gap-4">
                                        <div className={`text-[10px] sm:text-xs font-bold pt-1 flex-shrink-0 ${msg.type === 'ai' ? 'text-green-400' : 'text-purple-400'}`}>
                                            {msg.type === 'ai' ? 'SYS:' : 'USR:'}
                                        </div>
                                        <div className={`p-2 sm:p-3 md:p-4 border text-xs sm:text-sm leading-relaxed min-w-0 flex-1 max-w-[85%] sm:max-w-[90%] shadow-[2px_2px_0px_0px_rgba(74,222,128,0.2)] break-words ${msg.type === 'ai'
                                            ? 'border-green-400 bg-green-400/5 text-green-400'
                                            : 'border-purple-500 bg-purple-500/10 text-purple-300'
                                            }`}>
                                            <div className="flex items-start gap-2 flex-wrap">
                                                <span className="break-words whitespace-pre-wrap">{msg.content}</span>
                                                {msg.isLoading && (
                                                    <span className="inline-flex items-center gap-1 sm:gap-1.5 ml-2 flex-shrink-0">
                                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></span>
                                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></span>
                                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-2 sm:p-3 md:p-4 border-t-2 border-green-400 bg-black">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={hasInitialized ? 'ENTER INSTRUCTION...' : 'Initialize website first (left panel)'}
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={!hasInitialized}
                                        className="w-full bg-black border-2 border-green-400 pl-3 sm:pl-4 pr-10 sm:pr-12 py-2 sm:py-3 text-xs sm:text-sm text-green-400 placeholder-green-400/30 focus:outline-none focus:bg-green-400/5 transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!hasInitialized || isStreaming}
                                        className="absolute right-1.5 sm:right-2 top-1.5 sm:top-2 p-1 sm:p-1.5 hover:bg-green-400 text-green-400 hover:text-black transition-colors rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Zap size={14} className="sm:w-4 sm:h-4 md:w-[18px] md:h-[18px]" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                )}

            </div>
            {/* CA + Attribution Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-black border-t-2 border-green-400 p-2 z-[60] flex items-center justify-between px-2 sm:px-4 md:px-6 gap-2 sm:gap-4 overflow-hidden">
                <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm font-bold text-green-400 min-w-0">
                    <span className="hidden md:inline text-green-400/60 uppercase tracking-wider">Official Contract:</span>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText('ByDynkVWNYENQNYcZsrDMWEPSS2ZxYM922sPyaxsBAGS');
                            alert('CA Copied to clipboard!');
                        }}
                        className="font-mono bg-green-400/10 px-2 sm:px-3 py-1 rounded border border-green-400/30 hover:bg-green-400 hover:text-black transition-colors flex items-center gap-1 sm:gap-2 group min-w-0"
                    >
                        <span className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-none text-[9px] sm:text-[10px] md:text-xs">ByDynkVWNYENQNYcZsrDMWEPSS2ZxYM922sPyaxsBAGS</span>
                        <div className="opacity-50 group-hover:opacity-100 uppercase text-[8px] sm:text-[10px] tracking-wide flex-shrink-0">[COPY]</div>
                    </button>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-[8px] sm:text-[9px] md:text-xs text-green-400/70 uppercase tracking-wider">
                    <span>Built on</span>
                    <span className="font-bold text-green-400">elizaOS</span>
                </div>
            </div>

        </div>
    );
}
