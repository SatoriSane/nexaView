// js/realtime.js
import { fetchBalance } from './balanceClient.js';
import { updateWalletBalance } from './storage.js';
import { state } from './config.js';

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let statusElements = null;
let uiUpdateCallback = null; // Callback para actualizar botones
let balanceUpdateCallback = null; 

const MAX_RETRIES = 5;
const WS_URL = "wss://electrum.nexa.org:20004";

/* ===================== INIT STATUS ===================== */
export function initRealtimeStatus(elements, onConnectionChange) {
  statusElements = elements;
  uiUpdateCallback = onConnectionChange; // Callback para mostrar/ocultar botones
}

/* ===================== CONNECT ===================== */
export function connect(onBalanceUpdate) {
  balanceUpdateCallback = onBalanceUpdate; // ← ¡AÑADE ESTA LÍNEA!
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
  if (statusElements) {
    updateStatus(statusElements, 'Connecting...', 'connecting');
  }
  
  ws = new WebSocket(WS_URL);
  console.log("🔌 Connecting to Rostrum...");
  
  ws.onopen = () => {
    console.log("✅ Connected to Rostrum WebSocket");
    reconnectAttempts = 0;
    
    if (statusElements) {
      updateStatus(statusElements, 'Live updates active', 'connected');
    }
    
    // Notificar que el WS está conectado
    if (uiUpdateCallback) uiUpdateCallback('connected');
    
    // Suscribimos todas las direcciones guardadas
    if (state.savedWallets?.length) {
      state.savedWallets.forEach(wallet => {
        subscribe(wallet.address);
      });
    }
  };
  
  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      // Notificación de cambio en alguna dirección
      if (msg.method === "blockchain.address.subscribe") {
        const [address] = msg.params;
        let updated = null;
        try {
          updated = await fetchBalance(address);
        } catch {
          console.warn(`⚠️ Could not fetch balance for ${address}, skipping...`);
        }
        if (updated !== null) {
          updateWalletBalance(address, updated);
          if (balanceUpdateCallback) balanceUpdateCallback(address, updated);        }
      }
    } catch (err) {
      console.warn("⚠️ Error processing message:", err);
    }
  };
  
  ws.onclose = () => {
    console.warn("❌ WebSocket closed. Attempting reconnect...");
    
    if (statusElements) {
      updateStatus(statusElements, 'Reconnecting...', 'disconnected');
    }
    
    // Notificar que el WS está desconectado
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
    
    // Notificar que el WS falló permanentemente
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
  if (ws) ws.close();
}