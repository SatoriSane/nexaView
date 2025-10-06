// ===== CONFIGURATION & STATE =====
const CONFIG = {
    API_ENDPOINT: '/api/balance',
    STORAGE_KEY: 'nexaView_wallets'
};

let state = {
    currentAddress: '',
    isLoading: false,
    savedWallets: []
};

// ===== DOM ELEMENTS =====
const elements = {
    addWalletBtn: document.getElementById('addWalletBtn'),
    inputSection: document.getElementById('inputSection'),
    addressInput: document.getElementById('addressInput'),
    checkBalanceBtn: document.getElementById('checkBalanceBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    clearBtn: document.getElementById('clearBtn'),
    balanceSection: document.getElementById('balanceSection'),
    balanceAmount: document.getElementById('balanceAmount'),
    lastUpdated: document.getElementById('lastUpdated'),
    addressText: document.getElementById('addressText'),
    saveBtn: document.getElementById('saveBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    savedWalletsSection: document.getElementById('savedWalletsSection'),
    savedWalletsList: document.getElementById('savedWalletsList'),
    refreshAllBtn: document.getElementById('refreshAllBtn'),
    errorMessage: document.getElementById('errorMessage'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    registerServiceWorker();
    loadSavedWallets();
    setupEventListeners();
});


function initializeApp() {
    console.log('%c🚀 nexaView v1.0.8', 'color: #d4af37; font-size: 20px; font-weight: bold;');
    console.log('%cIf you see old content, run this command:', 'color: #f4d03f; font-size: 14px;');
    console.log('%cnavigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister())).then(() => caches.keys().then(k => Promise.all(k.map(c => caches.delete(c))))).then(() => location.reload())', 'background: #1a1a1a; color: #d4af37; padding: 10px; border-radius: 5px; font-family: monospace;');
    updateStatus('Ready', 'ready');
}

// ===== SERVICE WORKER =====
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered:', registration.scope);
            
            // Forzar actualización inmediata si hay un worker esperando
            if (registration.waiting) {
                console.log('Service Worker waiting detected, forcing update...');
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
                return;
            }
            
            // Detectar actualizaciones
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New Service Worker found, installing...');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Hay un nuevo SW instalado pero el viejo sigue activo
                        console.log('New version ready! Showing update notification...');
                        showUpdateNotification(newWorker);
                    }
                });
            });
            
            // Verificar actualizaciones cada 30 segundos (más frecuente)
            setInterval(() => {
                registration.update();
            }, 30000);
            
            // Verificar inmediatamente al cargar
            registration.update();
            
            // Escuchar mensajes del Service Worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SW_UPDATED') {
                    console.log('Service Worker updated to:', event.data.version);
                    window.location.reload();
                }
            });
            
            // Detectar cuando el controller cambia (nuevo SW tomó control)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Controller changed, reloading...');
                window.location.reload();
            });
            
        } catch (error) {
            console.error('Error registering Service Worker:', error);
        }
    }
}

// Mostrar notificación de actualización
function showUpdateNotification(newWorker) {
    const notification = document.getElementById('updateNotification');
    const updateBtn = document.getElementById('updateBtn');
    
    if (notification && updateBtn) {
        notification.classList.remove('hidden');
        
        updateBtn.addEventListener('click', () => {
            console.log('User clicked update, forcing activation...');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            notification.classList.add('hidden');
        });
    }
}

// ===== PWA INSTALL BUTTON =====
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // evita que el navegador muestre el prompt automáticamente
    deferredPrompt = e;

    // Crear botón solo si no existe
    if (!document.getElementById('installBtn')) {
        const header = document.querySelector('.header');
        const installBtn = document.createElement('button');
        installBtn.id = 'installBtn';
        installBtn.textContent = 'Install NexaView';
        installBtn.style.marginLeft = 'auto';
        installBtn.style.padding = '0.4rem 0.8rem';
        installBtn.style.fontSize = '0.9rem';
        installBtn.style.cursor = 'pointer';
        installBtn.style.background = '#d4af37';
        installBtn.style.color = '#000';
        installBtn.style.border = 'none';
        installBtn.style.borderRadius = '6px';
        installBtn.style.transition = '0.2s';
        installBtn.addEventListener('mouseenter', () => installBtn.style.opacity = '0.8');
        installBtn.addEventListener('mouseleave', () => installBtn.style.opacity = '1');

        header.appendChild(installBtn);

        installBtn.addEventListener('click', async () => {
            installBtn.disabled = true;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('User choice:', outcome);
            if (outcome === 'accepted') installBtn.style.display = 'none';
            deferredPrompt = null;
        });
    }
});

// Ocultar botón si la app ya fue instalada
window.addEventListener('appinstalled', () => {
    console.log('PWA installed!');
    const installBtn = document.getElementById('installBtn');
    if (installBtn) installBtn.style.display = 'none';
});

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Add Wallet button - shows input form
    elements.addWalletBtn.addEventListener('click', () => {
        elements.addWalletBtn.classList.add('hidden');
        elements.inputSection.classList.remove('hidden');
        elements.addressInput.focus();
    });
    
    // Cancel button - hides input form
    elements.cancelBtn.addEventListener('click', () => {
        elements.inputSection.classList.add('hidden');
        elements.addWalletBtn.classList.remove('hidden');
        elements.addressInput.value = '';
        elements.clearBtn.classList.remove('visible');
        hideError();
    });
    
    // Check balance button
    elements.checkBalanceBtn.addEventListener('click', handleCheckBalance);
    
    // Enter key in input
    elements.addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCheckBalance();
    });
    
    // Show/hide clear button
    elements.addressInput.addEventListener('input', (e) => {
        if (e.target.value.trim()) {
            elements.clearBtn.classList.add('visible');
        } else {
            elements.clearBtn.classList.remove('visible');
        }
        hideError();
    });
    
    // Clear button
    elements.clearBtn.addEventListener('click', () => {
        elements.addressInput.value = '';
        elements.clearBtn.classList.remove('visible');
        elements.addressInput.focus();
    });
    
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', () => {
            if (state.currentAddress && state.currentBalance !== undefined) {
                saveWallet(state.currentAddress, state.currentBalance);
            }
        });
    }
    
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', () => {
            if (state.currentAddress) {
                fetchBalance(state.currentAddress);
            }
        });
    }
    
    if (elements.refreshAllBtn) {
        elements.refreshAllBtn.addEventListener('click', refreshAllWallets);
    }
}

// ===== ADDRESS VALIDATION =====
function validateNexaAddress(address) {
    if (!address || address.trim().length === 0) {
        return { valid: false, error: 'Please enter an address' };
    }
    
    const trimmedAddress = address.trim();
    
    if (!trimmedAddress.startsWith('nexa:')) {
        return { valid: false, error: 'Address must start with "nexa:"' };
    }
    
    if (trimmedAddress.length < 50) {
        return { valid: false, error: 'Address appears to be too short' };
    }
    
    return { valid: true, address: trimmedAddress };
}

// ===== BALANCE QUERY =====
async function handleCheckBalance() {
    const address = elements.addressInput.value.trim();
    
    const validation = validateNexaAddress(address);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }
    
    state.currentAddress = validation.address;
    const balance = await fetchBalance(validation.address);
    
    if (balance !== null) {
        // Hide input form after successful check
        elements.inputSection.classList.add('hidden');
        elements.addWalletBtn.classList.remove('hidden');
        elements.addressInput.value = '';
        elements.clearBtn.classList.remove('visible');
    }
}

async function fetchBalance(address, silent = false) {
    if (state.isLoading && !silent) return;
    
    if (!silent) {
        state.isLoading = true;
        setLoadingState(true);
        hideError();
        updateStatus('Checking...', 'loading');
    }
    
    try {
        const response = await fetch(`${CONFIG.API_ENDPOINT}?address=${encodeURIComponent(address)}`);
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response was:', responseText);
            throw new Error('Invalid JSON response from server');
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!silent) {
            displayBalance(data.balance, address);
            updateStatus('Updated', 'ready');
        }
        
        return data.balance;
        
    } catch (error) {
        console.error('Error fetching balance:', error);
        if (!silent) {
            showError(`Error: ${error.message}`);
            updateStatus('Error', 'error');
        }
        return null;
        
    } finally {
        if (!silent) {
            state.isLoading = false;
            setLoadingState(false);
        }
    }
}

// ===== DISPLAY BALANCE =====
function displayBalance(balance, address) {
    state.currentBalance = balance;
    state.currentAddress = address;
    
    const formattedBalance = formatBalance(balance);
    
    elements.balanceAmount.innerHTML = formattedBalance;
    elements.lastUpdated.textContent = `Updated: ${formatTime(Date.now())}`;
    elements.addressText.textContent = address;
    elements.balanceSection.classList.remove('hidden');
    
    // Ajustar tamaño de fuente si el número es muy largo
    adjustBalanceFontSize(elements.balanceAmount);
    
    // Check if already saved
    const isSaved = state.savedWallets.some(w => w.address === address);
    if (isSaved) {
        elements.saveBtn.classList.add('saved');
        elements.saveBtn.title = 'Already saved';
    } else {
        elements.saveBtn.classList.remove('saved');
        elements.saveBtn.title = 'Save to list';
    }
}

function formatBalance(balance) {
    if (typeof balance === 'number') {
        // Convert from satoshis to NEXA (1 NEXA = 100 satoshis)
        const nexaAmount = balance / 100;
        
        // Separar parte entera y decimal
        const integerPart = Math.floor(nexaAmount).toLocaleString('en-US');
        const decimalPart = (nexaAmount % 1).toFixed(2).substring(2);
        
        // Retornar con HTML para hacer los decimales más pequeños
        return `${integerPart}<span class="decimal-part">.${decimalPart}</span>`;
    }
    return balance;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

// Ajustar tamaño de fuente dinámicamente para que siempre quepa
function adjustBalanceFontSize(element) {
    // Resetear cualquier ajuste previo
    element.style.fontSize = '';
    
    // Esperar un frame para que el navegador calcule el tamaño
    requestAnimationFrame(() => {
        const container = element.parentElement;
        const containerWidth = container.offsetWidth - 40; // padding
        const contentWidth = element.scrollWidth;
        
        if (contentWidth > containerWidth) {
            // Calcular el factor de escala necesario
            const scale = containerWidth / contentWidth;
            const currentSize = parseFloat(window.getComputedStyle(element).fontSize);
            const newSize = currentSize * scale * 0.95; // 0.95 para dar un poco de margen
            
            element.style.fontSize = `${newSize}px`;
        }
    });
}

// ===== SAVED WALLETS =====
function loadSavedWallets() {
    try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        state.savedWallets = stored ? JSON.parse(stored) : [];
        renderSavedWallets();
    } catch (error) {
        console.error('Error loading saved wallets:', error);
        state.savedWallets = [];
    }
}

function saveWallet(address, balance) {
    // Check if already exists
    const existingIndex = state.savedWallets.findIndex(w => w.address === address);
    
    if (existingIndex !== -1) {
        // Update existing
        state.savedWallets[existingIndex] = {
            address,
            balance,
            timestamp: Date.now()
        };
    } else {
        // Add new
        state.savedWallets.unshift({
            address,
            balance,
            timestamp: Date.now()
        });
    }
    
    // Save to localStorage
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    
    // Hide balance section after saving
    elements.balanceSection.classList.add('hidden');
    
    // Update UI
    renderSavedWallets();
    
    updateStatus('Wallet saved', 'ready');
}

function deleteWallet(address) {
    state.savedWallets = state.savedWallets.filter(w => w.address !== address);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    renderSavedWallets();
    
    if (state.currentAddress === address) {
        elements.saveBtn.classList.remove('saved');
        elements.saveBtn.title = 'Save to list';
    }
}

async function refreshAllWallets() {
    updateStatus('Refreshing all...', 'loading');
    
    for (let wallet of state.savedWallets) {
        const balance = await fetchBalance(wallet.address, true);
        if (balance !== null) {
            wallet.balance = balance;
            wallet.timestamp = Date.now();
        }
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
    renderSavedWallets();
    updateStatus('All wallets updated', 'ready');
}

function renderSavedWallets() {
    if (state.savedWallets.length === 0) {
        elements.savedWalletsSection.classList.add('hidden');
        return;
    }
    
    elements.savedWalletsSection.classList.remove('hidden');
    elements.savedWalletsList.innerHTML = '';
    
    state.savedWallets.forEach(wallet => {
        const walletItem = document.createElement('div');
        walletItem.className = 'wallet-item';
        if (wallet.address === state.currentAddress) {
            walletItem.classList.add('active');
        }
        
        walletItem.innerHTML = `
            <div class="wallet-header">
                <div>
                    <span class="wallet-balance">${formatBalance(wallet.balance)}</span>
                    <span class="wallet-currency">NEXA</span>
                </div>
                <div class="wallet-actions">
                    <button class="wallet-btn refresh-wallet" title="Refresh balance">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                    </button>
                    <button class="wallet-btn delete-wallet" title="Delete wallet">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="wallet-address">${wallet.address}</div>
            <div class="wallet-updated">Updated: ${formatTime(wallet.timestamp)}</div>
        `;
        
        // Click on wallet to view
        walletItem.addEventListener('click', (e) => {
            if (!e.target.closest('.wallet-btn')) {
                displayBalance(wallet.balance, wallet.address);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        
        // Refresh button
        const refreshBtn = walletItem.querySelector('.refresh-wallet');
        refreshBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            refreshBtn.style.opacity = '0.5';
            const balance = await fetchBalance(wallet.address, true);
            if (balance !== null) {
                wallet.balance = balance;
                wallet.timestamp = Date.now();
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.savedWallets));
                renderSavedWallets();
            }
            refreshBtn.style.opacity = '1';
        });
        
        // Delete button
        const deleteBtn = walletItem.querySelector('.delete-wallet');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this wallet from the list?')) {
                deleteWallet(wallet.address);
            }
        });
        
        elements.savedWalletsList.appendChild(walletItem);
        
        // Ajustar tamaño de fuente del balance en la lista
        const balanceElement = walletItem.querySelector('.wallet-balance');
        if (balanceElement) {
            adjustBalanceFontSize(balanceElement);
        }
    });
}

// ===== UI HELPERS =====
function setLoadingState(loading) {
    elements.checkBalanceBtn.disabled = loading;
    
    if (loading) {
        elements.loadingOverlay.classList.remove('hidden');
    } else {
        elements.loadingOverlay.classList.add('hidden');
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}

function updateStatus(text, type = 'ready') {
    elements.statusText.textContent = text;
    elements.statusIndicator.className = 'status-indicator';
    
    if (type === 'error') {
        elements.statusIndicator.classList.add('error');
    } else if (type === 'loading') {
        elements.statusIndicator.classList.add('loading');
    }
}

// ===== CONNECTION DETECTION =====
window.addEventListener('online', () => {
    updateStatus('Connection restored', 'ready');
});

window.addEventListener('offline', () => {
    updateStatus('Offline', 'error');
    showError('No internet connection');
});
