// Dieta strutturata: ogni pasto ha le sue voci (alimento, quantità, alternative). Qui ci sono le scelte per giorno,
// il foglio "Alternative" e la lista della spesa creata dalla dieta. Le diete vecchie (solo testo) continuano a funzionare.
const qtaTesto = v => v && v.qta != null ? LETTORE.fmt(v.qta) + (v.unita ? ' ' + v.unita : '') : '';
const haVoci = piano => !!(piano && piano.giorni && piano.giorni.some(g => g.pasti.some(p => p.voci)));

// Il giorno della dieta → la data di quel giorno nella settimana in corso (così la scelta vale solo per quel giorno)
const isoLocale = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function chiaveGiorno(piano, gi) {
  const nome = senzaAccenti(piano.giorni[gi].giorno);
  const wd = GIORNI_SETT.findIndex(x => senzaAccenti(x) === nome || nome.startsWith(senzaAccenti(x).slice(0, 3)));
  if (wd < 0) return 'g' + gi;
  const oggi = new Date(); oggi.setHours(12, 0, 0, 0);
  const d = new Date(oggi); d.setDate(d.getDate() + (((wd + 6) % 7) - ((oggi.getDay() + 6) % 7)));
  return isoLocale(d);
}
const scelteDi = pid => D.stato['scelte:' + pid] || {};
const sceltaVoce = (pid, gi, pa, i) => { const piano = pianoDi(pid); const s = scelteDi(pid)[chiaveGiorno(piano, gi)]; return s ? s[pa.tipo + '|' + i] : undefined; };
// La voce che si mangia davvero in quel giorno (originale o alternativa scelta)
function voceEffettiva(pid, gi, pa, i) {
  const v0 = pa.voci[i], sc = sceltaVoce(pid, gi, pa, i);
  return sc != null && v0.sost && v0.sost[sc] ? { ...v0.sost[sc], scambiata: true, origine: v0 } : { ...v0, scambiata: false, origine: v0 };
}
const testoPasto = (pid, gi, pa) => pa.voci ? pa.voci.map((_, i) => LETTORE.testoVoce(voceEffettiva(pid, gi, pa, i))).join('; ') : pa.alimenti;
// Testi per l'intelligenza artificiale: solo ciò che si mangia, senza le note né l'elenco delle alternative
const pastoPerIA = (pid, gi, pa) => JSON.stringify({ tipo: pa.tipo, alimenti: testoPasto(pid, gi, pa), ...(pa.voci || !pa.alternative ? {} : { alternative: pa.alternative }) });
const giornoPerIA = (pid, gi) => { const g = pianoDi(pid).giorni[gi]; return JSON.stringify({ giorno: g.giorno, pasti: g.pasti.map(pa => JSON.parse(pastoPerIA(pid, gi, pa))) }); };

function elencoSlot(g) {
  const out = LETTORE.SLOT.map(t => { const k = g.pasti.findIndex(p => p.tipo === t); return { pa: k >= 0 ? g.pasti[k] : null, k, tipo: t }; });
  g.pasti.forEach((p, k) => { if (!LETTORE.SLOT.includes(p.tipo)) out.push({ pa: p, k, tipo: p.tipo }); });
  return out;
}

// Gli alimenti di un pasto, come nel design: nome e quantità, sotto "Puoi sostituire con" e le alternative a pillola
function htmlCibi(pid, gi, k, pa) {
  return '<div class="cibi">' + pa.voci.map((v0, i) => {
    const v = voceEffettiva(pid, gi, pa, i), sost = v0.sost || [], sc = sceltaVoce(pid, gi, pa, i);
    let h = `<div class="cibo"><div class="r"><span class="${v.scambiata ? 'scamb' : ''}">${EMO.bottone(v.nome, '🍽️', '', true)}${esc(v.nome)}${v.scambiata ? `<small>al posto di ${esc(LETTORE.testoVoce(v0))}</small>` : ''}</span><span>${esc(qtaTesto(v))}${v.misura ? `<small>${esc(v.misura)}</small>` : ''}</span></div>`;
    if (sost.length) {
      const altre = sost.map((x, j) => ({ x, j })).filter(o => o.j !== sc), vis = altre.slice(0, 3);
      h += `<div class="sost"><span>${v.scambiata ? 'Oppure' : 'Puoi sostituire con'}</span>` +
        (v.scambiata ? `<button type="button" class="torna" data-sc="${k}|${i}|-1">Torna a ${esc(v0.nome)}</button>` : '') +
        vis.map(o => `<button type="button" data-sc="${k}|${i}|${o.j}" aria-label="Al posto di ${esc(v0.nome)}: ${esc(LETTORE.testoVoce(o.x))}">${esc(LETTORE.testoVoce(o.x))}</button>`).join('') +
        (altre.length > 3 ? `<button type="button" class="altre" data-alt="${k}|${i}">altre ${altre.length - 3}</button>` : '') + '</div>';
    }
    return h + '</div>';
  }).join('') + '</div>';
}
function foglioAlternative(pid, gi, k, i) {
  const piano = pianoDi(pid), g = piano.giorni[gi], pa = g.pasti[k], v = pa.voci[i], att = sceltaVoce(pid, gi, pa, i);
  const q = x => [qtaTesto(x), x.misura].filter(Boolean).join(' · ');
  const riga = (nome, qt, sel, j) => `<button type="button" class="alt-opt ${sel ? 'on' : ''}" data-s="${j}"><span class="an">${esc(nome)}</span><span class="aq">${esc(qt)}</span>${sel ? ic('spunta', 18, 2.4) : ''}</button>`;
  foglio(`<h2 style="padding-right:36px">Alternative a ${esc(v.nome)}</h2><p class="q" style="line-height:1.5;margin:4px 0 0">${esc(pa.tipo)} · ${esc(g.giorno)}. Scegli cosa mangi al posto di ${esc(LETTORE.testoVoce(v))}. Vale solo per questo giorno.</p>
    <div class="alt-lista">${riga(v.nome + ' (come da dieta)', q(v), att == null, -1)}${v.sost.map((x, j) => riga(x.nome, q(x), att === j, j)).join('')}</div>`);
  $('pop').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const j = +b.dataset.s; chiudi(); vibra(); scegliAlternativa(pid, gi, pa.tipo, i, j < 0 ? null : j); });
}

async function scegliAlternativa(pid, gi, tipo, i, idx) {
  const piano = pianoDi(pid), kd = chiaveGiorno(piano, gi), tutte = { ...scelteDi(pid) };
  const lim = Date.now() - 21 * 864e5; // le scelte di settimane fa non servono più
  Object.keys(tutte).forEach(c => { if (/^\d{4}-\d\d-\d\d$/.test(c) && new Date(c).getTime() < lim) delete tutte[c]; });
  const g = { ...(tutte[kd] || {}) }, ch = tipo + '|' + i;
  if (idx == null) delete g[ch]; else g[ch] = idx;
  if (Object.keys(g).length) tutte[kd] = g; else delete tutte[kd];
  D.stato['scelte:' + pid] = tutte; renderPiano(); if (typeof renderOggi === 'function') renderOggi();
  await scrivi(() => ST.salvaStato(G.id, 'scelte:' + pid, tutte));
}

// ---------- Lista della spesa dalla dieta ----------
// In quale zona del supermercato si trova un prodotto. Vince la prima regola che corrisponde; quello che non si riconosce va in Extra.
const REGOLE_REPARTO = [
  [/surgelat|congelat|gelat[oi]\b|bastoncini|minestrone surgelato|ghiaccio/, 'Surgelati'],
  // confezionati e scatolame che contengono parole di altri reparti (tonno in scatola, latte di mandorla, frutta secca…)
  [/in scatola|scatolett|al naturale|sott.?olio|sott.?aceto|passata|pelati|sugo|pesto|burro d(i |.)?arachidi|semi di|crema di|latte di (mandorl|soia|riso|avena|cocco)|bevanda di|frutta secca|frutta a guscio|succo|marmellat|confettura|fette biscottate|cracker|gallette|cereali|muesli|fiocchi d.?avena|barrett|farina|lievito|zucchero|cacao|cioccolat|miele|olio\b|aceto|sale\b|pepe\b|spezie|dado|brodo|caffe|\bte\b|tisana|acqua\b|vino|birra|bibit|detersiv|sapone|shampoo|dentifric|carta |spugn|sacchett|pellicola|alluminio|tovagliol|lettiera|crocchett/, 'Extra'],
  [/pesce|spigola|branzino|orata|merluzzo|nasello|salmone|tonno|trota|sgombro|sardin|alici|acciugh|spada|platessa|sogliola|baccala|polpo|seppi|calamar|totan|gamber|scampi|cozze|vongole|frutti di mare/, 'Pescheria'],
  [/pollo|tacchino|manzo|vitello|vitellone|maiale|agnello|coniglio|macinato|hamburger|salsicc|bistecca|fettin|cotolett|arrosto|spezzatino|costat|carne\b|scaloppin|polpett|fesa di tacchino/, 'Macelleria'],
  [/prosciutto|bresaola|speck|salame|mortadella|affettat|salum|pancetta|guanciale|wurstel|porchetta|parmigian|grana|pecorino|provol|gorgonzola|asiago|fontina|scamorza|caciocavallo|emmental|formaggio stagionato|olive|rosticceria|pollo arrosto|insalata di riso|insalata russa|hummus|gastronomia/, 'Gastronomia'],
  [/latte\b|yogurt|kefir|skyr|uov|album|burro\b|panna|mozzarella|ricotta|philadelphia|stracchino|crescenza|feta|burrata|fiocchi di latte|mascarpone|formaggio|sottilette|pasta fresca|pasta sfoglia|pasta brisee|tortellini|ravioli|gnocchi|tofu|seitan|budino|dessert/, 'Banco frigo'],
  [/pane\b|panin|pan bauletto|pancarre|focacc|piadin|tortill|pizza|rustic|cornett|brioche|croissant|torta|crostata|pasticc|ciambell|biscott|grissini|taralli|friselle/, 'Panificio/Pasticceria'],
  [/frutta|verdur|ortagg|insalata|lattuga|rughetta|rucola|spinaci|bietol|zucchin|zucca|patat|pomodor|mel[ae]\b|per[ae]\b|banan|aranc|mandarin|limon|kiwi|fragol|uva\b|pesc(a|he)\b|albicocc|prugn|susin|cilieg|anguria|melone|ananas|mango|avocado|mirtill|lampon|carot|cipoll|aglio|porr|sedano|finocchi|funghi|peperon|melanzan|broccol|cavol|verza|fagiolin|asparag|carciof|cetriol|ravanell|radicchio|barbabietol|basilico|prezzemolo|rosmarino|salvia|erbe/, 'Ortofrutta e verdura']
];
const repartoDi = nome => { const n = senzaAccenti(String(nome || '')).toLowerCase(); const r = REGOLE_REPARTO.find(([re]) => re.test(n)); return r ? r[1] : 'Extra'; };
// La zona di un prodotto già in lista: quella salvata se è una delle zone di oggi, altrimenti (liste fatte con i vecchi reparti) si ricava dal nome
const zonaDi = x => REPARTI.includes(x.reparto) ? x.reparto : repartoDi(x.nome);
function quantitaSpesa(e) {
  if (!(e.tot > 0)) return '';
  if (e.unita === 'ml' && e.tot >= 1000) return LETTORE.fmt(e.tot / 1000) + ' l';
  return LETTORE.fmt(e.tot) + (e.unita ? ' ' + e.unita : '');
}
function sommaSpesa(pid, indici) {
  const piano = pianoDi(pid), m = new Map();
  for (const gi of indici) for (const pa of piano.giorni[gi].pasti) {
    if (!pa.voci) continue;
    pa.voci.forEach((_, i) => {
      const v = voceEffettiva(pid, gi, pa, i), chiave = senzaAccenti(v.nome) + '|' + (v.unita || '');
      let e = m.get(chiave); if (!e) m.set(chiave, e = { nome: v.nome, unita: v.unita || '', tot: 0 });
      if (v.qta != null) e.tot += v.qta;
    });
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}
// Gli alimenti da comprare per i giorni scelti del piano e per i pasti comuni scelti.
// Ogni alimento ricorda per chi e per quando serve: "Lunedì · Pranzo · Ale", "ven 20 nov · Cena · Pasto comune".
function vociPerSpesa(pid, indici, comuni) {
  const piano = pianoDi(pid), m = new Map(), chi = nomeP(pid);
  const add = (v, fonte) => {
    const chiave = senzaAccenti(v.nome).toLowerCase() + '|' + (v.unita || '');
    let e = m.get(chiave); if (!e) m.set(chiave, e = { nome: v.nome, unita: v.unita || '', tot: 0, fonti: [] });
    if (v.qta != null) e.tot += v.qta;
    if (!e.fonti.includes(fonte)) e.fonti.push(fonte);
  };
  // un pasto del piano sostituito da un pasto comune scelto non si conta due volte
  const salta = new Set();
  comuni.forEach(e => { if (!e.chi.includes(pid)) return; const g = giornoPerData(piano, new Date(e.iso + 'T12:00:00')); if (g >= 0) piano.giorni[g].pasti.forEach((pa, k) => { if (stessoPasto(pa.tipo, e.tipo)) salta.add(g + '|' + k); }); });
  for (const gi of indici) {
    const g = piano.giorni[gi];
    g.pasti.forEach((pa, k) => { if (!pa.voci || salta.has(gi + '|' + k)) return; pa.voci.forEach((_, i) => add(voceEffettiva(pid, gi, pa, i), g.giorno + ' · ' + pa.tipo + ' · ' + chi)); });
  }
  // pasto comune: il piatto è il pasto scelto da chi l'ha proposto; ognuno con la sua porzione (se nel suo piano c'è lo stesso alimento)
  comuni.forEach(e => {
    const src = pastoPerInsieme(e.da, e); if (!src) return;
    const fonte = dataBreve(e.iso) + ' · ' + e.tipo + ' · Pasto comune';
    e.chi.forEach(p => {
      if (p === e.da) return src.voci.forEach(v => add(v, fonte));
      const ps = pastoPerInsieme(p, e), usate = new Set();
      src.voci.forEach(v => { const w = ps && trovaVoce(v.nome, ps.voci, usate); if (w && (w.unita || '') === (v.unita || '') && w.qta != null) { usate.add(w); add({ nome: v.nome, unita: v.unita, qta: w.qta }, fonte); } else add(v, fonte); });
    });
  });
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}
function foglioSpesaDieta(pid) {
  const piano = pianoDi(pid), oggiIdx = giornoDiOggi(piano), p = D.partecipanti.find(x => x.id === pid);
  const comuni = pid === IO && typeof insiemiMiei === 'function' ? insiemiMiei() : [];
  let giorniScelti = piano.giorni.map((_, i) => i), comuniScelti = comuni.map(e => e.id);
  const passo1 = () => {
    foglio(`<h2 style="padding-right:36px">Lista della spesa dal piano</h2><p class="q" style="line-height:1.5;margin:4px 0 0">Scegli i giorni${comuni.length ? ' e i pasti comuni' : ''}: poi ti mostro i prodotti e scegli tu quali aggiungere.</p>
      <div class="gsel">${piano.giorni.map((g, i) => `<label class="gsc"><input type="checkbox" value="${i}" ${giorniScelti.includes(i) ? 'checked' : ''}><span>${esc(g.giorno)}</span></label>`).join('')}</div>
      <div class="azioni" style="margin-bottom:6px"><button type="button" class="piccolo" id="gTutti">Tutti</button>${oggiIdx >= 0 ? '<button type="button" class="piccolo" id="gOggi">Da oggi in poi</button>' : ''}<button type="button" class="piccolo" id="gNess">Nessuno</button></div>
      ${comuni.length ? `<label class="lb">Pasti comuni in programma</label><div class="sp-conf">${comuni.map(e => `<label class="sp-c"><input type="checkbox" data-pc="${esc(e.id)}" ${comuniScelti.includes(e.id) ? 'checked' : ''}><span class="t"><b>${esc(dataBreve(e.iso))} · ${esc(e.tipo)}</b><small>con ${esc(e.chi.filter(z => z !== IO).map(nomeP).join(', '))}${e.origine ? ' · ' + esc(e.origine) : ''}</small></span></label>`).join('')}</div>` : ''}
      <p class="by" id="gInfo" style="margin:6px 0 0"></p>
      <button class="btn" id="gGo" type="button" style="margin-top:8px">Avanti: scegli i prodotti</button>`);
    const box = () => [...$('pop').querySelectorAll('.gsel input')];
    const leggi = () => { giorniScelti = box().filter(b => b.checked).map(b => +b.value); comuniScelti = [...$('pop').querySelectorAll('[data-pc]')].filter(b => b.checked).map(b => b.dataset.pc); };
    const info = () => { leggi(); const n = giorniScelti.length, c = comuniScelti.length; $('gInfo').textContent = n || c ? [n ? n + (n === 1 ? ' giorno' : ' giorni') : '', c ? c + (c === 1 ? ' pasto comune' : ' pasti comuni') : ''].filter(Boolean).join(' e ') : 'Scegli almeno un giorno o un pasto comune'; };
    $('pop').querySelectorAll('.gsel input, [data-pc]').forEach(b => b.onchange = info); info();
    $('gTutti').onclick = () => { box().forEach(b => b.checked = true); info(); };
    $('gNess').onclick = () => { box().forEach(b => b.checked = false); info(); };
    if ($('gOggi')) $('gOggi').onclick = () => { box().forEach(b => b.checked = +b.value >= oggiIdx); info(); };
    $('gGo').onclick = () => { leggi(); if (!giorniScelti.length && !comuniScelti.length) return toast('Scegli almeno un giorno o un pasto comune'); passo2(); };
  };
  const passo2 = () => {
    const voci = vociPerSpesa(pid, giorniScelti, comuni.filter(e => comuniScelti.includes(e.id)));
    if (!voci.length) { toast('Nessun alimento trovato in quello che hai scelto'); return passo1(); }
    const etichetta = 'Dieta · ' + (pid === IO ? nomeP(pid) : p.nome);
    // già in lista (aggiunto a mano o da un'altra lista) o in casa secondo la Dispensa: si propone senza spunta
    const giaInLista = v => D.spesa.some(x => !x.comprato && !(x.giorno || '').startsWith(etichetta) && senzaAccenti(x.nome).toLowerCase() === senzaAccenti(v.nome).toLowerCase());
    const stato = voci.map(v => giaInLista(v) ? 'lista' : statoIngrediente(v.nome) === 'casa' ? 'casa' : '');
    foglio(`<h2 style="padding-right:36px">Cosa aggiungo?</h2><p class="q" style="line-height:1.5;margin:4px 0 0">Togli la spunta a quello che non ti serve. Sotto ogni prodotto: per quando e per chi.</p>
      <div class="azioni" style="margin:8px 0 6px"><button type="button" class="piccolo" id="sTutti">Tutti</button><button type="button" class="piccolo" id="sNess">Nessuno</button></div>
      <div class="sp-conf">${voci.map((v, i) => `<label class="sp-c"><input type="checkbox" data-sv="${i}" ${stato[i] ? '' : 'checked'}><span class="t"><b>${EMO.html(v.nome, '', '', true)}${esc(v.nome)}${stato[i] ? `<span class="tag casa">${stato[i] === 'lista' ? 'Già in lista' : 'In casa'}</span>` : ''}</b><small>Per ${esc(v.fonti.join('; '))}</small></span><span class="sp-q num">${esc(quantitaSpesa(v))}</span></label>`).join('')}</div>
      <button class="btn" id="sGo" type="button" style="margin-top:10px"></button><button class="link-txt" id="sInd" type="button" style="text-align:center">Indietro</button>`);
    const box = () => [...$('pop').querySelectorAll('[data-sv]')];
    const conta = () => { const n = box().filter(b => b.checked).length; $('sGo').disabled = !n; $('sGo').innerHTML = n ? ic('carrello', 18) + 'Aggiungi ' + n + (n === 1 ? ' prodotto' : ' prodotti') : 'Scegli almeno un prodotto'; };
    box().forEach(b => b.onchange = conta); conta();
    $('sTutti').onclick = () => { box().forEach(b => b.checked = true); conta(); };
    $('sNess').onclick = () => { box().forEach(b => b.checked = false); conta(); };
    $('sInd').onclick = passo1;
    $('sGo').onclick = async () => {
      const scelte = box().filter(b => b.checked).map(b => voci[+b.dataset.sv]); if (!scelte.length) return;
      const nomi = new Set(scelte.map(v => senzaAccenti(v.nome).toLowerCase()));
      // la lista creata prima dallo stesso piano: i prodotti uguali si sostituiscono (niente doppioni)
      const vecchi = D.spesa.filter(x => !x.comprato && (x.giorno || '').startsWith(etichetta) && nomi.has(senzaAccenti(x.nome).toLowerCase()));
      $('sGo').disabled = true; $('sGo').textContent = 'Aggiungo…';
      try {
        await scrivi(async () => {
          for (const x of vecchi) await ST.del('spesa', x.id);
          await ST.ins('spesa', scelte.map(v => ({ gruppo_id: G.id, nome: v.nome, quantita: quantitaSpesa(v), reparto: repartoDi(v.nome), giorno: etichetta + ' — ' + v.fonti.join('; '), comprato: false, aggiunto_da: CHI })));
        });
        await ricarica(); chiudi(); toast('Aggiunti ✓ ' + scelte.length + ' prodotti nella Spesa', { testo: 'Vedi', fn: () => vai('spesa') });
        avvisaSpesa(scelte.map(v => v.nome));
      } catch (e) { toast(e.message); if ($('sGo')) { $('sGo').disabled = false; $('sGo').textContent = 'Riprova'; } }
    };
  };
  passo1();
}

// ---------- Diete lette dall'intelligenza artificiale o scritte come testo: tutto nello stesso formato ----------
const numONull = x => { const n = typeof x === 'number' ? x : parseFloat(String(x ?? '').replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
const unitaOk = u => { u = senzaAccenti(u).replace(/\.$/, ''); return /^(g|gr|grammi)$/.test(u) ? 'g' : /^ml$/.test(u) ? 'ml' : ''; };
const pulisciVoce = v => ({ nome: String(v?.nome || '').trim(), qta: numONull(v?.qta), unita: unitaOk(v?.unita || ''), misura: String(v?.misura || '').trim() });
function vociDaTesto(t) {
  return String(t || '').split(/\s*;\s*|,\s+(?![^()]*\))|\s+\+\s+/).map(x => LETTORE.voceDaTesto(x)).filter(v => v && v.nome)
    .map(v => ({ nome: v.nome, qta: v.qta, unita: unitaOk(v.unita), misura: v.misura || '', sost: [] }));
}
function ricalcolaTesti(piano) {
  piano.giorni.forEach(g => {
    g.pasti.sort((x, y) => ordinePasto(x.tipo) - ordinePasto(y.tipo));
    g.pasti.forEach(pa => {
      if (!pa.voci) return;
      pa.alimenti = pa.voci.map(LETTORE.testoVoce).join('; ');
      pa.alternative = pa.voci.filter(v => (v.sost || []).length).map(v => v.nome + ': ' + v.sost.map(LETTORE.testoVoce).join(', ')).join('; ');
    });
  });
  return piano;
}
function normalizzaPiano(out) {
  const giorni = [];
  for (const g of (out?.giorni || [])) {
    const ng = { giorno: String(g?.giorno || 'Giorno ' + (giorni.length + 1)).trim(), pasti: [] };
    for (const p of (g?.pasti || [])) {
      const tipo = LETTORE.slot(p?.tipo || 'Pasto');
      const strutt = Array.isArray(p?.voci);
      const voci = strutt ? p.voci.map(v => ({ ...pulisciVoce(v), sost: (v?.sost || []).map(pulisciVoce).filter(x => x.nome) })).filter(v => v.nome) : vociDaTesto(p?.alimenti);
      let nota = String(p?.nota || '').trim();
      if (!strutt && p?.alternative) nota = (nota ? nota + '\n' : '') + 'In alternativa: ' + String(p.alternative).trim();
      if (!voci.length && !nota) continue;
      let pa = ng.pasti.find(x => x.tipo === tipo); if (!pa) ng.pasti.push(pa = { tipo, voci: [] });
      pa.voci.push(...voci); if (nota) pa.nota = (pa.nota ? pa.nota + '\n' : '') + nota;
      if (p?.link && !pa.link) { pa.link = p.link; pa.link_da = p.link_da; }
    }
    if (ng.pasti.length) giorni.push(ng);
  }
  return ricalcolaTesti({ giorni });
}

// ---------- Editor della dieta (a mano, o controllo dopo la lettura di un PDF) ----------
const GIORNI_ORDINE = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
function editorPiano(pid, bozza, opz = {}) {
  const p = D.partecipanti.find(x => x.id === pid) || { nome: '' }, vecchio = pianoDi(pid);
  const B = JSON.parse(JSON.stringify(bozza ? normalizzaPiano(bozza) : vecchio?.giorni?.length ? normalizzaPiano(vecchio) : { giorni: [] }));
  const inizio = JSON.stringify(B);
  let d = 0, noteAperte = new Set();
  const nuovo = !!opz.revisione || !vecchio?.giorni?.length;
  const fonti = { lettore: 'letta direttamente dal PDF, senza intelligenza artificiale', ia: 'letta dall\'intelligenza artificiale', testo: 'ricostruita dal testo del PDF: è il metodo meno preciso' };
  const slotDi = g => LETTORE.SLOT.concat(g.pasti.map(x => x.tipo).filter(t => !LETTORE.SLOT.includes(t)));
  const pasto = (si, crea) => { const g = B.giorni[d], t = slotDi(g)[si]; let pa = g.pasti.find(x => x.tipo === t); if (!pa && crea) { pa = { tipo: t, voci: [] }; g.pasti.push(pa); } return pa; };
  const unitaSel = (u, attr) => `<select ${attr} aria-label="Unità">${[['g', 'g'], ['ml', 'ml'], ['', '—']].map(([v, n]) => `<option value="${v}" ${(u || '') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const val = x => x == null ? '' : String(x).replace('.', ',');
  const box = () => { let e = $('pagina'); if (!e) { e = document.createElement('div'); e.id = 'pagina'; document.body.appendChild(e); } return e; };
  const disegna = () => {
    const sy = box().querySelector('.pagina')?.scrollTop || 0;
    const g = B.giorni[d];
    let h = `<div class="pagina semplice" role="dialog" aria-modal="true" aria-labelledby="edT"><div class="in">
      <div class="sub-cap"><button type="button" class="indietro" id="edX" aria-label="Chiudi">${ic('x', 20, 2)}</button><div><h1 id="edT">${opz.revisione ? 'Controlla la dieta' : nuovo ? 'Nuovo piano' : 'Modifica il piano'}</h1><p>${pid === IO ? 'Il tuo piano alimentare' : 'Piano di ' + esc(p.nome)}</p></div></div>
      ${opz.revisione ? `<div class="avviso">${ic('info', 18, 2)}<span><strong>Dieta ${fonti[opz.revisione] || 'letta dal PDF'}.</strong> Controlla giorni, grammature e alternative: correggi quello che serve, poi salva.</span></div>` : ''}
      <div class="ed-giorni" role="tablist" aria-label="Giorni">${B.giorni.map((x, i) => `<button type="button" role="tab" class="${i === d ? 'on' : ''}" aria-selected="${i === d}" data-edg="${i}">${esc(x.giorno)}</button>`).join('')}<button type="button" data-edg="+" aria-label="Aggiungi un giorno">${ic('piu', 18, 2.2)}</button></div>`;
    if (!g) h += `<div class="card vuoto">${ic('calendario', 32)}<b>Nessun giorno</b><br>Aggiungi il primo giorno con il pulsante +.</div>`;
    else {
      h += `<div class="riga"><label class="sr" for="edGN">Nome del giorno</label><input id="edGN" class="grow" value="${esc(g.giorno)}" style="margin:0"><button type="button" class="ico-btn" id="edGD" aria-label="Elimina ${esc(g.giorno)}">${ic('cestino', 20)}</button></div>`;
      h += slotDi(g).map((t, si) => {
        const pa = g.pasti.find(x => x.tipo === t), voci = pa ? pa.voci : [];
        return `<section class="ed-slot" aria-label="${esc(t)}"><h3>${esc(t)}<span class="by">${voci.length ? voci.length + (voci.length === 1 ? ' alimento' : ' alimenti') : 'vuoto'}</span></h3>` +
          voci.map((v, i) => `<div class="ed-voce"><div class="ed-n"><input aria-label="Alimento" placeholder="Alimento" data-f="${si}|${i}|nome" value="${esc(v.nome)}"><button type="button" class="del" data-delv="${si}|${i}" aria-label="Togli ${esc(v.nome)}">${ic('x', 18)}</button></div>
            <div class="ed-q"><input aria-label="Quantità di ${esc(v.nome)}" inputmode="decimal" placeholder="Qtà" data-f="${si}|${i}|qta" value="${esc(val(v.qta))}">${unitaSel(v.unita, `data-f="${si}|${i}|unita"`)}<input aria-label="Misura casalinga di ${esc(v.nome)}" placeholder="Misura, es. 1 cucchiaio" data-f="${si}|${i}|misura" value="${esc(v.misura || '')}"></div>
            <div class="ed-alt">${(v.sost || []).map((x, j) => `<div class="ed-voce"><div class="ed-n"><input aria-label="Alternativa" placeholder="Alternativa" data-f="${si}|${i}|${j}|nome" value="${esc(x.nome)}"><button type="button" class="del" data-dela="${si}|${i}|${j}" aria-label="Togli l'alternativa ${esc(x.nome)}">${ic('x', 18)}</button></div><div class="ed-q"><input aria-label="Quantità di ${esc(x.nome)}" inputmode="decimal" placeholder="Qtà" data-f="${si}|${i}|${j}|qta" value="${esc(val(x.qta))}">${unitaSel(x.unita, `data-f="${si}|${i}|${j}|unita"`)}<input aria-label="Misura casalinga di ${esc(x.nome)}" placeholder="Misura" data-f="${si}|${i}|${j}|misura" value="${esc(x.misura || '')}"></div></div>`).join('')}
            <div class="ed-azioni"><button type="button" class="n" data-adda="${si}|${i}">+ Alternativa</button></div></div></div>`).join('') +
          `<div class="ed-azioni"><button type="button" data-add="${si}">+ Alimento</button>${pa?.nota || noteAperte.has(t) ? '' : `<button type="button" class="n" data-nota="${si}">+ Nota</button>`}</div>` +
          (pa?.nota || noteAperte.has(t) ? `<label class="lb" for="edN${si}">Nota del nutrizionista</label><textarea id="edN${si}" rows="3" data-f="${si}|nota">${esc(pa?.nota || '')}</textarea>` : '') + '</section>';
      }).join('');
    }
    h += `<div style="height:20px"></div></div></div><div class="barra-giu"><button type="button" class="btn bordo" id="edA" style="flex:1">Annulla</button><button type="button" class="btn" id="edS" style="flex:2">Salva dieta</button></div>`;
    box().innerHTML = h; inerteSotto(true);
    const pg = box().querySelector('.pagina'); pg.scrollTop = sy;
    collega();
  };
  const collega = () => {
    const q = sel => box().querySelectorAll(sel);
    q('[data-f]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const parti = inp.dataset.f.split('|'), si = +parti[0];
      if (parti[1] === 'nota') { const pa = pasto(si, true); pa.nota = inp.value; return; }
      const pa = pasto(si, true), v = pa.voci[+parti[1]], campo = parti[parti.length - 1], dest = parti.length === 4 ? v.sost[+parti[2]] : v;
      dest[campo] = campo === 'qta' ? numONull(inp.value) : inp.value;
    }));
    q('[data-edg]').forEach(b => b.onclick = () => {
      if (b.dataset.edg !== '+') { d = +b.dataset.edg; return disegna(); }
      const libero = GIORNI_ORDINE.find(n => !B.giorni.some(x => senzaAccenti(x.giorno) === senzaAccenti(n))) || 'Giorno ' + (B.giorni.length + 1);
      chiedi('Nuovo giorno', 'Usa il nome del giorno della settimana: così l\'app sa qual è il giorno di oggi.', libero, 'Aggiungi', n => {
        n = n.trim(); if (!n) return; B.giorni.push({ giorno: n, pasti: [] });
        B.giorni.sort((x, y) => { const i = GIORNI_ORDINE.findIndex(z => senzaAccenti(z) === senzaAccenti(x.giorno)), j = GIORNI_ORDINE.findIndex(z => senzaAccenti(z) === senzaAccenti(y.giorno)); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
        d = B.giorni.findIndex(x => x.giorno === n); disegna();
      });
    });
    if ($('edGN')) $('edGN').oninput = e => { B.giorni[d].giorno = e.target.value; const c = box().querySelector(`[data-edg="${d}"]`); if (c) c.textContent = e.target.value || '—'; };
    if ($('edGD')) $('edGD').onclick = () => conferma('Eliminare ' + (B.giorni[d].giorno || 'questo giorno') + '?', 'Il giorno e i suoi pasti verranno tolti dalla bozza. Puoi ancora annullare senza salvare.', 'Elimina', () => { B.giorni.splice(d, 1); d = Math.max(0, d - 1); disegna(); }, true);
    q('[data-add]').forEach(b => b.onclick = () => { const pa = pasto(+b.dataset.add, true); pa.voci.push({ nome: '', qta: null, unita: 'g', misura: '', sost: [] }); disegna(); const ins = box().querySelectorAll(`[data-f^="${b.dataset.add}|${pa.voci.length - 1}|nome"]`); if (ins[0]) ins[0].focus(); });
    q('[data-delv]').forEach(b => b.onclick = () => { const [si, i] = b.dataset.delv.split('|').map(Number); pasto(si).voci.splice(i, 1); disegna(); });
    q('[data-adda]').forEach(b => b.onclick = () => { const [si, i] = b.dataset.adda.split('|').map(Number); const v = pasto(si).voci[i]; (v.sost = v.sost || []).push({ nome: '', qta: null, unita: v.unita || 'g', misura: '' }); disegna(); });
    q('[data-dela]').forEach(b => b.onclick = () => { const [si, i, j] = b.dataset.dela.split('|').map(Number); pasto(si).voci[i].sost.splice(j, 1); disegna(); });
    q('[data-nota]').forEach(b => b.onclick = () => { noteAperte.add(slotDi(B.giorni[d])[+b.dataset.nota]); disegna(); });
    const esci = () => { box().innerHTML = ''; inerteSotto(false); };
    const annulla = () => JSON.stringify(B) === inizio && !opz.revisione ? esci() : conferma(opz.revisione ? 'Non salvare questa dieta?' : 'Uscire senza salvare?', 'Le modifiche fatte qui andranno perse.', 'Esci senza salvare', esci, true);
    $('edX').onclick = annulla; $('edA').onclick = annulla;
    $('edS').onclick = async () => {
      const giorni = B.giorni.map(g => ({ giorno: String(g.giorno || '').trim() || 'Giorno', pasti: g.pasti.map(pa => ({ ...pa, nota: String(pa.nota || '').trim(), voci: pa.voci.filter(v => String(v.nome).trim()).map(v => ({ ...v, nome: v.nome.trim(), misura: String(v.misura || '').trim(), sost: (v.sost || []).filter(x => String(x.nome).trim()).map(x => ({ ...x, nome: x.nome.trim(), misura: String(x.misura || '').trim() })) })) }))
        .map(pa => { if (!pa.nota) delete pa.nota; return pa; }).filter(pa => pa.voci.length || pa.nota) })).filter(g => g.pasti.length);
      if (!giorni.length) return toast('Aggiungi almeno un alimento');
      const vuoti = B.giorni.length - giorni.length;
      // i link alle ricette salvati restano sul pasto giusto
      giorni.forEach(g => g.pasti.forEach(pa => { const v = vecchio?.giorni?.find(x => x.giorno === g.giorno)?.pasti.find(x => x.tipo === pa.tipo); if (v?.link && !pa.link) { pa.link = v.link; pa.link_da = v.link_da; } }));
      const piano = ricalcolaTesti({ giorni, da: CHI });
      esci();
      await salvaPianoNuovo(pid, piano, nuovo);
      if (vuoti > 0) toast('Dieta salvata ✓ ' + vuoti + (vuoti === 1 ? ' giorno vuoto non è stato salvato' : ' giorni vuoti non sono stati salvati'));
    };
  };
  disegna();
}
// Mentre è aperta una pagina a schermo intero, il resto dell'app non si raggiunge con la tastiera
function inerteSotto(si) { ['main', 'nav.sezioni'].forEach(s => { const e = document.querySelector(s); if (e) e.inert = si; }); }

async function salvaPianoNuovo(pid, piano, nuovo) {
  const nome = nomeP(pid);
  if (nuovo) { D.stato['ricette:' + pid] = {}; D.stato['scelte:' + pid] = {}; LS.del('giorno:' + pid); }
  personaPiano = pid; renderPiano(); renderOggi();
  if (await salvaPiano(pid, piano)) {
    if (nuovo) await scrivi(async () => { await ST.salvaStato(G.id, 'ricette:' + pid, {}); await ST.salvaStato(G.id, 'scelte:' + pid, {}); });
    const np = piano.giorni.reduce((n, g) => n + g.pasti.length, 0);
    toast((nuovo ? 'Dieta caricata ✓ ' : 'Dieta salvata ✓ ') + piano.giorni.length + (piano.giorni.length === 1 ? ' giorno, ' : ' giorni, ') + np + ' pasti');
    avvisaGruppo(nuovo ? 'Nuova dieta' : 'Pasti aggiornati', `${CHI} ha ${nuovo ? 'caricato' : 'aggiornato'} la dieta di ${pid === IO ? CHI : nome}`);
  }
  renderPiano(); renderOggi(); renderGruppo();
}
