// Notifiche: attive per tutti in partenza, ognuno le spegne se non le vuole (Impostazioni → Notifiche).
// Avviso dentro l'app se è aperta, notifica del sistema (push) se è chiusa o in secondo piano.
// "Ci sei a cena?" alle 17 e "Ricordaglielo" arrivano dal server anche ad app aperta.
const pushPossibile = () => !ANTEPRIMA && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!S('vapidPublic') && ST && ST.modo === 'supabase';
const notificheAttive = () => LS.get('notifiche') !== 'no' && 'Notification' in window && Notification.permission === 'granted';
// Preferenze per tipo, salvate nel gruppo così le rispetta anche il server: tutte attive se la persona non ha scelto
const AVVISI_BASE = { tavola: true, spesa: true, conti: true, agenda: true };
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
  LS.set('chiestoNotifiche', '1');
  if (perm !== 'granted') { renderImp(); return toast('Notifiche non consentite: puoi attivarle dalle impostazioni del telefono'); }
  LS.set('notifiche', 'si');
  if (pushPossibile()) {
    try { await iscriviDispositivo(); toast('Notifiche attive ✓'); }
    catch (e) { toast('Notifiche attive solo con l\'app aperta: ' + e.message); }
  } else toast('Notifiche attive mentre l\'app è aperta ✓');
  renderImp();
}
async function disattivaNotifiche() {
  LS.set('notifiche', 'no');
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await ST.disiscrivi(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) {}
  toast('Notifiche disattivate su questo telefono'); renderImp();
}
// All'apertura del gruppo: se il permesso c'è, il telefono resta iscritto; se non è mai stato chiesto, lo si chiede una volta
function avviaNotifiche() {
  if (ANTEPRIMA || !ST || ST.modo !== 'supabase' || !('Notification' in window) || LS.get('notifiche') === 'no') return;
  if (Notification.permission === 'granted') { iscriviDispositivo().catch(() => {}); return; }
  if (Notification.permission !== 'default' || LS.get('chiestoNotifiche') === '1' || (ios() && !installata())) return;
  foglio(`<div style="text-align:center;padding:6px 0 2px">${ic('campana', 40, 1.6).replace('class="ic"', 'class="ic" style="margin:0 auto 10px;color:var(--acc-text)"')}<h2>Attiva le notifiche</h2>
    <p class="q" style="line-height:1.5;margin:4px 0 14px">Ti avvisiamo quando c'è da rispondere "Ci sei a cena?", quando cambia la spesa e quando qualcuno ti ricorda un conto. Puoi spegnerle quando vuoi da Impostazioni.</p></div>
    <button class="btn" id="ntSi" type="button">Attiva</button><button class="btn ghost" id="ntNo" type="button">Non ora</button>`, { fisso: true, senzaX: true });
  $('ntSi').onclick = () => { chiudi(); attivaNotifiche(); };
  $('ntNo').onclick = () => { LS.set('chiestoNotifiche', '1'); chiudi(); };
}

// Avvisi agli altri del gruppo (funzione "notifica" su Supabase). opz.a = solo queste persone.
function avvisaGruppo(titolo, testo, opz = {}) {
  if (!G || !ST) return Promise.resolve(0);
  const tipo = opz.tipo || (/past|diet|piatt/i.test(titolo) ? 'piano' : 'conti');
  return ST.notifica(G.id, titolo, testo, opz.scheda || (tipo === 'piano' ? 'piano' : tipo === 'spesa' ? 'spesa' : tipo === 'tavola' ? 'oggi' : tipo === 'agenda' ? 'agenda' : 'conti'), tipo, opz.a);
}
// Le modifiche alla spesa si raccolgono per qualche secondo e partono in un solo avviso
let _codaSpesa = { agg: [], presi: [], t: null };
function avvisaSpesa(nome, preso) {
  (preso ? _codaSpesa.presi : _codaSpesa.agg).push(nome);
  clearTimeout(_codaSpesa.t);
  _codaSpesa.t = setTimeout(() => {
    const { agg, presi } = _codaSpesa; _codaSpesa = { agg: [], presi: [], t: null };
    const elenco = l => l.length > 3 ? l.slice(0, 3).join(', ') + ' e altri ' + (l.length - 3) : l.join(', ');
    const parti = [agg.length ? 'ha aggiunto ' + elenco(agg) : '', presi.length ? 'ha preso ' + elenco(presi) : ''].filter(Boolean);
    if (parti.length) avvisaGruppo('Spesa', CHI + ' ' + parti.join(' e '), { tipo: 'spesa', scheda: 'spesa' });
  }, 15000);
}

// Un cambiamento arrivato da un'altra persona mentre l'app è aperta
async function avvisoLocale(titolo, testo, scheda) {
  if (!document.hidden) { toast(titolo + ': ' + testo, scheda ? { testo: 'Vedi', fn: () => vai(scheda) } : null); return; }
  if (!notificheAttive() || pushPossibile()) return; // se c'è il push, ci pensa il server
  try { const reg = await navigator.serviceWorker.ready; reg.showNotification(titolo, { body: testo, icon: 'icon-192.png', badge: 'favicon-32.png', tag: 'tm-' + Date.now(), data: { scheda } }); } catch (e) {}
}
