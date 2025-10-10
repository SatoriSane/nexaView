//balanceClient.js
import { showError, setLoadingState } from './ui.js';

export async function fetchBalance(address, elements) {
    if (!address || !address.startsWith('nexa:')) {
        console.error('Dirección inválida:', address);
        if (elements) showError(elements, 'Invalid address');
        return null;
    }

    try {
        if (elements) setLoadingState(elements, true);

        const response = await fetch(`/api/balance?address=${encodeURIComponent(address)}`);
        if (!response.ok) {
            console.error('Error al consultar balance:', response.status);
            if (elements) showError(elements, 'Failed to fetch balance');
            return null;
        }

        const data = await response.json();
        // Return total balance (confirmed + unconfirmed)
        const confirmed = data.balance ?? 0;
        const unconfirmed = data.unconfirmed ?? 0;
        console.log(`[Balance] Confirmed: ${confirmed}, Unconfirmed: ${unconfirmed}, Total: ${confirmed + unconfirmed}`);
        return confirmed + unconfirmed;

    } catch (error) {
        console.error('Error fetchBalance:', error);
        if (elements) showError(elements, 'Network error');
        return null;
    } finally {
        if (elements) setLoadingState(elements, false);
    }
}

export function formatBalance(balance) {
    if (typeof balance === 'number') {
        const nexaAmount = balance / 100; // 1 NEXA = 100 satoshis
        const integerPart = Math.floor(nexaAmount).toLocaleString('en-US');
        const decimalPart = (nexaAmount % 1).toFixed(2).substring(2);
        return `${integerPart}<span class="decimal-part">.${decimalPart}</span>`;
    }
    return '0.00';
}



export function formatTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleString();
}
