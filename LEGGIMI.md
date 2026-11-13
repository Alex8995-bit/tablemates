# Tablemates — guida passo passo

Tablemates è una web app per famiglie e coinquilini: pasti di ognuno, lista della spesa e conti condivisi (Casa, Viaggi, Extra) con un unico saldo, notifiche e assistente con intelligenza artificiale. Si installa su PC, Android e iPhone senza App Store.

Tempo: circa un'ora la prima volta. Costo: zero, con i piani gratuiti di Supabase, GitHub e Gmail.

## Prima di iniziare

Ti servono:

- un computer con Chrome o Edge;
- un indirizzo Gmail (serve per spedire i codici di accesso);
- il file `tablemates.zip`.

Creerai due account gratuiti: **Supabase** (il server con i dati) e **GitHub** (dove pubblichi l'app).

## Passo 1 · Scompatta il pacchetto

1. Scarica `tablemates.zip` e fai doppio clic per estrarlo.
2. Otterrai la cartella `tablemates` con dentro `index.html`, `config.js`, le cartelle `js`, `icons`, `vendor`, `supabase` e `strumenti`.

## Passo 2 · Crea il server su Supabase

1. Vai su **supabase.com** → **Start your project** e registrati, anche con l'account GitHub.
2. Clicca **New project**. Nome: `tablemates`. Scegli una password per il database e salvala. Regione: una in Europa, per esempio Frankfurt. Piano: **Free**. Poi **Create new project** e aspetta un paio di minuti.
3. Nel menu a sinistra apri **SQL Editor** → **New query**.
4. Apri con il Blocco note il file `tablemates/supabase/schema.sql`, copia tutto il testo, incollalo nell'editor e premi **Run**. Deve comparire "Success. No rows returned".
5. Apri **Project Settings → API Keys**, oppure il pulsante **Connect** in alto. Copia e tieni da parte:
   - il **Project URL**, per esempio `https://abcdxyz.supabase.co`;
   - la **Publishable key**, che inizia con `sb_publishable_`.

## Passo 3 · Fai arrivare i codici di accesso via email

Il servizio email incluso in Supabase manda i codici solo ai membri del progetto e al massimo 2 email all'ora: la persona che inviti non li riceverebbe. Si risolve collegando il tuo Gmail.

**3a · Password per le app di Google**

1. Vai su **myaccount.google.com** → **Sicurezza** e attiva la **Verifica in due passaggi**, se non è già attiva.
2. Vai su **myaccount.google.com/apppasswords**, scrivi il nome `Tablemates` e premi **Crea**.
3. Copia la password di 16 lettere che compare.

**3b · Collegala a Supabase**

1. In Supabase apri **Authentication → Emails → SMTP Settings** e attiva **Enable custom SMTP**.
2. Compila i campi:
   - Sender email: il tuo Gmail;
   - Sender name: `Tablemates`;
   - Host: `smtp.gmail.com`;
   - Port: `587`;
   - Username: il tuo Gmail;
   - Password: la password di 16 lettere.
3. Premi **Save changes**.

**3c · Fai mandare un codice invece di un link**

1. Apri **Authentication → Emails → Templates**.
2. Nei due modelli **Magic Link** e **Confirm sign up** sostituisci tutto il testo del messaggio con:

   ```html
   <h2>Il tuo codice Tablemates</h2>
   <p>Scrivi questo codice nell'app: <b>{{ .Token }}</b></p>
   ```

3. Salva entrambi. Il primo accesso di una persona nuova usa "Confirm sign up", gli accessi successivi usano "Magic Link".

## Passo 4 · Inserisci i dati del server nell'app

1. Apri con il Blocco note (su Mac, TextEdit in modalità testo semplice) il file `tablemates/config.js`.
2. Incolla tra gli apici il Project URL in `sbUrl` e la Publishable key in `sbKey`.
3. Salva.

Così chi riceve un invito entra senza configurare niente.

## Passo 5 · Pubblica l'app gratis su GitHub Pages

1. Vai su **github.com** e crea un account.
2. In alto a destra clicca **+ → New repository**. Nome: `tablemates`. Scegli **Public**, poi **Create repository**.
3. Nella pagina del repository clicca **uploading an existing file**.
4. Apri la cartella `tablemates` sul computer, seleziona **tutto quello che c'è dentro** (file e cartelle) e trascinalo nella pagina. Aspetta che finisca, poi premi **Commit changes**.
5. Vai in **Settings → Pages**. In **Source** scegli **Deploy from a branch**, poi Branch `main` e cartella `/ (root)`, e premi **Save**.
6. Dopo uno o due minuti, in cima alla stessa pagina compare l'indirizzo dell'app, per esempio `https://tuonome.github.io/tablemates/`.

## Passo 6 · Installa l'app

- **PC (Chrome o Edge):** apri l'indirizzo e clicca l'icona di installazione a destra nella barra degli indirizzi, oppure Impostazioni → **Installa Tablemates**.
- **Android:** apri l'indirizzo in Chrome, poi menu ⋮ → **Installa app**.
- **iPhone e iPad:** apri l'indirizzo in **Safari**, tocca Condividi → **Aggiungi alla schermata Home**.

## Passo 7 · Primo accesso, gruppo e invito

Sul telefono la barra in basso ha **Pasti**, **Spesa**, il **+** centrale (nuova spesa, prodotto alla lista, pasti, assistente), **Conti** e **Altro**. In **Altro** trovi **Assistente** e **Impostazioni**. Sul PC sono tutte nella barra a sinistra.

1. Apri l'app e scrivi il tuo nome.
2. Scrivi la tua email, premi **Invia codice** e inserisci il codice che ti arriva.
3. Crea il gruppo, per esempio "Casa Rossi". Nascono da soli i conti **Casa**, **Viaggi** ed **Extra**.
4. Vai in **Impostazioni → Invita nel gruppo** e manda il link alla persona, per esempio su WhatsApp.
5. Lei apre il link, scrive nome ed email, inserisce il codice e tocca **Aggiungi** con il suo nome.

Nei **Conti → Saldi** puoi aggiungere anche persone senza app, come un nonno o un coinquilino.

## Passo 8 · Intelligenza artificiale per tutto il gruppo (facoltativa)

Serve per leggere i PDF delle diete, proporre piatti e ricette e per l'Assistente.

**Lettura della dieta:** per i PDF dei piani "Nutribook" l'app legge giorni, pasti, alimenti, alternative e note direttamente nel telefono, senza intelligenza artificiale e senza chiave. Se il PDF ha un'altra impaginazione e c'è un'IA attiva, la lettura passa a lei. Il codice è in `js/lettore.js`. Ogni pasto è diviso negli slot fissi (Colazione, Spuntino mattina, Pranzo, Spuntino pomeriggio, Cena), ogni alimento è una riga con il tasto **Alternative** (la scelta vale solo per quel giorno) e dalla scheda si crea la lista della spesa con i totali (`js/dieta.js`). L'IA (Gemini consigliato) serve poi per piatti, ricette e Assistente.

1. Vai su **aistudio.google.com/apikey**, accedi con Google e premi **Create API key**. Ha un piano gratuito.
   - In alternativa gratuita c'è **Groq**: chiave su **console.groq.com/keys**. Groq non legge i PDF direttamente: l'app ne estrae il testo nel telefono, quindi funziona solo con PDF dove il testo si può selezionare (non con foto o scansioni).
2. Nell'app apri **Impostazioni → Intelligenza artificiale**: scegli **Google Gemini** e incolla la chiave.
3. Spunta **Condividi con tutto il gruppo** e premi **Salva**.

Chi entra con un invito usa questa intelligenza artificiale senza inserire nulla. Le persone del gruppo possono però vedere la chiave: condividila solo con chi ti fidi. Ognuno può comunque mettere una chiave sua, che sul suo dispositivo vale al posto di quella del gruppo.

## Passo 9 · Notifiche anche ad app chiusa (facoltativo)

Mentre l'app è aperta, gli avvisi su spese e pasti arrivano già. Per riceverli anche ad app chiusa:

1. Sul computer fai doppio clic su `tablemates/strumenti/chiavi-notifiche.html` e premi **Crea le chiavi**. Lascia la pagina aperta.
2. In Supabase apri **Edge Functions → Secrets** e aggiungi tre segreti:
   - `VAPID_PUBLIC_KEY`, con la chiave pubblica;
   - `VAPID_PRIVATE_KEY`, con la chiave privata;
   - `VAPID_SUBJECT`, con `mailto:` seguito dalla tua email, per esempio `mailto:ale@gmail.com`.
3. Apri **Edge Functions → Deploy a new function → Via Editor**.
4. Chiama la funzione esattamente `notifica`. Cancella il codice di esempio e incolla tutto il contenuto di `tablemates/supabase/functions/notifica/index.ts`, poi premi **Deploy function**.
5. In `config.js` incolla la chiave **pubblica** in `vapidPublic`.
6. Su GitHub apri `config.js`, clicca la matita, incolla il nuovo contenuto e premi **Commit changes**.
7. Riapri l'app un paio di volte per caricare l'aggiornamento. Poi ognuno va in **Impostazioni → Attiva le notifiche** e accetta.

Su iPhone le notifiche funzionano solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivo).

## Passo 10 · "Ehi Siri, cosa mangio?" (facoltativo, iPhone)

1. Apri l'app **Comandi** e tocca **+**.
2. Aggiungi l'azione **Dettatura testo**.
3. Aggiungi l'azione **URL** con `https://tuonome.github.io/tablemates/?chiedi=` seguito dalla variabile *Testo dettato*.
4. Aggiungi l'azione **Apri URL**.
5. Chiama il comando "Cosa mangio".

## Password, PIN e tema (dalla versione 7.0)

- **Password:** al primo accesso col codice l'app ti propone di sceglierne una (almeno 8 caratteri). Poi rientri con email e password. Se la dimentichi, tocca "Primo accesso o password dimenticata", entra con il codice e scegline una nuova in **Impostazioni → Account**.
- **PIN:** in **Impostazioni → Sicurezza → Imposta un PIN** (4 o 6 cifre). Ti viene chiesto quando riapri l'app e dopo il tempo che scegli. Dopo 5 errori i tasti si fermano per qualche secondo.
- **Face ID o impronta:** si attiva nella stessa sezione, se il telefono lo permette. Serve il PIN come alternativa.
- **PIN dimenticato:** tocca "PIN dimenticato", esci dall'account e rientri con la password. I dati sono sul server e non si perdono.
- **Tema:** **Impostazioni → Aspetto**: Automatico, Chiaro o Scuro.

Il PIN protegge l'app su quel telefono. Non sostituisce la password dell'account, che protegge i dati sul server.

## Come si usa

- **Pasti:** in alto scegli **Tutti** per vedere cosa mangia ognuno oggi, oppure il nome di una persona per vedere e modificare la sua dieta. Se chiami i giorni con i nomi della settimana (Lunedì, Martedì…), l'app ti mostra da sola quelli di oggi.
- **Spesa:** aggiungi i prodotti e spuntali al supermercato. Alla fine, **Registra lo scontrino nei conti** crea la spesa nel conto Casa.
- **Conti:** ogni spesa ha un conto e una voce, per esempio Casa · Utenze o Viaggi · Parigi 2026. Il saldo tra le persone è unico per tutti i conti. **Pareggia** ti dice chi deve dare cosa a chi.

## Aggiornare l'app

Quando modifichi un file, in `sw.js` aumenta il numero di `VERSIONE` (per esempio `tablemates-7.3`) e ricarica i file su GitHub. Sui dispositivi compare "Nuova versione disponibile → Aggiorna".

## Problemi comuni

- **Non arriva il codice:** controlla lo spam e ricontrolla il Passo 3. Le impostazioni predefinite di Supabase permettono una nuova richiesta ogni 60 secondi.
- **"Email address not authorized":** il Passo 3b non è attivo.
- **L'app non si apre più:** con il piano gratuito, Supabase mette in pausa un progetto dopo 7 giorni senza attività. Apri supabase.com, scegli il progetto e premi **Resume project**. Usando l'app ogni giorno non succede.
- **Errore dell'intelligenza artificiale sul modello:** i nomi dei modelli sono in `js/ai.js` (`gemini-2.5-flash`, `llama-4-scout` e `llama-3.3-70b` per Groq, `gpt-4o-mini`, `claude-sonnet-4-5`) e col tempo possono cambiare.

## Cosa c'è nel pacchetto

| File o cartella | A cosa serve |
| --- | --- |
| `index.html`, `app.css`, `js/` | l'app |
| `config.js` | i dati del tuo server |
| `sw.js`, `manifest.webmanifest`, `icons/` | installazione e uso senza rete |
| `supabase/schema.sql` | il database |
| `supabase/functions/notifica/` | la funzione delle notifiche |
| `strumenti/chiavi-notifiche.html` | crea le chiavi delle notifiche |
| `strumenti/crea_anteprima.py` | crea la versione dimostrativa |

## Novità della versione 9

- **Nuovo aspetto** (logo con il tavolo e le quattro persone, carattere Manrope, colori verde e zafferano), uguale in chiaro e in scuro.
- **Schede**: Oggi, Piano, Spesa, Conti, Gruppo. Impostazioni dall'ingranaggio di Gruppo, Assistente da Oggi.
- **Oggi**: prossimo pasto con le quantità, idea di piatto, "A tavola stasera? Ci sono / Salto", spesa e conti in breve.
- **A tavola**: chi mangia a casa a pranzo e a cena per 7 giorni; ognuno risponde per sé.
- **Piano**: giorni L–D, pasti a fisarmonica, "Fatto", alternative a pillola ("Puoi sostituire con"), note del nutrizionista.
- **Editor del piano**: alimenti, quantità, misure e alternative modificabili a mano.
- **Controllo prima di salvare**: dopo ogni lettura di un PDF si apre l'editor per verificare. I PDF di altri formati li legge l'IA (se attiva) o, senza IA, il lettore del testo (meno preciso).
- **Ricetta a schermo intero** con ingredienti "In casa / Da comprare", "Metti i mancanti in spesa", ricette salvate e **Modalità cucina** (un passo alla volta, timer, schermo acceso, comandi a voce dove il telefono li supporta).
- **Spesa + Dispensa**: livelli di quanto resta, "stanno finendo → in lista", la Dispensa si riempie quando spunti un prodotto.
- **Conti**: "Giulia ti deve", Segna saldato, Ricordaglielo (messaggio da mandare), speso nel mese, la tua parte, ultimi movimenti; saldi, statistiche e conti restano a un tocco.

## Novità della versione 9.3
- Intro rifatta: logo più grande, le persone (spalle e testa insieme) si siedono una alla volta in senso orario con un piccolo rimbalzo, poi "Table" e "mates" entrano a bolla.
- Groq di nuovo funzionante: Groq ha ritirato Llama 4 Scout e Llama 3.3 (luglio-agosto 2026); ora l'app usa GPT-OSS 120B, GPT-OSS 20B e Qwen 3.8.
- Ricetta base senza IA: "Proponi un piatto" e "Proponi i piatti del giorno" funzionano sempre, con gli alimenti e le grammature del piano (anche modalità cucina, timer e spesa). Se l'IA non risponde compare "Usa la ricetta base".
- La chiave IA resta salvata (sul telefono e nel tuo account): si vede mascherata, con Modifica ed Elimina.
- Scorri da destra a sinistra per eliminare (lista della spesa, dispensa, conti): cestino bianco su fondo rosso, con Annulla.
- Inviti: se config.js è vuoto, il link porta con sé il server, così chi lo apre non deve inserire URL.

## Novità della versione 9.2
- Intro all'apertura: il tavolo si compone, arrivano le persone, poi compare "Table" e dopo "mates" (si salta con un tocco; una volta per apertura).
- Oggi: i pasti si scorrono avanti e indietro (dito, frecce o barre in alto); parte dal prossimo pasto.
- "Proponi un piatto" apre subito la ricetta; se l'IA non risponde compare il motivo.
- Gemini: nuovi modelli e messaggio chiaro quando chiede crediti (in quel caso usa Groq, gratuito).

## Novità della versione 9.1

- **Amministratori**: chi crea il gruppo è Admin; può nominare altri amministratori ("+ Aggiungi amministratore del gruppo"), togliere persone, rinominare il gruppo e cambiarne la valuta. Il controllo è fatto dall'app.
- **Notifiche attive per tutti**: al primo avvio l'app chiede il permesso (il telefono vuole un tocco). Ognuno spegne i tipi che non vuole in Impostazioni → Notifiche, e il server rispetta la scelta.
- **Ricordaglielo**: manda una notifica solo a chi deve i soldi; se non la può ricevere (non usa l'app o l'ha spenta) l'app prepara un messaggio da inviare.
- **Ci sei a cena?**: notifica ogni giorno alle 17 a chi non ha ancora risposto, sia ad app chiusa sia aperta (`supabase/promemoria.sql`).
- **Pasti**: niente più "Fatto": ogni pasto resta visibile con orario e alimenti.
