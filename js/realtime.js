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
let isReconnecting = false; // 🆕 Prevenir múltiples reconexiones simultáneas

const MAX_RETRIES = 5; // 🔧 Aumentado de 2 a 5 para móviles
const WS_URL = "wss://electrum.nexa.org:20004";

// Sistema de cola para agrupar notificaciones
const pendingUpdates = new Map();
const UPDATE_DEBOUNCE_MS = 3500;
const MAX_PENDING_MS = 6000;

/* ===================== HEARTBEAT CHECK ===================== */
let heartbeatInterval = null;
let lastPongTime = Date.now();

function startHeartbeat() {
  stopHeartbeat(); // 🔧 Limpiar cualquier heartbeat previo
  
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastPongTime;

    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ method: "ping", id: Date.now() }));
        console.log("💓 Sent heartbeat ping");
      } catch (err) {
        console.warn("⚠️ Error sending ping:", err);
        stopHeartbeat();
        if (ws) ws.close();
      }

      if (elapsed > 35000) { // 🔧 Aumentado de 30s a 35s
        console.warn("💀 WebSocket heartbeat timeout — closing socket...");
        stopHeartbeat();
        if (ws) ws.close();
      }
    }
  }, 60000);
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
    const timeSinceFirst = Date.now() - firstNotificationTime;
    if (timeSinceFirst < 500) {
      await new Promise(resolve => setTimeout(resolve, 500 - timeSinceFirst));
    }
    
    let updated = null;
    let retries = 0;
    const maxRetries = 2; // Mantener bajo para updates en cola
    
    const currentWallet = state.savedWallets.find(w => w.address === address);
    const previousBalance = currentWallet?.balance ?? 0;
    
    while (retries < maxRetries) {
      updated = await fetchBalance(address);
      
      if (updated !== null && updated !== previousBalance) {
        console.log(`✅ Balance changed: ${previousBalance} → ${updated}`);
        break;
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
    clearTimeout(existing.timer);
    
    const timeSinceFirst = now - existing.firstNotificationTime;
    
    if (timeSinceFirst >= MAX_PENDING_MS) {
      console.log(`⚡ Max wait time reached, processing immediately`);
      processQueuedUpdate(address);
      return;
    }
    
    existing.count++;
    existing.statusHash = statusHash;
    existing.timer = setTimeout(() => {
      processQueuedUpdate(address);
    }, UPDATE_DEBOUNCE_MS);
    
    console.log(`📊 Queued notification #${existing.count} for ${address}`);
  } else {
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
  
  // 🔧 Si ya hay una conexión abierta, no hacer nada
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("✅ WebSocket already connected");
    return;
  }
  
  // 🔧 Si estamos conectando, esperar
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    console.log("⏳ WebSocket already connecting...");
    return;
  }
  
  if (statusElements) {
    updateStatus(statusElements, 'Connecting...', 'connecting');
  }
  
  ws = new WebSocket(WS_URL);
  console.log("🔌 Connecting to Rostrum...");
  
  ws.onopen = async () => {
    console.log("✅ Connected to Rostrum WebSocket");
    reconnectAttempts = 0; // 🔧 Resetear contador al conectar exitosamente
    isReconnecting = false; // 🔧 Limpiar flag
    startHeartbeat();
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (statusElements) {
      updateStatus(statusElements, 'Live updates active', 'connected');
    }

    if (uiUpdateCallback) uiUpdateCallback('connected');

    // Reconfirmar suscripciones
    if (state.savedWallets?.length) {
      console.log('📡 Subscribing to saved addresses...');
      state.savedWallets.forEach(wallet => {
        subscribe(wallet.address);
      });
    }

    // Sincronizar balances
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
      lastPongTime = Date.now();
      
      if (msg.method === "blockchain.address.subscribe") {
        const [address, statusHash] = msg.params;
        queueUpdate(address, statusHash);
      }
    } catch (err) {
      console.warn("⚠️ Error processing message:", err);
    }
  };
  
  ws.onclose = () => {
    console.warn("❌ WebSocket closed. Attempting reconnect...");
    stopHeartbeat();
    
    // Limpiar colas pendientes
    pendingUpdates.forEach((pending) => {
      clearTimeout(pending.timer);
    });
    pendingUpdates.clear();
    
    if (statusElements) {
      updateStatus(statusElements, 'Reconnecting...', 'connecting'); // 🔧 Mostrar "connecting" no "disconnected"
    }
    
    if (uiUpdateCallback) uiUpdateCallback('disconnected');
    
    // 🔧 Solo reconectar si no estamos ya en proceso de reconexión
    if (!isReconnecting) {
      reconnect();
    }
  };
  
  ws.onerror = (err) => {
    console.error("🚨 WebSocket error:", err);
    
    if (statusElements) {
      updateStatus(statusElements, 'Connection error', 'error');
    }
    
    if (ws) ws.close(); // 🔧 Asegurar que se cierre
  };
}

/* ===================== RECONNECT ===================== */
export function reconnect() {
  if (isReconnecting) {
    console.log("⏳ Reconnect already in progress, skipping...");
    return;
  }
  
  if (reconnectTimer) {
    console.log("⏳ Reconnect timer already set, skipping...");
    return;
  }
  
  if (reconnectAttempts >= MAX_RETRIES) {
    console.error("⚠️ Max reconnection attempts reached. Manual refresh required.");
    
    if (statusElements) {
      updateStatus(statusElements, 'Connection lost - Pull to refresh', 'error');
    }
    
    if (uiUpdateCallback) uiUpdateCallback('failed');
    
    isReconnecting = false;
    reconnectTimer = null;
    return;
  }
  
  isReconnecting = true;
  reconnectAttempts++;
  
  // 🔧 Backoff exponencial pero limitado para móviles
  const delay = Math.min(10000, 2000 * Math.pow(1.5, reconnectAttempts - 1));
  console.log(`🔁 Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts}/${MAX_RETRIES})...`);
  
  if (statusElements) {
    updateStatus(statusElements, `Reconnecting (${reconnectAttempts}/${MAX_RETRIES})...`, 'connecting');
  }
  
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    isReconnecting = false;
    connect(balanceUpdateCallback);
  }, delay);
}

/* ===================== FORCE RECONNECT ===================== */
// 🆕 Nueva función para forzar reconexión limpia (para visibilitychange)
export function forceReconnect() {
  console.log("🔄 Forcing fresh reconnection...");
  
  // Cancelar cualquier reconexión pendiente
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Resetear flags y contadores
  isReconnecting = false;
  reconnectAttempts = 0;
  
  // Desconectar completamente
  disconnect();
  
  // Esperar un momento y reconectar
  setTimeout(() => {
    connect(balanceUpdateCallback);
  }, 500);
}

/* ===================== UPDATE STATUS ===================== */
export function updateStatus(elements, text, type = 'connected') {
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
  console.log("🔌 Disconnecting WebSocket...");
  
  // Limpiar colas
  pendingUpdates.forEach((pending) => {
    clearTimeout(pending.timer);
  });
  pendingUpdates.clear();

  // Detener heartbeat
  stopHeartbeat();

  // Cerrar WebSocket
  if (ws) {
    try {
      ws.close();
    } catch (err) {
      console.warn("⚠️ Error closing WebSocket:", err);
    }
    ws = null;
  }

  // Limpiar timers de reconexión
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // NO resetear reconnectAttempts aquí - solo en forceReconnect()
  isReconnecting = false;
}