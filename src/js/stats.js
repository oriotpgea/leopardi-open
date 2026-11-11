// Calcolo delle classifiche. Tutto è conteggiato per ID giocatore (non per nome):
// rinominare un giocatore non spezza le statistiche e gli omonimi restano distinti.

// teams e players sono array di oggetti con "id".
export function computeEditionStats(matches, teams, players) {
    const teamsById = {};
    const fallbackNames = {}; // nomi salvati nei team: servono se un giocatore è stato eliminato
    teams.forEach(t => {
        teamsById[t.id] = t;
        if (t.p1Id && t.p1Name) fallbackNames[t.p1Id] = t.p1Name;
        if (t.p2Id && t.p2Name) fallbackNames[t.p2Id] = t.p2Name;
    });
    const playersById = {};
    players.forEach(p => playersById[p.id] = p);

    const nameOf = (id) => playersById[id]?.name || fallbackNames[id] || 'Giocatore rimosso';

    const goals = {};
    const played = {};

    matches.forEach(m => {
        [m.teamA, m.teamB].forEach(teamId => {
            const t = teamsById[teamId];
            if (!t) return;
            [t.p1Id, t.p2Id].forEach(pid => {
                if (pid) played[pid] = (played[pid] || 0) + 1;
            });
        });
        [m.hitsA, m.hitsB].forEach(hits => {
            Object.values(hits || {}).forEach(pid => {
                if (pid) goals[pid] = (goals[pid] || 0) + 1;
            });
        });
    });

    const topScorers = Object.entries(goals)
        .map(([playerId, score]) => ({ playerId, name: nameOf(playerId), score }))
        .sort((a, b) => b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name));

    const topAvgScorers = Object.entries(played)
        .map(([playerId, matchesPlayed]) => {
            const g = goals[playerId] || 0;
            return { playerId, name: nameOf(playerId), goals: g, matches: matchesPlayed, avg: matchesPlayed ? g / matchesPlayed : 0 };
        })
        .sort((a, b) => b.avg !== a.avg ? b.avg - a.avg : a.name.localeCompare(b.name));

    return { topScorers, topAvgScorers };
}

// Primi "limit" in classifica, includendo tutti i pari merito con l'ultimo
export function topWithTies(list, limit = 5, key = 'score') {
    if (list.length <= limit) return list;
    const cutoff = list[limit - 1][key];
    return list.filter(s => s[key] >= cutoff);
}
