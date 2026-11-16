// Impostazioni (dall'ingranaggio della scheda Gruppo): account, aspetto, notifiche, intelligenza artificiale, PIN e Face ID, orari, installazione.
let installaEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installaEvt = e; renderImp(); });
addEventListener('appinstalled', () => { installaEvt = null; toast('App installata ✓'); renderImp(); });
const installata = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const PROVIDER = [['nessuna', 'Nessuna'], ['groq', 'Groq (gratuito, consigliato)'], ['gemini', 'Google Gemini'], ['openai', 'ChatGPT (OpenAI)'], ['claude', 'Claude (Anthropic)']];

function renderImp() {
  const el = $('t-imp'); if (!el) return;
  const io = IO ? D.partecipanti.find(p => p.id === IO) : null, server = ST && ST.modo === 'supabase';
  const ia = iaAttiva(), av = avvisiDi(IO);
  const t = temaScelto();
  let h = `<div class="sub-cap"><button type="button" class="indietro" id="imB" aria-label="Torna a Gruppo">${ic('indietro', 22, 2)}</button><div><h1>Impostazioni</h1></div></div>`;
  if (ANTEPRIMA) h += '<div class="nota">Questa è l\'anteprima: i dati restano solo in questa pagina. L\'app vera si installa e si sincronizza tra i dispositivi.</div>';
  h += `<button type="button" class="account" id="imAcc">${io ? avatar(io, idxP(IO), 'xl') : `<span class="av xl" style="background:var(--av1);color:var(--av1-tx)">${esc((CHI || '?').slice(0, 1).toUpperCase())}</span>`}<span class="t"><b>${esc(CHI || 'Account')}</b><small>${server ? 'Account e password' : 'Solo su questo dispositivo'}</small></span>${ic('avanti', 18, 2)}</button>`;
  h += `<section aria-labelledby="aspetto" style="display:flex;flex-direction:column;gap:6px"><h2 id="aspetto" class="sez" style="margin:0">Aspetto</h2><div class="seg alto" role="radiogroup" aria-labelledby="aspetto">${TEMI.map(([k, n]) => `<button type="button" role="radio" data-tema="${k}" aria-checked="${t === k}" class="${t === k ? 'on' : ''}">${n}</button>`).join('')}</div></section>`;
  // Notifiche: una sola voce; dentro si scelgono i tipi di avviso
  const tipiAv = Object.keys(AVVISI_BASE), nOn = tipiAv.filter(k => av[k]).length;
  const statoTel = !ANTEPRIMA && G ? (notificheAttive() ? 'attive qui' : notificheSpente() ? 'spente qui' : 'da attivare') : '';
  h += `<section aria-labelledby="notif" style="display:flex;flex-direction:column;gap:6px"><h2 id="notif" class="sez" style="margin:0">Notifiche</h2><div class="menu-righe">
    <button type="button" id="imNotif">${ic('campana', 20, 1.8)}<span class="t"><b>Notifiche</b><small>${nOn === tipiAv.length ? 'Tutti i tipi' : nOn ? nOn + ' tipi su ' + tipiAv.length : 'Nessun tipo'}${statoTel ? ' · ' + statoTel : ''}</small></span><span class="v ${notificheAttive() ? 'on' : ''}">${notificheAttive() ? 'Attive' : 'Scegli'}</span>${ic('avanti', 18, 2)}</button></div></section>`;
  if (server && G && IO) h += `<section aria-labelledby="colleg" style="display:flex;flex-direction:column;gap:6px"><h2 id="colleg" class="sez" style="margin:0">Calendario e Siri</h2><div class="menu-righe">
    <button type="button" id="imCal">${ic('calendario', 20, 1.8)}<span class="t"><b>Calendario del telefono</b><small>L'agenda compare nel Calendario dell'iPhone, con gli avvisi</small></span>${ic('avanti', 18, 2)}</button>
    <button type="button" id="imSiri">${ic('microfono', 20, 1.8)}<span class="t"><b>Siri e Comandi Rapidi</b><small>Un solo comando: «Ehi Siri, Casa» e poi cosa vuoi</small></span>${ic('avanti', 18, 2)}</button></div></section>`;
  h += `<section aria-labelledby="altro" style="display:flex;flex-direction:column;gap:6px"><h2 id="altro" class="sez" style="margin:0">App</h2><div class="menu-righe">
    ${!ANTEPRIMA ? `<button type="button" id="imIA"><span class="t"><b>Intelligenza artificiale</b></span><span class="v">${ia.prov === 'nessuna' ? 'Nessuna' : esc(NOMI_IA[ia.prov] || ia.prov) + (ia.condivisa && ia.prov !== 'server' ? ' · del gruppo' : '')}</span>${ic('avanti', 18, 2)}</button>` : ''}
    ${!(ANTEPRIMA && !cifreOk) ? `<button type="button" id="imPin"><span class="t"><b>PIN e Face ID</b></span><span class="v ${pinImpostato() ? 'on' : ''}">${pinImpostato() ? 'Attivo' : 'Non attivo'}</span>${ic('avanti', 18, 2)}</button>` : ''}
    <button type="button" id="imPiano"><span class="t"><b>Piano alimentare</b></span><span class="v">${IO && pianoDi(IO)?.giorni?.length ? 'Cambia PDF' : 'Carica PDF'}</span>${ic('avanti', 18, 2)}</button>
    <button type="button" id="imOrari"><span class="t"><b>Orari dei pasti</b></span><span class="v">Cena alle ${esc(oraDi('Cena'))}</span>${ic('avanti', 18, 2)}</button>
    ${installata() ? '' : `<button type="button" id="imInst"><span class="t"><b>Installa l'app</b></span><span class="v">${ios() ? 'Schermata Home' : 'Installa'}</span>${ic('avanti', 18, 2)}</button>`}</div></section>`;
  h += ANTEPRIMA ? '' : server ? `<button type="button" class="btn danger" id="esci">Esci dall'account</button>` : `<button type="button" class="btn bordo" id="coll">Collega il server per condividere</button>`;
  h += `<p class="by" style="text-align:center;margin:0 0 12px">${NOME_APP} · versione ${window.VERSIONE || ''}</p>`;
  el.innerHTML = h;
  legaSicurezza();
  $('imB').onclick = () => vai('gruppo');
  $('imAcc').onclick = foglioAccount;
  $('imNotif').onclick = foglioNotifiche;
  if ($('imIA')) $('imIA').onclick = foglioIA;
  if ($('imPin')) $('imPin').onclick = foglioSicurezza;
  $('imPiano').onclick = () => { personaPiano = IO || personaPiano; vai('piano'); renderPiano(); $('pdf').click(); };
  $('imOrari').onclick = foglioOrari;
  if ($('imCal')) $('imCal').onclick = () => foglioCollega('calendario');
  if ($('imSiri')) $('imSiri').onclick = () => foglioCollega('siri');
  if ($('imInst')) $('imInst').onclick = async () => {
    if (installaEvt) { installaEvt.prompt(); await installaEvt.userChoice.catch(() => {}); installaEvt = null; return renderImp(); }
    foglio(`<h2>Installa l'app</h2><p class="q" style="line-height:1.5">${ios() ? 'Su iPhone e iPad: apri questa pagina in Safari, tocca Condividi e poi <b>Aggiungi alla schermata Home</b>.' : 'Su PC con Chrome o Edge: clicca l\'icona di installazione a destra nella barra degli indirizzi. Su Android: menu ⋮ → <b>Installa app</b>.'}</p>`);
  };
  if ($('esci')) $('esci').onclick = () => conferma('Uscire dall\'account?', 'Su questo dispositivo dovrai accedere di nuovo con email e password.', 'Esci', async () => { await scollegaDispositivo().catch(() => {}); await ST.esci(); SS.del('chi'); LS.del('chi'); LS.del('utente'); LS.del('gruppo'); location.reload(); }, true);
  if ($('coll')) $('coll').onclick = () => conferma('Collegare il server?', 'I dati salvati solo su questo dispositivo non vengono spostati: nel nuovo spazio condiviso ricominci da capo.', 'Continua', () => { LS.del('modo'); LS.del('gruppo'); G = null; benvenuto(); });
}

function foglioAccount() {
  const server = ST && ST.modo === 'supabase';
  foglio(`<h2>Account</h2><p class="q" style="margin:0 0 12px">${server ? 'Accesso con ' + esc(LS.get('email') || 'email') : 'Solo su questo dispositivo'} · nome: ${esc(CHI || '—')}</p>
    <div class="menu-righe"><button type="button" id="acN">${ic('matita', 20, 1.8)}<span class="t"><b>Cambia nome</b><small>Le tue modifiche sono firmate con questo nome</small></span>${ic('avanti', 18, 2)}</button>
    ${server && !ANTEPRIMA ? `<button type="button" id="pwBtn">${ic('lucchetto', 20, 1.8)}<span class="t"><b>${LS.get('pw') ? 'Cambia password' : 'Imposta una password'}</b><small>Per rientrare senza aspettare il codice via email</small></span>${ic('avanti', 18, 2)}</button>` : ''}</div>`);
  $('acN').onclick = () => chiedi('Il tuo nome', 'Le tue modifiche saranno firmate con questo nome.', CHI, 'Salva', n => { n = n.trim(); if (!n) return; CHI = n; SS.set('chi', n); LS.set('chi', n); const nomi = LS.getJ('nomi', []); if (!nomi.includes(n)) { nomi.push(n); LS.setJ('nomi', nomi); } renderImp(); });
  if ($('pwBtn')) $('pwBtn').onclick = async () => { await formPassword(LS.get('pw') ? 'Nuova password' : 'Scegli una password'); renderImp(); };
}
function foglioSicurezza() { foglio(`<div id="sicFoglio">${htmlSicurezza().replace('<h2 class="sez">Sicurezza</h2>', '<h2>PIN e Face ID</h2>')}</div>`); legaSicurezza(); }
function foglioOrari() {
  const o = orari();
  foglio(`<h2>Orari dei pasti</h2><p class="q" style="line-height:1.5;margin:4px 0 8px">Servono per capire qual è il prossimo pasto. Valgono su questo dispositivo.</p>` +
    Object.keys(ORARI_BASE).map((t, i) => `<label class="lb" for="or${i}">${t}</label><input id="or${i}" type="time" value="${esc(o[t])}" data-or="${esc(t)}">`).join('') +
    `<button class="btn" id="orS" type="button" style="margin-top:12px">Salva</button><button class="btn ghost" id="orR" type="button">Torna agli orari di base</button>`);
  $('orS').onclick = () => { const n = {}; $('pop').querySelectorAll('[data-or]').forEach(i => { if (i.value) n[i.dataset.or] = i.value; }); LS.setJ('orari', n); chiudi(); toast('Orari salvati ✓'); renderTutto(); };
  $('orR').onclick = () => { LS.del('orari'); chiudi(); renderTutto(); };
}
// Chiave mascherata: si vedono solo inizio e fine
const chiaveCorta = k => !k ? '' : k.length <= 10 ? '••••' : k.slice(0, 4) + '••••' + k.slice(-4);
async function salvaChiavePersonale(prov, chiave) {
  if (prov && chiave) { LS.set('aiProv', prov); LS.set('gKey', chiave); } else if (prov === 'off') { LS.set('aiProv', 'off'); LS.del('gKey'); } else { LS.del('aiProv'); LS.del('gKey'); }
  // copia nel proprio account, così resta anche cambiando telefono o se il browser cancella i dati
  try { await ST.salvaChiaveIA(prov ? { prov, chiave: chiave || '' } : null); return true; } catch (e) { return false; }
}
// All'accesso: se su questo telefono la chiave non c'è più, si riprende quella salvata nell'account
async function ripristinaChiaveIA() {
  if (!ST || LS.get('gKey') || LS.get('aiProv') === 'off') return;
  try { const v = await ST.chiaveIA(); if (v && v.prov === 'off') LS.set('aiProv', 'off'); else if (v && v.prov && v.chiave) { LS.set('aiProv', v.prov); LS.set('gKey', v.chiave); } } catch (e) {}
}
function foglioIA(modifica) {
  const gr = D.stato && D.stato.ia, provP = LS.get('aiProv'), chiaveP = LS.get('gKey');
  const pers = provP && provP !== 'nessuna' && provP !== 'off' && chiaveP;
  const nomeProv = v => (PROVIDER.find(p => p[0] === v) || [])[1] || v;
  const SUGG = { gemini: 'Chiave su aistudio.google.com/apikey. Legge anche i PDF scansionati, ma ora può richiedere crediti a pagamento.', groq: 'Chiave gratuita su console.groq.com/keys. Crea piatti e ricette senza costi. Legge solo PDF con testo selezionabile (non scansioni o foto).', openai: 'A pagamento. Chiave su platform.openai.com/api-keys.', claude: 'A pagamento. Chiave su console.anthropic.com.' };
  const intro = `<h2>Intelligenza artificiale</h2><p class="q" style="margin:0 0 6px;line-height:1.5">Serve per proporre piatti e ricette, per l'Assistente e per leggere i PDF che l'app non riconosce da sola. È facoltativa: senza, l'app propone comunque una ricetta base con gli alimenti del pasto.</p>
    ${LS.get('iaServer') === 'si' && ST && ST.modo === 'supabase' ? `<div class="info-verde" style="margin:6px 0 10px">${ic('spunta', 20, 2.2)}<span>Sul vostro server è attiva l'intelligenza artificiale di Tablemates (Groq, gratuita): non serve inserire nessuna chiave. Una chiave personale qui sotto ha la precedenza.</span></div>` : ''}
    ${gr && gr.chiave ? `<div class="nota" style="margin:6px 0 10px">Il gruppo usa ${esc(nomeProv(gr.prov))}, condivisa da ${esc(gr.da || '?')}.${pers && chiaveP !== gr.chiave ? ' Su questo dispositivo usi invece la tua chiave personale.' : ''}</div>` : ''}`;
  if (pers && !modifica) {
    foglio(intro + `<div class="menu-righe" style="margin-top:6px"><div><span class="t" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><b>${esc(nomeProv(provP))}</b><small class="num" style="color:var(--sub)">Chiave salvata · ${esc(chiaveCorta(chiaveP))}</small></span>${ic('spunta', 20, 2.4).replace('class="ic"', 'class="ic" style="color:var(--acc-text)"')}</div></div>
      <p class="by" style="margin:8px 0 12px;line-height:1.45">Resta salvata su questo telefono e nel tuo account: non devi reinserirla.</p>
      <button class="btn" id="iaMod" type="button">${ic('matita', 18)}Modifica chiave</button>
      <button class="btn danger" id="iaDel" type="button">${ic('cestino', 18)}Elimina chiave</button>
      ${gr && gr.chiave && gr.chiave === chiaveP ? '<button class="btn ghost" id="svX" type="button">Smetti di condividerla con il gruppo</button>' : ''}`);
    $('iaMod').onclick = () => foglioIA(true);
    $('iaDel').onclick = () => conferma('Eliminare la chiave?', 'Verrà tolta da questo telefono e dal tuo account.' + (gr && gr.chiave && gr.chiave !== chiaveP ? ' Userai quella del gruppo.' : ''), 'Elimina', async () => {
      if (gr && gr.chiave === chiaveP && G) { D.stato.ia = { prov: 'nessuna', chiave: '', da: CHI }; await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)); }
      await salvaChiavePersonale(null); toast('Chiave eliminata'); renderTutto();
    }, true);
  } else {
    const sel = (provP === 'off' ? 'nessuna' : provP) || (gr && gr.chiave ? gr.prov : 'groq');
    foglio(intro + `<label class="lb" for="ap">Servizio</label><select id="ap">${PROVIDER.map(([v, n]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <p class="by" id="aph" style="margin:6px 0 0;line-height:1.45"></p>
      <div id="gkBox"><label class="lb" for="gk">Chiave API</label><div style="display:flex;gap:8px"><input id="gk" type="password" placeholder="Incolla la chiave" value="${esc(chiaveP || '')}" autocomplete="off" spellcheck="false" style="flex:1;min-width:0"><button class="btn ghost" id="gkV" type="button" style="width:auto;margin:0;padding:0 14px" aria-label="Mostra la chiave">${ic('occhio', 18)}</button></div></div>
      ${G && ST && ST.modo === 'supabase' ? `<label id="shBox" style="display:flex;gap:10px;align-items:flex-start;margin:10px 0 4px;font-size:14px;line-height:1.45"><input type="checkbox" id="share" style="width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--acc)" ${gr && gr.chiave && gr.chiave === chiaveP ? 'checked' : ''}><span>Condividi con tutto il gruppo: chi entra con un invito userà questa intelligenza artificiale senza inserire nulla. Le persone del gruppo potranno vedere la chiave.</span></label>` : ''}
      <button class="btn" id="sv" type="button" style="margin-top:8px">Salva</button>
      ${modifica ? '<button class="btn ghost" id="iaAnn" type="button">Annulla</button>' : ''}`);
    const mostra = () => { const v = $('ap').value; $('aph').textContent = SUGG[v] || ''; $('gkBox').hidden = v === 'nessuna'; if ($('shBox')) $('shBox').hidden = v === 'nessuna'; };
    $('ap').addEventListener('change', mostra); mostra();
    $('gkV').onclick = () => { const i = $('gk'); i.type = i.type === 'password' ? 'text' : 'password'; };
    if ($('iaAnn')) $('iaAnn').onclick = () => foglioIA();
    $('sv').onclick = async () => {
      const prov = $('ap').value, chiave = $('gk').value.trim().replace(/\s+/g, ''), cond = $('share') && $('share').checked && !$('shBox').hidden;
      if (prov !== 'nessuna' && !chiave) return toast('Incolla la chiave API');
      $('sv').disabled = true;
      if (prov === 'nessuna') { await salvaChiavePersonale('off'); chiudi(); toast('Intelligenza artificiale disattivata su questo dispositivo'); return renderTutto(); }
      const nelConto = await salvaChiavePersonale(prov, chiave);
      if (cond && G) { D.stato.ia = { prov, chiave, da: CHI }; if (!(await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)))) { $('sv').disabled = false; return; } }
      else if (G && gr && gr.chiave && gr.chiave === chiaveP && $('share')) { D.stato.ia = { prov: 'nessuna', chiave: '', da: CHI }; await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)); }
      chiudi(); toast(cond ? 'Chiave salvata e condivisa con il gruppo ✓' : nelConto && ST.modo === 'supabase' ? 'Chiave salvata ✓ (anche nel tuo account)' : 'Chiave salvata su questo dispositivo ✓'); renderTutto();
    };
  }
  if ($('svX')) $('svX').onclick = () => conferma('Smettere di condividerla?', 'Chi non ha una sua chiave non potrà più usare l\'intelligenza artificiale. Tu continui a usarla.', 'Smetti di condividere', async () => {
    D.stato.ia = { prov: 'nessuna', chiave: '', da: CHI }; await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)); renderTutto();
  }, true);
}
// Link di invito: se il server non è scritto in config.js, viaggia nel link (la chiave publishable è pubblica per natura),
// così chi lo apre entra subito senza inserire URL o chiavi
function linkInvito(cod) {
  let l = location.origin + location.pathname + '?invito=' + encodeURIComponent(cod);
  if (!(window.CFG && CFG.sbUrl && CFG.sbKey) && S('sbUrl') && S('sbKey')) l += '&srv=' + encodeURIComponent(btoa(JSON.stringify({ u: S('sbUrl'), k: S('sbKey') })));
  return l;
}
async function invita() {
  try {
    const cod = await ST.codiceInvito(G.id), link = linkInvito(cod);
    if (navigator.share) { try { await navigator.share({ title: NOME_APP, text: `Entra nel gruppo "${G.nome}" su ${NOME_APP}`, url: link }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    foglio(`<h2>Invita nel gruppo</h2><p class="q" style="line-height:1.5">Manda questo link a chi vuoi far entrare in "${esc(G.nome)}". Entrerà con la sua email${D.stato.ia && D.stato.ia.chiave ? ' e userà la stessa intelligenza artificiale del gruppo' : ''}.</p><input id="lnk" readonly value="${esc(link)}" style="background:var(--card)"><button class="btn" id="cp" type="button" style="margin-top:8px">Copia link</button>`);
    $('cp').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copiato ✓'); } catch (e) { $('lnk').select(); toast('Seleziona e copia il link'); } };
  } catch (e) { toast(e.message); }
}
function modificaGruppo() {
  foglio(`<h2>Gruppo</h2><label class="lb" for="mgN">Nome</label><input id="mgN" value="${esc(G.nome)}" style="background:var(--card)">
    <label class="lb" for="mgV">Valuta dei conti</label><select id="mgV" style="background:var(--card)" ${D.movimenti.length ? 'disabled' : ''}>${Conti.VALUTE.concat(Conti.VALUTE.includes(VG()) ? [] : [VG()]).map(v => `<option ${v === VG() ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <p class="by">${D.movimenti.length ? 'La valuta si può cambiare solo finché non ci sono spese registrate.' : 'Le spese in altre valute vengono convertite in questa.'}</p>
    <button class="btn" id="mgS" type="button">Salva</button>`);
  $('mgS').onclick = async () => {
    const n = $('mgN').value.trim(), v = $('mgV').value; if (!n) return;
    chiudi(); G.nome = n; G.valuta = v; LS.set('gnome', n); LS.set('gvaluta', v); renderTutto();
    await scrivi(() => ST.aggiornaGruppo(G.id, { nome: n, valuta: v }));
  };
}

// ---------- Calendario del telefono e Siri (funzione "collega" su Supabase) ----------
// Ogni persona ha un link personale con un codice segreto: il calendario dell'iPhone lo legge da solo ogni tanto,
// i Comandi Rapidi lo usano per far rispondere Siri. Il codice si può rigenerare: il vecchio smette di funzionare.
const urlFunzione = nome => S('sbUrl').replace(/\/+$/, '') + '/functions/v1/' + nomeFn(nome);
const mioPonte = () => { if (!IO) return ''; const k = Object.keys(D.stato).find(k => k.startsWith('ponte:') && D.stato[k] && D.stato[k].pid === IO); return k ? k.slice(6) : ''; };
async function creaPonte(rigenera) {
  const vecchio = mioPonte(); if (vecchio && !rigenera) return vecchio;
  const b = new Uint8Array(30); crypto.getRandomValues(b);
  const t = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const v = { pid: IO, creato: new Date().toISOString() };
  if (!(await scrivi(() => ST.salvaStato(G.id, 'ponte:' + t, v)))) return '';
  D.stato['ponte:' + t] = v;
  if (vecchio) { D.stato['ponte:' + vecchio] = null; await scrivi(() => ST.salvaStato(G.id, 'ponte:' + vecchio, null)); }
  return t;
}
async function copia(t, cosa) {
  try { await navigator.clipboard.writeText(t); toast((cosa || 'Link') + ' copiato ✓'); }
  catch (e) { chiedi('Copia', 'Tieni premuto sul testo e scegli Copia.', t, 'Fatto', () => {}); }
}
// Siri: un solo comando. La guida riproduce le azioni di Comandi Rapidi come appaiono sull'iPhone (in italiano).
const tk = t => `<span class="sg-tk">${t}</span>`, var_ = (t, c) => `<span class="sg-var ${c || ''}">${t}</span>`;
const GUIDA_SIRI = () => `
  <ol class="sg">
    <li><b>Copia il tuo link</b><span>Tocca il pulsante verde qui sopra. Il link finisce con <code>&amp;a=chiedi</code>.</span></li>
    <li><b>Crea il comando</b><span>Apri l'app <b>Comandi Rapidi</b> e tocca <b>+</b> in alto a destra. Tocca il nome in alto → <b>Rinomina</b> e scrivi <b>Casa</b>: è la parola che dirai a Siri («Tablemates» Siri non lo capisce).</span>
      <div class="sg-tel"><div class="sg-tit">${var_('', 'ico')}Casa ⌄</div></div></li>
    <li><b>Prima azione: la domanda</b><span>Tocca <b>Cerca azioni</b> in basso, scrivi <b>Richiedi input</b> e toccalo. Poi tocca il testo blu e scrivi la domanda, per esempio <b>Cosa vuoi?</b></span>
      <div class="sg-tel"><div class="sg-az"><i class="sg-i" style="background:#5ac8fa">💬</i>Richiedi ${tk('Testo')} con ${tk('Cosa vuoi?')}</div></div></li>
    <li><b>Seconda azione: manda la frase a Tablemates</b><span>Cerca <b>Ottieni contenuti dell'URL</b> e toccalo. Tocca il campo blu, cancella quello che c'è e <b>incolla il link</b>. Poi tocca la freccia <b>›</b> e imposta:</span>
      <span class="sg-sub">· Metodo: <b>POST</b><br>· Corpo della richiesta: <b>Modulo</b><br>· <b>Aggiungi nuovo campo</b> → <b>Testo</b><br>· Chiave: scrivi <b>testo</b> (minuscolo)<br>· Nel campo a destra tocca e scegli la variabile <b>Richiedi input</b> (pallino blu)</span>
      <div class="sg-tel"><div class="sg-az sg-col"><div><i class="sg-i" style="background:#34c759">⬇︎</i>Ottieni contenuti di ${tk('https://…/collega?t=…&amp;a=chiedi')}</div>
        <div class="sg-riga"><span>Metodo</span>${tk('POST')}</div><div class="sg-riga"><span>Corpo della richiesta</span>${tk('Modulo')}</div>
        <div class="sg-riga"><span>testo</span>${var_('Richiedi input', 'blu')}</div></div></div></li>
    <li><b>Terza azione: Siri legge la risposta</b><span>Cerca <b>Leggi ad alta voce</b> e toccalo. Nel campo scegli la variabile <b>Contenuti URL</b> (pallino verde). Se vuoi vedere anche il testo, aggiungi pure <b>Mostra avviso</b> con <b>Contenuti URL</b>.</span>
      <div class="sg-tel"><div class="sg-az"><i class="sg-i" style="background:#ff3b30">🔊</i>Leggi ad alta voce ${var_('Contenuti URL', 'verde')}</div></div></li>
    <li><b>Prova</b><span>Tocca <b>▶</b> in basso a destra e scrivi «cosa devo comprare»: deve rispondere con la lista. Poi prova con la voce: <b>«Ehi Siri, Casa»</b>, e quando chiede «Cosa vuoi?» rispondi.</span></li>
  </ol>
  <div class="sg-frasi"><b>Cosa puoi dire</b><span>«aggiungi latte e pane alla spesa» · «cosa devo comprare» · «cosa mangio oggi» · «cosa mangio domani a cena» · «ho pagato 24,50 per la pizza»</span></div>
  <div class="sg-frasi"><b>Se Siri mostra la risposta ma non parla</b><span>Togli il silenzioso e alza il volume. Poi in <b>Impostazioni → Siri → Risposte di Siri</b> scegli l'opzione che fa parlare sempre Siri. Se Siri cerca su internet invece di aprire il comando, rinominalo con un'altra parola semplice (es. «Tavola») oppure di' «Ehi Siri, esegui Casa».</span></div>`;
async function foglioCollega(cosa) {
  if (!ST || ST.modo !== 'supabase' || !IO) return toast('Serve il server Supabase e una persona del gruppo');
  const t = mioPonte();
  if (!t) {
    foglio(`<h2>${cosa === 'siri' ? 'Siri e Comandi Rapidi' : 'Calendario del telefono'}</h2><p class="q" style="line-height:1.5;margin:4px 0 12px">Serve un link personale, con un codice segreto: non mandarlo ad altri, perché chi lo ha vede la tua agenda e può aggiungere cose alla spesa. Puoi cambiarlo quando vuoi.<br><br>Prima, in Supabase va pubblicata la funzione <b>collega</b> (LEGGIMI, passo 11).</p>
      <button class="btn" id="cgC" type="button">Crea il mio link</button>`);
    $('cgC').onclick = async () => { $('cgC').disabled = true; if (await creaPonte()) foglioCollega(cosa); else $('cgC').disabled = false; };
    return;
  }
  const base = urlFunzione('collega') + '?t=' + t, ics = base + '&f=ics', webcal = ics.replace(/^https?:/, 'webcal:');
  const cal = `<h2>Calendario del telefono</h2><p class="q" style="line-height:1.5;margin:4px 0 12px">L'agenda di Tablemates (appuntamenti e scadenze che ti riguardano) compare nel Calendario, con gli avvisi all'orario scelto. Si aggiorna da sola; quello che aggiungi nel Calendario dell'iPhone però non torna in Tablemates.</p>
    <a class="btn" id="cgW" href="${esc(webcal)}">${ic('calendario', 18)}Aggiungi al calendario</a>
    <button class="btn ghost" id="cgI" type="button">${ic('link', 18)}Copia il link (Google Calendar, Outlook)</button>
    <p class="by" style="margin:8px 0 0;line-height:1.5">Se il tasto non apre il Calendario: Impostazioni dell'iPhone → Calendario → Account → Aggiungi account → Altro → <b>Aggiungi calendario iscritto</b> e incolla il link. Su Google Calendar: Altri calendari → Da URL.</p>`;
  const siri = `<h2>Siri e Comandi Rapidi</h2><p class="q" style="line-height:1.5;margin:4px 0 10px">Un solo comando per tutto: dici «Ehi Siri, Casa» e poi cosa vuoi. Ci vogliono 5 minuti, una volta sola.</p>
    <button class="btn" id="cgS" type="button">${ic('link', 18)}Copia il tuo link</button>
    <p class="by" style="margin:6px 0 0;line-height:1.45">È personale, con un codice segreto: non mandarlo ad altri.</p>${GUIDA_SIRI()}`;
  foglio(`${cosa === 'siri' ? siri : cal}
    <button class="btn bordo" id="cgP" type="button" style="margin-top:12px">Prova il collegamento</button>
    <button class="link-txt rosso" id="cgR" type="button" style="margin-top:4px">Crea un nuovo link (il vecchio smette di funzionare)</button>`);
  if ($('cgI')) $('cgI').onclick = () => copia(ics);
  if ($('cgS')) $('cgS').onclick = () => copia(base + '&a=chiedi', 'Link del comando');
  $('cgP').onclick = async () => {
    $('cgP').disabled = true;
    try { const r = await fetch(base + '&a=prova'), x = await r.text(); toast(r.ok ? x : r.status === 401 && /JWT|jwt|Authorization/.test(x) ? 'Togli la spunta "Verify JWT" alla funzione collega in Supabase' : r.status === 404 ? 'La funzione "collega" non è ancora pubblicata su Supabase' : x); }
    catch (e) { toast('La funzione "collega" non risponde: è pubblicata su Supabase?'); }
    $('cgP').disabled = false;
  };
  $('cgR').onclick = () => conferma('Creare un nuovo link?', 'Il calendario iscritto e i comandi di Siri con il link vecchio smetteranno di funzionare: andranno aggiornati.', 'Crea nuovo link', async () => { if (await creaPonte(true)) foglioCollega(cosa); }, true);
}

// Foglio «Notifiche»: avvisi su questo telefono e, per ogni tipo, acceso o spento
const TIPI_AVVISO = [
  ['tavola', 'Pasti e presenze', 'Ci sei a cena? alle 17:00, pasti comuni e chi ci sarà'],
  ['spesa', 'Lista della spesa', 'Quando qualcuno aggiunge o aggiorna la lista e tocca «Avvisa»'],
  ['conti', 'Conti', 'Nuove spese e rimborsi, modifiche e saldo settimanale'],
  ['agenda', 'Agenda', 'Appuntamenti, scadenze e promemoria che ti riguardano'],
  ['piano', 'Piano e dieta', 'Quando qualcuno carica o aggiorna una dieta o prepara i piatti'],
  ['gruppo', 'Gruppo', 'Quando entra, esce o cambia una persona del gruppo']
];
function foglioNotifiche() {
  const server = ST && ST.modo === 'supabase';
  const disegna = () => {
    const av = avvisiDi(IO), on = notificheAttive();
    foglio(`<h2>Notifiche</h2><p class="q" style="line-height:1.5;margin:4px 0 10px">Scegli quali avvisi ricevere. Valgono per te, su tutti i tuoi telefoni.</p>
      ${!ANTEPRIMA && G ? `<div class="menu-righe"><button type="button" id="ntTel">${ic('campana', 20, 1.8)}<span class="t"><b>Avvisi su questo telefono</b><small>${on ? (pushPossibile() ? 'Attivi anche ad app chiusa' : 'Attivi mentre l\'app è aperta') : notificheSpente() ? 'Spenti: tocca per riattivarli' : ios() && !installata() ? 'Su iPhone servono con l\'app nella schermata Home' : 'Tocca e poi «Consenti»'}</small></span><span class="v ${on ? 'on' : ''}">${on ? 'Attivi' : 'Attiva'}</span></button></div>` : ''}
      <label class="lb" style="margin-top:14px">Cosa ti avvisa</label>
      <div class="menu-righe">${TIPI_AVVISO.map(([k, n, d]) => `<div><span class="t"><b>${n}</b><small>${d}</small></span><button type="button" class="switch" role="switch" aria-checked="${!!av[k]}" aria-label="${n}" data-av="${k}"></button></div>`).join('')}</div>
      ${server && G ? `<div class="menu-righe" style="margin-top:12px"><button type="button" id="ntDiag">${ic('gruppo', 20, 1.8)}<span class="t"><b>Chi riceve gli avvisi</b><small>Controlla i telefoni del gruppo e manda una prova</small></span>${ic('avanti', 18, 2)}</button></div>` : ''}`);
    $('pop').querySelectorAll('[data-av]').forEach(b => b.onclick = async () => { vibra(); const k = b.dataset.av, v = !avvisoAttivo(k); b.setAttribute('aria-checked', v); await salvaAvviso(k, v); });
    if ($('ntTel')) $('ntTel').onclick = () => on ? conferma('Spegnere gli avvisi su questo telefono?', 'Non riceverai più avvisi su questo telefono. Puoi riattivarli quando vuoi.', 'Spegni', async () => { await disattivaNotifiche(); renderImp(); }) : attivaNotifiche().then(() => { renderImp(); if ($('ntTel')) disegna(); });
    if ($('ntDiag')) $('ntDiag').onclick = foglioDiagnosiNotifiche;
  };
  if (!IO) return toast('Prima indica chi sei nel gruppo');
  disegna();
}
