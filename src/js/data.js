// Sottoscrizioni in tempo reale a Firestore.
import { db, collection, onSnapshot, query, where, orderBy } from './firebase.js';
import { state } from './state.js';
import { $, isVisible, toast } from './ui.js';
import {
    renderPlayersPage, renderMatches, renderPlayerSelects, renderTeamSelects,
    renderAdminEditionSelect, renderTicker, renderArchive
} from './render.js';
import { triggerGoalAnimation, triggerEndMatch } from './effects.js';

let unsubTeams = null;
let unsubMatches = null;
let adminAutoPicked = false;

const onError = (what) => (err) => {
    console.error(`Errore ${what}:`, err);
    toast(`Errore nel caricamento (${what}). Controlla la connessione.`, 'error');
};

function renderEditionViews() {
    renderMatches();
    renderTicker();
}

// --- GIOCATORI (sempre attiva) ---
export function subscribePlayers() {
    onSnapshot(query(collection(db, 'players'), orderBy('name')), (sn) => {
        state.players = sn.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPlayerSelects();
        renderTeamSelects();
        renderEditionViews();
        if (isVisible('view-players')) renderPlayersPage();
        if (isVisible('view-archive')) renderArchive();
    }, onError('giocatori'));
}

// --- EDIZIONI (sempre attiva) ---
export function subscribeEditions() {
    onSnapshot(query(collection(db, 'editions'), orderBy('createdAt', 'desc')), (sn) => {
        state.editions = sn.docs.map(d => ({ id: d.id, ...d.data() }));
        state.editionsLoaded = true;

        // L'edizione scelta in console potrebbe essere stata eliminata
        if (state.adminEditionId && !state.editions.some(e => e.id === state.adminEditionId)) {
            state.adminEditionId = null;
        }

        if (isVisible('view-archive')) renderArchive();
        if (isVisible('view-live')) refreshLive();
        if (isVisible('view-dashboard')) enterAdmin();
    }, onError('edizioni'));
}

// --- TEAM E PARTITE DI UN'EDIZIONE ---
export function unsubscribeEdition() {
    if (unsubTeams) unsubTeams();
    if (unsubMatches) unsubMatches();
    unsubTeams = unsubMatches = null;
    state.subscribedEditionId = null;
    state.teams = [];
    state.matches = [];
    state.previousMatches = {};
    renderTeamSelects();
    renderEditionViews();
}

export function subscribeToEdition(id) {
    unsubscribeEdition();
    state.subscribedEditionId = id;

    unsubTeams = onSnapshot(query(collection(db, 'teams'), where('editionId', '==', id)), (sn) => {
        state.teams = sn.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTeamSelects();
        renderEditionViews();
    }, onError('team'));

    unsubMatches = onSnapshot(
        query(collection(db, 'matches'), where('editionId', '==', id), orderBy('timestamp', 'desc')),
        (sn) => {
            const newMatches = sn.docs.map(d => ({ id: d.id, ...d.data() }));

            // Animazioni solo per chi sta guardando la diretta
            if (isVisible('view-live')) {
                newMatches.forEach(m => {
                    const old = state.previousMatches[m.id];
                    if (!old) return;
                    checkGoal(m.hitsA, old.hitsA, m.teamA);
                    checkGoal(m.hitsB, old.hitsB, m.teamB);
                    if (m.status === 'finished' && old.status !== 'finished') triggerEndMatch(m);
                });
            }

            state.previousMatches = {};
            newMatches.forEach(m => state.previousMatches[m.id] = m);
            state.matches = newMatches;
            renderEditionViews();
        },
        onError('partite')
    );
}

function checkGoal(newHits, oldHits, teamId) {
    const newKeys = Object.keys(newHits || {});
    const oldKeys = Object.keys(oldHits || {});
    if (newKeys.length <= oldKeys.length) return;
    const cup = newKeys.find(k => !oldKeys.includes(k));
    if (cup) triggerGoalAnimation(newHits[cup], teamId);
}

// --- DIRETTA: segue la più recente edizione ancora aperta ---
export function refreshLive() {
    if (!state.editionsLoaded) {
        $('live-edition-title').innerText = '...';
        return;
    }
    const live = state.editions.find(e => e.status !== 'closed');
    if (!live) {
        if (state.subscribedEditionId) unsubscribeEdition();
        $('live-edition-title').innerText = 'Nessun Torneo Attivo';
        $('no-live-msg').classList.remove('hide');
        return;
    }
    $('no-live-msg').classList.add('hide');
    $('live-edition-title').innerText = live.name;
    if (state.subscribedEditionId !== live.id) subscribeToEdition(live.id);
    else renderEditionViews();
}

// --- CONSOLE: usa l'edizione scelta nel menu, indipendente dalla diretta ---
export function enterAdmin() {
    // Comodità: se non è stata scelta un'edizione, si propone quella aperta
    // (solo la prima volta, per rispettare un'eventuale deselezione manuale)
    if (!state.adminEditionId && !adminAutoPicked && state.editionsLoaded) {
        state.adminEditionId = state.editions.find(e => e.status !== 'closed')?.id || null;
        adminAutoPicked = true;
    }
    renderAdminEditionSelect();

    if (state.adminEditionId) {
        if (state.subscribedEditionId !== state.adminEditionId) subscribeToEdition(state.adminEditionId);
        else renderEditionViews();
    } else if (state.subscribedEditionId) {
        unsubscribeEdition();
    }
}
