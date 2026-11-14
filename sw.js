// Service worker di Tablemates: apre l'app anche senza rete, la aggiorna e mostra le notifiche ad app chiusa.
// Quando cambi i file, aumenta il numero di VERSIONE: i dispositivi scaricheranno la nuova versione.
const VERSIONE = 'tablemates-10.1';
const FILE = [
  './', 'index.html', 'app.css', 'config.js', 'manifest.webmanifest',
  'supabase.js', 'pdf.min.js', 'pdf.worker.min.js', 'manrope-latin-wght-normal.woff2', 'manrope-latin-ext-wght-normal.woff2',
  'util.js', 'icone.js', 'emoji.js', 'emoji-dati.js', 'sicurezza.js', 'conti-calc.js', 'store.js', 'ai.js', 'lettore.js', 'notifiche.js', 'oggi.js', 'insieme.js', 'piano.js', 'dieta.js', 'cuoco.js', 'scorri.js', 'agenda.js', 'ricetta.js', 'spesa.js', 'conti.js', 'chat.js', 'gruppo.js', 'imp.js', 'app.js',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'aggiorna') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // server, IA e cambi valuta: sempre dalla rete
  // L'app si apre dalla copia sul telefono: subito, anche senza rete. Gli aggiornamenti arrivano tutti insieme
  // con una nuova VERSIONE (si scaricano in sottofondo e l'app si ricarica da sola), così file vecchi e nuovi non si mescolano.
  if (r.mode === 'navigate') {
    e.respondWith(caches.open(VERSIONE).then(c => c.match('index.html')).then(hit => hit || fetch(r)).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(VERSIONE).then(c => c.match(r, { ignoreSearch: true })).then(hit => hit || fetch(r).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSIONE).then(x => x.put(r, copia)); }
    return res;
  })));
});
// Notifica arrivata dal server (funzione "notifica" su Supabase)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { titolo: 'Tablemates', testo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => {
    // app aperta davanti: gli avvisi normali compaiono già dentro l'app; promemoria e messaggi personali si mostrano sempre
    if (!d.sempre && cl.some(c => c.visibilityState === 'visible')) return;
    return self.registration.showNotification(d.titolo || 'Tablemates', {
      body: d.testo || '', icon: 'icon-192.png', badge: 'favicon-32.png', tag: d.tag || 'tablemates', renotify: true, data: { scheda: d.scheda || '' }
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const scheda = (e.notification.data && e.notification.data.scheda) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => {
    const c = cl.find(x => 'focus' in x);
    if (c) { c.postMessage({ scheda }); return c.focus(); }
    return self.clients.openWindow('./' + (scheda ? '?scheda=' + scheda : ''));
  }));
});
