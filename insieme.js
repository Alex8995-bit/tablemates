// "Mangiamo insieme": lo stesso piatto per più persone, per un solo pasto e un solo giorno.
// Ogni pasto condiviso è un documento a sé (insieme:<giorno>:<pasto>) che punta al piatto di chi lo propone.
// Il piano di nessuno cambia: la ricetta somma le dosi usando le grammature di ciascuno.
const slugPasto = t => senzaAccenti(String(t || '')).toLowerCase().replace(/[^a-z]+/g, '');
const slotDi = t => (typeof LETTORE !== 'undefined' && LETTORE.slot ? LETTORE.slot(t) : t) || t;
const stessoPasto = (a, b) => slugPasto(slotDi(a)) === slugPasto(slotDi(b));
// I momenti in cui si può mangiare insieme
const SLOT_COMUNI = ['Colazione', 'Spuntino mattina', 'Pranzo', 'Spuntino pomeriggio', 'Cena'];
const comuniDelGiorno = iso => Object.keys(D.stato).filter(k => k.startsWith('insieme:')).map(k => Object.assign({ id: k }, D.stato[k]))
  .filter(e => insiemeValido(e) && IO && e.chi.includes(IO) && e.iso === iso).sort((a, b) => ordinePasto(a.tipo) - ordinePasto(b.tipo));
const riassuntoDi = (pid, gi, pa) => pa ? (pa.voci ? pa.voci.map((_, i) => voceEffettiva(pid, gi, pa, i).nome).join(', ') : pa.alimenti || '') : '';
const pastoSorgente = e => pianoDi(e.da)?.giorni?.[e.gi]?.pasti?.[e.k] || null;
const idInsieme = (iso, tipo) => 'insieme:' + iso + ':' + slugPasto(tipo);
const insiemeValido = e => e && !e.eliminato && Array.isArray(e.chi) && e.chi.length > 1 && e.da;
const insiemeDi = (iso, tipo) => { const e = D.stato[idInsieme(iso, tipo)]; return insiemeValido(e) && IO && e.chi.includes(IO) ? Object.assign({ id: idInsieme(iso, tipo) }, e) : null; };
const insiemiMiei = () => Object.keys(D.stato).filter(k => k.startsWith('insieme:')).map(k => Object.assign({ id: k }, D.stato[k]))
  .filter(e => insiemeValido(e) && IO && e.chi.includes(IO) && e.iso >= oggiISO()).sort((a, b) => a.iso.localeCompare(b.iso) || ordinePasto(a.tipo) - ordinePasto(b.tipo));

// il pasto dello stesso tipo, nel giorno del piano che cade in quella data
function pastoDelGiorno(pid, iso, tipo) {
  const pl = D.stato['piano:' + pid]; if (!pl || !pl.giorni || !pl.giorni.length) return null;
  const gi = giornoPerData(pl, new Date(iso + 'T12:00:00')); if (gi < 0) return null;
  const k = pl.giorni[gi].pasti.findIndex(p => stessoPasto(p.tipo, tipo));
  return k >= 0 ? { gi, k, pa: pl.giorni[gi].pasti[k] } : null;
}
const dataBreve = iso => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const scriviInsieme = e => { const { id, ...dati } = e; D.stato[id] = dati; return scrivi(() => ST.salvaStato(G.id, id, dati)); };

// Il piatto di chi propone: quello già scelto per quel pasto, altrimenti uno nuovo (IA se c'è, ricetta base se no)
async function piattoPer(pid, gi, k) {
  const ric = ricetteDi(pid); if (ric[gi]?.[k]) return ric[gi][k];
  const pa = pianoDi(pid).giorni[gi].pasti[k];
  let x = null;
  if (haAI()) {
    const att = attesaIA('Cerco un piatto per ' + pa.tipo.toLowerCase(), 'Uso gli alimenti e le grammature del piano. Di solito bastano pochi secondi.');
    try {
      x = piattoDaIA(await ia([{ text: 'Proponi un piatto per questo pasto. ' + REGOLE + PORTATE_IA + ' JSON: ' + JSON_PIATTO + '. Pasto: ' + pastoPerIA(pid, gi, pa) }]));
      if (!x || !x.nome) throw new Error('nessun piatto');
      att.fine();
    } catch (e) { x = null; att.fine(); toast('L\'IA non ha risposto: uso la ricetta base'); }
  }
  if (!x) x = CUOCO.crea(pid, gi, pa);
  x.da = CHI; ric[gi] = ric[gi] || []; ric[gi][k] = x; D.stato['ricette:' + pid] = ric; await salvaRicette(pid);
  return x;
}

async function creaInsieme(tipo, iso, con) {
  const mio = pastoDelGiorno(IO, iso, tipo);
  if (!mio) return toast('Nel tuo piano non c\'è «' + tipo + '» per ' + dataBreve(iso));
  if (!con.length) return;
  chiudi();
  const x = await piattoPer(IO, mio.gi, mio.k);
  const e = { da: IO, iso, tipo, gi: mio.gi, k: mio.k, chi: [IO, ...con], t: Date.now() };
  vibra(); renderOggi(); renderPiano();
  if (await scriviInsieme(Object.assign({ id: idInsieme(iso, tipo) }, e))) {
    toast('Pasto insieme proposto ✓');
    avvisaGruppo('A tavola insieme', CHI + ' propone «' + x.nome + '» per ' + tipo.toLowerCase() + ' ' + (iso === oggiISO() ? 'oggi' : dataBreve(iso)), { tipo: 'tavola', scheda: 'oggi', a: con });
  }
  renderOggi();
}

// Apre il piatto condiviso con le dosi di chi lo guarda
async function apriInsieme(e) {
  const x = ricetteDi(e.da)[e.gi]?.[e.k]; if (!x) return toast('Il piatto non è più disponibile');
  vibra();
  const mio = e.da === IO ? null : pastoDelGiorno(IO, e.iso, e.tipo);
  const ctx = e.da === IO || !mio ? { pid: e.da, gi: e.gi, k: e.k } : { pid: IO, gi: mio.gi, k: mio.k };
  const vista = () => Object.assign({}, x, { commensali: e.chi.slice(), insieme: e.id });
  mostraRicettaPagina(vista(), ctx);
  if (!x.ricetta && haAI() && pastoSorgente(e)) {
    try {
      x.ricetta = await ricettaIA(x, e.da, e.gi, pastoSorgente(e));
      if ($('pagina')?.querySelector('[data-ricetta]')) mostraRicettaPagina(vista(), ctx);
      await salvaRicette(e.da);
    } catch (er) { if ($('rcCorpo')) $('rcCorpo').innerHTML = `<p class="q" style="color:var(--neg);line-height:1.5;margin:0">${esc(er.message)}</p>`; }
  }
}

// Chi mangia: si aggiunge o si toglie una persona (chi ha proposto resta sempre)
async function cambiaInsieme(x, p) {
  const e = Object.assign({ id: x.insieme }, D.stato[x.insieme]); if (!insiemeValido(e)) return;
  if (p === e.da) return toast('Il pasto l\'ha proposto ' + (p === IO ? 'tu' : nomeP(p)) + ': per toglierlo annulla l\'invito dalla scheda Oggi');
  e.chi = e.chi.includes(p) ? e.chi.filter(z => z !== p) : e.chi.concat(p);
  if (e.chi.length < 2) { e.eliminato = true; chiudiPagina(); toast('Pasto insieme annullato'); }
  await scriviInsieme(e); renderOggi(); renderComuni();
  if (!e.eliminato) apriInsieme(e);
}

// Chi non può più venire: esce lui; se resta uno solo (o se esce chi ha proposto) il pasto torna normale per tutti
function esciDaInsieme(id) {
  const e = Object.assign({ id }, D.stato[id]); if (!insiemeValido(e)) return;
  conferma(e.da === IO ? 'Annullare il pasto comune?' : 'Non mangi insieme?', e.da === IO ? 'Il pasto comune viene annullato per tutti: ognuno torna al proprio piano.' : 'Torni al tuo pasto del piano. Gli altri restano insieme.', 'Sì, non mangio insieme', async () => {
    e.chi = e.chi.filter(z => z !== IO);
    if (e.da === IO || e.chi.length < 2) e.eliminato = true;
    await scriviInsieme(e); renderOggi(); renderPiano(); renderComuni(); toast(e.eliminato ? 'Pasto comune annullato' : 'Non mangi più insieme a loro');
    if (e.da !== IO) avvisaGruppo('A tavola', CHI + ' non mangia con voi: ' + e.tipo.toLowerCase() + ' ' + (e.iso === oggiISO() ? 'oggi' : dataBreve(e.iso)), { tipo: 'tavola', scheda: 'comuni', a: e.chi });
    else avvisaGruppo('A tavola', CHI + ' ha annullato il pasto insieme: ' + e.tipo.toLowerCase() + ' ' + (e.iso === oggiISO() ? 'oggi' : dataBreve(e.iso)), { tipo: 'tavola', scheda: 'comuni', a: e.chi.filter(z => z !== IO) });
  }, true);
}


// Le porzioni di una persona per un pasto comune: chi l'ha proposto usa il pasto scelto dal suo piano,
// gli altri il proprio pasto dello stesso momento in quella data (se non c'è, la stessa porzione di chi l'ha proposto)
function pastoPerInsieme(p, e) {
  const z = p === e.da ? { gi: e.gi, k: e.k, pa: pastoSorgente(e) } : pastoDelGiorno(p, e.iso, e.tipo);
  return z && z.pa ? { gi: z.gi, pa: z.pa, voci: (z.pa.voci || []).map((_, k) => voceEffettiva(p, z.gi, z.pa, k)) } : null;
}

// ---------- Scheda «Comuni»: i pasti che si mangiano insieme ----------
// Si sceglie un pasto dal proprio piano (anche di un altro giorno), poi quando mangiarlo e con chi. La ricetta si crea qui.
function foglioComune(iso0, slot0, pre) {
  if (!IO) return scegliPartecipante();
  const piano = pianoDi(IO);
  if (!piano?.giorni?.length) return toast('Prima carica o scrivi il tuo piano alimentare (scheda Piano)');
  const altri = D.partecipanti.filter(p => p.id !== IO);
  if (!altri.length) return toast('Nel gruppo non c\'è nessun altro: invita qualcuno dalla scheda Gruppo');
  let iso = iso0 && iso0 >= oggiISO() ? iso0 : oggiISO(), slot = SLOT_COMUNI.find(x => stessoPasto(x, slot0 || '')) || '';
  let gsel = Math.max(0, giornoPianoPer(piano, iso)), ksel = -1;
  const sel = new Set(altri.length === 1 ? [altri[0].id] : []);
  const pastiDi = gi => piano.giorni[gi].pasti.map((pa, k) => ({ pa, k })).filter(x => x.pa.voci ? x.pa.voci.length : x.pa.alimenti).sort((a, b) => ordinePasto(a.pa.tipo) - ordinePasto(b.pa.tipo));
  if (pre && piano.giorni[pre.gi]?.pasti[pre.k]) { gsel = pre.gi; ksel = pre.k; }
  else if (slot) { const x = pastiDi(gsel).find(z => stessoPasto(z.pa.tipo, slot)); ksel = x ? x.k : -1; }
  const leggi = () => { if ($('cmD')) iso = $('cmD').value || iso; };
  const disegna = () => {
    const pasti = pastiDi(gsel), pronto = ksel >= 0 && slot && sel.size && iso >= oggiISO();
    foglio(`<h2>Nuovo pasto comune</h2><p class="q" style="line-height:1.5;margin:4px 0 4px">Scegli un pasto del tuo piano, anche di un altro giorno: lo mangiate insieme quando decidete voi.</p>
      <label class="lb">1 · Il pasto, dal tuo piano</label><div class="chips" style="margin-top:6px">${piano.giorni.map((g, i) => `<button type="button" class="chip ${i === gsel ? 'on' : ''}" data-cg="${i}" aria-pressed="${i === gsel}" style="padding:0 14px">${esc(g.giorno)}</button>`).join('')}</div>
      <div class="cm-scelte">${pasti.map(({ pa, k }) => `<button type="button" class="cm-scelta ${k === ksel ? 'on' : ''}" data-ck="${k}" aria-pressed="${k === ksel}"><span class="og-em" aria-hidden="true">${EMO.per(pa.tipo, '🍽️')}</span><span class="t"><b>${esc(pa.tipo)}</b><small>${esc(riassuntoDi(IO, gsel, pa))}</small></span></button>`).join('') || '<p class="q" style="margin:6px 0">Nessun pasto in questo giorno.</p>'}</div>
      <label class="lb" for="cmD">2 · Quando lo mangiate</label><input id="cmD" type="date" value="${iso}" min="${oggiISO()}" style="width:100%">
      <div class="chips" style="margin-top:8px" role="group" aria-label="Momento del giorno">${SLOT_COMUNI.map(x => `<button type="button" class="chip ${x === slot ? 'on' : ''}" data-cs2="${esc(x)}" aria-pressed="${x === slot}" style="padding:0 14px">${esc(x)}</button>`).join('')}</div>
      <label class="lb">3 · Con chi</label><div class="chips" style="margin-top:6px">${altri.map(p => `<button type="button" class="chip ${sel.has(p.id) ? 'on' : ''}" data-cp="${p.id}" aria-pressed="${sel.has(p.id)}">${avatar(p, idxP(p.id), 'p')}${esc(p.nome)}</button>`).join('')}</div>
      <button class="btn" id="cmOk" type="button" style="margin-top:16px" ${pronto ? '' : 'disabled'}>Aggiungi ai pasti comuni</button>`);
    const pop = $('pop');
    pop.querySelectorAll('[data-cg]').forEach(b => b.onclick = () => { leggi(); gsel = +b.dataset.cg; const x = slot && pastiDi(gsel).find(z => stessoPasto(z.pa.tipo, slot)); ksel = x ? x.k : -1; disegna(); });
    pop.querySelectorAll('[data-ck]').forEach(b => b.onclick = () => { leggi(); ksel = +b.dataset.ck; if (!slot) slot = SLOT_COMUNI.find(x => stessoPasto(x, piano.giorni[gsel].pasti[ksel].tipo)) || 'Pranzo'; disegna(); });
    pop.querySelectorAll('[data-cs2]').forEach(b => b.onclick = () => { leggi(); slot = b.dataset.cs2; disegna(); });
    pop.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { leggi(); sel.has(b.dataset.cp) ? sel.delete(b.dataset.cp) : sel.add(b.dataset.cp); disegna(); });
    $('cmD').onchange = () => { leggi(); if ($('cmOk')) $('cmOk').disabled = !(ksel >= 0 && slot && sel.size && iso >= oggiISO()); };
    $('cmOk').onclick = () => { leggi(); salvaComune(gsel, ksel, iso, slot, [...sel]); };
  };
  disegna();
}
async function salvaComune(gi, k, iso, slot, con) {
  const id = idInsieme(iso, slot), prima = D.stato[id], g = pianoDi(IO).giorni[gi], pa = g.pasti[k];
  const fai = async () => {
    chiudi();
    const x = (ricetteDi(IO)[gi] || [])[k];
    const e = { id, da: IO, iso, tipo: slot, gi, k, chi: [IO, ...con], t: Date.now(), origine: g.giorno + ' · ' + pa.tipo };
    vibra();
    if (await scriviInsieme(e)) {
      toast('Pasto comune aggiunto ✓');
      avvisaGruppo('A tavola insieme', `${CHI} propone ${x ? '«' + x.nome + '»' : 'un pasto comune'} per ${slot.toLowerCase()} ${iso === oggiISO() ? 'oggi' : dataBreve(iso)}`, { tipo: 'tavola', scheda: 'comuni', a: con });
    }
    renderComuni(); renderOggi(); renderPiano();
  };
  if (insiemeValido(prima)) return conferma('C\'è già un pasto comune', `Per ${slot.toLowerCase()} di ${dataBreve(iso)} c'è già un pasto comune: lo sostituisco con questo?`, 'Sostituisci', fai);
  fai();
}
// «Crea la ricetta» di un pasto comune: il piatto nasce dal pasto scelto, poi si apre con le dosi di tutti
async function ricettaComune(id) {
  const e = Object.assign({ id }, D.stato[id]); if (!insiemeValido(e)) return;
  if (!pastoSorgente(e)) return toast('Il pasto non è più nel piano di ' + nomeP(e.da));
  if (!(ricetteDi(e.da)[e.gi] || [])[e.k]) { await piattoPer(e.da, e.gi, e.k); renderComuni(); renderOggi(); }
  apriInsieme(e);
}
function renderComuni() {
  const el = $('t-comuni'); if (!el) return;
  if (!G) { el.innerHTML = '<div class="testa"><h1>Pasti comuni</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const l = typeof insiemiMiei === 'function' && IO ? insiemiMiei() : [];
  let h = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">${puntoLive()}${esc(G.nome)} · i pasti insieme</p><h1>Pasti</h1></div></div>${segPasti('comuni')}
    <p class="q" style="margin:0;line-height:1.5">I pasti che mangiate insieme, scelti dal piano di uno di voi.</p>
    ${IO ? `<button class="btn" id="cmAgg" type="button">${ic('piu', 18, 2.2)}Aggiungi un pasto comune</button>` : `<button class="btn" id="cmChi" type="button">Indica chi sei</button>`}`;
  const date = [...new Set(l.map(e => e.iso))];
  date.forEach(d => {
    const tit = d === oggiISO() ? 'Oggi' : d === isoDi(Date.now() + 864e5) ? 'Domani' : dataBreve(d);
    h += `<section class="cm-giorno" aria-label="${esc(tit)}"><h2 class="sez" style="margin:0">${esc(tit)}</h2>${l.filter(e => e.iso === d).map(e => {
      const x = (ricetteDi(e.da)[e.gi] || [])[e.k], pa = pastoSorgente(e), con = e.chi.filter(p => p !== IO).map(nomeP).join(', ');
      return `<article class="cm-card"><div class="cm-t"><span class="og-em" aria-hidden="true">${EMO.per(e.tipo, '🍽️')}</span><span class="t"><b>${esc(e.tipo)} <span class="num" style="font-weight:600;color:var(--sub)">· ${esc(oraDi(e.tipo))}</span></b><small>con ${esc(con)} · ${e.da === IO ? 'proposto da te' : 'proposto da ' + esc(nomeP(e.da))}</small></span></div>
        <div class="cm-piatto">${x ? `<b>${EMO.html(x.nome, '🍽️', '', true)}${esc(x.nome)}</b>` : ''}<small>${pa ? esc(riassuntoDi(e.da, e.gi, pa)) : 'Il pasto non è più nel piano'}</small>${e.origine ? `<small class="by">${e.da === IO ? 'Dal tuo piano' : 'Dal piano di ' + esc(nomeP(e.da))}: ${esc(e.origine)}</small>` : ''}</div>
        <div class="cm-az"><button type="button" class="btn ${x ? 'bordo' : ''}" data-cmr="${esc(e.id)}" ${pa ? '' : 'disabled'}>${x ? ic('posate', 18, 1.8) + 'Apri la ricetta' : ic('scintille', 18, 1.8) + 'Crea la ricetta'}</button><button type="button" class="link" data-cme="${esc(e.id)}">${e.da === IO ? 'Annulla il pasto comune' : 'Non mangio insieme'}</button></div></article>`;
    }).join('')}</section>`;
  });
  if (IO && !l.length) h += `<div class="vuoto">${ic('posate', 32, 1.8)}Nessun pasto comune in programma.<br>Tocca «Aggiungi un pasto comune» e scegli dal tuo piano cosa mangiare insieme.</div>`;
  el.innerHTML = h + '<div style="height:8px"></div>';
  if ($('cmAgg')) $('cmAgg').onclick = () => foglioComune();
  if ($('cmChi')) $('cmChi').onclick = scegliPartecipante;
  el.querySelectorAll('[data-cmr]').forEach(b => b.onclick = () => ricettaComune(b.dataset.cmr));
  el.querySelectorAll('[data-cme]').forEach(b => b.onclick = () => esciDaInsieme(b.dataset.cme));
}
