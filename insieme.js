// "Mangiamo insieme": lo stesso piatto per più persone, per un solo pasto e un solo giorno.
// Ogni pasto condiviso è un documento a sé (insieme:<giorno>:<pasto>) che punta al piatto di chi lo propone.
// Il piano di nessuno cambia: la ricetta somma le dosi usando le grammature di ciascuno.
const slugPasto = t => senzaAccenti(String(t || '')).toLowerCase().replace(/[^a-z]+/g, '');
const idInsieme = (iso, tipo) => 'insieme:' + iso + ':' + slugPasto(tipo);
const insiemeValido = e => e && !e.eliminato && Array.isArray(e.chi) && e.chi.length > 1 && e.da;
const insiemeDi = (iso, tipo) => { const e = D.stato[idInsieme(iso, tipo)]; return insiemeValido(e) && IO && e.chi.includes(IO) ? Object.assign({ id: idInsieme(iso, tipo) }, e) : null; };
const insiemiMiei = () => Object.keys(D.stato).filter(k => k.startsWith('insieme:')).map(k => Object.assign({ id: k }, D.stato[k]))
  .filter(e => insiemeValido(e) && IO && e.chi.includes(IO) && e.iso >= oggiISO()).sort((a, b) => a.iso.localeCompare(b.iso) || ordinePasto(a.tipo) - ordinePasto(b.tipo));

// il pasto dello stesso tipo, nel giorno del piano che cade in quella data
function pastoDelGiorno(pid, iso, tipo) {
  const pl = D.stato['piano:' + pid]; if (!pl || !pl.giorni || !pl.giorni.length) return null;
  const gi = giornoPerData(pl, new Date(iso + 'T12:00:00')); if (gi < 0) return null;
  const k = pl.giorni[gi].pasti.findIndex(p => slugPasto(p.tipo) === slugPasto(tipo));
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
      x = await ia([{ text: 'Proponi un piatto per questo pasto. ' + REGOLE + ' JSON: {"nome":"","tempo":"es. 15 min","preparazione":""}. Pasto: ' + pastoPerIA(pid, gi, pa) }]);
      if (!x || !x.nome) throw new Error('nessun piatto');
      att.fine();
    } catch (e) { x = null; att.fine(); toast('L\'IA non ha risposto: uso la ricetta base'); }
  }
  if (!x) x = CUOCO.crea(pid, gi, pa);
  x.da = CHI; ric[gi] = ric[gi] || []; ric[gi][k] = x; D.stato['ricette:' + pid] = ric; await salvaRicette(pid);
  return x;
}

// Foglio per proporre: giorno e persone
function foglioInsieme(tipo, isoIniziale) {
  if (!IO) return;
  const altri = D.partecipanti.filter(p => p.id !== IO);
  if (!altri.length) return toast('Nel gruppo non c\'è nessun altro');
  const sel = new Set(altri.length === 1 ? [altri[0].id] : []);
  let iso = isoIniziale || oggiISO();
  const disegna = () => {
    foglio(`<h2>Mangiamo insieme</h2><p class="q" style="line-height:1.5;margin:4px 0 12px">Stesso piatto per questo pasto, solo per il giorno scelto. Il piano di nessuno cambia: le dosi si sommano con le grammature di ciascuno.</p>
      <label class="lb" for="inD">Giorno · ${esc(tipo)}</label><input id="inD" type="date" value="${iso}" min="${oggiISO()}" style="width:100%">
      <label class="lb" style="margin-top:12px">Con chi</label><div class="chips">${altri.map((p, i) => `<button type="button" class="chip ${sel.has(p.id) ? 'on' : ''}" data-ip="${p.id}" aria-pressed="${sel.has(p.id)}">${avatar(p, i, 'p')}${esc(p.nome)}</button>`).join('')}</div>
      <button class="btn" id="inOk" type="button" style="margin-top:16px" ${sel.size ? '' : 'disabled'}>Proponi</button>`);
    $('inD').onchange = () => { iso = $('inD').value || iso; };
    $('pop').querySelectorAll('[data-ip]').forEach(b => b.onclick = () => { iso = $('inD').value || iso; sel.has(b.dataset.ip) ? sel.delete(b.dataset.ip) : sel.add(b.dataset.ip); disegna(); });
    $('inOk').onclick = () => creaInsieme(tipo, iso, [...sel]);
  };
  disegna();
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
  const mio = pastoDelGiorno(IO, e.iso, e.tipo), ctx = mio ? { pid: IO, gi: mio.gi, k: mio.k } : null;
  const vista = () => Object.assign({}, x, { commensali: e.chi.slice(), insieme: e.id });
  mostraRicettaPagina(vista(), ctx);
  if (!x.ricetta && haAI() && pianoDi(e.da).giorni?.[e.gi]) {
    try {
      x.ricetta = await ricettaIA(x, e.da, pianoDi(e.da).giorni[e.gi].pasti[e.k]);
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
  await scriviInsieme(e); renderOggi();
  if (!e.eliminato) apriInsieme(e);
}

// Chi non può più venire: esce lui; se resta uno solo (o se esce chi ha proposto) il pasto torna normale per tutti
function esciDaInsieme(id) {
  const e = Object.assign({ id }, D.stato[id]); if (!insiemeValido(e)) return;
  conferma('Non mangi insieme?', e.da === IO ? 'Il pasto condiviso viene annullato per tutti: ognuno torna al proprio piano.' : 'Torni al tuo pasto del piano. Gli altri restano insieme.', 'Sì, non mangio insieme', async () => {
    e.chi = e.chi.filter(z => z !== IO);
    if (e.da === IO || e.chi.length < 2) e.eliminato = true;
    await scriviInsieme(e); renderOggi(); renderPiano(); toast(e.eliminato ? 'Pasto insieme annullato' : 'Sei uscito dal pasto insieme');
    if (e.da !== IO) avvisaGruppo('A tavola', CHI + ' non mangia con voi: ' + e.tipo.toLowerCase() + ' ' + (e.iso === oggiISO() ? 'oggi' : dataBreve(e.iso)), { tipo: 'tavola', scheda: 'oggi', a: e.chi });
    else avvisaGruppo('A tavola', CHI + ' ha annullato il pasto insieme: ' + e.tipo.toLowerCase() + ' ' + (e.iso === oggiISO() ? 'oggi' : dataBreve(e.iso)), { tipo: 'tavola', scheda: 'oggi', a: e.chi.filter(z => z !== IO) });
  }, true);
}

// Nella scheda Oggi: i prossimi giorni in cui mangi insieme a qualcuno
function htmlInsiemeProssimi() {
  const l = insiemiMiei().filter(e => e.iso > oggiISO()).slice(0, 4); if (!l.length) return '';
  return `<section class="big ins-prossimi" aria-label="Pasti insieme in arrivo"><span class="eyebrow">Mangiamo insieme</span>${l.map(e => {
    const x = ricetteDi(e.da)[e.gi]?.[e.k], altri = e.chi.filter(p => p !== IO).map(p => nomeP(p)).join(', ');
    return `<button type="button" class="riga-link" data-insp="${esc(e.id)}"><span><b>${esc(x ? x.nome : e.tipo)}</b><small>${esc(dataBreve(e.iso))} · ${esc(e.tipo)} · con ${esc(altri)}</small></span>${ic('avanti', 18, 2)}</button>`;
  }).join('')}</section>`;
}
