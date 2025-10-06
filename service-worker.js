// ===== SERVICE WORKER PARA PWA =====
// Versión del caché - incrementar cuando se actualice la app
const CACHE_VERSION = 'nexaView-v1.0.1';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Archivos a cachear durante la instalación
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-128x128.png',
    '/icons/icon-512x512.png'
];

// ===== INSTALACIÓN =====
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando archivos estáticos');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Instalación completa');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Error durante instalación:', error);
            })
    );
});

// ===== ACTIVACIÓN =====
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Eliminar cachés antiguos
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('nexaView-') && 
                                   name !== CACHE_NAME && 
                                   name !== RUNTIME_CACHE;
                        })
                        .map((name) => {
                            console.log('[SW] Eliminando caché antiguo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activación completa');
                return self.clients.claim();
            })
    );
});

// ===== FETCH - ESTRATEGIA DE CACHÉ =====
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar requests que no sean HTTP/HTTPS
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Estrategia para API: Network First, fallback a Cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // Estrategia para assets estáticos: Cache First, fallback a Network
    event.respondWith(cacheFirstStrategy(request));
});

// ===== ESTRATEGIA: CACHE FIRST =====
// Ideal para assets estáticos (HTML, CSS, JS, imágenes)
async function cacheFirstStrategy(request) {
    try {
        // Intentar obtener del caché primero
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Sirviendo desde caché:', request.url);
            return cachedResponse;
        }
        
        // Si no está en caché, hacer fetch
        console.log('[SW] No en caché, haciendo fetch:', request.url);
        const networkResponse = await fetch(request);
        
        // Cachear la respuesta para futuras requests
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('[SW] Error en cacheFirstStrategy:', error);
        
        // Fallback: página offline si existe
        return caches.match('/index.html');
    }
}

// ===== ESTRATEGIA: NETWORK FIRST =====
// Ideal para API calls (datos dinámicos)
async function networkFirstStrategy(request) {
    try {
        // Intentar fetch primero
        console.log('[SW] Haciendo fetch (API):', request.url);
        const networkResponse = await fetch(request);
        
        // Cachear respuesta exitosa
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('[SW] Network falló, intentando caché:', request.url);
        
        // Fallback a caché si network falla
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Sirviendo API desde caché:', request.url);
            return cachedResponse;
        }
        
        // Si no hay caché, retornar error
        return new Response(
            JSON.stringify({ 
                error: 'Sin conexión y sin datos en caché',
                offline: true 
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// ===== MENSAJES =====
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => caches.delete(name))
                );
            })
        );
    }
});

// ===== SYNC BACKGROUND (opcional) =====
// Permite sincronización en background cuando hay conexión
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-balance') {
        event.waitUntil(syncBalance());
    }
});

async function syncBalance() {
    // Implementar lógica de sincronización si es necesario
    console.log('[SW] Sincronizando balance...');
}

// ===== NOTIFICACIONES PUSH (opcional) =====
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Actualización de nexaView',
        icon: '/icons/icon-128x128.png',
        badge: '/icons/icon-128x128.png',
        vibrate: [200, 100, 200],
        tag: 'nexaView-notification'
    };
    
    event.waitUntil(
        self.registration.showNotification('nexaView', options)
    );
});

console.log('[SW] Service Worker cargado');
