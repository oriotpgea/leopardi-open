// Caricamento di foto, video e audio su Firebase Storage.
import { storage, functions, ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata, httpsCallable } from './firebase.js';

const extensionOf = (file, fallback) => {
    const m = /\.([a-z0-9]{1,5})$/i.exec(file?.name || '');
    return m ? m[1].toLowerCase() : fallback;
};

// --- FOTO: ridotta nel browser prima del caricamento ---
const compressImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const MAX_WIDTH = 400;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
            blob => blob ? resolve(blob) : reject(new Error('Impossibile elaborare la foto.')),
            'image/jpeg', 0.8
        );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto non leggibile.')); };
    img.src = url;
});

export async function uploadPlayerPhoto(file, playerId) {
    return uploadPhotoBlob(await compressImage(file), playerId);
}

export async function uploadPhotoBlob(blob, playerId) {
    const fileRef = ref(storage, `photos/${playerId}_${Date.now()}.jpg`);
    await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
    return getDownloadURL(fileRef);
}

// --- VIDEO: l'originale viene caricato in una cartella temporanea e ricompresso
// sul server dalla Cloud Function "optimizeVideo" (max 6 secondi, 480px, MP4).
// L'originale viene sempre cancellato: nell'archivio resta solo la versione leggera.
export async function uploadCelebrationVideo(file, playerId, onProgress = () => {}) {
    const rawRef = ref(storage, `celebrations/raw/${playerId}_${Date.now()}.${extensionOf(file, 'mp4')}`);
    onProgress('Caricamento video...');
    await uploadBytes(rawRef, file, file.type ? { contentType: file.type } : undefined);

    onProgress('Compressione video sul server...');
    try {
        const optimize = httpsCallable(functions, 'optimizeVideo', { timeout: 130000 });
        const result = await optimize({ path: rawRef.fullPath });
        return result.data.url;
    } catch (e) {
        console.error(e);
        // Se la funzione non ha risposto, l'originale è ancora lì: va tolto
        await deleteObject(rawRef).catch(() => {});
        // Un errore generico ("internal") significa che la funzione non è raggiungibile
        const unreachable = ['functions/not-found', 'functions/unavailable'].includes(e?.code) || e?.message === 'internal';
        throw new Error(unreachable
            ? 'Compressione video non disponibile: la Cloud Function non è pubblicata (vedi README).'
            : (e?.message || 'Compressione del video non riuscita.'));
    }
}

// --- AUDIO ---
export async function uploadCelebrationAudio(file, playerId) {
    const fileRef = ref(storage, `audio/${playerId}_${Date.now()}.${extensionOf(file, 'mp3')}`);
    await uploadBytes(fileRef, file, file.type ? { contentType: file.type } : undefined);
    return getDownloadURL(fileRef);
}

// --- CANCELLAZIONE ---
// Restituisce il percorso nell'archivio di un file di questo progetto, oppure null
// (foto vecchie salvate nel database, link esterni, file di altri progetti).
export function storagePathOf(url) {
    if (typeof url !== 'string' || !url.startsWith('https://')) return null;
    if (!url.includes(`/b/${storage.app.options.storageBucket}/o/`)) return null;
    try { return ref(storage, url).fullPath; } catch { return null; }
}

// Cancella dall'archivio i file indicati. Non blocca mai: se un file non c'è già più, va bene così.
export async function deleteStoredFiles(urls) {
    const paths = urls.map(storagePathOf).filter(Boolean);
    await Promise.all(paths.map(path => deleteObject(ref(storage, path)).catch(e => {
        if (e?.code !== 'storage/object-not-found') console.warn('File non cancellato:', path, e);
    })));
}

// Elenca tutti i file delle cartelle dei giocatori, con i "raw" (video in attesa di compressione)
export async function listPlayerFiles() {
    const files = [];
    for (const folder of ['photos', 'celebrations', 'celebrations/raw', 'audio']) {
        const res = await listAll(ref(storage, folder));
        files.push(...res.items);
    }
    return files;
}

export { getMetadata };
