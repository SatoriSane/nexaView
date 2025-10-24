//api/transactions.js
// ===== SERVERLESS FUNCTION PARA OBTENER TRANSACCIONES =====

/**
 * Handler principal de la función serverless
 * Endpoint: /api/transactions?address=nexa:...
 * Método: GET
 * Respuesta: JSON con transacciones o error
 */
export default async function handler(req, res) {
    // Configurar CORS headers + anti-cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
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
        const address = req.query.address;
        
        if (!address) {
            return res.status(400).json({ 
                error: 'Dirección no proporcionada',
                usage: '/api/transactions?address=YOUR_ADDRESS'
            });
        }
        
        // Validar formato básico de dirección Nexa
        if (!address.startsWith('nexa:')) {
            return res.status(400).json({ 
                error: 'Dirección inválida: debe comenzar con "nexa:"',
                receivedAddress: address
            });
        }
        
        console.log(`[API] Consultando transacciones para: ${address}`);
        
        // Intentar diferentes endpoints de la API de Nexa
        const endpoints = [
            `https://nexaapi.deno.dev/address/${address}/txs`,
            `https://nexaapi.deno.dev/transactions/${address}`,
            `https://nexaapi.deno.dev/address/${address}/transactions`
        ];
        
        let data = null;
        let lastError = null;
        
        for (const nexaApiUrl of endpoints) {
            try {
                console.log(`[API] Intentando endpoint: ${nexaApiUrl}`);
                
                const response = await fetch(nexaApiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'nexaView-PWA/1.0',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    data = await response.json();
                    console.log(`[API] Endpoint exitoso: ${nexaApiUrl}`);
                    console.log(`[API] Número de transacciones recibidas: ${data?.transactions?.length || 0}`);
                    break;
                }
                
                if (response.status === 404) {
                    console.log(`[API] Endpoint no encontrado: ${nexaApiUrl}`);
                    continue;
                }
                
                if (response.status === 429) {
                    return res.status(429).json({ 
                        error: 'Demasiadas solicitudes. Intenta más tarde.'
                    });
                }
                
                lastError = `Status ${response.status}`;
            } catch (err) {
                console.error(`[API] Error en endpoint ${nexaApiUrl}:`, err);
                lastError = err.message;
            }
        }
        
        // Si ningún endpoint funcionó, devolver array vacío
        if (!data) {
            console.log('[API] Ningún endpoint de transacciones disponible');
            return res.status(200).json({ 
                success: true,
                address: address,
                transactions: [],
                message: 'Transaction history not available from API',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`[API] Transacciones obtenidas exitosamente`);
        
        // PRIMERO: Ordenar las transacciones por height (más reciente primero)
        let transactionsList = data.transactions || [];
        transactionsList.sort((a, b) => (b.height || 0) - (a.height || 0));
        console.log(`[API] Transacciones ordenadas por height. Total: ${transactionsList.length}`);
        
        // SEGUNDO: Tomar solo las 10 MÁS RECIENTES después de ordenar
        const txsToFetch = transactionsList.slice(0, 10);
        console.log(`[API] Obteniendo detalles de las ${txsToFetch.length} transacciones más recientes`);
        
        // Si solo tenemos tx_hash, necesitamos obtener los detalles de cada transacción
        let detailedTransactions = [];
        
        for (const tx of txsToFetch) {
            if (tx.tx_hash) {
                try {
                    const txDetailUrl = `https://nexaapi.deno.dev/tx/${tx.tx_hash}`;
                    
                    const txResponse = await fetch(txDetailUrl, {
                        headers: {
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    if (txResponse.ok) {
                        const txDetail = await txResponse.json();
                        // Agregar el height del listado original (IMPORTANTE para ordenamiento)
                        txDetail.height = tx.height;
                        detailedTransactions.push(txDetail);
                        console.log(`[API] TX obtenida: ${tx.tx_hash} - Height: ${tx.height}`);
                    } else {
                        console.log(`[API] No se pudieron obtener detalles de ${tx.tx_hash}, status: ${txResponse.status}`);
                    }
                } catch (err) {
                    console.error(`[API] Error obteniendo detalles de tx:`, err);
                }
            }
        }
        
        console.log(`[API] Obtenidas ${detailedTransactions.length} transacciones con detalles`);
        
        // Procesar y formatear transacciones
        const transactions = processTransactions(detailedTransactions, address);
        
        console.log(`[API] Transacciones procesadas y ordenadas. Enviando ${transactions.length} transacciones`);
        if (transactions.length > 0) {
            console.log('[API] Primera transacción (más reciente):', {
                txid: transactions[0].txid,
                timestamp: transactions[0].timestamp,
                date: new Date(transactions[0].timestamp * 1000).toISOString(),
                height: transactions[0].height
            });
        }
        
        return res.status(200).json({
            success: true,
            address: address,
            transactions: transactions,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[API] Error:', error);
        
        // Manejar timeout
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return res.status(504).json({ 
                error: 'Timeout: la API de Nexa no respondió a tiempo'
            });
        }
        
        // Error genérico
        return res.status(500).json({ 
            error: 'Error al consultar transacciones',
            message: error.message,
            errorName: error.name
        });
    }
}

/**
 * Procesa y formatea las transacciones de la API
 */
function processTransactions(data, address) {
    // Manejar diferentes formatos de respuesta
    let transactions = [];
    
    if (Array.isArray(data)) {
        transactions = data;
    } else if (data && Array.isArray(data.transactions)) {
        transactions = data.transactions;
    } else if (data && Array.isArray(data.txs)) {
        transactions = data.txs;
    } else {
        console.log('[API] Formato de transacciones desconocido:', data);
        return [];
    }
    
    const processed = transactions.map(txWrapper => {
        // La API de Nexa devuelve {transaction: {...}}
        const tx = txWrapper.transaction || txWrapper;
        
        // Calcular el monto neto para esta dirección
        let amount = 0;
        let type = 'received';
        let isFromThisAddress = false;
        let isToThisAddress = false;
        
        // Procesar outputs (vout)
        if (tx.vout && Array.isArray(tx.vout)) {
            tx.vout.forEach(output => {
                // Nexa usa scriptPubKey.addresses
                const outputAddresses = output.scriptPubKey?.addresses || [];
                if (outputAddresses.includes(address)) {
                    isToThisAddress = true;
                    // Usar value_satoshi que es el valor en satoshis
                    amount += parseInt(output.value_satoshi || 0);
                }
            });
        }
        
        // Procesar inputs (vin)
        if (tx.vin && Array.isArray(tx.vin)) {
            tx.vin.forEach(input => {
                // Los inputs tienen addresses directamente
                const inputAddresses = input.addresses || [];
                if (inputAddresses.includes(address)) {
                    isFromThisAddress = true;
                }
            });
        }
        
        // Determinar tipo de transacción
        if (isFromThisAddress && !isToThisAddress) {
            type = 'sent';
            // Para enviadas, necesitamos calcular el total enviado
            if (tx.vin && Array.isArray(tx.vin)) {
                tx.vin.forEach(input => {
                    const inputAddresses = input.addresses || [];
                    if (inputAddresses.includes(address)) {
                        amount += parseInt(input.value_satoshi || 0);
                    }
                });
            }
        } else if (isFromThisAddress && isToThisAddress) {
            // Es una transacción a sí mismo (cambio)
            type = 'received';
        }
        
        // CRÍTICO: Usar blocktime que viene en la respuesta (ya está en segundos Unix)
        let timestamp = tx.blocktime || tx.time || tx.timestamp;
        
        // Si no hay timestamp válido, usar height como aproximación
        // Un height mayor = más reciente
        if (!timestamp || timestamp <= 0) {
            console.warn(`[API] Transacción sin timestamp válido: ${tx.txid}. Usando height: ${tx.height}`);
            // Aproximación: cada bloque ~2 minutos (120 segundos)
            // Esto es solo para ordenamiento relativo
            timestamp = (tx.height || 0) * 120;
        }
        
        // Convertir a número para asegurar ordenamiento correcto
        timestamp = Number(timestamp);
        
        return {
            txid: tx.txid || tx.hash || tx.tx_hash,
            type: type,
            amount: Math.abs(amount),
            timestamp: timestamp,
            confirmations: tx.confirmations || 0,
            height: tx.height || 0
        };
    });
    
    // ORDENAR por múltiples criterios: primero por timestamp, luego por height
    processed.sort((a, b) => {
        // Primero intentar ordenar por timestamp
        if (b.timestamp !== a.timestamp) {
            return b.timestamp - a.timestamp;
        }
        // Si timestamps son iguales, ordenar por height (más reciente primero)
        return b.height - a.height;
    });
    
    // Log de las primeras 3 transacciones para debugging
    console.log('[API] Primeras 3 transacciones procesadas:', 
        processed.slice(0, 3).map(tx => ({
            txid: tx.txid?.substring(0, 10) + '...',
            type: tx.type,
            amount: tx.amount,
            timestamp: tx.timestamp,
            date: new Date(tx.timestamp * 1000).toISOString(),
            height: tx.height
        }))
    );
    
    return processed;
}
