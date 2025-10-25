// js/app.js
import { state, CONFIG } from './config.js';
import { registerServiceWorker, setupInstallPrompt } from './pwa.js';
import { loadSavedWallets, refreshAllWallets } from './wallets.js';
import { setupWalletModal } from './add-wallet-modal.js';
import { adjustBalanceFontSize, formatRelativeTime } from './ui.js';
import { formatBalance } from './balanceClient.js';
import { openReceiveScreen } from './receive-screen.js';
import { fetchBalance } from './balanceClient.js';
import { updateWalletBalance } from './storage.js';
import { 
  initRealtimeStatus, 
  connect, 
  getConnectionStatus, 
  reconnect, 
  updateStatus,
  disconnect,
  forceReconnect
} from './realtime.js';
// ====================================
// 🎈 ANIMACIÓN DE CORAZONES FLOTANTES
// ====================================

/**
 * Crea un corazón flotante desde el botón de donación
 * @param {HTMLElement} button - El botón de donación
 */
function createFloatingHeart(button) {
  const rect = button.getBoundingClientRect();
  const svgIcon = button.querySelector('svg');
  
  if (!svgIcon) return;
  
  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  
  // Añadir variante aleatoria para variedad visual
  const variant = Math.floor(Math.random() * 3);
  if (variant > 0) {
    heart.classList.add(`variant-${variant}`);
  }
  
  // Clonar el SVG del botón
  const heartSvg = svgIcon.cloneNode(true);
  heartSvg.setAttribute('fill', 'currentColor');
  heart.appendChild(heartSvg);
  
  // Posicionar en la ubicación exacta del botón
  heart.style.left = `${rect.left + rect.width / 2 - 12}px`;
  heart.style.top = `${rect.top + rect.height / 2 - 12}px`;
  
  // Agregar al body para que persista sobre receive-screen
  document.body.appendChild(heart);
  
  // Remover después de la animación
  setTimeout(() => {
    heart.remove();
  }, 3200);
}

/**
 * Crear múltiples corazones para efecto burst
 * @param {HTMLElement} button - El botón de donación
 * @param {number} count - Cantidad de corazones
 */
function createHeartBurst(button, count = 3) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      createFloatingHeart(button);
    }, i * 100);
  }
}

// ====================================
// 🚀 INICIALIZACIÓN PRINCIPAL
// ====================================

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    addWalletBtn: document.getElementById('addWalletBtn'),
    addWalletModal: document.getElementById('addWalletModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    addressInput: document.getElementById('addressInput'),
    clearBtn: document.getElementById('clearBtn'),
    modalTitle: document.getElementById('modalTitle'),
    modalPreviewCard: document.getElementById('modalPreviewCard'),
    modalActionContainer: document.getElementById('modalActionContainer'),
    trackWalletBtn: document.getElementById('trackWalletBtn'),
    errorMessage: document.getElementById('errorMessage'),
    trackedWalletsSection: document.getElementById('trackedWalletsSection'),
    trackedWalletsList: document.getElementById('trackedWalletsList'),
    confirmModal: document.getElementById('confirmModal'),
    confirmAddress: document.getElementById('confirmAddress'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    donateBtn: document.getElementById('donateBtn'),
  };

  state.modalWallet = null;

  // Service Worker y PWA
  registerServiceWorker();
  setupInstallPrompt();

  // Función para mostrar/ocultar botones de refresh según estado del WS
  const handleConnectionChange = (status) => {
    const refreshIcons = document.querySelectorAll('.wallet-btn-refresh');
    const timestamps = document.querySelectorAll('.wallet-last-update');
    
    refreshIcons.forEach(btn => {
      if (status === 'connected') {
        btn.classList.remove('show');
      } else {
        btn.classList.add('show');
      }
    });
    
    timestamps.forEach(ts => {
      if (status === 'connected') {
        ts.style.display = 'none';
      } else {
        ts.style.display = 'flex';
      }
    });
    
    if (status === 'failed' || status === 'error') {
      if (state.savedWallets?.length) {
        refreshAllWallets(elements);
      }
    }
  };

  // Callback global para actualizaciones de balance desde el WS
  const onBalanceUpdate = (address, balance) => {
    // Actualizar UI de wallets en la lista
    const walletCard = document.querySelector(`.wallet-item .wallet-address[data-full-address="${address}"]`)?.closest('.wallet-item');
    if (walletCard) {
      const balanceEl = walletCard.querySelector('.wallet-balance');
      if (balanceEl) {
        balanceEl.innerHTML = formatBalance(balance);
        adjustBalanceFontSize(balanceEl);
      }
      const timestampEl = walletCard.querySelector('.wallet-last-update .update-text');
      if (timestampEl) {
        const now = Date.now();
        timestampEl.textContent = formatRelativeTime(now);
        walletCard.querySelector('.wallet-last-update')?.setAttribute('data-timestamp', now);
      }
    }

    // Notificar a receive-screen si está abierto
    if (window.receiveScreenCallback) {
      window.receiveScreenCallback(address, balance);
    }
    
    const walletInState = state.savedWallets.find(w => w.address === address);
    if (walletInState) {
      walletInState.balance = balance;
      walletInState.lastUpdated = Date.now();
    }
  };

  // Inicializar sistema de estado del WebSocket
  initRealtimeStatus(
    {
      statusIndicator: elements.statusIndicator,
      statusText: elements.statusText
    },
    handleConnectionChange
  );

  // ✅ Primero cargar wallets guardadas
  await loadSavedWallets(elements);

  // ✅ Luego conectar WebSocket (ahora sí se suscriben correctamente)
  connect(onBalanceUpdate);

// 🔄 MANEJO MEJORADO DE VISIBILIDAD (reemplazar el listener existente)
let lastHiddenTime = null;
let visibilityTimeout = null;


document.addEventListener('visibilitychange', async () => {
  // Limpiar timeout previo si existe
  if (visibilityTimeout) {
    clearTimeout(visibilityTimeout);
    visibilityTimeout = null;
  }

  if (document.hidden) {
    lastHiddenTime = Date.now();
    console.log('📱 App minimized');
    return;
  }

  // App volvió a estar visible
  console.log('🔄 App visible again — checking connection...');
  
  const statusUI = {
    statusIndicator: elements.statusIndicator,
    statusText: elements.statusText
  };

  const status = getConnectionStatus();
  const timeHidden = lastHiddenTime ? Date.now() - lastHiddenTime : 0;
  lastHiddenTime = null;

  const RECONNECT_THRESHOLD_MS = 30000; // 30 segundos

  console.log(`⏱️ Was hidden for ${(timeHidden / 1000).toFixed(1)}s, status: ${status}`);

  // Estrategia basada en tiempo y estado
  if (status === 'connected' && timeHidden < RECONNECT_THRESHOLD_MS) {
    // Conexión activa y poco tiempo ausente - solo verificar
    console.log('✅ Connection appears healthy — verifying...');
    updateStatus(statusUI, 'Live updates active', 'connected');
    
    // Refrescar balances por seguridad (sin forzar reconexión)
    visibilityTimeout = setTimeout(async () => {
      if (state.savedWallets?.length) {
        console.log('🔄 Syncing balances...');
        for (const wallet of state.savedWallets) {
          try {
            const balance = await fetchBalance(wallet.address);
            if (balance !== null) {
              updateWalletBalance(wallet.address, balance);
              onBalanceUpdate(wallet.address, balance);
            }
          } catch (err) {
            console.warn(`⚠️ Could not sync ${wallet.address}:`, err);
          }
        }
      }
    }, 500);
    
  } else {
    // Desconectado O mucho tiempo ausente - forzar reconexión limpia
    console.warn(`⚠️ Forcing reconnect (status: ${status}, hidden: ${(timeHidden/1000).toFixed(1)}s)`);
    updateStatus(statusUI, 'Reconnecting...', 'connecting');
    
    // Usar la nueva función de reconexión forzada
    forceReconnect();
  }
});

// iOS puede suspender completamente la app, necesitamos detectar esto
window.addEventListener('focus', () => {
  console.log('🪟 Window focused');
  const status = getConnectionStatus();
  
  if (status !== 'connected' && status !== 'connecting') {
    console.log('🔄 Window focused but not connected — forcing reconnect');
    forceReconnect();
  }
});

window.addEventListener('offline', () => {
  console.log('📵 Network offline');
  const statusUI = {
    statusIndicator: elements.statusIndicator,
    statusText: elements.statusText
  };
  updateStatus(statusUI, 'No connection', 'error');
});
// 🔄 Manejo de cambios de red (si el móvil cambia de WiFi a datos móviles)
window.addEventListener('online', () => {
  console.log('🌐 Network online');
  const status = getConnectionStatus();
  
  if (status !== 'connected') {
    console.log('🔄 Network restored — forcing reconnect');
    setTimeout(() => {
      forceReconnect();
    }, 1000); // Pequeño delay para que la red se estabilice
  }
});

  // Inicializar modal de agregar wallet
  setupWalletModal(elements);

  // ====================================
  // 🎈 BOTÓN DE DONACIÓN CON ANIMACIÓN
  // ====================================
  if (elements.donateBtn) {
    elements.donateBtn.addEventListener('click', (e) => {
      // 🎈 Crear animación de corazones ANTES de abrir receive-screen
      createHeartBurst(elements.donateBtn, 3);
      
      // Haptic feedback (si está disponible)
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
      
      // Pequeño delay para apreciar el inicio de la animación
      setTimeout(() => {
        const developerWallet = {
          address: CONFIG.DONATION_WALLET_ADDRESS,
          customName: 'Support Development ❤️',
          balance: 0
        };
        openReceiveScreen(developerWallet);
      }, 150);
    });

    // ====================================
    // ✨ BONUS: Efecto al hover (opcional)
    // ====================================
    let hoverTimeout;
    
    elements.donateBtn.addEventListener('mouseenter', () => {
      hoverTimeout = setTimeout(() => {
        createFloatingHeart(elements.donateBtn);
      }, 500);
    });
    
    elements.donateBtn.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
    });
  }
});