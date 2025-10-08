// js/app.js
import { state } from './config.js';
import { registerServiceWorker, setupInstallPrompt } from './pwa.js';
import { fetchBalance } from './balanceClient.js';
import { loadSavedWallets, refreshAllWallets, saveWallet } from './wallets.js';
import { showError, hideError } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
        addWalletBtn: document.getElementById('addWalletBtn'),
        addWalletModal: document.getElementById('addWalletModal'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        modalTitle: document.getElementById('modalTitle'),
        modalPreviewCard: document.getElementById('modalPreviewCard'),
        modalActionContainer: document.getElementById('modalActionContainer'),
        addressInput: document.getElementById('addressInput'),
        trackWalletBtn: document.getElementById('trackWalletBtn'),
        clearBtn: document.getElementById('clearBtn'),
        refreshAllBtn: document.getElementById('refreshAllBtn'),
        trackedWalletsSection: document.getElementById('trackedWalletsSection'),
        trackedWalletsList: document.getElementById('trackedWalletsList'),
        errorMessage: document.getElementById('errorMessage'),
        statusIndicator: document.getElementById('statusIndicator'),
        statusText: document.getElementById('statusText'),
        // Confirm modal
        confirmModal: document.getElementById('confirmModal'),
        confirmAddress: document.getElementById('confirmAddress'),
        confirmCancelBtn: document.getElementById('confirmCancelBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
    };

    // Estado temporal del modal
    state.modalWallet = null;

    registerServiceWorker();
    setupInstallPrompt();
    loadSavedWallets(elements);
    setupEventListeners(elements);

    if (state.savedWallets.length > 0) refreshAllWallets(elements);
});

function setupEventListeners(elements) {
    // Abrir modal
    elements.addWalletBtn.addEventListener('click', () => {
        elements.addWalletModal.classList.remove('hidden');
        setTimeout(() => elements.addressInput.focus(), 100);
    });

    // Cerrar modal
    elements.closeModalBtn.addEventListener('click', () => closeModal(elements));
    
    // Cerrar al hacer click en overlay
    elements.addWalletModal.addEventListener('click', (e) => {
        if (e.target === elements.addWalletModal) closeModal(elements);
    });

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.addWalletModal.classList.contains('hidden')) {
            closeModal(elements);
        }
    });

    // Track wallet (listener dinámico se maneja en el contenedor)
    elements.trackWalletBtn.addEventListener('click', () => handleTrackWallet(elements));
    
    // Confirm modal
    elements.confirmCancelBtn.addEventListener('click', () => {
        elements.confirmModal.classList.add('hidden');
    });
    
    elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmModal) {
            elements.confirmModal.classList.add('hidden');
        }
    });
    
    // Enter en input
    elements.addressInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            handleTrackWallet(elements);
        }
    });

    elements.addressInput.addEventListener('input', e => {
        elements.clearBtn.classList.toggle('visible', !!e.target.value.trim());
        hideError(elements);
    });

    elements.clearBtn.addEventListener('click', () => {
        elements.addressInput.value = '';
        elements.clearBtn.classList.remove('visible');
        elements.addressInput.focus();
    });

    if (elements.refreshAllBtn)
        elements.refreshAllBtn.addEventListener('click', () => refreshAllWallets(elements));
}

async function handleTrackWallet(elements) {
    const address = elements.addressInput.value.trim();
    if (!address.startsWith('nexa:'))
        return showError(elements, 'Address must start with "nexa:"');

    hideError(elements);

    // Mostrar loading card
    showLoadingPreview(elements, address);

    try {
        const balance = await fetchBalance(address);
        
        if (balance !== null) {
            // Guardar temporalmente
            state.modalWallet = { address, balance, timestamp: Date.now() };
            // Mostrar preview con el diseño de wallets.js
            showWalletPreview(elements, address, balance);
        } else {
            showError(elements, 'Failed to fetch balance');
            resetModalState(elements);
        }
    } catch (error) {
        showError(elements, error.message || 'Error fetching balance');
        resetModalState(elements);
    }
}


function showLoadingPreview(elements, address) {
    elements.modalTitle.textContent = 'Fetching Balance...';
    elements.modalPreviewCard.classList.remove('hidden');
    
    // Usar el mismo diseño de wallet-item con loading
    elements.modalPreviewCard.innerHTML = `
        <div class="wallet-item">
            <div class="wallet-top">
                <div class="wallet-updated">Loading...</div>
                <div class="wallet-actions"></div>
            </div>
            <div class="wallet-balance-center">
                <div class="loading-spinner"></div>
            </div>
            <div class="wallet-address">${address}</div>
        </div>
    `;
}

function showWalletPreview(elements, address, balance) {
    elements.modalTitle.textContent = 'Wallet Found';
    
    // Importar funciones de wallets.js
    import('./balanceClient.js').then(({ formatBalance, formatTime }) => {
        // Usar exactamente el mismo diseño que wallets.js
        elements.modalPreviewCard.innerHTML = `
            <div class="wallet-item preview-wallet">
                <div class="wallet-top">
                    <div class="wallet-updated">Preview</div>
                    <div class="wallet-actions">
                        <button class="wallet-btn delete-preview" title="Delete">✖</button>
                    </div>
                </div>
                <div class="wallet-balance-center">
                    <img src="./nexa-logo.svg" class="logo-icon-min">
                    <span class="wallet-balance">${formatBalance(balance)}</span>
                </div>
                <div class="wallet-address">${address}</div>
            </div>
        `;
        
        // Listener para el botón delete
        const deleteBtn = elements.modalPreviewCard.querySelector('.delete-preview');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => resetModalState(elements));
        }
        
        // Cambiar botón Track por Save
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
        
        // Agregar listener al nuevo botón Save
        const saveBtn = document.getElementById('saveWalletBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (state.modalWallet) {
                    saveWallet(state.modalWallet.address, state.modalWallet.balance, elements);
                    closeModal(elements);
                }
            });
        }
    });
}

function resetModalState(elements) {
    elements.modalTitle.textContent = 'Add Wallet';
    elements.modalPreviewCard.classList.add('hidden');
    elements.modalPreviewCard.innerHTML = '';
    
    // Restaurar botón Track
    elements.modalActionContainer.innerHTML = `
        <button id="trackWalletBtn" class="btn btn-primary" style="width: 100%;">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            Track Wallet
        </button>
    `;
    
    // Re-agregar listener al botón Track
    const trackBtn = document.getElementById('trackWalletBtn');
    if (trackBtn) {
        trackBtn.addEventListener('click', () => handleTrackWallet(elements));
    }
    
    state.modalWallet = null;
}

function closeModal(elements) {
    elements.addWalletModal.classList.add('hidden');
    elements.addressInput.value = '';
    elements.clearBtn.classList.remove('visible');
    hideError(elements);
    
    // Reset después de cerrar
    setTimeout(() => resetModalState(elements), 300);
}
