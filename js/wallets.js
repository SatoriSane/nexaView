//js/wallets.js
import { CONFIG, state } from './config.js';
import { formatBalance, formatTime, fetchBalance } from './balanceClient.js';
import { adjustBalanceFontSize, setupWalletAddressToggle, truncateWalletAddress, formatRelativeTime } from './ui.js';

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

/* ===================== RENDER WALLET ===================== */
export function renderWalletCard(wallet, elements, isPreview = false) {
    const card = document.createElement('div');
    card.className = 'wallet-item';

    card.innerHTML = `
        <div class="wallet-top">
            <div class="wallet-updated">${formatRelativeTime(wallet.timestamp)}</div>
            <div class="wallet-actions">
                <button class="wallet-btn delete-wallet" title="Delete">✖</button>
                ${'<button class="wallet-btn refresh-wallet" title="Refresh"><span class="refresh-icon">↻</span></button>'}
            </div>
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

                const index = state.savedWallets.findIndex(w => w.address === wallet.address);
                if (index !== -1) state.savedWallets[index] = wallet;
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));

                const balanceEl = item.querySelector('.wallet-balance');
                const updatedEl = item.querySelector('.wallet-updated');
                if (balanceEl) {
                    balanceEl.innerHTML = formatBalance(balance);
                    adjustBalanceFontSize(balanceEl);
                }
                if (updatedEl) updatedEl.textContent = formatRelativeTime(wallet.timestamp);
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
/* ===================== AUTO-UPDATE WALLET TIMESTAMPS ===================== */
setInterval(() => {
    document.querySelectorAll('.wallet-updated').forEach(el => {
        const address = el.closest('.wallet-item')?.querySelector('.wallet-address')?.dataset?.fullAddress;
        const wallet = state.savedWallets.find(w => w.address === address);
        if (wallet && wallet.timestamp) {
            el.textContent = formatRelativeTime(wallet.timestamp);
        }
    });
}, 10000); // cada 10 segundos

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

