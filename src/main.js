// Punto d'ingresso: navigazione, collegamento dei pulsanti e avvio.
// Il codice è diviso per argomento nella cartella js/.
import 'animate.css';
import './style.css';
import { auth, onAuthStateChanged } from './js/firebase.js';
import { state } from './js/state.js';
import { $ } from './js/ui.js';
import { renderPlayersPage, renderArchive, renderMatches } from './js/render.js';
import { subscribePlayers, subscribeEditions, refreshLive, enterAdmin } from './js/data.js';
import { openProfile } from './js/profile.js';
import * as admin from './js/admin.js';

// --- NAVIGAZIONE (ogni pagina ha il suo indirizzo: #live, #roster, #albo, #admin) ---
let authReady = false;
const ROUTES = { '': 'landing', live: 'live', roster: 'players', albo: 'archive', admin: 'admin' };

function route() {
    const key = location.hash.replace(/^#\/?/, '');
    let page = ROUTES[key] || 'landing';
    if (page === 'admin') page = state.user ? 'dashboard' : 'login';

    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hide'));
    // Finché Firebase non ha detto se lo staff è loggato, l'area admin resta in attesa
    const waitingAuth = ROUTES[key] === 'admin' && !authReady;
    if (waitingAuth) return;
    $('view-' + page).classList.remove('hide');
    document.querySelectorAll('.nav-btn').forEach(a =>
        a.classList.toggle('nav-active', a.getAttribute('href') === '#' + key));
    window.scrollTo(0, 0);

    if (page === 'players') renderPlayersPage();
    if (page === 'live') refreshLive();
    if (page === 'archive') renderArchive();
    if (page === 'dashboard') enterAdmin();
}
window.addEventListener('hashchange', route);

// --- PULSANTI: ogni elemento con data-action chiama la funzione corrispondente ---
const closeModal = ({ target }) => $(target).classList.add('hide');

const actions = {
    'open-profile': openProfile,
    'close-modal': closeModal,
    'logout': admin.logout,
    'save-player': admin.savePlayer,
    'cancel-edit': admin.cancelEdit,
    'edit-player': admin.loadPlayerForEdit,
    'migrate-photos': admin.migratePhotos,
    'create-edition': admin.createEdition,
    'delete-edition': admin.deleteCurrentEdition,
    'close-edition': admin.closeEdition,
    'recalculate': admin.recalculateTopScorers,
    'create-team': admin.createTeam,
    'create-match': admin.createMatch,
    'delete-item': admin.deleteItem,
    'cup-click': admin.handleCupClick,
    'confirm-hit': admin.confirmHit,
    'undo-hit': admin.undoHit,
};

document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = actions[el.dataset.action];
    if (action) action(el.dataset);
});

$('login-form').addEventListener('submit', (event) => { event.preventDefault(); admin.login(); });
$('search-roster').addEventListener('input', renderPlayersPage);
$('admin-edition-select').addEventListener('change', (event) => admin.changeEdition(event.target.value));

// --- AVVIO ---
// Il login è gestito da Firebase Authentication: lo stato arriva qui e aggiorna le pagine.
onAuthStateChanged(auth, (user) => {
    state.user = user;
    if (!authReady) {
        authReady = true;
        route();
        return;
    }
    const onAdmin = ROUTES[location.hash.replace(/^#\/?/, '')] === 'admin';
    if (onAdmin) route();
    else { renderArchive(); renderMatches(); }
});

route();
subscribePlayers();
subscribeEditions();

// App installabile: il service worker serve solo come riserva offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
