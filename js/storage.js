// js/storage.js
import { CONFIG } from './config.js';

/**
 * Carga las wallets guardadas desde localStorage
 * @returns {Array} Array de wallets guardadas
 */
export function loadWalletsFromStorage() {
    try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!stored) return [];
        
        const wallets = JSON.parse(stored);
        
        // Migrar wallets antiguas sin customName
        return wallets.map(wallet => {
            if (!wallet.customName) {
                wallet.customName = `wallet#${wallet.address.slice(-4)}`;
            }
            return wallet;
        });
    } catch (error) {
        console.error('Error loading wallets from storage:', error);
        return [];
    }
}

/**
 * Guarda las wallets en localStorage
 * @param {Array} wallets - Array de wallets a guardar
 */
export function saveWalletsToStorage(wallets) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(wallets));
    } catch (error) {
        console.error('Error saving wallets to storage:', error);
    }
}

/**
 * Guarda o actualiza una wallet individual
 * @param {string} address - Dirección de la wallet
 * @param {number} balance - Balance de la wallet
 * @param {string} customName - Nombre personalizado (opcional)
 * @returns {object} La wallet guardada
 */
export function saveWallet(address, balance, customName = null) {
    const wallets = loadWalletsFromStorage();
    const existingIndex = wallets.findIndex(w => w.address === address);
    
    // Generar nombre por defecto si no existe
    const defaultName = `WALLET ${address.slice(-4)}`;
    
    const newWallet = {
        address,
        balance,
        timestamp: Date.now(),
        customName: customName || (existingIndex !== -1 ? wallets[existingIndex].customName : null) || defaultName
    };

    if (existingIndex !== -1) {
        wallets[existingIndex] = newWallet;
    } else {
        wallets.unshift(newWallet);
    }

    saveWalletsToStorage(wallets);
    return newWallet;
}

/**
 * Actualiza el nombre personalizado de una wallet
 * @param {string} address - Dirección de la wallet
 * @param {string} newName - Nuevo nombre personalizado
 * @returns {boolean} true si se actualizó correctamente
 */
export function updateWalletName(address, newName) {
    const wallets = loadWalletsFromStorage();
    const walletIndex = wallets.findIndex(w => w.address === address);
    
    if (walletIndex === -1) return false;
    
    wallets[walletIndex].customName = newName || `wallet#${address.slice(-4)}`;
    saveWalletsToStorage(wallets);
    return true;
}

/**
 * Elimina una wallet del almacenamiento
 * @param {string} address - Dirección de la wallet a eliminar
 * @returns {Array} Array actualizado de wallets
 */
export function deleteWalletFromStorage(address) {
    const wallets = loadWalletsFromStorage();
    const filtered = wallets.filter(w => w.address !== address);
    saveWalletsToStorage(filtered);
    return filtered;
}

/**
 * Actualiza el balance y timestamp de una wallet
 * @param {string} address - Dirección de la wallet
 * @param {number} balance - Nuevo balance
 * @returns {boolean} true si se actualizó correctamente
 */
export function updateWalletBalance(address, balance) {
    const wallets = loadWalletsFromStorage();
    const walletIndex = wallets.findIndex(w => w.address === address);
    
    if (walletIndex === -1) return false;
    
    wallets[walletIndex].balance = balance;
    wallets[walletIndex].timestamp = Date.now();
    wallets[walletIndex].lastUpdated = Date.now();
    saveWalletsToStorage(wallets);
    return true;
}
