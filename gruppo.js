// Scheda Gruppo: chi siete, inviti, persone senza app, cambio o creazione di un gruppo. L'ingranaggio apre le Impostazioni.
function renderGruppo() {
  const el = $('t-gruppo'); if (!el) return;
  if (!G) { el.innerHTML = '<div class="testa"><h1>Gruppo</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const pp = D.partecipanti, server = ST && ST.modo === 'supabase';
  let h = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">Le persone con cui condividi la tavola</p><h1>Gruppo</h1></div><button type="button" class="ico-btn" id="grImp" aria-label="Impostazioni">${ic('ingranaggio', 22, 1.8)}</button></div>
    <section class="hero-g" aria-labelledby="g-name">${marchioBianco(56)}<div class="t"><h2 id="g-name">${esc(G.nome)}</h2><small>${pp.length} ${pp.length === 1 ? 'persona' : 'persone'} · spesa e conti condivisi</small></div><button type="button" id="grCambia" aria-label="Cambia o modifica il gruppo">${ic('giu', 20, 2)}</button></section>
    <section aria-labelledby="membri" style="display:flex;flex-direction:column;gap:8px"><h2 id="membri" class="sez" style="margin:0">Membri</h2><div class="sc">` +
    pp.map((p, i) => {
      const piano = pianoDi(p.id), stato = (piano?.giorni?.length ? 'Piano alimentare caricato' : 'Senza piano') + (p.user_id || p.id === IO ? '' : ' · senza app');
      return `<div class="membro">${avatar(p, i, 'g')}<span class="t"><b>${esc(p.nome)}${p.id === IO ? ' <span>(tu)</span>' : ''}</b><small>${stato}</small></span><button type="button" class="tondo-btn" data-pe="${p.id}" aria-label="Opzioni per ${esc(p.nome)}">${ic('puntini', 22, 2.4)}</button></div>`;
    }).join('') + `</div><button type="button" class="link-txt" id="grAgg" style="min-height:40px">+ Aggiungi una persona senza app</button></section>`;
  h += `<section class="invita" aria-labelledby="invita"><h2 id="invita">Invita qualcuno</h2>` + (server
    ? `<p>Chi apre il link entra nel gruppo con la sua email${D.stato.ia && D.stato.ia.chiave ? ' e usa la stessa intelligenza artificiale del gruppo' : ''}.</p><div class="riga"><button type="button" class="btn" id="grInv" style="flex:1;margin:0;min-height:48px;border-radius:14px">${ic('condividi', 18, 2)}Condividi link</button><button type="button" class="btn bordo" id="grCopia" style="width:auto;margin:0;min-height:48px;border-radius:14px;padding:0 16px">Copia</button></div>`
    : `<p>Gli inviti funzionano quando il server è collegato. Ora i dati restano solo su questo dispositivo.</p>`) + '</section>';
  h += `<div style="display:flex;flex-direction:column;gap:4px"><button type="button" class="link-txt" id="grNuovo">+ Crea un nuovo gruppo</button><button type="button" class="link-txt rosso" id="esciG">Esci dal gruppo</button></div>`;
  el.innerHTML = h;
  $('grImp').onclick = () => vai('imp');
  $('grCambia').onclick = () => {
    foglio(`<h2>${esc(G.nome)}</h2><div class="menu-righe" style="margin-top:12px"><button type="button" id="gcC">${ic('gruppo', 20, 1.8)}<span class="t"><b>Cambia gruppo</b><small>Passa a un altro gruppo o creane uno</small></span>${ic('avanti', 18, 2)}</button><button type="button" id="gcM">${ic('matita', 20, 1.8)}<span class="t"><b>Rinomina o cambia valuta</b><small>Valuta dei conti: ${esc(VG())}</small></span>${ic('avanti', 18, 2)}</button></div>`);
    $('gcC').onclick = async () => { chiudi(); try { schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); } };
    $('gcM').onclick = () => { chiudi(); modificaGruppo(); };
  };
  el.querySelectorAll('[data-pe]').forEach(b => b.onclick = () => modificaPartecipante(b.dataset.pe));
  $('grAgg').onclick = () => chiedi('Nuova persona', 'Per chi non usa l\'app, come un nonno o un coinquilino che paga in contanti: comparirà nei conti e potrà avere un suo piano.', '', 'Aggiungi', async n => {
    n = n.trim(); if (!n) return;
    if (D.partecipanti.some(p => p.nome.toLowerCase() === n.toLowerCase())) return toast('C\'è già una persona con questo nome');
    const r = { id: uuid(), gruppo_id: G.id, nome: n, user_id: null, created_at: new Date().toISOString() };
    D.partecipanti.push(r); renderTutto();
    if (await scrivi(() => ST.ins('partecipanti', r))) toast(n + ' aggiunto ✓');
  });
  if ($('grInv')) $('grInv').onclick = invita;
  if ($('grCopia')) $('grCopia').onclick = async () => {
    try { const cod = await ST.codiceInvito(G.id), link = location.origin + location.pathname + '?invito=' + cod; await navigator.clipboard.writeText(link); toast('Link copiato ✓'); }
    catch (e) { invita(); }
  };
  $('grNuovo').onclick = async () => { try { schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); } };
  $('esciG').onclick = () => conferma('Uscire dal gruppo?', ST.modo === 'supabase' ? 'Non vedrai più pasti, spesa e conti di questo gruppo finché qualcuno non ti invita di nuovo. Le tue spese restano nei conti degli altri.' : 'Su questo dispositivo il gruppo e tutti i suoi dati verranno cancellati.', 'Esci dal gruppo', async () => {
    try { await ST.lasciaGruppo(G.id); LS.del('gruppo'); LS.del('snap_' + G.id); ST.smetti(); G = null; renderTutto(); schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); }
  }, true);
}
