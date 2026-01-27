"use client";

import { useEffect } from "react";

export function ClientPolyfills() {
    useEffect(() => {
        if (typeof window !== "undefined") {
            // 3. THE SILENCER: Block requests to 'assets.localuniverse.io' to stop the 404 spam.
            const originalOpen = XMLHttpRequest.prototype.open;
            // @ts-ignore
            XMLHttpRequest.prototype.open = function (method: any, url: any, ...args: any[]) {
                if (typeof url === "string" && url.includes("assets.localuniverse.io")) {
                    // console.debug('[Silencer] Blocked request to:', url);
                    // @ts-ignore
                    arguments[1] =
                        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACAgAAZGF0YQQAAAAAAA==";
                }
                // @ts-ignore
                return originalOpen.apply(this, [method, url, ...args] as any);
            };

            // D. Console Filter
            const originalConsoleError = console.error;
            console.error = function (...args) {
                const msg = args[0];
                if (typeof msg === "string") {
                    if (
                        msg.includes("Lockdown failed") ||
                        msg.includes("Cannot delete property 'dispose'")
                    ) {
                        return; // Suppress
                    }
                }
                originalConsoleError.apply(console, args);
            };
        }
    }, []);

    return null;
}
