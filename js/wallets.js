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
                <button class="wallet-btn refresh-wallet" title="Refresh">⟳</button>
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
            refreshBtn.classList.add('loading');
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
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm('Delete this wallet?')) deleteWallet(wallet.address, elements);
        });
    }
}

/* ===================== MAIN LIST RENDER ===================== */
export function renderTrackedWallets(elements) {
    const section = elements.trackedWalletsSection;
    const list = elements.trackedWalletsList;
    if (!section || !list) return;

    if (state.savedWallets.length === 0) {
        section.classList.add('hidden');
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

/* ===================== REFRESH ALL ===================== */
export async function refreshAllWallets(elements) {
    const list = elements.trackedWalletsList;
    if (!list) return;

    // Obtener todos los botones de refresh y añadir clase loading
    const refreshButtons = list.querySelectorAll('.refresh-wallet');
    refreshButtons.forEach(btn => {
        btn.classList.add('loading');
        btn.disabled = true;
    });

    // Actualizar todas las wallets
    for (const wallet of state.savedWallets) {
        const balance = await fetchBalance(wallet.address);
        if (balance !== null) {
            wallet.balance = balance;
            wallet.timestamp = Date.now();
        }
    }

    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    
    // Re-renderizar todas las wallets (esto quita automáticamente el loading)
    renderTrackedWallets(elements);
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