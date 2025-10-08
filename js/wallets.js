import { CONFIG, state } from './config.js';
import { formatBalance, formatTime, fetchBalance } from './balanceClient.js';
import { adjustBalanceFontSize } from './ui.js';

/* ===================== LOAD & SAVE ===================== */
export function loadSavedWallets(elements) {
    try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        state.savedWallets = stored ? JSON.parse(stored) : [];
        renderTrackedWallets(elements);
    } catch (error) {
        console.error('Error loading wallets:', error);
        state.savedWallets = [];
    }
}

export function saveWallet(address, balance, elements) {
    const existingIndex = state.savedWallets.findIndex(w => w.address === address);
    const newWallet = { address, balance, timestamp: Date.now() };

    if (existingIndex !== -1) state.savedWallets[existingIndex] = newWallet;
    else state.savedWallets.unshift(newWallet);

    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    renderTrackedWallets(elements);
}

export function deleteWallet(address, elements) {
    state.savedWallets = state.savedWallets.filter(w => w.address !== address);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    renderTrackedWallets(elements);
}

/* ===================== RENDER ===================== */
export function renderWalletCard({ address, balance, timestamp }, elements) {
    const wrapper = document.createElement("div");
    wrapper.className = "wallet-item";

    wrapper.innerHTML = `
        <div class="wallet-top">
            <div class="wallet-updated">Updated: ${formatTime(timestamp || Date.now())}</div>
            <div class="wallet-actions">
                <button class="wallet-btn refresh-wallet" title="Refresh"><span class="refresh-icon">↻</span></button>
                <button class="wallet-btn delete-wallet" title="Delete">✖</button>
            </div>
        </div>
        <div class="wallet-balance-center">
            <img src="./nexa-logo.svg" class="logo-icon-min">
            <span class="wallet-balance">${formatBalance(balance)}</span>
        </div>
        <div class="wallet-address">${address}</div>
    `;

    // 🔑 Añadir listeners aquí directamente
    attachWalletListeners(wrapper, { address, balance, timestamp }, elements);

    return wrapper;
}

/* ===================== ATTACH LISTENERS ===================== */
function attachWalletListeners(item, wallet, elements) {
    const refreshBtn = item.querySelector('.refresh-wallet');
    const deleteBtn = item.querySelector('.delete-wallet');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async e => {
            e.stopPropagation();
            
            // Evitar múltiples clicks mientras carga
            if (refreshBtn.classList.contains('loading')) return;
            
            // 🔄 Añadir clase loading para rotar el botón
            const icon = refreshBtn.querySelector('.refresh-icon');
            icon.classList.add('loading');
            refreshBtn.disabled = true;

            const balance = await fetchBalance(wallet.address);
            
            if (balance !== null) {
                wallet.balance = balance;
                wallet.timestamp = Date.now();
                
                // Actualizar en el array global
                const index = state.savedWallets.findIndex(w => w.address === wallet.address);
                if (index !== -1) {
                    state.savedWallets[index] = wallet;
                }
                
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
                
                // Actualizar solo el balance y timestamp en el DOM
                const balanceEl = item.querySelector('.wallet-balance');
                const updatedEl = item.querySelector('.wallet-updated');
                
                if (balanceEl) {
                    balanceEl.innerHTML = formatBalance(balance); // Usar innerHTML para interpretar el HTML
                    adjustBalanceFontSize(balanceEl);
                }
                if (updatedEl) {
                    updatedEl.textContent = `Updated: ${formatTime(Date.now())}`;
                }
            }
            
            // Quitar clase loading
            icon.classList.remove('loading');
            refreshBtn.disabled = false;
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            showDeleteConfirmation(wallet.address, elements);
        });
    }
}

/* ===================== MAIN LIST RENDER ===================== */
export function renderTrackedWallets(elements) {
    const section = elements.trackedWalletsSection;
    const list = elements.trackedWalletsList;
    if (!section || !list) return;

    if (state.savedWallets.length === 0) {
        section.classList.remove('hidden');
        list.innerHTML = createEmptyState();
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = '';

    state.savedWallets.forEach(wallet => {
        const item = renderWalletCard(wallet, elements);
        list.appendChild(item);
        
        const balanceEl = item.querySelector('.wallet-balance');
        if (balanceEl) adjustBalanceFontSize(balanceEl);
    });
}

function createEmptyState() {
    return `
        <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
            <h3 class="empty-state-title">No wallets tracked</h3>
            <p class="empty-state-text">
                Monitor your Nexa wallets anywhere 
                while keeping your real funds stored safely.
            </p>
            <div class="empty-state-hint">
                Tap<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M12 5v14M5 12h14"/>
        </svg>to add your first wallet
            </div>
        </div>
    `;
}


/* ===================== REFRESH ALL ===================== */
export async function refreshAllWallets(elements) {
    const list = elements.trackedWalletsList;
    if (!list) return;

    // Ícono del botón "Refresh All"
    const refreshAllIcon = elements.refreshAllBtn.querySelector('.refresh-icon');
    if (refreshAllIcon) refreshAllIcon.classList.add('loading');
    elements.refreshAllBtn.disabled = true;

    // Todos los íconos individuales de wallets
    const refreshIcons = list.querySelectorAll('.refresh-wallet .refresh-icon');
    refreshIcons.forEach(icon => {
        icon.classList.add('loading');
        icon.closest('.refresh-wallet').disabled = true;
    });

    // Actualizar balances
    for (const wallet of state.savedWallets) {
        const balance = await fetchBalance(wallet.address);
        if (balance !== null) {
            wallet.balance = balance;
            wallet.timestamp = Date.now();
        }
    }

    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    
    // Re-renderizar todas las wallets
    renderTrackedWallets(elements);

    // Quitar animaciones y habilitar botones
    if (refreshAllIcon) refreshAllIcon.classList.remove('loading');
    elements.refreshAllBtn.disabled = false;

    list.querySelectorAll('.refresh-wallet').forEach(btn => btn.disabled = false);
}


/* ===================== DELETE CONFIRMATION ===================== */
function showDeleteConfirmation(address, elements) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmAddress = document.getElementById('confirmAddress');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (!confirmModal || !confirmAddress || !confirmDeleteBtn) return;
    
    // Mostrar dirección
    confirmAddress.textContent = address;
    
    // Mostrar modal
    confirmModal.classList.remove('hidden');
    
    // Crear nuevo listener para evitar duplicados
    const newDeleteBtn = confirmDeleteBtn.cloneNode(true);
    confirmDeleteBtn.parentNode.replaceChild(newDeleteBtn, confirmDeleteBtn);
    
    newDeleteBtn.addEventListener('click', () => {
        deleteWallet(address, elements);
        confirmModal.classList.add('hidden');
    });
}

/* ===================== HELPERS ===================== */
function createLoadingCard(text = "Fetching balance...") {
    const loadingCard = document.createElement('div');
    loadingCard.className = 'wallet-item loading-card';
    loadingCard.innerHTML = `
        <div class="wallet-loading-spinner"></div>
        <div class="wallet-loading-text">${text}</div>
    `;
    return loadingCard;
}