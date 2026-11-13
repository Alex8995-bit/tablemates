// Avvio, accesso, gruppi, sincronizzazione in tempo reale, avvisi e dati salvati per l'uso offline.
let ST = null, UTENTE = null, G = null, live = false;
const VUOTO_D = () => ({ stato: {}, spesa: [], partecipanti: [], conti: [], movimenti: [] });
let D = VUOTO_D();
let CHI = SS.get('chi'), IO = null;

function renderNav() {
  const voci = { piano: ['piano', 'Pasti'], spesa: ['carrello', 'Spesa'], conti: ['portafoglio', 'Conti'], chat: ['chat', 'Assistente'], imp: ['regola', 'Impostazioni'] };
  document.querySelectorAll('nav.sezioni button[data-t]').forEach(b => { const [i, n] = voci[b.dataset.t]; b.innerHTML = ic(i, 22) + `<span>${n}</span>`; });
  $('navPiu').innerHTML = ic('piu', 24, 2.4);
  $('navAltro').innerHTML = ic('altro', 22, 2.6) + '<span>Altro</span>';
  $('navMarchio').innerHTML = marchioCompleto(32);
  const io = IO ? D.partecipanti.find(p => p.id === IO) : null;
  $('navIo').innerHTML = io ? `${avatar(io, idxP(IO))}<span style="display:flex;flex-direction:column"><span>${esc(io.nome)}</span><span class="by">${ST && ST.modo === 'supabase' ? (live ? 'Sincronizzato' : 'Non collegato') : 'Solo su questo dispositivo'}</span></span>` : '';
}
// "+" centrale: le aggiunte più frequenti in un tocco
function menuAggiungi() {
  if (!G) return toast('Prima accedi e scegli un gruppo');
  const voce = (k, icona, t, s, bg, fg) => `<button type="button" data-ma="${k}"><span class="tile" style="background:${bg};color:${fg}">${ic(icona, 20)}</span><span class="t"><b>${t}</b><small>${s}</small></span>${ic('destra', 18)}</button>`;
  foglio(`<h2>Aggiungi</h2><div class="menu-rapido">
    ${voce('spesa', 'portafoglio', 'Nuova spesa', 'Nei conti, divisa tra le persone', TONI.verde[0], TONI.verde[1])}
    ${voce('lista', 'carrello', 'Prodotto alla lista', 'Nella lista della spesa condivisa', TONI.giallo[0], TONI.giallo[1])}
    ${voce('pasto', 'piano', 'Pasti di oggi', 'Vedi o inserisci il tuo pasto', TONI.arancio[0], TONI.arancio[1])}
    ${voce('chiedi', 'scintille', 'Chiedi all\'assistente', 'Cosa mangio oggi? Cosa manca?', TONI.blu[0], TONI.blu[1])}</div>`);
  $('pop').querySelectorAll('[data-ma]').forEach(b => b.onclick = () => {
    const k = b.dataset.ma; chiudi();
    if (k === 'spesa') { vai('conti'); formMovimento(null, filtroConto ? { conto_id: filtroConto, categoria: filtroVoce } : {}); }
    else if (k === 'lista') { vai('spesa'); setTimeout(() => $('nv') && $('nv').focus(), 50); }
    else if (k === 'pasto') vai('piano');
    else vai('chat');
  });
}
// "Altro" sul telefono: Assistente, Impostazioni, cambio gruppo
function menuAltro() {
  const voce = (k, icona, t, s) => `<button type="button" data-mo="${k}"><span class="tile" style="background:var(--field);color:var(--tx)">${ic(icona, 20)}</span><span class="t"><b>${t}</b><small>${s}</small></span>${ic('destra', 18)}</button>`;
  foglio(`<h2>Altro</h2><div class="menu-rapido">
    ${voce('chat', 'scintille', 'Assistente', 'Chiedi cosa mangiare, ricette e spese')}
    ${voce('imp', 'regola', 'Impostazioni', 'Gruppo, inviti, IA, notifiche, dieta')}
    ${G && ST ? voce('gruppi', 'utenti', 'Cambia gruppo', 'Ora sei in ' + esc(G.nome)) : ''}</div>`);
  $('pop').querySelectorAll('[data-mo]').forEach(b => b.onclick = async () => {
    const k = b.dataset.mo; chiudi();
    if (k === 'gruppi') { try { schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); } }
    else vai(k);
  });
}
function renderTutto() { renderNav(); renderPiano(); renderSpesa(); renderConti(); renderChat(); renderImp(); }
const nomeP = id => (D.partecipanti.find(p => p.id === id) || {}).nome || '?';

// Copia degli ultimi dati per aprire l'app anche senza rete (senza foto, per stare nello spazio del telefono)
function snap() { if (G && ST && ST.modo === 'supabase') LS.setJ('snap_' + G.id, { ...D, movimenti: D.movimenti.map(m => { const c = { ...m }; delete c.foto; return c; }) }); }
async function scrivi(fn, errore) {
  if (!navigator.onLine && ST.modo === 'supabase') { toast('Sei offline: modifica non salvata'); await ricarica(); return false; }
  try { await fn(); snap(); return true; }
  catch (e) { toast((errore || 'Non salvato') + ': ' + e.message); await ricarica(); return false; }
}
async function ricarica() {
  if (!G) return;
  try { D = Object.assign(VUOTO_D(), await ST.carica(G.id)); snap(); $('offline').hidden = navigator.onLine; }
  catch (e) { const s = LS.getJ('snap_' + G.id, null); if (s) D = Object.assign(VUOTO_D(), s); $('offline').hidden = false; }
  trovaIO(); renderTutto();
}
function trovaIO() { const mio = UTENTE && D.partecipanti.find(p => p.user_id === UTENTE.id); IO = mio ? mio.id : null; }

// ---------- Schermate di accesso ----------
function schermo(html) {
  $('pop').innerHTML = `<div class="full"><div class="in"><div class="marchio">${marchioCompleto(40)}</div>${html}</div></div>`;
}
function benvenuto() {
  schermo(`<h1>Benvenuto</h1><p class="q" style="margin:4px 0 10px;line-height:1.5">${NOME_APP} tiene insieme pasti, lista della spesa e conti di casa, per famiglie e coinquilini. Per condividerli collega il tuo server Supabase, oppure prova l'app solo su questo dispositivo.</p>
   <label class="lb" for="bU">Supabase · Project URL</label><input id="bU" placeholder="https://xxxx.supabase.co" autocomplete="off" style="background:var(--card)">
   <label class="lb" for="bK">Supabase · chiave publishable</label><input id="bK" placeholder="sb_publishable_…" autocomplete="off" style="background:var(--card)">
   <button class="btn" id="bS" type="button" style="margin-top:8px">Collega e continua</button>
   <button class="btn ghost" id="bL" type="button">Usa solo su questo dispositivo</button>`);
  $('bS').onclick = () => { const u = $('bU').value.trim(), k = $('bK').value.trim(); if (!u || !k) return toast('Inserisci URL e chiave'); LS.set('sbUrl', u); LS.set('sbKey', k); LS.del('modo'); avvio(); };
  $('bL').onclick = () => { LS.set('modo', 'locale'); avvio(); };
}
function chiSei() {
  return new Promise(ok => {
    const nomi = LS.getJ('nomi', []);
    schermo(`<h1>Chi sei?</h1><p class="q" style="margin:4px 0 10px">Le tue modifiche saranno firmate con questo nome.</p>
      ${nomi.map(n => `<button class="btn ghost" type="button" data-n="${esc(n)}">${esc(n)}</button>`).join('')}
      <input id="chiNome" placeholder="Il tuo nome" autocomplete="given-name" style="background:var(--card)"><button class="btn" id="entra" type="button">Entra</button>`);
    const entra = n => {
      n = (n || '').trim(); if (!n) return;
      CHI = n; SS.set('chi', n);
      if (!nomi.includes(n)) { nomi.push(n); LS.setJ('nomi', nomi); }
      chiudi(); ok();
    };
    $('pop').querySelectorAll('[data-n]').forEach(b => b.onclick = () => entra(b.dataset.n));
    $('entra').onclick = () => entra($('chiNome').value);
    $('chiNome').onkeydown = e => { if (e.key === 'Enter') entra($('chiNome').value); };
  });
}
function loginEmail() {
  return new Promise(ok => {
    let modo = LS.get('pw') ? 'pw' : 'codice', fase = 1;
    const disegna = () => {
      const em = $('lgE') ? $('lgE').value : LS.get('email');
      if (modo === 'pw') schermo(`<h1>Accedi</h1><p class="q" style="margin:4px 0 10px">Entra con la tua email e la tua password.</p>
        <input id="lgE" type="email" placeholder="La tua email" autocomplete="username" value="${esc(em)}" style="background:var(--card)">
        <input id="lgP" type="password" placeholder="Password" autocomplete="current-password" style="background:var(--card)">
        <button class="btn" id="lgB" type="button">Entra</button>
        <button class="btn ghost" id="lgM" type="button">Primo accesso o password dimenticata: ricevi un codice</button>
        <button class="btn bordo" id="lgX" type="button">Cambia server o usa senza account</button>`);
      else schermo(`<h1>Accedi</h1><p class="q" style="margin:4px 0 10px" id="lgT">${fase === 1 ? 'Inserisci la tua email: ti mandiamo un codice.' : 'Controlla la posta e scrivi il codice.'}</p>
        <input id="lgE" type="email" placeholder="La tua email" autocomplete="email" value="${esc(em)}" style="background:var(--card)">
        <input id="lgC" ${fase === 1 ? 'hidden' : ''} inputmode="numeric" autocomplete="one-time-code" placeholder="Codice ricevuto via email" style="background:var(--card)">
        <button class="btn" id="lgB" type="button">${fase === 1 ? 'Invia codice' : 'Entra'}</button>
        <button class="btn ghost" id="lgM" type="button">Ho già una password</button>
        <button class="btn bordo" id="lgX" type="button">Cambia server o usa senza account</button>`);
      $('lgX').onclick = () => { LS.del('sbUrl'); LS.del('sbKey'); benvenuto(); };
      $('lgM').onclick = () => { modo = modo === 'pw' ? 'codice' : 'pw'; fase = 1; disegna(); };
      $("lgB").onclick = procedi;
      const invio = e => { if (e.key === "Enter") procedi(); };
      ['lgE', 'lgP', 'lgC'].forEach(i => { if ($(i)) $(i).onkeydown = invio; });
    };
    const procedi = async () => {
      const em = $('lgE').value.trim().toLowerCase(); if (!em) return;
      $('lgB').disabled = true;
      try {
        if (modo === 'pw') {
          const pw = $('lgP').value; if (!pw) { $('lgB').disabled = false; return toast('Scrivi la password'); }
          try { await ST.accedi(em, pw); } catch (e) { throw new Error(/invalid|credentials/i.test(e.message) ? 'Email o password non corrette' : e.message); }
          LS.set('email', em); chiudi(); ok('pw'); return;
        }
        if (fase === 1) {
          await ST.inviaCodice(em); LS.set('email', em); fase = 2;
          $('lgC').hidden = false; $('lgC').focus();
          $('lgT').textContent = 'Controlla la posta e scrivi il codice.'; $('lgB').textContent = 'Entra';
        } else {
          try { await ST.verifica(em, $('lgC').value.trim()); } catch (e) { throw new Error('Codice non valido'); }
          chiudi(); ok('codice'); return;
        }
      } catch (e) { toast(e.message); }
      if ($('lgB')) $('lgB').disabled = false;
    };
    disegna();
  });
}
async function scegliGruppo() {
  const inv = SS.get('invito');
  if (inv) {
    SS.del('invito');
    try { const id = await ST.unisciti(inv, CHI); const g = (await ST.gruppi()).find(x => x.id === id); toast('Sei entrato in ' + g.nome + ' ✓'); return apriGruppo(g); }
    catch (e) { toast(e.message); }
  }
  let gr = [];
  try { gr = await ST.gruppi(); }
  catch (e) {
    const id = LS.get('gruppo'), s = LS.getJ('snap_' + id, null);
    if (id && s) { G = { id, nome: LS.get('gnome'), valuta: LS.get('gvaluta') || 'EUR' }; D = Object.assign(VUOTO_D(), s); trovaIO(); renderTutto(); $('offline').hidden = false; return; }
    toast('Connessione non riuscita: ' + e.message);
  }
  const g = gr.find(x => x.id === LS.get('gruppo'));
  if (g) return apriGruppo(g);
  schermataGruppi(gr);
}
function schermataGruppi(gr) {
  schermo(`<h1>I tuoi gruppi</h1><p class="q" style="margin:4px 0 10px;line-height:1.5">Un gruppo è la tua casa: famiglia o coinquilini. Ognuno ha pasti, spesa e conti propri${ST.modo === 'supabase' ? '. Se ti hanno invitato, apri il link che ti hanno mandato' : ''}.</p>
    ${gr.map(g => `<button class="btn bordo" type="button" data-g="${g.id}" style="justify-content:flex-start"><span class="logo" style="width:30px;height:30px;font-size:13px;font-weight:800">${esc(g.nome[0].toUpperCase())}</span>${esc(g.nome)}</button>`).join('')}
    <label class="lb" for="gN" style="margin-top:14px">Nuovo gruppo</label><input id="gN" placeholder="Nome, es. Casa Rossi o Via Roma 12" style="background:var(--card)">
    <label class="lb" for="gV">Valuta dei conti</label><select id="gV" style="background:var(--card)">${Conti.VALUTE.map(v => `<option ${v === 'EUR' ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <button class="btn" id="gC" type="button" style="margin-top:8px">Crea gruppo</button>`);
  $('pop').querySelectorAll('[data-g]').forEach(b => b.onclick = () => apriGruppo(gr.find(x => x.id === b.dataset.g)));
  $('gC').onclick = async () => {
    const n = $('gN').value.trim(); if (!n) return toast('Dai un nome al gruppo');
    try { const id = await ST.creaGruppo(n, $('gV').value, CHI); apriGruppo({ id, nome: n, valuta: $('gV').value }); toast('Gruppo creato: invita qualcuno da Impostazioni'); }
    catch (e) { toast(e.message); }
  };
}
async function apriGruppo(g) {
  G = g; LS.set('gruppo', g.id); LS.set('gnome', g.nome); LS.set('gvaluta', g.valuta || 'EUR');
  chiudi(); ST.smetti(); live = false; D = VUOTO_D();
  await ricarica();
  ST.ascolta(g.id, cambiamento, s => { live = s; renderNav(); renderPiano(); renderSpesa(); });
  if (!IO) scegliPartecipante();
}
// Come in Tricount: ogni account corrisponde a una persona del gruppo
function scegliPartecipante() {
  const liberi = D.partecipanti.filter(p => !p.user_id);
  const giaNome = D.partecipanti.find(p => p.nome.toLowerCase() === (CHI || '').toLowerCase() && !p.user_id);
  foglio(`<h2>Chi sei in ${esc(G.nome)}?</h2><p class="q" style="line-height:1.5">Scegli la persona che corrisponde a te, oppure aggiungiti.</p>
    ${liberi.map(p => `<button class="btn ghost" type="button" data-p="${p.id}">${esc(p.nome)}</button>`).join('')}
    ${giaNome ? '' : `<button class="btn" type="button" id="pNew">Aggiungi "${esc(CHI)}"</button>`}`, { fisso: true, senzaX: true });
  $('pop').querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
    if (await scrivi(() => ST.upd('partecipanti', b.dataset.p, { user_id: UTENTE.id }))) { chiudi(); await ricarica(); }
  });
  if ($('pNew')) $('pNew').onclick = async () => {
    if (await scrivi(() => ST.ins('partecipanti', { gruppo_id: G.id, nome: CHI, user_id: UTENTE.id }))) { chiudi(); await ricarica(); }
  };
}
// Modifiche arrivate dagli altri dispositivi
function cambiamento(t, ev, r) {
  if (t === 'stato') {
    if (!r) return;
    const prima = D.stato[r.id];
    D.stato[r.id] = r.data;
    if (/^piano:/.test(r.id) && r.data && r.data.da && r.data.da !== CHI && JSON.stringify(prima) !== JSON.stringify(r.data))
      avvisoLocale('Pasti aggiornati', `${r.data.da} ha aggiornato la dieta di ${nomeP(r.id.slice(6))}`, 'piano');
    renderPiano(); renderChat(); renderImp(); snap(); return;
  }
  if (t === 'movimenti' && r && 'foto' in r) { r.ha_foto = !!r.foto; delete r.foto; }
  const arr = D[t]; if (!arr) return;
  const esisteva = r && arr.some(x => x.id === r.id);
  if (ev === 'DELETE') D[t] = arr.filter(x => x.id !== r.id);
  else { const i = arr.findIndex(x => x.id === r.id); if (i >= 0) arr[i] = r; else arr.push(r); }
  if (t === 'movimenti') {
    ordinaMov(D.movimenti);
    if (ev === 'INSERT' && !esisteva && r.creato_da && r.creato_da !== CHI)
      avvisoLocale(r.tipo === 'trasferimento' ? 'Nuovo rimborso' : r.tipo === 'entrata' ? 'Nuova entrata' : 'Nuova spesa', `${r.creato_da}: ${r.titolo} · ${eur(Conti.inValutaGruppo(r))}`, 'conti');
  }
  if (t === 'partecipanti') trovaIO();
  snap();
  if (t === 'spesa') renderSpesa(); else renderTutto();
}

async function avvio() {
  chiudi(); renderTutto();
  if (ANTEPRIMA || LS.get('modo') === 'locale') ST = storeLocale();
  else if (S('sbUrl') && S('sbKey') && window.supabase) {
    try { ST = storeSupabase(S('sbUrl'), S('sbKey')); } catch (e) { toast('Dati del server non validi'); return benvenuto(); }
  } else return benvenuto();
  if (!CHI) await chiSei();
  UTENTE = await ST.sessione().catch(() => null);
  if (!UTENTE) {
    const via = await loginEmail(); UTENTE = await ST.sessione();
    if (via === 'codice' && !LS.get('pw') && ST.modo === 'supabase') await formPassword('Scegli una password');
  }
  await scegliGruppo();
}

// ---------- Avvio ----------
(function () {
  const q = new URLSearchParams(location.search);
  const inv = q.get('invito'), dom = q.get('chiedi'), sq = q.get('scheda');
  if (inv) SS.set('invito', inv);
  if (dom) SS.set('chiedi', dom);
  if (inv || dom || sq) history.replaceState(null, '', location.pathname);
  document.querySelectorAll('nav.sezioni button[data-t]').forEach(b => b.onclick = () => vai(b.dataset.t));
  $('navPiu').onclick = menuAggiungi; $('navAltro').onclick = menuAltro;
  renderNav();
  avviaBlocco();
  const sch = sq || LS.get('scheda'); if (sch && $('t-' + sch)) vai(sch);
  // App installabile: service worker e avviso di nuova versione
  if ('serviceWorker' in navigator && !ANTEPRIMA && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const avvisa = w => toast('Nuova versione disponibile', { testo: 'Aggiorna', fn: () => w.postMessage('aggiorna') });
      if (reg.waiting && navigator.serviceWorker.controller) avvisa(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) avvisa(w); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
    let ricaricata = !navigator.serviceWorker.controller; // alla prima apertura non serve ricaricare
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!ricaricata) { ricaricata = true; location.reload(); } });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.scheda) vai(e.data.scheda); });
  }
  const rete = () => { $('offline').hidden = navigator.onLine; };
  addEventListener('online', () => { rete(); ricarica(); }); addEventListener('offline', rete); rete();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && G && ST && ST.modo === 'supabase' && navigator.onLine) ricarica(); });
  avvio();
})();
