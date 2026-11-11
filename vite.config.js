import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // percorsi relativi: il sito funziona su qualunque dominio o sottocartella
    build: { chunkSizeWarningLimit: 900 }, // la libreria Firebase è grande: evita l'avviso
});
