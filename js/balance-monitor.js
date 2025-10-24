// js/balance-monitor.js
// Smart balance monitoring with adaptive polling

import { fetchBalance } from './balanceClient.js';

/**
 * Adaptive balance monitor
 * Adjusts polling frequency based on:
 * - User activity (active/inactive)
 * - Amount requested (higher priority if specific amount)
 * - Time elapsed (exponential backoff)
 */
export class BalanceMonitor {
    constructor() {
        this.interval = null;
        this.activityCheckInterval = null;
        this.currentWallet = null;
        this.initialBalance = 0;
        this.onPaymentReceived = null;
        
        // State
        this.lastActivity = Date.now();
        this.isUserActive = true;
        this.hasRequestedAmount = false;
        this.startTime = Date.now();
        this.consecutiveChecks = 0;
        
        // Event listeners references for cleanup
        this.activityHandler = null;
        this.activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    }
    
    /**
     * Start monitoring a wallet
     */
    start(wallet, onPaymentCallback) {
        if (this.currentWallet && this.currentWallet.address === wallet.address) {
            console.log('[BalanceMonitor] Already monitoring this wallet, skipping start.');
            return;
        }
        this.stop(); // Clean up any existing monitoring
        
        this.currentWallet = wallet;
        this.initialBalance = wallet.balance || 0;
        this.onPaymentReceived = onPaymentCallback;
        this.startTime = Date.now();
        this.consecutiveChecks = 0;
        
        // Check if user requested specific amount
        const amountInput = document.getElementById('amountInput');
        this.hasRequestedAmount = amountInput && parseFloat(amountInput.value) > 0;
        
        console.log('[BalanceMonitor] Started monitoring:', {
            address: wallet.address.slice(0, 20) + '...',
            initialBalance: this.initialBalance,
            hasRequestedAmount: this.hasRequestedAmount
        });
        
        // Setup activity detection
        this.setupActivityDetection();
        
        // Start polling
        this.scheduleNextCheck();
    }
    
    /**
     * Stop monitoring
     */
    stop() {
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
        }
        
        if (this.activityCheckInterval) {
            clearInterval(this.activityCheckInterval);
            this.activityCheckInterval = null;
        }
        
        // Remove activity listeners
        if (this.activityHandler) {
            this.activityEvents.forEach(event => {
                window.removeEventListener(event, this.activityHandler);
            });
            this.activityHandler = null;
        }
        if (this.currentWallet) {
            this.currentWallet = null;
        }
        if (this.onPaymentReceived) {
            this.onPaymentReceived = null;
        }
        
        console.log('[BalanceMonitor] Stopped monitoring');
    }
    
    /**
     * Setup user activity detection
     */
    setupActivityDetection() {
        this.activityHandler = () => {
            this.lastActivity = Date.now();
            if (!this.isUserActive) {
                this.isUserActive = true;
                console.log('[BalanceMonitor] User active → faster polling');
            }
        };
        
        this.activityEvents.forEach(event => {
            window.addEventListener(event, this.activityHandler, { passive: true });
        });
        
        // Check for inactivity every 10 seconds
        this.activityCheckInterval = setInterval(() => {
            const inactiveTime = Date.now() - this.lastActivity;
            
            if (inactiveTime > 30000 && this.isUserActive) {
                // 30 seconds of inactivity
                this.isUserActive = false;
                console.log('[BalanceMonitor] User inactive → slower polling');
            }
        }, 10000);
    }
    
    /**
     * Calculate optimal polling interval based on context
     */
    getPollingInterval() {
        const elapsedMinutes = (Date.now() - this.startTime) / 60000;
        
        // Base intervals
        const VERY_FAST = 3000;   // 3 seconds
        const FAST = 4000;        // 4 seconds
        const NORMAL = 5000;      // 5 seconds
        const SLOW = 12000;       // 12 seconds
        const VERY_SLOW = 25000;  // 25 seconds
        
        // Priority 1: User just opened screen (first 2 minutes)
        if (elapsedMinutes < 2) {
            return this.isUserActive ? VERY_FAST : FAST;
        }
        
        // Priority 2: User requested specific amount (high intent)
        if (this.hasRequestedAmount) {
            if (elapsedMinutes < 5) {
                return this.isUserActive ? VERY_FAST : FAST;
            } else if (elapsedMinutes < 15) {
                return this.isUserActive ? FAST : SLOW;
            } else {
                // After 15 minutes, very slow
                return VERY_SLOW;
            }
        }
        
        // Priority 3: No specific amount (browsing)
        if (this.isUserActive) {
            if (elapsedMinutes < 5) return NORMAL;
            if (elapsedMinutes < 15) return SLOW;
            return VERY_SLOW;
        } else {
            // Inactive user
            if (elapsedMinutes < 5) return SLOW;
            return VERY_SLOW;
        }
    }
    
    /**
     * Schedule next balance check
     */
    scheduleNextCheck() {
        const interval = this.getPollingInterval();
        
        this.interval = setTimeout(async () => {
            await this.checkBalance();
            
            // Schedule next check if still monitoring
            if (this.currentWallet) {
                this.scheduleNextCheck();
            }
        }, interval);
    }
    
    /**
     * Check balance and detect payments
     */
    async checkBalance() {
        if (!this.currentWallet) return;
        if (!this.interval && !this.currentWallet) return; // redundancia de seguridad
        this.consecutiveChecks++;
        
        try {
            const newBalance = await fetchBalance(this.currentWallet.address);
            
            if (newBalance !== null && newBalance > this.initialBalance) {
                // Payment received!
                const receivedAmount = newBalance - this.initialBalance;
                
                console.log('[BalanceMonitor] Payment detected!', {
                    previous: this.initialBalance,
                    new: newBalance,
                    received: receivedAmount,
                    checksBeforeDetection: this.consecutiveChecks
                });
                
                // Update initial balance for next detection
                this.initialBalance = newBalance;
                this.consecutiveChecks = 0;
                
                // Notify callback
                if (this.onPaymentReceived) {
                    this.onPaymentReceived(receivedAmount);
                }
                
                // After payment, slow down for 15 seconds (cooldown)
                await new Promise(resolve => setTimeout(resolve, 15000));
            }
            
            // Log current strategy every 10 checks
            if (this.consecutiveChecks % 10 === 0) {
                const interval = this.getPollingInterval();
                console.log('[BalanceMonitor] Status:', {
                    checks: this.consecutiveChecks,
                    interval: `${interval}ms`,
                    active: this.isUserActive,
                    hasAmount: this.hasRequestedAmount,
                    elapsed: `${Math.floor((Date.now() - this.startTime) / 60000)}min`
                });
            }
            
        } catch (error) {
            console.error('[BalanceMonitor] Check failed:', error);
        }
    }
}
