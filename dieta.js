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
    let h = `<div class="cibo"><div class="r"><span class="${v.scambiata ? 'scamb' : ''}">${esc(v.nome)}${v.scambiata ? `<small>al posto di ${esc(LETTORE.testoVoce(v0))}</small>` : ''}</span><span>${esc(qtaTesto(v))}${v.misura ? `<small>${esc(v.misura)}</small>` : ''}</span></div>`;
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
const REGOLE_REPARTO = [
  [/scatola|in acqua|al naturale|passata|sugo|olio|marmellat|cacao|burro d|burro di|cioccolat|mandorl|pistacch|noci|olive|popcorn|cracker|barretta|dressing|frutta secca|semi|miele|aceto|sale\b|legumi|lenticchi|ceci|fagioli/, 'Dispensa'],
  [/caff|succo|\bte\b|tisana|^acqua\b|bevand/, 'Bevande'],
  [/surgelat/, 'Surgelati'],
  [/yogurt|latte|kefir|parmigian|mozzarella|ricotta|philadelphia|feta|uov|formaggio|dessert|burrata|grana/, 'Latticini e uova'],
  [/pollo|tacchino|manzo|vitello|maiale|prosciutto|fesa|hamburger|bresaola|salume|pesce|spigola|branzino|merluzzo|nasello|orata|salmone|polpo|seppia|calamar|gamber|trota|sgombro|tonno|spada|carne|cotolett|affettat/, 'Carne e pesce'],
  [/pane|pasta|riso|couscous|farro|orzo|avena|fiocchi|cereali|biscott|biscotti|piadina|gnocchi|grissini|pizza|magretti|gallette|fette/, 'Pane e cereali'],
  [/frutta|verdur|ortagg|insalata|rughetta|rucola|spinaci|zucchin|patat|pomodor|mel[ae]\b|banan|aranc|limon|carot|cipoll|finocchi|funghi|peperon|melanzan|broccol|cavol|fagiolin/, 'Frutta e verdura']
];
const repartoDi = nome => { const n = senzaAccenti(nome); const r = REGOLE_REPARTO.find(([re]) => re.test(n)); return r ? r[1] : 'Altro'; };
function quantitaSpesa(e) {
  if (!(e.tot > 0)) return '';
  if (e.unita === 'g' && e.tot >= 1000) return LETTORE.fmt(e.tot / 1000) + ' kg';
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
function foglioSpesaDieta(pid) {
  const piano = pianoDi(pid), oggiIdx = giornoDiOggi(piano), p = D.partecipanti.find(x => x.id === pid);
  foglio(`<h2 style="padding-right:36px">Lista della spesa dalla dieta</h2><p class="q" style="line-height:1.5;margin:4px 0 0">Scegli i giorni: sommo le quantità di ogni alimento, tenendo conto delle alternative che hai scelto.</p>
    <div class="gsel">${piano.giorni.map((g, i) => `<label class="gsc"><input type="checkbox" value="${i}" checked><span>${esc(g.giorno)}</span></label>`).join('')}</div>
    <div class="azioni" style="margin-bottom:6px"><button type="button" class="piccolo" id="gTutti">Tutti</button>${oggiIdx >= 0 ? '<button type="button" class="piccolo" id="gOggi">Da oggi in poi</button>' : ''}<button type="button" class="piccolo" id="gNess">Nessuno</button></div>
    <p class="by" id="gInfo" style="margin:6px 0 0"></p>
    <button class="btn" id="gGo" type="button" style="margin-top:8px">${ic('carrello', 18)}Crea la lista</button>`);
  const box = () => [...$('pop').querySelectorAll('.gsel input')];
  const scelti = () => box().filter(b => b.checked).map(b => +b.value);
  const info = () => { const n = scelti().length; $('gInfo').textContent = n ? n + (n === 1 ? ' giorno scelto' : ' giorni scelti') : 'Scegli almeno un giorno'; };
  box().forEach(b => b.onchange = info); info();
  $('gTutti').onclick = () => { box().forEach(b => b.checked = true); info(); };
  $('gNess').onclick = () => { box().forEach(b => b.checked = false); info(); };
  if ($('gOggi')) $('gOggi').onclick = () => { box().forEach(b => b.checked = +b.value >= oggiIdx); info(); };
  $('gGo').onclick = async () => {
    const idx = scelti(); if (!idx.length) return toast('Scegli almeno un giorno');
    const voci = sommaSpesa(pid, idx); if (!voci.length) return toast('Nessun alimento trovato nei giorni scelti');
    const etichetta = 'Dieta · ' + (pid === IO ? nomeP(pid) : p.nome);
    $('gGo').disabled = true; $('gGo').textContent = 'Creo la lista…';
    try {
      await scrivi(async () => {
        await ST.delWhere('spesa', { gruppo_id: G.id, giorno: etichetta, comprato: false });
        await ST.ins('spesa', voci.map(x => ({ gruppo_id: G.id, nome: x.nome, quantita: quantitaSpesa(x), reparto: repartoDi(x.nome), giorno: etichetta, comprato: false, aggiunto_da: CHI })));
      });
      await ricarica(); chiudi(); toast('Lista creata ✓ ' + voci.length + ' prodotti nella Spesa');
    } catch (e) { toast(e.message); if ($('gGo')) { $('gGo').disabled = false; $('gGo').textContent = 'Riprova'; } }
  };
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
