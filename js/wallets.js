//js/wallets.js
import { CONFIG, state } from './config.js';
import { formatBalance, formatTime, fetchBalance } from './balanceClient.js';
import { adjustBalanceFontSize, setupWalletAddressToggle, truncateWalletAddress } from './ui.js';
import { loadWalletsFromStorage, saveWallet as saveWalletToStorage, deleteWalletFromStorage, updateWalletName, updateWalletBalance } from './storage.js';

/* ===================== LOAD & SAVE ===================== */
export function loadSavedWallets(elements) {
    state.savedWallets = loadWalletsFromStorage();
    renderTrackedWallets(elements);
}

export function saveWallet(address, balance, elements) {
    const wallet = saveWalletToStorage(address, balance);
    state.savedWallets = loadWalletsFromStorage();
    renderTrackedWallets(elements);
}

export function deleteWallet(address, elements) {
    state.savedWallets = deleteWalletFromStorage(address);
    renderTrackedWallets(elements);
}

/* ===================== RENDER WALLET ===================== */
export function renderWalletCard(wallet, elements, isPreview = false) {
    const card = document.createElement('div');
    card.className = 'wallet-item';

    const walletName = wallet.customName || `wallet#${wallet.address.slice(-4)}`;

    card.innerHTML = `
        <div class="wallet-header">
            <button class="wallet-btn delete-wallet" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
            </button>
            <div class="wallet-name-container">
                <div class="wallet-name" data-address="${wallet.address}" contenteditable="false">
                    ${walletName}
                    ${isPreview ? `<svg class="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>` : ''}
                </div>
            </div>
            <button class="wallet-btn refresh-wallet" title="Refresh">
                <span class="refresh-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.37 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                </span>
            </button>
        </div>
        <div class="wallet-balance-center">
            <img src="./nexa-logo.svg" class="logo-icon-min">
            <span class="wallet-balance">${formatBalance(wallet.balance)}</span>
        </div>
        <div class="wallet-address" data-full-address="${wallet.address}">${wallet.address}</div>
    `;

    attachWalletListeners(card, wallet, elements, isPreview);

    return card;
}


/* ===================== ATTACH LISTENERS ===================== */
function attachWalletListeners(item, wallet, elements, isPreview = false) {
    const refreshBtn = item.querySelector('.refresh-wallet');
    const deleteBtn = item.querySelector('.delete-wallet');
    const addressEl = item.querySelector('.wallet-address');
    const nameEl = item.querySelector('.wallet-name');

    // Listener para editar nombre
    if (nameEl) {
        setupEditableName(nameEl, wallet.address);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async e => {
            e.stopPropagation();
            if (refreshBtn.classList.contains('loading')) return;

            const icon = refreshBtn.querySelector('.refresh-icon');
            icon.classList.add('loading');
            refreshBtn.disabled = true;

            const balance = await fetchBalance(wallet.address);
            if (balance !== null) {
                wallet.balance = balance;
                wallet.timestamp = Date.now();

                state.savedWallets = loadWalletsFromStorage();

                updateWalletBalance(wallet.address, balance);
                const balanceEl = item.querySelector('.wallet-balance');
                if (balanceEl) {
                    balanceEl.innerHTML = formatBalance(balance);
                    adjustBalanceFontSize(balanceEl);
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
                // Solo resetear modal
                const event = new CustomEvent('previewDelete', { detail: wallet });
                item.dispatchEvent(event);
            } else {
                showDeleteConfirmation(wallet.address, elements);
            }
        });
    }

    if (addressEl) setupWalletAddressToggle([addressEl]);
}

/* ===================== EDITABLE NAME ===================== */
function setupEditableName(nameEl, address) {
    let originalName = nameEl.textContent.trim();

    nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        nameEl.contentEditable = 'true';
        nameEl.classList.add('editing');
        nameEl.focus();
        
        // Seleccionar todo el texto
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });

    nameEl.addEventListener('blur', () => {
        finishEditing(nameEl, address);
    });

    nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nameEl.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            nameEl.textContent = originalName;
            nameEl.blur();
        }
    });

    function finishEditing(el, addr) {
        el.contentEditable = 'false';
        el.classList.remove('editing');
        
        const newName = el.textContent.trim();
        if (newName && newName !== originalName) {
            updateWalletName(addr, newName);
            originalName = newName;
        } else if (!newName) {
            // Si está vacío, restaurar nombre por defecto
            const defaultName = `wallet#${addr.slice(-4)}`;
            el.textContent = defaultName;
            updateWalletName(addr, defaultName);
            originalName = defaultName;
        }
    }
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
    
    // Truncado inicial
    list.querySelectorAll('.wallet-address').forEach(addr => {
        truncateWalletAddress(addr, addr.dataset.fullAddress);
    });
    
    // Setup toggle
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
    elements.refreshAllBtn.disabled = true;

    const refreshIcons = list.querySelectorAll('.refresh-wallet .refresh-icon');
    refreshIcons.forEach(icon => {
        icon.classList.add('loading');
        icon.closest('.refresh-wallet').disabled = true;
    });

    for (const wallet of state.savedWallets) {
        const balance = await fetchBalance(wallet.address);
        if (balance !== null) {
            wallet.balance = balance;
            wallet.timestamp = Date.now();
        }
    }

    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    renderTrackedWallets(elements);

    if (refreshAllIcon) refreshAllIcon.classList.remove('loading');
    elements.refreshAllBtn.disabled = false;
    list.querySelectorAll('.refresh-wallet').forEach(btn => btn.disabled = false);
}

/* ===================== DELETE CONFIRMATION ===================== */
function showDeleteConfirmation(address, elements) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmAddress = document.getElementById('confirmAddress');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');

    if (!confirmModal || !confirmAddress || !confirmDeleteBtn || !confirmCancelBtn) return;

    // Mostrar dirección en el modal
    confirmAddress.textContent = address;
    confirmModal.classList.remove('hidden');

    // ===== DELETE BUTTON =====
    const newDeleteBtn = confirmDeleteBtn.cloneNode(true);
    confirmDeleteBtn.parentNode.replaceChild(newDeleteBtn, confirmDeleteBtn);
    newDeleteBtn.addEventListener('click', () => {
        deleteWallet(address, elements);
        confirmModal.classList.add('hidden');
    });

    // ===== CANCEL BUTTON =====
    const newCancelBtn = confirmCancelBtn.cloneNode(true);
    confirmCancelBtn.parentNode.replaceChild(newCancelBtn, confirmCancelBtn);
    newCancelBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
    });
}

