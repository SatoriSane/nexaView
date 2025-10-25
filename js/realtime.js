// js/realtime.js
import { fetchBalance } from './balanceClient.js';
import { updateWalletBalance } from './storage.js';
import { state } from './config.js';

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let statusElements = null;
let uiUpdateCallback = null;
let balanceUpdateCallback = null;

const MAX_RETRIES = 2;
const WS_URL = "wss://electrum.nexa.org:20004";

// ✅ NUEVO: Sistema de cola para agrupar notificaciones
const pendingUpdates = new Map(); // address -> {timer, statusHash, count}
const UPDATE_DEBOUNCE_MS = 3500; // Esperar 3500ms para agrupar notificaciones
const MAX_PENDING_MS = 6000; // Máximo 6s de espera

/* ===================== HEARTBEAT CHECK ===================== */
let heartbeatInterval = null;
let lastPongTime = Date.now();

function startHeartbeat() {
  if (heartbeatInterval) return; // Evitar duplicados

  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastPongTime;

    // Si está conectado, enviamos un ping
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ method: "ping", id: Date.now() }));
        console.log("💓 Sent heartbeat ping");
      } catch (err) {
        console.warn("⚠️ Error sending ping:", err);
      }

      // Si pasó demasiado tiempo sin mensaje, reconectar
      if (elapsed > 30000) { // 30 s sin actividad
        console.warn("💀 WebSocket heartbeat timeout — reconnecting...");
        ws.close();
      }
    } else {
      console.log("🔁 Heartbeat found closed socket — reconnecting...");
      reconnect();
    }
  }, 60000); // cada 30 s
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}


/* ===================== INIT STATUS ===================== */
export function initRealtimeStatus(elements, onConnectionChange) {
  statusElements = elements;
  uiUpdateCallback = onConnectionChange;
}

/* ===================== PROCESS QUEUED UPDATE ===================== */
async function processQueuedUpdate(address) {
  const pending = pendingUpdates.get(address);
  if (!pending) return;
  
  const { count, firstNotificationTime } = pending;
  pendingUpdates.delete(address);
  
  console.log(`🔄 Processing ${count} queued notification(s) for ${address}`);
  
  try {
    // ✅ Esperar un poco más si es la primera notificación (servidor puede estar procesando)
    const timeSinceFirst = Date.now() - firstNotificationTime;
    if (timeSinceFirst < 500) {
      await new Promise(resolve => setTimeout(resolve, 500 - timeSinceFirst));
    }
    
    let updated = null;
    let retries = 0;
    const maxRetries = MAX_RETRIES;
    
    // ✅ Obtener balance actual para comparar
    const currentWallet = state.savedWallets.find(w => w.address === address);
    const previousBalance = currentWallet?.balance ?? 0;
    
    // ✅ Reintentar si el balance no cambió
    while (retries < maxRetries) {
      updated = await fetchBalance(address);
      
      if (updated !== null && updated !== previousBalance) {
        console.log(`✅ Balance changed: ${previousBalance} → ${updated}`);
        break; // Balance cambió, salir
      }
      
      retries++;
      if (retries < maxRetries) {
        console.log(`⏳ Balance unchanged, retry ${retries}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, UPDATE_DEBOUNCE_MS));
      }
    }
    
    if (updated !== null) {
      updateWalletBalance(address, updated);
      if (balanceUpdateCallback) {
        balanceUpdateCallback(address, updated);
      }
    } else {
      console.warn(`⚠️ Could not fetch updated balance for ${address}`);
    }
  } catch (err) {
    console.error(`❌ Error processing update for ${address}:`, err);
  }
}

/* ===================== QUEUE UPDATE ===================== */
function queueUpdate(address, statusHash) {
  const existing = pendingUpdates.get(address);
  const now = Date.now();
  
  if (existing) {
    // Ya hay una actualización pendiente, cancelar el timer anterior
    clearTimeout(existing.timer);
    
    const timeSinceFirst = now - existing.firstNotificationTime;
    
    // Si ya pasó el tiempo máximo, procesar inmediatamente
    if (timeSinceFirst >= MAX_PENDING_MS) {
      console.log(`⚡ Max wait time reached, processing immediately`);
      processQueuedUpdate(address);
      return;
    }
    
    // Actualizar contador y programar nuevo timer
    existing.count++;
    existing.statusHash = statusHash;
    existing.timer = setTimeout(() => {
      processQueuedUpdate(address);
    }, UPDATE_DEBOUNCE_MS);
    
    console.log(`📊 Queued notification #${existing.count} for ${address}`);
  } else {
    // Primera notificación, crear entrada nueva
    const timer = setTimeout(() => {
      processQueuedUpdate(address);
    }, UPDATE_DEBOUNCE_MS);
    
    pendingUpdates.set(address, {
      timer,
      statusHash,
      count: 1,
      firstNotificationTime: now
    });
    
    console.log(`📥 First notification queued for ${address}`);
  }
}

/* ===================== CONNECT ===================== */
export function connect(onBalanceUpdate) {
  balanceUpdateCallback = onBalanceUpdate;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
  if (statusElements) {
    updateStatus(statusElements, 'Connecting...', 'connecting');
  }
  
  ws = new WebSocket(WS_URL);
  console.log("🔌 Connecting to Rostrum...");
  
ws.onopen = async () => {
  console.log("✅ Connected to Rostrum WebSocket");
  reconnectAttempts = 0;
  startHeartbeat(); // 💓 Comienza a vigilar el estado de la conexión
  // 🔄 Limpiar cualquier temporizador de reconexión pendiente
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // ✅ Mostrar estado correcto
  if (statusElements) {
    updateStatus(statusElements, 'Live updates active', 'connected');
  }

  if (uiUpdateCallback) uiUpdateCallback('connected');

  // 🧩 Reconfirmar suscripciones activas (por si el socket se recreó)
  if (state.savedWallets?.length) {
    console.log('📡 Subscribing to saved addresses...');
    state.savedWallets.forEach(wallet => {
      subscribe(wallet.address);
    });
  }

  // ✅ Sincronizar balances inmediatamente después de conectar
  if (state.savedWallets?.length) {
    console.log('🔄 Syncing balances...');
    for (const wallet of state.savedWallets) {
      try {
        const balance = await fetchBalance(wallet.address);
        if (balance !== null) {
          updateWalletBalance(wallet.address, balance);
          if (balanceUpdateCallback) balanceUpdateCallback(wallet.address, balance);
        }
      } catch (err) {
        console.warn(`⚠️ Sync failed for ${wallet.address}:`, err);
      }
    }
  }

  console.log('🟢 WebSocket connection fully restored and synced.');
};

  
  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      lastPongTime = Date.now(); // 🕒 Marca de vida del servidor
      // ✅ Notificación de cambio en alguna dirección
      if (msg.method === "blockchain.address.subscribe") {
        const [address, statusHash] = msg.params;
        
        // ✅ Agregar a la cola en lugar de procesar inmediatamente
        queueUpdate(address, statusHash);
      }
    } catch (err) {
      console.warn("⚠️ Error processing message:", err);
    }
  };
  
  ws.onclose = () => {
    console.warn("❌ WebSocket closed. Attempting reconnect...");
      stopHeartbeat(); // 💓 Detiene el latido para no dejar intervalos colgando
    // ✅ Limpiar todas las colas pendientes
    pendingUpdates.forEach((pending, address) => {
      clearTimeout(pending.timer);
    });
    pendingUpdates.clear();
    
    if (statusElements) {
      updateStatus(statusElements, 'Reconnecting...', 'disconnected');
    }
    
    if (uiUpdateCallback) uiUpdateCallback('disconnected');
    
    reconnect();
  };
  
  ws.onerror = (err) => {
    console.error("🚨 WebSocket error:", err);
    
    if (statusElements) {
      updateStatus(statusElements, 'Connection error', 'error');
    }
    
    ws.close();
  };
}

/* ===================== RECONNECT ===================== */
export function reconnect() {
  if (reconnectTimer) return;
  if (reconnectAttempts >= MAX_RETRIES) {
    console.error("⚠️ Max reconnection attempts reached. Falling back to manual refresh.");
    
    if (statusElements) {
      updateStatus(statusElements, 'Manual refresh only', 'error');
    }
    
    if (uiUpdateCallback) uiUpdateCallback('failed');
    
    reconnectTimer = null;
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(30000, 2000 * reconnectAttempts);
  console.log(`🔁 Reconnecting in ${delay / 1000}s...`);
  
  if (statusElements) {
    updateStatus(statusElements, `Reconnecting (${reconnectAttempts}/${MAX_RETRIES})...`, 'connecting');
  }
  
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(balanceUpdateCallback);
  }, delay);
}

/* ===================== UPDATE STATUS ===================== */
function updateStatus(elements, text, type = 'connected') {
  if (!elements) return;
  elements.statusText.textContent = text;
  elements.statusIndicator.className = 'status-indicator';
  
  if (type === 'connected') {
    elements.statusIndicator.classList.add('connected');
  } else if (type === 'disconnected') {
    elements.statusIndicator.classList.add('disconnected');
  } else if (type === 'connecting') {
    elements.statusIndicator.classList.add('connecting');
  } else if (type === 'error') {
    elements.statusIndicator.classList.add('error');
  }
}

/* ===================== GET STATUS ===================== */
export function getConnectionStatus() {
  if (!ws) return 'disconnected';
  
  switch (ws.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'connected';
    case WebSocket.CLOSING:
    case WebSocket.CLOSED: return 'disconnected';
    default: return 'disconnected';
  }
}

/* ===================== SUBSCRIBE ===================== */
export function subscribe(address) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    const id = Math.floor(Math.random() * 1000000);
    ws.send(JSON.stringify({
      id,
      method: "blockchain.address.subscribe",
      params: [address]
    }));
    console.log(`📡 Subscribed to ${address}`);
  } catch (err) {
    console.error("Error subscribing:", err.message);
  }
}

/* ===================== UNSUBSCRIBE ===================== */
export function unsubscribe(address) {
  // ✅ Cancelar cualquier actualización pendiente
  const pending = pendingUpdates.get(address);
  if (pending) {
    clearTimeout(pending.timer);
    pendingUpdates.delete(address);
    console.log(`🗑️ Cancelled pending updates for ${address}`);
  }
  
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    const id = Math.floor(Math.random() * 1000000);
    ws.send(JSON.stringify({
      id,
      method: "blockchain.address.unsubscribe",
      params: [address]
    }));
    console.log(`📴 Unsubscribed from ${address}`);
  } catch (err) {
    console.error("Error unsubscribing:", err.message);
  }
}

/* ===================== DISCONNECT ===================== */
export function disconnect() {
  // ✅ Limpiar todas las colas
  pendingUpdates.forEach((pending) => {
    clearTimeout(pending.timer);
  });
  pendingUpdates.clear();
  
  if (ws) ws.close();
}