// js/pwa.js
export let deferredPrompt;

export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/service-worker.js');
            console.log('[PWA] Service Worker registered');
            
            // Si hay un SW esperando, activarlo inmediatamente
            if (reg.waiting) {
                console.log('[PWA] SW waiting detected, forcing activation');
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // Detectar nuevas actualizaciones
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                console.log('[PWA] New SW found, installing...');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA] New SW installed, reloading...');
                        // Mostrar notificación antes de recargar
                        showUpdateNotification();
                        setTimeout(() => location.reload(), 2000);
                    }
                });
            });

            // Verificar actualizaciones cada 30 segundos
            setInterval(() => reg.update(), 30000);
            
            // Verificar inmediatamente
            reg.update();

            // Detectar cambio de controller
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[PWA] Controller changed, reloading...');
                window.location.reload();
            });

        } catch (e) { 
            console.error('[PWA] SW registration error:', e); 
        }
    }
}

export function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('[PWA] Install prompt available');
        showInstallButton();
    });

    // Ocultar botón si ya está instalado
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed');
        hideInstallButton();
        deferredPrompt = null;
    });

    // Verificar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('[PWA] App already installed');
        hideInstallButton();
    }
}

function showInstallButton() {
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[PWA] Install outcome:', outcome);
            
            if (outcome === 'accepted') {
                hideInstallButton();
            }
            deferredPrompt = null;
        });
    }
}

function hideInstallButton() {
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.classList.add('hidden');
}

function showUpdateNotification() {
    const notification = document.getElementById('updateNotification');
    if (notification) {
        notification.classList.remove('hidden');
    }
}
