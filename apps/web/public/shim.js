// NUCLEAR SES SHIM
// Prevent "Lockdown failed" crash by neutralizing SES before it loads
if (typeof window !== 'undefined') {
    try {
        if (window.Symbol && window.Symbol.dispose) {
            // Attempt to delete, but ignore if it fails
            try { delete window.Symbol.dispose; } catch (e) { }
        }
    } catch (e) { }

    if (!window.lockdown) {
        window.lockdown = function () { console.warn('Nuclear SES Shim: lockdown() intercepted'); };
        window.harden = function (x) { return x; };
        window.Compartment = function () { };
    }
}
