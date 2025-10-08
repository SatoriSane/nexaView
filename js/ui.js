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
 * Actualiza el indicador de estado
 * @param {object} elements 
 * @param {string} text 
 * @param {string} type - 'ready' | 'error' | 'loading'
 */
export function updateStatus(elements, text, type = 'ready') {
    if (!elements) return;
    elements.statusText.textContent = text;
    elements.statusIndicator.className = 'status-indicator';
    if (type === 'error') elements.statusIndicator.classList.add('error');
    else if (type === 'loading') elements.statusIndicator.classList.add('loading');
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

/* ===================== WALLET ADDRESS TRUNCATION ===================== */

/**
 * Trunca centralmente una dirección, sacrificando caracteres antes de los últimos 4
 * @param {HTMLElement} element 
 * @param {string} fullAddress 
 */
/* ===================== TRUNCADO DE DIRECCIÓN ===================== */
export function truncateWalletAddress(element, fullAddress) {
    if (!element || !fullAddress) return;

    element.dataset.fullAddress = fullAddress;

    if (element.classList.contains('expanded')) {
        element.textContent = fullAddress;
        element.style.whiteSpace = 'normal'; // permitir salto de línea al expandir
        return;
    }

    element.style.whiteSpace = 'nowrap';
    element.textContent = fullAddress;

    if (element.scrollWidth <= element.offsetWidth) return;

    let startLen = fullAddress.length - 4;
    let truncated = fullAddress;

    while (element.scrollWidth > element.offsetWidth && startLen > 0) {
        truncated = `${fullAddress.slice(0, startLen)}…${fullAddress.slice(-4)}`;
        element.textContent = truncated;
        startLen--;
    }
}

/* ===================== TOGGLE DIRECCIÓN ===================== */
export function setupWalletAddressToggle(addressElements = document.querySelectorAll('.wallet-address')) {
    if (!addressElements) return;

    addressElements.forEach(addr => {
        if (addr.dataset.toggleInit) return; // evitar duplicados
        addr.dataset.toggleInit = 'true';

        const fullAddress = addr.dataset.fullAddress || addr.textContent.trim();
        addr.dataset.fullAddress = fullAddress;

        // Truncado inicial
        truncateWalletAddress(addr, fullAddress);

        // Click sobre la dirección
        addr.addEventListener('click', e => {
            e.stopPropagation();

            // Contraer otras direcciones expandidas
            document.querySelectorAll('.wallet-address.expanded').forEach(exp => {
                if (exp !== addr) {
                    exp.classList.remove('expanded');
                    truncateWalletAddress(exp, exp.dataset.fullAddress);
                }
            });

            const expanded = addr.classList.toggle('expanded');
            if (!expanded) truncateWalletAddress(addr, fullAddress);
            else {
                addr.textContent = fullAddress;
                addr.style.whiteSpace = 'normal';
            }
        });
    });

    // Click fuera: contraer todas las expandidas
    if (!document.body.dataset.walletListenerAttached) {
        document.body.addEventListener('click', () => {
            document.querySelectorAll('.wallet-address.expanded').forEach(exp => {
                exp.classList.remove('expanded');
                truncateWalletAddress(exp, exp.dataset.fullAddress);
            });
        });
        document.body.dataset.walletListenerAttached = 'true';
    }
}
