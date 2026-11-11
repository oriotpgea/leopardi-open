// Tutto ciò che disegna l'interfaccia a partire dallo stato.
import { state, playerById, teamById, cupsOf, teamDisplayName } from './state.js';
import { $, esc, avatar, safeUrl } from './ui.js';
import { computeEditionStats, topWithTies } from './stats.js';

const teamName = (id) => teamDisplayName(teamById(id));

// --- ROSTER ---
export function renderPlayersPage() {
    const grid = $('public-players-grid');
    const noResults = $('no-players-found');
    const term = ($('search-roster').value || '').toLowerCase().trim();

    if (state.players.length === 0) {
        noResults.classList.add('hide');
        grid.innerHTML = "<p class='text-gray-500'>Nessun giocatore in database.</p>";
        return;
    }

    const filtered = state.players.filter(p =>
        ((p.name || '') + ' ' + (p.nickname || '')).toLowerCase().includes(term));

    noResults.classList.toggle('hide', filtered.length > 0);

    grid.innerHTML = filtered.map(p => {
        const photo = safeUrl(p.photoUrl);
        return `
        <div data-action="open-profile" data-id="${esc(p.id)}" class="card bg-gray-900 border-2 border-gray-700 rounded-xl overflow-hidden relative group cursor-pointer hover:border-blue-500 hover:scale-[1.02] transition-all duration-300 shadow-xl animate__animated animate__fadeIn">
            ${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm">` : ''}
            <div class="relative z-10 p-4 flex flex-col items-center">

                <div class="relative mb-3">
                    ${avatar(p, 'w-28 h-28 border-4 border-white shadow-2xl text-4xl')}
                    <div class="absolute bottom-0 right-0 bg-blue-600 rounded-full px-2 py-0.5 text-[10px] font-bold border border-white">${p.hand === 'Sinistra' ? '🖐️ SX' : '🖐️ DX'}</div>
                </div>

                <h3 class="font-black text-2xl uppercase tracking-wider text-white leading-none mb-1 text-center drop-shadow-md w-full break-words">${esc(p.name)}</h3>
                ${p.nickname ? `<div class="text-yellow-400 italic font-serif text-sm mb-2">"${esc(p.nickname)}"</div>` : ''}

                <div class="flex flex-wrap gap-2 justify-center mb-4">
                    <span class="px-2 py-0.5 bg-purple-900 border border-purple-500 rounded text-[10px] font-bold uppercase text-purple-300">${esc(p.style || 'Misto')}</span>
                </div>

                <div class="w-full grid grid-cols-3 gap-2 bg-black/60 p-3 rounded-lg backdrop-blur-sm border border-gray-700">
                    <div class="flex flex-col items-center"><span class="text-xl mb-1">🎯</span><span class="text-lg font-black text-green-400 leading-none">${esc(p.prec ?? '-')}</span><span class="text-[8px] uppercase text-gray-500 font-bold mt-1">Prec</span></div>
                    <div class="flex flex-col items-center border-l border-gray-700"><span class="text-xl mb-1">🔥</span><span class="text-lg font-black text-red-500 leading-none">${esc(p.pow ?? '-')}</span><span class="text-[8px] uppercase text-gray-500 font-bold mt-1">Pow</span></div>
                    <div class="flex flex-col items-center border-l border-gray-700"><span class="text-xl mb-1">🍺</span><span class="text-lg font-black text-yellow-500 leading-none">${esc(p.tol ?? '-')}</span><span class="text-[8px] uppercase text-gray-500 font-bold mt-1">Res</span></div>
                </div>

                ${p.description ? `<div class="mt-3 text-center text-xs text-gray-400 italic font-serif border-t border-gray-700 pt-2 w-full">"${esc(p.description)}"</div>` : ''}
                <div class="mt-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold group-hover:text-blue-400 transition">Vedi carriera →</div>
            </div>
        </div>`;
    }).join('');
}

// --- PARTITE ---
export function renderMatches() {
    const renderCard = (m, isAdmin) => `
        <div class="card p-4 relative ${m.status === 'live' ? 'border-green-500/50' : ''}">
            ${isAdmin
                ? `<div class="flex justify-between mb-2 border-b border-gray-700 pb-1"><span class="text-[10px] uppercase font-bold text-gray-500">${esc(m.title || 'Match')} · ${cupsOf(m)} bicchieri</span> <button data-action="delete-item" data-col="matches" data-id="${esc(m.id)}" class="text-red-500 text-xs" title="Elimina partita">🗑️</button></div>`
                : `<div class="text-center text-[10px] text-gray-500 uppercase font-bold mb-4 tracking-widest">${esc(m.title || 'Match')} ${m.status === 'live' ? '<span class="text-green-500 animate-pulse ml-2">● LIVE</span>' : ''}</div>`}
            <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col items-center min-w-0">
                    <div class="text-sm font-bold mb-2 truncate max-w-full ${m.winner === m.teamA ? 'text-bp' : ''}">${esc(teamName(m.teamA))}</div>
                    ${renderPyramid(m, 'hitsA', m.teamA, isAdmin)}
                    ${renderHitTrace(m, 'hitsA', isAdmin)}
                </div>
                <div class="flex flex-col items-center border-l border-gray-800 pl-4 min-w-0">
                    <div class="text-sm font-bold mb-2 truncate max-w-full ${m.winner === m.teamB ? 'text-bp' : ''}">${esc(teamName(m.teamB))}</div>
                    ${renderPyramid(m, 'hitsB', m.teamB, isAdmin)}
                    ${renderHitTrace(m, 'hitsB', isAdmin)}
                </div>
            </div>
        </div>`;

    $('live-matches').innerHTML = state.matches.map(m => renderCard(m, false)).join('');
    $('admin-matches').innerHTML = state.user ? state.matches.map(m => renderCard(m, true)).join('') : '';
}

// Disposizione dei bicchieri: triangolo completo finché ne restano tanti,
// poi i rimasti vengono ricompattati (come nel gioco reale).
const RERACK_SHAPES = { 6: [1, 2, 3], 5: [1, 2, 2], 4: [1, 2, 1], 3: [1, 2], 2: [1, 1], 1: [1] };
const chunk = (list, shape) => {
    let i = 0;
    return shape.map(n => list.slice(i, i += n));
};

function pyramidRows(total, hitKeys) {
    const all = Array.from({ length: total }, (_, i) => i + 1);
    const remaining = all.filter(c => !hitKeys.includes(String(c)));
    const staticMin = total === 10 ? 7 : 5;
    if (remaining.length >= staticMin) return chunk(all, total === 10 ? [1, 2, 3, 4] : [1, 2, 3]);
    return chunk(remaining, RERACK_SHAPES[remaining.length] || []);
}

function renderPyramid(match, teamField, teamId, isAdmin) {
    const hits = match[teamField] || {};
    const hitKeys = Object.keys(hits);
    const total = cupsOf(match);
    const rows = pyramidRows(total, hitKeys);
    const size = total === 10 ? 'w-7 h-7' : 'w-8 h-8';

    let html = `<div class="flex flex-col items-center gap-1 ${total === 10 ? 'min-h-[124px]' : 'min-h-[100px]'} justify-center transition-all duration-300">`;
    rows.forEach(row => {
        html += '<div class="flex gap-1">';
        row.forEach(cupId => {
            if (hitKeys.includes(String(cupId))) {
                // Bicchiere già colpito (visibile solo nel triangolo completo): foto sbiadita di chi ha segnato
                const player = playerById(hits[cupId]);
                html += player
                    ? avatar(player, `${size} border border-gray-700/50 grayscale opacity-50 text-xs`)
                    : `<div class="${size} rounded-full border border-gray-700/50 bg-gray-800"></div>`;
            } else if (isAdmin) {
                html += `<button data-action="cup-click" data-match="${esc(match.id)}" data-field="${teamField}" data-cup="${cupId}" data-team="${esc(teamId)}" class="${size} rounded-full bg-darksec hover:bg-gray-600 border border-gray-500 flex items-center justify-center font-bold text-xs shadow-lg transition-transform hover:scale-110">${cupId}</button>`;
            } else {
                html += `<div class="${size} rounded-full cup-red"></div>`;
            }
        });
        html += '</div>';
    });
    html += '</div>';
    return html;
}

function renderHitTrace(match, teamField, isAdmin) {
    const entries = Object.entries(match[teamField] || {});
    if (entries.length === 0) return '<div class="h-6"></div>';
    return `<div class="flex flex-wrap gap-1 mt-2 justify-center max-w-[120px]">${entries.map(([cupId, playerId]) => {
        const player = playerById(playerId) || { name: '?' };
        const pic = avatar(player, `w-8 h-8 border-2 border-white/50 shadow-md text-xs ${isAdmin ? 'hover:border-red-500' : ''}`);
        return isAdmin
            ? `<button data-action="undo-hit" data-match="${esc(match.id)}" data-field="${teamField}" data-cup="${esc(cupId)}" title="Annulla punto" class="rounded-full">${pic}</button>`
            : pic;
    }).join('')}</div>`;
}

// --- MENU A TENDINA (CONSOLE) ---
const setOptions = (select, placeholder, optionsHtml) => {
    const previous = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` + optionsHtml;
    select.value = previous;
    if (select.value !== previous) select.value = '';
};

export function renderPlayerSelects() {
    const opts = state.players.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    setOptions($('sel-p1'), 'Seleziona P1', opts);
    setOptions($('sel-p2'), 'Seleziona P2', opts);

    $('players-list-tiny').innerHTML = state.players.map(p => `
        <div class="flex justify-between border-b border-gray-800 pb-1 items-center">
            <span class="font-bold text-gray-300 truncate">${esc(p.name)}</span>
            <div class="flex gap-2 shrink-0">
                <button data-action="edit-player" data-id="${esc(p.id)}" class="text-xs text-blue-400 hover:text-white" title="Modifica">✏️</button>
                <button data-action="delete-item" data-col="players" data-id="${esc(p.id)}" class="text-red-500 text-[10px] uppercase hover:bg-red-900/50 px-1 rounded" title="Elimina">x</button>
            </div>
        </div>`).join('');

    // Il pulsante per spostare le vecchie foto compare solo se ce ne sono
    const legacyPhotos = state.players.filter(p => (p.photoUrl || '').startsWith('data:')).length;
    const btn = $('btn-migrate-photos');
    btn.classList.toggle('hide', legacyPhotos === 0);
    btn.textContent = `⚡ Ottimizza ${legacyPhotos} foto vecchie`;
}

export function renderTeamSelects() {
    const opts = state.teams.map(t => `<option value="${esc(t.id)}">${esc(teamDisplayName(t))}</option>`).join('');
    setOptions($('sel-team-a'), 'Seleziona Team A', opts);
    setOptions($('sel-team-b'), 'Seleziona Team B', opts);

    // Podio: si sceglie tra i team iscritti (viene salvato il nome)
    const podiumOpts = state.teams.map(t => {
        const name = esc(teamDisplayName(t));
        return `<option value="${name}">${name}</option>`;
    }).join('');
    setOptions($('rank-1'), '🥇 1° Classificato', podiumOpts);
    setOptions($('rank-2'), '🥈 2° Classificato', podiumOpts);
    setOptions($('rank-3'), '🥉 3° Classificato', podiumOpts);

    $('teams-list-admin').innerHTML = state.teams.map(t => `
        <div class="flex justify-between border-b border-gray-800 pb-1 items-center">
            <span class="font-bold text-gray-300 truncate w-3/4">${esc(teamDisplayName(t))}</span>
            <button data-action="delete-item" data-col="teams" data-id="${esc(t.id)}" class="text-red-500 hover:text-red-400 text-[10px] uppercase border border-red-900/30 px-1 rounded">X</button>
        </div>`).join('');
}

export function renderAdminEditionSelect() {
    const select = $('admin-edition-select');
    select.innerHTML = '<option value="">-- Seleziona --</option>' + state.editions.map(e =>
        `<option value="${esc(e.id)}">${esc(e.name)}${e.status === 'closed' ? ' (Chiusa)' : ''}</option>`).join('');
    select.value = state.adminEditionId || '';

    const enabled = !!state.adminEditionId;
    ['admin-controls', 'admin-live-area'].forEach(id => {
        $(id).classList.toggle('opacity-50', !enabled);
        $(id).classList.toggle('pointer-events-none', !enabled);
    });
}

// --- TICKER MARCATORI ---
export function renderTicker() {
    const ticker = $('live-ticker-content');
    const { topScorers, topAvgScorers } = computeEditionStats(state.matches, state.teams, state.players);
    const stats = topWithTies(topScorers, 5, 'score');
    const avgStats = topWithTies(topAvgScorers, 5, 'avg');

    if (stats.length === 0) {
        ticker.innerHTML = '<span class="ticker-item">Nessun punto segnato...</span>';
        ticker.style.animationDuration = '20s';
        return;
    }

    const item = (i, name, value) => `
        <span class="ticker-item"><span class="rank">#${i + 1}</span>${esc(name)}<span class="score">(${value})</span></span>
        <span class="text-gray-700 mx-2">•</span>`;
    const label = (text, wide) => `<span class="ticker-item ticker-label${wide ? ' ticker-label-wide' : ''}">★ ${text} ★</span>`;

    const block = label('TOP MARCATORI') + stats.map((s, i) => item(i, s.name, s.score)).join('')
        + label('MEDIA GOL/PARTITA') + avgStats.map((s, i) => item(i, s.name, `${s.avg.toFixed(2)}/partita`)).join('');
    const separator = label('LEOPARDI OPEN', true);

    ticker.innerHTML = block + separator + block + separator + block;
    ticker.style.animationDuration = `${Math.max(25, (stats.length + avgStats.length) * 6)}s`;
}

// --- ALBO D'ORO ---
export function renderArchive() {
    const el = $('archive-list');
    if (!state.editionsLoaded) { el.innerHTML = '<p class="text-center text-gray-500 italic">Caricamento...</p>'; return; }
    if (!state.editions.length) { el.innerHTML = '<p class="text-center text-gray-500 italic">Nessun evento passato.</p>'; return; }

    // Le edizioni nuove salvano anche l'ID del giocatore: se c'è, si mostra il nome aggiornato
    const displayName = (s) => (s.playerId && playerById(s.playerId)?.name) || s.name;
    const row = (i, name, value) => `<div class="flex justify-between gap-2 text-xs border-b border-gray-800 pb-1 mb-1"><span class="text-gray-300 truncate">#${i + 1} ${esc(name)}</span><span class="font-bold text-bp">${esc(value)}</span></div>`;
    const empty = '<span class="text-gray-500 italic text-xs">Dati non disponibili</span>';

    el.innerHTML = state.editions.map(e => {
        if (e.status !== 'closed') {
            return `<div class="card p-4 border border-gray-700 opacity-70"><div class="flex justify-between items-center"><h3 class="font-bold text-gray-400">${esc(e.name)}</h3><span class="text-xs bg-green-900 text-green-400 px-2 py-1 rounded">IN CORSO</span></div></div>`;
        }
        const p = e.podium || {};
        const scorers = (e.topScorers || []).map((s, i) => row(i, displayName(s), s.score)).join('');
        const avgScorers = (e.topAvgScorers || []).map((s, i) => row(i, displayName(s), Number(s.avg || 0).toFixed(2))).join('');

        return `
        <div class="card p-6 border-l-4 border-l-yellow-600 bg-gradient-to-br from-darksec to-black">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-2xl font-black italic text-white">${esc(e.name)}</h3>
                ${state.user ? `<button data-action="recalculate" data-id="${esc(e.id)}" class="text-[10px] text-gray-500 hover:text-bp underline whitespace-nowrap ml-2">🔄 Ricalcola</button>` : ''}
            </div>
            <div class="grid gap-4 text-sm md:grid-cols-3">
                <div class="space-y-2">
                    <div class="text-[10px] uppercase text-gray-500 font-bold mb-1">Podio Team</div>
                    <div class="text-yellow-500 font-bold text-lg">🥇 ${esc(p.first || 'N/A')}</div>
                    <div class="text-gray-300">🥈 ${esc(p.second || '-')}</div>
                    <div class="text-orange-700">🥉 ${esc(p.third || '-')}</div>
                </div>
                <div class="md:border-l border-gray-700 md:pl-4 flex flex-col">
                    <div class="text-[10px] uppercase text-gray-500 font-bold mb-2">Marcatori</div>
                    <div class="max-h-32 overflow-y-auto pr-1">${scorers || empty}</div>
                </div>
                <div class="md:border-l border-gray-700 md:pl-4 flex flex-col">
                    <div class="text-[10px] uppercase text-gray-500 font-bold mb-2">Media Gol/Partita</div>
                    <div class="max-h-32 overflow-y-auto pr-1">${avgScorers || empty}</div>
                </div>
            </div>
        </div>`;
    }).join('');
}
