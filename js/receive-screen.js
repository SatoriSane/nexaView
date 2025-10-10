// js/receive-screen.js
import { state } from './config.js';
import { formatBalance, formatTime } from './balanceClient.js';
import { BalanceMonitor } from './balance-monitor.js';

let currentWallet = null;
let receiveContainer = null;
let transactionsExpanded = false;
let balanceMonitor = null;

/**
 * Opens the receive screen for a specific wallet
 * @param {Object} wallet - The wallet object containing address and balance
 */
export function openReceiveScreen(wallet) {
    currentWallet = wallet;
    
    // Create receive screen if it doesn't exist
    if (!receiveContainer) {
        createReceiveScreen();
        attachReceiveListeners();
    }
    
    // Update content with wallet data
    updateReceiveScreen(wallet);
    
    // Show the receive screen
    receiveContainer.classList.remove('hidden');
    
    // Hide main content and FAB
    const main = document.querySelector('main');
    const fab = document.getElementById('addWalletBtn');
    
    if (main) main.style.display = 'none';
    if (fab) fab.style.display = 'none';
    
    // Generate default QR (address only)
    generateQR(wallet.address);
    
    // Start smart balance monitoring
    if (!balanceMonitor) {
        balanceMonitor = new BalanceMonitor();
    }
    
    balanceMonitor.start(wallet, (receivedAmount) => {
        // Payment received callback
        showPaymentReceived(receivedAmount);
        
        // Reload transactions if visible
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList && transactionsList.dataset.loaded && transactionsExpanded) {
            transactionsList.dataset.loaded = '';
            loadTransactions();
        }
    });
}

/**
 * Closes the receive screen and restores normal view
 */
export function closeReceiveScreen() {
    if (receiveContainer) {
        receiveContainer.classList.add('hidden');
    }
    
    // Stop balance monitoring
    if (balanceMonitor) {
        balanceMonitor.stop();
    }
    
    // Restore main content and FAB
    const main = document.querySelector('main');
    const fab = document.getElementById('addWalletBtn');
    
    if (main) main.style.display = '';
    if (fab) fab.style.display = '';
    
    // Reset transaction list
    const transactionsList = document.getElementById('transactionsList');
    if (transactionsList) {
        transactionsList.classList.add('hidden');
        transactionsList.dataset.loaded = '';
    }
    transactionsExpanded = false;
    
    currentWallet = null;
    initialBalance = 0;
}

/**
 * Creates the receive screen DOM structure
 */
function createReceiveScreen() {
    receiveContainer = document.createElement('div');
    receiveContainer.id = 'receiveScreen';
    receiveContainer.className = 'receive-screen hidden';
    
    receiveContainer.innerHTML = `
        <div class="receive-header">
            <button class="receive-close-btn" id="closeReceiveBtn" title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="receive-wallet-name" id="receiveWalletName"></div>
        </div>
        
        <div class="receive-body">
            <!-- QR + Address Section -->
            <div class="qr-main-section">
                <div class="qr-wrapper" id="qrWrapper">
                    <!-- QR code will be generated here -->
                </div>
                <div class="address-compact">
                    <div class="address-text" id="receiveAddress"></div>
                    <button class="btn-copy-compact" id="copyAddressBtn" title="Copy address">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                        </svg>
                </div>
            </div>
            
            <!-- Amount Section -->
            <div class="amount-section">
                <div class="amount-input-wrapper">
                    <input 
                        type="number" 
                        id="amountInput" 
                        class="amount-input" 
                        placeholder="Amount to request"
                        min="0"
                        step="0.01"
                        inputmode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                    >
                    <span class="amount-currency">NEXA</span>
                </div>
            </div>
            
            <!-- Waiting for Payment Indicator -->
            <div class="payment-status" id="paymentStatus">
                <div class="status-waiting" id="statusWaiting">
                    <div class="pulse-ring"></div>
                    <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span class="status-text">Waiting for payment...</span>
                </div>
                <div class="status-received hidden" id="statusReceived">
                    <div class="success-checkmark">
                        <svg viewBox="0 0 52 52">
                            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                    </div>
                    <span class="status-text">Payment received!</span>
                    <span class="status-amount" id="receivedAmount"></span>
                    <span class="status-warning hidden" id="amountWarning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Amount doesn't match requested
                    </span>
                </div>
            </div>
            
            <!-- Transactions Section -->
            <div class="transactions-section">
                <button class="transactions-toggle" id="transactionsToggle">
                    <span>Recent Transactions</span>
                    <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="transactions-list hidden" id="transactionsList">
                    <div class="transactions-loading">
                        <div class="spinner"></div>
                        <span>Loading transactions...</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(receiveContainer);
}

/**
 * Updates the receive screen with wallet information
 */
function updateReceiveScreen(wallet) {
    const walletName = wallet.customName || `Nexa ${wallet.address.slice(-4)}`;
    
    const nameEl = document.getElementById('receiveWalletName');
    const addressEl = document.getElementById('receiveAddress');
    const amountInput = document.getElementById('amountInput');
    
    if (nameEl) nameEl.textContent = walletName;
    if (addressEl) addressEl.textContent = wallet.address;
    if (amountInput) amountInput.value = '';
}

/**
 * Attaches event listeners to receive screen elements
 */
function attachReceiveListeners() {
    const closeBtn = document.getElementById('closeReceiveBtn');
    const copyBtn = document.getElementById('copyAddressBtn');
    const amountInput = document.getElementById('amountInput');
    const transactionsToggle = document.getElementById('transactionsToggle');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeReceiveScreen);
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', copyAddressToClipboard);
    }
    
    if (amountInput) {
        // Regenerate QR when amount changes
        amountInput.addEventListener('input', debounce(() => {
            if (currentWallet) {
                const amount = parseFloat(amountInput.value);
                if (amount > 0 && !isNaN(amount)) {
                    // Nexa amount is already in NEXA units, no conversion needed
                    // Remove 'nexa:' prefix if present to avoid duplication
                    const addressWithoutPrefix = currentWallet.address.replace(/^nexa:/, '');
                    const uri = `nexa:${addressWithoutPrefix}?amount=${amount}`;
                    console.log('[Receive] Generated QR URI:', uri);
                    generateQR(uri);
                } else {
                    // Generate default QR (address only)
                    generateQR(currentWallet.address);
                }
            }
        }, 500));
    }
    
    if (transactionsToggle) {
        transactionsToggle.addEventListener('click', toggleTransactions);
    }
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && receiveContainer && !receiveContainer.classList.contains('hidden')) {
            closeReceiveScreen();
        }
    });
}

/**
 * Copies the wallet address to clipboard
 */
async function copyAddressToClipboard() {
    if (!currentWallet) return;
    
    const copyBtn = document.getElementById('copyAddressBtn');
    const originalHTML = copyBtn.innerHTML;
    
    try {
        await navigator.clipboard.writeText(currentWallet.address);
        
        // Show success feedback
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        copyBtn.classList.add('copied');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.classList.remove('copied');
        }, 1500);
    } catch (err) {
        console.error('Failed to copy address:', err);
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = currentWallet.address;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.classList.remove('copied');
            }, 1500);
        } catch (err2) {
            console.error('Fallback copy failed:', err2);
        }
        
        document.body.removeChild(textArea);
    }
}

/**
 * Generates a QR code for the given data
 * @param {string} data - The data to encode in the QR code
 */
function generateQR(data) {
    const qrWrapper = document.getElementById('qrWrapper');
    if (!qrWrapper) return;
    
    // Clear previous QR
    qrWrapper.innerHTML = '';
    
    // Create QR code using QRCode.js library
    // We'll use a CDN-based approach that works without npm
    try {
        // Check if QRCode library is available
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrWrapper, {
                text: data,
                width: 256,
                height: 256,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            // Fallback: use a QR code API service
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(data)}`;
            const img = document.createElement('img');
            img.src = qrApiUrl;
            img.alt = 'QR Code';
            img.className = 'qr-image';
            qrWrapper.appendChild(img);
        }
    } catch (err) {
        console.error('Failed to generate QR code:', err);
        qrWrapper.innerHTML = '<p class="qr-error">Failed to generate QR code</p>';
    }
}

/**
 * Toggles the transactions list visibility
 */
async function toggleTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (!transactionsList) return;
    
    transactionsExpanded = !transactionsExpanded;
    
    if (transactionsExpanded) {
        transactionsList.classList.remove('hidden');
        toggleIcon.style.transform = 'rotate(180deg)';
        
        // Load transactions if not already loaded
        if (!transactionsList.dataset.loaded) {
            await loadTransactions();
        }
    } else {
        transactionsList.classList.add('hidden');
        toggleIcon.style.transform = 'rotate(0deg)';
    }
}

/**
 * Loads transactions for the current wallet
 */
async function loadTransactions() {
    if (!currentWallet) return;
    
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    try {
        // Call API to get transactions
        const response = await fetch(`/api/transactions?address=${encodeURIComponent(currentWallet.address)}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch transactions');
        }
        
        const data = await response.json();
        console.log('[Receive] Transactions data:', data);
        const transactions = data.transactions || [];
        console.log('[Receive] Processed transactions:', transactions);
        
        transactionsList.dataset.loaded = 'true';
        
        if (transactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="transactions-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>No transactions found</p>
                </div>
            `;
            return;
        }
        
        // Show first 10 transactions
        const displayTransactions = transactions.slice(0, 10);
        const hasMore = transactions.length > 10;
        
        let html = '<div class="transactions-items">';
        
        displayTransactions.forEach(tx => {
            const isReceived = tx.type === 'received';
            const amount = tx.amount;
            const nexaAmount = amount / 100;
            const formattedAmount = nexaAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const date = new Date(tx.timestamp * 1000).toLocaleDateString();
            const time = new Date(tx.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            html += `
                <div class="transaction-item ${isReceived ? 'received' : 'sent'}">
                    <div class="tx-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${isReceived 
                                ? '<polyline points="12 5 12 19 5 12"></polyline>' 
                                : '<polyline points="12 19 12 5 19 12"></polyline>'}
                        </svg>
                    </div>
                    <div class="tx-details">
                        <div class="tx-amount">${isReceived ? '+' : '-'}${formattedAmount} NEXA</div>
                        <div class="tx-date">${date} ${time}</div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        if (hasMore) {
            const explorerUrl = `https://explorer.nexa.org/address/${currentWallet.address}`;
            html += `
                <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="view-more-link">
                    View all transactions in explorer
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            `;
        }
        
        transactionsList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        transactionsList.innerHTML = `
            <div class="transactions-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <p>Failed to load transactions</p>
            </div>
        `;
        transactionsList.dataset.loaded = 'true';
    }
}

// Balance monitoring is now handled by BalanceMonitor class (balance-monitor.js)

/**
 * Shows payment received notification
 */
function showPaymentReceived(amount) {
    const statusWaiting = document.getElementById('statusWaiting');
    const statusReceived = document.getElementById('statusReceived');
    const receivedAmountEl = document.getElementById('receivedAmount');
    const amountWarning = document.getElementById('amountWarning');
    const amountInput = document.getElementById('amountInput');
    
    console.log('[Receive] Payment received! Amount (satoshis):', amount);
    
    if (statusWaiting) statusWaiting.classList.add('hidden');
    if (statusReceived) {
        statusReceived.classList.remove('hidden');
        
        // Format amount - amount is already in satoshis (1 NEXA = 100 satoshis)
        const nexaAmount = amount / 100;
        const formattedAmount = nexaAmount.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
        
        console.log('[Receive] Formatted amount:', formattedAmount, 'NEXA');
        
        // Check if amount matches requested amount
        const requestedAmount = parseFloat(amountInput?.value || 0);
        const amountMatches = requestedAmount === 0 || Math.abs(nexaAmount - requestedAmount) < 0.01;
        
        if (receivedAmountEl) {
            receivedAmountEl.textContent = `+${formattedAmount} NEXA`;
        }
        
        // Show warning if amount doesn't match
        if (amountWarning) {
            if (!amountMatches && requestedAmount > 0) {
                amountWarning.classList.remove('hidden');
                statusReceived.classList.add('amount-mismatch');
                console.log('[Receive] Warning: Amount mismatch. Expected:', requestedAmount, 'Received:', nexaAmount);
            } else {
                amountWarning.classList.add('hidden');
                statusReceived.classList.remove('amount-mismatch');
            }
        }
        
        // Play success animation
        statusReceived.style.animation = 'successPulse 0.6s ease-out';
        
        // Reset after 10 seconds (increased from 5)
        setTimeout(() => {
            if (statusWaiting) statusWaiting.classList.remove('hidden');
            if (statusReceived) {
                statusReceived.classList.add('hidden');
                statusReceived.classList.remove('amount-mismatch');
            }
            if (amountWarning) amountWarning.classList.add('hidden');
        }, 10000);
    }
}

/**
 * Debounce utility function
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
