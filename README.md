# Leopardi Open

App per seguire in diretta il torneo: partite live, roster con carriera dei giocatori, albo d'oro.

- **Sito**: Vite + Tailwind, pubblicato da Netlify a ogni push su GitHub (`netlify.toml`).
- **Dati**: Firebase (Firestore, Storage, Authentication).
- **Video esultanza**: ricompressi sul server da una Cloud Function (`functions/`).

## Comandi

```bash
npm install          # una volta sola (e dopo ogni aggiornamento delle dipendenze)
npm run dev          # sito in locale con ricarica automatica
npm run build        # crea la cartella dist (lo fa già Netlify)
npm run preview      # prova in locale la versione compilata
```

Per Firebase serve la CLI (una volta sola):

```bash
npm install -g firebase-tools
firebase login
```

```bash
npm run deploy:rules                       # pubblica firestore.rules e storage.rules
cd functions && npm install && cd ..       # dipendenze della Cloud Function (una volta sola)
npm run deploy:functions                   # pubblica la Cloud Function (richiede il piano Blaze)
```

## Configurazione Firebase (una volta sola)

Dalla [console Firebase](https://console.firebase.google.com/), progetto `leopardi-open-7242c`:

1. **Authentication → Sign-in method**: attiva **Email/Password**.
2. **Authentication → Users → Add user**: crea l'account staff.
3. **Authentication → Settings → User actions**: togli la spunta a *Enable create (sign-up)*.

Poi, da terminale: `npm run deploy:rules` e `npm run deploy:functions`.

## Struttura

- `index.html` — pagina
- `src/main.js` — avvio, navigazione (`#live`, `#roster`, `#albo`, `#admin`) e pulsanti
- `src/style.css` — stili (Tailwind + componenti)
- `src/js/firebase.js` — configurazione Firebase
- `src/js/data.js` — dati in tempo reale
- `src/js/render.js` — disegno di roster, partite, ticker, albo
- `src/js/admin.js` — azioni dello staff
- `src/js/stats.js` — classifiche (calcolate per ID giocatore)
- `src/js/profile.js` — carriera del giocatore
- `src/js/media.js` — foto, video e audio
- `src/js/effects.js` — animazioni GOAL e fine partita
- `public/` — file copiati così come sono (immagini, icone, manifest, service worker)
- `functions/` — Cloud Function `optimizeVideo` (ffmpeg: max 6 secondi, 480px, MP4 con audio mono)
- `firestore.rules`, `storage.rules`, `firebase.json` — regole di sicurezza

## Note sui dati

- Le partite senza campo `cups` valgono 6 bicchieri.
- Le edizioni archiviate conservano le classifiche salvate alla chiusura.
- Il campo `tol` dei giocatori è la statistica mostrata come "Res".
- Eliminando un giocatore si cancellano anche foto, video e audio; i team in cui ha giocato restano, così i suoi punti restano nelle classifiche.
- Sostituendo foto, video o audio, il file vecchio viene cancellato.
- Esultanza: se il giocatore ha un motto audio si sente quello, altrimenti l'audio del video.
- Eliminando un team si cancellano anche le sue partite; eliminando un'edizione, tutti i suoi team e partite.
- Il pulsante **🧹 Pulizia dati orfani** (Admin → Database) trova e cancella, dopo conferma, file che nessun giocatore usa e team/partite di edizioni eliminate.
- La regione della Cloud Function (`us-west1`, la stessa dello Storage) è scritta in `functions/index.js` e in `src/js/firebase.js`: devono coincidere.
