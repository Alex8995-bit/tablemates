// Aspetto (chiaro/scuro), password dell'account, blocco dell'app con PIN e Face ID / impronta.
// Il blocco è una protezione sul dispositivo: serve a chi prende in mano il telefono. I dati sul server
// restano protetti dall'accesso con email e password.

// ---------- Aspetto ----------
const TEMI = [['auto', 'Automatico'], ['chiaro', 'Chiaro'], ['scuro', 'Scuro']];
const temaScelto = () => { const t = LS.get('tema'); return t === 'chiaro' || t === 'scuro' ? t : 'auto'; };
function applicaTema() {
  const t = temaScelto(), r = document.documentElement;
  if (t === 'chiaro') r.setAttribute('data-theme', 'light'); else if (t === 'scuro') r.setAttribute('data-theme', 'dark'); else r.removeAttribute('data-theme');
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    if (!m.dataset.orig) m.dataset.orig = m.content;
    m.content = t === 'chiaro' ? '#F4F6F3' : t === 'scuro' ? '#0F1712' : m.dataset.orig;
  });
}
applicaTema();

// ---------- Utilità ----------
const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(c => s += String.fromCharCode(c)); return btoa(s); };
const deb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64u = buf => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deb64u = s => deb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4));
const cifreOk = !!(window.crypto && crypto.subtle);

// ---------- PIN ----------
const leggiPin = () => LS.getJ('pin', null);
const pinImpostato = () => !!(leggiPin() && leggiPin().h);
async function hashPin(pin, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, 256));
}
async function salvaPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  LS.setJ('pin', { s: b64(salt), h: await hashPin(pin, salt), n: pin.length });
}
async function verificaPin(pin) {
  const c = leggiPin(); if (!c) return true;
  return (await hashPin(pin, deb64(c.s))) === c.h;
}
const disattivaPin = () => { ['pin', 'bioId', 'bloccoMin', 'pinTent', 'pinFino'].forEach(k => LS.del(k)); };

// ---------- Face ID / impronta (WebAuthn, solo verifica sul dispositivo) ----------
let BIO_OK = null;
async function bioDisponibile() {
  try { return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch (e) { return false; }
}
const nomeBio = () => ios() ? 'Face ID o Touch ID' : 'impronta o riconoscimento facciale';
async function bioAttiva() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: NOME_APP },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: LS.get('email') || CHI || 'utente', displayName: CHI || 'Utente' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none' } });
  LS.set('bioId', b64u(cred.rawId));
}
async function bioVerifica() {
  await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), timeout: 60000, userVerification: 'required',
    allowCredentials: [{ type: 'public-key', id: deb64u(LS.get('bioId')), transports: ['internal'] }] } });
  return true;
}

// ---------- Tastierino ----------
// Disegna punti e tasti in "box". fine(pin) viene chiamata quando le cifre sono complete.
function tastierino(box, n, fine, opz = {}) {
  let v = '', occupato = false, fermo = false;
  const tasti = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button type="button" data-d="${d}" aria-label="${d}">${d}</button>`).join('');
  box.innerHTML = `<div class="punti" role="img" aria-label="Cifre inserite"></div><p class="err" role="alert" aria-live="assertive"></p>
    <div class="tasti${opz.grande ? ' grande' : ''}">${tasti}
    ${opz.bio ? `<button type="button" data-bio aria-label="Sblocca con ${nomeBio()}">${ic('impronta', 28, 1.7)}</button>` : '<span></span>'}
    <button type="button" data-d="0" aria-label="0">0</button>
    <button type="button" data-x aria-label="Cancella l'ultima cifra">${ic('cancella', 26, 1.8)}</button></div>`;
  const punti = box.querySelector('.punti'), err = box.querySelector('.err');
  const disegna = () => { punti.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < v.length ? 'on' : ''}"></span>`).join(''); punti.setAttribute('aria-label', v.length + ' cifre su ' + n); };
  const ctl = {
    errore(msg) { v = ''; occupato = false; disegna(); err.textContent = msg || ''; if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { punti.classList.remove('scuoti'); void punti.offsetWidth; punti.classList.add('scuoti'); } vibra(); },
    messaggio(msg) { err.textContent = msg || ''; },
    ferma(si) { fermo = si; box.querySelectorAll('button[data-d],button[data-x]').forEach(b => b.disabled = si); },
    reset() { v = ''; occupato = false; disegna(); }
  };
  const aggiungi = d => {
    if (occupato || fermo || v.length >= n) return;
    v += d; err.textContent = ''; disegna();
    if (v.length === n) { occupato = true; setTimeout(() => fine(v, ctl), 90); }
  };
  const togli = () => { if (occupato || fermo) return; v = v.slice(0, -1); disegna(); };
  box.querySelectorAll('[data-d]').forEach(b => b.onclick = () => aggiungi(b.dataset.d));
  box.querySelector('[data-x]').onclick = togli;
  if (opz.bio) box.querySelector('[data-bio]').onclick = opz.onBio;
  if (tastierino._h) document.removeEventListener('keydown', tastierino._h);
  tastierino._h = e => {
    if (!box.isConnected) { document.removeEventListener('keydown', tastierino._h); return; }
    if (/^\d$/.test(e.key)) aggiungi(e.key); else if (e.key === 'Backspace') togli();
  };
  document.addEventListener('keydown', tastierino._h);
  disegna();
  return ctl;
}
// Chiede un PIN in un foglio. Con "verifica" accetta solo il PIN giusto. Risolve con il PIN o con null se annulli.
function chiediPin(titolo, testo, n, verifica) {
  return new Promise(ris => {
    foglio(`<h2>${esc(titolo)}</h2><p class="q" style="line-height:1.45;margin-bottom:6px">${esc(testo || '')}</p><div id="pnK"></div><button class="btn bordo" id="pnN" type="button" style="margin-top:12px">Annulla</button>`, { fisso: true, senzaX: true });
    $('pnN').onclick = () => { chiudi(); ris(null); };
    tastierino($('pnK'), n, async (pin, c) => {
      if (verifica && !(await verifica(pin))) return c.errore('PIN errato');
      ris(pin);
    });
  });
}
function sceltaLunghezzaPin() {
  return new Promise(ris => {
    foglio(`<h2>Scegli il PIN</h2><p class="q" style="line-height:1.45">Quante cifre vuoi usare?</p>
      <button class="btn" type="button" data-n="6">6 cifre (consigliato)</button><button class="btn ghost" type="button" data-n="4">4 cifre</button><button class="btn bordo" type="button" id="lnN">Annulla</button>`, { fisso: true, senzaX: true });
    $('pop').querySelectorAll('[data-n]').forEach(b => b.onclick = () => ris(+b.dataset.n));
    $('lnN').onclick = () => { chiudi(); ris(0); };
  });
}
async function flussoNuovoPin() {
  const n = await sceltaLunghezzaPin(); if (!n) return false;
  for (;;) {
    const a = await chiediPin('Nuovo PIN', 'Scegli le ' + n + ' cifre.', n); if (!a) return false;
    const b = await chiediPin('Ripeti il PIN', 'Scrivilo ancora una volta.', n); if (!b) return false;
    if (a === b) { await salvaPin(a); chiudi(); return true; }
    toast('I due PIN non coincidono, riprova');
  }
}

// ---------- Schermata di blocco ----------
function inerte(si) { ['main', 'nav.sezioni', '#pop', '#pagina'].forEach(s => { const e = document.querySelector(s); if (e) e.inert = si; }); }
function sblocca() { const el = $('blocco'); if (el) el.remove(); inerte(false); LS.del('pinTent'); LS.del('pinFino'); }
function mostraBlocco() {
  if ($('blocco') || !pinImpostato() || !cifreOk) return;
  const cfg = leggiPin(), el = document.createElement('div');
  el.id = 'blocco'; el.className = 'blocco'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'App bloccata');
  el.innerHTML = `<div class="in"><div class="marchio">${marchioCompleto(40)}</div><h1>Inserisci il PIN</h1><p class="q" style="margin:0 0 8px">${NOME_APP} è bloccata.</p><div id="blK"></div><button class="btn bordo" id="blD" type="button" style="margin-top:14px">PIN dimenticato</button></div>`;
  document.body.appendChild(el); inerte(true);
  let timer = null;
  const attesa = c => {
    clearInterval(timer);
    const giro = () => {
      const s = Math.ceil(((+LS.get('pinFino') || 0) - Date.now()) / 1000);
      if (s <= 0) { clearInterval(timer); c.ferma(false); c.messaggio(''); return; }
      c.ferma(true); c.messaggio('Troppi tentativi. Riprova tra ' + s + ' s');
    };
    giro(); timer = setInterval(giro, 1000);
  };
  const usaBio = !!LS.get('bioId');
  const tentaBio = async () => {
    try { if (await bioVerifica()) sblocca(); }
    catch (e) { if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') ctl.messaggio('Non è riuscito: usa il PIN'); }
  };
  const ctl = tastierino($('blK'), cfg.n, async (pin, c) => {
    if (await verificaPin(pin)) { clearInterval(timer); sblocca(); return; }
    const t = (+LS.get('pinTent') || 0) + 1; LS.set('pinTent', String(t));
    if (t >= 5) { LS.set('pinFino', String(Date.now() + Math.min(30 * 2 ** (t - 5), 600) * 1000)); c.errore(''); attesa(c); }
    else c.errore('PIN errato · ancora ' + (5 - t) + (5 - t === 1 ? ' tentativo' : ' tentativi'));
  }, { bio: usaBio, grande: true, onBio: tentaBio });
  if ((+LS.get('pinFino') || 0) > Date.now()) attesa(ctl);
  // Face ID dopo l'intro: altrimenti la finestra di sistema la copre
  else if (usaBio) (window.INTRO ? INTRO.fine : Promise.resolve()).then(() => setTimeout(tentaBio, 350));
  $('blD').onclick = () => {
    const rete = ST && ST.modo === 'supabase';
    foglio(`<h2>PIN dimenticato</h2><p class="q" style="line-height:1.5">${rete ? 'Per toglierlo esci dall\'account su questo dispositivo: poi rientri con la tua email e la password (o con il codice via email). Non perdi niente: i dati sono sul server.' : 'Questa app è usata solo su questo dispositivo, quindi per togliere il PIN vanno cancellati tutti i dati salvati qui: pasti, spesa e conti. Se vuoi evitarlo, riprova a ricordare il PIN.'}</p>
      <button class="btn danger" id="pdS" type="button">${rete ? 'Esci dall\'account' : 'Cancella i dati e togli il PIN'}</button><button class="btn ghost" id="pdN" type="button">Annulla</button>`, { fisso: true, senzaX: true });
    // il foglio sta sotto al blocco: lo porto davanti finché è aperto
    const ov = $('ov'); if (ov) { ov.style.zIndex = 300; ov.inert = false; $('pop').inert = false; }
    $('pdN').onclick = () => { chiudi(); $('pop').inert = true; };
    $('pdS').onclick = async () => {
      try { if (rete) { await ST.esci(); disattivaPin(); SS.del('chi'); LS.del('gruppo'); } else { try { localStorage.clear(); } catch (e) {} } } catch (e) {}
      location.reload();
    };
  };
}
// Riblocca quando l'app torna in primo piano dopo il tempo scelto
let _nascosta = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { _nascosta = Date.now(); return; }
  if (!pinImpostato() || $('blocco') || !_nascosta) return;
  const m = LS.get('bloccoMin') === '' ? 1 : +LS.get('bloccoMin');
  if (Date.now() - _nascosta >= (isNaN(m) ? 1 : m) * 60000) mostraBlocco();
});
function avviaBlocco() { if (pinImpostato()) mostraBlocco(); bioDisponibile().then(v => { BIO_OK = v; if ($('t-imp') && $('t-imp').innerHTML) renderImp(); if ($('sicFoglio')) foglioSicurezza(); }); }

// ---------- Password dell'account ----------
function formPassword(titolo) {
  return new Promise(ris => {
    foglio(`<h2>${esc(titolo)}</h2><p class="q" style="line-height:1.5">Con la password rientri subito, senza aspettare il codice via email. Almeno 8 caratteri.</p>
      <label class="lb" for="pwA">Password</label><input id="pwA" type="password" autocomplete="new-password" style="background:var(--card)">
      <label class="lb" for="pwB">Ripeti la password</label><input id="pwB" type="password" autocomplete="new-password" style="background:var(--card)">
      <button class="btn" id="pwS" type="button" style="margin-top:12px">Salva password</button><button class="btn ghost" id="pwN" type="button">Più tardi</button>`, { fisso: true, senzaX: true });
    $('pwN').onclick = () => { chiudi(); ris(false); };
    const salva = async () => {
      const a = $('pwA').value, b = $('pwB').value;
      if (a.length < 8) return toast('La password deve avere almeno 8 caratteri');
      if (a !== b) return toast('Le due password non coincidono');
      $('pwS').disabled = true;
      try { await ST.impostaPassword(a); LS.set('pw', '1'); chiudi(); toast('Password salvata ✓'); ris(true); }
      catch (e) { toast(/same|different/i.test(e.message) ? 'Scegli una password diversa dalla precedente' : 'Non è stato possibile salvarla: ' + e.message); if ($('pwS')) $('pwS').disabled = false; }
    };
    $('pwS').onclick = salva; $('pwB').onkeydown = e => { if (e.key === 'Enter') salva(); };
  });
}

// ---------- Impostazioni: aspetto e sicurezza ----------
function htmlAspetto() {
  const t = temaScelto();
  return `<h2 class="sez">Aspetto</h2><div class="card"><div class="seg" role="group" aria-label="Tema">${TEMI.map(([k, n]) => `<button type="button" data-tema="${k}" aria-pressed="${t === k}" class="${t === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="q" style="margin:8px 0 0">Automatico segue le impostazioni del telefono o del computer.</p></div>`;
}
function htmlSicurezza() {
  if (ANTEPRIMA && !cifreOk) return '';
  let h = `<h2 class="sez">Sicurezza</h2><div class="card">`;
  if (!cifreOk) return h + '<p class="q" style="margin:0">Il blocco con PIN funziona solo con l\'indirizzo sicuro (https) dell\'app.</p></div>';
  if (!pinImpostato()) {
    h += `<p class="q" style="margin:0 0 10px;line-height:1.5">Proteggi l'app con un PIN: ti viene chiesto quando la riapri, così chi prende in mano il telefono non vede pasti, spesa e conti.</p><button class="btn" id="pinNuovo" type="button">${ic('lucchetto', 18)}Imposta un PIN</button>`;
  } else {
    const m = LS.get('bloccoMin') === '' ? 1 : +LS.get('bloccoMin');
    h += `<p class="q" style="margin:0 0 6px">PIN attivo · ${leggiPin().n} cifre</p>
      <label class="lb" for="bloccoMin" style="margin-top:4px">Blocca l'app dopo</label>
      <select id="bloccoMin" style="background:var(--card)">${[[0, 'Subito'], [1, '1 minuto'], [5, '5 minuti'], [15, '15 minuti'], [60, '1 ora']].map(([v, n]) => `<option value="${v}" ${m === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <p class="q" style="margin:4px 0 0;font-size:13px">È il tempo in cui l'app resta in secondo piano prima di richiedere il PIN.</p>
      ${BIO_OK ? `<label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0 4px;font-size:14px;line-height:1.45"><input type="checkbox" id="bioT" style="width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--acc)" ${LS.get('bioId') ? 'checked' : ''}><span>Sblocca con ${nomeBio()}</span></label>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px"><button class="btn ghost" id="bloccaOra" type="button">${ic('lucchetto', 18)}Blocca adesso</button><button class="btn bordo" id="pinCambia" type="button">Cambia PIN</button><button class="btn danger" id="pinOff" type="button">Disattiva il PIN</button></div>`;
  }
  return h + '</div>';
}
function aggiornaSicurezza() { renderImp(); if ($('sicFoglio')) foglioSicurezza(); }
function legaSicurezza() {
  document.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => { LS.set('tema', b.dataset.tema); applicaTema(); renderImp(); });
  if ($('pinNuovo')) $('pinNuovo').onclick = async () => { if (await flussoNuovoPin()) { toast('PIN attivato ✓'); aggiornaSicurezza(); } };
  if ($('bloccoMin')) $('bloccoMin').onchange = e => { LS.set('bloccoMin', e.target.value); toast('Salvato ✓'); };
  if ($('bloccaOra')) $('bloccaOra').onclick = mostraBlocco;
  const chiediAttuale = () => chiediPin('Inserisci il PIN attuale', '', leggiPin().n, verificaPin);
  if ($('pinCambia')) $('pinCambia').onclick = async () => {
    if (!(await chiediAttuale())) return;
    if (await flussoNuovoPin()) toast('PIN cambiato ✓'); else chiudi();
    aggiornaSicurezza();
  };
  if ($('pinOff')) $('pinOff').onclick = async () => { if (!(await chiediAttuale())) return; disattivaPin(); chiudi(); toast('PIN disattivato'); aggiornaSicurezza(); };
  if ($('bioT')) $('bioT').onchange = async e => {
    if (!e.target.checked) { LS.del('bioId'); toast('Disattivato'); return; }
    try { await bioAttiva(); toast(nomeBio()[0].toUpperCase() + nomeBio().slice(1) + ' attivato ✓'); }
    catch (err) { LS.del('bioId'); e.target.checked = false; toast(err && err.name === 'NotAllowedError' ? 'Operazione annullata' : 'Su questo dispositivo non si riesce ad attivare: resta il PIN'); }
  };
}
