//api/balance.js
// ===== SERVERLESS FUNCTION PARA VERCEL =====
// Proxy para consultar la API de Nexa y evitar problemas de CORS

/**
 * Handler principal de la función serverless
 * Endpoint: /api/balance/:address
 * Método: GET
 * Respuesta: JSON con balance o error
 */
export default async function handler(req, res) {
    // Configurar CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Manejar preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Solo permitir GET
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Método no permitido',
            allowedMethods: ['GET'] 
        });
    }
    
    try {
        // Extraer dirección del query parameter
        // URL format: /api/balance?address=nexa:nqt....fetch
        console.log('[API] req.query:', req.query);
        
        const address = req.query.address;
        
        console.log('[API] Extracted address:', address);
        
        if (!address) {
            return res.status(400).json({ 
                error: 'Dirección no proporcionada',
                usage: '/api/balance?address=YOUR_ADDRESS',
                receivedQuery: req.query
            });
        }
        
        // Validar formato básico de dirección Nexa
        if (!address.startsWith('nexa:')) {
            return res.status(400).json({ 
                error: 'Dirección inválida: debe comenzar con "nexa:"',
                receivedAddress: address
            });
        }
        
        console.log(`[API] Consultando balance para: ${address}`);
        
        // Llamar a la API de Nexa
        // Formato correcto: /balance/address (no /v1/address/{address}/balance)
        // La dirección ya viene encoded desde el frontend, no volver a encodear
        const nexaApiUrl = `https://nexaapi.deno.dev/balance/${address}`;
        
        const response = await fetch(nexaApiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'nexaView-PWA/1.0'
            }
        });
        
        if (!response.ok) {
            console.error(`[API] Error de Nexa API: ${response.status}`);
            
            // Manejar diferentes códigos de error
            if (response.status === 404) {
                return res.status(200).json({ 
                    success: true,
                    address: address,
                    balance: 0,
                    unconfirmed: 0,
                    message: 'Dirección sin transacciones o balance cero',
                    timestamp: new Date().toISOString()
                });
            }
            
            if (response.status === 429) {
                return res.status(429).json({ 
                    error: 'Demasiadas solicitudes. Intenta más tarde.'
                });
            }
            
            throw new Error(`API respondió con status ${response.status}`);
        }
        
        // Parsear respuesta
        const data = await response.json();
        
        console.log(`[API] Balance obtenido exitosamente`, data);
        
        // La API devuelve: {"balance":{"confirmed":123,"unconfirmed":0}}
        const confirmedBalance = data.balance?.confirmed || 0;
        const unconfirmedBalance = data.balance?.unconfirmed || 0;
        
        return res.status(200).json({
            success: true,
            address: address,
            balance: confirmedBalance,
            unconfirmed: unconfirmedBalance,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[API] Error:', error);
        console.error('[API] Error name:', error.name);
        console.error('[API] Error message:', error.message);
        
        // Manejar timeout
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return res.status(504).json({ 
                error: 'Timeout: la API de Nexa no respondió a tiempo'
            });
        }
        
        // Error genérico
        return res.status(500).json({ 
            error: 'Error al consultar el balance',
            message: error.message,
            errorName: error.name,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

/**
 * Extrae la dirección del path de la URL
 * Ejemplo: /api/balance/nexa:abc123 -> nexa:abc123
 */
function extractAddressFromPath(url) {
    try {
        const match = url.match(/\/api\/balance\/([^?]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    } catch (error) {
        console.error('[API] Error extrayendo dirección:', error);
        return null;
    }
}
