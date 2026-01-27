"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL = 30000;

export function LiveUpdateListener() {
    const router = useRouter();
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const res = await fetch("/version.json?t=" + Date.now());
                if (!res.ok) return;
                const data = await res.json();
                const serverVersion = data.version;

                if (!currentVersion) {
                    setCurrentVersion(serverVersion);
                } else if (serverVersion !== currentVersion) {
                    console.log(
                        `[LiveUpdate] New version detected: ${serverVersion}. Refreshing...`
                    );
                    setCurrentVersion(serverVersion);
                    router.refresh();
                }
            } catch (err) {
                // Ignore errors
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [currentVersion, router]);

    return null;
}
