'use client';

// Polyfills for Solana Wallet Adapter + Next.js 14 compatibility
// These must be imported BEFORE any wallet adapter or UI components.

if (typeof window !== 'undefined') {
    // 1. setImmediate/clearImmediate polyfill
    // Required by many crypto libraries used in Wallet Adapters
    if (!window.setImmediate) {
        // @ts-ignore
        window.setImmediate = function (callback: any) {
            return setTimeout(callback, 0);
        };
    }
    if (!window.clearImmediate) {
        // @ts-ignore
        window.clearImmediate = function (id: any) {
            clearTimeout(id);
        };
    }

    // 2. Buffer polyfill (if needed, though Next usually handles this)
    // Sometimes required for older wallet adapters
}

// Optimization: Ensure Symbol.dispose doesn't crash SES by being accessed too early?
// Currently primarily handling globals.

// @ts-ignore
if (typeof Symbol.dispose === 'undefined') {
    // @ts-ignore
    Object.defineProperty(Symbol, 'dispose', {
        value: Symbol('dispose'),
        writable: false,
        configurable: false,
        enumerable: false,
    });
}

// @ts-ignore
if (typeof Symbol.asyncDispose === 'undefined') {
    // @ts-ignore
    Object.defineProperty(Symbol, 'asyncDispose', {
        value: Symbol('asyncDispose'),
        writable: false,
        configurable: false,
        enumerable: false,
    });
}
