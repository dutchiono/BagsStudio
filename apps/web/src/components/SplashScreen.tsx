'use client';

import { useState, useEffect } from 'react';

export default function SplashScreen() {
    const [visible, setVisible] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string>('');

    useEffect(() => {
        // Check if user has seen splash
        const hasSeenSplash = localStorage.getItem('hasSeenSplash');
        if (hasSeenSplash) {
            setVisible(false);
            return;
        }

        // Determine video source based on orientation
        const isMobile = window.innerHeight > window.innerWidth;
        setVideoSrc(isMobile ? '/bags-mobile.mp4' : '/bags-full-demo.mp4');
    }, []);

    const handleExit = () => {
        setFadeOut(true);
        setTimeout(() => {
            setVisible(false);
            localStorage.setItem('hasSeenSplash', 'true');
        }, 500); // 500ms fade out duration
    };

    if (!visible) return null;

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
            {videoSrc && (
                <video
                    src={videoSrc}
                    autoPlay
                    muted
                    playsInline
                    onEnded={handleExit}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )}

            <button
                onClick={handleExit}
                className="absolute top-3 right-3 sm:top-6 sm:right-6 z-50 px-3 py-1.5 sm:px-6 sm:py-2 bg-black/50 hover:bg-black/80 text-white border border-white/20 hover:border-white/50 backdrop-blur-sm rounded-full font-mono text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 flex items-center gap-1 sm:gap-2 group"
            >
                Skip
                <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>

            {/* Optional Loading/Buffering Indicator if needed, or simple black bg is fine */}
        </div>
    );
}
