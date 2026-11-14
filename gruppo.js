// Scheda Gruppo: chi siete, amministratori, inviti, persone senza app, cambio o creazione di un gruppo. L'ingranaggio apre le Impostazioni.
// Amministratori: all'inizio chi ha creato il gruppo; possono nominarne altri, togliere persone e rinominare il gruppo.
function adminDelGruppo() {
  const r = D.stato.ruoli;
  if (r && Array.isArray(r.admin) && r.admin.length) return r.admin;
  if (G && G.creato_da && D.partecipanti.some(p => p.user_id === G.creato_da)) return [G.creato_da];
  const primo = D.partecipanti.filter(p => p.user_id).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))[0];
  return primo ? [primo.user_id] : [];
}
const eAdmin = p => !!(p && p.user_id && adminDelGruppo().includes(p.user_id));
const ioAdmin = () => eAdmin(D.partecipanti.find(p => p.id === IO));
async function cambiaAdmin(pid, rendi) {
  const p = D.partecipanti.find(x => x.id === pid); if (!p || !p.user_id) return;
  let l = adminDelGruppo().slice();
  if (rendi) { if (!l.includes(p.user_id)) l.push(p.user_id); }
  else { if (l.length <= 1) return toast('Serve almeno un amministratore: prima nominane un altro'); l = l.filter(u => u !== p.user_id); }
  D.stato.ruoli = { admin: l }; renderGruppo();
  if (await scrivi(() => ST.salvaStato(G.id, 'ruoli', D.stato.ruoli))) {
    toast(rendi ? p.nome + ' ora è amministratore ✓' : p.nome + ' non è più amministratore');
    if (rendi && p.id !== IO) avvisaGruppo('Gruppo ' + G.nome, `${CHI} ti ha nominato amministratore del gruppo`, { tipo: 'conti', scheda: 'gruppo', a: [p.id] });
  }
}
function foglioNuovoAdmin() {
  const l = D.partecipanti.filter(p => p.user_id && !eAdmin(p));
  foglio(`<h2>Aggiungi amministratore</h2><p class="q" style="line-height:1.5;margin:4px 0 12px">Gli amministratori possono nominare altri amministratori, togliere persone dal gruppo e cambiarne nome e valuta.</p>` +
    (l.length ? `<div class="menu-righe">${l.map(p => `<button type="button" data-na="${p.id}">${avatar(p, idxP(p.id), 'g')}<span class="t"><b>${esc(p.nome)}</b><small>Usa l'app</small></span>${ic('piu', 20, 2)}</button>`).join('')}</div>`
      : `<div class="card vuoto">${ic('gruppo', 30)}Nessuno da nominare.<br>Possono essere amministratori solo le persone che usano l'app: invitale con il link.</div>`));
  $('pop').querySelectorAll('[data-na]').forEach(b => b.onclick = () => { chiudi(); cambiaAdmin(b.dataset.na, true); });
}
// Opzioni di una persona (dalla scheda Gruppo e dai Saldi)
function opzioniMembro(id) {
  const p = D.partecipanti.find(x => x.id === id); if (!p) return;
  const admin = ioAdmin(), tu = id === IO;
  foglio(`<h2>${esc(p.nome)}${eAdmin(p) ? ' <span class="badge" style="vertical-align:middle;font-size:12px">Admin</span>' : ''}</h2><p class="q" style="margin:0 0 12px">${tu ? 'Sei tu' : p.user_id ? 'Usa l\'app' : 'Senza app'}</p>
    <div class="menu-righe">
      <button type="button" id="omN">${ic('matita', 20, 1.8)}<span class="t"><b>Cambia nome</b></span>${ic('avanti', 18, 2)}</button>
      ${tu ? `<button type="button" id="omF">${ic('foto', 20, 1.8)}<span class="t"><b>Foto del profilo</b><small>${D.stato['foto:' + id] ? 'Cambiala o toglila' : 'La vedono tutti nel gruppo'}</small></span>${ic('avanti', 18, 2)}</button>` : ''}
      ${admin && p.user_id ? `<button type="button" id="omA">${ic('gruppo', 20, 1.8)}<span class="t"><b>${eAdmin(p) ? 'Togli da amministratore' : 'Rendi amministratore'}</b><small>${eAdmin(p) ? 'Resterà nel gruppo come gli altri' : 'Potrà gestire persone e gruppo'}</small></span>${ic('avanti', 18, 2)}</button>` : ''}
      ${tu ? `<button type="button" id="omU">${ic('utenti', 20, 1.8)}<span class="t"><b>Non sono io</b><small>Scegli un'altra persona del gruppo</small></span>${ic('avanti', 18, 2)}</button>` : ''}
      ${admin && !tu ? `<button type="button" id="omD" style="color:var(--danger)">${ic('cestino', 20, 1.8)}<span class="t"><b>Togli dal gruppo</b><small>Solo se non compare in nessuna spesa</small></span></button>` : ''}
    </div>${!admin && !tu ? '<p class="by" style="margin:10px 0 0">Solo un amministratore può togliere persone o nominare amministratori.</p>' : ''}`);
  $('omN').onclick = () => chiedi('Nome', 'Come compare nel gruppo e nei conti.', p.nome, 'Salva', async n => { n = n.trim(); if (!n) return; p.nome = n; renderTutto(); await scrivi(() => ST.upd('partecipanti', id, { nome: n })); });
  if ($('omA')) $('omA').onclick = () => { chiudi(); cambiaAdmin(id, !eAdmin(p)); };
  if ($('omF')) $('omF').onclick = () => foglioFoto('profilo');
  if ($('omU')) $('omU').onclick = async () => { chiudi(); if (await scrivi(() => ST.upd('partecipanti', id, { user_id: null }))) { await ricarica(); scegliPartecipante(); } };
  if ($('omD')) $('omD').onclick = () => {
    if (D.movimenti.some(m => m.pagato_da === id || id in ((m.divisione || {}).parti || {}))) return toast(p.nome + ' compare in alcune spese: non si può togliere');
    if (eAdmin(p) && adminDelGruppo().length <= 1) return toast('È l\'unico amministratore: prima nominane un altro');
    conferma('Togliere ' + p.nome + '?', 'Non comparirà più nel gruppo, nei pasti e nei conti.', 'Togli', async () => {
      if (eAdmin(p)) { D.stato.ruoli = { admin: adminDelGruppo().filter(u => u !== p.user_id) }; await scrivi(() => ST.salvaStato(G.id, 'ruoli', D.stato.ruoli)); }
      D.partecipanti = D.partecipanti.filter(x => x.id !== id); trovaIO(); renderTutto();
      if (await scrivi(() => ST.del('partecipanti', id))) toast('Tolto dal gruppo');
    }, true);
  };
}
function renderGruppo() {
  const el = $('t-gruppo'); if (!el) return;
  if (!G) { el.innerHTML = '<div class="testa"><h1>Gruppo</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const pp = D.partecipanti, server = ST && ST.modo === 'supabase';
  let h = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">Le persone con cui condividi la tavola</p><h1>Gruppo</h1></div><button type="button" class="ico-btn" id="grImp" aria-label="Impostazioni">${ic('ingranaggio', 22, 1.8)}</button></div>
    <section class="hero-g" aria-labelledby="g-name"><button type="button" class="g-foto" id="grFoto" aria-label="Foto del gruppo">${fotoGruppo() ? `<span class="g-img" style="background-image:url('${fotoGruppo()}')"></span>` : marchioBianco(56)}<i>${ic('matita', 14, 2.4)}</i></button><div class="t"><h2 id="g-name"><span class="emo emo-tocca" role="button" tabindex="0" data-emo="g" data-emot="${esc(G.nome)}" aria-label="Cambia l'emoji del gruppo">${EMO.gruppo(G.nome)}</span>${esc(G.nome)}</h2><small>${pp.length} ${pp.length === 1 ? 'persona' : 'persone'} · spesa e conti condivisi</small></div><button type="button" id="grCambia" aria-label="Cambia o modifica il gruppo">${ic('giu', 20, 2)}</button></section>
    <section aria-labelledby="membri" style="display:flex;flex-direction:column;gap:8px"><h2 id="membri" class="sez" style="margin:0">Membri</h2><div class="sc">` +
    pp.map((p, i) => {
      const piano = pianoDi(p.id), stato = (piano?.giorni?.length ? 'Piano alimentare caricato' : 'Senza piano') + (p.user_id || p.id === IO ? '' : ' · senza app');
      return `<div class="membro">${avatar(p, i, 'g')}<span class="t"><b>${esc(p.nome)}${p.id === IO ? ' <span>(tu)</span>' : ''}</b><small>${stato}</small></span>${eAdmin(p) ? '<span class="badge">Admin</span>' : ''}<button type="button" class="tondo-btn" data-pe="${p.id}" aria-label="Opzioni per ${esc(p.nome)}">${ic('puntini', 22, 2.4)}</button></div>`;
    }).join('') + `</div><div style="display:flex;flex-direction:column">${ioAdmin() ? '<button type="button" class="link-txt" id="grAdm" style="min-height:40px">+ Aggiungi amministratore del gruppo</button>' : ''}<button type="button" class="link-txt" id="grAgg" style="min-height:40px">+ Aggiungi una persona senza app</button></div></section>`;
  h += `<section class="invita" aria-labelledby="invita"><h2 id="invita">Invita qualcuno</h2>` + (server
    ? `<p>Chi apre il link entra nel gruppo con la sua email${D.stato.ia && D.stato.ia.chiave ? ' e usa la stessa intelligenza artificiale del gruppo' : ''}.</p><div class="riga"><button type="button" class="btn" id="grInv" style="flex:1;margin:0;min-height:48px;border-radius:14px">${ic('condividi', 18, 2)}Condividi link</button><button type="button" class="btn bordo" id="grCopia" style="width:auto;margin:0;min-height:48px;border-radius:14px;padding:0 16px">Copia</button></div>`
    : `<p>Gli inviti funzionano quando il server è collegato. Ora i dati restano solo su questo dispositivo.</p>`) + '</section>';
  h += `<div style="display:flex;flex-direction:column;gap:4px"><button type="button" class="link-txt" id="grNuovo">+ Crea un nuovo gruppo</button><button type="button" class="link-txt rosso" id="esciG">Esci dal gruppo</button></div>`;
  el.innerHTML = h;
  $('grImp').onclick = () => vai('imp');
  $('grFoto').onclick = () => foglioFoto('gruppo');
  $('grCambia').onclick = () => {
    foglio(`<h2>${esc(G.nome)}</h2><div class="menu-righe" style="margin-top:12px"><button type="button" id="gcC">${ic('gruppo', 20, 1.8)}<span class="t"><b>Cambia gruppo</b><small>Passa a un altro gruppo o creane uno</small></span>${ic('avanti', 18, 2)}</button>${ioAdmin() ? `<button type="button" id="gcM">${ic('matita', 20, 1.8)}<span class="t"><b>Rinomina o cambia valuta</b><small>Valuta dei conti: ${esc(VG())}</small></span>${ic('avanti', 18, 2)}</button>` : ''}</div>${ioAdmin() ? '' : '<p class="by" style="margin:10px 0 0">Nome e valuta del gruppo li cambia un amministratore.</p>'}`);
    $('gcC').onclick = async () => { chiudi(); try { schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); } };
    if ($('gcM')) $('gcM').onclick = () => { chiudi(); modificaGruppo(); };
  };
  el.querySelectorAll('[data-pe]').forEach(b => b.onclick = () => opzioniMembro(b.dataset.pe));
  if ($('grAdm')) $('grAdm').onclick = foglioNuovoAdmin;
  $('grAgg').onclick = () => chiedi('Nuova persona', 'Per chi non usa l\'app, come un nonno o un coinquilino che paga in contanti: comparirà nei conti e potrà avere un suo piano.', '', 'Aggiungi', async n => {
    n = n.trim(); if (!n) return;
    if (D.partecipanti.some(p => p.nome.toLowerCase() === n.toLowerCase())) return toast('C\'è già una persona con questo nome');
    const r = { id: uuid(), gruppo_id: G.id, nome: n, user_id: null, created_at: new Date().toISOString() };
    D.partecipanti.push(r); renderTutto();
    if (await scrivi(() => ST.ins('partecipanti', r))) toast(n + ' aggiunto ✓');
  });
  if ($('grInv')) $('grInv').onclick = invita;
  if ($('grCopia')) $('grCopia').onclick = async () => {
    try { const cod = await ST.codiceInvito(G.id), link = linkInvito(cod); await navigator.clipboard.writeText(link); toast('Link copiato ✓'); }
    catch (e) { invita(); }
  };
  $('grNuovo').onclick = async () => { try { schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); } };
  $('esciG').onclick = () => conferma('Uscire dal gruppo?', ST.modo === 'supabase' ? 'Non vedrai più pasti, spesa e conti di questo gruppo finché qualcuno non ti invita di nuovo. Le tue spese restano nei conti degli altri.' : 'Su questo dispositivo il gruppo e tutti i suoi dati verranno cancellati.', 'Esci dal gruppo', async () => {
    try { await ST.lasciaGruppo(G.id); LS.del('gruppo'); LS.del('snap_' + G.id); ST.smetti(); G = null; renderTutto(); schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); }
  }, true);
}

// ---------- Foto del gruppo e del profilo ----------
// Piccole (256 px), salvate nel gruppo: le vedono tutti, anche offline
const fotoGruppo = () => { const f = D.stato.foto_gruppo; return f && /^data:image\//.test(f) ? f : ''; };
function foglioFoto(cosa) {
  const chiave = cosa === 'gruppo' ? 'foto_gruppo' : 'foto:' + IO, ce = !!D.stato[chiave];
  if (cosa === 'profilo' && !IO) return;
  foglio(`<h2>${cosa === 'gruppo' ? 'Foto del gruppo' : 'La tua foto'}</h2><p class="q" style="margin:4px 0 12px;line-height:1.5">${cosa === 'gruppo' ? 'Compare nella scheda Gruppo per tutti.' : 'Compare al posto dell\'iniziale, per tutto il gruppo.'}</p>
    <input type="file" id="ffI" accept="image/*" hidden>
    <button class="btn" id="ffS" type="button">${ic('foto', 18)}${ce ? 'Cambia foto' : 'Scegli una foto'}</button>
    ${ce ? `<button class="btn ghost" id="ffT" type="button">${ic('cestino', 18)}Togli la foto</button>` : ''}`);
  $('ffS').onclick = () => $('ffI').click();
  $('ffI').onchange = async () => {
    const f = $('ffI').files[0]; if (!f) return;
    try { const url = await quadrata(f, 256); chiudi(); D.stato[chiave] = url; renderTutto(); if (await scrivi(() => ST.salvaStato(G.id, chiave, url))) toast('Foto salvata ✓'); }
    catch (e) { toast(e.message); }
  };
  if ($('ffT')) $('ffT').onclick = async () => { chiudi(); D.stato[chiave] = null; renderTutto(); await scrivi(() => ST.salvaStato(G.id, chiave, null)); };
}
// Ritaglio quadrato al centro, JPEG leggero
function quadrata(file, lato) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = lato;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, lato, lato); URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Immagine non leggibile: prova con una foto JPG o PNG')); };
    img.src = url;
  });
}
