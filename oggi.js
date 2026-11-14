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
  return pa.voci.map((_, i) => { const v = voceEffettiva(pid, gi, pa, i); return `<li><span>${EMO.bottone(v.nome, '🍽️')}${esc(v.nome)}${v.scambiata ? `<small>al posto di ${esc(v.origine.nome)}</small>` : ''}</span><span>${esc(qtaTesto(v) || v.misura || '')}</span></li>`; }).join('');
}

function gruppoAvatars() {
  const pp = D.partecipanti;
  return `<button type="button" class="avs" id="ogG" aria-label="Gruppo ${esc(G.nome)}, ${pp.length} ${pp.length === 1 ? 'membro' : 'membri'}">${pp.slice(0, 4).map((p, i) => avatar(p, i)).join('')}</button>`;
}

// ---------- Dashboard del giorno: pasti in breve, chi c'è a tavola, agenda, spesa e conti ----------
let ogData = '', ogAperto = null; // giorno mostrato (vuoto = oggi) e pasto aperto
const ogIso = () => ogData || oggiISO();
const dataDi = iso => new Date(iso + 'T12:00:00');
// il giorno del piano che cade in una data: per nome della settimana, altrimenti contando dal giorno scelto
function giornoPianoPer(piano, iso) {
  if (!piano?.giorni?.length) return -1;
  const g = giornoPerData(piano, dataDi(iso)); if (g >= 0) return g;
  const n = piano.giorni.length, diff = Math.round((dataDi(iso) - dataDi(oggiISO())) / 864e5);
  return ((giornoScelto(IO) + diff) % n + n) % n;
}
function cambiaGiorno(iso) { ogData = iso === oggiISO() ? '' : iso; ogAperto = null; vibra(); renderOggi(); }
function riassuntoPasto(gi, pa) {
  if (!pa.voci) return pa.alimenti || '';
  return pa.voci.map((_, i) => voceEffettiva(IO, gi, pa, i).nome).join(', ');
}

function renderOggi() {
  const el = $('t-oggi'); if (!el) return;
  if (!G) { el.innerHTML = '<div class="testa"><h1>Oggi</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const oggi = oggiISO(), iso = ogIso(), dd = dataDi(iso), diff = Math.round((dd - dataDi(oggi)) / 864e5);
  const maiusc = t => t[0].toUpperCase() + t.slice(1);
  const nomeGiorno = diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : diff === -1 ? 'Ieri' : maiusc(dd.toLocaleDateString('it-IT', { weekday: 'long' }));
  const dataTxt = maiusc(dd.toLocaleDateString('it-IT', diff === 0 || Math.abs(diff) === 1 ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: dd.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }));
  let h = `<div class="cap og-cap"><div class="og-gg"><button type="button" class="og-freccia" id="ogPrev" aria-label="Giorno precedente">${ic('indietro', 20, 2.2)}</button>
    <button type="button" class="og-titolo" id="ogData" aria-label="Scegli il giorno"><span class="q">${diff === 0 ? puntoLive() : ''}${esc(dataTxt)}</span><span class="h1">${esc(nomeGiorno)}</span></button>
    <button type="button" class="og-freccia" id="ogNext" aria-label="Giorno successivo">${ic('avanti', 20, 2.2)}</button></div>${gruppoAvatars()}
    <input type="date" id="ogPick" value="${iso}" tabindex="-1" aria-hidden="true" class="og-pick"></div>
    ${diff !== 0 ? `<button type="button" class="link og-torna" id="ogOggi">${ic('indietro', 15, 2.2)} Torna a oggi</button>` : ''}`;
  // ---- Pasti del giorno, in breve: si apre quello che interessa
  const piano = IO ? pianoDi(IO) : null, gi = giornoPianoPer(piano, iso);
  const pasti = gi >= 0 ? pastiDelGiorno(piano.giorni[gi]) : [];
  const ora = new Date().getHours() * 60 + new Date().getMinutes();
  const prossimo = diff === 0 ? pasti.find(x => minutiDi(oraDi(x.pa.tipo)) + 60 > ora) || null : null;
  const aperto = ogAperto !== null ? ogAperto : prossimo ? prossimo.pa.tipo : '';
  if (!IO) {
    h += `<div class="big"><p class="q" style="margin:0;line-height:1.5">Per vedere i tuoi pasti indica chi sei in ${esc(G.nome)}.</p><button class="btn" type="button" id="ogChi">Indica chi sei</button></div>`;
  } else if (!piano?.giorni?.length) {
    h += `<section class="big" aria-labelledby="og-t"><span class="eyebrow">Il tuo piano</span><h2 id="og-t">Nessun piano alimentare</h2><p class="q" style="margin:0;line-height:1.5">Carica il PDF del nutrizionista oppure scrivilo a mano: qui vedrai i pasti del giorno con le quantità.</p>
      <div class="riga"><button class="btn" type="button" id="ogUp" style="flex:1">${ic('carica', 18)}Carica PDF</button><button class="btn bordo" type="button" id="ogMan" style="flex:1;margin:0">${ic('matita', 18)}A mano</button></div></section>`;
  } else {
    const momentoDi = tipo => /cena/i.test(tipo) ? (diff === 0 ? 'stasera' : 'cena') : /pranzo/i.test(tipo) ? 'pranzo' : 'questo pasto';
    const riga = x => {
      const { pa, k } = x, tipo = pa.tipo, ric = (ricetteDi(IO)[gi] || [])[k], ins = insiemeDi(iso, tipo), apri = tipo === aperto;
      const fatto = passato(iso, tipo), pros = prossimo && prossimo.pa.tipo === tipo;
      const piatto = ins ? (ricetteDi(ins.da)[ins.gi] || [])[ins.k] : ric;
      const sotto = (ins ? '👥 con ' + ins.chi.filter(p => p !== IO).map(nomeP).join(', ') + ' · ' : '') + (piatto ? piatto.nome : riassuntoPasto(gi, pa));
      let dett = '';
      if (apri) {
        dett = `<div class="og-dett"><ul class="alim">${righeCibo(IO, gi, pa)}</ul>
          ${ins ? `<button type="button" class="idea" data-oginsieme="${esc(ins.id)}"><span class="ib">${ic('piatto', 28, 1.8)}</span><span class="it2"><small>Piatto insieme · dosi adattate a te</small><b>${EMO.html(piatto?.nome || tipo)}${esc(piatto?.nome || tipo)}</b></span>${ic('avanti', 20, 2)}</button>
            <button type="button" class="link" data-ogesci="${esc(ins.id)}" style="align-self:flex-start">Non mangio insieme</button>`
          : ric ? `<button type="button" class="idea" data-ogric="${k}"><span class="ib">${ic('piatto', 28, 1.8)}</span><span class="it2"><small>Idea per ${momentoDi(tipo)}${ric.tempo ? ' · ' + esc(ric.tempo) : ''}</small><b>${EMO.html(ric.nome)}${esc(ric.nome)}</b></span>${ic('avanti', 20, 2)}</button>`
          : `<button type="button" class="idea" data-ogidea="${k}"><span class="ib">${ic('scintille', 26, 1.8)}</span><span class="it2"><small>Idea per ${momentoDi(tipo)}</small><b>Proponi un piatto con questi alimenti</b></span>${ic('avanti', 20, 2)}</button>`}
          ${!ins && D.partecipanti.length > 1 ? `<button type="button" class="link" data-ogcomb="${esc(tipo)}" style="align-self:flex-start">${ic('utenti', 16, 2)} Mangiamo insieme…</button>` : ''}</div>`;
      }
      return `<div class="og-pasto ${apri ? 'aperto' : ''} ${fatto ? 'fatto' : ''} ${pros ? 'pros' : ''}"><button type="button" class="og-riga" data-ogp="${esc(tipo)}" aria-expanded="${apri}">
        <span class="og-em" aria-hidden="true">${EMO.per(tipo, '🍽️')}</span><span class="og-tt"><b>${esc(tipo)}${pros ? '<em>Prossimo</em>' : ''}</b><small>${esc(sotto)}</small></span>
        <span class="og-ora num">${esc(oraDi(tipo))}</span>${ic('giu', 18, 2)}</button>${dett}</div>`;
    };
    h += `<section class="card og-pasti" aria-label="Pasti di ${esc(nomeGiorno.toLowerCase())}"><div class="sez-riga"><h2 class="sez">Pasti${piano.giorni[gi]?.giorno ? ' · ' + esc(piano.giorni[gi].giorno) : ''}</h2><button type="button" class="link" id="ogPiano">Apri il piano</button></div>
      ${pasti.length ? pasti.map(riga).join('') : '<p class="q" style="margin:0">Nessun pasto per questo giorno.</p>'}</section>`;
  }
  // ---- A tavola: pranzo e cena del giorno
  if (IO) {
    const altri = conApp().filter(p => p.id !== IO);
    const rigaTv = q => {
      const mia = presDi(IO)[iso + '|' + q], si = conApp().filter(p => presDi(p.id)[iso + '|' + q] === true).length, nr = altri.filter(p => presDi(p.id)[iso + '|' + q] === undefined);
      const info = nr.length ? nr.map(p => p.nome).join(', ') + (nr.length === 1 ? ' non ha risposto' : ' non hanno risposto') : altri.length ? si + (si === 1 ? ' a tavola' : ' a tavola') : '';
      return `<div class="og-tv"><span class="og-tvn"><b>${q === 'p' ? '🍝 Pranzo' : '🍽️ Cena'}</b>${info ? `<small>${esc(info)}</small>` : ''}</span>
        <button type="button" class="pill-btn ${mia === true ? 'on' : ''}" aria-pressed="${mia === true}" data-pr="${q}|si">Ci sono</button><button type="button" class="pill-btn ${mia === false ? 'on' : ''}" aria-pressed="${mia === false}" data-pr="${q}|no">Salto</button></div>`;
    };
    h += `<section class="card og-tavola" aria-label="A tavola"><div class="sez-riga"><h2 class="sez">A tavola</h2><button type="button" class="link" id="ogSett">Tutta la settimana</button></div>${rigaTv('p')}${rigaTv('c')}</section>`;
  }
  // ---- Agenda del giorno (e scadenze vicine, se è oggi)
  const delGiorno = vociDelGiorno(iso).filter(e => riguardaMe(e)).map(e => ({ e, d: iso }));
  const vicine = diff === 0 ? prossimeScadenze(3).filter(x => x.d > iso && x.d <= isoDi(new Date(Date.now() + 3 * 864e5)) && riguardaMe(x.e)) : [];
  const ag = delGiorno.concat(vicine).slice(0, 6);
  h += `<section class="card og-agenda" aria-label="Agenda"><div class="sez-riga"><h2 class="sez">Agenda</h2><button type="button" class="link" id="ogAgAgg">${ic('piu', 15, 2.2)}Aggiungi</button></div>
    ${ag.length ? `<div class="sc">${ag.map(x => rigaAgenda(x.e, x.d, { conData: x.d !== iso })).join('')}</div>` : `<button type="button" class="og-vuoto" id="ogAg">Niente in agenda ${diff === 0 ? 'oggi' : 'per questo giorno'} · apri l'agenda</button>`}</section>`;
  if (diff === 0) h += htmlInsiemeProssimi();
  // ---- Spesa e conti in breve
  const daPrendere = D.spesa.filter(x => !x.comprato), daAltri = daPrendere.filter(x => x.aggiunto_da && x.aggiunto_da !== CHI);
  const nomiAltri = [...new Set(daAltri.map(x => x.aggiunto_da))];
  const s = Conti.saldi(D.movimenti, D.partecipanti), mio = IO ? (s[IO] || 0) : 0, rr = Conti.rimborsi(s);
  const verso = mio > 0 ? rr.filter(r => r.a === IO) : rr.filter(r => r.da === IO);
  const chiConti = verso.length === 1 ? nomeP(mio > 0 ? verso[0].da : verso[0].a) : '';
  h += `<div class="tiles">
    <button type="button" class="tile2" id="ogSp">${ic('sacchetto', 24, 1.8)}<b>${daPrendere.length ? daPrendere.length + ' da prendere' : 'Lista vuota'}</b><span>${daAltri.length ? daAltri.length + (daAltri.length === 1 ? ' aggiunto da ' : ' aggiunti da ') + esc(nomiAltri.length === 1 ? nomiAltri[0] : 'altri') : daPrendere.length ? 'Nella lista della spesa' : 'Aggiungi quello che manca'}</span></button>
    <button type="button" class="tile2" id="ogCo">${ic('borsello', 24, 1.8)}<b class="num ${mio > 0 ? 'pos' : mio < 0 ? 'neg' : ''}">${mio ? (mio > 0 ? '+ ' : '− ') + eur(Math.abs(mio)) : 'In pari'}</b><span>${mio > 0 ? (chiConti ? esc(chiConti) + ' ti deve' : 'Ti devono') : mio < 0 ? (chiConti ? 'Devi a ' + esc(chiConti) : 'Devi') : 'Nessun conto da saldare'}</span></button></div>
    <button type="button" class="riga-link" id="ogChat">${ic('scintille', 22, 1.8)}<span><b>Chiedi all'assistente</b><small>Cosa mangio stasera? Cosa manca in casa?</small></span>${ic('avanti', 18, 2)}</button>`;
  el.innerHTML = h;
  // ---- Collegamenti
  const sposta = n => { const d = dataDi(iso); d.setDate(d.getDate() + n); cambiaGiorno(isoDi(d)); };
  $('ogPrev').onclick = () => sposta(-1); $('ogNext').onclick = () => sposta(1);
  if ($('ogOggi')) $('ogOggi').onclick = () => cambiaGiorno(oggi);
  $('ogData').onclick = () => { const p = $('ogPick'); try { if (p.showPicker) p.showPicker(); else p.focus(); } catch (e) { p.focus(); } };
  $('ogPick').onchange = () => { if ($('ogPick').value) cambiaGiorno($('ogPick').value); };
  $('ogG').onclick = () => vai('gruppo');
  if ($('ogChi')) $('ogChi').onclick = scegliPartecipante;
  if ($('ogUp')) $('ogUp').onclick = () => { personaPiano = IO; $('pdf').click(); };
  if ($('ogMan')) $('ogMan').onclick = () => editorPiano(IO);
  if ($('ogPiano')) $('ogPiano').onclick = () => { if (gi >= 0) LS.set('giorno:' + IO, String(gi)); personaPiano = IO; vai('piano'); renderPiano(); };
  el.querySelectorAll('[data-ogp]').forEach(b => b.onclick = () => { ogAperto = aperto === b.dataset.ogp ? '' : b.dataset.ogp; vibra(); renderOggi(); });
  el.querySelectorAll('[data-ogric]').forEach(b => b.onclick = () => apriRicetta(IO, gi, +b.dataset.ogric));
  el.querySelectorAll('[data-ogidea]').forEach(b => b.onclick = () => proponiPiatto(IO, gi, +b.dataset.ogidea));
  el.querySelectorAll('[data-oginsieme]').forEach(b => b.onclick = () => apriInsieme(Object.assign({ id: b.dataset.oginsieme }, D.stato[b.dataset.oginsieme])));
  el.querySelectorAll('[data-ogesci]').forEach(b => b.onclick = () => esciDaInsieme(b.dataset.ogesci));
  el.querySelectorAll('[data-ogcomb]').forEach(b => b.onclick = () => foglioInsieme(b.dataset.ogcomb, iso));
  el.querySelectorAll('[data-insp]').forEach(b => b.onclick = () => apriInsieme(Object.assign({ id: b.dataset.insp }, D.stato[b.dataset.insp])));
  el.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { const [q, v] = b.dataset.pr.split('|'), mia = presDi(IO)[iso + '|' + q]; segnaPresenza(IO, iso, q, v === 'si' ? (mia === true ? undefined : true) : (mia === false ? undefined : false)); });
  if ($('ogSett')) $('ogSett').onclick = () => vai('presenze');
  if ($('ogAg')) $('ogAg').onclick = () => { agendaGiorno = iso; vai('agenda'); renderAgenda(); };
  $('ogAgAgg').onclick = () => formAgenda(null, { data: iso });
  el.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { agendaGiorno = b.dataset.d; vai('agenda'); renderAgenda(); apriVoceAgenda(b.dataset.ev, b.dataset.d); });
  $('ogSp').onclick = () => vai('spesa'); $('ogCo').onclick = () => vai('conti'); $('ogChat').onclick = () => vai('chat');
  // scorrendo col dito a destra o a sinistra si cambia giorno
  if (!el._scorri) {
    el._scorri = true; let x0 = 0, y0 = 0, ok = false;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; ok = e.touches.length === 1 && !e.target.closest('.chips,.sc,input,.og-pick'); x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    el.addEventListener('touchend', e => { if (!ok) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; if (Math.abs(dx) > 70 && Math.abs(dy) < 45) { const d = dataDi(ogIso()); d.setDate(d.getDate() + (dx < 0 ? 1 : -1)); cambiaGiorno(isoDi(d)); } }, { passive: true });
  }
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
