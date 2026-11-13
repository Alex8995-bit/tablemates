# Tablemates

Pasti, lista della spesa e conti condivisi per famiglie, coppie e coinquilini.
Un'app web installabile su iPhone, Android e PC, senza App Store.

## Cosa fa

- **Pasti** – carichi il PDF della dieta e l'IA legge giorni, pasti e alternative. Ognuno può avere il proprio pasto. Ricette per ogni piatto, oppure ricerca e link salvati se non usi l'IA.
- **Spesa** – lista condivisa in tempo reale, con reparti, quantità e spunta "preso". Lo scontrino si registra nei conti con un tocco.
- **Conti** – divisione delle spese come Tricount (parti uguali, quote o importi), un unico saldo con più conti (Casa, Viaggi, Extra), rimborsi suggeriti e statistiche.
- **Assistente** – chiedi cosa mangiare oggi o cosa manca in casa. Su iPhone puoi usare Siri.
- **Gruppi** – accesso con email e codice, inviti con un link, notifiche quando qualcuno aggiunge una spesa o un pasto.

## Tecnologie

HTML, CSS e JavaScript senza build. Supabase per database, accesso e tempo reale, una Edge Function per le notifiche push, GitHub Pages per la pubblicazione. Funziona anche offline.

## Costo

Zero, con i piani gratuiti di Supabase, GitHub e Gmail.

## Note

- Il progetto gratuito di Supabase si mette in pausa dopo 7 giorni senza uso: basta riattivarlo.
- La chiave IA (per esempio Gemini) è facoltativa e si inserisce nelle Impostazioni.
- Foto e collegamento a Drive non sono implementati.
