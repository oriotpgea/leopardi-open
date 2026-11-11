// Stato condiviso dell'app.
export const state = {
    user: null,               // utente staff loggato (Firebase Auth) oppure null
    players: [],              // tutti i giocatori
    editions: [],             // tutte le edizioni, dalla più recente
    editionsLoaded: false,
    teams: [],                // team dell'edizione attualmente sottoscritta
    matches: [],              // partite dell'edizione attualmente sottoscritta
    subscribedEditionId: null,
    adminEditionId: null,     // edizione scelta nella console (indipendente dalla diretta)
    editingPlayerId: null,
    pendingCupAction: null,
    previousMatches: {},      // per riconoscere i nuovi punti e lanciare l'animazione
};

export const playerById = (id) => state.players.find(p => p.id === id);
export const teamById = (id) => state.teams.find(t => t.id === id);

// Bicchieri per squadra di una partita (le partite vecchie non hanno il campo: 6)
export const cupsOf = (match) => (Number(match?.cups) === 10 ? 10 : 6);

// Nome del team calcolato dai nomi attuali dei giocatori (così segue le rinomine).
// "players" è opzionale: di default usa i giocatori caricati.
export function teamDisplayName(team, players = state.players) {
    if (!team) return '...';
    if (!team.p1Id || !team.p2Id) return team.name || '...';
    const n1 = players.find(p => p.id === team.p1Id)?.name || team.p1Name;
    const n2 = players.find(p => p.id === team.p2Id)?.name || team.p2Name;
    return (n1 && n2) ? `${n1} & ${n2}` : (team.name || '...');
}
