# tappezzeriafariello

## Installazione delle dipendenze su Ubuntu VPS

Dopo aver copiato o clonato il progetto sul VPS, entra nella cartella del progetto
ed esegui:

```bash
bash deploy/install-ubuntu.sh
```

Lo script installa Node.js 22, Git e Caddy, quindi installa le dipendenze Node.js
bloccate in `package-lock.json`. Richiede Ubuntu e un utente con `sudo` (o root).
Non configura il dominio, il firewall o i segreti: completa questi passaggi prima
di esporre il sito su Internet. Non copiare il file `.env` nel repository.

## Indicizzazione Google

Il server espone automaticamente `robots.txt` e `sitemap.xml`.

Dopo la pubblicazione:

1. Registra il sito in Google Search Console.
2. Verifica il dominio o l'URL del servizio.
3. Invia `https://tuo-dominio.example/sitemap.xml` nella sezione Sitemap.
4. Usa Controllo URL e richiedi l'indicizzazione della home.

Se usi un dominio personalizzato, imposta su Render la variabile `PUBLIC_SITE_URL`, ad esempio `https://www.tappezzeriafariello.it`.