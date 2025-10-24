// js/receive-screen.js
import { truncateWalletAddress, setupWalletAddressToggle } from './ui.js'; 
import { CONFIG, state } from './config.js'; // ⬅️ ASUMIMOS ESTA IMPORTACIÓN NECESARIA
let currentWallet = null;
let receiveContainer = null;
let celebrationTimeout = null;
let qrUpdateTimeout = null;

/**
 * Opens the receive screen for a specific wallet
 * @param {Object} wallet - The wallet object containing address and balance
 */
export function openReceiveScreen(wallet) {
    currentWallet = wallet;
    
    if (!receiveContainer) {
        createReceiveScreen();
        attachReceiveListeners();
    }
    
    updateReceiveScreen(wallet);
    
    // Remover hidden si existía (para que sea visible en el DOM)
    receiveContainer.classList.remove('hidden');
    
    // Ocultar main y FAB
    const main = document.querySelector('main');
    const fab = document.getElementById('addWalletBtn');
    if (main) main.style.display = 'none';
    if (fab) fab.style.display = 'none';
    
    // Forzar reflow para que el navegador aplique el estado inicial (translateY(100%))
    receiveContainer.offsetHeight;
    
    // Animar la entrada desde abajo
    requestAnimationFrame(() => {
        receiveContainer.classList.add('visible');
    });
    
    generateQR(wallet.address);
    
    // ✅ Setup WebSocket callback usando window global
    window.receiveScreenCallback = (address, balance) => {
        if (!currentWallet) return;
        if (address === currentWallet.address) {
            const previousBalance = currentWallet.balance || 0;
            const receivedAmount = balance - previousBalance;
            
            if (receivedAmount > 0) {
                currentWallet.balance = balance;
                showPaymentReceived(receivedAmount);
                
                // Haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
            } else {
                currentWallet.balance = balance;
            }
        }
    };
    
    // Solo suscribirse si es la wallet de donación Y NO está en la lista guardada.
    const isDonationWallet = wallet.address === CONFIG.DONATION_WALLET_ADDRESS;
    const isWalletTracked = state.savedWallets.some(w => w.address === wallet.address);
    if (isDonationWallet && !isWalletTracked) {
        import('./realtime.js').then(module => {
            module.subscribe(wallet.address);
        });
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
    
    // Remover la clase visible para animar la salida
    receiveContainer.classList.remove('visible');
    
    // Esperar a que termine la animación antes de destruir (400ms)
    setTimeout(() => {
        // Ocultar completamente
        receiveContainer.classList.add('hidden');
        
        // Restaurar la vista principal
        const main = document.querySelector('main');
        const fab = document.getElementById('addWalletBtn');
        if (main) main.style.display = 'block';
        if (fab) fab.style.display = 'flex';

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
                });
            }
        }
        
        // Limpieza final de referencias globales/de módulo
        currentWallet = null;
        receiveContainer = null;
        
        if (celebrationTimeout) {
            clearTimeout(celebrationTimeout);
            celebrationTimeout = null;
        }
        if (qrUpdateTimeout) {
            clearTimeout(qrUpdateTimeout);
            qrUpdateTimeout = null;
        }
    }, 400); // Duración de la transición CSS (0.4s)
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

    // Update wallet name
    if (nameEl) {
        nameEl.textContent = walletName;
    }

    // Update address
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

    // Reset input and states
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

    // Amount input with debounced QR update
    if (amountInput) {
        amountInput.addEventListener('input', debounce(() => {
            if (!currentWallet) return;
            updateQRWithAmount();
        }, 500));

        // Clear on Escape
        amountInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                amountInput.value = '';
                amountInput.blur();
                if (currentWallet) generateQR(currentWallet.address);
            }
        });
    }

    // Address click to expand/copy
    if (addressEl) {
        addressEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                addressEl.click();
            }
        });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(e) {
    if (!receiveContainer || receiveContainer.classList.contains('hidden')) return;

    // Escape to close
    if (e.key === 'Escape') {
        const amountInput = document.getElementById('amountInput');
        if (document.activeElement === amountInput) {
            amountInput.blur();
        } else {
            closeReceiveScreen();
        }
    }

    // Ctrl/Cmd + C to copy address
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

    // Limpieza del valor ingresado
    let rawValue = amountInput.value.trim().replace(',', '.');

    // Si el campo está vacío, solo mostramos el QR de la dirección
    if (rawValue === '') {
        generateQR(currentWallet.address);
        return;
    }

    // Intentamos convertirlo a número
    let amount = parseFloat(rawValue);

    // Si es inválido o negativo, restauramos QR sin cantidad
    if (isNaN(amount) || amount <= 0) {
        generateQR(currentWallet.address);
        return;
    }

    // Aseguramos formato correcto (sin notación científica)
    const formattedAmount = (Math.floor(amount * 100) / 100).toFixed(2);

    // Construimos URI de forma limpia
    const uri = `${currentWallet.address}?amount=${formattedAmount}`;

    // Refrescamos el QR con animación suave
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
        
        // Success feedback
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`;
        copyBtn.classList.add('copied');
        
        if (addressEl) {
            addressEl.classList.add('copied');
        }

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Reset after delay
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
        // Genera el QR
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
            // Fallback: usa API externa
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(data)}&ecc=L`;
            const img = document.createElement('img');
            img.src = qrApiUrl;
            img.alt = 'QR Code';
            img.className = 'qr-image';
            img.loading = 'eager';
            qrWrapper.appendChild(img);
        }

        // 🔹 SOLUCIÓN: Hacer clic o touch en el QR copia la URI
        qrWrapper.style.cursor = 'pointer';
        qrWrapper.style.touchAction = 'manipulation'; // Prevenir zoom
        qrWrapper.style.userSelect = 'none'; // Prevenir selección de texto
        qrWrapper.style.webkitUserSelect = 'none';
        qrWrapper.style.position = 'relative'; // Para el feedback
        qrWrapper.style.webkitTapHighlightColor = 'transparent'; // Sin highlight en móvil
        qrWrapper.title = 'Click to copy payment link';

        // Función para copiar
        const copyQRData = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                await navigator.clipboard.writeText(data);
                showCopyFeedback(qrWrapper);
                
                // Haptic feedback en móvil
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } catch (err) {
                console.error('Clipboard copy failed:', err);
                // Fallback para navegadores sin clipboard API
                fallbackCopyText(data);
            }
        };

        // Event listeners para escritorio y móvil
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

// Función de feedback mejorada
function showCopyFeedback(wrapper) {
    // Remover feedback anterior si existe
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

// Fallback para copiar en navegadores antiguos
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
 * Show payment received with premium celebration animation
 * Differentiates between exact, less, and more payment scenarios
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

    // Calculate amounts
    const nexaAmount = amount / 100;
    const formattedAmount = nexaAmount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    if (receivedAmountEl) {
        receivedAmountEl.textContent = `+${formattedAmount} NEXA`;
    }

    // Validate requested amount
    const requestedAmount = parseFloat(amountInput?.value || 0);
    
    // Reset all payment state classes
    statusReceived.classList.remove('payment-exact', 'payment-less', 'payment-more');
    
    // Hide all notifications first
    if (notificationLess) notificationLess.classList.add('hidden');
    if (notificationMore) notificationMore.classList.add('hidden');

    // Determine payment status and configure UI
    if (requestedAmount === 0) {
        // No amount requested - treat as exact/success
        statusReceived.classList.add('payment-exact');
    } else if (nexaAmount < requestedAmount) {
        // Payment is less than requested
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
        // Payment is more than requested
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
        // Payment matches exactly
        statusReceived.classList.add('payment-exact');
    }
// Ocultar la dirección
    if (addressCompact) {
        // 🔥 NUEVA LÍNEA: Ocultar o aplicar clase de oscurecimiento
        addressCompact.classList.add('hide-or-dim'); // Usaremos 'hide-or-dim'
    }
    // Hide waiting state with fade
    if (statusWaiting) {
        statusWaiting.classList.add('hidden');
    }

    // Add dark overlay to QR
    qrWrapper.classList.add('celebrating');

    // Position statusReceived over QR and show
    statusReceived.classList.add('celebrating');
    qrWrapper.appendChild(statusReceived);
    statusReceived.classList.remove('hidden');

    // Trigger success particles animation
    createSuccessParticles(qrWrapper, statusReceived);

    // Auto-restore after 5 seconds
    if (celebrationTimeout) {
        clearTimeout(celebrationTimeout);
    }

    celebrationTimeout = setTimeout(() => {
        restoreNormalState(statusReceived, statusWaiting, qrWrapper);
    }, 5000);
}

/**
 * Create success particles animation with colors based on payment status
 */
function createSuccessParticles(container, statusReceived) {
    // Determine particle colors based on payment status
    let colors;
    if (statusReceived.classList.contains('payment-exact')) {
        colors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];
    } else if (statusReceived.classList.contains('payment-less')) {
        colors = ['#fbbf24', '#fcd34d', '#fde68a', '#fef3c7', '#f59e0b'];
    } else if (statusReceived.classList.contains('payment-more')) {
        colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb'];
    } else {
        colors = ['#10b981', '#fbbf24', '#60a5fa', '#f59e0b', '#34d399'];
    }
    
    const particleCount = 24;
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'success-particle';
        
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = 80 + Math.random() * 40;
        const size = 4 + Math.random() * 6;
        
        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: ${colors[i % colors.length]};
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY}px;
            pointer-events: none;
            z-index: 12;
            box-shadow: 0 0 10px ${colors[i % colors.length]};
        `;
        
        container.appendChild(particle);
        
        const deltaX = Math.cos(angle) * velocity;
        const deltaY = Math.sin(angle) * velocity;
        
        particle.animate([
            { 
                transform: 'translate(0, 0) scale(1)',
                opacity: 1
            },
            { 
                transform: `translate(${deltaX}px, ${deltaY}px) scale(0)`,
                opacity: 0
            }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
        }).onfinish = () => particle.remove();
    }
}

/**
 * Restore normal state after celebration
 */
function restoreNormalState(statusReceived, statusWaiting, qrWrapper) {
    const addressCompact = document.querySelector('.address-compact');
    // 🔥 NUEVA LÍNEA: Restaurar la visibilidad de la dirección
    if (addressCompact) {
        addressCompact.classList.remove('hide-or-dim');
    }
    // Remove dark overlay
    qrWrapper.classList.remove('celebrating');
    // Remove celebrating class
    statusReceived.classList.remove('celebrating');
    statusReceived.classList.add('hidden');

    // Move back to original position
    const paymentStatus = document.getElementById('paymentStatus');
    if (paymentStatus) {
        paymentStatus.appendChild(statusReceived);
    }

    // Reset payment state classes
    statusReceived.classList.remove('payment-exact', 'payment-less', 'payment-more');

    // Show waiting state
    if (statusWaiting) {
        statusWaiting.classList.remove('hidden');
    }

    // Hide notifications
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (celebrationTimeout) clearTimeout(celebrationTimeout);
    if (qrUpdateTimeout) clearTimeout(qrUpdateTimeout);
    document.removeEventListener('keydown', handleKeyboardShortcuts);
});