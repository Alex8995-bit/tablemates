// Notifiche: avviso dentro l'app se è aperta, notifica del sistema (push) se è chiusa o in secondo piano.
const pushPossibile = () => !ANTEPRIMA && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!S('vapidPublic') && ST && ST.modo === 'supabase';
const notificheAttive = () => LS.get('notifiche') === 'si' && 'Notification' in window && Notification.permission === 'granted';

function chiaveVapid(b64) {
  const p = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(p), c => c.charCodeAt(0));
}
async function attivaNotifiche() {
  if (!('Notification' in window)) return toast('Questo browser non supporta le notifiche');
  if (ios() && !installata()) return toast('Su iPhone le notifiche arrivano solo con l\'app aggiunta alla schermata Home');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return toast('Notifiche non consentite: puoi attivarle dalle impostazioni del browser');
  LS.set('notifiche', 'si');
  if (pushPossibile()) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveVapid(S('vapidPublic')) });
      await ST.iscrivi(sub);
      toast('Notifiche attive ✓');
    } catch (e) { toast('Notifiche attive solo con l\'app aperta: ' + e.message); }
  } else toast('Notifiche attive mentre l\'app è aperta ✓');
  renderImp();
}
async function disattivaNotifiche() {
  LS.set('notifiche', 'no');
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await ST.disiscrivi(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) {}
  toast('Notifiche disattivate'); renderImp();
}
// Dopo aver aggiunto una spesa o un pasto: avvisa gli altri del gruppo (funzione "notifica" su Supabase)
function avvisaGruppo(titolo, testo) { if (G && ST) ST.notifica(G.id, titolo, testo, /past|diet|piatt/i.test(titolo) ? 'piano' : 'conti'); }

// Un cambiamento arrivato da un'altra persona mentre l'app è aperta
async function avvisoLocale(titolo, testo, scheda) {
  if (!document.hidden) { toast(titolo + ': ' + testo, scheda ? { testo: 'Vedi', fn: () => vai(scheda) } : null); return; }
  if (!notificheAttive() || pushPossibile()) return; // se c'è il push, ci pensa il server
  try { const reg = await navigator.serviceWorker.ready; reg.showNotification(titolo, { body: testo, icon: 'icon-192.png', badge: 'favicon-32.png', tag: 'tm-' + Date.now(), data: { scheda } }); } catch (e) {}
}
