# Tappezzeria Fariello

## Dove modificare le informazioni

Per cambiare i dati visibili sul sito modifica solo questo file:

`site-config.json`

Qui puoi modificare:

- `businessName`: nome dell'attivita'
- `tagline`: frase principale della home
- `shortDescription`: testo sotto la frase principale
- `locationLabel`: citta' e descrizione breve
- `address`: indirizzo
- `city`: CAP, citta' e provincia
- `email`: email mostrata ai clienti
- `phoneDisplay`: telefono mostrato sul sito
- `phoneLink`: telefono senza spazi, usato dal link cliccabile
- `instagramUrl` e `facebookUrl`: link social, se presenti
- `storyTitle` e `storyText`: testo della storia
- `heroImage` e `storyImage`: URL delle immagini

Dopo aver salvato `site-config.json`, aggiorna il browser. Se il server e' stato avviato con `npm start`, non serve modificare HTML o JavaScript.

## Come gestire i prodotti

1. Apri `http://localhost:3000/admin`.
2. Accedi con le credenziali presenti nel file `.env`.
3. Compila nome, categoria, gli URL delle foto (uno per riga, massimo 12) e descrizione.
4. Premi `Salva prodotto`.

Le categorie disponibili sono `Letti`, `Divani`, `Poltrone` e `Materassi`.

### Migrazione Supabase per la galleria

Nel pannello SQL di Supabase esegui una volta:

```sql
alter table products add column if not exists images jsonb not null default '[]'::jsonb;
update products set images = jsonb_build_array(image) where jsonb_array_length(images) = 0;
```

La colonna esistente `image` resta per compatibilità e contiene sempre la prima foto. I nuovi prodotti usano `images` per la galleria.

## Come avviare il sito

```bash
npm start
```

Sito pubblico: `http://localhost:3000`

Pannello riservato: `http://localhost:3000/admin`

### Notifiche Telegram per i contatti

Il form salva sempre la richiesta in Supabase. Se configuri queste due variabili nel file `.env`, il server invia anche una notifica Telegram:

```env
TELEGRAM_BOT_TOKEN=token_del_bot
TELEGRAM_CHAT_ID=id_della_chat
```

Per creare il bot:

1. Cerca `@BotFather` su Telegram, invia `/newbot` e copia il token ricevuto.
2. Apri la chat con il nuovo bot e invia almeno un messaggio.
3. Apri `https://api.telegram.org/botTOKEN/getUpdates`, sostituendo `TOKEN` con il token del bot.
4. Nel JSON cerca `chat` e copia il valore numerico di `id` in `TELEGRAM_CHAT_ID`.
5. Riavvia il server dopo aver modificato `.env`.

La notifica è facoltativa: se Telegram non è configurato o non risponde, la richiesta resta comunque salvata e il cliente riceve la conferma del form.

## File da non modificare

- `.env`: contiene password e segreti. Non pubblicarlo.
- `data.json`: contiene prodotti e messaggi salvati dal backend.
- `server.js`: contiene la logica del server e la protezione dell'area riservata.
- `node_modules/`: dipendenze installate automaticamente.
