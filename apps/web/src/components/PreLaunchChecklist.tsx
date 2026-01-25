'use client';

import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import DraggableWindow from './DraggableWindow';

interface PreLaunchChecklistProps {
    isOpen: boolean;
    onClose: () => void;
    config: {
        name: string; // Project name - matches Project.name
        ticker: string;
        type: string;
        description: string;
        twitterHandle: string;
        telegramLink: string;
        websiteUrl: string;
    };
    media: Array<{ role?: string }>;
    solBalance: number;
    requiredSol: number;
}

interface ChecklistItem {
    id: string;
    label: string;
    required: boolean;
    check: () => boolean;
}

export default function PreLaunchChecklist({
    isOpen,
    onClose,
    config,
    media,
    solBalance,
    requiredSol,
}: PreLaunchChecklistProps) {
    const hasLogo = media.some(m => m.role === 'logo');
    const hasBanner = media.some(m => m.role === 'banner');

    const items: ChecklistItem[] = [
        {
            id: 'projectName',
            label: 'Project Name',
            required: true,
            check: () => config.name.trim().length > 0,
        },
        {
            id: 'ticker',
            label: 'Ticker Symbol',
            required: true,
            check: () => config.ticker.trim().length > 0,
        },
        {
            id: 'description',
            label: 'Description',
            required: true,
            check: () => config.description.trim().length >= 20, // Minimum length
        },
        {
            id: 'logo',
            label: 'Logo',
            required: true,
            check: () => hasLogo,
        },
        {
            id: 'social',
            label: 'Social Links (Twitter/Telegram)',
            required: false,
            check: () => config.twitterHandle.trim().length > 0 || config.telegramLink.trim().length > 0,
        },
        {
            id: 'solBalance',
            label: `SOL Balance (Need ${requiredSol} SOL)`,
            required: true,
            check: () => solBalance >= requiredSol,
        },
    ];

    const completed = items.filter(item => item.check()).length;
    const requiredCompleted = items.filter(item => item.required && item.check()).length;
    const totalRequired = items.filter(item => item.required).length;
    const canLaunch = requiredCompleted === totalRequired;

    return (
        <DraggableWindow
            title="PRE-LAUNCH CHECKLIST"
            onClose={onClose}
            defaultPosition={{
                x: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 450,
                y: 100
            }}
            defaultSize={{
                width: typeof window !== 'undefined' && window.innerWidth < 768 ? window.innerWidth - 20 : 400,
                height: typeof window !== 'undefined' && window.innerHeight < 800 ? window.innerHeight - 100 : 500
            }}
            zIndex={30}
            className="!bg-black !border-2 !border-green-400 !rounded-none !shadow-[4px_4px_0px_0px_rgba(74,222,128,0.3)]"
            headerClassName="!bg-black !border-b-2 !border-green-400 !h-12"
        >
            <div className="h-full flex flex-col text-green-400 font-mono p-6 space-y-4">
                {/* Status Header */}
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold uppercase">Launch Readiness</span>
                    <div className={`px-3 py-1 border-2 text-xs font-bold ${
                        canLaunch
                            ? 'bg-green-400/20 text-green-400 border-green-400'
                            : 'bg-yellow-400/20 text-yellow-400 border-yellow-400'
                    }`}>
                        {requiredCompleted}/{totalRequired} Required
                    </div>
                </div>
                <div className="text-xs text-green-400/70 border-b border-green-400/30 pb-4">
                    {completed}/{items.length} Complete
                </div>

                {/* Checklist Items */}
                <div className="flex-1 overflow-y-auto space-y-3">
                    {items.map((item) => {
                        const isComplete = item.check();
                        return (
                            <div
                                key={item.id}
                                className={`flex items-start gap-3 p-3 border rounded ${
                                    isComplete
                                        ? 'border-green-400/30 bg-green-400/5'
                                        : item.required
                                        ? 'border-yellow-400/30 bg-yellow-400/5'
                                        : 'border-green-400/10 bg-green-400/5'
                                }`}
                            >
                                <div className="mt-0.5">
                                    {isComplete ? (
                                        <CheckCircle2 size={18} className="text-green-400" />
                                    ) : item.required ? (
                                        <XCircle size={18} className="text-yellow-400" />
                                    ) : (
                                        <AlertCircle size={18} className="text-green-400/50" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold">
                                        {item.label}
                                        {item.required && (
                                            <span className="ml-1 text-yellow-400">*</span>
                                        )}
                                    </div>
                                    {!isComplete && item.id === 'description' && (
                                        <div className="text-xs text-yellow-400/70 mt-1">
                                            Minimum 20 characters
                                        </div>
                                    )}
                                    {!isComplete && item.id === 'solBalance' && (
                                        <div className="text-xs text-yellow-400/70 mt-1">
                                            Current: {solBalance.toFixed(4)} SOL
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-green-400/30">
                    {canLaunch ? (
                        <div className="text-center p-3 bg-green-400/10 border border-green-400/30 rounded">
                            <div className="text-sm font-bold text-green-400 mb-1">
                                ✓ Ready to Launch
                            </div>
                            <div className="text-xs text-green-400/70">
                                All required fields are complete
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-3 bg-yellow-400/10 border border-yellow-400/30 rounded">
                            <div className="text-sm font-bold text-yellow-400 mb-1">
                                Missing Required Fields
                            </div>
                            <div className="text-xs text-yellow-400/70">
                                Complete all required items to launch
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
}
