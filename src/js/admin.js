// Azioni dello staff: login, giocatori, edizioni, team, partite e punti.
import {
    db, auth, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs,
    runTransaction, writeBatch, deleteObject, signInWithEmailAndPassword, signOut
} from './firebase.js';
import { state, playerById, teamById, cupsOf } from './state.js';
import { $, toast, confirmDialog, avatar, esc } from './ui.js';
import { computeEditionStats } from './stats.js';
import {
    uploadPlayerPhoto, uploadPhotoBlob, uploadCelebrationVideo, uploadCelebrationAudio,
    deleteStoredFiles, storagePathOf, listPlayerFiles, getMetadata
} from './media.js';
import { enterAdmin } from './data.js';

const fail = (e, fallback = 'Qualcosa è andato storto. Riprova.') => {
    console.error(e);
    const denied = e?.code === 'permission-denied' || e?.code === 'storage/unauthorized';
    toast(denied ? 'Permesso negato: effettua di nuovo il login staff.' : (e?.message || fallback), 'error');
};

const clampStat = (value) => String(Math.max(0, Math.min(100, parseInt(value, 10) || 0)));

// --- LOGIN ---
export async function login() {
    const email = $('admin-email').value.trim();
    const password = $('admin-pass').value;
    if (!email || !password) return toast('Inserisci email e password', 'error');
    const btn = $('btn-login');
    btn.disabled = true;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        $('admin-pass').value = '';
    } catch (e) {
        console.error(e);
        const offline = e?.code === 'auth/network-request-failed';
        const notEnabled = e?.code === 'auth/operation-not-allowed' || e?.code === 'auth/configuration-not-found';
        toast(offline ? 'Connessione assente. Riprova.'
            : notEnabled ? 'Login non ancora attivato su Firebase (vedi README).'
            : 'Email o password errate', 'error');
    } finally {
        btn.disabled = false;
    }
}

export async function logout() {
    await signOut(auth);
    location.hash = '';
}

// --- GIOCATORI ---
export async function savePlayer() {
    const name = $('player-name').value.trim();
    const photoFile = $('player-photo').files[0];
    const videoFile = $('player-video').files[0];
    const audioFile = $('player-audio').files[0];

    if (!name) return toast('Inserisci il nome', 'error');
    if (videoFile && videoFile.size > 50 * 1024 * 1024) {
        return toast('Video troppo grande (>50MB). Registra una clip più corta.', 'error');
    }
    if (audioFile && audioFile.size > 5 * 1024 * 1024) {
        return toast('Audio troppo grande (>5MB). Usa una clip più corta.', 'error');
    }

    const btn = $('btn-save-player');
    btn.disabled = true;
    btn.innerText = 'Elaborazione...';

    try {
        const fields = {
            name,
            hand: $('player-hand').value,
            style: $('player-style').value,
            nickname: $('player-nick').value.trim(),
            description: $('player-desc').value.trim(),
            prec: clampStat($('stat-prec').value),
            pow: clampStat($('stat-pow').value),
            tol: clampStat($('stat-tol').value), // "tol" è il campo storico della statistica "Res"
        };

        // Se è un giocatore nuovo si crea prima la scheda, poi si caricano i file
        const isEdit = !!state.editingPlayerId;
        let playerId = state.editingPlayerId;
        if (isEdit) {
            await updateDoc(doc(db, 'players', playerId), fields);
        } else {
            const created = await addDoc(collection(db, 'players'), { ...fields, photoUrl: '', createdAt: new Date() });
            playerId = created.id;
        }

        // I file già presenti restano se non ne viene scelto uno nuovo
        const previous = isEdit ? { ...playerById(playerId) } : {};
        const media = {};
        try {
            if (photoFile) {
                btn.innerText = 'Caricamento foto...';
                media.photoUrl = await uploadPlayerPhoto(photoFile, playerId);
            }
            if (videoFile) {
                media.celebrationVideoUrl = await uploadCelebrationVideo(videoFile, playerId, (step) => { btn.innerText = step; });
            }
            if (audioFile) {
                btn.innerText = 'Caricamento audio...';
                media.celebrationAudioUrl = await uploadCelebrationAudio(audioFile, playerId);
            }
            if (Object.keys(media).length) await updateDoc(doc(db, 'players', playerId), media);
        } catch (e) {
            // Caricamento a metà: i file nuovi già caricati non servono più
            await deleteStoredFiles(Object.values(media));
            throw e;
        }

        // I file sostituiti non servono più: si cancellano solo dopo che la scheda punta ai nuovi
        await deleteStoredFiles(Object.keys(media).map(field => previous[field]));

        toast(isEdit ? 'Giocatore aggiornato!' : 'Giocatore creato!');
        cancelEdit();
    } catch (e) {
        fail(e);
    } finally {
        btn.disabled = false;
        btn.innerText = state.editingPlayerId ? 'Aggiorna Giocatore' : 'Salva e Carica';
    }
}

export function loadPlayerForEdit({ id }) {
    const p = playerById(id);
    if (!p) return;
    state.editingPlayerId = id;

    $('player-name').value = p.name || '';
    $('player-nick').value = p.nickname || '';
    $('player-desc').value = p.description || '';
    $('player-hand').value = p.hand || 'Destra';
    $('player-style').value = p.style || 'Misto';
    $('stat-prec').value = p.prec || 50;
    $('stat-pow').value = p.pow || 50;
    $('stat-tol').value = p.tol || 50;
    ['player-photo', 'player-video', 'player-audio'].forEach(f => $(f).value = '');

    $('photo-hint').innerText = p.photoUrl ? '✅ Foto già caricata — seleziona un file per sostituirla' : 'Nessuna foto caricata';
    $('video-hint').innerText = p.celebrationVideoUrl ? '✅ Video già caricato — seleziona un file per sostituirlo' : 'Nessun video caricato';
    $('audio-hint').innerText = p.celebrationAudioUrl ? '✅ Audio già caricato — seleziona un file per sostituirlo' : 'Nessun audio caricato';

    $('form-title').innerText = '✏️ Modifica: ' + p.name;
    $('btn-save-player').innerText = 'Aggiorna Giocatore';
    $('btn-save-player').classList.replace('bg-blue-600', 'bg-green-600');
    $('btn-save-player').classList.replace('hover:bg-blue-500', 'hover:bg-green-500');
    $('btn-cancel-edit').classList.remove('hide');
    $('card-player-form').classList.add('border-green-500');
    $('card-player-form').classList.remove('border-l-blue-500');

    $('card-player-form').scrollIntoView({ behavior: 'smooth' });
}

export function cancelEdit() {
    state.editingPlayerId = null;

    ['player-name', 'player-nick', 'player-desc', 'player-photo', 'player-video', 'player-audio'].forEach(f => $(f).value = '');
    $('photo-hint').innerText = 'Foto del giocatore (opzionale)';
    $('video-hint').innerText = 'Viene tagliato a 6 secondi e compresso automaticamente.';
    $('audio-hint').innerText = 'Frase o urlo breve (2-3s), max 5MB.';
    $('stat-prec').value = 70;
    $('stat-pow').value = 70;
    $('stat-tol').value = 70;

    $('form-title').innerText = '1. Nuova Carta Giocatore';
    $('btn-save-player').innerText = 'Salva e Carica';
    $('btn-save-player').classList.replace('bg-green-600', 'bg-blue-600');
    $('btn-save-player').classList.replace('hover:bg-green-500', 'hover:bg-blue-500');
    $('btn-cancel-edit').classList.add('hide');
    $('card-player-form').classList.remove('border-green-500');
    $('card-player-form').classList.add('border-l-blue-500');
}

// Sposta su Storage le vecchie foto salvate dentro il database (rende l'app più leggera).
// Per ogni giocatore: prima si carica la copia, e solo se va a buon fine si aggiorna la scheda.
export async function migratePhotos() {
    const legacy = state.players.filter(p => (p.photoUrl || '').startsWith('data:'));
    if (!legacy.length) return;
    const ok = await confirmDialog(
        `Spostare ${legacy.length} foto nell'archivio file? Le foto restano identiche, l'app diventa solo più veloce.`,
        { okLabel: 'Ottimizza' });
    if (!ok) return;

    const btn = $('btn-migrate-photos');
    btn.disabled = true;
    let done = 0;
    let errors = 0;
    for (const p of legacy) {
        try {
            const blob = await (await fetch(p.photoUrl)).blob();
            const url = await uploadPhotoBlob(blob, p.id);
            await updateDoc(doc(db, 'players', p.id), { photoUrl: url });
            done++;
        } catch (e) {
            console.error('Foto non spostata per', p.name, e);
            errors++;
        }
    }
    btn.disabled = false;
    toast(errors ? `${done} foto ottimizzate, ${errors} lasciate com'erano.` : `${done} foto ottimizzate!`, errors ? 'error' : 'ok');
}

// --- EDIZIONI ---
export async function createEdition() {
    const name = $('new-edition-name').value.trim();
    if (!name) return toast("Inserisci il nome dell'edizione", 'error');
    try {
        const created = await addDoc(collection(db, 'editions'), { name, createdAt: new Date(), status: 'open' });
        $('new-edition-name').value = '';
        state.adminEditionId = created.id;
        enterAdmin();
        toast('Edizione creata');
    } catch (e) { fail(e); }
}

export function changeEdition(id) {
    state.adminEditionId = id || null;
    enterAdmin();
}

export async function deleteCurrentEdition() {
    const id = state.adminEditionId;
    const edition = state.editions.find(e => e.id === id);
    if (!edition) return toast("Seleziona un'edizione", 'error');

    const ok = await confirmDialog(
        `Eliminare definitivamente "${edition.name}" con tutti i suoi team e le sue partite? Non si può annullare.`,
        { okLabel: 'Elimina', danger: true });
    if (!ok) return;

    // Un'edizione archiviata fa parte dell'albo d'oro: doppia conferma
    if (edition.status === 'closed') {
        const sure = await confirmDialog(
            `"${edition.name}" è un'edizione archiviata: sparirà dall'albo d'oro e dalle carriere dei giocatori. Confermi?`,
            { okLabel: 'Sì, elimina', danger: true });
        if (!sure) return;
    }

    try {
        const [matchesSnap, teamsSnap] = await Promise.all([
            getDocs(query(collection(db, 'matches'), where('editionId', '==', id))),
            getDocs(query(collection(db, 'teams'), where('editionId', '==', id))),
        ]);
        const refs = [...matchesSnap.docs, ...teamsSnap.docs].map(d => d.ref);
        refs.push(doc(db, 'editions', id));

        // Prima team e partite, l'edizione per ultima: se qualcosa va storto a metà,
        // l'edizione resta visibile e si può riprovare
        await deleteInBatches(refs);
        state.adminEditionId = null;
        enterAdmin();
        toast('Evento eliminato.');
    } catch (e) { fail(e); }
}

export async function closeEdition() {
    const id = state.adminEditionId;
    if (!id || state.subscribedEditionId !== id) return;
    const podium = { first: $('rank-1').value, second: $('rank-2').value, third: $('rank-3').value };

    const ok = await confirmDialog(
        podium.first ? `Chiudere l'evento? Vincitori: ${podium.first}.` : "Chiudere l'evento senza indicare il vincitore?",
        { okLabel: 'Chiudi evento', danger: true });
    if (!ok) return;

    try {
        const { topScorers, topAvgScorers } = computeEditionStats(state.matches, state.teams, state.players);
        await updateDoc(doc(db, 'editions', id), { status: 'closed', podium, topScorers, topAvgScorers });
        toast('Evento archiviato!');
        location.hash = '#albo';
    } catch (e) { fail(e); }
}

export async function recalculateTopScorers({ id }) {
    const ok = await confirmDialog('Ricalcolare le classifiche marcatori di questa edizione a partire dalle partite salvate?', { okLabel: 'Ricalcola' });
    if (!ok) return;
    try {
        const [matchesSnap, teamsSnap] = await Promise.all([
            getDocs(query(collection(db, 'matches'), where('editionId', '==', id))),
            getDocs(query(collection(db, 'teams'), where('editionId', '==', id))),
        ]);
        // Sicurezza: senza partite salvate non si sovrascrive la classifica esistente
        if (matchesSnap.empty) return toast('Nessuna partita salvata per questa edizione: classifica lasciata invariata.', 'error');

        const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const { topScorers, topAvgScorers } = computeEditionStats(matches, teams, state.players);
        await updateDoc(doc(db, 'editions', id), { topScorers, topAvgScorers });
        toast('Classifiche aggiornate!');
    } catch (e) { fail(e); }
}

// --- TEAM E PARTITE ---
export async function createTeam() {
    const p1 = playerById($('sel-p1').value);
    const p2 = playerById($('sel-p2').value);
    if (!state.adminEditionId) return toast("Seleziona un'edizione", 'error');
    if (!p1 || !p2 || p1.id === p2.id) return toast('Seleziona due giocatori diversi', 'error');
    try {
        await addDoc(collection(db, 'teams'), {
            name: `${p1.name} & ${p2.name}`,
            p1Id: p1.id, p1Name: p1.name,
            p2Id: p2.id, p2Name: p2.name,
            editionId: state.adminEditionId
        });
        $('sel-p1').value = '';
        $('sel-p2').value = '';
        toast('Team iscritto');
    } catch (e) { fail(e); }
}

export async function createMatch() {
    const teamA = $('sel-team-a').value;
    const teamB = $('sel-team-b').value;
    if (!state.adminEditionId) return toast("Seleziona un'edizione", 'error');
    if (!teamA || !teamB || teamA === teamB) return toast('Seleziona due team diversi', 'error');
    try {
        await addDoc(collection(db, 'matches'), {
            title: $('match-title').value.trim() || 'Match', teamA, teamB,
            hitsA: {}, hitsB: {}, status: 'live', winner: null,
            cups: Number($('match-cups').value) === 10 ? 10 : 6,
            editionId: state.adminEditionId, timestamp: new Date()
        });
        $('match-title').value = '';
    } catch (e) { fail(e); }
}

export async function deleteItem({ col, id }) {
    if (col === 'players') return deletePlayer(id);
    if (col === 'teams') return deleteTeam(id);
    if (col !== 'matches') return;
    const ok = await confirmDialog('Eliminare questa partita con tutti i suoi punti?', { okLabel: 'Elimina', danger: true });
    if (!ok) return;
    try { await deleteDoc(doc(db, 'matches', id)); } catch (e) { fail(e); }
}

// Il giocatore sparisce dal roster insieme a foto, video e audio.
// I team in cui ha giocato restano, così i suoi punti restano nelle classifiche delle edizioni.
async function deletePlayer(id) {
    const player = playerById(id);
    if (!player) return;
    const ok = await confirmDialog(
        `Eliminare ${player.name} dal roster, con foto, video ed esultanza? I punti che ha segnato restano nelle classifiche.`,
        { okLabel: 'Elimina', danger: true });
    if (!ok) return;
    try {
        await deleteDoc(doc(db, 'players', id));
        if (state.editingPlayerId === id) cancelEdit();
        await deleteStoredFiles([player.photoUrl, player.celebrationVideoUrl, player.celebrationAudioUrl]);
        toast(`${player.name} eliminato`);
    } catch (e) { fail(e); }
}

// Un team si porta via anche le sue partite, che altrimenti resterebbero senza squadra
async function deleteTeam(id) {
    try {
        const [asA, asB] = await Promise.all([
            getDocs(query(collection(db, 'matches'), where('teamA', '==', id))),
            getDocs(query(collection(db, 'matches'), where('teamB', '==', id))),
        ]);
        const matchRefs = [...asA.docs, ...asB.docs].map(d => d.ref);
        const n = matchRefs.length;
        const message = n === 0 ? 'Eliminare questo team?'
            : n === 1 ? 'Eliminare questo team e la sua partita, con tutti i punti?'
            : `Eliminare questo team e le sue ${n} partite, con tutti i punti?`;
        const ok = await confirmDialog(message, { okLabel: 'Elimina', danger: true });
        if (!ok) return;
        await deleteInBatches([...matchRefs, doc(db, 'teams', id)]);
    } catch (e) { fail(e); }
}

// Cancella molti documenti a blocchi da 400 (il limite di Firestore è 500 per blocco)
async function deleteInBatches(refs) {
    for (let i = 0; i < refs.length; i += 400) {
        const batch = writeBatch(db);
        refs.slice(i, i + 400).forEach(r => batch.delete(r));
        await batch.commit();
    }
}

// --- PULIZIA ---
// Cerca i dati che non appartengono più a niente e, dopo conferma, li cancella:
// file nell'archivio che nessun giocatore usa, team e partite di edizioni eliminate.
export async function cleanupOrphans() {
    const btn = $('btn-cleanup');
    btn.disabled = true;
    btn.textContent = '🧹 Analisi in corso...';
    try {
        const used = new Set(state.players.flatMap(p =>
            [p.photoUrl, p.celebrationVideoUrl, p.celebrationAudioUrl].map(storagePathOf).filter(Boolean)));

        // File non usati. I video "raw" recenti potrebbero essere in compressione proprio ora: si lasciano.
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const orphanFiles = [];
        for (const file of await listPlayerFiles()) {
            if (used.has(file.fullPath)) continue;
            if (file.fullPath.startsWith('celebrations/raw/')) {
                const meta = await getMetadata(file).catch(() => null);
                if (!meta || new Date(meta.timeCreated).getTime() > oneHourAgo) continue;
            }
            orphanFiles.push(file);
        }

        // Team e partite di edizioni che non esistono più
        const editionIds = new Set(state.editions.map(e => e.id));
        const [teamsSnap, matchesSnap] = await Promise.all([
            getDocs(collection(db, 'teams')),
            getDocs(collection(db, 'matches')),
        ]);
        const orphanDocs = [...teamsSnap.docs, ...matchesSnap.docs]
            .filter(d => !editionIds.has(d.data().editionId))
            .map(d => d.ref);

        if (!orphanFiles.length && !orphanDocs.length) {
            toast('Tutto pulito: nessun dato orfano.');
            return;
        }

        const parts = [];
        if (orphanFiles.length) parts.push(`${orphanFiles.length} file non usati da nessun giocatore`);
        if (orphanDocs.length) parts.push(`${orphanDocs.length} team/partite di edizioni eliminate`);
        const ok = await confirmDialog(`Trovati ${parts.join(' e ')}. Cancellarli?`, { okLabel: 'Cancella', danger: true });
        if (!ok) return;

        btn.textContent = '🧹 Pulizia in corso...';
        await deleteInBatches(orphanDocs);
        await Promise.all(orphanFiles.map(f => deleteObject(f).catch(e => console.warn('File non cancellato:', f.fullPath, e))));
        toast('Pulizia completata!');
    } catch (e) {
        fail(e);
    } finally {
        btn.disabled = false;
        btn.textContent = '🧹 Pulizia dati orfani';
    }
}

// --- PUNTI ---
export function handleCupClick({ match: matchId, field: teamField, cup: cupNum, team: teamId }) {
    const team = teamById(teamId);
    if (!team) return;

    const p1 = playerById(team.p1Id) || { id: team.p1Id, name: team.p1Name || 'Giocatore 1' };
    const p2 = playerById(team.p2Id) || { id: team.p2Id, name: team.p2Name || 'Giocatore 2' };
    state.pendingCupAction = { matchId, teamField, cupNum };

    const renderBtn = (player) => `
        ${avatar(player, 'w-16 h-16 border-2 border-white mb-1 shadow-lg text-2xl')}
        <span class="font-bold text-sm text-white max-w-full truncate">${esc(player.name)}</span>`;

    $('btn-scorer-p1').innerHTML = renderBtn(p1);
    $('btn-scorer-p1').dataset.id = p1.id;
    $('btn-scorer-p2').innerHTML = renderBtn(p2);
    $('btn-scorer-p2').dataset.id = p2.id;
    $('scorer-modal').classList.remove('hide');
}

export async function confirmHit({ id: playerId }) {
    $('scorer-modal').classList.add('hide');
    const pending = state.pendingCupAction;
    state.pendingCupAction = null;
    if (!pending || !playerId) return;
    const { matchId, teamField, cupNum } = pending;

    try {
        await runTransaction(db, async (transaction) => {
            const matchRef = doc(db, 'matches', matchId);
            const snap = await transaction.get(matchRef);
            if (!snap.exists()) throw new Error('Partita non trovata.');

            const match = snap.data();
            // Se un altro dispositivo ha già assegnato questo bicchiere, non si sovrascrive
            if (match[teamField] && match[teamField][cupNum]) {
                throw new Error('Punto già assegnato da un altro dispositivo.');
            }

            const newHits = { ...match[teamField], [cupNum]: playerId };
            const updates = { [teamField]: newHits };
            if (Object.keys(newHits).length >= cupsOf(match)) {
                updates.status = 'finished';
                updates.winner = teamField === 'hitsA' ? match.teamA : match.teamB;
            }
            transaction.update(matchRef, updates);
        });
    } catch (e) { fail(e, 'Errore di connessione. Riprova.'); }
}

export async function undoHit({ match: matchId, field: teamField, cup: cupNum }) {
    const ok = await confirmDialog('Annullare questo punto?', { okLabel: 'Annulla punto', danger: true });
    if (!ok) return;
    try {
        await runTransaction(db, async (transaction) => {
            const matchRef = doc(db, 'matches', matchId);
            const snap = await transaction.get(matchRef);
            if (!snap.exists()) return;

            const match = snap.data();
            const hits = { ...match[teamField] };
            delete hits[cupNum];
            const updates = { [teamField]: hits };
            if (match.status === 'finished') { updates.status = 'live'; updates.winner = null; }
            transaction.update(matchRef, updates);
        });
    } catch (e) { fail(e, 'Errore di connessione. Riprova.'); }
}
