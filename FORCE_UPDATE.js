// SCRIPT PARA FORZAR ACTUALIZACIÓN
// Copia y pega este código en la consola del navegador (F12 → Console)

(async function forceUpdate() {
    console.log('🔄 Forcing update...');
    
    // 1. Desregistrar todos los Service Workers
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
            console.log('✅ Service Worker unregistered');
        }
    }
    
    // 2. Limpiar todos los cachés
    const cacheNames = await caches.keys();
    for (let cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log('✅ Cache deleted:', cacheName);
    }
    
    // 3. Limpiar localStorage (opcional - comenta si no quieres perder wallets guardadas)
    // localStorage.clear();
    // console.log('✅ LocalStorage cleared');
    
    // 4. Recargar la página
    console.log('✅ Update complete! Reloading...');
    setTimeout(() => {
        window.location.reload(true);
    }, 500);
})();
