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

8. Per **"Ci sei a cena?"** alle 17 e per i **promemoria dell'agenda**: in **Edge Functions → Secrets** aggiungi `CRON_SECRET` (una parola segreta a tua scelta), poi in **SQL Editor** incolla `tablemates/supabase/promemoria.sql`, sostituisci `IL_TUO_PROGETTO`, `IL_TUO_SEGRETO` e `LA_TUA_CHIAVE` (la chiave publishable di `config.js`) e premi **Run**. Così il server controlla l'agenda ogni 5 minuti. Con la chiave nel SQL, la spunta *Verify JWT* sulla funzione `notifica` può restare attiva.
9. Controllo: nell'app, in fondo all'**Agenda**, il riquadro **Promemoria** dice se le notifiche del telefono sono attive e quando il server ha controllato l'agenda l'ultima volta. **Manda una prova** ti fa arrivare subito una notifica.

Su iPhone le notifiche funzionano solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivo).

## Passo 9 bis · Intelligenza artificiale per tutti, senza chiavi (consigliato)

Con questo passo l'app crea piatti e ricette e importa ricette dai link senza che nessuno inserisca chiavi. La chiave Groq resta solo sul tuo server ed è gratuita.

1. Vai su **console.groq.com/keys**, accedi e premi **Create API Key**. Copia la chiave (inizia con `gsk_`).
2. In Supabase apri **Edge Functions → Secrets** e aggiungi il segreto `GROQ_API_KEY` con quella chiave.
3. Apri **Edge Functions → Deploy a new function → Via Editor**.
4. Chiama la funzione esattamente `cucina`. Cancella il codice di esempio, incolla tutto il contenuto di `tablemates/supabase/functions/cucina/index.ts` e premi **Deploy function**.
5. Nella funzione `cucina` apri **Details** (o Settings), lascia **spuntata** *Verify JWT with legacy secret*: `cucina` la chiama solo l'app, con la sessione dell'utente, quindi il controllo in più non dà problemi (la funzione verifica comunque l'utente da sola).
6. Riapri l'app: in **Impostazioni → Intelligenza artificiale** compare "Tablemates (server)".

Ogni persona può fare al massimo 10 richieste al minuto e 120 all'ora: è un limite di sicurezza per non consumare la quota gratuita di Groq.

## Passo 10 · Calendario dell'iPhone e Siri (facoltativo)

Con la funzione `collega` l'agenda di Tablemates compare nel Calendario del telefono, con gli avvisi, e Siri può rispondere e aggiungere cose.

1. In Supabase apri **Edge Functions → Deploy a new function → Via Editor**.
2. Chiama la funzione esattamente `collega`. Incolla tutto il contenuto di `tablemates/supabase/functions/collega/index.ts` e premi **Deploy function**.
3. Nella funzione `collega` apri **Details** e **togli la spunta** *Verify JWT* (o *Verify JWT with legacy secret*), poi salva. Il Calendario dell'iPhone e i Comandi Rapidi non possono mandare l'accesso dell'app: il controllo lo fa il codice segreto del link personale.
4. Nell'app: **Impostazioni → Calendario e Siri → Calendario del telefono → Crea il mio link → Aggiungi al calendario**, poi **Iscriviti**. Su Google Calendar: **Copia il link** e in Google Calendar *Altri calendari → Da URL*.

Il calendario si aggiorna da solo (l'iPhone lo rilegge ogni tanto, di solito entro un'ora). Quello che aggiungi direttamente nel Calendario dell'iPhone non torna in Tablemates: gli appuntamenti si aggiungono dall'app o con Siri.

**Siri (app Comandi Rapidi):** per ogni comando crea un nuovo comando con l'azione **Ottieni contenuti dell'URL** (il link lo copi da **Impostazioni → Calendario e Siri → Siri e Comandi Rapidi**), poi **Pronuncia testo** con il risultato. Il nome del comando è la frase da dire.

| Frase per Siri | Cosa fa | Cosa aggiungere al link |
| --- | --- | --- |
| "Cosa mangio" | Prossimi pasti di oggi e agenda | `&a=oggi` (oppure `&a=oggi&q=cena`) |
| "Cosa mangio domani" | Pasti e impegni di domani | `&a=domani` |
| "Aggiungi alla spesa" | Aggiunge uno o più prodotti | `&a=spesa&testo=` + la risposta di **Chiedi testo** |
| "Cosa devo comprare" | Legge la lista della spesa | `&a=lista` |
| "Nuovo appuntamento" | Lo aggiunge all'agenda del gruppo | `&a=appuntamento&titolo=…&data=AAAA-MM-GG&ora=HH:MM` (con **Chiedi data e ora** e **Formatta data**) |
| "Ho pagato" | Spesa pagata da te, divisa in parti uguali | `&a=pagato&titolo=…&importo=24,50` |

Il link personale non va mandato ad altri. Se pensi che l'abbia qualcun altro, in **Calendario e Siri** tocca **Crea un nuovo link**: il vecchio smette di funzionare.

## Passo 11 · Un indirizzo tuo al posto di github.io (facoltativo)

GitHub Pages può usare un dominio tuo (per esempio `tablemates.it` o `app.tuodominio.it`). Serve comprare il dominio da un registrar (Aruba, Register.it, Namecheap, Cloudflare…).

1. Su GitHub apri il repository → **Settings → Pages → Custom domain**, scrivi il dominio (es. `app.tuodominio.it`) e premi **Save**.
2. Dal pannello DNS del registrar:
   - per un sottodominio (`app.tuodominio.it` o `www.tuodominio.it`): record **CNAME** con nome `app` (o `www`) che punta a `tuonome.github.io`;
   - per il dominio "nudo" (`tuodominio.it`): quattro record **A** con nome `@` verso `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Quando il DNS è attivo (da pochi minuti a qualche ora) torna in **Settings → Pages** e spunta **Enforce HTTPS** (può comparire anche dopo 24 ore).
4. In Supabase: **Authentication → URL Configuration** → metti il nuovo indirizzo in **Site URL** e aggiungilo in **Redirect URLs**.
5. Sul telefono apri il nuovo indirizzo, accedi e **aggiungilo di nuovo alla schermata Home** (puoi togliere la vecchia icona).

Cambiando indirizzo, il telefono lo considera un'app nuova: vanno rifatti l'accesso, il PIN/Face ID e l'attivazione delle notifiche, e va ricreato il collegamento del calendario. I dati del gruppo restano sul server e non si perdono. Anche i link di invito usano il nuovo indirizzo da soli.

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

Quando modifichi un file, in `sw.js` aumenta il numero di `VERSIONE` (per esempio `tablemates-10.1`) e ricarica i file su GitHub. All'apertura successiva l'app scarica la nuova versione in sottofondo e si ricarica da sola.

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
| `supabase/functions/cucina/` | la funzione dell'intelligenza artificiale (Groq) e dell'importazione di ricette da un link |
| `supabase/functions/collega/` | calendario del telefono e Siri |
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

## Novità della versione 10.0
- **Oggi è una dashboard**: i pasti del giorno in breve (tocca un pasto per vedere quantità e idee), pranzo e cena "A tavola", l'agenda del giorno, spesa e conti. Con le frecce, scorrendo col dito o toccando la data passi agli altri giorni.
- **Agenda**: un appuntamento può finire dopo mezzanotte (20:00–01:30 finisce il giorno dopo). In fondo all'agenda c'è il controllo dei promemoria: notifiche del telefono, ultimo controllo del server e **Manda una prova**.
- **Calendario del telefono e Siri** (Passo 10): l'agenda nel Calendario dell'iPhone con gli avvisi, e comandi per Siri (cosa mangio, aggiungi alla spesa, nuovo appuntamento, ho pagato).
- **Emoji**: tutte le nazioni e le città principali hanno la bandiera (Andorra 🇦🇩, Londra 🇬🇧, Barcellona 🇪🇸…). L'app conosce tutte le emoji con i nomi in italiano. Ogni emoji si può cambiare: tocca l'emoji nel modulo della spesa, del conto, dell'appuntamento, oppure accanto a un alimento o a un pasto. Puoi sceglierla solo per quella voce o "ogni volta che scrivo…".
- **Statistiche**: torta "Dove si spende di più", con percentuali e colori diversi, per questo mese, gli ultimi 12 mesi o sempre.
- **Foto**: foto del gruppo (tocca il logo nella scheda Gruppo) e foto del profilo (Gruppo → ⋯ accanto al tuo nome → Foto del profilo).
- **Senza rete**: l'app si apre anche offline e le modifiche restano sul telefono; appena torna la connessione partono da sole.
- **Più veloce**: l'app si apre dalla copia sul telefono e disegna solo la scheda che stai guardando. Niente barra di scorrimento laterale. Il nome con cui entri resta salvato, quindi non viene più chiesto "Chi sei?" a ogni apertura.
- Intro: la scritta è **TableMates**.
- Server: aggiorna la funzione `notifica` (Passo 9, punto 4) e pubblica `collega` (Passo 10).

## Novità della versione 9.9
- **Emoji automatiche, come in Tricount**: dalla parola scritta l'app sceglie un'emoji, senza che tu debba fare nulla. Compaiono accanto ai pasti (🥐 colazione, 🍝 pranzo, 🍽️ cena), agli alimenti del piano e della ricetta (🍗 pollo, 🥔 patate, 🍚 riso), ai prodotti della spesa e ai loro reparti, alle spese in Conti (🏠 affitto, 💡 luce, ⛽ benzina, ✈️ volo), ai conti stessi (🏖️ Viareggio, 🇭🇺 Budapest) e agli appuntamenti e scadenze dell'Agenda (🦷 dentista, 🎂 compleanno, 🏦 mutuo). Se la parola non è riconosciuta, c'è un'emoji di riserva adatta alla scheda.
- Valgono anche per i dati già inseriti: l'emoji si ricava dal testo e non viene salvata.

## Novità della versione 9.8
- **Intro anche con "Riduci movimento"**: se sull'iPhone è attivo (Impostazioni → Accessibilità → Movimento), l'app mostrava solo il logo fermo e passava subito oltre. Ora l'animazione parte sempre; un tocco la salta. Il resto dell'app continua a rispettare l'impostazione.

## Novità della versione 9.7
- **Intro**: parte a ogni apertura dell'app (prima partiva una sola volta per sessione, e su iPhone l'app resta spesso in memoria).
- **App ferma come un'app vera**: niente zoom con il pizzico o il doppio tocco, niente spostamenti laterali della pagina, i campi di testo non ingrandiscono più lo schermo quando ci scrivi.
- **Aggiornamenti senza errori strani**: l'app prende sempre i file più recenti e si aggiorna da sola alla prima apertura dopo un caricamento su GitHub. Gli errori tecnici (come "TypeError") non compaiono più a schermo. La causa più probabile era un mix tra file vecchi e nuovi dopo un aggiornamento.

## Novità della versione 9.6
- **Mangiamo insieme**: in Oggi, sotto il pasto, tocca "Mangiamo insieme…", scegli il giorno e con chi. Lo stesso piatto compare nel pasto di tutti, con le dosi adattate alle grammature del piano di ognuno (chi non ha quell'alimento nel piano, o non ha una dieta, ha la stessa porzione). I piani non cambiano: vale solo per quel pasto e quel giorno.
- Gli altri ricevono una notifica e vedono "Mangi insieme a …" nel loro pasto. Chi non può più venire tocca "Non mangio insieme": se resta una sola persona, o se esce chi ha proposto, il pasto torna normale per tutti.
- I prossimi giorni in cui mangi insieme a qualcuno compaiono in Oggi, nel riquadro "Mangiamo insieme".

## Novità della versione 9.5
- **Agenda** (nuova scheda): appuntamenti comuni o personali (giorno, dalle–alle, dove, per chi) e scadenze (mutuo, affitto, luce, gas, acqua, internet… con importo). Si ripetono ogni settimana, mese o anno. Le scadenze si segnano pagate (una rata alla volta) e si possono registrare nei Conti con un tocco. Scorri a sinistra per eliminare. In Oggi compaiono gli impegni di oggi e le scadenze dei prossimi 3 giorni che ti riguardano.
- **Promemoria dell'agenda** come notifica sul telefono, anche ad app chiusa: a tutto il gruppo o solo alle persone scelte, all'orario scelto (15 minuti prima, 1 ora prima, il giorno prima…; per le scadenze alle 9 del giorno scelto). Si spengono da Impostazioni → Notifiche → Agenda. Serve aggiornare la funzione `notifica` ed eseguire di nuovo `supabase/promemoria.sql` (ora gira ogni 5 minuti).
- **Piatto condiviso**: nella ricetta di un pasto scegli "Chi mangia questo piatto". Le dosi si sommano con le grammature della dieta di ognuno (chi non ha quell'alimento nel piano, o non ha una dieta, ha la stessa porzione); ricetta base, modalità cucina e spesa usano i totali.
- Intro: ora si vede sempre all'avvio. PIN e Face ID aspettano la fine dell'intro; se riapri l'app dopo almeno 10 minuti l'intro riparte.

## Novità della versione 9.4
- Intelligenza artificiale dal tuo server (funzione `cucina` con la chiave Groq come segreto): nessuno deve più inserire chiavi e la chiave non è visibile a chi è nel gruppo. Una chiave personale, se c'è, ha la precedenza.
- **Ricetta da un link**: incolli il link di una ricetta (GialloZafferano, Fatto in casa da Benedetta, Chef in camicia…) e l'app la importa; per un pasto del piano adatta le dosi alle tue grammature (con l'IA, oppure da sola per gli ingredienti che corrispondono). Resta sempre il collegamento alla ricetta originale. Le ricette scelte da te vanno nel ricettario personale (Piano → Ricette salvate).
- Su Android puoi anche usare **Condividi → Tablemates** da Chrome o dall'app del sito.

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
