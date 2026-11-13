// Ricetta a schermo intero (ingredienti dal piano, in casa o da comprare, passaggi), ricette salvate e modalità cucina.
const preferiteDi = () => (IO && D.stato['preferite:' + IO]) || [];
const ILLU_PIATTO = '<svg class="illu" width="150" height="150" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#FFFFFF"/><circle cx="50" cy="50" r="32" fill="none" stroke="#BFE3CC" stroke-width="2"/><ellipse cx="42" cy="46" rx="16" ry="11" fill="#F4B266"/><circle cx="62" cy="58" r="6" fill="#8FD0A8"/><circle cx="56" cy="66" r="5" fill="#8FD0A8"/><circle cx="66" cy="44" r="5" fill="#8FD0A8"/><circle cx="38" cy="62" r="5" fill="#F7E27A"/></svg>';
function contenitorePagina() { let e = $('pagina'); if (!e) { e = document.createElement('div'); e.id = 'pagina'; document.body.appendChild(e); } return e; }
function chiudiPagina() { const e = $('pagina'); if (e) e.innerHTML = ''; inerteSotto(false); rilasciaSchermo(); }

// "Petto di pollo 150 g" → nome e quantità
function dividiIngrediente(t) {
  const s = String(t || '').trim();
  const m = s.match(/^(.*?)[\s:,-]+((?:\d+(?:[.,]\d+)?|½|¼)\s*(?:g|gr|kg|ml|cl|l|pz|pezzi?|cucchiai(?:o|ni)?|cucchiaini?|spicchi?o?|fett[ae]|foglie|rametti?|pizzico|bicchier[ei]|tazz[ae]|vasett[io])?\.?|q\.?\s?b\.?)$/i);
  return m && m[1] ? { nome: m[1].trim(), qta: m[2].trim() } : { nome: s, qta: '' };
}
// Si guarda in Dispensa (Tocca un prodotto per dire quanto ne resta) e nella lista della spesa
function statoIngrediente(nome) {
  const n = senzaAccenti(nome), parola = n.split(/\s+/).find(w => w.length > 2) || n;
  const disp = dispensa().items, d = disp.find(x => { const k = senzaAccenti(x.nome); return k.includes(parola) || n.includes(k); });
  const inLista = D.spesa.some(x => !x.comprato && (senzaAccenti(x.nome).includes(parola) || n.includes(senzaAccenti(x.nome))));
  if (inLista) return 'lista';
  if (d) return d.livello >= 2 ? 'casa' : 'compra';
  return disp.length ? 'compra' : '';
}

async function apriRicetta(pid, gi, k) {
  const ric = ricetteDi(pid), x = ric[gi]?.[k]; if (!x) return; vibra();
  mostraRicettaPagina(x, { pid, gi, k });
  if (!x.ricetta && haAI()) {
    try {
      const p = pianoDi(pid).giorni[gi].pasti[k];
      x.ricetta = await ia([{ text: 'Scrivi la ricetta completa del piatto "' + x.nome + '" per questo pasto di dieta. ' + REGOLE + ' Riporta ogni ingrediente con la grammatura della dieta, nel formato "Ingrediente quantità" (es. "Petto di pollo 150 g"). Passaggi chiari e dettagliati, da 4 a 8; se un passaggio ha un tempo di cottura scrivilo in minuti (es. "8 min"). JSON: {"tempo":"","porzioni":"","difficolta":"","ingredienti":[""],"passaggi":[""],"consigli":""}. Pasto: ' + pastoPerIA(pid, gi, p) }]);
      D.stato['ricette:' + pid] = ric; if ($('pagina')?.querySelector('[data-ricetta]')) mostraRicettaPagina(x, { pid, gi, k });
      await salvaRicette(pid);
    } catch (e) {
      if ($('rcCorpo')) {
        $('rcCorpo').innerHTML = `<p class="q" style="color:var(--neg);line-height:1.5;margin:0">${esc(e.message)}</p><button type="button" class="btn" id="rcBase">Usa la ricetta base (senza IA)</button>`;
        $('rcBase').onclick = async () => { const b = CUOCO.crea(pid, gi, pianoDi(pid).giorni[gi].pasti[k]); b.da = x.da || CHI; ric[gi][k] = b; D.stato['ricette:' + pid] = ric; renderPiano(); renderOggi(); mostraRicettaPagina(b, { pid, gi, k }); await salvaRicette(pid); };
      } else toast(e.message);
    }
  }
}

// ---------- Piatto condiviso: chi mangia lo stesso pasto ----------
// Per ogni persona si prende il suo pasto dello stesso tipo nello stesso giorno: se ha l'alimento nel suo piano vale la sua
// grammatura, altrimenti (o se non ha un piano) la stessa porzione di chi ha il piatto. Le quantità si sommano.
function pastoDi(pid, giorno, tipo, gi) {
  const pl = D.stato['piano:' + pid]; if (!pl || !pl.giorni || !pl.giorni.length) return null;
  const g = pl.giorni.findIndex(x => x.giorno === giorno), i = g >= 0 ? g : gi < pl.giorni.length ? gi : -1;
  if (i < 0) return null;
  const pa = pl.giorni[i].pasti.find(p => p.tipo === tipo);
  return pa ? { gi: i, pa, voci: (pa.voci || []).map((_, k) => voceEffettiva(pid, i, pa, k)) } : null;
}
const numQta = q => { const m = String(q || '').replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(.*)$/); return m ? { n: +m[1], u: m[2].trim() } : null; };
function dosiCondivise(x, ctx, comm) {
  const mio = pianoDi(ctx.pid).giorni[ctx.gi], pa = mio.pasti[ctx.k];
  const altri = comm.filter(p => p !== ctx.pid).map(p => ({ p, ps: pastoDi(p, mio.giorno, pa.tipo, ctx.gi), usate: new Set() }));
  const righe = (x.ricetta ? x.ricetta.ingredienti || [] : []).map(t => {
    const { nome, qta } = dividiIngrediente(t), q0 = numQta(qta);
    if (!q0) return { nome, qta, parti: null };
    const parti = [{ p: ctx.pid, n: q0.n }];
    altri.forEach(a => { const v = a.ps && trovaVoce(nome, a.ps.voci, a.usate); if (v && (v.unita || '') === q0.u) { a.usate.add(v); parti.push({ p: a.p, n: v.qta }); } else parti.push({ p: a.p, n: q0.n, uguale: true }); });
    const tot = parti.reduce((s, z) => s + z.n, 0);
    return { nome, qta: LETTORE.fmt(Math.round(tot * 10) / 10) + (q0.u ? ' ' + q0.u : ''), parti: parti.map(z => ({ ...z, t: LETTORE.fmt(z.n) + (q0.u ? ' ' + q0.u : '') })) };
  });
  return righe;
}

function mostraRicettaPagina(x, ctx) {
  const R = x.ricetta, salvata = preferiteDi().some(r => r.nome === x.nome);
  const conPiano = ctx && ctx.pid && pianoDi(ctx.pid).giorni[ctx.gi], comm = conPiano ? (x.commensali || [ctx.pid]).filter(p => idxP(p) >= 0) : [];
  if (conPiano && !comm.includes(ctx.pid)) comm.unshift(ctx.pid);
  const condivisa = comm.length > 1 && R ? dosiCondivise(x, ctx, comm) : null;
  let passi = R ? (R.passaggi || []) : String(x.preparazione || '').split(/\n+|(?=\b\d+[.)]\s)/).map(t => t.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  // ricetta base: i passaggi si riscrivono con le dosi totali
  if (condivisa && x.base) { const pa = pianoDi(ctx.pid).giorni[ctx.gi].pasti[ctx.k]; passi = CUOCO.crea(ctx.pid, ctx.gi, pa, condivisa.map(r => { const q = numQta(r.qta); return q ? { nome: r.nome, qta: q.n, unita: q.u } : { nome: r.nome, misura: r.qta }; })).ricetta.passaggi; }
  const ingr = (condivisa || (R ? R.ingredienti || [] : []).map(dividiIngrediente)).map(i => ({ ...i, st: statoIngrediente(i.nome) }));
  const nomeCorto = p => p === IO ? 'Tu' : nomeP(p);
  const mancanti = ingr.filter(i => i.st === 'compra' || (i.st === '' && !dispensa().items.length));
  const tag = st => st === 'casa' ? '<span class="tag casa">In casa</span>' : st === 'compra' ? '<span class="tag compra">Da comprare</span>' : st === 'lista' ? '<span class="tag casa">In lista</span>' : '';
  const tempo = (R && R.tempo) || x.tempo;
  const h = `<div class="pagina" data-ricetta role="dialog" aria-modal="true" aria-labelledby="rcT">
    <div class="r-top"><button type="button" class="indietro" id="rcB" aria-label="Chiudi la ricetta">${ic('indietro', 22, 2)}</button>
      ${IO ? `<button type="button" class="indietro salva" id="rcS" aria-label="${salvata ? 'Togli dalle ricette salvate' : 'Salva ricetta'}" aria-pressed="${salvata}" style="right:16px;left:auto">${salvata ? ic('segnalibro', 20, 2).replace('fill="none"', 'fill="currentColor"') : ic('segnalibro', 20, 2)}</button>` : ''}
      ${ILLU_PIATTO}</div>
    <div class="r-corpo"><div style="display:flex;flex-direction:column;gap:10px"><h1 id="rcT">${esc(x.nome)}</h1>
      <div class="etich">${tempo ? `<span>${esc(tempo)}</span>` : ''}${condivisa ? `<span>${comm.length} persone</span>` : R && R.porzioni ? `<span>${esc(/\d+$/.test(R.porzioni) ? R.porzioni + (R.porzioni === '1' ? ' persona' : ' persone') : R.porzioni)}</span>` : ''}${R && R.difficolta ? `<span>${esc(R.difficolta)}</span>` : ''}${ctx && !x.fonte ? `<span class="ok">${ic('spunta', 14, 2.6)}Rispetta il piano</span>` : ''}${x.adattata ? `<span class="ok">${ic('spunta', 14, 2.6)}Adattata al piano</span>` : ''}${x.base ? '<span>Ricetta base</span>' : ''}</div>
      ${x.fonte && x.fonte.url ? `<a class="fonte" href="${esc(x.fonte.url)}" target="_blank" rel="noopener">${ic('link', 15, 2)}<span>Ricetta originale${x.fonte.autore ? ' di ' + esc(x.fonte.autore) : ''} · ${esc(x.fonte.sito || '')}</span>${ic('avanti', 14, 2)}</a>` : ''}</div>
      <div id="rcCorpo" style="display:flex;flex-direction:column;gap:16px">${!R && haAI() && ctx ? `<div class="vuoto"><div class="giro"></div><br>Preparo la ricetta con gli alimenti del piano…</div>` : ''}
      ${conPiano && D.partecipanti.length > 1 ? `<section class="chi-mangia" aria-labelledby="rcChi"><h2 id="rcChi">Chi mangia questo piatto</h2><div class="chips">${D.partecipanti.map((p, i) => `<button type="button" class="chip ${comm.includes(p.id) ? 'on' : ''}" data-comm="${p.id}" aria-pressed="${comm.includes(p.id)}" ${p.id === ctx.pid ? 'disabled' : ''}>${avatar(p, i, 'p')}${esc(nomeCorto(p.id))}</button>`).join('')}</div>${condivisa ? '<p class="by" style="margin:8px 0 0;line-height:1.45">Dosi sommate: ognuno con le grammature del suo piano; chi non ha quell\'alimento nel piano ha la stessa porzione.</p>' : ''}</section>` : ''}
      ${ingr.length ? `<section class="ingr" aria-labelledby="rcI"><h2 id="rcI">${condivisa ? 'Ingredienti per ' + comm.length : ctx ? 'Ingredienti dal piano' : 'Ingredienti'}</h2>${ingr.map(i => `<div class="ir"><b>${esc(i.nome)}${i.parti ? `<small class="parti">${i.parti.map(z => esc(nomeCorto(z.p)) + ' ' + esc(z.t)).join(' · ')}</small>` : ''}</b>${tag(i.st)}<span class="qt">${esc(i.qta)}</span></div>`).join('')}</section>` : ''}
      ${condivisa && !x.base && passi.length ? '<p class="by" style="margin:-6px 0 0">Nei passaggi le quantità sono per una persona: usa i totali qui sopra.</p>' : ''}
      ${passi.length ? `<section class="passi" aria-labelledby="rcP"><h2 id="rcP">Procedimento</h2>${passi.map((t, n) => `<div class="passo"><i>${n + 1}</i><span>${esc(t)}</span></div>`).join('')}</section>` : ''}
      ${R && R.consigli ? `<div class="info-verde">${ic('info', 20, 2)}<span>${esc(R.consigli)}</span></div>` : ''}
      ${!R && !haAI() ? '<p class="by" style="margin:0">Per la ricetta completa con dosi e consigli serve un\'intelligenza artificiale (Impostazioni).</p>' : ''}</div>
    </div>
    <div class="barra-giu">${ingr.length ? `<button type="button" class="btn" id="rcM">${mancanti.length ? (dispensa().items.length ? 'Metti ' + (mancanti.length === 1 ? 'l\'ingrediente mancante' : 'i ' + mancanti.length + ' mancanti') + ' in spesa' : 'Metti gli ingredienti in spesa') : 'Hai già tutto'}</button>` : `<button type="button" class="btn bordo" id="rcB2">Chiudi</button>`}
      ${passi.length ? `<button type="button" class="quad" id="rcC" aria-label="Avvia la modalità cucina">${ic('play', 22, 1.8)}</button>` : ''}</div></div>`;
  contenitorePagina().innerHTML = h; inerteSotto(true);
  $('rcB').onclick = chiudiPagina; if ($('rcB2')) $('rcB2').onclick = chiudiPagina;
  if ($('rcS')) $('rcS').onclick = () => salvaPreferita(x, ctx);
  $('pagina').querySelectorAll('[data-comm]').forEach(b => b.onclick = async () => {
    const p = b.dataset.comm, l = comm.includes(p) ? comm.filter(z => z !== p) : comm.concat(p); vibra();
    x.commensali = l; mostraRicettaPagina(x, ctx);
    const ric = ricetteDi(ctx.pid); if (ric[ctx.gi] && ric[ctx.gi][ctx.k] === x) await salvaRicette(ctx.pid);
  });
  if ($('rcC')) $('rcC').onclick = () => modalitaCucina(x, passi, ingr);
  if ($('rcM')) $('rcM').onclick = async () => {
    if (!mancanti.length) return toast('Hai già tutto in casa');
    const righe = mancanti.map(i => ({ gruppo_id: G.id, nome: i.nome, quantita: i.qta, reparto: repartoDi(i.nome), giorno: 'Ricetta · ' + x.nome, comprato: false, aggiunto_da: CHI }));
    $('rcM').disabled = true;
    if (await scrivi(() => ST.ins('spesa', righe))) { await ricarica(); toast((righe.length === 1 ? '1 prodotto aggiunto' : righe.length + ' prodotti aggiunti') + ' alla Spesa ✓'); mostraRicettaPagina(x, ctx); }
  };
}

async function salvaPreferita(x, ctx) {
  if (!IO) return;
  const l = preferiteDi().slice(), i = l.findIndex(r => r.nome === x.nome);
  if (i >= 0) { l.splice(i, 1); toast('Tolta dalle ricette salvate'); }
  else { l.unshift({ nome: x.nome, tempo: x.tempo || '', preparazione: x.preparazione || '', ricetta: x.ricetta || null, fonte: x.fonte || null, adattata: !!x.adattata, salvata: oggiISO() }); toast('Ricetta salvata ✓ La ritrovi nel Piano'); }
  D.stato['preferite:' + IO] = l; mostraRicettaPagina(x, ctx); renderPiano();
  await scrivi(() => ST.salvaStato(G.id, 'preferite:' + IO, l));
}
function foglioPreferite() {
  const l = preferiteDi(), server = ST && ST.modo === 'supabase' && !ANTEPRIMA;
  foglio(`<h2>Ricette salvate</h2><p class="q" style="margin:4px 0 0">${l.length ? l.length + ' ' + (l.length === 1 ? 'ricetta' : 'ricette') : 'Ancora nessuna ricetta salvata'}</p>
    ${server ? `<button class="btn" id="pfImp" type="button" style="margin-top:12px">${ic('link', 18)}Importa una ricetta da un link</button>` : ''}
    ${l.length ? `<div class="menu-righe" style="margin-top:12px">${l.map((r, i) => `<button type="button" data-pf="${i}"><span class="t"><b>${esc(r.nome)}</b><small>${esc(r.tempo || '')}${r.fonte ? ' · ' + esc(r.fonte.sito) : ''}${r.salvata ? ' · salvata il ' + esc(new Date(r.salvata + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })) : ''}</small></span>${ic('avanti', 18, 2)}</button>`).join('')}</div>` : ''}`);
  $('pop').querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { chiudi(); mostraRicettaPagina(l[+b.dataset.pf], null); });
  if ($('pfImp')) $('pfImp').onclick = () => foglioImporta(null);
}

// ---------- Ricette da un link (GialloZafferano, Fatto in casa da Benedetta, Chef in camicia…) ----------
// Il server apre solo la pagina scelta dalla persona e ne legge i dati della ricetta, per il ricettario personale.
// Si tiene sempre il link alla fonte originale; con un pasto del piano le dosi si adattano alle grammature.
function foglioImporta(ctx, link = '') {
  if (!ST || ST.modo !== 'supabase') return toast('Per importare ricette da un link serve il server Supabase');
  foglio(`<h2>Importa una ricetta</h2><p class="q" style="line-height:1.5;margin:4px 0 10px">Incolla il link di una ricetta che ti piace (GialloZafferano, Fatto in casa da Benedetta, Chef in camicia…). ${ctx ? 'Adatto le dosi alle grammature di questo pasto.' : 'La ritrovi nelle ricette salvate.'} Resta sempre il collegamento alla ricetta originale.</p>
    <label class="lb" for="impU">Link della ricetta</label><div style="display:flex;gap:8px"><input id="impU" type="url" inputmode="url" placeholder="https://…" value="${esc(link)}" autocomplete="off" spellcheck="false" style="flex:1;min-width:0"><button class="btn ghost" id="impP" type="button" style="width:auto;margin:0;padding:0 14px">Incolla</button></div>
    <button class="btn" id="impG" type="button" style="margin-top:12px">${ic('link', 18)}Importa</button>`);
  $('impP').onclick = async () => {
    try { const t = await navigator.clipboard.readText(), m = String(t || '').match(/https?:\/\/\S+/); if (m) $('impU').value = m[0]; else toast('Negli appunti non c\'è un link'); }
    catch (e) { $('impU').focus(); toast('Tieni premuto nel campo e scegli Incolla'); }
  };
  const vai = () => { const m = $('impU').value.trim().match(/https?:\/\/\S+/); if (!m) return toast('Incolla un link che inizia con https://'); importaRicetta(m[0], ctx); };
  $('impG').onclick = vai; $('impU').onkeydown = e => { if (e.key === 'Enter') vai(); };
}
async function importaRicetta(url, ctx) {
  let sito = ''; try { sito = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
  const att = attesaIA('Leggo la ricetta', 'Da ' + (sito || 'questo sito') + '. Di solito bastano pochi secondi.');
  try {
    const r = await ST.cucina({ azione: 'importa', url });
    let x = { nome: r.nome, tempo: r.tempo || '', fonte: { url: r.url || url, sito: r.sito || sito, autore: r.autore || '' }, ricetta: { tempo: r.tempo || '', porzioni: r.porzioni || '', difficolta: '', ingredienti: r.ingredienti || [], passaggi: r.passaggi || [], consigli: '' } };
    if (ctx) { att.testo('Adatto le dosi alle grammature del piano…'); x = await adattaAlPasto(x, ctx); }
    att.fine();
    if (ctx) {
      x.da = CHI; const ric = ricetteDi(ctx.pid); ric[ctx.gi] = ric[ctx.gi] || []; ric[ctx.gi][ctx.k] = x; D.stato['ricette:' + ctx.pid] = ric;
      renderPiano(); renderOggi(); mostraRicettaPagina(x, ctx); await salvaRicette(ctx.pid);
    } else if (preferiteDi().some(p => p.nome === x.nome)) { mostraRicettaPagina(x, null); toast('È già tra le ricette salvate'); }
    else await salvaPreferita(x, null);
  } catch (e) { att.errore(e.message); }
}
// Dosi per una persona: gli ingredienti che corrispondono al pasto prendono la grammatura del piano
async function adattaAlPasto(x, { pid, gi, k }) {
  const pa = pianoDi(pid).giorni[gi].pasti[k];
  if (haAI()) {
    try {
      const out = await ia([{ text: 'Adatta questa ricetta a UNA persona e al pasto della dieta. Per ogni ingrediente che corrisponde a un alimento del pasto (anche se ha un nome diverso, es. spaghetti = pasta) usa ESATTAMENTE la grammatura del piano; riduci gli altri ingredienti in proporzione per 1 persona; non aggiungere alimenti che non sono nel pasto, salvo spezie, erbe e aromi; se un ingrediente importante della ricetta non è nel pasto, tienilo in piccola quantità e dillo nei consigli. Mantieni i passaggi della ricetta originale aggiornando le quantità citate. JSON: {"ingredienti":["Ingrediente quantità"],"passaggi":[""],"consigli":"cosa hai cambiato, in una frase"}. Ricetta: ' + JSON.stringify({ nome: x.nome, porzioni: x.ricetta.porzioni, ingredienti: x.ricetta.ingredienti, passaggi: x.ricetta.passaggi }) + ' Pasto: ' + pastoPerIA(pid, gi, pa) }]);
      if (out && Array.isArray(out.ingredienti) && out.ingredienti.length) return { ...x, adattata: true, ricetta: { ...x.ricetta, porzioni: '1', ingredienti: out.ingredienti.map(String), passaggi: Array.isArray(out.passaggi) && out.passaggi.length ? out.passaggi.map(String) : x.ricetta.passaggi, consigli: String(out.consigli || '') } };
    } catch (e) { /* si adatta qui sotto, senza intelligenza artificiale */ }
  }
  return adattaLocale(x, pid, gi, pa);
}
// L'alimento del piano che corrisponde a un ingrediente (stessa categoria, es. spaghetti = pasta, o parola in comune)
const CAT_DOSI = ['cereale', 'carne', 'pesce', 'legumi', 'tonno', 'uova', 'formaggio', 'sugo', 'olio', 'patate', 'pane', 'latte', 'fiocchi', 'verdura', 'frutta', 'secca'];
const paroleDi = s => senzaAccenti(s).split(/[^a-z]+/).filter(w => w.length > 3 && !/^(della|delle|dello|degli|fresco|fresca|extra|vergine|scatola|naturale|cotti|crudi|parziale)$/.test(w));
function trovaVoce(nome, voci, usate) {
  const t = CUOCO.tipoDi(nome), pw = paroleDi(nome);
  return voci.find(v => !usate.has(v) && v.qta != null && paroleDi(v.nome).some(w => pw.some(q => q.slice(0, 5) === w.slice(0, 5))))
    || voci.find(v => !usate.has(v) && v.qta != null && CAT_DOSI.includes(t) && CUOCO.tipoDi(v.nome) === t);
}
function adattaLocale(x, pid, gi, pa) {
  const n = parseFloat(String(x.ricetta.porzioni).replace(',', '.')) || 0;
  const voci = (pa.voci || []).map((_, i) => voceEffettiva(pid, gi, pa, i)), usate = new Set();
  const trova = nome => trovaVoce(nome, voci, usate);
  const aPezzi = u => !u || /spicch|pz|pezz|fett|fogli|cucchia|ramett|uov|bicchier|tazz|vasett|pizzic|ciuff|mazz/i.test(u);
  const arrotonda = (val, unita) => aPezzi(unita) ? Math.max(.5, Math.round(val * 2) / 2) : val >= 10 ? Math.round(val) : Math.round(val * 10) / 10;
  let cambiati = 0;
  const ingredienti = x.ricetta.ingredienti.map(t => {
    const { nome, qta } = dividiIngrediente(t), v = trova(nome);
    if (v) { usate.add(v); cambiati++; return nome + ' ' + qtaTesto(v); }
    const m = qta.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (m && n > 1) { const u = m[2].trim(); return nome + ' ' + LETTORE.fmt(arrotonda(parseFloat(m[1].replace(',', '.')) / n, u)) + (u ? ' ' + u : ''); }
    return t;
  });
  const consigli = (cambiati ? 'Per ' + (cambiati === 1 ? 'l\'ingrediente che è' : 'gli ingredienti che sono') + ' nel piano ho usato le tue grammature' : 'Nessun ingrediente corrisponde al pasto: controlla le dosi') + (n > 1 ? '; gli altri sono ridotti per 1 persona (la ricetta originale è per ' + n + ').' : '.') + ' Nei passaggi possono restare le quantità originali.';
  return { ...x, adattata: true, ricetta: { ...x.ricetta, porzioni: '1', ingredienti, consigli } };
}

// ---------- Modalità cucina: un passaggio alla volta, timer, schermo acceso, comandi a voce ----------
let _wake = null, _timer = null, _voce = null;
async function tieniSchermo() { try { if ('wakeLock' in navigator) { _wake = await navigator.wakeLock.request('screen'); return true; } } catch (e) {} return false; }
function rilasciaSchermo() { try { _wake && _wake.release(); } catch (e) {} _wake = null; clearInterval(_timer); _timer = null; try { _voce && _voce.stop(); } catch (e) {} _voce = null; }
function bip() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .35, .7].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.2, a.currentTime + t); o.start(a.currentTime + t); o.stop(a.currentTime + t + .2); }); } catch (e) {} try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {} }

function modalitaCucina(x, passi, ingr) {
  let step = 0, fine = 0, acceso = false, ascolto = false;
  const Riconosci = window.SpeechRecognition || window.webkitSpeechRecognition;
  const minuti = t => { const m = String(t).match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:min|minuti)\b/i); return m ? +(m[2] || m[1]) : 0; };
  const ingrDi = t => { const n = senzaAccenti(t); return ingr.filter(i => { const w = senzaAccenti(i.nome).split(/\s+/).find(z => z.length > 3); return w && n.includes(w); }); };
  const disegna = () => {
    const t = passi[step], last = step === passi.length - 1, min = minuti(t), resta = fine ? Math.max(0, Math.round((fine - Date.now()) / 1000)) : 0;
    contenitorePagina().innerHTML = `<div class="cucina" role="dialog" aria-modal="true" aria-label="Modalità cucina"><div class="in">
      <div class="top"><button type="button" class="x" id="ccX" aria-label="Chiudi modalità cucina">${ic('x', 20, 2)}</button>${acceso ? `<span class="acceso">${ic('sole', 16, 2)}Schermo sempre acceso</span>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:10px"><div class="segs" style="grid-template-columns:repeat(${passi.length},minmax(0,1fr))" aria-hidden="true">${passi.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
        <span class="lbl">Passo ${step + 1} di ${passi.length} · ${esc(x.nome)}</span></div>
      <p class="testo" aria-live="polite">${esc(t)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${ingrDi(t).map(i => `<span class="chip-c">${esc(i.nome + (i.qta ? ' ' + i.qta : ''))}</span>`).join('')}</div>
      ${min ? `<button type="button" class="timer ${fine ? 'va' : ''}" id="ccT">${ic('timer', 22, 2)}${fine ? (resta ? 'Mancano ' + String(Math.floor(resta / 60)).padStart(2, '0') + ':' + String(resta % 60).padStart(2, '0') + ' · ferma' : 'Tempo scaduto') : 'Avvia timer ' + min + ' min'}</button>` : ''}
      <div class="nav-c"><button type="button" class="ind" id="ccI" ${step === 0 ? 'disabled' : ''}>Indietro</button><button type="button" class="ava" id="ccA">${last ? 'Fatto, buon appetito' : 'Avanti'}</button></div>
      ${Riconosci ? `<button type="button" class="voce-c ${ascolto ? 'on' : ''}" id="ccV" aria-pressed="${ascolto}">${ascolto ? 'Ti ascolto: di\' "Avanti" o "Indietro"' : 'Puoi anche dire "Avanti" ad alta voce: tocca qui per attivare'}</button>` : ''}
    </div></div>`;
    inerteSotto(true);
    $('ccX').onclick = () => { rilasciaSchermo(); mostraRicettaPagina(x, null); };
    $('ccI').onclick = () => { if (step > 0) { step--; fine = 0; clearInterval(_timer); disegna(); } };
    $('ccA').onclick = () => { if (last) { rilasciaSchermo(); chiudiPagina(); toast('Buon appetito!'); return; } step++; fine = 0; clearInterval(_timer); vibra(); disegna(); };
    if ($('ccT')) $('ccT').onclick = () => {
      if (fine) { fine = 0; clearInterval(_timer); return disegna(); }
      fine = Date.now() + min * 60000; clearInterval(_timer);
      _timer = setInterval(() => { if (!$('ccT')) return clearInterval(_timer); if (Date.now() >= fine) { clearInterval(_timer); bip(); toast('Tempo scaduto: ' + x.nome); } disegna(); }, 1000);
      disegna();
    };
    if ($('ccV')) $('ccV').onclick = () => {
      if (ascolto) { ascolto = false; try { _voce.stop(); } catch (e) {} _voce = null; return disegna(); }
      try {
        _voce = new Riconosci(); _voce.lang = 'it-IT'; _voce.continuous = true; _voce.interimResults = false;
        _voce.onresult = e => { const t = senzaAccenti(e.results[e.results.length - 1][0].transcript); if (/avanti|prossimo|fatto/.test(t)) $('ccA') && $('ccA').click(); else if (/indietro|torna/.test(t)) $('ccI') && $('ccI').click(); };
        _voce.onend = () => { if (ascolto && _voce) try { _voce.start(); } catch (e) {} };
        _voce.onerror = e => { if (e.error === 'not-allowed') { ascolto = false; toast('Microfono non consentito'); disegna(); } };
        _voce.start(); ascolto = true; disegna();
      } catch (e) { toast('Comandi a voce non disponibili su questo dispositivo'); }
    };
  };
  tieniSchermo().then(v => { acceso = v; disegna(); });
  disegna();
}
