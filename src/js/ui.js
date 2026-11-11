// Piccoli helper di interfaccia: selettori, escaping, toast, conferme, avatar.
export const $ = (id) => document.getElementById(id);

// Rende sicuro un testo prima di inserirlo nell'HTML (nomi, soprannomi, motti...)
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Accetta solo indirizzi http(s) o immagini incorporate (le vecchie foto in base64)
export const safeUrl = (u) => (typeof u === 'string' && /^(https?:\/\/|data:image\/)/i.test(u)) ? u : '';

export const isVisible = (id) => !$(id).classList.contains('hide');

// Foto tonda del giocatore, oppure l'iniziale se non ha foto
export function avatar(player, cls = '') {
    const name = player?.name || '?';
    const url = safeUrl(player?.photoUrl);
    if (url) {
        return `<img src="${esc(url)}" alt="${esc(name)}" title="${esc(name)}" loading="lazy" class="rounded-full object-cover ${cls}">`;
    }
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return `<div title="${esc(name)}" class="rounded-full bg-slate-700 flex items-center justify-center font-black text-white ${cls}">${esc(initial)}</div>`;
}

// Messaggio a scomparsa (sostituisce alert)
export function toast(message, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    $('toast-container').appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        setTimeout(() => el.remove(), 300);
    }, type === 'error' ? 5000 : 3000);
}

// Finestra di conferma (sostituisce confirm). Restituisce una Promise<boolean>.
export function confirmDialog(message, { okLabel = 'Conferma', danger = false } = {}) {
    return new Promise((resolve) => {
        const modal = $('confirm-modal');
        const ok = $('confirm-ok');
        const cancel = $('confirm-cancel');
        $('confirm-message').textContent = message;
        ok.textContent = okLabel;
        ok.classList.toggle('btn-danger', danger);

        const close = (result) => {
            modal.classList.add('hide');
            ok.onclick = null;
            cancel.onclick = null;
            resolve(result);
        };
        ok.onclick = () => close(true);
        cancel.onclick = () => close(false);
        modal.classList.remove('hide');
    });
}
