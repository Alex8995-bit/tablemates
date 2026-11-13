// Scheda Piano: la dieta di ogni persona del gruppo (da PDF o a mano), giorni della settimana, pasti, alternative, piatti e ricette.
const REGOLE = 'Usa SOLO gli alimenti e le grammature indicati (ammessi spezie, erbe, aceto, limone, sale). Ispirati a ricette italiane note e realistiche, come quelle di siti di cucina affidabili. Preparazione in 3-5 passaggi numerati, brevi.';
const GIORNI_SETT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
let personaPiano = LS.get('pianoPersona') || '';
const puntoLive = () => ST && ST.modo === 'supabase' ? `<span class="live ${live ? 'ok' : ''}" title="${live ? 'Sincronizzato' : 'Non collegato'}"></span>` : '';
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
  const o = ordinePasto(tipo), fascia = h < 10 ? 0 : h < 11.5 ? 1 : h < 15 ? 2 : h < 18 ? 3 : h < 22 ? 4 : -1;
  return fascia >= 0 && o === fascia;
}
const ordinePasto = t => { const x = senzaAccenti(t); return /pomeriggio|merenda|arco/.test(x) ? 3 : /colazione/.test(x) ? 0 : /spuntino/.test(x) ? 1 : /pranzo/.test(x) ? 2 : /cena/.test(x) ? 4 : 99; };

let pianoAperto = '';
const LETTERE = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
function lunediDiQuesta() { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }

function renderPiano() {
  const el = $('t-piano');
  if (!G) { el.innerHTML = '<div class="testa"><h1>Piano</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  if (!personaPiano || idxP(personaPiano) < 0) personaPiano = IO || (D.partecipanti[0] || {}).id || '';
  const pid = personaPiano, p = D.partecipanti.find(x => x.id === pid), piano = pianoDi(pid), tu = pid === IO;
  let h = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">${puntoLive()}${tu || !p ? 'Il tuo piano alimentare' : 'Piano alimentare di ' + esc(p.nome)}</p><h1>Piano</h1></div><div class="dx">` +
    (piano?.giorni?.length ? `<button type="button" class="ico-btn" id="pnMod" aria-label="Modifica il piano">${ic('matita', 20, 1.8)}</button>` : '') +
    `<button type="button" class="ico-btn" id="up" aria-label="Carica un nuovo PDF della dieta">${ic('carica', 22, 1.8)}</button></div></div>`;
  if (D.partecipanti.length > 1) h += `<div class="chips" role="tablist" aria-label="Di chi è il piano">` + D.partecipanti.map((x, i) => `<button type="button" role="tab" class="chip ${pid === x.id ? 'on' : ''}" data-pp="${x.id}" aria-selected="${pid === x.id}">${avatar(x, i, 'p')}${esc(x.id === IO ? 'Tu' : x.nome)}</button>`).join('') + '</div>';
  h += p ? vistaPersona(pid) : '<div class="vuoto">Aggiungi le persone del gruppo dalla scheda Gruppo.</div>';
  el.innerHTML = h;
  el.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { personaPiano = b.dataset.pp; LS.set('pianoPersona', personaPiano); vibra(); renderPiano(); });
  el.querySelectorAll('[data-gg]').forEach(b => b.onclick = () => { LS.set('giorno:' + personaPiano, b.dataset.gg); pianoAperto = ''; vibra(); renderPiano(); });
  el.querySelectorAll('[data-apri]').forEach(b => b.onclick = () => { pianoAperto = b.dataset.apri; vibra(); renderPiano(); });
  el.querySelectorAll('[data-re]').forEach(b => b.onclick = () => altroPiatto(+b.dataset.re, b));
  el.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => proponiPiatto(personaPiano, giornoScelto(personaPiano), +b.dataset.prop, b));
  el.querySelectorAll('[data-ric]').forEach(d => d.onclick = () => apriRicetta(d.dataset.pid || personaPiano, +d.dataset.g, +d.dataset.ric));
  el.querySelectorAll('[data-salva]').forEach(b => b.onclick = () => salvaLink(+b.dataset.salva));
  el.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.alt.split('|').map(Number); vibra(); foglioAlternative(personaPiano, giornoScelto(personaPiano), k, i); });
  el.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => {
    const [k, i, j] = b.dataset.sc.split('|').map(Number), gi = giornoScelto(personaPiano), g = pianoDi(personaPiano).giorni[gi], pa = g.pasti[k];
    vibra(); scegliAlternativa(personaPiano, gi, pa.tipo, i, j < 0 ? null : j);
    toast(j < 0 ? 'Torni a ' + pa.voci[i].nome : pa.voci[i].nome + ' → ' + pa.voci[i].sost[j].nome + ', solo per ' + g.giorno);
  });
  el.querySelectorAll('[data-nl]').forEach(b => b.onclick = () => { const t = b.previousElementSibling; t.classList.toggle('chiusa'); b.textContent = t.classList.contains('chiusa') ? 'Leggi tutto' : 'Mostra meno'; });
  if ($('spD')) $('spD').onclick = () => foglioSpesaDieta(personaPiano);
  if ($('gen')) $('gen').onclick = generaGiorno;
  if ($('pref')) $('pref').onclick = foglioPreferite;
  el.querySelectorAll('#up,#up2').forEach(b => b.onclick = () => $('pdf').click());
  if ($('man')) $('man').onclick = () => editorPiano(personaPiano);
  if ($('pnMod')) $('pnMod').onclick = () => editorPiano(personaPiano);
}

function vistaPersona(pid) {
  const p = D.partecipanti.find(x => x.id === pid), nome = pid === IO ? 'Tu' : p.nome, piano = pianoDi(pid);
  const pref = IO ? (D.stato['preferite:' + IO] || []).length : 0;
  if (!piano || !piano.giorni || !piano.giorni.length) {
    return `<div class="card vuoto">${ic('documento', 32)}<b>${pid === IO ? 'Non hai ancora inserito il tuo piano' : esc(p.nome) + ' non ha ancora un piano'}</b><br>Carica il PDF del nutrizionista oppure scrivilo a mano. Prima di salvare puoi controllare tutto.</div>
      <div style="display:flex;flex-direction:column;gap:8px"><button class="btn" id="up2" type="button">${ic('carica', 18)}Carica il PDF della dieta</button><button class="btn bordo" id="man" type="button" style="margin:0">${ic('matita', 18)}Scrivi il piano a mano</button></div>` +
      (pref ? `<button class="riga-link" type="button" id="pref">${ic('segnalibro', 22, 1.8)}<span><b>Ricette salvate</b><small>${pref} ${pref === 1 ? 'ricetta' : 'ricette'}</small></span>${ic('avanti', 18, 2)}</button>` : '');
  }
  const gi = giornoScelto(pid), g = piano.giorni[gi], r = ricetteDi(pid)[gi] || [], oggiIdx = giornoDiOggi(piano);
  // Giorni: la settimana L–D se il piano usa i giorni della settimana, altrimenti "Giorno 1, 2…"
  const settimana = piano.giorni.every((_, i) => i < 7) && piano.giorni.some(x => GIORNI_SETT.some(n => senzaAccenti(x.giorno).startsWith(senzaAccenti(n).slice(0, 3))));
  let h;
  if (settimana) {
    const lun = lunediDiQuesta();
    h = `<div class="giorni7" role="tablist" aria-label="Giorni della settimana">` + LETTERE.map((l, i) => {
      const dt = new Date(lun); dt.setDate(lun.getDate() + i);
      const k = giornoPerData(piano, dt), on = k === gi && k >= 0, oggi = isoDi(dt) === oggiISO();
      return `<button type="button" role="tab" class="${on ? 'on' : ''} ${oggi ? 'oggi' : ''}" aria-selected="${on}" ${k >= 0 ? `data-gg="${k}"` : 'disabled'} aria-label="${esc(dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' }))}${k < 0 ? ', nessun pasto nel piano' : ''}${oggi ? ', oggi' : ''}"><span>${l}</span><b>${dt.getDate()}</b></button>`;
    }).join('') + '</div>';
  } else {
    h = `<div class="giorni7 scorri" role="tablist" aria-label="Giorni del piano">` + piano.giorni.map((x, i) => `<button type="button" role="tab" class="${i === gi ? 'on' : ''}" aria-selected="${i === gi}" data-gg="${i}" aria-label="${esc(x.giorno)}"><span>${esc(String(x.giorno).slice(0, 3))}</span><b>${i + 1}</b></button>`).join('') + '</div>';
  }
  const iso = settimana ? chiaveGiorno(piano, gi) : 'g' + gi, ora = new Date().getHours() * 60 + new Date().getMinutes();
  const elenco = (haVoci(piano) ? elencoSlot(g) : g.pasti.map((pa, k) => ({ pa, k, tipo: pa.tipo }))).sort((a, b) => ordinePasto(a.tipo) - ordinePasto(b.tipo));
  // Il pasto aperto: quello scelto, altrimenti il prossimo di oggi, altrimenti il primo
  const chiave = pid + '|' + gi + '|';
  let aperto = pianoAperto.startsWith(chiave) ? pianoAperto.slice(chiave.length) : '';
  if (!aperto || !elenco.some(x => x.pa && x.pa.tipo === aperto)) {
    const pros = gi === oggiIdx ? elenco.find(x => x.pa && minutiDi(oraDi(x.pa.tipo)) + 60 > ora) : null;
    aperto = (pros || elenco.find(x => x.pa) || {}).tipo || '';
  }
  h += elenco.map(({ pa, k, tipo }) => {
    if (!pa) return `<div class="pc-chiuso vuoto-slot"><b>${esc(tipo)}</b><span class="st">Non previsto</span></div>`;
    const n = pa.voci ? pa.voci.length : 0, x = r[k];
    if (pa.tipo !== aperto) return `<button type="button" class="pc-chiuso" data-apri="${esc(chiave + pa.tipo)}" aria-expanded="false"><b>${esc(pa.tipo)}</b><span class="st">ore ${esc(oraDi(pa.tipo))}${n ? ' · ' + n + (n === 1 ? ' alimento' : ' alimenti') : ''}</span></button>`;
    const notaLunga = pa.nota && pa.nota.length > 180;
    return `<section class="pc-aperto" aria-labelledby="pc-${k}"><div class="tp"><h2 id="pc-${k}">${esc(pa.tipo)}</h2><span>${n ? n + (n === 1 ? ' alimento' : ' alimenti') : 'ore ' + esc(oraDi(pa.tipo))}</span></div>` +
      (pa.voci ? htmlCibi(pid, gi, k, pa) : `<p style="margin:0;font-size:15px;line-height:1.5">${esc(pa.alimenti)}</p>${pa.alternative ? `<p class="q" style="margin:0">In alternativa: ${esc(pa.alternative)}</p>` : ''}`) +
      (pa.nota ? `<div class="avviso">${ic('info', 18, 2)}<div style="min-width:0"><div class="nota-lunga ${notaLunga ? 'chiusa' : ''}"><strong>Nota del nutrizionista:</strong> ${esc(pa.nota)}</div>${notaLunga ? '<button type="button" class="link" data-nl style="color:var(--warn-ic);padding:4px 0 0;font-size:13px">Leggi tutto</button>' : ''}</div></div>` : '') +
      (x ? `<button type="button" class="piatto" data-ric="${k}" data-g="${gi}"><span class="tt"><b>${esc(x.nome)}</b><span class="by" style="display:flex;align-items:center;gap:4px">${ic('orologio', 13, 2)}${esc(x.tempo || '')}${x.da ? ' · scelto da ' + esc(x.da) : ''}</span></span><span class="piccolo pieno">${ic('libro', 15, 2)}Ricetta</span></button>` : '') +
      `<div class="pc-azioni">
        ${!x && haAI() ? `<button type="button" class="piccolo neutro" data-prop="${k}">${ic('scintille', 15, 2)}Proponi un piatto</button>` : ''}
        ${x && haAI() ? `<button type="button" class="piccolo neutro" data-re="${k}">${ic('scintille', 15, 2)}Altro piatto</button>` : ''}
        <a class="piccolo neutro" href="https://www.google.com/search?q=${encodeURIComponent('ricetta ' + testoRicerca({ alimenti: testoPasto(pid, gi, pa) }))}" target="_blank" rel="noopener">${ic('cerca', 15, 2)}Cerca ricetta</a>
        ${pa.link ? `<a class="piccolo neutro" href="${esc(pa.link)}" target="_blank" rel="noopener">${ic('libro', 15, 2)}Ricetta salvata</a>` : ''}
        <button type="button" class="piccolo neutro" data-salva="${k}">${ic('link', 15, 2)}${pa.link ? 'Cambia link' : 'Salva link'}</button></div>
      ${pa.link_da ? `<span class="by">Link salvato da ${esc(pa.link_da)}</span>` : ''}</section>`;
  }).join('');
  h += `<div style="display:flex;flex-direction:column;gap:8px">` +
    (haVoci(piano) ? `<button class="btn" id="spD" type="button">${ic('sacchetto', 18)}Crea la lista della spesa dalla dieta</button>` : '') +
    (haAI() ? `<button class="btn ${haVoci(piano) ? 'ghost' : ''}" id="gen" type="button" style="margin:0">${ic('scintille', 18)}${r.length ? 'Rigenera i piatti di ' + esc(g.giorno) : 'Proponi i piatti di ' + esc(g.giorno)}</button>` : '') + '</div>' +
    (pref ? `<button class="riga-link" type="button" id="pref">${ic('segnalibro', 22, 1.8)}<span><b>Ricette salvate</b><small>${pref} ${pref === 1 ? 'ricetta' : 'ricette'}</small></span>${ic('avanti', 18, 2)}</button>` : '') +
    `<p class="by" style="text-align:center;margin:0 0 12px">Piano ${piano.da ? 'inserito da ' + esc(piano.da) : ''} · ${piano.giorni.length} ${piano.giorni.length === 1 ? 'giorno' : 'giorni'}${nome === 'Tu' ? '' : ' · ' + esc(nome)}</p>`;
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

const PROMPT_PDF = 'Estrai fedelmente la dieta da questo PDF, senza inventare nulla e senza aggiungere giorni o pasti non presenti. Includi TUTTI i giorni, TUTTI i pasti, TUTTI gli alimenti con le grammature e TUTTE le alternative previste per ciascun alimento. Se i giorni corrispondono ai giorni della settimana, usa il loro nome (Lunedì, Martedì…). Per "tipo" usa: Colazione, Spuntino mattina, Pranzo, Spuntino pomeriggio, Cena (un pasto "nell\'arco della giornata" o una merenda è Spuntino pomeriggio). JSON: {"giorni":[{"giorno":"Lunedì","pasti":[{"tipo":"Pranzo","voci":[{"nome":"Riso","qta":70,"unita":"g","misura":"","sost":[{"nome":"Pasta di semola","qta":70,"unita":"g","misura":""}]}],"nota":""}]}]}. "qta" è un numero oppure null se manca; "unita" è g, ml o stringa vuota; "misura" è la misura casalinga scritta nel PDF (es. "1 Cucchiaio") o stringa vuota; "nota" contiene le note del nutrizionista per quel pasto o stringa vuota.';
async function analizzaPDF(f) {
  const pid = personaPiano || IO, nome = nomeP(pid);
  if (f.size > 14 * 1024 * 1024) return toast('Il PDF è troppo grande (' + Math.round(f.size / 1048576) + ' MB): prova con uno sotto i 14 MB.');
  const att = attesaIA('Leggo la dieta di ' + (pid === IO ? 'te' : nome), 'Può servire fino a un minuto. Tieni aperta l\'app.');
  try {
    // 1) lettura diretta del PDF nel telefono, senza intelligenza artificiale (piani Nutribook)
    let out = null, fonte = '';
    try { out = await LETTORE.leggi(await f.arrayBuffer()); } catch (e) { out = null; }
    const b64 = () => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(f); });
    if (out && out.sicuro) fonte = 'lettore';
    else if (haAI()) {
      // 2) impaginazione diversa: la legge l'intelligenza artificiale
      out = normalizzaPiano(await ia([{ inline_data: { mime_type: 'application/pdf', data: await b64() } }, { text: PROMPT_PDF }])); fonte = 'ia';
    } else if (out) fonte = 'lettore';
    else {
      // 3) senza intelligenza artificiale: si prova a ricostruirla dal testo del PDF
      let testo = ''; try { testo = await testoDaPDF(await b64()); } catch (e) { throw new Error(/scansione|foto/.test(e.message) ? 'Questo PDF sembra una foto o una scansione: senza intelligenza artificiale non si può leggere. Attivala in Impostazioni oppure scrivi il piano a mano.' : e.message); }
      out = LETTORE.parsaTesto(testo); fonte = 'testo';
      if (!out) throw new Error('Non riesco a riconoscere giorni e pasti in questo PDF. Attiva un\'intelligenza artificiale in Impostazioni oppure scrivi il piano a mano.');
    }
    if (!out?.giorni?.length) throw new Error('Nessun giorno trovato nel PDF');
    delete out.sicuro;
    att.fine();
    editorPiano(pid, out, { revisione: fonte });
  } catch (e) { att.errore(e.message); }
}

async function generaGiorno() {
  const pid = personaPiano, b = $('gen'), gi = giornoScelto(pid), g = pianoDi(pid).giorni[gi], nome = nomeP(pid);
  b.disabled = true; b.innerHTML = '<span class="spin"></span>Creo i piatti…';
  try {
    const out = await ia([{ text: 'Per ogni pasto di questa giornata di dieta proponi un piatto. ' + REGOLE + ' Poi crea la lista della spesa aggregata, con ogni prodotto assegnato a un reparto tra: ' + REPARTI.join(', ') + '. JSON: {"piatti":[{"nome":"","tempo":"es. 15 min","preparazione":""}],"spesa":[{"nome":"","quantita":"","reparto":""}]} con i piatti nello stesso ordine dei pasti. Giornata: ' + giornoPerIA(pid, gi) }]);
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
    const x = await ia([{ text: 'Proponi un piatto diverso da "' + vecchio + '" per questo pasto. ' + REGOLE + ' JSON: {"nome":"","tempo":"","preparazione":""}. Pasto: ' + pastoPerIA(pid, gi, p) }]);
    x.da = CHI; ric[gi][k] = x; D.stato['ricette:' + pid] = ric; renderPiano();
    await salvaRicette(pid);
  } catch (e) { toast(e.message); renderPiano(); }
}

$('pdf').onchange = e => { const f = e.target.files[0]; if (f) analizzaPDF(f); e.target.value = ''; };
