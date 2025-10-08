export function showError(elements, message) {
    if (!elements || !elements.errorMessage) return;
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

export function hideError(elements) {
    if (!elements || !elements.errorMessage) return;
    elements.errorMessage.classList.add('hidden');
}

export function setLoadingState(elements, loading) {
    if (!elements) return;
    if (elements.trackWalletBtn) elements.trackWalletBtn.disabled = loading;
    if (loading) elements.loadingOverlay?.classList.remove('hidden');
    else elements.loadingOverlay?.classList.add('hidden');

    if (elements.refreshAllBtn) elements.refreshAllBtn.disabled = loading;
}

export function updateStatus(elements, text, type = 'ready') {
    if (!elements) return;
    elements.statusText.textContent = text;
    elements.statusIndicator.className = 'status-indicator';
    if (type === 'error') elements.statusIndicator.classList.add('error');
    else if (type === 'loading') elements.statusIndicator.classList.add('loading');
}

export function adjustBalanceFontSize(element) {
    if (!element) return;
    element.style.fontSize = '';
    requestAnimationFrame(() => {
        const container = element.parentElement;
        if (!container) return;
        const containerWidth = container.offsetWidth - 40;
        const contentWidth = element.scrollWidth;
        if (contentWidth > containerWidth) {
            const scale = containerWidth / contentWidth;
            const currentSize = parseFloat(window.getComputedStyle(element).fontSize);
            element.style.fontSize = `${currentSize * scale * 0.95}px`;
        }
    });
}
