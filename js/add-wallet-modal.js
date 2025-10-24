// js/add-wallet-modal.js
import { state } from './config.js';
import { fetchBalance } from './balanceClient.js';
import { saveWallet, renderWalletCard } from './wallets.js';
import { truncateWalletAddress, setupWalletAddressToggle, adjustBalanceFontSize, showError, hideError } from './ui.js';

/**
 * Configura el modal de agregar wallet:
 * - Abrir/cerrar modal
 * - Preview de wallet
 * - Guardar wallet
 */
export function setupWalletModal(elements) {
    if (!elements) return;

    // Abrir modal
    elements.addWalletBtn.addEventListener('click', () => {
        elements.addWalletModal.classList.remove('hidden');
        setTimeout(() => elements.addressInput.focus(), 100);
    });

    // Cerrar modal con botón o overlay
    elements.closeModalBtn.addEventListener('click', () => closeModal(elements));
    elements.addWalletModal.addEventListener('click', (e) => {
        if (e.target === elements.addWalletModal) closeModal(elements);
    });

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.addWalletModal.classList.contains('hidden')) {
            closeModal(elements);
        }
    });

    // Input
    elements.clearBtn.addEventListener('click', () => {
        elements.addressInput.value = '';
        elements.clearBtn.classList.remove('visible');
        elements.addressInput.focus();
        hideError(elements);
    });

    elements.addressInput.addEventListener('input', e => {
        elements.clearBtn.classList.toggle('visible', !!e.target.value.trim());
        hideError(elements);
    });

    elements.addressInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleTrackWallet(elements);
    });

    // Track Wallet
    if (elements.trackWalletBtn) {
        elements.trackWalletBtn.addEventListener('click', () => handleTrackWallet(elements));
    }
}

/* ===================== HANDLE TRACKING ===================== */
async function handleTrackWallet(elements) {
    const address = elements.addressInput.value.trim();
    if (!address.startsWith('nexa:')) return showError(elements, 'Address must start with "nexa:"');

    hideError(elements);
    showLoadingPreview(elements, address);

    try {
        const balance = await fetchBalance(address);
        if (balance !== null) {
            state.modalWallet = { address, balance, timestamp: Date.now() };
            showWalletPreview(elements, state.modalWallet);
        } else {
            showError(elements, 'Failed to fetch balance');
            resetModalState(elements);
        }
    } catch (error) {
        showError(elements, error.message || 'Error fetching balance');
        resetModalState(elements);
    }
}

/* ===================== PREVIEW ===================== */
function showLoadingPreview(elements, address) {
    elements.modalTitle.textContent = 'Fetching Balance...';
    elements.modalPreviewCard.classList.remove('hidden');

    const tempName = "Wallet Name";
    
    elements.modalPreviewCard.innerHTML = `
        <div class="wallet-item">
            <div class="wallet-header">
                <div></div>
                <div class="wallet-name-container">
                    <div class="wallet-name">${tempName}</div>
                </div>
                <div></div>
            </div>
            <div class="wallet-balance-center">
                <div class="loading-spinner"></div>
            </div>
            <div class="wallet-address" data-full-address="${address}">${address}</div>
        </div>
    `;

    const addressEl = elements.modalPreviewCard.querySelector('.wallet-address');
    requestAnimationFrame(() => truncateWalletAddress(addressEl, address));
}

function showWalletPreview(elements, wallet) {
    elements.modalTitle.textContent = 'Wallet Preview';
    elements.modalPreviewCard.innerHTML = '';

    // Reutilizar renderWalletCard de wallets.js con isPreview = true
    const card = renderWalletCard(wallet, elements, true);
    elements.modalPreviewCard.appendChild(card);

    // Ajustar tamaño de balance
    const balanceEl = card.querySelector('.wallet-balance');
    if (balanceEl) adjustBalanceFontSize(balanceEl);

    // Seleccionar elemento de dirección y asegurar dataset.fullAddress
    const addressEl = card.querySelector('.wallet-address');
    if (addressEl) {
        addressEl.dataset.fullAddress = wallet.address; // siempre la dirección completa
        addressEl.textContent = wallet.address;         // contenido inicial completo
        requestAnimationFrame(() => truncateWalletAddress(addressEl, wallet.address));
    }

    // Configurar toggle expand/contract
    setupWalletAddressToggle(card.querySelectorAll('.wallet-address'));

    // Reemplazar botón Track por Save
    elements.modalActionContainer.innerHTML = `
        <button id="saveWalletBtn" class="btn btn-primary" style="width: 100%;">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save Wallet
        </button>
    `;

    const saveBtn = document.getElementById('saveWalletBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (state.modalWallet) {
                saveWallet(state.modalWallet.address, state.modalWallet.balance, elements);
                closeModal(elements);
            }
        });
    }

    // Botón delete en preview solo resetea modal
    const deleteBtn = card.querySelector('.delete-wallet');
    if (deleteBtn) deleteBtn.addEventListener('click', () => resetModalState(elements));
}

/* ===================== RESET & CLOSE ===================== */
function resetModalState(elements) {
    elements.modalTitle.textContent = 'Add Wallet';
    elements.modalPreviewCard.classList.add('hidden');
    elements.modalPreviewCard.innerHTML = '';
    elements.modalActionContainer.innerHTML = `
        <button id="trackWalletBtn" class="btn btn-primary" style="width: 100%;">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            Track Wallet
        </button>
    `;

    const trackBtn = document.getElementById('trackWalletBtn');
    if (trackBtn) trackBtn.addEventListener('click', () => handleTrackWallet(elements));

    elements.addressInput.value = '';
    elements.clearBtn.classList.remove('visible');
    hideError(elements);
    state.modalWallet = null;
}

function closeModal(elements) {
    elements.addWalletModal.classList.add('hidden');
    resetModalState(elements);
}
