# Spogliatoio

Sito statico (GitHub Pages) con dati su Supabase. In questo repository non ci sono chiavi segrete, foto o dati personali.

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `index.html` | Sito principale (per ora: pagina provvisoria) |
| `presidenza/` | Pannello owner: convocazione, link ospiti, foto, impostazioni, trasferimento |
| `ospiti/` | Settore ospiti: solo caricamento foto, con link a scadenza |
| `js/`, `css/` | Codice e stile condivisi |
| `config.js` | Indirizzo del progetto Supabase e chiave anon/publishable (pubblici per costruzione) |
| `supabase/schema.sql` | Tabelle, regole d'accesso, spazio foto |
| `supabase/functions/` | Funzioni lato server: `ospiti-upload`, `convoca`, `trasferisci`, `guardiano` |

## Messa in linea

### 1. Supabase

1. **SQL Editor** → nuova query → incolla `supabase/schema.sql` → **Run**.
2. **Authentication → Users → Add user → Create new user**: la tua email, una password lunga, conferma automatica attiva.
3. **SQL Editor**: esegui lo script `owner.sql` (fornito a parte, fuori da questo repository) dopo averci scritto la tua email. L'ultima riga deve mostrare `owner`.
4. **SQL Editor**: esegui lo script `seed.sql` (fornito a parte) con i contenuti iniziali.
5. **Authentication**, nelle impostazioni di accesso: disattiva la registrazione libera di nuovi utenti. La chiave anon è pubblica: senza questo blocco chiunque potrebbe crearsi un account. La convocazione del festeggiato funziona comunque, perché passa da una funzione lato server.
6. **Edge Functions → Deploy a new function → Via Editor**, quattro volte, con questi nomi esatti:
   `ospiti-upload`, `convoca`, `trasferisci`, `guardiano`. Incolla il contenuto del rispettivo `index.ts` e pubblica.
   Poi, nelle impostazioni di ciascuna funzione, **disattiva la verifica JWT** ("Enforce JWT verification" / "Verify JWT"):
   ogni funzione controlla da sola chi la chiama (token del link ospiti oppure sessione dell'utente).
7. **Edge Functions → Secrets**: aggiungi `ANTHROPIC_API_KEY` con la chiave del guardiano. Facoltativo: `MODELLO_GUARDIANO` per cambiare modello.
8. **Project Settings → API Keys**: copia la *Publishable key* (`sb_publishable_…`). L'indirizzo del progetto (`https://….supabase.co`) è in **Project Settings → Data API** oppure nel pulsante **Connect**. Inseriscili in `config.js`.

### 2. GitHub Pages

1. Carica il contenuto di questa cartella nella radice del repository (i file nascosti `.nojekyll` e `.gitignore` sono facoltativi).
2. **Settings → Pages → Build and deployment**: "Deploy from a branch", ramo `main`, cartella `/ (root)`.
3. Dopo un paio di minuti il sito è su `https://NOMEUTENTE.github.io/NOME-REPOSITORY/`.

### 3. Prova rapida

1. Apri `/presidenza/` e accedi con il tuo account.
2. Attiva il link ospiti, aprilo da un altro telefono e carica una foto. Ricarica la presidenza: la foto deve comparire.
3. Prova "Convoca il festeggiato" con una tua seconda email, poi usa "Revoca la convocazione".
4. Se qualcosa non va: **Edge Functions → Logs** in Supabase mostra gli errori delle funzioni.

## Mai in questo repository

Chiavi segrete (service_role/secret, Anthropic), foto, script `owner.sql` e `seed.sql`, email, sequenze, token dei link ospiti.
Se una chiave finisce qui per errore, revocala: cancellare il file non la toglie dalla cronologia di Git.
