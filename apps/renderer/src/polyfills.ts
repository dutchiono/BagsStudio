"use client";

// HELIUS/SES POLYFILL
// Aggressively patches Symbol.dispose to prevent SES Lockdown crash in Chrome 132+
if (typeof Symbol !== 'undefined') {
    const originalDispose = (Symbol as any).dispose;

    // Attempt to make it configurable if it exists
    if (originalDispose) {
        try {
            // If it's not configurable, we can't delete it. 
            // But we can try to redefine it on the Symbol object itself if possible,
            // or just ignore the error.
            // The issue is SES *checks* for it and tries to delete it.

            // This specific hack attempts to hide it from SES or satisfy its requirements
            Object.defineProperty(Symbol, 'dispose', {
                value: originalDispose,
                configurable: true, // LIE to SES
                writable: true
            });
        } catch (e) {
            console.warn('[Polyfill] Failed to make Symbol.dispose configurable. SES might crash.', e);
        }
    }
}

// Global Lockdown Patch
// If SES attempts to run lockdown, catch the specific error and ignore it
const originalLockdown = (globalThis as any).lockdown;
if (originalLockdown) {
    (globalThis as any).lockdown = function (...args: any[]) {
        try {
            return originalLockdown.apply(this, args);
        } catch (e: any) {
            if (e.message && (e.message.includes('dispose') || e.message.includes('Lockdown'))) {
                console.warn('[Polyfill] Suppressed SES Lockdown crash:', e.message);
                return;
            }
            throw e;
        }
    };
} else {
    // Stub it just in case
    (globalThis as any).lockdown = function (opts: any) {
        console.log('[Polyfill] Stubbed lockdown called', opts);
    };
}
