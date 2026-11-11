// Ricomprime un video con ffmpeg: max 6 secondi, larghezza max 480px, senza audio,
// in MP4 (H.264), il formato che si vede su tutti i telefoni. Risultato: di solito sotto 1MB.
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

const MAX_SECONDS = 6;
const MAX_WIDTH = 480;

function transcode(inputPath, outputPath) {
    const args = [
        '-y', '-i', inputPath,
        '-t', String(MAX_SECONDS),
        '-an',
        '-vf', `scale='trunc(min(${MAX_WIDTH},iw)/2)*2':-2`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath,
    ];
    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, args);
        let log = '';
        proc.stderr.on('data', chunk => { log = (log + chunk).slice(-2000); });
        proc.on('error', reject);
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg ha fallito (${code}): ${log}`)));
    });
}

module.exports = { transcode };
