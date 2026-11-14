// Agenda del gruppo: appuntamenti (comuni o personali, da che ora a che ora, dove) e scadenze (mutuo, affitto, utenze…).
// Ogni voce è un documento "evento:<id>" nel gruppo, così due persone possono scrivere insieme senza sovrascriversi.
// I promemoria li manda il server (funzione "notifica", ogni 5 minuti) a chi riguarda: tutto il gruppo o le persone scelte.
const PROMEMORIA_EVENTO = [['', 'Nessuno'], ['0', 'All\'ora dell\'appuntamento'], ['15', '15 minuti prima'], ['30', '30 minuti prima'], ['60', '1 ora prima'], ['120', '2 ore prima'], ['1440', 'Il giorno prima']];
const PROMEMORIA_SCADENZA = [['', 'Nessuno'], ['0', 'Il giorno stesso (ore 9)'], ['1440', '1 giorno prima'], ['4320', '3 giorni prima'], ['10080', '1 settimana prima']];
const RIPETI = [['no', 'Mai'], ['settimana', 'Ogni settimana'], ['mese', 'Ogni mese'], ['anno', 'Ogni anno']];
const CATEGORIE_SCADENZA = ['Mutuo', 'Affitto', 'Luce', 'Gas', 'Acqua', 'Internet', 'Telefono', 'Condominio', 'Assicurazione', 'Bollo auto', 'Tasse', 'Abbonamento'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
let agendaMese = null, agendaGiorno = null;

const eventi = () => Object.entries(D.stato).filter(([k, v]) => /^evento:/.test(k) && v && !v.eliminato).map(([k, v]) => ({ ...v, id: k.slice(7) }));
const daIso = s => { const [y, m, g] = s.split('-').map(Number); return new Date(y, m - 1, g, 12); };
const giorniMese = (y, m) => new Date(y, m + 1, 0).getDate();
// Le date di un evento (con le ripetizioni) tra due giorni compresi
function occorrenze(ev, da, a) {
  const out = [], inizio = daIso(ev.data), fino = ev.fino ? daIso(ev.fino) : null, A = daIso(a), DA = daIso(da);
  if (!ev.ripeti || ev.ripeti === 'no') { if (ev.data >= da && ev.data <= a) out.push(ev.data); return out; }
  for (let i = 0; i < 1000; i++) {
    let d;
    if (ev.ripeti === 'settimana') d = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + 7 * i, 12);
    else if (ev.ripeti === 'mese') { const y = inizio.getFullYear(), m = inizio.getMonth() + i, yy = y + Math.floor(m / 12), mm = m % 12; d = new Date(yy, mm, Math.min(inizio.getDate(), giorniMese(yy, mm)), 12); }
    else if (ev.ripeti === 'anno') { const yy = inizio.getFullYear() + i; d = new Date(yy, inizio.getMonth(), Math.min(inizio.getDate(), giorniMese(yy, inizio.getMonth())), 12); }
    else break;
    if (d > A || (fino && d > fino)) break;
    if (d >= DA) out.push(isoDi(d));
  }
  return out;
}
function vociDelGiorno(iso) {
  return eventi().filter(e => occorrenze(e, iso, iso).length).sort((a, b) => (a.tutto_giorno || a.tipo === 'scadenza' ? '' : a.inizio || '').localeCompare(b.tutto_giorno || b.tipo === 'scadenza' ? '' : b.inizio || '') || a.titolo.localeCompare(b.titolo));
}
// Le prossime scadenze non ancora pagate, dalla più vicina
function prossimeScadenze(giorni = 45) {
  const oggi = oggiISO(), fine = isoDi(new Date(Date.now() + giorni * 864e5)), da = isoDi(new Date(Date.now() - 31 * 864e5));
  const l = [];
  eventi().filter(e => e.tipo === 'scadenza').forEach(e => occorrenze(e, da, fine).forEach(d => { if (!(e.fatti && e.fatti[d]) && (d >= oggi || d >= da)) l.push({ e, d }); }));
  // una riga per scadenza: la prima rata non pagata (anche se già passata)
  const viste = new Set();
  return l.sort((a, b) => a.d.localeCompare(b.d)).filter(x => { if (viste.has(x.e.id)) return false; viste.add(x.e.id); return true; });
}
const perChi = e => !e.chi || !e.chi.length ? 'Tutto il gruppo' : e.chi.map(p => p === IO ? 'Tu' : nomeP(p)).join(', ');
const riguardaMe = e => !e.chi || !e.chi.length || e.chi.includes(IO);
function quandoTesto(e, d) {
  const dd = daIso(d), oggi = oggiISO(), dom = isoDi(new Date(Date.now() + 864e5));
  const g = d === oggi ? 'Oggi' : d === dom ? 'Domani' : dd.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/^./, c => c.toUpperCase());
  return e.tipo === 'scadenza' || e.tutto_giorno ? g : g + ' · ' + (e.inizio || '') + (e.fine ? '–' + e.fine + (dopoMezzanotte(e) ? ' del giorno dopo' : '') : '');
}
// 20:00–01:30: l'appuntamento finisce il giorno dopo
const dopoMezzanotte = e => !!(e && e.inizio && e.fine && e.fine < e.inizio);
const euro = v => v ? eur(Math.round(parseFloat(String(v).replace(',', '.')) * 100) || 0) : '';

function rigaAgenda(e, d, opz = {}) {
  const pagata = e.tipo === 'scadenza' && e.fatti && e.fatti[d], scaduta = e.tipo === 'scadenza' && !pagata && d < oggiISO();
  const ora = e.tipo === 'scadenza' ? ic('scontrino', 18, 2) : e.tutto_giorno ? '<small>Tutto<br>il giorno</small>' : `<b class="num">${esc(e.inizio || '')}</b>${e.fine ? `<small class="num">${esc(e.fine)}${dopoMezzanotte(e) ? ' +1' : ''}</small>` : ''}`;
  return `<button type="button" class="ag-riga ${e.tipo === 'scadenza' ? 'scad' : ''} ${pagata ? 'fatta' : ''}" data-ev="${e.id}" data-d="${d}">
    <span class="ag-ora">${ora}</span>
    <span class="ag-t"><b>${EMO.html(e.titolo, e.tipo === 'scadenza' ? '🧾' : '📅', 'e:' + e.id)}${esc(e.titolo)}</b><small>${opz.conData ? esc(quandoTesto(e, d)) + ' · ' : ''}${e.luogo ? esc(e.luogo) + ' · ' : ''}${esc(perChi(e))}${e.ripeti && e.ripeti !== 'no' ? ' · ' + esc((RIPETI.find(r => r[0] === e.ripeti) || [])[1] || '').toLowerCase() : ''}</small></span>
    ${e.tipo === 'scadenza' ? `<span class="ag-imp">${e.importo ? `<b class="num">${esc(euro(e.importo))}</b>` : ''}<small class="${scaduta ? 'tardi' : ''}">${pagata ? 'Pagata' : scaduta ? 'Scaduta' : ''}</small></span>` : ''}
  </button>`;
}

function renderAgenda() {
  const el = $('t-agenda'); if (!el) return;
  if (!G) { el.innerHTML = '<div class="cap"><div><h1>Agenda</h1></div></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const oggi = new Date(); if (!agendaMese) agendaMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1); if (!agendaGiorno) agendaGiorno = oggiISO();
  const y = agendaMese.getFullYear(), m = agendaMese.getMonth(), primo = (new Date(y, m, 1).getDay() + 6) % 7, n = giorniMese(y, m);
  const da = isoDi(new Date(y, m, 1)), a = isoDi(new Date(y, m, n)), segni = {};
  eventi().forEach(e => occorrenze(e, da, a).forEach(d => { (segni[d] = segni[d] || new Set()).add(e.tipo === 'scadenza' ? 's' : 'e'); }));
  let celle = '';
  for (let i = 0; i < primo; i++) celle += '<span></span>';
  for (let g = 1; g <= n; g++) {
    const d = isoDi(new Date(y, m, g)), s = segni[d];
    celle += `<button type="button" class="ag-g ${d === oggiISO() ? 'oggi' : ''} ${d === agendaGiorno ? 'sel' : ''}" data-gg="${d}" aria-label="${g} ${MESI[m]}${s ? ', ci sono impegni' : ''}" aria-pressed="${d === agendaGiorno}"><span class="num">${g}</span><i>${s ? [...s].sort().map(t => `<em class="${t}"></em>`).join('') : ''}</i></button>`;
  }
  const delGiorno = vociDelGiorno(agendaGiorno), sc = prossimeScadenze();
  const titoloGiorno = daIso(agendaGiorno).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
  el.innerHTML = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">${esc(G.nome)} · appuntamenti e scadenze</p><h1>Agenda</h1></div></div>
    <section class="card ag-cal" aria-label="Calendario">
      <div class="ag-testa"><button type="button" class="og-freccia" id="agP" aria-label="Mese precedente">${ic('indietro', 20, 2)}</button><h2>${MESI[m].replace(/^./, c => c.toUpperCase())} ${y}</h2><button type="button" class="og-freccia" id="agN" aria-label="Mese successivo">${ic('avanti', 20, 2)}</button></div>
      <div class="ag-sett" aria-hidden="true">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="ag-griglia">${celle}</div>
      ${agendaGiorno !== oggiISO() ? '<button type="button" class="link" id="agOggi" style="align-self:center;padding:6px 0 0">Torna a oggi</button>' : ''}
    </section>
    <section style="display:flex;flex-direction:column;gap:12px"><div class="sez-riga"><h2 class="sez">${esc(titoloGiorno)}</h2><button type="button" class="link" id="agAgg">${ic('piu', 16, 2.2)}Aggiungi</button></div>
      ${delGiorno.length ? `<div class="sc">${delGiorno.map(e => rigaAgenda(e, agendaGiorno)).join('')}</div>` : `<div class="card vuoto" style="padding:18px">Niente in programma.</div>`}</section>
    ${sc.length ? `<section style="display:flex;flex-direction:column;gap:12px"><h2 class="sez">Prossime scadenze</h2><div class="sc">${sc.slice(0, 8).map(x => rigaAgenda(x.e, x.d, { conData: true })).join('')}</div></section>` : ''}
    ${htmlStatoPromemoria()}
    <button class="fab2" id="agFab" type="button" aria-label="Nuovo appuntamento o scadenza">${ic('piu', 22, 2.2)}Nuovo</button><div style="height:72px"></div>`;
  $('agP').onclick = () => { agendaMese = new Date(y, m - 1, 1); renderAgenda(); };
  $('agN').onclick = () => { agendaMese = new Date(y, m + 1, 1); renderAgenda(); };
  if ($('agOggi')) $('agOggi').onclick = () => { agendaGiorno = oggiISO(); agendaMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1); renderAgenda(); };
  el.querySelectorAll('[data-gg]').forEach(b => b.onclick = () => { agendaGiorno = b.dataset.gg; vibra(); renderAgenda(); });
  el.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => apriVoceAgenda(b.dataset.ev, b.dataset.d));
  $('agAgg').onclick = () => formAgenda(null, { data: agendaGiorno });
  $('agFab').onclick = () => formAgenda(null, { data: agendaGiorno });
  collegaStatoPromemoria(el);
  scorriElimina([...el.querySelectorAll('.sc > .ag-riga')], (r, ripristina) => eliminaVoceAgenda(r.dataset.ev, ripristina));
}

// Tocco su una voce: le scadenze si possono segnare pagate, poi si modifica
function apriVoceAgenda(id, d) {
  const e = eventi().find(x => x.id === id); if (!e) return;
  if (e.tipo !== 'scadenza') return formAgenda(e);
  const pagata = e.fatti && e.fatti[d];
  foglio(`<h2>${EMO.html(e.titolo, '🧾', 'e:' + e.id)}${esc(e.titolo)}</h2><p class="q" style="margin:4px 0 12px;line-height:1.5">Scadenza di ${esc(quandoTesto(e, d).toLowerCase())}${e.importo ? ' · ' + esc(euro(e.importo)) : ''}${e.note ? '<br>' + esc(e.note) : ''}</p>
    <button class="btn" id="avP" type="button">${ic('spunta', 18, 2.2)}${pagata ? 'Segna come da pagare' : 'Segna come pagata'}</button>
    <button class="btn ghost" id="avM" type="button">${ic('matita', 18)}Modifica</button>`);
  $('avM').onclick = () => { chiudi(); formAgenda(e); };
  $('avP').onclick = async () => {
    const v = { ...e }; delete v.id; v.fatti = { ...(e.fatti || {}) }; if (pagata) delete v.fatti[d]; else v.fatti[d] = true;
    chiudi(); D.stato['evento:' + id] = v; renderAgenda(); renderOggi();
    if (!(await scrivi(() => ST.salvaStato(G.id, 'evento:' + id, v)))) return;
    if (!pagata) toast('Pagata ✓', { testo: 'Registra nei conti', fn: () => { vai('conti'); formMovimento(null, { tipo: 'spesa', titolo: e.titolo, importo: Math.round(parseFloat(String(e.importo || 0).replace(',', '.')) * 100) || 0, data: d, categoria: e.categoria || '' }); } });
  };
}
function eliminaVoceAgenda(id, ripristina) {
  const e = eventi().find(x => x.id === id); if (!e) return ripristina && ripristina();
  conferma('Eliminare "' + e.titolo + '"?', e.ripeti && e.ripeti !== 'no' ? 'Verranno tolte tutte le ripetizioni, per tutto il gruppo.' : 'Verrà tolto dall\'agenda di tutto il gruppo.', 'Elimina', async () => {
    const v = { ...e, eliminato: true, eliminato_da: CHI }; delete v.id;
    D.stato['evento:' + id] = v; renderAgenda(); renderOggi();
    if (await scrivi(() => ST.salvaStato(G.id, 'evento:' + id, v))) toast('Eliminato');
  }, true, ripristina);
}

function formAgenda(e, preset = {}) {
  const nuovo = !e; let emo;
  const f = e ? JSON.parse(JSON.stringify(e)) : Object.assign({ id: uuid(), tipo: 'evento', titolo: '', data: oggiISO(), tutto_giorno: false, inizio: '20:00', fine: '', luogo: '', chi: [], promemoria: '60', ripeti: 'no', importo: '', categoria: '', note: '' }, preset);
  const disegna = () => {
    const sc = f.tipo === 'scadenza', opzP = sc ? PROMEMORIA_SCADENZA : PROMEMORIA_EVENTO, tutti = !f.chi || !f.chi.length;
    if (!opzP.some(o => o[0] === String(f.promemoria ?? ''))) f.promemoria = sc ? '1440' : '60';
    foglio(`<h2>${nuovo ? (sc ? 'Nuova scadenza' : 'Nuovo appuntamento') : 'Modifica'}</h2>
      <nav class="seg" aria-label="Tipo" style="margin:6px 0 4px">${[['evento', 'Appuntamento'], ['scadenza', 'Scadenza']].map(([k, n]) => f.tipo === k ? `<span aria-current="page">${n}</span>` : `<button type="button" data-tp="${k}">${n}</button>`).join('')}</nav>
      ${sc ? `<div class="chips" style="margin:8px -20px 0;padding:2px 20px 4px">${CATEGORIE_SCADENZA.map(c => `<button type="button" class="chip ${f.categoria === c ? 'on' : ''}" data-cat="${esc(c)}" style="padding:0 14px">${esc(c)}</button>`).join('')}</div>` : ''}
      <label class="lb" for="agT">${sc ? 'Che cosa scade' : 'Che cosa'}</label><div class="riga" style="gap:8px"><button type="button" class="emo-b" id="agEm" aria-label="Cambia emoji">${emo !== undefined ? (emo.e || EMO.scegli(f.titolo) || (sc ? '🧾' : '📅')) : EMO.per(f.titolo, sc ? '🧾' : '📅', 'e:' + f.id)}</button><input id="agT" value="${esc(f.titolo)}" placeholder="${sc ? 'Es. Rata del mutuo' : 'Es. Cena dai genitori'}" maxlength="80" style="flex:1;min-width:0"></div>
      <div class="coppia"><div><label class="lb" for="agD">${sc ? 'Scade il' : 'Giorno'}</label><input id="agD" type="date" value="${esc(f.data)}"></div>
      ${sc ? `<div><label class="lb" for="agI">Importo (facoltativo)</label><input id="agI" inputmode="decimal" value="${esc(f.importo)}" placeholder="0,00"></div>` : ''}</div>
      ${sc ? '' : `<label class="riga-check"><input type="checkbox" id="agTG" ${f.tutto_giorno ? 'checked' : ''}><span>Tutto il giorno</span></label>
      <div class="coppia" id="agOre" ${f.tutto_giorno ? 'hidden' : ''}><div><label class="lb" for="agS">Dalle</label><input id="agS" type="time" value="${esc(f.inizio)}"></div><div><label class="lb" for="agE">Alle (facoltativo)</label><input id="agE" type="time" value="${esc(f.fine)}"></div></div>
      <p class="by" id="agDopo" style="margin:2px 0 0" ${dopoMezzanotte(f) ? '' : 'hidden'}>Finisce il giorno dopo, alle ${esc(f.fine)}.</p>
      <label class="lb" for="agL">Dove (facoltativo)</label><input id="agL" value="${esc(f.luogo)}" placeholder="Es. Ristorante Da Mario" maxlength="80">`}
      <label class="lb">Per chi</label><div class="chips" style="margin:0 -20px;padding:2px 20px 4px"><button type="button" class="chip ${tutti ? 'on' : ''}" data-chi="" style="padding:0 14px">Tutto il gruppo</button>${D.partecipanti.map((p, i) => `<button type="button" class="chip ${!tutti && f.chi.includes(p.id) ? 'on' : ''}" data-chi="${p.id}">${avatar(p, i, 'p')}${esc(p.id === IO ? 'Tu' : p.nome)}</button>`).join('')}</div>
      <p class="by" style="margin:4px 0 0">Il promemoria arriva ${tutti ? 'a tutto il gruppo' : 'solo alle persone scelte'}.</p>
      <div class="coppia"><div><label class="lb" for="agR">Promemoria</label><select id="agR">${opzP.map(([v, n]) => `<option value="${v}" ${String(f.promemoria ?? '') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label class="lb" for="agRp">Ripeti</label><select id="agRp">${RIPETI.map(([v, n]) => `<option value="${v}" ${f.ripeti === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      <label class="lb" for="agNo">Note (facoltative)</label><input id="agNo" value="${esc(f.note)}" maxlength="200">
      <button class="btn" id="agSv" type="button" style="margin-top:14px">Salva</button>
      ${nuovo ? '' : `<button class="btn danger" id="agDel" type="button">${ic('cestino', 18)}Elimina</button>`}`);
    const leggi = () => {
      f.titolo = $('agT').value.trim(); f.data = $('agD').value || f.data; f.note = $('agNo').value.trim();
      f.promemoria = $('agR').value; f.ripeti = $('agRp').value;
      if ($('agI')) f.importo = $('agI').value.trim();
      if ($('agTG')) { f.tutto_giorno = $('agTG').checked; f.inizio = $('agS').value; f.fine = $('agE').value; f.luogo = $('agL').value.trim(); }
    };
    $('pop').querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { leggi(); f.tipo = b.dataset.tp; disegna(); });
    $('pop').querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { leggi(); const prima = f.categoria; f.categoria = f.categoria === b.dataset.cat ? '' : b.dataset.cat; if (!f.titolo || f.titolo === prima) f.titolo = f.categoria; disegna(); });
    $('pop').querySelectorAll('[data-chi]').forEach(b => b.onclick = () => { leggi(); const p = b.dataset.chi; if (!p) f.chi = []; else { f.chi = (f.chi || []).includes(p) ? f.chi.filter(x => x !== p) : (f.chi || []).concat(p); if (f.chi.length === D.partecipanti.length) f.chi = []; } disegna(); });
    if ($('agTG')) $('agTG').onchange = () => { $('agOre').hidden = $('agTG').checked; $('agDopo').hidden = $('agTG').checked || !dopoMezzanotte({ inizio: $('agS').value, fine: $('agE').value }); };
    if ($('agE')) $('agE').oninput = $('agS').oninput = () => { const x = { inizio: $('agS').value, fine: $('agE').value }; $('agDopo').hidden = !dopoMezzanotte(x); $('agDopo').textContent = 'Finisce il giorno dopo, alle ' + x.fine + '.'; };
    $('agSv').onclick = () => { leggi(); salvaVoceAgenda(f, nuovo).then(ok => { if (ok !== false && emo !== undefined) salvaEmoji(emo.regola ? EMO.chiaveTesto(f.titolo) : 'e:' + f.id, emo.e); }); };
    $('agEm').onclick = () => { leggi(); scegliEmoji({ testo: f.titolo, chiave: 'e:' + f.id, auto: EMO.scegli(f.titolo) || (f.tipo === 'scadenza' ? '🧾' : '📅'), scelta: (x, regola) => { emo = { e: x, regola }; disegna(); } }); };
    if ($('agDel')) $('agDel').onclick = () => { chiudi(); eliminaVoceAgenda(e.id); };
  };
  disegna();
}
async function salvaVoceAgenda(f, nuovo) {
  if (!f.titolo) return !!toast(f.tipo === 'scadenza' ? 'Scrivi che cosa scade' : 'Scrivi di che cosa si tratta');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return !!toast('Scegli il giorno');
  if (f.tipo === 'evento' && !f.tutto_giorno && !f.inizio) return !!toast('Scegli l\'ora di inizio, oppure "Tutto il giorno"');
  if (f.tipo === 'evento' && !f.tutto_giorno && f.fine && f.fine === f.inizio) return !!toast('L\'ora di fine è uguale all\'inizio');
  if (f.importo && isNaN(parseFloat(String(f.importo).replace(',', '.')))) return !!toast('Importo non valido');
  const id = f.id || uuid(), v = { ...f }; delete v.id;
  if (v.tipo === 'scadenza') { v.tutto_giorno = true; v.inizio = ''; v.fine = ''; v.luogo = ''; }
  v.promemoria = v.promemoria === '' ? null : +v.promemoria;
  if (nuovo) { v.da = CHI; v.creato_da = IO; v.creato_il = new Date().toISOString(); } else v.modificato_da = CHI;
  chiudi(); D.stato['evento:' + id] = v; agendaGiorno = v.data; agendaMese = new Date(daIso(v.data).getFullYear(), daIso(v.data).getMonth(), 1);
  renderAgenda(); renderOggi();
  if (!(await scrivi(() => ST.salvaStato(G.id, 'evento:' + id, v)))) return;
  toast(nuovo ? 'Aggiunto all\'agenda ✓' : 'Salvato ✓');
  if (nuovo) avvisaGruppo(v.tipo === 'scadenza' ? 'Nuova scadenza' : 'Nuovo appuntamento', `${CHI}: ${v.titolo} · ${quandoTesto(v, v.data).toLowerCase()}${v.luogo ? ' · ' + v.luogo : ''}`, { tipo: 'agenda', scheda: 'agenda', a: v.chi && v.chi.length ? v.chi : undefined });
}

// Riquadro per la schermata Oggi: impegni di oggi e scadenze dei prossimi 3 giorni che mi riguardano
function htmlAgendaOggi() {
  if (!G) return '';
  const oggi = oggiISO(), tra3 = isoDi(new Date(Date.now() + 3 * 864e5));
  const og = vociDelGiorno(oggi).filter(e => e.tipo !== 'scadenza' && riguardaMe(e)).map(e => ({ e, d: oggi }));
  const sc = prossimeScadenze(3).filter(x => x.d <= tra3 && riguardaMe(x.e));
  const l = og.concat(sc).slice(0, 4);
  if (!l.length) return '';
  return `<section style="display:flex;flex-direction:column;gap:12px"><div class="sez-riga"><h2 class="sez">In agenda</h2><button type="button" class="link" id="ogAg">Apri l'agenda</button></div><div class="sc">${l.map(x => rigaAgenda(x.e, x.d, { conData: x.d !== oggi })).join('')}</div></section>`;
}

// ---------- Perché un promemoria non arriva? ----------
// Tre cose devono funzionare: le notifiche su questo telefono, il server che controlla l'agenda ogni 5 minuti, e la funzione aggiornata.
function htmlStatoPromemoria() {
  if (!G || !ST || ST.modo !== 'supabase' || ANTEPRIMA) return '';
  const tel = typeof notificheAttive === 'function' && notificheAttive();
  const t = Number((D.stato.cron_ultimo || {}).t) || 0, min = t ? Math.round((Date.now() - t) / 60000) : null;
  const server = min !== null && min <= 40;
  const fa = min === null ? 'mai' : min < 2 ? 'adesso' : min < 60 ? min + ' minuti fa' : Math.round(min / 60) + ' ore fa';
  const ok = tel && server;
  if (ok) return ''; // tutto a posto: la scheda compare solo se c'è qualcosa da sistemare
  return `<details class="card ag-stato" ${ok ? '' : 'open'}><summary><span>${ok ? '✅' : '⚠️'}</span><b>Promemoria ${ok ? 'attivi' : 'da sistemare'}</b>${ic('giu', 18, 2)}</summary>
    <div class="ag-stato-c">
      <p>${tel ? '✅ Notifiche attive su questo telefono.' : '❌ Notifiche spente su questo telefono.'}${!tel && ios() && !installata() ? ' Su iPhone arrivano solo con l\'app aggiunta alla schermata Home.' : ''}</p>
      <p>${server ? '✅' : '❌'} Il server controlla l'agenda: ultimo controllo ${esc(fa)}.${server ? '' : ' Se resta così, in Supabase va eseguito di nuovo <b>promemoria.sql</b> e la funzione <b>notifica</b> va pubblicata con il codice nuovo (vedi LEGGIMI).'}</p>
      <div class="riga" style="gap:8px;flex-wrap:wrap">${tel ? '' : '<button type="button" class="btn" id="agNot" style="flex:1;margin:0">Attiva notifiche</button>'}<button type="button" class="btn bordo" id="agProva" style="flex:1;margin:0">Manda una prova</button></div>
      <p>📅 In più puoi avere l'agenda nel Calendario del telefono, con avvisi che arrivano anche senza le notifiche dell'app.</p><button type="button" class="btn ghost" id="agCal" style="margin:0">Aggiungi al calendario del telefono</button>
    </div></details>`;
}
function collegaStatoPromemoria(el) {
  if (el.querySelector('#agNot')) el.querySelector('#agNot').onclick = () => attivaNotifiche();
  if (el.querySelector('#agCal')) el.querySelector('#agCal').onclick = () => foglioCollega('calendario');
  if (el.querySelector('#agProva')) el.querySelector('#agProva').onclick = async () => {
    const b = el.querySelector('#agProva'); b.disabled = true;
    try {
      if (notificheAttive() && pushPossibile()) await iscriviDispositivo().catch(() => {});
      const r = await ST.provaNotifica(G.id);
      toast(r.inviate ? 'Prova inviata: dovrebbe arrivare tra pochi secondi ✓' : r.dispositivi ? 'Il server non è riuscito a mandarla: riattiva le notifiche su questo telefono' : 'Nessun telefono iscritto alle notifiche: tocca "Attiva notifiche"');
    } catch (e) { toast(e.message); }
    b.disabled = false;
  };
}
