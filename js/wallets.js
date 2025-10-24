// js/wallets.js
import { CONFIG, state } from './config.js';
import { formatBalance, fetchBalance } from './balanceClient.js';
import { adjustBalanceFontSize, setupWalletAddressToggle, truncateWalletAddress, formatRelativeTime } from './ui.js';
import { loadWalletsFromStorage, saveWallet as saveWalletToStorage, deleteWalletFromStorage, updateWalletBalance } from './storage.js';
import { openReceiveScreen } from './receive-screen.js';
import { setupEditableWalletName } from './edit-wallet-name.js';
import { subscribe, unsubscribe } from './realtime.js'; // ← Importar getConnectionStatus


/* ===================== LOAD & SAVE ===================== */
export function loadSavedWallets(elements) {
    state.savedWallets = loadWalletsFromStorage();
    renderTrackedWallets(elements);

    // ✅ CAMBIO: Ya no llamamos connect() aquí, solo suscribimos si hay wallets
    if (state.savedWallets.length) {
        state.savedWallets.forEach(wallet => {
            subscribe(wallet.address);
        });
    }
}

export function saveWallet(address, balance, elements, customName = null) {
    if (!customName) {
        const nameEl = document.querySelector(`.wallet-name[data-address="${address}"]`);
        customName = nameEl?.textContent.trim() || null;
    }

    saveWalletToStorage(address, balance, customName);
    state.savedWallets = loadWalletsFromStorage();
    renderTrackedWallets(elements);

    // ✅ CAMBIO: Solo suscribirse, el WS ya está conectado desde app.js
    subscribe(address);
}

export function deleteWallet(address, elements) {
    state.savedWallets = deleteWalletFromStorage(address);

    unsubscribe(address); // Desuscribimos del WS
    renderTrackedWallets(elements);
}

/* ===================== RENDER WALLET ===================== */
export function renderWalletCard(wallet, elements, isPreview = false) {
    const card = document.createElement('div');
    card.className = 'wallet-item';
    const walletName = wallet.customName || `Wallet ${wallet.address.slice(-4)}`;
    const balance = wallet.balance ?? 0;
    
    card.innerHTML = `
        <div class="wallet-header">
            <button class="wallet-btn wallet-btn-delete" title="Delete Wallet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
            </button>
            
            <div class="wallet-name-container">
                <div class="wallet-name" data-address="${wallet.address}" contenteditable="false">
                    ${walletName}
                </div>
                <svg class="edit-icon ${isPreview ? 'always-visible' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </div>
            
            <button class="wallet-btn wallet-btn-refresh" title="Refresh Balance">
                <span class="refresh-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.37 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                </span>
            </button>
        </div>
        
        <div class="wallet-last-update" data-timestamp="${wallet.lastUpdated || 0}">
            <span class="update-text">${formatRelativeTime(wallet.lastUpdated)}</span>
        </div>
        
        <div class="wallet-balance-center">
            <img src="./nexa-logo.svg" class="logo-icon-min">
            <span class="wallet-balance">${formatBalance(balance)}</span>
        </div>
        
        <div class="wallet-address" data-full-address="${wallet.address}">
            <svg class="copy-hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            ${wallet.address}
        </div>
        
        <button class="wallet-receive-btn" title="View Receive Address">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span>Receive</span>
        </button>
    `;
    
    attachWalletListeners(card, wallet, elements, isPreview);
    
    const receiveBtn = card.querySelector('.wallet-receive-btn');
    if (receiveBtn) receiveBtn.addEventListener('click', () => openReceiveScreen(wallet));
    
    const updateTimestamp = () => {
        const timestampEl = card.querySelector('.wallet-last-update');
        if (timestampEl) {
            const textEl = timestampEl.querySelector('.update-text');
            if (textEl) textEl.textContent = formatRelativeTime(wallet.lastUpdated);
        }
    };
    
    const intervalId = setInterval(updateTimestamp, 30000);
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === card) {
                    clearInterval(intervalId);
                    observer.disconnect();
                }
            });
        });
    });
    if (card.parentNode) observer.observe(card.parentNode, { childList: true });
    
    return card;
}

/* ===================== ATTACH LISTENERS ===================== */
function attachWalletListeners(item, wallet, elements, isPreview = false) {
    const refreshBtn = item.querySelector('.wallet-btn-refresh');
    const deleteBtn = item.querySelector('.wallet-btn-delete');
    const addressEl = item.querySelector('.wallet-address');
    const nameEl = item.querySelector('.wallet-name');
    const editIcon = item.querySelector('.edit-icon');
    const timestamp = item.querySelector('.wallet-last-update'); // ← Añadir
    if (nameEl && editIcon) {
        setupEditableWalletName(nameEl, editIcon, wallet.address);
    }

    if (refreshBtn) {
        // Verificar si el WS está conectado para mostrar/ocultar el botón y timestamp
        import('./realtime.js').then(module => {
            const status = module.getConnectionStatus();
            if (status === 'connected') {
                refreshBtn.classList.remove('show');
                if (timestamp) timestamp.style.display = 'none'; // ← Ocultar timestamp
            } else {
                refreshBtn.classList.add('show');
                if (timestamp) timestamp.style.display = 'flex'; // ← Mostrar timestamp
            }
        });

        refreshBtn.addEventListener('click', async e => {
            e.stopPropagation();
            if (refreshBtn.classList.contains('loading')) return;

            const icon = refreshBtn.querySelector('.refresh-icon');
            icon.classList.add('loading');
            refreshBtn.disabled = true;

            const balance = await fetchBalance(wallet.address);
            if (balance !== null) {
                wallet.balance = balance;
                wallet.lastUpdated = Date.now();
                updateWalletBalance(wallet.address, balance);
                state.savedWallets = loadWalletsFromStorage();

                const balanceEl = item.querySelector('.wallet-balance');
                if (balanceEl) {
                    balanceEl.innerHTML = formatBalance(balance);
                    adjustBalanceFontSize(balanceEl);
                }

                const timestampEl = item.querySelector('.wallet-last-update');
                if (timestampEl) {
                    const textEl = timestampEl.querySelector('.update-text');
                    if (textEl) {
                        textEl.textContent = formatRelativeTime(wallet.lastUpdated);
                        timestampEl.setAttribute('data-timestamp', wallet.lastUpdated);
                    }
                }
            }

            icon.classList.remove('loading');
            refreshBtn.disabled = false;
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (isPreview) {
                const event = new CustomEvent('previewDelete', { detail: wallet });
                item.dispatchEvent(event);
            } else {
                showDeleteConfirmation(wallet.address, elements);
            }
        });
    }

    if (addressEl) setupWalletAddressToggle([addressEl]);
}

/* ===================== RENDER LIST ===================== */
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
    });
    
    list.querySelectorAll('.wallet-address').forEach(addr => {
        truncateWalletAddress(addr, addr.dataset.fullAddress);
    });
    
    setupWalletAddressToggle(list.querySelectorAll('.wallet-address'));
}

/* ===================== EMPTY STATE ===================== */
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

    const refreshAllIcon = elements.refreshAllBtn?.querySelector('.refresh-icon');
    if (refreshAllIcon) refreshAllIcon.classList.add('loading');
    if (elements.refreshAllBtn) elements.refreshAllBtn.disabled = true;

    const refreshIcons = list.querySelectorAll('.wallet-btn-refresh .refresh-icon');
    refreshIcons.forEach(icon => {
        icon.classList.add('loading');
        const btn = icon.closest('.wallet-btn-refresh');
        if (btn) btn.disabled = true;
    });

    for (const wallet of state.savedWallets) {
        const balance = await fetchBalance(wallet.address);
        if (balance !== null) {
            wallet.balance = balance;
            wallet.lastUpdated = Date.now();
            updateWalletBalance(wallet.address, balance);
        }
    }

    state.savedWallets = loadWalletsFromStorage();
    renderTrackedWallets(elements);

    if (refreshAllIcon) refreshAllIcon.classList.remove('loading');
    if (elements.refreshAllBtn) elements.refreshAllBtn.disabled = false;
}

/* ===================== DELETE CONFIRMATION ===================== */
function showDeleteConfirmation(address, elements) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmAddress = document.getElementById('confirmAddress');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');

    if (!confirmModal || !confirmAddress || !confirmDeleteBtn || !confirmCancelBtn) return;

    confirmAddress.textContent = address;
    confirmModal.classList.remove('hidden');

    const newDeleteBtn = confirmDeleteBtn.cloneNode(true);
    confirmDeleteBtn.parentNode.replaceChild(newDeleteBtn, confirmDeleteBtn);
    newDeleteBtn.addEventListener('click', () => {
        deleteWallet(address, elements);
        confirmModal.classList.add('hidden');
    });

    const newCancelBtn = confirmCancelBtn.cloneNode(true);
    confirmCancelBtn.parentNode.replaceChild(newCancelBtn, confirmCancelBtn);
    newCancelBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
    });
}