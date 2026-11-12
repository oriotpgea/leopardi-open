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

    // L'audio caricato a parte ha la precedenza; altrimenti si sente quello del video
    const useVideoSound = !!videoUrl && !audioUrl;

    clearTimeout(goalTimer);
    audioEl.pause();

    if (videoUrl) {
        imgEl.classList.add('hide');
        videoEl.classList.remove('hide');
        videoEl.loop = !useVideoSound; // con l'audio del video, una sola volta (niente urlo ripetuto)
        videoEl.muted = !useVideoSound;
        videoEl.src = videoUrl;
        videoEl.play().catch(() => {
            // I browser bloccano l'audio se l'utente non ha mai toccato la pagina: almeno il video, muto
            videoEl.muted = true;
            videoEl.play().catch(() => {});
        });
    } else {
        videoEl.classList.add('hide');
        videoEl.pause();
        imgEl.classList.toggle('hide', !photoUrl);
        if (photoUrl) imgEl.src = photoUrl;
    }

    if (audioUrl) {
        audioEl.src = audioUrl;
        audioEl.play().catch(() => {}); // bloccato se l'utente non ha mai toccato la pagina
    }

    overlay.classList.remove('hide');

    // L'overlay resta 4 secondi; se si sente l'audio del video, resta finché il video finisce (max ~6s).
    // Se arriva un altro goal prima della chiusura, il timer riparte da capo.
    const close = () => {
        overlay.classList.add('hide');
        videoEl.pause();
        audioEl.pause();
    };
    goalTimer = setTimeout(close, 4000);
    if (useVideoSound) {
        videoEl.onloadedmetadata = () => {
            const ms = Math.min(7000, Math.max(4000, videoEl.duration * 1000 + 300));
            if (Number.isFinite(ms)) {
                clearTimeout(goalTimer);
                goalTimer = setTimeout(close, ms);
            }
        };
    } else {
        videoEl.onloadedmetadata = null;
    }
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
