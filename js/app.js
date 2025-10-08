// js/app.js
import { state } from './config.js';
import { registerServiceWorker, setupInstallPrompt } from './pwa.js';
import { fetchBalance } from './balanceClient.js';
import { loadSavedWallets, refreshAllWallets, saveWallet } from './wallets.js';
import { showError, hideError } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
        addWalletBtn: document.getElementById('addWalletBtn'),
        inputSection: document.getElementById('inputSection'),
        addressInput: document.getElementById('addressInput'),
        trackWalletBtn: document.getElementById('checkBalanceBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        clearBtn: document.getElementById('clearBtn'),
        refreshAllBtn: document.getElementById('refreshAllBtn'),
        trackedWalletsSection: document.getElementById('trackedWalletsSection'),
        trackedWalletsList: document.getElementById('trackedWalletsList'),
        errorMessage: document.getElementById('errorMessage'),
        statusIndicator: document.getElementById('statusIndicator'),
        statusText: document.getElementById('statusText')
    };

    registerServiceWorker();
    setupInstallPrompt();
    loadSavedWallets(elements);
    setupEventListeners(elements);

    if (state.savedWallets.length > 0) refreshAllWallets(elements);
});

function setupEventListeners(elements) {
    elements.addWalletBtn.addEventListener('click', () => {
        elements.addWalletBtn.classList.add('hidden');
        elements.inputSection.classList.remove('hidden');
        elements.addressInput.focus();
    });

    elements.cancelBtn.addEventListener('click', () => {
        resetInput(elements);
    });

    elements.trackWalletBtn.addEventListener('click', () => handleTrackWallet(elements));
    elements.addressInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleTrackWallet(elements);
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

    // Crear una tarjeta temporal de "cargando"
    const loadingCard = document.createElement('div');
    loadingCard.className = 'wallet-item loading';
    loadingCard.innerHTML = `
        <div class="wallet-top">
            <div class="wallet-address">${address}</div>
        </div>
        <div class="wallet-balance-center">
            <div class="loading-spinner"></div>
        </div>
        <div class="wallet-updated">Loading balance...</div>
    `;
    elements.trackedWalletsSection.classList.remove('hidden');
    elements.trackedWalletsList.prepend(loadingCard);

    try {
        const balance = await fetchBalance(address, elements);
        if (balance !== null) {
            saveWallet(address, balance, elements);
        }
    } finally {
        loadingCard.remove(); // quitar card temporal pase lo que pase
        resetInput(elements);
    }
}

function resetInput(elements) {
    elements.inputSection.classList.add('hidden');
    elements.addWalletBtn.classList.remove('hidden');
    elements.addressInput.value = '';
    elements.clearBtn.classList.remove('visible');
    hideError(elements);
}
