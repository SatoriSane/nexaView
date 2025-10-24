//js/ui.js
/* ===================== UI HELPERS ===================== */

/**
 * Muestra un mensaje de error en la UI
 * @param {object} elements 
 * @param {string} message 
 */
export function showError(elements, message) {
    if (!elements || !elements.errorMessage) return;
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

/**
 * Oculta el mensaje de error
 * @param {object} elements 
 */
export function hideError(elements) {
    if (!elements || !elements.errorMessage) return;
    elements.errorMessage.classList.add('hidden');
}

/**
 * Activa/desactiva el estado de carga de botones y overlay
 * @param {object} elements 
 * @param {boolean} loading 
 */
export function setLoadingState(elements, loading) {
    if (!elements) return;
    if (elements.trackWalletBtn) elements.trackWalletBtn.disabled = loading;
    if (loading) elements.loadingOverlay?.classList.remove('hidden');
    else elements.loadingOverlay?.classList.add('hidden');
    if (elements.refreshAllBtn) elements.refreshAllBtn.disabled = loading;
}

/**
 * Actualiza el indicador de estado del WebSocket
 * @param {object} elements
 * @param {string} text
 * @param {string} type - 'connected' | 'disconnected' | 'connecting' | 'error'
 */
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

/**
 * Ajusta el tamaño de fuente de un balance si no cabe en su contenedor
 * @param {HTMLElement} element 
 */
export function adjustBalanceFontSize(element) {
    if (!element) return;
    element.style.fontSize = '';
    requestAnimationFrame(() => {
        const container = element.parentElement;
        if (!container) return;
        const containerWidth = container.offsetWidth - 40; // margen
        const contentWidth = element.scrollWidth;
        if (contentWidth > containerWidth) {
            const scale = containerWidth / contentWidth;
            const currentSize = parseFloat(window.getComputedStyle(element).fontSize);
            element.style.fontSize = `${currentSize * scale * 0.95}px`;
        }
    });
}

/**
 * Función auxiliar para truncar direcciones de wallet
 * (Por si no existe o necesitas reemplazarla)
 */
export function truncateWalletAddress(element, fullAddress) {
    if (!element || !fullAddress) return;
    
    // Remover clase expanded si existe
    element.classList.remove('expanded');
    
    // Truncar: mostrar primeros 8 y últimos 8 caracteres
    const start = fullAddress.slice(0, 12);
    const end = fullAddress.slice(-4);
    element.textContent = `${start}...${end}`;
}
/* ===================== TOGGLE + COPY DIRECCIÓN ===================== */
export function setupWalletAddressToggle(addressElements = document.querySelectorAll('.wallet-address, .qr-wallet-text')) {
    if (!addressElements) return;
    
    addressElements.forEach(addr => {
        if (addr.dataset.toggleInit) return;
        addr.dataset.toggleInit = 'true';
        
        addr.addEventListener('click', async e => {
            e.stopPropagation();
            
            const fullAddress = addr.dataset.fullAddress;
            if (!fullAddress) {
                console.error('No se encontró data-full-address en el elemento.');
                return;
            }
            
            // Contraer otras direcciones expandidas
            document.querySelectorAll('.wallet-address.expanded, .qr-wallet-text.expanded').forEach(exp => {
                if (exp !== addr) {
                    exp.classList.remove('expanded');
                    truncateWalletAddress(exp, exp.dataset.fullAddress);
                }
            });
            
            // Toggle entre expandido y contraído
            const expanded = addr.classList.toggle('expanded');
            
            if (!expanded) {
                // Se contrajo
                truncateWalletAddress(addr, fullAddress);
            } else {
                // Se expandió
                addr.textContent = fullAddress;
                
                // Copiar automáticamente al expandir
                try {
                    await navigator.clipboard.writeText(fullAddress);
                    addr.classList.add('copied');
                    setTimeout(() => addr.classList.remove('copied'), 500);
                } catch (err) {
                    console.error('No se pudo copiar la dirección:', err);
                }
            }
        });
    });
}
/* ===================== FORMATO RELATIVO DE TIEMPO ===================== */
export function formatRelativeTime(timestamp) {
    if (!timestamp) return "";

    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); // diferencia en segundos

    if (diff < 60) return `${diff}s ago`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes}min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Función para obtener la tarjeta de la wallet
export function getWalletCard(address) {
    return document.querySelector(`.wallet-item .wallet-address[data-full-address="${address}"]`)
                   ?.closest('.wallet-item');
}

/**
 * Controla la animación de carga y la visibilidad del botón de refresh.
 * Esto asegura que el botón aparezca, gire y luego se oculte, sin saltos.
 * @param {string} address - Dirección de la wallet
 * @param {boolean} isLoading - true para iniciar giro y mostrar, false para detener y ocultar.
 */
export function setRefreshLoading(address, isLoading) {
    const walletCard = getWalletCard(address);
    if (!walletCard) return;

    const refreshBtn = walletCard.querySelector('.wallet-btn-refresh');
    const refreshIcon = walletCard.querySelector('.wallet-btn-refresh .refresh-icon');

    if (refreshBtn && refreshIcon) {
        if (isLoading) {
            // Muestra el botón (.show) y activa el giro (.loading)
            refreshBtn.classList.add('show');
            refreshIcon.classList.add('loading');
        } else {
            // Detiene el giro y oculta el botón
            refreshBtn.classList.remove('show');
            refreshIcon.classList.remove('loading');
        }
    }
}