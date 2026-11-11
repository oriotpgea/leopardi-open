// Cloud Function: ricomprime sul server i video dell'esultanza.
// Il sito carica il file originale in celebrations/raw/, poi chiama questa funzione,
// che salva la versione leggera, cancella l'originale e restituisce l'indirizzo finale.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getStorage, getDownloadURL } = require('firebase-admin/storage');
const { transcode } = require('./transcode');

initializeApp();

// Deve coincidere con FUNCTIONS_REGION in src/js/firebase.js
const REGION = 'europe-west1';
const RAW_PATH = /^celebrations\/raw\/([\w-]+)\.\w{1,5}$/;

exports.optimizeVideo = onCall(
    { region: REGION, memory: '1GiB', timeoutSeconds: 120, maxInstances: 2 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Solo lo staff può caricare video.');

        const rawPath = String(request.data?.path || '');
        const match = RAW_PATH.exec(rawPath);
        if (!match) throw new HttpsError('invalid-argument', 'Percorso del video non valido.');

        const bucket = getStorage().bucket();
        const rawFile = bucket.file(rawPath);
        const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-'));
        const inputPath = path.join(workDir, 'input');
        const outputPath = path.join(workDir, 'output.mp4');

        try {
            await rawFile.download({ destination: inputPath });
            await transcode(inputPath, outputPath);

            const destination = `celebrations/${match[1]}.mp4`;
            await bucket.upload(outputPath, {
                destination,
                metadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000' },
            });
            const url = await getDownloadURL(bucket.file(destination));
            const { size } = await fs.stat(outputPath);
            return { url, bytes: size };
        } catch (error) {
            console.error('Compressione non riuscita per', rawPath, error);
            throw new HttpsError('internal', 'Compressione del video non riuscita. Prova con un altro file.');
        } finally {
            // L'originale pesante non resta mai nell'archivio, nemmeno in caso di errore
            await rawFile.delete({ ignoreNotFound: true }).catch(() => {});
            await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
        }
    }
);
