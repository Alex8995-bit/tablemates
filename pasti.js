// Pasti: scambiare i pasti del piano tra loro e scrivere a mano il piatto di un giorno (con gli ingredienti per la spesa).

// ---------- Scambiare due pasti: pranzo con cena, oppure con il pasto di un altro giorno ----------
// Si scambia il contenuto (alimenti, note, link, piatto e ricetta); il momento del giorno resta al suo posto.
async function scambiaPasti(pid, g1, k1, g2, k2, silenzioso) {
  const piano = JSON.parse(JSON.stringify(pianoDi(pid))), a = piano.giorni[g1].pasti[k1], b = piano.giorni[g2].pasti[k2];
  piano.giorni[g1].pasti[k1] = Object.assign({}, b, { tipo: a.tipo });
  piano.giorni[g2].pasti[k2] = Object.assign({}, a, { tipo: b.tipo });
  const R = JSON.parse(JSON.stringify(ricetteDi(pid))), ra = (R[g1] || [])[k1] || null, rb = (R[g2] || [])[k2] || null;
  R[g1] = R[g1] || []; R[g2] = R[g2] || []; R[g1][k1] = rb; R[g2][k2] = ra;
  // le alternative scelte per quei due pasti non valgono più (gli alimenti sono cambiati)
  const S = JSON.parse(JSON.stringify(scelteDi(pid)));
  [[g1, a.tipo], [g2, b.tipo]].forEach(([g, tipo]) => { const s = S[chiaveGiorno(piano, g)]; if (s) Object.keys(s).forEach(c => { if (c.startsWith(tipo + '|')) delete s[c]; }); });
  // i pasti comuni seguono il piatto: se indicavano uno dei due pasti, ora indicano l'altro
  const comuni = Object.keys(D.stato).filter(c => c.startsWith('insieme:')).map(c => [c, D.stato[c]]).filter(([, e]) => e && !e.eliminato && e.da === pid && ((e.gi === g1 && e.k === k1) || (e.gi === g2 && e.k === k2)));
  comuni.forEach(([, e]) => { if (e.gi === g1 && e.k === k1) { e.gi = g2; e.k = k2; } else { e.gi = g1; e.k = k1; } e.origine = piano.giorni[e.gi].giorno + ' · ' + piano.giorni[e.gi].pasti[e.k].tipo; });
  D.stato['piano:' + pid] = piano; D.stato['ricette:' + pid] = R; D.stato['scelte:' + pid] = S;
  renderPiano(); renderOggi(); if (typeof renderComuni === 'function') renderComuni();
  const ok = await scrivi(async () => {
    await ST.salvaStato(G.id, 'piano:' + pid, piano); await ST.salvaStato(G.id, 'ricette:' + pid, R); await ST.salvaStato(G.id, 'scelte:' + pid, S);
    for (const [c, e] of comuni) await ST.salvaStato(G.id, c, e);
  });
  if (ok && !silenzioso) {
    const stesso = g1 === g2;
    toast(stesso ? `${a.tipo} e ${b.tipo} scambiati` : `Scambiato con ${piano.giorni[g2].giorno}`, { testo: 'Annulla', fn: () => scambiaPasti(pid, g1, k1, g2, k2, true) });
    avvisaGruppo('Piano', `${CHI} ha scambiato due pasti nel piano${pid === IO ? '' : ' di ' + nomeP(pid)}`, { tipo: 'piano', scheda: 'piano' });
  }
  return ok;
}
function foglioScambia(pid, gi, k) {
  const piano = pianoDi(pid), mio = piano.giorni[gi].pasti[k];
  let gsel = gi;
  const haCibo = pa => pa.voci ? pa.voci.length : pa.alimenti;
  const disegna = () => {
    const pasti = piano.giorni[gsel].pasti.map((pa, i) => ({ pa, i })).filter(x => haCibo(x.pa) && !(gsel === gi && x.i === k)).sort((a, b) => ordinePasto(a.pa.tipo) - ordinePasto(b.pa.tipo));
    foglio(`<h2 style="padding-right:36px">Scambia ${esc(mio.tipo.toLowerCase())} di ${esc(piano.giorni[gi].giorno.toLowerCase())}</h2>
      <p class="q" style="line-height:1.5;margin:4px 0 4px">Scegli con quale pasto scambiarlo: dello stesso giorno o di un altro.</p>
      <div class="chips" style="margin-top:6px">${piano.giorni.map((g, i) => `<button type="button" class="chip ${i === gsel ? 'on' : ''}" data-xg="${i}" aria-pressed="${i === gsel}" style="padding:0 14px">${esc(g.giorno)}${i === gi ? ' (stesso)' : ''}</button>`).join('')}</div>
      <div class="cm-scelte">${pasti.map(({ pa, i }) => `<button type="button" class="cm-scelta" data-xk="${i}"><span class="og-em" aria-hidden="true">${EMO.per(pa.tipo, '🍽️')}</span><span class="t"><b>${esc(pa.tipo)}</b><small>${esc(riassuntoDi(pid, gsel, pa))}</small></span>${ic('scambio', 18, 2)}</button>`).join('') || '<p class="q" style="margin:6px 0">Nessun altro pasto in questo giorno.</p>'}</div>`);
    $('pop').querySelectorAll('[data-xg]').forEach(b => b.onclick = () => { gsel = +b.dataset.xg; disegna(); });
    $('pop').querySelectorAll('[data-xk]').forEach(b => b.onclick = () => { chiudi(); vibra(); scambiaPasti(pid, gi, k, gsel, +b.dataset.xk); });
  };
  disegna();
}

// ---------- Scrivere il piatto di un giorno ----------
// "Stasera pizza": il piatto scritto vale per quella data e quel pasto, al posto del piano. Documento "scritti:<persona>".
const scrittiDi = pid => D.stato['scritti:' + pid] || {};
const chiaveScritto = (iso, tipo) => iso + '|' + slugPasto(slotDi(tipo));
const scrittoDi = (pid, iso, tipo) => { const x = scrittiDi(pid)[chiaveScritto(iso, tipo)]; return x && x.nome ? x : null; };
async function salvaScritto(pid, iso, tipo, nome) {
  const tutti = Object.assign({}, scrittiDi(pid)), c = chiaveScritto(iso, tipo), lim = isoDi(Date.now() - 21 * 864e5);
  Object.keys(tutti).forEach(k => { if (k.slice(0, 10) < lim) delete tutti[k]; }); // quelli di settimane fa non servono più
  if (nome) tutti[c] = { nome, t: Date.now(), da: CHI }; else delete tutti[c];
  D.stato['scritti:' + pid] = tutti; renderOggi(); renderPiano();
  return scrivi(() => ST.salvaStato(G.id, 'scritti:' + pid, tutti));
}

// ---------- I pasti scelti per Oggi ----------
// Oggi non si riempie da solo con il piano: ognuno sceglie dal suo piano cosa mangia, quando e in quale momento.
// Documento "inoggi:<persona>" (ognuno scrive solo il suo): { "2026-11-19|cena": { gi, k, giorno, tipo, slot, t } }
const inOggiDi = pid => D.stato['inoggi:' + pid] || {};
let inOggiData = ''; // la data mostrata in Oggi quando si va a scegliere dal piano
function sceltoValido(pid, s) {
  const g = pianoDi(pid)?.giorni?.[s?.gi], pa = g?.pasti?.[s.k];
  return pa && g.giorno === s.giorno && pa.tipo === s.tipo ? { ...s, g, pa } : null; // il piano è cambiato: la scelta non vale più
}
const sceltoPerOggi = (pid, iso, slot) => sceltoValido(pid, inOggiDi(pid)[chiaveScritto(iso, slot)]);
const sceltiDelGiorno = (pid, iso) => Object.entries(inOggiDi(pid)).filter(([c]) => c.slice(0, 10) === iso).map(([, s]) => sceltoValido(pid, s)).filter(Boolean);
async function salvaInOggi(pid, iso, slot, v) {
  const tutti = Object.assign({}, inOggiDi(pid)), c = chiaveScritto(iso, slot), lim = isoDi(Date.now() - 21 * 864e5);
  Object.keys(tutti).forEach(k => { if (k.slice(0, 10) < lim) delete tutti[k]; });
  if (v) tutti[c] = Object.assign({ slot, t: Date.now() }, v); else delete tutti[c];
  D.stato['inoggi:' + pid] = tutti; renderOggi(); renderPiano();
  return scrivi(() => ST.salvaStato(G.id, 'inoggi:' + pid, tutti));
}
// Foglio «Metti in Oggi»: il pasto del piano, il giorno in cui lo mangi e il momento
function foglioInOggi(pid, gi, k) {
  const g = pianoDi(pid).giorni[gi], pa = g.pasti[k];
  let iso = inOggiData && inOggiData >= oggiISO() ? inOggiData : oggiISO(), slot = SLOT_COMUNI.find(x => stessoPasto(x, pa.tipo)) || pa.tipo;
  const domani = isoDi(Date.now() + 864e5);
  const disegna = () => {
    const ora = sceltoPerOggi(pid, iso, slot), stesso = ora && ora.gi === gi && ora.k === k, quando = iso === oggiISO() ? 'oggi' : iso === domani ? 'domani' : dataBreve(iso);
    const comune = typeof insiemeDi === 'function' && pid === IO ? insiemeDi(iso, slot) : null;
    foglio(`<h2 style="padding-right:36px">Metti in Oggi</h2><p class="q" style="line-height:1.5;margin:4px 0 0"><b>${esc(g.giorno)} · ${esc(pa.tipo)}</b>: ${esc(riassuntoDi(pid, gi, pa))}</p>
      <label class="lb">Quando lo mangi</label><div class="chips" style="margin-top:6px"><button type="button" class="chip ${iso === oggiISO() ? 'on' : ''}" data-io="${oggiISO()}" aria-pressed="${iso === oggiISO()}">Oggi</button><button type="button" class="chip ${iso === domani ? 'on' : ''}" data-io="${domani}" aria-pressed="${iso === domani}">Domani</button></div>
      <input id="ioD" type="date" value="${iso}" min="${oggiISO()}" style="width:100%;margin-top:8px" aria-label="Oppure scegli la data">
      <label class="lb">In quale momento</label><div class="chips" style="margin-top:6px" role="group" aria-label="Momento del giorno">${SLOT_COMUNI.map(x => `<button type="button" class="chip ${x === slot ? 'on' : ''}" data-is="${esc(x)}" aria-pressed="${x === slot}" style="padding:0 14px">${esc(x)}</button>`).join('')}</div>
      ${comune ? `<div class="avviso" style="margin-top:10px">${ic('info', 18, 2)}<span>Per ${esc(slot.toLowerCase())} di ${esc(quando)} c'è già un pasto comune: in Oggi si vede quello.</span></div>` : ora && !stesso ? `<p class="by" style="margin:10px 0 0">Prende il posto di ${esc(ora.g.giorno + ' · ' + ora.pa.tipo)}, già scelto per ${esc(slot.toLowerCase())} di ${esc(quando)}.</p>` : ''}
      <button class="btn" id="ioOk" type="button" style="margin-top:14px" ${stesso ? 'disabled' : ''}>${stesso ? 'Già in Oggi ✓' : 'Mangio questo ' + esc(quando)}</button>
      ${stesso ? `<button class="link-txt" id="ioVia" type="button" style="text-align:center">Togli da ${esc(quando)}</button>` : ''}`);
    const pop = $('pop');
    pop.querySelectorAll('[data-io]').forEach(b => b.onclick = () => { iso = b.dataset.io; disegna(); });
    pop.querySelectorAll('[data-is]').forEach(b => b.onclick = () => { slot = b.dataset.is; disegna(); });
    $('ioD').onchange = () => { if ($('ioD').value && $('ioD').value >= oggiISO()) { iso = $('ioD').value; disegna(); } };
    $('ioOk').onclick = async () => {
      chiudi(); vibra();
      if (await salvaInOggi(pid, iso, slot, { gi, k, giorno: g.giorno, tipo: pa.tipo })) toast(pa.tipo + ' di ' + g.giorno + ' → ' + slot.toLowerCase() + ' ' + quando + ' ✓', { testo: 'Vai a Oggi', fn: () => { ogData = iso === oggiISO() ? '' : iso; ogAperto = slot; vai('oggi'); renderOggi(); } });
    };
    if ($('ioVia')) $('ioVia').onclick = async () => { chiudi(); await salvaInOggi(pid, iso, slot, null); toast('Tolto da ' + quando); };
  };
  disegna();
}
// «Scrivi cosa mangi» da Oggi senza un pasto scelto: prima il momento
function foglioMomentoScrivi(iso) {
  foglio(`<h2>Scrivi cosa mangi</h2><p class="q" style="line-height:1.5;margin:4px 0 0">Per quale momento di ${esc(iso === oggiISO() ? 'oggi' : dataBreve(iso))}?</p>
    <div class="cm-scelte">${SLOT_COMUNI.map(x => `<button type="button" class="cm-scelta" data-ms="${esc(x)}"><span class="og-em" aria-hidden="true">${EMO.per(x, '🍽️')}</span><span class="t"><b>${esc(x)}</b><small>ore ${esc(oraDi(x))}</small></span></button>`).join('')}</div>`);
  $('pop').querySelectorAll('[data-ms]').forEach(b => b.onclick = () => foglioScrivi(IO, iso, b.dataset.ms));
}

// Piatti conosciuti → cosa serve comprare (per una persona, quantità indicative)
const PIATTI_NOTI = [
  [/pizza/, [['Base per pizza', '1 pacco'], ['Passata di pomodoro', '1 pacco'], ['Mozzarella', '1 pacco']]],
  [/hamburger|burger/, [['Pane per hamburger', '1 pacco'], ['Hamburger di manzo', '1 porzione'], ['Insalata', ''], ['Pomodori', ''], ['Formaggio a fette', '1 pacco']]],
  [/rustic/, [['Pasta sfoglia', '1 pacco'], ['Mozzarella', '1 pacco'], ['Prosciutto cotto', '100 g']]],
  [/carbonara/, [['Spaghetti', '100 g'], ['Guanciale', '50 g'], ['Uova', '1 pacco'], ['Pecorino', '30 g']]],
  [/amatriciana/, [['Bucatini', '100 g'], ['Guanciale', '50 g'], ['Passata di pomodoro', '1 pacco'], ['Pecorino', '30 g']]],
  [/pasta al pesto|al pesto/, [['Pasta', '100 g'], ['Pesto', '1 pacco'], ['Parmigiano', '20 g']]],
  [/pasta al (pomodoro|sugo)|al sugo|al pomodoro/, [['Pasta', '100 g'], ['Passata di pomodoro', '1 pacco'], ['Basilico', ''], ['Parmigiano', '20 g']]],
  [/lasagn/, [['Sfoglie per lasagne', '1 pacco'], ['Macinato', '150 g'], ['Passata di pomodoro', '1 pacco'], ['Besciamella', '1 pacco'], ['Parmigiano', '40 g']]],
  [/risotto/, [['Riso', '80 g'], ['Brodo vegetale', ''], ['Cipolla', ''], ['Parmigiano', '20 g'], ['Burro', '']]],
  [/frittata|omelette/, [['Uova', '1 pacco'], ['Parmigiano', '20 g']]],
  [/cotolett/, [['Fettine di pollo', '1 porzione'], ['Uova', '1 pacco'], ['Pangrattato', '1 pacco']]],
  [/polpett/, [['Macinato', '150 g'], ['Uova', '1 pacco'], ['Pangrattato', '1 pacco'], ['Parmigiano', '20 g']]],
  [/parmigiana/, [['Melanzane', ''], ['Passata di pomodoro', '1 pacco'], ['Mozzarella', '1 pacco'], ['Parmigiano', '40 g']]],
  [/toast/, [['Pancarrè', '1 pacco'], ['Prosciutto cotto', '50 g'], ['Formaggio a fette', '1 pacco']]],
  [/piadin/, [['Piadine', '1 pacco'], ['Prosciutto crudo', '50 g'], ['Rucola', ''], ['Stracchino', '1 pacco']]],
  [/poke/, [['Riso', '80 g'], ['Salmone', '1 porzione'], ['Avocado', ''], ['Edamame', ''], ['Salsa di soia', '']]],
  [/insalata di riso/, [['Riso', '80 g'], ['Tonno in scatola', '1 pacco'], ['Verdure sott\'olio', '1 pacco'], ['Uova', '1 pacco']]],
  [/caprese/, [['Mozzarella', '1 pacco'], ['Pomodori', ''], ['Basilico', '']]],
  [/tiramisu/, [['Savoiardi', '1 pacco'], ['Mascarpone', '1 pacco'], ['Uova', '1 pacco'], ['Caffè', ''], ['Cacao', '']]],
  [/pancake/, [['Farina', ''], ['Uova', '1 pacco'], ['Latte', '1 pacco']]],
  [/tacos|fajitas|burrito/, [['Tortillas', '1 pacco'], ['Petto di pollo', '1 porzione'], ['Peperoni', ''], ['Insalata', '']]],
  [/minestrone/, [['Minestrone surgelato', '1 pacco']]],
  [/pasta e fagioli/, [['Pasta', '80 g'], ['Fagioli in scatola', '1 pacco'], ['Passata di pomodoro', '1 pacco']]]
];
const PAROLE_VUOTE = new Set(['e', 'ed', 'con', 'al', 'alla', 'alle', 'allo', 'ai', 'agli', 'di', 'del', 'della', 'dei', 'delle', 'in', 'il', 'lo', 'la', 'le', 'i', 'gli', 'un', 'una', 'uno', 'o', 'oppure', 'ripieno', 'ripiena', 'ripieni', 'semplice', 'bianco', 'bianca', 'rosso', 'rossa', 'fresco', 'fresca', 'grigliato', 'grigliata', 'lesso', 'bollito', 'forno', 'padella', 'piastra', 'vapore', 'piatto', 'primo', 'secondo', 'contorno', 'poco', 'tanto', 'per', 'da', 'su']);
const NOMI_BREVI = { cotto: 'Prosciutto cotto', crudo: 'Prosciutto crudo' };
const maiuscola = t => t.charAt(0).toUpperCase() + t.slice(1);
// Senza intelligenza artificiale: piatti conosciuti + le parole della frase che sono alimenti ("riso salmone e zucchine")
function ingredientiLocali(testo) {
  const n = senzaAccenti(testo).replace(/[()«»"]/g, ' ').replace(/\s+/g, ' ').trim(), out = [], visti = new Set();
  const metti = (nome, q) => { const c = senzaAccenti(nome); if (visti.has(c)) return; visti.add(c); out.push({ nome, quantita: q || '' }); };
  let noto = false;
  PIATTI_NOTI.forEach(([re, l]) => { if (re.test(n)) { noto = true; l.forEach(([nome, q]) => metti(nome, q)); } });
  const parole = n.split(/[\s,;+\/]+/).filter(w => w && !PAROLE_VUOTE.has(w) && !/^\d/.test(w));
  for (let i = 0; i < parole.length; i++) {
    const w = parole[i];
    if (NOMI_BREVI[w]) { metti(NOMI_BREVI[w], ''); continue; }
    if (PIATTI_NOTI.some(([re]) => re.test(w))) continue; // "pizza", "hamburger": già scomposti sopra
    // "petto di pollo", "passata di pomodoro": le due parole restano insieme
    if (parole[i + 1] && /^(petto|filetto|fesa|fettine|passata|succo|latte|burro|farina|olio)$/.test(w) && (EMO.cibo(parole[i + 1]) || repartoDi(parole[i + 1]) !== 'Extra')) { metti(maiuscola(w + ' di ' + parole[i + 1]), ''); i++; continue; }
    if (EMO.cibo(w) || repartoDi(w) !== 'Extra') metti(maiuscola(w), '');
  }
  if (!out.length && !noto) metti(maiuscola(testo.trim()), '');
  return out;
}
async function ingredientiDi(testo) {
  if (typeof haAI === 'function' && haAI()) {
    try {
      const x = await ia([{ text: 'Elenca cosa bisogna comprare per preparare questo piatto per una persona, come lo farebbe una famiglia italiana. Solo ingredienti da supermercato, nomi brevi in italiano, quantità in grammi, porzioni o pacchi (stringa vuota se non serve). Niente sale, pepe, acqua. Massimo 10. Rispondi SOLO con JSON: {"ingredienti":[{"nome":"","quantita":""}]}. Piatto: ' + testo }]);
      const l = (x && x.ingredienti || []).filter(i => i && i.nome).slice(0, 12).map(i => ({ nome: maiuscola(String(i.nome).trim()), quantita: String(i.quantita || '').trim() }));
      if (l.length) return l;
    } catch (e) { /* senza risposta si usa l'elenco interno */ }
  }
  return ingredientiLocali(testo);
}

// Foglio «Scrivi cosa mangi»: il piatto, poi gli ingredienti da scegliere per la lista
function foglioScrivi(pid, iso, tipo) {
  const gia = scrittoDi(pid, iso, tipo), quando = iso === oggiISO() ? 'oggi' : dataBreve(iso);
  foglio(`<h2 style="padding-right:36px">${esc(tipo)} di ${esc(quando)}</h2><p class="q" style="line-height:1.5;margin:4px 0 0">Scrivi cosa ${pid === IO ? 'mangi' : 'mangia ' + esc(nomeP(pid))}: un piatto («pizza», «hamburger», «rustico ripieno») o gli alimenti («riso, salmone e zucchine»).</p>
    <label class="lb" for="scT">Cosa mangi</label><input id="scT" value="${esc(gia ? gia.nome : '')}" placeholder="es. Riso, salmone e zucchine" enterkeyhint="done" autocomplete="off">
    <button class="btn" id="scOk" type="button" style="margin-top:14px">${ic('carrello', 18)}Salva e scegli gli ingredienti</button>
    <button class="btn bordo" id="scSolo" type="button">Salva soltanto</button>
    ${gia ? `<button class="link-txt" id="scVia" type="button" style="text-align:center">Torna al piano</button>` : ''}`);
  const salva = async conSpesa => {
    const t = $('scT').value.trim(); if (!t) { $('scT').focus(); return toast('Scrivi cosa mangi'); }
    $('scOk').disabled = true; $('scOk').textContent = conSpesa ? 'Cerco gli ingredienti…' : 'Salvo…';
    await salvaScritto(pid, iso, tipo, t);
    if (!conSpesa) { chiudi(); return toast('Salvato ✓'); }
    foglioIngredienti(pid, iso, tipo, t, await ingredientiDi(t));
  };
  $('scOk').onclick = () => salva(true); $('scSolo').onclick = () => salva(false);
  $('scT').onkeydown = e => { if (e.key === 'Enter') salva(true); };
  if ($('scVia')) $('scVia').onclick = async () => { chiudi(); await salvaScritto(pid, iso, tipo, ''); toast('Torni al piano'); };
  setTimeout(() => $('scT') && $('scT').focus(), 50);
}
function foglioIngredienti(pid, iso, tipo, piatto, voci) {
  const comune = typeof comuniDelGiorno === 'function' && pid === IO && comuniDelGiorno(iso).some(e => stessoPasto(e.tipo, tipo));
  const per = [dataBreve(iso), tipo, comune ? 'Pasto comune' : nomeP(pid)].join(' · ');
  const giaInLista = v => D.spesa.some(x => !x.comprato && senzaAccenti(x.nome) === senzaAccenti(v.nome));
  const stato = voci.map(v => giaInLista(v) ? 'lista' : statoIngrediente(v.nome) === 'casa' ? 'casa' : '');
  foglio(`<h2 style="padding-right:36px">Ingredienti per «${esc(piatto)}»</h2><p class="q" style="line-height:1.5;margin:4px 0 0">Togli la spunta a quello che hai già. Finiscono in lista per: <b>${esc(per)}</b>.</p>
    <div class="sp-conf" style="margin-top:10px">${voci.map((v, i) => `<label class="sp-c"><input type="checkbox" data-iv="${i}" ${stato[i] ? '' : 'checked'}><span class="t"><b>${EMO.html(v.nome, '', '', true)}${esc(v.nome)}${stato[i] ? `<span class="tag casa">${stato[i] === 'lista' ? 'Già in lista' : 'In casa'}</span>` : ''}</b><small>${esc(repartoDi(v.nome))}</small></span><span class="sp-q num">${esc(v.quantita || '')}</span></label>`).join('')}</div>
    <button class="btn" id="inGo" type="button" style="margin-top:10px"></button><button class="link-txt" id="inNo" type="button" style="text-align:center">Non aggiungere nulla</button>`);
  const box = () => [...$('pop').querySelectorAll('[data-iv]')];
  const conta = () => { const n = box().filter(b => b.checked).length; $('inGo').disabled = !n; $('inGo').innerHTML = n ? ic('carrello', 18) + 'Metti in lista ' + n + (n === 1 ? ' prodotto' : ' prodotti') : 'Scegli almeno un prodotto'; };
  box().forEach(b => b.onchange = conta); conta();
  $('inNo').onclick = () => { chiudi(); toast('Piatto salvato ✓'); };
  $('inGo').onclick = async () => {
    const scelte = box().filter(b => b.checked).map(b => voci[+b.dataset.iv]); if (!scelte.length) return;
    $('inGo').disabled = true; $('inGo').textContent = 'Aggiungo…';
    try {
      await scrivi(() => ST.ins('spesa', scelte.map(v => ({ gruppo_id: G.id, nome: v.nome, quantita: v.quantita || '', reparto: repartoDi(v.nome), giorno: 'Per: ' + per, comprato: false, aggiunto_da: CHI }))));
      await ricarica(); chiudi(); toast('In lista ✓ ' + scelte.length + (scelte.length === 1 ? ' prodotto' : ' prodotti'), { testo: 'Vedi', fn: () => vai('spesa') });
      avvisaSpesa(scelte.map(v => v.nome));
    } catch (e) { toast(e.message); if ($('inGo')) { $('inGo').disabled = false; conta(); } }
  };
}

// ---------- Pasti: «Il mio piano» e «Insieme» nella stessa scheda ----------
const segPasti = att => `<nav class="seg" aria-label="Pasti">${[['piano', 'Il mio piano'], ['comuni', 'Insieme']].map(([k, n]) => `<button type="button" data-pv="${k}" class="${k === att ? 'on' : ''}" ${k === att ? 'aria-current="page"' : ''}>${n}</button>`).join('')}</nav>`;
document.addEventListener('click', e => {
  const pv = e.target.closest && e.target.closest('[data-pv]'); if (pv) { vibra(); return vai(pv.dataset.pv); }
  const c = e.target.closest && e.target.closest('[data-casa]'); if (c) vai('casa');
});

// ---------- Casa: conti, agenda, persone e impostazioni in un posto solo ----------
function renderCasa() {
  const el = $('t-casa'); if (!el) return;
  if (!G) { el.innerHTML = '<div class="testa"><h1>Casa</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const s = Conti.saldi(D.movimenti, D.partecipanti), mio = IO ? (s[IO] || 0) : 0, rr = Conti.rimborsi(s);
  const verso = mio > 0 ? rr.filter(r => r.a === IO) : rr.filter(r => r.da === IO), chi = verso.length === 1 ? nomeP(mio > 0 ? verso[0].da : verso[0].a) : '';
  const ultimo = D.movimenti.slice().sort((a, b) => String(b.created_at || b.data || '').localeCompare(String(a.created_at || a.data || '')))[0];
  const oggi = oggiISO(), ev = typeof vociDelGiorno === 'function' ? vociDelGiorno(oggi) : [], sc = typeof prossimeScadenze === 'function' ? prossimeScadenze(1).filter(x => x.d >= oggi) : [];
  const agenda = [ev[0] ? 'Oggi ' + (ev[0].inizio ? ev[0].inizio + ' ' : '') + ev[0].titolo : '', sc[0] && !(ev[0] && sc[0].e === ev[0]) ? sc[0].e.titolo + ' · ' + (sc[0].d === oggi ? 'oggi' : dataBreve(sc[0].d)) : ''].filter(Boolean).join(' · ');
  const server = ST && ST.modo === 'supabase';
  const riga = (id, icona, titolo, sotto, destra) => `<button type="button" id="${id}">${ic(icona, 22, 1.8)}<span class="t"><b>${titolo}</b>${sotto ? `<small>${sotto}</small>` : ''}</span>${destra ? `<span class="v on">${destra}</span>` : ''}${ic('avanti', 18, 2)}</button>`;
  el.innerHTML = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">${puntoLive()}${esc(G.nome)}</p><h1>Casa</h1></div><button type="button" class="ico-btn" id="csImp" aria-label="Impostazioni">${ic('ingranaggio', 22, 1.8)}</button></div>
    <section class="casa-saldo" aria-label="Conti di casa"><div><span>${mio > 0 ? (chi ? esc(chi) + ' ti deve' : 'Ti devono') : mio < 0 ? (chi ? 'Devi a ' + esc(chi) : 'Devi') : 'Conti di casa'}</span><b class="num">${mio ? eur(Math.abs(mio)) : 'In pari'}</b></div>
      <div class="riga" style="gap:8px"><button type="button" class="b1" id="csSpesa">${ic('piu', 18, 2.2)}Aggiungi spesa</button><button type="button" class="b2" id="csConti">Apri i conti</button></div></section>
    <div class="menu-righe">
      ${riga('csC', 'borsello', 'Conti', ultimo ? 'Ultima: ' + esc(ultimo.titolo) : 'Nessuna spesa ancora')}
      ${riga('csA', 'agenda', 'Agenda', agenda ? esc(agenda) : 'Niente in programma')}
      ${riga('csT', 'posate', 'A tavola', 'Chi mangia a casa questa settimana')}
      ${riga('csP', 'gruppo', 'Persone', esc(D.partecipanti.map(p => p.nome).join(', ')), 'Invita')}
    </div>
    <div class="menu-righe">
      ${riga('csN', 'campana', 'Notifiche', typeof notificheAttive === 'function' && notificheAttive() ? 'Attive su questo telefono' : 'Scegli cosa ti avvisa')}
      ${server && IO ? riga('csSiri', 'microfono', 'Siri', '«Ehi Siri, Casa»') : ''}
      ${riga('csChat', 'scintille', 'Assistente', 'Chiedi di pasti, spesa e conti')}
      ${riga('csI', 'ingranaggio', 'Impostazioni', 'Aspetto, piano, orari, avanzate')}
    </div><div style="height:8px"></div>`;
  const va = (id, t) => { if ($(id)) $(id).onclick = () => vai(t); };
  va('csImp', 'imp'); va('csI', 'imp'); va('csC', 'conti'); va('csConti', 'conti'); va('csA', 'agenda'); va('csT', 'presenze'); va('csP', 'gruppo'); va('csChat', 'chat');
  $('csSpesa').onclick = () => { vai('conti'); if (typeof formMovimento === 'function') formMovimento(); };
  $('csN').onclick = () => foglioNotifiche();
  if ($('csSiri')) $('csSiri').onclick = () => foglioCollega('siri');
}
