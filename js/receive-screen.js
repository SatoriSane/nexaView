// js/receive-screen.js
import { truncateWalletAddress, setupWalletAddressToggle } from './ui.js'; 
import { CONFIG, state } from './config.js';
import { fetchBalance } from './balanceClient.js';

let currentWallet = null;
let receiveContainer = null;
let celebrationTimeout = null;
let qrUpdateTimeout = null;
let initialBalance = null;

/**
 * Opens the receive screen for a specific wallet
 * @param {Object} wallet - The wallet object containing address and balance
 */
export async function openReceiveScreen(wallet) {
    currentWallet = wallet;
    
    if (!receiveContainer) {
        createReceiveScreen();
        attachReceiveListeners();
    }
    
    updateReceiveScreen(wallet);
    
    // Remover hidden si existía (para que sea visible en el DOM)
    receiveContainer.classList.remove('hidden');
    
    // Forzar reflow para que el navegador aplique el estado inicial (translateY(100%))
    receiveContainer.offsetHeight;
    
    // Animar la entrada desde abajo
    requestAnimationFrame(() => {
        receiveContainer.classList.add('visible');
    });
    
    // Ocultar main y FAB DESPUÉS de que la animación haya terminado
    setTimeout(() => {
        const main = document.querySelector('main');
        const fab = document.getElementById('addWalletBtn');
        if (main) main.style.display = 'none';
        if (fab) fab.style.display = 'none';
    }, 200);
    
    generateQR(wallet.address);
    
    // ✅ CRÍTICO: Obtener balance inicial ANTES de configurar el callback
    try {
        initialBalance = await fetchBalance(wallet.address);
        console.log(`📊 Initial balance for ${wallet.address}: ${initialBalance}`);
        
        // Actualizar el balance en el wallet actual
        if (initialBalance !== null) {
            currentWallet.balance = initialBalance;
        }
    } catch (err) {
        console.warn('⚠️ Could not fetch initial balance:', err);
        initialBalance = wallet.balance || 0;
    }
    
    // ✅ Setup WebSocket callback DESPUÉS de tener el balance inicial
    window.receiveScreenCallback = (address, balance) => {
        if (!currentWallet) return;
        if (address !== currentWallet.address) return;
        
        console.log(`💰 Balance update: ${address} -> ${balance} (previous: ${initialBalance})`);
        
        // Comparar con el balance inicial capturado
        const referenceBalance = initialBalance ?? currentWallet.balance ?? 0;
        const receivedAmount = balance - referenceBalance;
        
        if (receivedAmount > 0) {
            console.log(`✅ Payment detected: +${receivedAmount}`);
            currentWallet.balance = balance;
            initialBalance = balance; // ← Actualizar referencia
            showPaymentReceived(receivedAmount);
            
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        } else if (balance !== referenceBalance) {
            // Balance cambió pero no es positivo (posible gasto, o ajuste)
            console.log(`ℹ️ Balance changed but not positive: ${receivedAmount}`);
            currentWallet.balance = balance;
            initialBalance = balance;
        }
    };
    
    // ✅ Determinar si necesitamos suscribir
    const isDonationWallet = wallet.address === CONFIG.DONATION_WALLET_ADDRESS;
    const isWalletTracked = state.savedWallets.some(w => w.address === wallet.address);
    
    // ✅ Suscribir INMEDIATAMENTE (no en then asíncrono)
    if (isDonationWallet && !isWalletTracked) {
        try {
            const realtimeModule = await import('./realtime.js');
            realtimeModule.subscribe(wallet.address);
            console.log(`📡 Subscribed to donation wallet: ${wallet.address}`);
        } catch (err) {
            console.error('❌ Failed to subscribe:', err);
        }
    }
}

/**
 * Closes the receive screen and returns to main view
 */
export function closeReceiveScreen() {
    if (!receiveContainer) return;
    
    // Capturamos el estado localmente para la promesa asíncrona.
    const walletToClose = currentWallet; 
    
    // Limpiar callback global
    window.receiveScreenCallback = null;
    
    // ✅ Restaurar la vista principal INMEDIATAMENTE
    const main = document.querySelector('main');
    const fab = document.getElementById('addWalletBtn');
    if (main) main.style.display = 'block';
    if (fab) fab.style.display = 'flex';
    
    // Remover la clase visible para animar la salida
    receiveContainer.classList.remove('visible');
    
    // Esperar a que termine la animación antes de destruir (400ms)
    setTimeout(() => {
        // Ocultar completamente
        receiveContainer.classList.add('hidden');

        // Destruir el DOM
        if (receiveContainer.parentNode) {
            receiveContainer.parentNode.removeChild(receiveContainer);
        }
        
        // Desuscribir solo si no está rastreada
        if (walletToClose) {
            const isWalletTracked = state.savedWallets.some(w => w.address === walletToClose.address);
            
            if (!isWalletTracked) {
                import('./realtime.js').then(realtimeModule => {
                    realtimeModule.unsubscribe(walletToClose.address);
                    console.log(`📴 Unsubscribed from: ${walletToClose.address}`);
                });
            }
        }
        
        // Limpieza final de referencias globales/de módulo
        currentWallet = null;
        receiveContainer = null;
        initialBalance = null; // ← NUEVO: limpiar balance inicial
        
        if (celebrationTimeout) {
            clearTimeout(celebrationTimeout);
            celebrationTimeout = null;
        }
        if (qrUpdateTimeout) {
            clearTimeout(qrUpdateTimeout);
            qrUpdateTimeout = null;
        }
    }, 400);
}

/**
 * Creates the receive screen DOM
 */
function createReceiveScreen() {
    receiveContainer = document.createElement('div');
    receiveContainer.id = 'receiveScreen';
    receiveContainer.className = 'receive-screen hidden';

    receiveContainer.innerHTML = `
        <div class="receive-header">
            <button class="receive-close-btn" id="closeReceiveBtn" title="Close" aria-label="Close receive screen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="receive-wallet-name" id="receiveWalletName"></div>
        </div>
        <div class="receive-body">
            <div class="payment-status" id="paymentStatus">
                <div class="status-waiting" id="statusWaiting">
                    <span class="status-icon">
                        <span class="status-text">Waiting for transaction</span>
                        <span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>
                    </span>
                </div>
                <div class="status-received hidden" id="statusReceived">
                    <div class="success-checkmark" aria-hidden="true">
                        <svg viewBox="0 0 52 52">
                            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                    </div>
                    <span class="status-text" role="status" aria-live="polite">Nexa received!</span>
                    <span class="status-amount" id="receivedAmount"></span>
                    <div class="status-notification notification-warning hidden" id="notificationLess" role="alert">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span class="status-notification-text">
                            Amount is less than requested
                            <span class="status-notification-amount" id="lessAmount"></span>
                        </span>
                    </div>
                    <div class="status-notification notification-info hidden" id="notificationMore" role="alert">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4"></path>
                            <path d="M12 8h.01"></path>
                        </svg>
                        <span class="status-notification-text">
                            Received more than requested
                            <span class="status-notification-amount" id="moreAmount"></span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="qr-main-section">
                <div class="qr-wrapper" id="qrWrapper"></div>
                <div class="address-compact">
                    <div class="qr-wallet-text" id="receiveAddress" role="button" tabindex="0" aria-label="Wallet address"></div>
                    <button class="btn-copy-compact" id="copyAddressBtn" title="Copy address" aria-label="Copy address to clipboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="amount-section">
                <div class="amount-input-wrapper">
                    <input 
                        type="number" 
                        id="amountInput" 
                        class="amount-input" 
                        placeholder="Enter amount"
                        aria-label="Enter amount in NEXA (optional)"
                        min="0"
                        step="0.01"
                        inputmode="decimal"
                        pattern="[0-9]*\\.?[0-9]*"
                    >
                    <span class="amount-currency">NEXA</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(receiveContainer);
}

/**
 * Updates receive screen UI with smooth transitions
 */
function updateReceiveScreen(wallet) {
    const walletName = wallet.customName || `Nexa ${wallet.address.slice(-4)}`;
    const nameEl = document.getElementById('receiveWalletName');
    const addressEl = document.getElementById('receiveAddress');
    const amountInput = document.getElementById('amountInput');

    if (nameEl) {
        nameEl.textContent = walletName;
    }

    if (addressEl) {
        const fullAddress = wallet.address;
        addressEl.classList.remove('expanded', 'copied');
        delete addressEl.dataset.toggleInit;

        const clone = addressEl.cloneNode(true);
        addressEl.parentNode.replaceChild(clone, addressEl);

        const newAddressEl = document.getElementById('receiveAddress');
        newAddressEl.dataset.fullAddress = fullAddress;
        newAddressEl.textContent = fullAddress;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                truncateWalletAddress(newAddressEl, fullAddress);
                setupWalletAddressToggle([newAddressEl]);
            });
        });
    }

    if (amountInput) amountInput.value = '';
    resetReceiveStates();
}

/**
 * Reset all receive states
 */
function resetReceiveStates() {
    const statusWaiting = document.getElementById('statusWaiting');
    const statusReceived = document.getElementById('statusReceived');
    const qrWrapper = document.getElementById('qrWrapper');
    const notificationLess = document.getElementById('notificationLess');
    const notificationMore = document.getElementById('notificationMore');
    
    if (statusWaiting) statusWaiting.classList.remove('hidden');
    if (statusReceived) {
        statusReceived.classList.add('hidden');
        statusReceived.classList.remove('payment-exact', 'payment-less', 'payment-more', 'celebrating');
    }
    if (qrWrapper) {
        qrWrapper.classList.remove('celebrating');
    }
    if (notificationLess) notificationLess.classList.add('hidden');
    if (notificationMore) notificationMore.classList.add('hidden');
}

/**
 * Attach listeners to buttons and inputs
 */
function attachReceiveListeners() {
    const closeBtn = document.getElementById('closeReceiveBtn');
    const copyBtn = document.getElementById('copyAddressBtn');
    const amountInput = document.getElementById('amountInput');
    const addressEl = document.getElementById('receiveAddress');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeReceiveScreen);
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', copyAddressToClipboard);
    }

    if (amountInput) {
        amountInput.addEventListener('input', debounce(() => {
            if (!currentWallet) return;
            updateQRWithAmount();
        }, 500));

        amountInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                amountInput.value = '';
                amountInput.blur();
                if (currentWallet) generateQR(currentWallet.address);
            }
        });
    }

    if (addressEl) {
        addressEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                addressEl.click();
            }
        });
    }

    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(e) {
    if (!receiveContainer || receiveContainer.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
        const amountInput = document.getElementById('amountInput');
        if (document.activeElement === amountInput) {
            amountInput.blur();
        } else {
            closeReceiveScreen();
        }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selection = window.getSelection().toString();
        if (!selection && currentWallet) {
            e.preventDefault();
            copyAddressToClipboard();
        }
    }
}

/**
 * Update QR with amount
 */
function updateQRWithAmount() {
    if (qrUpdateTimeout) {
        clearTimeout(qrUpdateTimeout);
    }

    const amountInput = document.getElementById('amountInput');
    if (!amountInput || !currentWallet) return;

    let rawValue = amountInput.value.trim().replace(',', '.');

    if (rawValue === '') {
        generateQR(currentWallet.address);
        return;
    }

    let amount = parseFloat(rawValue);

    if (isNaN(amount) || amount <= 0) {
        generateQR(currentWallet.address);
        return;
    }

    const formattedAmount = (Math.floor(amount * 100) / 100).toFixed(2);
    const uri = `${currentWallet.address}?amount=${formattedAmount}`;

    const qrWrapper = document.getElementById('qrWrapper');
    if (qrWrapper) {
        const qrContent = qrWrapper.querySelector('img, canvas');
        if (qrContent) qrContent.style.opacity = '0.6';

        qrUpdateTimeout = setTimeout(() => {
            generateQR(uri);
            if (qrContent) qrContent.style.opacity = '1';
        }, 100);
    } else {
        generateQR(uri);
    }
}

/**
 * Copies address to clipboard with enhanced feedback
 */
async function copyAddressToClipboard() {
    if (!currentWallet) return;
    
    const copyBtn = document.getElementById('copyAddressBtn');
    const addressEl = document.getElementById('receiveAddress');
    const originalHTML = copyBtn.innerHTML;
    
    try {
        await navigator.clipboard.writeText(currentWallet.address);
        
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`;
        copyBtn.classList.add('copied');
        
        if (addressEl) {
            addressEl.classList.add('copied');
        }

        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.classList.remove('copied');
            if (addressEl) {
                addressEl.classList.remove('copied');
            }
        }, 2000);
    } catch (err) {
        console.error('Failed to copy address:', err);
    }
}

/**
 * Generates QR code with error handling
 */
function generateQR(data) {
    const qrWrapper = document.getElementById('qrWrapper');
    if (!qrWrapper) return;

    qrWrapper.innerHTML = '';

    try {
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrWrapper, {
                text: data,
                width: 256,
                height: 256,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.L
            });
        } else {
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(data)}&ecc=L`;
            const img = document.createElement('img');
            img.src = qrApiUrl;
            img.alt = 'QR Code';
            img.className = 'qr-image';
            img.loading = 'eager';
            qrWrapper.appendChild(img);
        }

        qrWrapper.style.cursor = 'pointer';
        qrWrapper.style.touchAction = 'manipulation';
        qrWrapper.style.userSelect = 'none';
        qrWrapper.style.webkitUserSelect = 'none';
        qrWrapper.style.position = 'relative';
        qrWrapper.style.webkitTapHighlightColor = 'transparent';
        qrWrapper.title = 'Click to copy payment link';

        const copyQRData = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                await navigator.clipboard.writeText(data);
                showCopyFeedback(qrWrapper);
                
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } catch (err) {
                console.error('Clipboard copy failed:', err);
                fallbackCopyText(data);
            }
        };

        qrWrapper.addEventListener('click', copyQRData);
        qrWrapper.addEventListener('touchend', copyQRData);

    } catch (err) {
        console.error('Failed to generate QR code:', err);
        qrWrapper.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--error); font-size: 0.875rem; text-align: center; padding: 1rem;">
                Failed to generate QR code
            </div>`;
    }
}

function showCopyFeedback(wrapper) {
    const existingFeedback = wrapper.querySelector('.copy-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }

    const message = document.createElement('div');
    message.className = 'copy-feedback';
    message.textContent = 'Copied!';
    message.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.85);
        color: #10b981;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        pointer-events: none;
        z-index: 100;
        transition: opacity 0.3s ease;
        opacity: 1;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    wrapper.appendChild(message);

    setTimeout(() => {
        message.style.opacity = '0';
    }, 1200);
    
    setTimeout(() => {
        message.remove();
    }, 1500);
}

function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        opacity: 0;
    `;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        const qrWrapper = document.getElementById('qrWrapper');
        if (qrWrapper) {
            showCopyFeedback(qrWrapper);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
}

/**
 * 🎊 Crea una celebración épica de corazones desde abajo
 */
function createDonationCelebration() {
    const heartCount = 30; // Cantidad de corazones
    const sizes = ['small', 'small', 'medium', 'medium', 'large', 'xlarge'];
    const speeds = ['slow', 'normal', 'fast', 'veryfast'];
    const drifts = ['', 'drift-left', 'drift-right'];
    
    // 🎨 Decidir el esquema de colores para TODA la celebración
    const random = Math.random();
    let colorScheme;
    
    if (random < 0.30) {
        // 30% - Solo dorados
        colorScheme = 'gold-only';
    } else if (random < 0.60) {
        // 30% - Solo rojos
        colorScheme = 'red-only';
    } else if (random < 0.80) {
        // 20% - Mix dorado y rojo
        colorScheme = 'gold-red-mix';
    } else {
        // 20% - Todos los colores (arcoíris)
        colorScheme = 'rainbow';
    }
    
    console.log(`🎨 Color scheme: ${colorScheme}`);
    
    for (let i = 0; i < heartCount; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'donation-heart';
            
            // 🎨 Aplicar color según el esquema decidido
            switch (colorScheme) {
                case 'gold-only':
                    // Sin clase adicional = dorado por defecto
                    break;
                    
                case 'red-only':
                    heart.classList.add('red');
                    break;
                    
                case 'gold-red-mix':
                    // 50/50 entre dorado y rojo
                    if (Math.random() > 0.5) {
                        heart.classList.add('red');
                    }
                    break;
                    
                case 'rainbow':
                    // Todos los colores aleatoriamente
                    const colors = ['red', 'purple', 'blue', 'green', 'pink', 'orange'];
                    // 70% probabilidad de color, 30% de dorado
                    if (Math.random() > 0.3) {
                        const randomColor = colors[Math.floor(Math.random() * colors.length)];
                        heart.classList.add(randomColor);
                    }
                    break;
            }
            
            // Tamaño aleatorio
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            heart.classList.add(`size-${size}`);
            
            // Velocidad aleatoria
            const speed = speeds[Math.floor(Math.random() * speeds.length)];
            heart.classList.add(`speed-${speed}`);
            
            // Dirección aleatoria
            const drift = drifts[Math.floor(Math.random() * drifts.length)];
            if (drift) heart.classList.add(drift);
            
            // Algunos con pulso
            if (Math.random() > 0.7) {
                heart.classList.add('pulse');
            }
            
            // SVG del corazón
            heart.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            `;
            
            // Posición horizontal aleatoria
            const leftPosition = Math.random() * 100;
            heart.style.left = `${leftPosition}%`;
            
            // Rotación aleatoria
            const rotation = (Math.random() * 720) - 360; // -360 a 360 grados
            heart.style.setProperty('--rotation', `${rotation}deg`);
            
            // Agregar al body
            document.body.appendChild(heart);
            
            // Remover después de la animación
            setTimeout(() => {
                heart.remove();
            }, 5000);
        }, i * 100); // Escalonar aparición cada 100ms
    }
    
    // Haptic feedback épico
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100, 50, 200]);
    }
}

/**
 * Show payment received with premium celebration animation
 */
export function showPaymentReceived(amount) {
    const statusWaiting = document.getElementById('statusWaiting');
    const statusReceived = document.getElementById('statusReceived');
    const receivedAmountEl = document.getElementById('receivedAmount');
    const notificationLess = document.getElementById('notificationLess');
    const notificationMore = document.getElementById('notificationMore');
    const lessAmountEl = document.getElementById('lessAmount');
    const moreAmountEl = document.getElementById('moreAmount');
    const amountInput = document.getElementById('amountInput');
    const qrWrapper = document.getElementById('qrWrapper');
    const addressCompact = document.querySelector('.address-compact');
    
    if (!qrWrapper || !statusReceived) return;
    
    // 🎊 Detectar si es la wallet de donación
    const isDonationWallet = currentWallet?.address === CONFIG.DONATION_WALLET_ADDRESS;
    if (isDonationWallet) {
        console.log('🎉 DONATION RECEIVED! Triggering celebration...');
        createDonationCelebration();
    }

    const nexaAmount = amount / 100;
    const formattedAmount = nexaAmount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    if (receivedAmountEl) {
        receivedAmountEl.textContent = `+${formattedAmount} NEXA`;
    }

    const requestedAmount = parseFloat(amountInput?.value || 0);
    
    statusReceived.classList.remove('payment-exact', 'payment-less', 'payment-more');
    
    if (notificationLess) notificationLess.classList.add('hidden');
    if (notificationMore) notificationMore.classList.add('hidden');

    if (requestedAmount === 0) {
        statusReceived.classList.add('payment-exact');
    } else if (nexaAmount < requestedAmount) {
        const difference = requestedAmount - nexaAmount;
        const formattedDiff = difference.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        statusReceived.classList.add('payment-less');
        
        if (notificationLess && lessAmountEl) {
            lessAmountEl.textContent = `(-${formattedDiff} NEXA)`;
            notificationLess.classList.remove('hidden');
        }
    } else if (nexaAmount > requestedAmount) {
        const difference = nexaAmount - requestedAmount;
        const formattedDiff = difference.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        statusReceived.classList.add('payment-more');
        
        if (notificationMore && moreAmountEl) {
            moreAmountEl.textContent = `(+${formattedDiff} NEXA)`;
            notificationMore.classList.remove('hidden');
        }
    } else {
        statusReceived.classList.add('payment-exact');
    }

    if (addressCompact) {
        addressCompact.classList.add('hide-or-dim');
    }

    if (statusWaiting) {
        statusWaiting.classList.add('hidden');
    }

    qrWrapper.classList.add('celebrating');
    statusReceived.classList.add('celebrating');
    qrWrapper.appendChild(statusReceived);
    statusReceived.classList.remove('hidden');

    if (celebrationTimeout) {
        clearTimeout(celebrationTimeout);
    }

    celebrationTimeout = setTimeout(() => {
        restoreNormalState(statusReceived, statusWaiting, qrWrapper);
    }, 5000);
}

/**
 * Restore normal state after celebration
 */
function restoreNormalState(statusReceived, statusWaiting, qrWrapper) {
    const addressCompact = document.querySelector('.address-compact');
    
    if (addressCompact) {
        addressCompact.classList.remove('hide-or-dim');
    }

    qrWrapper.classList.remove('celebrating');
    statusReceived.classList.remove('celebrating');
    statusReceived.classList.add('hidden');

    const paymentStatus = document.getElementById('paymentStatus');
    if (paymentStatus) {
        paymentStatus.appendChild(statusReceived);
    }

    statusReceived.classList.remove('payment-exact', 'payment-less', 'payment-more');

    if (statusWaiting) {
        statusWaiting.classList.remove('hidden');
    }

    const notificationLess = document.getElementById('notificationLess');
    const notificationMore = document.getElementById('notificationMore');
    if (notificationLess) notificationLess.classList.add('hidden');
    if (notificationMore) notificationMore.classList.add('hidden');
}

/**
 * Debounce utility
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

window.addEventListener('beforeunload', () => {
    if (celebrationTimeout) clearTimeout(celebrationTimeout);
    if (qrUpdateTimeout) clearTimeout(qrUpdateTimeout);
    document.removeEventListener('keydown', handleKeyboardShortcuts);
});