// js/app.js
import { state } from './config.js';
import { registerServiceWorker, setupInstallPrompt } from './pwa.js';
import { loadSavedWallets, refreshAllWallets } from './wallets.js';
import { setupWalletModal } from './add-wallet-modal.js';

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
        refreshAllBtn: document.getElementById('refreshAllBtn'),
        trackedWalletsSection: document.getElementById('trackedWalletsSection'),
        trackedWalletsList: document.getElementById('trackedWalletsList'),
        // Confirm modal
        confirmModal: document.getElementById('confirmModal'),
        confirmAddress: document.getElementById('confirmAddress'),
        confirmCancelBtn: document.getElementById('confirmCancelBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        statusIndicator: document.getElementById('statusIndicator'),
        statusText: document.getElementById('statusText'),
    };

    state.modalWallet = null;

    // Service Worker y PWA
    registerServiceWorker();
    setupInstallPrompt();

    // Cargar wallets guardadas
    loadSavedWallets(elements);

    // Inicializar modal de agregar wallet
    setupWalletModal(elements);

    // Refresh All
    if (elements.refreshAllBtn)
        elements.refreshAllBtn.addEventListener('click', () => refreshAllWallets(elements));

    // Si hay wallets guardadas, refrescarlas al iniciar
    if (state.savedWallets?.length) refreshAllWallets(elements);
});
