import { updateWalletName } from './storage.js';

/**
 * Hace editable el nombre de la wallet, recortando caracteres si no caben
 * @param {HTMLElement} nameEl - Elemento del nombre de la wallet
 * @param {HTMLElement} editIcon - Icono para activar edición
 * @param {string} address - Dirección de la wallet
 */
export function setupEditableWalletName(nameEl, editIcon, address) {
    let originalName = nameEl.textContent.trim();

    editIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        startEditing();
    });

    function startEditing() {
        // Limpiar espacios al iniciar edición
        nameEl.textContent = nameEl.textContent.trim();

        nameEl.contentEditable = 'true';
        nameEl.classList.add('editing');
        nameEl.focus();
        selectAllText(nameEl);
    }

    nameEl.addEventListener('blur', finishEditing);

    nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nameEl.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            nameEl.textContent = originalName;
            nameEl.blur();
        }
    });

    // Limita caracteres según ancho del contenedor, usando requestAnimationFrame
    nameEl.addEventListener('input', () => {
        requestAnimationFrame(() => limitTextWidth(nameEl));
    });

    function finishEditing() {
        nameEl.contentEditable = 'false';
        nameEl.classList.remove('editing');

        // Limpiar espacios antes de guardar
        let newName = nameEl.textContent.trim();

        if (!newName) {
            newName = `Nexa ${address.slice(-4)}`;
        }

        updateWalletName(address, newName);
        nameEl.textContent = newName; // asegura que el DOM quede limpio
        originalName = newName;
    }
}

// ===== Utils internos =====
function selectAllText(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function limitTextWidth(nameEl) {
    const parentWidth = nameEl.parentElement.offsetWidth;
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.font = window.getComputedStyle(nameEl).font;
    tempSpan.textContent = nameEl.textContent;
    document.body.appendChild(tempSpan);

    while (tempSpan.offsetWidth > parentWidth && nameEl.textContent.length > 0) {
        nameEl.textContent = nameEl.textContent.slice(0, -1);
        placeCaretAtEnd(nameEl);
        tempSpan.textContent = nameEl.textContent;
    }

    document.body.removeChild(tempSpan);
}

function placeCaretAtEnd(el) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}
