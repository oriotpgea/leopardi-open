// Animazioni della diretta: overlay GOAL e schermata di fine partita.
import { playerById, teamById, teamDisplayName } from './state.js';
import confetti from 'canvas-confetti';
import { $, safeUrl } from './ui.js';

let goalTimer = null;

export function triggerGoalAnimation(playerId, teamId) {
    const player = playerById(playerId);
    const team = teamById(teamId);

    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#ff6b00', '#ffffff'] });

    const overlay = $('overlay-goal');
    const imgEl = $('overlay-goal-img');
    const videoEl = $('overlay-goal-video');
    const audioEl = $('overlay-goal-audio');
    $('overlay-goal-name').innerText = player?.name || 'GOL!';
    $('overlay-goal-team').innerText = team ? teamDisplayName(team) : '';

    const videoUrl = safeUrl(player?.celebrationVideoUrl);
    const photoUrl = safeUrl(player?.photoUrl);
    const audioUrl = safeUrl(player?.celebrationAudioUrl);

    if (videoUrl) {
        imgEl.classList.add('hide');
        videoEl.classList.remove('hide');
        videoEl.src = videoUrl;
        videoEl.muted = true;
        videoEl.play().catch(() => {});
    } else {
        videoEl.classList.add('hide');
        videoEl.pause();
        imgEl.classList.toggle('hide', !photoUrl);
        if (photoUrl) imgEl.src = photoUrl;
    }

    if (audioUrl) {
        audioEl.src = audioUrl;
        audioEl.play().catch(() => {}); // i browser bloccano l'audio se l'utente non ha mai toccato la pagina
    } else {
        audioEl.pause();
    }

    overlay.classList.remove('hide');

    // Se arriva un altro goal prima della chiusura, il timer riparte da capo
    clearTimeout(goalTimer);
    goalTimer = setTimeout(() => {
        overlay.classList.add('hide');
        videoEl.pause();
        audioEl.pause();
    }, 4000);
}

export function triggerEndMatch(match) {
    const loserId = match.winner === match.teamA ? match.teamB : match.teamA;
    const winner = teamById(match.winner);
    const loser = teamById(loserId);

    $('overlay-end-winner').innerText = winner ? teamDisplayName(winner) : 'VINCITORE';
    $('overlay-end-loser').innerText = loser ? teamDisplayName(loser) : 'SCONFITTO';
    $('overlay-end').classList.remove('hide');

    const end = Date.now() + 3000;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}
