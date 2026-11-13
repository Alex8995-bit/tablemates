// Scheda Impostazioni: gruppo e inviti, notifiche, intelligenza artificiale (personale o condivisa), installazione, account.
let installaEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installaEvt = e; renderImp(); });
addEventListener('appinstalled', () => { installaEvt = null; toast('App installata ✓'); renderImp(); });
const installata = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const PROVIDER = [['nessuna', 'Nessuna'], ['gemini', 'Google Gemini'], ['openai', 'ChatGPT (OpenAI)'], ['claude', 'Claude (Anthropic)']];

function renderImp() {
  const el = $('t-imp'); if (!el) return;
  let h = '<div class="testa"><p>' + NOME_APP + '</p><h1>Impostazioni</h1></div>';
  if (ANTEPRIMA) h += '<div class="nota">Questa è l\'anteprima: i dati restano solo in questa pagina. L\'app vera si installa e si sincronizza tra i dispositivi.</div>';
  if (G) h += `<h2 class="sez">Gruppo</h2><div class="card"><div class="riga" style="margin-bottom:10px"><span class="logo" style="width:40px;height:40px">${esc(G.nome[0].toUpperCase())}</span><span class="grow"><b style="font-size:16px">${esc(G.nome)}</b><br><span class="q">${D.partecipanti.length} persone · ${D.conti.length} conti · ${VG()}${IO ? ' · tu sei ' + esc(nomeP(IO)) : ''}</span></span></div>
    ${ST && ST.modo === 'supabase' ? `<button class="btn" id="invG" type="button">${ic('utenti', 18)}Invita nel gruppo</button>` : ''}
    <button class="btn ghost" id="modG" type="button">Rinomina o cambia valuta</button>
    <button class="btn ghost" id="cambiaG" type="button">Cambia o crea gruppo</button>
    <button class="btn danger" id="esciG" type="button">Esci dal gruppo</button></div>`;
  // Notifiche
  if (!ANTEPRIMA && G) {
    const att = notificheAttive();
    h += `<h2 class="sez">Notifiche</h2><div class="card"><p class="q" style="margin:0 0 10px;line-height:1.5">${att ? (pushPossibile() ? 'Ricevi un avviso quando qualcuno aggiunge una spesa o un pasto, anche ad app chiusa.' : 'Ricevi un avviso mentre l\'app è aperta. Per riceverli anche ad app chiusa va completato il passo "Notifiche" della guida.') : 'Ricevi un avviso quando qualcuno del gruppo aggiunge una spesa, un rimborso o un pasto.'}</p>
      ${att ? `<button class="btn bordo" id="notOff" type="button">${ic('campana', 18)}Disattiva le notifiche</button>` : `<button class="btn" id="notOn" type="button">${ic('campana', 18)}Attiva le notifiche</button>`}
      ${ios() && !installata() ? '<p class="by" style="margin:8px 0 0">Su iPhone le notifiche funzionano solo dopo aver aggiunto l\'app alla schermata Home.</p>' : ''}</div>`;
  }
  // Intelligenza artificiale
  if (!ANTEPRIMA) {
    const gr = D.stato && D.stato.ia, pers = LS.get('aiProv') && LS.get('aiProv') !== 'nessuna' && LS.get('gKey');
    h += `<h2 class="sez">Intelligenza artificiale</h2><div class="card"><p class="q" style="margin:0 0 6px;line-height:1.5">Serve per leggere i PDF delle diete, proporre piatti e ricette e per l'Assistente. È facoltativa.</p>
      ${gr && gr.chiave ? `<div class="nota" style="margin:6px 0 10px">Il gruppo usa ${esc((PROVIDER.find(p => p[0] === gr.prov) || [])[1] || gr.prov)}, condivisa da ${esc(gr.da || '?')}.${pers ? ' Su questo dispositivo usi invece la tua chiave personale.' : ''}</div>` : ''}
      <label class="lb" for="ap">Servizio</label><select id="ap">${PROVIDER.map(([v, n]) => `<option value="${v}" ${((LS.get('aiProv') === 'off' ? 'nessuna' : LS.get('aiProv')) || (gr ? gr.prov : 'nessuna')) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="lb" for="gk">Chiave API</label><input id="gk" type="password" placeholder="Incolla la chiave" value="${esc(LS.get('gKey') || '')}" autocomplete="off">
      ${G && ST && ST.modo === 'supabase' ? `<label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0 4px;font-size:14px;line-height:1.45"><input type="checkbox" id="share" style="width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--acc)" ${gr && gr.chiave && gr.chiave === LS.get('gKey') ? 'checked' : ''}><span>Condividi con tutto il gruppo: chi entra con un invito userà questa intelligenza artificiale senza inserire nulla. Le persone del gruppo potranno vedere la chiave.</span></label>` : ''}
      <button class="btn" id="sv" type="button" style="margin-top:8px">Salva</button>
      ${gr && gr.chiave ? '<button class="btn danger" id="svX" type="button">Smetti di condividerla con il gruppo</button>' : ''}</div>`;
  }
  // Installazione
  h += `<h2 class="sez">Installa l'app</h2><div class="card">` + (installata() ? '<p class="q" style="margin:0">L\'app è installata su questo dispositivo.</p>'
    : installaEvt ? `<p class="q" style="margin:0 0 10px">Aggiungila al computer o al telefono: si apre in una finestra sua, come un'app.</p><button class="btn" id="inst" type="button">${ic('scarica', 18)}Installa ${NOME_APP}</button>`
    : ios() ? '<p class="q" style="margin:0;line-height:1.5">Su iPhone e iPad: apri questa pagina in Safari, tocca Condividi e poi <b>Aggiungi alla schermata Home</b>.</p>'
    : '<p class="q" style="margin:0;line-height:1.5">Su PC con Chrome o Edge: clicca l\'icona di installazione a destra nella barra degli indirizzi. Su Android: menu ⋮ → <b>Installa app</b>.</p>') + '</div>';
  h += htmlAspetto() + htmlSicurezza();
  // Account
  h += `<h2 class="sez">Account</h2><div class="card"><p class="q" style="margin:0 0 10px">${ST && ST.modo === 'supabase' ? 'Accesso con ' + esc(LS.get('email') || 'email') + ' · nome: ' + esc(CHI) : 'Solo su questo dispositivo · nome: ' + esc(CHI || '—')}</p>
    <button class="btn ghost" id="nome" type="button">Cambia nome</button>
    ${ST && ST.modo === 'supabase' && !ANTEPRIMA ? `<button class="btn ghost" id="pwBtn" type="button">${ic('lucchetto', 18)}${LS.get('pw') ? 'Cambia password' : 'Imposta una password'}</button>` : ''}
    ${ANTEPRIMA ? '' : ST && ST.modo === 'supabase' ? `<button class="btn bordo" id="esci" type="button">${ic('esci', 18)}Esci dall'account</button>` : '<button class="btn bordo" id="coll" type="button">Collega il server per condividere</button>'}</div>
    <p class="by" style="text-align:center;margin:16px 0 30px">${NOME_APP} · versione ${window.VERSIONE || ''}</p>`;
  el.innerHTML = h;
  legaSicurezza();
  if ($('pwBtn')) $('pwBtn').onclick = async () => { await formPassword(LS.get('pw') ? 'Nuova password' : 'Scegli una password'); renderImp(); };
  if ($('invG')) $('invG').onclick = invita;
  if ($('modG')) $('modG').onclick = modificaGruppo;
  if ($('cambiaG')) $('cambiaG').onclick = async () => { try { schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); } };
  if ($('esciG')) $('esciG').onclick = () => conferma('Uscire dal gruppo?', ST.modo === 'supabase' ? 'Non vedrai più pasti, spesa e conti di questo gruppo finché qualcuno non ti invita di nuovo. Le tue spese restano nei conti degli altri.' : 'Su questo dispositivo il gruppo e tutti i suoi dati verranno cancellati.', 'Esci dal gruppo', async () => {
    try { await ST.lasciaGruppo(G.id); LS.del('gruppo'); LS.del('snap_' + G.id); ST.smetti(); G = null; renderTutto(); schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); }
  }, true);
  if ($('notOn')) $('notOn').onclick = attivaNotifiche;
  if ($('notOff')) $('notOff').onclick = disattivaNotifiche;
  if ($('inst')) $('inst').onclick = async () => { installaEvt.prompt(); await installaEvt.userChoice.catch(() => {}); installaEvt = null; renderImp(); };
  if ($('sv')) $('sv').onclick = async () => {
    const prov = $('ap').value, chiave = $('gk').value.trim(), cond = $('share') && $('share').checked;
    if (prov !== 'nessuna' && !chiave) return toast('Incolla la chiave API');
    if (cond && chiave && prov !== 'nessuna') {
      D.stato.ia = { prov, chiave, da: CHI };
      if (!(await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)))) return;
      LS.del('aiProv'); LS.del('gKey'); // si usa quella del gruppo
      toast('Salvata e condivisa con il gruppo ✓');
    } else { LS.set('aiProv', prov === 'nessuna' ? 'off' : prov); LS.set('gKey', chiave); toast(prov === 'nessuna' ? 'Intelligenza artificiale disattivata su questo dispositivo' : 'Salvata su questo dispositivo ✓'); }
    renderTutto();
  };
  if ($('svX')) $('svX').onclick = () => conferma('Smettere di condividerla?', 'Chi non ha una sua chiave non potrà più usare l\'intelligenza artificiale.', 'Smetti di condividere', async () => {
    D.stato.ia = { prov: 'nessuna', chiave: '', da: CHI }; await scrivi(() => ST.salvaStato(G.id, 'ia', D.stato.ia)); renderTutto();
  }, true);
  $('nome').onclick = () => chiedi('Il tuo nome', 'Le tue modifiche saranno firmate con questo nome.', CHI, 'Salva', n => { n = n.trim(); if (!n) return; CHI = n; SS.set('chi', n); const nomi = LS.getJ('nomi', []); if (!nomi.includes(n)) { nomi.push(n); LS.setJ('nomi', nomi); } renderImp(); });
  if ($('esci')) $('esci').onclick = async () => { await disattivaNotifiche().catch(() => {}); await ST.esci(); SS.del('chi'); LS.del('gruppo'); location.reload(); };
  if ($('coll')) $('coll').onclick = () => conferma('Collegare il server?', 'I dati salvati solo su questo dispositivo non vengono spostati: nel nuovo spazio condiviso ricominci da capo.', 'Continua', () => { LS.del('modo'); LS.del('gruppo'); G = null; benvenuto(); });
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
