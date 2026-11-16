// Notifiche: attive per tutti in partenza, ognuno le spegne se non le vuole (Impostazioni → Notifiche).
// Avviso dentro l'app se è aperta, notifica del sistema (push) se è chiusa o in secondo piano.
// "Ci sei a cena?" alle 17 e "Ricordaglielo" arrivano dal server anche ad app aperta.
const pushPossibile = () => !ANTEPRIMA && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!S('vapidPublic') && ST && ST.modo === 'supabase';
// Spente solo se la persona le ha spente lei da Impostazioni (la vecchia chiave "notifiche" = "no" la metteva anche l'uscita dall'account: non conta più)
const notificheSpente = () => LS.get('notifiche_off') === '1';
const notificheAttive = () => !notificheSpente() && 'Notification' in window && Notification.permission === 'granted';
// Preferenze per tipo, salvate nel gruppo così le rispetta anche il server: tutte attive se la persona non ha scelto
const AVVISI_BASE = { tavola: true, spesa: true, conti: true, agenda: true, piano: true, gruppo: true };
const NOMI_AVVISO = { tavola: 'pasti', spesa: 'spesa', conti: 'conti', agenda: 'agenda', piano: 'piano', gruppo: 'gruppo' };
const avvisiDi = pid => Object.assign({}, AVVISI_BASE, (pid && D.stato['avvisi:' + pid]) || {});
const avvisoAttivo = k => avvisiDi(IO)[k] !== false;
async function salvaAvviso(k, v) {
  if (!IO) return;
  const a = avvisiDi(IO); a[k] = v; D.stato['avvisi:' + IO] = a; renderImp();
  await scrivi(() => ST.salvaStato(G.id, 'avvisi:' + IO, a));
}

function chiaveVapid(b64) {
  const p = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(p), c => c.charCodeAt(0));
}
async function iscriviDispositivo() {
  if (!pushPossibile() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveVapid(S('vapidPublic')) });
  await ST.iscrivi(sub); return true;
}
async function attivaNotifiche() {
  if (!('Notification' in window)) return toast('Questo browser non supporta le notifiche');
  if (ios() && !installata()) return toast('Su iPhone le notifiche arrivano solo con l\'app aggiunta alla schermata Home');
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  LS.set('chiestoNotifiche', String(Date.now()));
  if (perm !== 'granted') { renderImp(); renderOggi(); return toast('Notifiche non consentite: puoi attivarle da Impostazioni dell\'iPhone → Notifiche → Tablemates'); }
  LS.del('notifiche_off');
  if (pushPossibile()) {
    try { await iscriviDispositivo(); toast('Notifiche attive ✓'); provaAutomatica(true); }
    catch (e) { toast('Notifiche attive solo con l\'app aperta: ' + e.message); }
  } else toast('Notifiche attive mentre l\'app è aperta ✓');
  renderImp(); renderOggi();
}
// La prima volta che un telefono si iscrive per un account, gli arriva da solo un avviso di prova (così si vede subito che funziona)
async function provaAutomatica(forza) {
  if (!G || !UTENTE || !ST || ST.modo !== 'supabase') return;
  const k = 'provaAvvisi_' + UTENTE.id;
  if (!forza && LS.get(k)) return;
  try { const r = await ST.provaNotifica(G.id, true); if (r && r.inviate) LS.set(k, '1'); } catch (e) {}
}
// Toglie questo telefono dalle notifiche dell'account (senza cambiare la scelta della persona: serve all'uscita dall'account)
async function scollegaDispositivo() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await ST.disiscrivi(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) {}
}
async function disattivaNotifiche() {
  LS.set('notifiche_off', '1');
  await scollegaDispositivo();
  toast('Notifiche disattivate su questo telefono'); renderImp();
}
// All'apertura del gruppo, in automatico: se il permesso c'è il telefono si (ri)iscrive da solo (e la prima volta riceve una prova);
// se manca, si chiede subito (e di nuovo il giorno dopo, se si risponde "Non ora"); su iPhone da Safari si spiega come installarla.
function avviaNotifiche() {
  if (ANTEPRIMA || !ST || ST.modo !== 'supabase' || notificheSpente()) return;
  if ('Notification' in window && Notification.permission === 'granted') { iscriviDispositivo().then(ok => { if (ok) provaAutomatica(); }).catch(() => {}); return; }
  const ultima = Number(LS.get('chiestoNotifiche')) || 0;
  if (Date.now() - ultima < 20 * 3600000 || $('pop').querySelector('.foglio')) return;
  if (ios() && !installata()) { LS.set('chiestoNotifiche', String(Date.now())); return foglioInstallaAvvisi(); }
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  foglio(`<div style="text-align:center;padding:6px 0 2px">${ic('campana', 40, 1.6).replace('class="ic"', 'class="ic" style="margin:0 auto 10px;color:var(--acc-text)"')}<h2>Attiva le notifiche</h2>
    <p class="q" style="line-height:1.5;margin:4px 0 14px">Ti avvisiamo quando c'è da rispondere "Ci sei a cena?", quando cambia la spesa e quando qualcuno ti ricorda un conto. Puoi spegnerle quando vuoi da Impostazioni.</p></div>
    <button class="btn" id="ntSi" type="button">Attiva</button><button class="btn ghost" id="ntNo" type="button">Non ora</button>`, { fisso: true, senzaX: true });
  $('ntSi').onclick = () => { chiudi(); attivaNotifiche(); };
  $('ntNo').onclick = () => { LS.set('chiestoNotifiche', String(Date.now())); chiudi(); };
}
// iPhone da Safari (per esempio entrando dal link d'invito): gli avvisi arrivano solo con l'app sulla schermata Home
function foglioInstallaAvvisi() {
  foglio(`<h2>Ricevi gli avvisi</h2><p class="q" style="line-height:1.55;margin:4px 0 12px">Su iPhone gli avvisi (spesa, agenda, promemoria, conti) arrivano solo se l'app è sulla schermata Home:</p>
    <ol class="q" style="line-height:1.6;margin:0 0 14px;padding-left:20px"><li>tocca <b>Condividi</b> (il quadrato con la freccia) qui in Safari;</li><li>scegli <b>Aggiungi alla schermata Home</b> e poi <b>Aggiungi</b>;</li><li>apri <b>Tablemates</b> dall'icona e tocca <b>Consenti</b>.</li></ol>
    <button class="btn" id="ntOk" type="button">Ho capito</button>`);
  $('ntOk').onclick = chiudi;
}
// Riquadro nella scheda Oggi finché su questo telefono gli avvisi non sono attivi (un tocco per attivarli)
function htmlAvvisiOggi() {
  if (ANTEPRIMA || !ST || ST.modo !== 'supabase' || !G || notificheSpente() || notificheAttive()) return '';
  const negati = 'Notification' in window && Notification.permission === 'denied', daInstallare = ios() && !installata();
  const testo = daInstallare ? 'Per ricevere gli avvisi su iPhone aggiungi l\'app alla schermata Home.' : negati ? 'Gli avvisi sono bloccati: Impostazioni dell\'iPhone → Notifiche → Tablemates → Consenti.' : 'Tocca per ricevere avvisi di spesa, agenda, promemoria e conti.';
  return `<button type="button" class="riga-link og-avvisi" id="ogAvvisi">${ic('campana', 20, 1.8)}<span><b>Attiva gli avvisi</b><small>${esc(testo)}</small></span>${ic('avanti', 18, 2)}</button>`;
}
function tocaAvvisiOggi() {
  if (ios() && !installata()) return foglioInstallaAvvisi();
  if ('Notification' in window && Notification.permission === 'denied') return toast('Vai in Impostazioni dell\'iPhone → Notifiche → Tablemates e attiva Consenti notifiche');
  attivaNotifiche();
}

// Avvisi agli altri del gruppo (funzione "notifica" su Supabase). opz.a = solo queste persone.
function avvisaGruppo(titolo, testo, opz = {}) {
  if (!G || !ST) return Promise.resolve(0);
  const tipo = opz.tipo || (/past|diet|piatt/i.test(titolo) ? 'piano' : 'conti');
  return ST.notifica(G.id, titolo, testo, opz.scheda || (tipo === 'piano' ? 'piano' : tipo === 'spesa' ? 'spesa' : tipo === 'tavola' ? 'oggi' : tipo === 'agenda' ? 'agenda' : 'conti'), tipo, opz.a);
}
// Avvisi che partono dopo qualche secondo (così più gesti ravvicinati fanno un solo avviso) e subito se si chiude o si lascia l'app,
// altrimenti su iPhone, con l'app in secondo piano, il timer si fermerebbe e l'avviso non partirebbe mai.
const _ritardati = new Map();
function ritarda(chiave, ms, fn) { const v = _ritardati.get(chiave); if (v) clearTimeout(v.t); _ritardati.set(chiave, { fn, t: setTimeout(() => { _ritardati.delete(chiave); fn(); }, ms) }); }
function inviaRitardati() { const l = [..._ritardati.values()]; _ritardati.clear(); l.forEach(v => { clearTimeout(v.t); v.fn(); }); }
document.addEventListener('visibilitychange', () => { if (document.hidden) inviaRitardati(); });
addEventListener('pagehide', inviaRitardati);

// Avviso della Spesa: mentre modifichi la lista non parte nulla. Resta in attesa (anche se chiudi l'app) e parte solo quando
// tocchi «Avvisa» nella barra in cima alla Spesa. Due soli testi: «ha aggiunto prodotti alla lista della spesa» se hai aggiunto
// qualcosa, altrimenti «ha aggiornato la lista della spesa» (prodotti tolti, presi o modificati).
const spesaInAttesa = () => { const v = LS.getJ('spesaAvviso', null); return v && G && v.g === G.id ? v : null; };
function avvisaSpesa(nomi, azione) { // azione: 'agg' (predefinita), 'preso' (o true), 'mod', 'tolto'
  if (!G || !ST || ST.modo !== 'supabase') return; // senza server non c'è nessuno da avvisare
  const agg = !(azione === true || azione === 'preso' || azione === 'mod' || azione === 'tolto'), v = spesaInAttesa();
  LS.setJ('spesaAvviso', { g: G.id, agg: agg || !!(v && v.agg) });
  if (typeof renderSpesa === 'function') renderSpesa();
  if (typeof renderOggi === 'function') renderOggi();
}
function htmlBarraSpesa(pre = 'sp') {
  if (!spesaInAttesa() || !ST || ST.modo !== 'supabase') return '';
  return `<div class="sp-avviso" role="group" aria-label="Avvisa gli altri della spesa"><span><b>Hai modificato la lista</b><small>Quando hai finito, avvisa gli altri.</small></span><button type="button" class="btn" id="${pre}Avvisa">Avvisa</button><button type="button" class="link-txt" id="${pre}NonAvvisare">No</button></div>`;
}
function tocaBarraSpesa(pre = 'sp') {
  const rinfresca = () => { if (typeof renderSpesa === 'function') renderSpesa(); if (typeof renderOggi === 'function') renderOggi(); };
  if ($(pre + 'Avvisa')) $(pre + 'Avvisa').onclick = async () => {
    const v = spesaInAttesa(); if (!v) return rinfresca();
    $(pre + 'Avvisa').disabled = true;
    LS.del('spesaAvviso');
    await avvisaGruppo('Spesa', CHI + (v.agg ? ' ha aggiunto prodotti alla lista della spesa' : ' ha aggiornato la lista della spesa'), { tipo: 'spesa', scheda: 'spesa' });
    toast('Avviso inviato ✓'); rinfresca();
  };
  if ($(pre + 'NonAvvisare')) $(pre + 'NonAvvisare').onclick = () => { LS.del('spesaAvviso'); rinfresca(); };
}
// A chi mandare un avviso dell'agenda: a tutto il gruppo se almeno una delle liste di persone è vuota, altrimenti alle persone indicate
const destinatariAgenda = (...liste) => liste.some(l => !l || !l.length) ? undefined : [...new Set(liste.flat())];

// Un cambiamento arrivato da un'altra persona mentre l'app è aperta
async function avvisoLocale(titolo, testo, scheda) {
  if (!document.hidden) { toast(titolo + ': ' + testo, scheda ? { testo: 'Vedi', fn: () => vai(scheda) } : null); return; }
  if (!notificheAttive() || pushPossibile()) return; // se c'è il push, ci pensa il server
  try { const reg = await navigator.serviceWorker.ready; reg.showNotification(titolo, { body: testo, icon: 'icon-192.png', badge: 'favicon-32.png', tag: 'tm-' + Date.now(), data: { scheda } }); } catch (e) {}
}

// Chi riceve gli avvisi del gruppo e, se qualcuno no, perché; con la prova a tutti
async function foglioDiagnosiNotifiche() {
  if (!G || !ST || ST.modo !== 'supabase') return;
  foglio('<h2>Chi riceve gli avvisi</h2><p class="q" style="line-height:1.5">Controllo…</p>');
  let d;
  try { d = await ST.diagnosiNotifiche(G.id); }
  catch (e) { return foglio(`<h2>Chi riceve gli avvisi</h2><p class="q" style="line-height:1.5;color:var(--neg)">${esc(e.message)}</p>`); }
  const persone = d.persone || [];
  const riga = p => {
    const ok = p.telefoni > 0;
    const note = [
      ok ? '' : p.io ? 'Tocca «Avvisi sul telefono» qui in Impostazioni.' : 'Deve aprire l\'app dalla schermata Home e attivare gli avvisi dalle Impostazioni.',
      p.collegata ? '' : 'Non ha ancora scelto «Chi sei» nel gruppo: gli avvisi riservati a una persona non le arrivano.',
      p.spente && p.spente.length ? 'Spenti: ' + p.spente.map(k => NOMI_AVVISO[k] || k).join(', ') + '.' : ''
    ].filter(Boolean);
    return `<div class="it" style="align-items:flex-start"><span style="flex:1;min-width:0"><b>${esc(p.nome)}</b>${p.io ? ' <span class="by">(tu)</span>' : ''}<br><span class="by">${ok ? '✅ ' + (p.telefoni === 1 ? '1 telefono pronto' : p.telefoni + ' telefoni pronti') : '⚠️ Nessun telefono iscritto'}</span>${note.map(n => `<br><span class="by">${esc(n)}</span>`).join('')}</span></div>`;
  };
  const cron = d.cron_minuti === null || d.cron_minuti === undefined ? '❌ Il controllo automatico dell\'agenda non è ancora partito: va eseguito promemoria.sql su Supabase.' : d.cron_minuti <= 40 ? '✅ Il controllo automatico dell\'agenda funziona (ultimo ' + (d.cron_minuti < 2 ? 'adesso' : d.cron_minuti + ' minuti fa') + ').' : '❌ Il controllo automatico dell\'agenda è fermo da ' + Math.round(d.cron_minuti / 60) + ' ore: va eseguito di nuovo promemoria.sql su Supabase.';
  foglio(`<h2>Chi riceve gli avvisi</h2><div class="lista" style="margin:8px 0 10px">${persone.map(riga).join('') || '<p class="q">Nessuna persona con un account.</p>'}</div>
    <p class="by" style="line-height:1.5;margin:0 0 12px">${cron}</p>
    <div id="dgEsito"></div>
    <button class="btn" id="dgTutti" type="button">Manda una prova agli altri</button><button class="btn bordo" id="dgMe" type="button">Manda una prova a me</button>`);
  const prova = async (quale, bottone) => {
    bottone.disabled = true; $('dgEsito').innerHTML = '<p class="q">Invio…</p>';
    try {
      const r = await ST.provaNotifica(G.id, quale);
      const det = r.dettagli || [];
      $('dgEsito').innerHTML = `<p class="by" style="margin:0 0 6px"><b>Esito della prova</b></p><div class="lista" style="margin:0 0 10px">${det.map(x => `<div class="it"><span style="flex:1;min-width:0"><b>${esc(x.nome)}</b><br><span class="by">${x.inviate ? '✅ Avviso partito: dovrebbe comparire sul telefono tra pochi secondi' : !x.telefoni ? '⚠️ Nessun telefono iscritto: non può riceverlo' : '❌ Il telefono ha rifiutato l\'avviso' + (r.errori && r.errori[0] ? ' (' + esc(r.errori[0]) + ')' : '') + ': deve riattivare gli avvisi da Impostazioni'}</span></span></div>`).join('') || '<p class="q">Nessuno a cui mandarla.</p>'}</div>`;
    } catch (e) { $('dgEsito').innerHTML = `<p class="q" style="color:var(--neg);line-height:1.5">${esc(e.message)}</p>`; }
    bottone.disabled = false;
  };
  $('dgTutti').onclick = () => prova('tutti', $('dgTutti'));
  $('dgMe').onclick = () => prova(true, $('dgMe'));
}
