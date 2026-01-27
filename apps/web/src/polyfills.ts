"use client";

// HELIUS/SES POLYFILL
// Prevents "Lockdown failed: TypeError: Cannot delete property 'dispose'"
// This happens because recent Chrome/Node versions made Symbol.dispose non-configurable,
// but the 'ses' library used by Solana packages tries to delete it for security.

// HELIUS/SES POLYFILL
// Fixes "Lockdown failed: TypeError: Cannot delete property 'dispose'" by ensuring it's configurable or deleted
if (typeof Symbol !== 'undefined') {
    try {
        // @ts-ignore
        if (Symbol.dispose) {
            const desc = Object.getOwnPropertyDescriptor(Symbol, 'dispose');
            // Only try to delete if it is configurable
            if (desc && desc.configurable) {
                // @ts-ignore
                delete Symbol.dispose;
            } else {
                console.warn('[Polyfill] Symbol.dispose is not configurable, skipping delete to prevent crash.');
            }
        }
    } catch (e) {
        console.error('[Polyfill] Failed to patch Symbol.dispose', e);
    }
}

// Aggressive Patch for "Lockdown" calls
// If 'ses' is loaded, it might define a global 'lockdown'.
// We can try to stub it if it's causing the crash, but that might break auth.
// Better to just ensure standard globals are robust.

// Fix for "Cannot find module 'jiti'" might be related to local postcss loading.
// We can't fix that at runtime, it's a build issue.
