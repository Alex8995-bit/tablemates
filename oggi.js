// Scheda Oggi: il prossimo pasto, chi c'è a tavola, spesa e conti in breve. Pagina "A tavola": la settimana di presenze.
const ORARI_BASE = { 'Colazione': '08:00', 'Spuntino mattina': '10:30', 'Pranzo': '13:00', 'Spuntino pomeriggio': '16:30', 'Cena': '20:00' };
const orari = () => Object.assign({}, ORARI_BASE, LS.getJ('orari', {}));
function oraDi(tipo) {
  const o = orari(), t = typeof LETTORE !== 'undefined' ? LETTORE.slot(tipo) : tipo;
  return o[t] || ['08:00', '10:30', '13:00', '16:30', '20:00'][Math.min(4, ordinePasto(tipo))] || '12:00';
}
const minutiDi = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const etichettaCorta = tipo => /spuntino|merenda|arco/i.test(tipo) ? 'Spuntino' : tipo;
const isoDi = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

// Un pasto è passato se il suo orario è passato da più di un'ora (o il giorno è già passato): serve solo per le barre di Oggi
function passato(iso, tipo) {
  if (!/^\d{4}-\d\d-\d\d$/.test(iso)) return false;
  const oggi = oggiISO(); if (iso < oggi) return true; if (iso > oggi) return false;
  const d = new Date(); return minutiDi(oraDi(tipo)) + 60 <= d.getHours() * 60 + d.getMinutes();
}

// Presenze a tavola: ognuno scrive solo le sue (così due persone non si sovrascrivono)
const presDi = pid => D.stato['presenze:' + pid] || {};
async function segnaPresenza(pid, iso, quando, valore) {
  const tutte = { ...presDi(pid) }, lim = isoDi(Date.now() - 7 * 864e5);
  Object.keys(tutte).forEach(k => { if (k.slice(0, 10) < lim) delete tutte[k]; });
  if (valore === undefined) delete tutte[iso + '|' + quando]; else tutte[iso + '|' + quando] = valore;
  D.stato['presenze:' + pid] = tutte; vibra(); renderOggi(); renderPresenze();
  await scrivi(() => ST.salvaStato(G.id, 'presenze:' + pid, tutte));
}
const conApp = () => D.partecipanti.filter(p => p.user_id || p.id === IO);

// Il giorno della dieta che cade in una certa data (piani con i giorni della settimana)
function giornoPerData(piano, data) {
  if (!piano?.giorni?.length) return -1;
  const nome = senzaAccenti(GIORNI_SETT[new Date(data).getDay()]);
  return piano.giorni.findIndex(g => senzaAccenti(g.giorno).includes(nome) || senzaAccenti(g.giorno).startsWith(nome.slice(0, 3)));
}
const pastiDelGiorno = g => (g.pasti.some(p => p.voci) ? elencoSlot(g).filter(x => x.pa) : g.pasti.map((pa, k) => ({ pa, k, tipo: pa.tipo }))).sort((a, b) => ordinePasto(a.pa.tipo) - ordinePasto(b.pa.tipo));
function righeCibo(pid, gi, pa) {
  if (!pa.voci) return `<li><span>${esc(pa.alimenti)}</span><span></span></li>`;
  return pa.voci.map((_, i) => { const v = voceEffettiva(pid, gi, pa, i); return `<li><span>${esc(v.nome)}${v.scambiata ? `<small>al posto di ${esc(v.origine.nome)}</small>` : ''}</span><span>${esc(qtaTesto(v) || v.misura || '')}</span></li>`; }).join('');
}

function gruppoAvatars() {
  const pp = D.partecipanti;
  return `<button type="button" class="avs" id="ogG" aria-label="Gruppo ${esc(G.nome)}, ${pp.length} ${pp.length === 1 ? 'membro' : 'membri'}">${pp.slice(0, 4).map((p, i) => avatar(p, i)).join('')}</button>`;
}

let ogVisto = '';
function renderOggi() {
  const el = $('t-oggi'); if (!el) return;
  const d = new Date(), dataTxt = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!G) { el.innerHTML = '<div class="testa"><h1>Oggi</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  let h = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">${puntoLive()}${esc(dataTxt[0].toUpperCase() + dataTxt.slice(1))}</p><h1>Oggi</h1></div>${gruppoAvatars()}</div>`;
  const iso = oggiISO(), ora = d.getHours() * 60 + d.getMinutes();
  const piano = IO ? pianoDi(IO) : null;
  let prossimo = null, gi = -1, pasti = [];
  if (piano?.giorni?.length) {
    gi = giornoDiOggi(piano); if (gi < 0) gi = giornoScelto(IO);
    pasti = pastiDelGiorno(piano.giorni[gi]);
    prossimo = pasti.find(x => minutiDi(oraDi(x.pa.tipo)) + 60 > ora) || null;
    h += `<div class="barre" style="grid-template-columns:repeat(${pasti.length},minmax(0,1fr))" role="tablist" aria-label="Pasti di oggi">${pasti.map((x, i) => {
      const f = passato(iso, x.pa.tipo), n = prossimo && x.pa.tipo === prossimo.pa.tipo;
      return `<button type="button" role="tab" data-ogv="${i}" aria-label="${esc(x.pa.tipo)}, ore ${esc(oraDi(x.pa.tipo))}"><i class="${f ? 'fatto' : n ? 'dopo' : ''}"></i><span>${esc(etichettaCorta(x.pa.tipo))}</span></button>`;
    }).join('')}</div>`;
  }
  // Prossimo pasto e presenza
  const quando = prossimo ? (ordinePasto(prossimo.pa.tipo) <= 2 ? 'p' : 'c') : (d.getHours() < 15 ? 'p' : 'c');
  const mia = IO ? presDi(IO)[iso + '|' + quando] : undefined;
  const altri = conApp().filter(p => p.id !== IO), nonRisp = altri.filter(p => presDi(p.id)[iso + '|' + quando] === undefined);
  const aTavola = conApp().filter(p => presDi(p.id)[iso + '|' + quando] === true).length;
  const domanda = quando === 'p' ? 'A pranzo oggi?' : 'A tavola stasera?';
  const rigaTavola = IO ? `<div class="tavola"><span>${domanda}</span><button type="button" class="pill-btn ${mia === true ? 'on' : ''}" aria-pressed="${mia === true}" data-pr="si">Ci sono</button><button type="button" class="pill-btn ${mia === false ? 'on' : ''}" aria-pressed="${mia === false}" data-pr="no">Salto</button></div>
    <div class="tavola-info"><p>${nonRisp.length ? esc(nonRisp.map(p => p.nome).join(', ')) + (nonRisp.length === 1 ? ' non ha ancora risposto' : ' non hanno ancora risposto') : altri.length ? aTavola + (aTavola === 1 ? ' persona a tavola' : ' persone a tavola') : ''}</p><button type="button" id="ogSett">Tutta la settimana</button></div>` : '';
  if (!IO) {
    h += `<div class="big"><p class="q" style="margin:0;line-height:1.5">Per vedere i tuoi pasti indica chi sei in ${esc(G.nome)}.</p><button class="btn" type="button" id="ogChi">Indica chi sei</button></div>`;
  } else if (!piano?.giorni?.length) {
    h += `<section class="big" aria-labelledby="og-t"><span class="eyebrow">Il tuo piano</span><h2 id="og-t">Nessun piano alimentare</h2><p class="q" style="margin:0;line-height:1.5">Carica il PDF del nutrizionista oppure scrivilo a mano: qui vedrai il prossimo pasto con le quantità.</p>
      <div class="riga"><button class="btn" type="button" id="ogUp" style="flex:1">${ic('carica', 18)}Carica PDF</button><button class="btn bordo" type="button" id="ogMan" style="flex:1;margin:0">${ic('matita', 18)}A mano</button></div>${rigaTavola}</section>`;
  } else {
    // Tutti i pasti di oggi, uno per volta: si scorre col dito, con le frecce o toccando le barre in alto
    const iPros = prossimo ? pasti.indexOf(prossimo) : -1;
    const slide = (x, i) => {
      const { pa, k } = x, ric = (ricetteDi(IO)[gi] || [])[k];
      const momento = /cena/i.test(pa.tipo) ? 'stasera' : /pranzo/i.test(pa.tipo) ? 'pranzo' : 'oggi';
      const etich = i === iPros ? 'Prossimo pasto' : passato(iso, pa.tipo) ? 'Già passato' : 'Più tardi';
      return `<div class="og-slide" role="group" aria-roledescription="pasto" aria-label="${esc(pa.tipo)}, ${i + 1} di ${pasti.length}"><div class="tp"><span class="eyebrow ${i === iPros ? '' : 'spento'}">${etich}</span><span class="ora">ore ${esc(oraDi(pa.tipo))}</span></div><h2>${esc(pa.tipo)}</h2>
        <ul class="alim">${righeCibo(IO, gi, pa)}</ul>
        ${ric ? `<button type="button" class="idea" data-ogric="${k}"><span class="ib">${ic('piatto', 28, 1.8)}</span><span class="it2"><small>Idea per ${momento}${ric.tempo ? ' · ' + esc(ric.tempo) : ''}</small><b>${esc(ric.nome)}</b></span>${ic('avanti', 20, 2)}</button>`
          : true ? `<button type="button" class="idea" data-ogidea="${k}"><span class="ib">${ic('scintille', 26, 1.8)}</span><span class="it2"><small>Idea per ${momento}</small><b>Proponi un piatto con questi alimenti</b></span>${ic('avanti', 20, 2)}</button>` : ''}</div>`;
    };
    h += `<section class="big og-card" aria-label="Pasti di oggi"><div class="og-scorri" id="ogScorri" tabindex="0">${pasti.map(slide).join('')}</div>
      <div class="og-nav"><button type="button" class="og-freccia" id="ogPrev" aria-label="Pasto precedente">${ic('indietro', 20, 2.2)}</button><span class="og-punti" aria-hidden="true">${pasti.map(() => '<i></i>').join('')}</span><button type="button" class="og-freccia" id="ogNext" aria-label="Pasto successivo">${ic('avanti', 20, 2.2)}</button></div>
      ${prossimo ? '' : '<p class="q" style="margin:-6px 0 0;font-size:13px">Per oggi è tutto. <button type="button" class="link" id="ogPiano" style="font-size:13px;padding:0">Apri il piano di domani</button></p>'}
      ${rigaTavola}</section>`;
  }
  // Riquadri spesa e conti
  const daPrendere = D.spesa.filter(x => !x.comprato), daAltri = daPrendere.filter(x => x.aggiunto_da && x.aggiunto_da !== CHI);
  const nomiAltri = [...new Set(daAltri.map(x => x.aggiunto_da))];
  const s = Conti.saldi(D.movimenti, D.partecipanti), mio = IO ? (s[IO] || 0) : 0, rr = Conti.rimborsi(s);
  const verso = mio > 0 ? rr.filter(r => r.a === IO) : rr.filter(r => r.da === IO);
  const chiConti = verso.length === 1 ? nomeP(mio > 0 ? verso[0].da : verso[0].a) : '';
  h += htmlAgendaOggi();
  h += `<div class="tiles">
    <button type="button" class="tile2" id="ogSp">${ic('sacchetto', 24, 1.8)}<b>${daPrendere.length ? daPrendere.length + ' da prendere' : 'Lista vuota'}</b><span>${daAltri.length ? daAltri.length + (daAltri.length === 1 ? ' aggiunto da ' : ' aggiunti da ') + esc(nomiAltri.length === 1 ? nomiAltri[0] : 'altri') : daPrendere.length ? 'Nella lista della spesa' : 'Aggiungi quello che manca'}</span></button>
    <button type="button" class="tile2" id="ogCo">${ic('borsello', 24, 1.8)}<b class="num ${mio > 0 ? 'pos' : mio < 0 ? 'neg' : ''}">${mio ? (mio > 0 ? '+ ' : '− ') + eur(Math.abs(mio)) : 'In pari'}</b><span>${mio > 0 ? (chiConti ? esc(chiConti) + ' ti deve' : 'Ti devono') : mio < 0 ? (chiConti ? 'Devi a ' + esc(chiConti) : 'Devi') : 'Nessun conto da saldare'}</span></button></div>
    <button type="button" class="riga-link" id="ogChat">${ic('scintille', 22, 1.8)}<span><b>Chiedi all'assistente</b><small>Cosa mangio stasera? Cosa manca in casa?</small></span>${ic('avanti', 18, 2)}</button>`;
  el.innerHTML = h;
  $('ogG').onclick = () => vai('gruppo');
  if ($('ogChi')) $('ogChi').onclick = scegliPartecipante;
  if ($('ogUp')) $('ogUp').onclick = () => { personaPiano = IO; $('pdf').click(); };
  if ($('ogMan')) $('ogMan').onclick = () => editorPiano(IO);
  el.querySelectorAll('[data-ogric]').forEach(b => b.onclick = () => apriRicetta(IO, gi, +b.dataset.ogric));
  el.querySelectorAll('[data-ogidea]').forEach(b => b.onclick = () => proponiPiatto(IO, gi, +b.dataset.ogidea));
  const sc = $('ogScorri');
  if (sc) {
    const n = pasti.length, larg = () => sc.clientWidth || 1;
    const attuale = () => Math.max(0, Math.min(n - 1, Math.round(sc.scrollLeft / larg())));
    const segna = i => {
      el.querySelectorAll('.og-punti i').forEach((p, j) => p.classList.toggle('on', j === i));
      el.querySelectorAll('[data-ogv]').forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i); });
      $('ogPrev').disabled = i === 0; $('ogNext').disabled = i === n - 1; ogVisto = pasti[i].pa.tipo;
    };
    const vaiA = (i, liscio) => { sc.scrollTo({ left: i * larg(), behavior: liscio && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' }); segna(i); };
    // si riparte dal pasto che stavi guardando, altrimenti dal prossimo (o dall'ultimo se la giornata è finita)
    const iv = pasti.findIndex(x => x.pa.tipo === ogVisto), i0 = iv >= 0 ? iv : prossimo ? pasti.indexOf(prossimo) : n - 1;
    requestAnimationFrame(() => vaiA(i0, false)); segna(i0);
    // se la scheda era nascosta (larghezza 0) o cambia larghezza, si rimette sul pasto giusto appena diventa visibile
    let largPrima = sc.clientWidth;
    if (window.ResizeObserver) new ResizeObserver(() => {
      const w = sc.clientWidth; if (!w || w === largPrima) return; largPrima = w;
      const i = Math.max(0, pasti.findIndex(x => x.pa.tipo === ogVisto)); sc.scrollTo({ left: i * w, behavior: 'auto' }); segna(i);
    }).observe(sc);
    let t; sc.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { if (sc.clientWidth) segna(attuale()); }, 80); }, { passive: true });
    $('ogPrev').onclick = () => vaiA(Math.max(0, attuale() - 1), true);
    $('ogNext').onclick = () => vaiA(Math.min(n - 1, attuale() + 1), true);
    sc.onkeydown = e => { if (e.key === 'ArrowLeft') { e.preventDefault(); $('ogPrev').click(); } if (e.key === 'ArrowRight') { e.preventDefault(); $('ogNext').click(); } };
    el.querySelectorAll('[data-ogv]').forEach(b => b.onclick = () => { vibra(); vaiA(+b.dataset.ogv, true); });
  }
  if ($('ogPiano')) $('ogPiano').onclick = () => { const p = pianoDi(IO), dom = giornoPerData(p, Date.now() + 864e5); if (dom >= 0) LS.set('giorno:' + IO, String(dom)); personaPiano = IO; vai('piano'); renderPiano(); };
  el.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => segnaPresenza(IO, iso, quando, b.dataset.pr === 'si' ? (mia === true ? undefined : true) : (mia === false ? undefined : false)));
  if ($('ogSett')) $('ogSett').onclick = () => vai('presenze');
  if ($('ogAg')) $('ogAg').onclick = () => vai('agenda');
  el.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { agendaGiorno = b.dataset.d; vai('agenda'); renderAgenda(); apriVoceAgenda(b.dataset.ev, b.dataset.d); });
  $('ogSp').onclick = () => vai('spesa'); $('ogCo').onclick = () => vai('conti'); $('ogChat').onclick = () => vai('chat');
}

// Un piatto per un pasto, proposto dall'intelligenza artificiale con gli alimenti del piano; poi si apre la ricetta
async function proponiPiatto(pid, gi, k) {
  const pa = pianoDi(pid).giorni[gi].pasti[k];
  const metti = async x => { x.da = CHI; const ric = ricetteDi(pid); ric[gi] = ric[gi] || []; ric[gi][k] = x; D.stato['ricette:' + pid] = ric; renderOggi(); renderPiano(); apriRicetta(pid, gi, k); await salvaRicette(pid); };
  // senza intelligenza artificiale (o se non risponde) la ricetta base si crea qui, con gli alimenti del pasto
  const base = () => metti(CUOCO.crea(pid, gi, pa));
  if (!haAI()) return base();
  const att = attesaIA('Cerco un piatto per ' + pa.tipo.toLowerCase(), 'Uso solo gli alimenti e le grammature del piano. Di solito bastano pochi secondi.');
  try {
    const x = await ia([{ text: 'Proponi un piatto per questo pasto. ' + REGOLE + ' JSON: {"nome":"","tempo":"es. 15 min","preparazione":""}. Pasto: ' + pastoPerIA(pid, gi, pa) }]);
    if (!x || !x.nome) throw new Error('L\'intelligenza artificiale non ha proposto nessun piatto. Riprova.');
    att.fine(); await metti(x);
  } catch (e) { att.errore(e.message, { testo: 'Usa la ricetta base (senza IA)', fn: base }); renderOggi(); renderPiano(); }
}

// ---------- A tavola: la settimana ----------
function renderPresenze() {
  const el = $('t-presenze'); if (!el) return;
  if (!G) { el.innerHTML = ''; return; }
  const pp = conApp(), giorni = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const nomeG = d => { const s = d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''); return s[0].toUpperCase() + s.slice(1, 3) + ' ' + d.getDate(); };
  let porzioni = 0;
  const cella = (d, q) => {
    const iso = isoDi(d);
    const av = pp.slice(0, 4).map((p, i) => {
      const v = presDi(p.id)[iso + '|' + q]; if (v === true) porzioni++;
      const c = COLORI_AV[idxP(p.id) % COLORI_AV.length];
      const st = v === true ? `class="pa si" style="background:${c[0]};color:${c[1]}"` : v === undefined ? 'class="pa mai"' : 'class="pa"';
      return `<span ${st}>${v === undefined && p.id !== IO ? '?' : esc(p.nome.trim()[0].toUpperCase())}</span>`;
    }).join('');
    const mia = IO ? presDi(IO)[iso + '|' + q] : undefined;
    const descr = pp.map(p => { const v = presDi(p.id)[iso + '|' + q]; return (p.id === IO ? 'tu ' : p.nome + ' ') + (v === true ? (p.id === IO ? 'ci sei' : 'c\'è') : v === false ? 'fuori' : 'non ha risposto'); }).join(', ');
    return `<button type="button" class="cella" ${IO ? `data-cel="${iso}|${q}|${mia === true ? 1 : 0}"` : 'disabled'} aria-label="${esc(nomeG(d) + (q === 'p' ? ' pranzo' : ' cena') + ': ' + descr)}">${av}</button>`;
  };
  let h = `<div class="sub-cap"><button type="button" class="indietro" id="prB" aria-label="Torna a Oggi">${ic('indietro', 22, 2)}</button><div><h1>A tavola</h1><p>Chi mangia a casa questa settimana</p></div></div>
    <div class="pres"><div class="rg h"><span></span><span>Pranzo</span><span>Cena</span></div>` +
    giorni.map((d, i) => `<div class="rg ${i === 0 ? 'oggi' : ''}"><span>${esc(nomeG(d))}</span>${cella(d, 'p')}${cella(d, 'c')}</div>`).join('') + `</div>
    <div class="legenda"><span><i style="background:var(--acc)"></i>Ci sono</span><span><i style="border:2px solid var(--check)"></i>Fuori</span><span><i style="border:2px dashed var(--warn-strong)"></i>Non ha risposto</span></div>
    <div class="info-verde">${ic('sacchetto', 22, 1.8)}<span><strong>${porzioni} ${porzioni === 1 ? 'porzione' : 'porzioni'}</strong> da preparare nei prossimi 7 giorni, contando chi ha detto che c'è.</span></div>
    ${IO ? '<p class="by" style="margin:0">Tocca una casella per dire se ci sei. Ognuno risponde per sé dal suo telefono.</p>' : ''}`;
  el.innerHTML = h;
  $('prB').onclick = () => vai('oggi');
  el.querySelectorAll('[data-cel]').forEach(b => b.onclick = () => { const [iso, q, on] = b.dataset.cel.split('|'); segnaPresenza(IO, iso, q, on === '1' ? false : true); });
}

// Promemoria dentro l'app, all'apertura
function promemoria() {
  if (!G || !IO) return;
  const iso = oggiISO(), h = new Date().getHours();
  const s = Conti.saldi(D.movimenti, D.partecipanti)[IO] || 0, ult = +LS.get('promConti') || 0;
  if (avvisoAttivo('conti') && Math.abs(s) >= 1 && Date.now() - ult > 7 * 864e5) {
    LS.set('promConti', String(Date.now()));
    toast(s > 0 ? 'Ti devono ' + eur(s) : 'Devi ' + eur(-s), { testo: 'Vedi', fn: () => vai('conti') });
  }
}
