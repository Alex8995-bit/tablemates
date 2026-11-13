// Impostazioni (dall'ingranaggio della scheda Gruppo): account, aspetto, notifiche, intelligenza artificiale, PIN e Face ID, orari, installazione.
let installaEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installaEvt = e; renderImp(); });
addEventListener('appinstalled', () => { installaEvt = null; toast('App installata ✓'); renderImp(); });
const installata = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const PROVIDER = [['nessuna', 'Nessuna'], ['gemini', 'Google Gemini (gratuito)'], ['groq', 'Groq (gratuito)'], ['openai', 'ChatGPT (OpenAI)'], ['claude', 'Claude (Anthropic)']];

function renderImp() {
  const el = $('t-imp'); if (!el) return;
  const io = IO ? D.partecipanti.find(p => p.id === IO) : null, server = ST && ST.modo === 'supabase';
  const ia = iaAttiva(), av = Object.assign({ tavola: true, spesa: true, conti: false }, LS.getJ('avvisi', {}));
  const t = temaScelto();
  let h = `<div class="sub-cap"><button type="button" class="indietro" id="imB" aria-label="Torna a Gruppo">${ic('indietro', 22, 2)}</button><div><h1>Impostazioni</h1></div></div>`;
  if (ANTEPRIMA) h += '<div class="nota">Questa è l\'anteprima: i dati restano solo in questa pagina. L\'app vera si installa e si sincronizza tra i dispositivi.</div>';
  h += `<button type="button" class="account" id="imAcc">${io ? avatar(io, idxP(IO), 'xl') : `<span class="av xl" style="background:var(--av1);color:var(--av1-tx)">${esc((CHI || '?').slice(0, 1).toUpperCase())}</span>`}<span class="t"><b>${esc(CHI || 'Account')}</b><small>${server ? 'Account e password' : 'Solo su questo dispositivo'}</small></span>${ic('avanti', 18, 2)}</button>`;
  h += `<section aria-labelledby="aspetto" style="display:flex;flex-direction:column;gap:6px"><h2 id="aspetto" class="sez" style="margin:0">Aspetto</h2><div class="seg alto" role="radiogroup" aria-labelledby="aspetto">${TEMI.map(([k, n]) => `<button type="button" role="radio" data-tema="${k}" aria-checked="${t === k}" class="${t === k ? 'on' : ''}">${n}</button>`).join('')}</div></section>`;
  const sw = (k, label, hint) => `<div><span class="t"><b>${label}</b><small>${hint}</small></span><button type="button" class="switch" role="switch" aria-checked="${!!av[k]}" aria-label="${label}" data-av="${k}"></button></div>`;
  h += `<section aria-labelledby="notif" style="display:flex;flex-direction:column;gap:6px"><h2 id="notif" class="sez" style="margin:0">Notifiche</h2><div class="menu-righe">
    ${sw('tavola', 'Ci sei a cena?', 'Te lo chiede ogni giorno dalle 17:00, quando apri l\'app')}
    ${sw('spesa', 'Novità nella spesa', 'Quando qualcuno aggiunge o compra')}
    ${sw('conti', 'Promemoria conti', 'Una volta a settimana, se c\'è un saldo')}
    ${!ANTEPRIMA && G ? `<button type="button" id="imNot">${ic('campana', 20, 1.8)}<span class="t"><b>Avvisi sul telefono</b><small>${notificheAttive() ? (pushPossibile() ? 'Attivi anche ad app chiusa' : 'Attivi mentre l\'app è aperta') : ios() && !installata() ? 'Su iPhone servono con l\'app nella schermata Home' : 'Permetti all\'app di mostrare gli avvisi'}</small></span><span class="v ${notificheAttive() ? 'on' : ''}">${notificheAttive() ? 'Attivi' : 'Attiva'}</span>${ic('avanti', 18, 2)}</button>` : ''}</div></section>`;
  h += `<section aria-labelledby="altro" style="display:flex;flex-direction:column;gap:6px"><h2 id="altro" class="sez" style="margin:0">App</h2><div class="menu-righe">
    ${!ANTEPRIMA ? `<button type="button" id="imIA"><span class="t"><b>Intelligenza artificiale</b></span><span class="v">${ia.prov === 'nessuna' ? 'Nessuna' : esc(NOMI_IA[ia.prov] || ia.prov) + (ia.condivisa ? ' · del gruppo' : '')}</span>${ic('avanti', 18, 2)}</button>` : ''}
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
  el.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { const v = Object.assign({ tavola: true, spesa: true, conti: false }, LS.getJ('avvisi', {})); v[b.dataset.av] = !v[b.dataset.av]; LS.setJ('avvisi', v); vibra(); renderImp(); });
  if ($('imNot')) $('imNot').onclick = () => notificheAttive() ? conferma('Disattivare gli avvisi?', 'Non riceverai più avvisi su questo dispositivo.', 'Disattiva', disattivaNotifiche) : attivaNotifiche();
  if ($('imIA')) $('imIA').onclick = foglioIA;
  if ($('imPin')) $('imPin').onclick = foglioSicurezza;
  $('imPiano').onclick = () => { personaPiano = IO || personaPiano; vai('piano'); renderPiano(); $('pdf').click(); };
  $('imOrari').onclick = foglioOrari;
  if ($('imInst')) $('imInst').onclick = async () => {
    if (installaEvt) { installaEvt.prompt(); await installaEvt.userChoice.catch(() => {}); installaEvt = null; return renderImp(); }
    foglio(`<h2>Installa l'app</h2><p class="q" style="line-height:1.5">${ios() ? 'Su iPhone e iPad: apri questa pagina in Safari, tocca Condividi e poi <b>Aggiungi alla schermata Home</b>.' : 'Su PC con Chrome o Edge: clicca l\'icona di installazione a destra nella barra degli indirizzi. Su Android: menu ⋮ → <b>Installa app</b>.'}</p>`);
  };
  if ($('esci')) $('esci').onclick = () => conferma('Uscire dall\'account?', 'Su questo dispositivo dovrai accedere di nuovo con email e password.', 'Esci', async () => { await disattivaNotifiche().catch(() => {}); await ST.esci(); SS.del('chi'); LS.del('gruppo'); location.reload(); }, true);
  if ($('coll')) $('coll').onclick = () => conferma('Collegare il server?', 'I dati salvati solo su questo dispositivo non vengono spostati: nel nuovo spazio condiviso ricominci da capo.', 'Continua', () => { LS.del('modo'); LS.del('gruppo'); G = null; benvenuto(); });
}

function foglioAccount() {
  const server = ST && ST.modo === 'supabase';
  foglio(`<h2>Account</h2><p class="q" style="margin:0 0 12px">${server ? 'Accesso con ' + esc(LS.get('email') || 'email') : 'Solo su questo dispositivo'} · nome: ${esc(CHI || '—')}</p>
    <div class="menu-righe"><button type="button" id="acN">${ic('matita', 20, 1.8)}<span class="t"><b>Cambia nome</b><small>Le tue modifiche sono firmate con questo nome</small></span>${ic('avanti', 18, 2)}</button>
    ${server && !ANTEPRIMA ? `<button type="button" id="pwBtn">${ic('lucchetto', 20, 1.8)}<span class="t"><b>${LS.get('pw') ? 'Cambia password' : 'Imposta una password'}</b><small>Per rientrare senza aspettare il codice via email</small></span>${ic('avanti', 18, 2)}</button>` : ''}</div>`);
  $('acN').onclick = () => chiedi('Il tuo nome', 'Le tue modifiche saranno firmate con questo nome.', CHI, 'Salva', n => { n = n.trim(); if (!n) return; CHI = n; SS.set('chi', n); const nomi = LS.getJ('nomi', []); if (!nomi.includes(n)) { nomi.push(n); LS.setJ('nomi', nomi); } renderImp(); });
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
function foglioIA() {
  const gr = D.stato && D.stato.ia, pers = LS.get('aiProv') && LS.get('aiProv') !== 'nessuna' && LS.get('gKey');
  foglio(`<h2>Intelligenza artificiale</h2><p class="q" style="margin:0 0 6px;line-height:1.5">Serve per proporre piatti e ricette, per l'Assistente e per leggere i PDF che l'app non riconosce da sola. È facoltativa.</p>
    ${gr && gr.chiave ? `<div class="nota" style="margin:6px 0 10px">Il gruppo usa ${esc((PROVIDER.find(p => p[0] === gr.prov) || [])[1] || gr.prov)}, condivisa da ${esc(gr.da || '?')}.${pers ? ' Su questo dispositivo usi invece la tua chiave personale.' : ''}</div>` : ''}
    <label class="lb" for="ap">Servizio</label><select id="ap">${PROVIDER.map(([v, n]) => `<option value="${v}" ${((LS.get('aiProv') === 'off' ? 'nessuna' : LS.get('aiProv')) || (gr ? gr.prov : 'nessuna')) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <p class="by" id="aph" style="margin:6px 0 0;line-height:1.45"></p>
    <label class="lb" for="gk">Chiave API</label><input id="gk" type="password" placeholder="Incolla la chiave" value="${esc(LS.get('gKey') || '')}" autocomplete="off">
    ${G && ST && ST.modo === 'supabase' ? `<label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0 4px;font-size:14px;line-height:1.45"><input type="checkbox" id="share" style="width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--acc)" ${gr && gr.chiave && gr.chiave === LS.get('gKey') ? 'checked' : ''}><span>Condividi con tutto il gruppo: chi entra con un invito userà questa intelligenza artificiale senza inserire nulla. Le persone del gruppo potranno vedere la chiave.</span></label>` : ''}
    <button class="btn" id="sv" type="button" style="margin-top:8px">Salva</button>
    ${gr && gr.chiave ? '<button class="btn danger" id="svX" type="button">Smetti di condividerla con il gruppo</button>' : ''}`);
  const SUGG = { gemini: 'Chiave gratuita su aistudio.google.com/apikey. Legge direttamente il PDF, anche se è una scansione.', groq: 'Chiave gratuita su console.groq.com/keys. Legge solo PDF con testo selezionabile (non scansioni o foto).', openai: 'A pagamento. Chiave su platform.openai.com/api-keys.', claude: 'A pagamento. Chiave su console.anthropic.com.' };
  const mostra = () => { $('aph').textContent = SUGG[$('ap').value] || ''; };
  $('ap').addEventListener('change', mostra); mostra();
  $('sv').onclick = async () => {
    const prov = $('ap').value, chiave = $('gk').value.trim(), cond = $('share') && $('share').checked;
    if (prov !== 'nessuna' && !chiave) return toast('Incolla la chiave API');
    if (cond && chiave && prov !== 'nessuna') {
      D.stato.ia = { prov, chiave, da: CHI };
      if (!(await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)))) return;
      LS.del('aiProv'); LS.del('gKey'); // si usa quella del gruppo
      toast('Salvata e condivisa con il gruppo ✓');
    } else { LS.set('aiProv', prov === 'nessuna' ? 'off' : prov); LS.set('gKey', chiave); toast(prov === 'nessuna' ? 'Intelligenza artificiale disattivata su questo dispositivo' : 'Salvata su questo dispositivo ✓'); }
    chiudi(); renderTutto();
  };
  if ($('svX')) $('svX').onclick = () => conferma('Smettere di condividerla?', 'Chi non ha una sua chiave non potrà più usare l\'intelligenza artificiale.', 'Smetti di condividere', async () => {
    D.stato.ia = { prov: 'nessuna', chiave: '', da: CHI }; await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)); renderTutto();
  }, true);
}
async function invita() {
  try {
    const cod = await ST.codiceInvito(G.id), link = location.origin + location.pathname + '?invito=' + cod;
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
