// js/pwa.js
export let deferredPrompt;

export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/service-worker.js');
            if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) location.reload();
                });
            });

            setInterval(() => reg.update(), 30000);
            reg.update();

        } catch (e) { console.error('SW registration error:', e); }
    }
}

export function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
    });
}
