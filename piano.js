// Scheda Piano: la dieta di ogni persona del gruppo (da PDF o a mano), vista "Tutti" di oggi, piatti, ricette e link.
const REGOLE = 'Usa SOLO gli alimenti e le grammature indicati (ammessi spezie, erbe, aceto, limone, sale). Ispirati a ricette italiane note e realistiche, come quelle di siti di cucina affidabili. Preparazione in 3-5 passaggi numerati, brevi.';
const GIORNI_SETT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const ORDINE_PASTI = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'];
let personaPiano = LS.get('pianoPersona') || '';
const puntoLive = () => ST && ST.modo === 'supabase' ? `<span class="live ${live ? 'ok' : ''}" title="${live ? 'Sincronizzato' : 'Non collegato'}"></span>` : '';
const perIA = o => JSON.stringify(o, (k, v) => k === 'nota' ? undefined : v); // le note del nutrizionista non servono all'IA
const testoRicerca = p => p.alimenti.replace(/\d+([.,]\d+)?\s*(g|gr|grammi|ml|kg|cl)?\b/gi, ' ').replace(/[(),;:+]/g, ' ').replace(/\s+/g, ' ').trim();
const pianoDi = pid => D.stato['piano:' + pid] || null;
const ricetteDi = pid => D.stato['ricette:' + pid] || {};
const idxP = pid => D.partecipanti.findIndex(p => p.id === pid);
const senzaAccenti = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Il giorno della dieta che corrisponde a oggi (se i giorni hanno il nome della settimana)
function giornoDiOggi(piano) {
  const oggi = senzaAccenti(GIORNI_SETT[new Date().getDay()]);
  const i = (piano?.giorni || []).findIndex(g => senzaAccenti(g.giorno).includes(oggi) || senzaAccenti(g.giorno).startsWith(oggi.slice(0, 3)));
  return i;
}
function giornoScelto(pid) {
  const p = pianoDi(pid); if (!p || !p.giorni?.length) return 0;
  const salvato = LS.get('giorno:' + pid);
  if (salvato !== '' && +salvato < p.giorni.length) return +salvato;
  const o = giornoDiOggi(p); return o >= 0 ? o : 0;
}
function pastoProssimo(tipo) {
  const t = senzaAccenti(tipo), h = new Date().getHours() + new Date().getMinutes() / 60;
  const fascia = h < 10 ? 'colazione' : h < 11.5 ? 'spuntino' : h < 15 ? 'pranzo' : h < 18 ? 'merenda' : h < 22 ? 'cena' : '';
  return fascia && t.includes(fascia);
}
const ordinePasto = t => { const i = ORDINE_PASTI.findIndex(x => senzaAccenti(t).includes(x)); return i < 0 ? 99 : i; };

function testataGruppo() {
  const pp = D.partecipanti;
  return `<div class="barra"><button type="button" class="gruppo-btn" id="grBtn" aria-label="Cambia gruppo"><span class="lg">${esc((G.nome || '?')[0].toUpperCase())}</span>${esc(G.nome)}${ic('giu', 16, 2)}</button>
    <div class="avs" role="img" aria-label="${esc(pp.map(p => p.nome).join(', '))} nel gruppo">${pp.slice(0, 4).map((p, i) => avatar(p, i)).join('')}</div></div>`;
}
function collegaTestata(el) { const b = el.querySelector('#grBtn'); if (b) b.onclick = async () => { try { schermataGruppi(await ST.gruppi()); } catch (e) { toast(e.message); } }; }

function renderPiano() {
  const el = $('t-piano');
  if (!G) { el.innerHTML = '<div class="testa"><h1>Piano</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  if (!personaPiano || (personaPiano !== 'tutti' && idxP(personaPiano) < 0)) personaPiano = IO || 'tutti';
  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  let h = testataGruppo() + `<div class="testa"><p>${puntoLive()}${esc(oggi[0].toUpperCase() + oggi.slice(1))}</p><h1>Oggi si mangia</h1></div>`;
  h += `<div class="chips" role="tablist" aria-label="Di chi">` +
    `<button type="button" role="tab" class="chip solo ${personaPiano === 'tutti' ? 'on' : ''}" data-pp="tutti" aria-selected="${personaPiano === 'tutti'}">Tutti</button>` +
    D.partecipanti.map((p, i) => `<button type="button" role="tab" class="chip ${personaPiano === p.id ? 'on' : ''}" data-pp="${p.id}" aria-selected="${personaPiano === p.id}">${avatar(p, i, 'p')}${esc(p.id === IO ? 'Tu' : p.nome)}</button>`).join('') + '</div>';
  h += personaPiano === 'tutti' ? vistaTutti() : vistaPersona(personaPiano);
  el.innerHTML = h;
  collegaTestata(el);
  el.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { personaPiano = b.dataset.pp; LS.set('pianoPersona', personaPiano); vibra(); renderPiano(); });
  el.querySelectorAll('[data-gg]').forEach(b => b.onclick = () => { LS.set('giorno:' + personaPiano, b.dataset.gg); vibra(); renderPiano(); });
  el.querySelectorAll('[data-re]').forEach(b => b.onclick = () => altroPiatto(+b.dataset.re, b));
  el.querySelectorAll('[data-ric]').forEach(d => d.onclick = () => apriRicetta(d.dataset.pid || personaPiano, +d.dataset.g, +d.dataset.ric));
  el.querySelectorAll('[data-salva]').forEach(b => b.onclick = () => salvaLink(+b.dataset.salva));
  el.querySelectorAll('[data-vai]').forEach(b => b.onclick = () => { personaPiano = b.dataset.vai; LS.set('pianoPersona', personaPiano); renderPiano(); });
  if ($('gen')) $('gen').onclick = generaGiorno;
  if ($('up')) $('up').onclick = () => $('pdf').click();
  if ($('man')) $('man').onclick = () => editorDieta(personaPiano);
}

function vistaTutti() {
  const righe = {}; // tipo pasto → [{persona, pasto, piatto}]
  let qualcuno = false;
  D.partecipanti.forEach((p, i) => {
    const piano = pianoDi(p.id); if (!piano?.giorni?.length) return;
    qualcuno = true;
    const gi = giornoDiOggi(piano) >= 0 ? giornoDiOggi(piano) : giornoScelto(p.id), g = piano.giorni[gi], ric = ricetteDi(p.id)[gi] || [];
    g.pasti.forEach((pa, k) => {
      const chiave = senzaAccenti(pa.tipo).trim() || 'pasto';
      (righe[chiave] = righe[chiave] || { tipo: pa.tipo, voci: [] }).voci.push({ p, i, pa, piatto: ric[k], gi, k, giorno: g.giorno });
    });
  });
  if (!qualcuno) return `<div class="card vuoto">${ic('piano', 32)}<b>Nessuna dieta inserita</b><br>Ognuno può avere la sua: scegli il tuo nome qui sopra e inserisci i tuoi pasti. Anche chi non usa l'app, come un nonno o un bambino, può avere i suoi.</div>`;
  const senza = D.partecipanti.filter(p => !pianoDi(p.id)?.giorni?.length);
  return Object.values(righe).sort((a, b) => ordinePasto(a.tipo) - ordinePasto(b.tipo)).map(r =>
    `<article class="card pasto ${pastoProssimo(r.tipo) ? 'prossimo' : ''}"><div class="tp"><h3>${esc(r.tipo)}</h3>${pastoProssimo(r.tipo) ? '<span class="by pos" style="font-weight:700">Prossimo pasto</span>' : ''}</div>` +
    r.voci.map(v => `<div class="persona-pasto">${avatar(v.p, v.i, 'p')}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><b style="font-size:13px">${esc(v.p.id === IO ? 'Tu' : v.p.nome)} <span class="by">· ${esc(v.giorno)}</span></b><p class="al" style="font-size:14px">${esc(v.pa.alimenti)}</p>${v.pa.alternative ? `<p class="alt">In alternativa: ${esc(v.pa.alternative)}</p>` : ''}${v.piatto ? `<button type="button" class="link" style="text-align:left;padding:2px 0" data-ric="${v.k}" data-g="${v.gi}" data-pid="${v.p.id}">${ic('libro', 15)} ${esc(v.piatto.nome)}</button>` : ''}</div></div>`).join('') +
    '</article>').join('') +
    (senza.length ? `<p class="q" style="text-align:center;margin:8px 0 16px">Senza dieta: ${senza.map(p => `<button type="button" class="link" data-vai="${p.id}">${esc(p.id === IO ? 'tu' : p.nome)}</button>`).join(', ')}</p>` : '');
}

function vistaPersona(pid) {
  const p = D.partecipanti.find(x => x.id === pid), nome = pid === IO ? 'Tu' : p.nome, piano = pianoDi(pid);
  if (!piano || !piano.giorni || !piano.giorni.length) {
    return `<div class="card vuoto">${ic('documento', 32)}<b>${pid === IO ? 'Non hai ancora inserito la tua dieta' : esc(p.nome) + ' non ha ancora una dieta'}</b><br>Carica il PDF del nutrizionista oppure scrivila a mano.</div>
      <button class="btn" id="up" type="button">${ic('documento', 18)}Carica PDF della dieta</button><button class="btn ghost" id="man" type="button">${ic('matita', 18)}Scrivi la dieta a mano</button>`;
  }
  const gi = giornoScelto(pid), g = piano.giorni[gi], r = ricetteDi(pid)[gi] || [], oggiIdx = giornoDiOggi(piano);
  let h = `<div class="giorni" role="tablist" aria-label="Giorni della dieta di ${esc(nome)}">` + piano.giorni.map((d, i) => {
    const lab = String(d.giorno); const corto = lab.length > 9 ? lab.slice(0, 3) : lab;
    return `<button type="button" role="tab" class="giorno ${i === gi ? 'on' : ''}" data-gg="${i}" aria-selected="${i === gi}" aria-label="${esc(lab)}"><small>${i === oggiIdx ? 'Oggi' : 'Giorno ' + (i + 1)}</small><b>${esc(corto[0].toUpperCase() + corto.slice(1))}</b></button>`;
  }).join('') + '</div>';
  h += g.pasti.map((pa, k) => {
    const x = r[k], prox = gi === oggiIdx && pastoProssimo(pa.tipo);
    return `<article class="card pasto ${prox ? 'prossimo' : ''}"><div class="tp"><h3>${esc(pa.tipo)}</h3>${prox ? '<span class="by pos" style="font-weight:700">Prossimo pasto</span>' : ''}</div>
      <p class="al">${esc(pa.alimenti)}</p>${pa.alternative ? `<p class="alt">In alternativa: ${esc(pa.alternative)}</p>` : ''}${pa.nota ? `<details class="alt" style="margin-top:6px"><summary style="cursor:pointer;font-weight:600">Nota del nutrizionista</summary><p style="white-space:pre-line;margin:6px 0 0;line-height:1.45">${esc(pa.nota)}</p></details>` : ''}` +
      (x ? `<button type="button" class="piatto" data-ric="${k}" data-g="${gi}"><span class="tt"><b>${esc(x.nome)}</b><span class="by" style="display:flex;align-items:center;gap:4px">${ic('orologio', 13, 2)}${esc(x.tempo || '')}${x.da ? ' · scelto da ' + esc(x.da) : ''}</span></span><span class="piccolo pieno">${ic('libro', 15, 2)}Ricetta</span></button>` : '') +
      `<div class="azioni">${pa.link ? `<a class="piccolo" href="${esc(pa.link)}" target="_blank" rel="noopener">${ic('libro', 15, 2)}Ricetta salvata</a>` : ''}
        <a class="piccolo neutro" href="https://www.google.com/search?q=${encodeURIComponent('ricetta ' + testoRicerca(pa))}" target="_blank" rel="noopener">${ic('cerca', 15, 2)}Cerca ricetta</a>
        <button type="button" class="piccolo neutro" data-salva="${k}">${ic('link', 15, 2)}${pa.link ? 'Cambia link' : 'Salva link'}</button>
        ${x && haAI() ? `<button type="button" class="piccolo neutro" data-re="${k}">${ic('scintille', 15, 2)}Altro piatto</button>` : ''}</div>
      ${pa.link_da ? `<span class="by">Link salvato da ${esc(pa.link_da)}</span>` : ''}</article>`;
  }).join('');
  h += (haAI() ? `<button class="btn" id="gen" type="button">${ic('scintille', 18)}${r.length ? 'Rigenera piatti e spesa del giorno' : 'Crea piatti e lista della spesa'}</button>` : '') + `<button class="btn ghost" id="up" type="button">${ic('documento', 18)}Sostituisci il PDF</button>` +
    `<button class="btn bordo" id="man" type="button" style="margin-top:8px">${ic('matita', 18)}Modifica la dieta${pid === IO ? '' : ' di ' + esc(p.nome)}</button>
    <p class="by" style="text-align:center;margin:10px 0 20px">Dieta ${piano.da ? 'inserita da ' + esc(piano.da) : ''} · ${piano.giorni.length} giorni</p>`;
  return h;
}

async function salvaPiano(pid, piano) { D.stato['piano:' + pid] = piano; return scrivi(() => ST.salvaStato(G.id, 'piano:' + pid, piano)); }
async function salvaRicette(pid) { return scrivi(() => ST.salvaStato(G.id, 'ricette:' + pid, ricetteDi(pid))); }

function salvaLink(k) {
  const pid = personaPiano, piano = pianoDi(pid), pa = piano.giorni[giornoScelto(pid)].pasti[k];
  chiedi('Link della ricetta', 'Incolla l\'indirizzo della ricetta trovata per questo pasto. Lascia vuoto per toglierlo.', pa.link || '', 'Salva', async l => {
    l = l.trim();
    if (l) { pa.link = l; pa.link_da = CHI; } else { delete pa.link; delete pa.link_da; }
    renderPiano();
    if (await salvaPiano(pid, piano)) toast('Link salvato ✓');
  }, 'url');
}

const PROMPT_PDF = 'Estrai fedelmente la dieta da questo PDF, senza inventare nulla e senza aggiungere giorni o pasti non presenti. Includi TUTTI i giorni, TUTTI i pasti e TUTTE le alternative previste. Se i giorni corrispondono ai giorni della settimana, usa il loro nome (Lunedì, Martedì…). JSON: {"giorni":[{"giorno":"nome breve del giorno","pasti":[{"tipo":"Colazione/Spuntino/Pranzo/Merenda/Cena","alimenti":"alimenti e grammature come scritti","alternative":"alternative previste o stringa vuota"}]}]}';
async function analizzaPDF(f) {
  const pid = personaPiano, nome = nomeP(pid);
  if (f.size > 14 * 1024 * 1024) return toast('Il PDF è troppo grande (' + Math.round(f.size / 1048576) + ' MB): prova con uno sotto i 14 MB.');
  const att = attesaIA('Leggo la dieta di ' + (pid === IO ? 'te' : nome), 'Può servire fino a un minuto. Tieni aperta l\'app.');
  try {
    // 1) lettura diretta del PDF, senza intelligenza artificiale (piani Nutribook)
    let out = null, locale = false;
    try { out = await LETTORE.leggi(await f.arrayBuffer()); } catch (e) { out = null; }
    if (out && out.sicuro) locale = true;
    else if (haAI()) {
      // 2) se non lo riconosce con sicurezza, o se il PDF è di un altro tipo, lo legge l'intelligenza artificiale
      const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(f); });
      out = await ia([{ inline_data: { mime_type: 'application/pdf', data: b64 } }, { text: PROMPT_PDF }]);
    } else if (out) locale = true;
    else throw new Error('Non riesco a leggere questo PDF in automatico. Scrivi la dieta a mano oppure attiva un\'intelligenza artificiale in Impostazioni.');
    if (!out.giorni?.length) throw new Error('Nessun giorno trovato nel PDF');
    delete out.sicuro; out.da = CHI; D.stato['ricette:' + pid] = {}; LS.del('giorno:' + pid);
    renderPiano();
    if (await salvaPiano(pid, out)) {
      await scrivi(() => ST.salvaStato(G.id, 'ricette:' + pid, {}));
      att.fine(); toast(locale ? 'Dieta caricata ✓ ' + out.giorni.length + ' giorni, ' + out.giorni.reduce((n, g) => n + g.pasti.length, 0) + ' pasti. Controlla che corrisponda al PDF' : 'Dieta caricata ✓ Controlla che corrisponda al PDF');
      avvisaGruppo('Nuova dieta', `${CHI} ha caricato la dieta di ${pid === IO ? CHI : nome}`);
    } else att.fine();
  } catch (e) { att.errore(e.message); }
}

async function generaGiorno() {
  const pid = personaPiano, b = $('gen'), gi = giornoScelto(pid), g = pianoDi(pid).giorni[gi], nome = nomeP(pid);
  b.disabled = true; b.innerHTML = '<span class="spin"></span>Creo i piatti…';
  try {
    const out = await ia([{ text: 'Per ogni pasto di questa giornata di dieta proponi un piatto. ' + REGOLE + ' Poi crea la lista della spesa aggregata, con ogni prodotto assegnato a un reparto tra: ' + REPARTI.join(', ') + '. JSON: {"piatti":[{"nome":"","tempo":"es. 15 min","preparazione":""}],"spesa":[{"nome":"","quantita":"","reparto":""}]} con i piatti nello stesso ordine dei pasti. Giornata: ' + perIA(g) }]);
    out.piatti.forEach(p => p.da = CHI);
    const ric = ricetteDi(pid); ric[gi] = out.piatti; D.stato['ricette:' + pid] = ric;
    const etichetta = nome + ' · ' + g.giorno;
    await scrivi(async () => {
      await ST.salvaStato(G.id, 'ricette:' + pid, ric);
      if (out.spesa?.length) {
        await ST.delWhere('spesa', { gruppo_id: G.id, giorno: etichetta, comprato: false });
        await ST.ins('spesa', out.spesa.map(x => ({ gruppo_id: G.id, nome: x.nome, quantita: x.quantita || '', reparto: REPARTI.includes(x.reparto) ? x.reparto : 'Altro', giorno: etichetta, aggiunto_da: CHI })));
      }
    });
    await ricarica(); toast('Piatti e spesa pronti ✓');
    avvisaGruppo('Nuovi pasti', `${CHI} ha preparato i piatti di ${nome} per ${g.giorno}`);
  } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Riprova'; }
}

async function altroPiatto(k, b) {
  const pid = personaPiano, gi = giornoScelto(pid);
  b.textContent = 'Cerco…';
  try {
    const p = pianoDi(pid).giorni[gi].pasti[k], ric = ricetteDi(pid), vecchio = ric[gi][k]?.nome;
    const x = await ia([{ text: 'Proponi un piatto diverso da "' + vecchio + '" per questo pasto. ' + REGOLE + ' JSON: {"nome":"","tempo":"","preparazione":""}. Pasto: ' + perIA(p) }]);
    x.da = CHI; ric[gi][k] = x; D.stato['ricette:' + pid] = ric; renderPiano();
    await salvaRicette(pid);
  } catch (e) { toast(e.message); renderPiano(); }
}

function mostraRicetta(x) {
  const R = x.ricetta;
  foglio(`<h2>${esc(x.nome)}</h2><div class="q">${esc(R.tempo || x.tempo || '')}${R.porzioni ? ' · ' + esc(R.porzioni) : ''}${R.difficolta ? ' · ' + esc(R.difficolta) : ''}</div>` +
    `<div class="card" style="margin-top:12px"><h4 style="margin-top:0">Ingredienti</h4><ul style="margin:0;padding-left:20px">${(R.ingredienti || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>` +
    `<div class="card"><h4 style="margin-top:0">Preparazione</h4><ol style="margin:0;padding-left:20px">${(R.passaggi || []).map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>` +
    (R.consigli ? `<div class="card"><h4 style="margin-top:0">Consigli</h4><p style="margin:0;line-height:1.5">${esc(R.consigli)}</p></div>` : ''));
}
async function apriRicetta(pid, gi, k) {
  const ric = ricetteDi(pid), x = ric[gi]?.[k]; if (!x) return; vibra();
  if (x.ricetta) return mostraRicetta(x);
  if (!haAI()) {
    return foglio(`<h2>${esc(x.nome)}</h2><p class="q" style="white-space:pre-line;line-height:1.5">${esc(x.preparazione || '')}</p><p class="by">Per la ricetta completa con dosi e consigli serve un'intelligenza artificiale.</p>`);
  }
  foglio('<div class="vuoto"><span class="spin" style="border-color:var(--line);border-top-color:var(--acc)"></span><br>Preparo la ricetta…</div>');
  try {
    const p = pianoDi(pid).giorni[gi].pasti[k];
    x.ricetta = await ia([{ text: 'Scrivi la ricetta completa del piatto "' + x.nome + '" per questo pasto di dieta. ' + REGOLE + ' Riporta ogni ingrediente con la grammatura della dieta. Passaggi chiari e dettagliati, da 4 a 8. JSON: {"tempo":"","porzioni":"","difficolta":"","ingredienti":[""],"passaggi":[""],"consigli":""}. Pasto: ' + perIA(p) }]);
    D.stato['ricette:' + pid] = ric; mostraRicetta(x);
    await salvaRicette(pid);
  } catch (e) { chiudi(); toast(e.message); }
}

function editorDieta(pid) {
  const p = D.partecipanti.find(x => x.id === pid), piano = pianoDi(pid);
  const t = (piano?.giorni || []).map(g => '# ' + g.giorno + '\n' + g.pasti.map(x => x.tipo + ': ' + x.alimenti + (x.alternative ? ' | ' + x.alternative : '')).join('\n')).join('\n\n');
  foglio(`<h2>Dieta di ${esc(pid === IO ? 'te' : p.nome)}</h2><p class="q" style="line-height:1.5">Per ogni giorno una riga "# Nome del giorno", poi una riga per pasto: "Pranzo: alimenti | alternative". Usa i nomi dei giorni della settimana (Lunedì, Martedì…) e l'app ti mostrerà da sola i pasti di oggi.</p>
    <textarea id="dt" style="min-height:45vh;background:var(--card)" placeholder="# Lunedì&#10;Colazione: yogurt greco 150 g, avena 40 g | latte 200 ml&#10;Pranzo: pasta integrale 80 g, zucchine 200 g">${esc(t)}</textarea>
    <button class="btn" id="dtS" type="button" style="margin-top:8px">Salva la dieta</button>`);
  $('dtS').onclick = async () => {
    const giorni = []; let g = null;
    $('dt').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      if (l.startsWith('#')) { g = { giorno: l.replace(/^#+/, '').trim() || 'Giorno', pasti: [] }; giorni.push(g); }
      else if (g) {
        const i = l.indexOf(':'), tipo = i > 0 ? l.slice(0, i).trim() : 'Pasto', [al, alt] = (i > 0 ? l.slice(i + 1) : l).split('|');
        const v = piano?.giorni?.find(x => x.giorno === g.giorno)?.pasti.find(x => x.tipo === tipo);
        g.pasti.push({ tipo, alimenti: (al || '').trim(), alternative: (alt || '').trim(), ...(v?.link ? { link: v.link, link_da: v.link_da } : {}), ...(v?.nota ? { nota: v.nota } : {}) });
      }
    });
    if (!giorni.length) return toast('Scrivi almeno un giorno che inizia con #');
    chiudi();
    if (await salvaPiano(pid, { giorni, da: CHI })) { toast('Dieta salvata ✓'); avvisaGruppo('Pasti aggiornati', `${CHI} ha aggiornato la dieta di ${pid === IO ? CHI : p.nome}`); }
    renderPiano();
  };
}
$('pdf').onchange = e => { const f = e.target.files[0]; if (f) analizzaPDF(f); e.target.value = ''; };
