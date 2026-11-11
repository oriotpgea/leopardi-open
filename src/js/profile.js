// Carriera del giocatore: statistiche su tutte le edizioni, calcolate dalle partite salvate.
import { db, collection, getDocs } from './firebase.js';
import { state, playerById, teamDisplayName } from './state.js';
import { $, esc, avatar } from './ui.js';

export async function openProfile({ id }) {
    const player = playerById(id);
    if (!player) return;

    const body = $('profile-body');
    $('profile-header').innerHTML = `
        ${avatar(player, 'w-20 h-20 border-4 border-white shadow-xl text-3xl shrink-0')}
        <div class="min-w-0 text-left">
            <h3 class="font-black text-2xl uppercase tracking-wider leading-tight break-words">${esc(player.name)}</h3>
            ${player.nickname ? `<div class="text-yellow-400 italic font-serif text-sm">"${esc(player.nickname)}"</div>` : ''}
        </div>`;
    body.innerHTML = '<p class="text-center text-gray-500 italic py-6">Caricamento carriera...</p>';
    $('profile-modal').classList.remove('hide');

    try {
        const [matchesSnap, teamsSnap] = await Promise.all([
            getDocs(collection(db, 'matches')),
            getDocs(collection(db, 'teams')),
        ]);
        const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        body.innerHTML = renderCareer(computeCareer(id, matches, teams));
    } catch (e) {
        console.error(e);
        body.innerHTML = '<p class="text-center text-red-400 py-6">Impossibile caricare la carriera. Riprova.</p>';
    }
}

function computeCareer(playerId, matches, teams) {
    const rows = [];
    // state.editions è già ordinato dalla più recente
    state.editions.forEach(edition => {
        const myTeams = teams.filter(t => t.editionId === edition.id && (t.p1Id === playerId || t.p2Id === playerId));
        if (!myTeams.length) return;
        const myTeamIds = myTeams.map(t => t.id);

        let played = 0, wins = 0, goals = 0;
        matches.filter(m => m.editionId === edition.id).forEach(m => {
            const mine = myTeamIds.includes(m.teamA) || myTeamIds.includes(m.teamB);
            if (!mine) return;
            played++;
            if (m.status === 'finished' && myTeamIds.includes(m.winner)) wins++;
            [m.hitsA, m.hitsB].forEach(hits => {
                goals += Object.values(hits || {}).filter(pid => pid === playerId).length;
            });
        });

        // Medaglia: il podio salva il nome del team
        const names = new Set(myTeams.flatMap(t => [t.name, teamDisplayName(t)]));
        const podium = edition.podium || {};
        const medal = names.has(podium.first) ? '🥇' : names.has(podium.second) ? '🥈' : names.has(podium.third) ? '🥉' : '';

        rows.push({ name: edition.name, open: edition.status !== 'closed', played, wins, goals, medal });
    });

    const total = rows.reduce((acc, r) => ({
        played: acc.played + r.played, wins: acc.wins + r.wins, goals: acc.goals + r.goals,
        titles: acc.titles + (r.medal === '🥇' ? 1 : 0)
    }), { played: 0, wins: 0, goals: 0, titles: 0 });

    return { rows, total };
}

function renderCareer({ rows, total }) {
    if (!rows.length) return '<p class="text-center text-gray-500 italic py-6">Non ha ancora partecipato a nessuna edizione.</p>';

    const avg = total.played ? (total.goals / total.played).toFixed(2) : '0.00';
    const tile = (value, label, color = 'text-white') => `
        <div class="bg-black/40 border border-gray-700 rounded-lg p-2 text-center">
            <div class="text-xl font-black ${color} leading-none">${value}</div>
            <div class="text-[9px] uppercase text-gray-500 font-bold mt-1">${label}</div>
        </div>`;

    return `
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
            ${tile(rows.length, 'Edizioni')}
            ${tile(total.played, 'Partite')}
            ${tile(total.wins, 'Vittorie', 'text-green-400')}
            ${tile(total.goals, 'Centri', 'text-bp')}
            ${tile(avg, 'Media', 'text-bp')}
            ${tile(total.titles, 'Titoli', 'text-yellow-400')}
        </div>
        <div class="text-[10px] uppercase text-gray-500 font-bold mb-2 text-left">Edizione per edizione</div>
        <div class="max-h-56 overflow-y-auto pr-1 text-xs">
            <div class="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 items-center text-left">
                <span class="text-gray-500 font-bold uppercase text-[9px]">Edizione</span>
                <span class="text-gray-500 font-bold uppercase text-[9px] text-right">Partite</span>
                <span class="text-gray-500 font-bold uppercase text-[9px] text-right">Vinte</span>
                <span class="text-gray-500 font-bold uppercase text-[9px] text-right">Centri</span>
                ${rows.map(r => `
                    <span class="text-gray-200 font-bold truncate border-t border-gray-800 pt-1">${r.medal} ${esc(r.name)}${r.open ? ' <span class="text-green-400 font-normal">· in corso</span>' : ''}</span>
                    <span class="text-right border-t border-gray-800 pt-1">${r.played}</span>
                    <span class="text-right border-t border-gray-800 pt-1">${r.wins}</span>
                    <span class="text-right font-bold text-bp border-t border-gray-800 pt-1">${r.goals}</span>`).join('')}
            </div>
        </div>`;
}
