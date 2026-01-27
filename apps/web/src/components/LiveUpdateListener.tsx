"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Polling interval in milliseconds (e.g., 30 seconds)
const POLL_INTERVAL = 30000;

export function LiveUpdateListener() {
    const router = useRouter();
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    useEffect(() => {
        // 1. Initial Fetch
        const checkVersion = async () => {
            try {
                const res = await fetch("/version.json?t=" + Date.now());
                if (!res.ok) return;
                const data = await res.json();
                const serverVersion = data.version;

                if (!currentVersion) {
                    // First load - set version
                    setCurrentVersion(serverVersion);
                } else if (serverVersion !== currentVersion) {
                    // Version mismatch - Trigger Soft Refresh
                    console.log(
                        `[LiveUpdate] New version detected: ${serverVersion}. Refreshing...`
                    );
                    setCurrentVersion(serverVersion);
                    router.refresh(); // Next.js App Router Soft Refresh
                }
            } catch (err) {
                // Ignore errors (offline, etc)
            }
        };

        checkVersion();

        // 2. Poll
        const interval = setInterval(checkVersion, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [currentVersion, router]);

    return null; // Headless component
}
