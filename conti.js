// Scheda Conti (come Tricount): più conti (Casa, Viaggi, Extra…) con le loro voci, ma un unico saldo e uniche statistiche.
let vistaConti = 'home', cercaConti = '', filtroConto = LS.get('filtroConto') || '', filtroVoce = '';
const VG = () => (G && G.valuta) || 'EUR';
const eur = (c, v) => Conti.soldi(c, v || VG());
const contoDi = id => D.conti.find(c => c.id === id) || null;
const foglioQ = sel => $('pop').querySelectorAll(sel);
function tileMov(m, dim = 40) {
  let nome, t;
  if (m.tipo === 'trasferimento') { nome = 'scambio'; t = TONI.grigio; }
  else if (m.tipo === 'entrata') { nome = 'entrata'; t = TONI.verde; }
  else { const c = contoDi(m.conto_id); [nome, t] = iconaVoce(m.categoria, c?.tipo); }
  return `<span class="tile emo-t" style="width:${dim}px;height:${dim}px;font-size:${Math.round(dim * .52)}px;background:${t[0]};color:${t[1]}" aria-hidden="true">${EMO.mov(m, contoDi(m.conto_id))}</span>`;
}
const descrMov = m => m.tipo === 'trasferimento' ? `${esc(nomeTu(m.pagato_da))} → ${esc(nomeTu(Object.keys(m.divisione.parti)[0]))}` : (m.tipo === 'entrata' ? 'ricevuta da ' : 'pagata da ') + esc(nomeTu(m.pagato_da));
const nomeTu = id => id === IO ? 'te' : nomeP(id);
const etichettaConto = m => { const c = contoDi(m.conto_id); return c ? c.nome + (m.categoria ? ' · ' + m.categoria : '') : (m.categoria || ''); };

function renderConti() {
  const el = $('t-conti');
  if (!G) { el.innerHTML = '<div class="testa"><h1>Conti</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  if (filtroConto && !contoDi(filtroConto)) filtroConto = '';
  const s = Conti.saldi(D.movimenti, D.partecipanti), st = Conti.statistiche(D.movimenti, IO);
  let h;
  if (vistaConti === 'home') h = homeConti(s);
  else {
    const titoli = { spese: ['Movimenti', 'Tutte le spese, i rimborsi e le entrate'], saldi: ['Saldi', 'Chi deve a chi e le persone del gruppo'], stat: ['Statistiche', 'Dove vanno i soldi del gruppo'] };
    h = `<div class="sub-cap"><button type="button" class="indietro" id="coB" aria-label="Torna a Conti">${ic('indietro', 22, 2)}</button><div><h1>${titoli[vistaConti][0]}</h1><p>${titoli[vistaConti][1]}</p></div></div>` +
      (vistaConti === 'spese' ? vistaSpese(s) : vistaConti === 'saldi' ? vistaSaldi(s) : vistaStat(st));
  }
  h += `<button class="fab2" id="fab" type="button" aria-label="Aggiungi una spesa">${ic('piu', 22, 2.2)}Spesa</button><div style="height:72px"></div>`;
  el.innerHTML = h;
  el.querySelectorAll('[data-tper]').forEach(b => b.onclick = () => { statPeriodo = b.dataset.tper; vibra(); renderConti(); });
  if ($('coB')) $('coB').onclick = () => { vistaConti = 'home'; renderConti(); scrollTo(0, 0); };
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { vistaConti = b.dataset.v; renderConti(); scrollTo(0, 0); });
  el.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { filtroConto = b.dataset.fc; filtroVoce = ''; LS.set('filtroConto', filtroConto); renderConti(); });
  el.querySelectorAll('[data-fv]').forEach(b => b.onclick = () => { filtroVoce = filtroVoce === b.dataset.fv ? '' : b.dataset.fv; renderConti(); });
  $('fab').onclick = () => formMovimento(null, filtroConto ? { conto_id: filtroConto, categoria: filtroVoce } : {});
  el.querySelectorAll('tr[data-m]').forEach(r => r.onkeydown = e => { if (e.key === 'Enter') r.click(); });
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => formMovimento(D.movimenti.find(m => m.id === b.dataset.m)));
  scorriElimina([...el.querySelectorAll('.sc > .mov[data-m]')], (r, ripristina) => {
    const m = D.movimenti.find(x => x.id === r.dataset.m); if (!m) return ripristina();
    conferma('Eliminare questa voce?', `"${m.titolo}" verrà tolta dai conti di tutto il gruppo.`, 'Elimina', async () => {
      D.movimenti = D.movimenti.filter(x => x.id !== m.id); renderConti();
      if (await scrivi(() => ST.del('movimenti', m.id))) toast('Eliminata');
    }, true, ripristina);
  });
  if ($('cerca')) { $('cerca').value = cercaConti; $('cerca').oninput = e => { cercaConti = e.target.value; const p = e.target.selectionStart; renderConti(); $('cerca').focus(); $('cerca').setSelectionRange(p, p); }; }
  el.querySelectorAll('[data-rimb]').forEach(b => b.onclick = () => segnaRimborso(JSON.parse(b.dataset.rimb)));
  el.querySelectorAll('[data-pe]').forEach(b => b.onclick = () => modificaPartecipante(b.dataset.pe));
  if ($('pAdd')) { $('pAdd').onclick = aggiungiPartecipante; $('pNome').onkeydown = e => { if (e.key === 'Enter') aggiungiPartecipante(); }; }
  el.querySelectorAll('#csv,#csv2').forEach(b => b.onclick = esportaCSV);
  if ($('chiP')) $('chiP').onclick = scegliPartecipante;
  el.querySelectorAll('[data-gc]').forEach(b => b.onclick = () => gestisciConto(b.dataset.gc));
  if ($('saldato')) $('saldato').onclick = () => { const r = JSON.parse($('saldato').dataset.r || 'null'); if (r) segnaRimborso(r); else { vistaConti = 'saldi'; renderConti(); } };
  if ($('ricorda')) $('ricorda').onclick = ricordaConto;
}

// Schermata principale: saldo, il mese, gli ultimi movimenti
function homeConti(s) {
  const mio = IO ? (s[IO] || 0) : 0, rr = Conti.rimborsi(s);
  const verso = mio > 0 ? rr.filter(r => r.a === IO) : rr.filter(r => r.da === IO);
  const altro = verso.length === 1 ? nomeP(mio > 0 ? verso[0].da : verso[0].a) : '';
  const mese = new Date().toLocaleDateString('it-IT', { month: 'long' }), ym = oggiISO().slice(0, 7);
  const delMese = D.movimenti.filter(m => (m.data || '').startsWith(ym) && m.tipo === 'spesa');
  const spesoMese = delMese.reduce((t, m) => t + Conti.inValutaGruppo(m), 0);
  const miaMese = IO ? delMese.reduce((t, m) => { const q = Conti.quote(m)[IO]; return t + (q || 0); }, 0) : 0;
  let etichetta = !IO ? 'Il tuo saldo' : mio > 0 ? (altro ? altro + ' ti deve' : 'Ti devono') : mio < 0 ? (altro ? 'Devi a ' + altro : 'Devi') : 'Siete in pari';
  let h = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">Gruppo ${esc(G.nome)} · ${esc(mese)}</p><h1>Conti</h1></div><div class="dx solo-pc"><button type="button" class="ico-btn" id="csv" aria-label="Esporta per Excel">${ic('scarica', 20)}</button></div></div>`;
  h += `<section class="hero" aria-label="Saldo"><small>${esc(etichetta)}</small><span class="grande num">${IO ? eur(Math.abs(mio)) : '—'}</span>
    ${IO && mio ? `<div class="bt"><button type="button" id="saldato" data-r='${verso.length === 1 ? esc(JSON.stringify(verso[0])) : 'null'}'>Segna saldato</button><button type="button" class="out" id="ricorda">${mio > 0 ? 'Ricordaglielo' : 'Vedi i saldi'}</button></div>` : ''}
    ${!IO ? '<div class="bt"><button type="button" id="chiP">Indica chi sei</button></div>' : ''}</section>`;
  h += `<div class="kpi2"><div><small>Speso nel mese</small><b class="num">${eur(spesoMese)}</b></div><div><small>La tua parte</small><b class="num">${IO ? eur(miaMese) : '—'}</b></div></div>`;
  const ultimi = D.movimenti.slice(0, 5);
  h += `<section aria-labelledby="mov" style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;align-items:center"><h2 id="mov" class="sez" style="margin:0">Movimenti</h2>${D.movimenti.length ? '<button type="button" class="link" data-v="spese">Vedi tutti</button>' : ''}</div>`;
  h += ultimi.length ? `<div class="sc">${ultimi.map(rigaMov).join('')}</div>` : `<div class="card vuoto">${ic('borsello', 32)}Nessuna spesa ancora.<br>Tocca "Spesa" per aggiungere la prima: chi ha pagato, quanto e per chi.</div>`;
  h += `</section><div class="menu-righe">
    <button type="button" data-v="saldi">${ic('gruppo', 20, 1.8)}<span class="t"><b>Saldi e persone</b><small>Chi deve a chi, come pareggiare</small></span>${ic('avanti', 18, 2)}</button>
    <button type="button" data-v="stat">${ic('borsello', 20, 1.8)}<span class="t"><b>Statistiche</b><small>Per conto, per mese, chi ha pagato di più</small></span>${ic('avanti', 18, 2)}</button>
    <button type="button" data-v="spese">${ic('cartella', 20, 1.8)}<span class="t"><b>Conti e voci</b><small>${D.conti.length ? esc(D.conti.map(c => c.nome).join(', ')) : 'Casa, Viaggi, Extra…'}</small></span>${ic('avanti', 18, 2)}</button>
    <button type="button" id="csv2">${ic('scarica', 20, 1.8)}<span class="t"><b>Esporta per Excel</b><small>Tutti i movimenti in un file</small></span>${ic('avanti', 18, 2)}</button></div>`;
  return h;
}
const ICONE_MOV = m => m.tipo === 'trasferimento' ? 'scambio' : m.tipo === 'entrata' ? 'entrata' : /pizz/i.test(m.titolo) ? 'pizza' : /frutta|verdur|mercato/i.test(m.titolo) ? 'foglia' : iconaVoce(m.categoria || m.titolo, contoDi(m.conto_id)?.tipo)[0];
function rigaMov(m) {
  const tu = m.pagato_da === IO, data = new Date(m.data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const meta = m.tipo === 'trasferimento' ? `${tu ? 'Hai dato tu' : 'Ha dato ' + nomeP(m.pagato_da)} a ${nomeTu(Object.keys(m.divisione.parti)[0])} · ${data}` : `${tu ? 'Hai pagato tu' : (m.tipo === 'entrata' ? 'Ricevuta da ' : 'Ha pagato ') + nomeP(m.pagato_da)} · ${data}`;
  let quota = '';
  if (IO && m.tipo !== 'trasferimento') { const e = Conti.effetti(m)[IO] || 0; if (e) quota = `<small class="${e > 0 ? 'tu' : 'altri'}">${e > 0 ? 'ti devono ' : 'devi '}${eur(Math.abs(e))}</small>`; }
  return `<button type="button" class="mov" data-m="${m.id}"><span class="mi ${tu ? 'tu' : 'altri'}"><span class="emo-i" aria-hidden="true">${EMO.mov(m, contoDi(m.conto_id))}</span></span><span class="mt"><b>${esc(m.titolo)}</b><small>${esc(meta)}${m.ha_foto ? ' · scontrino' : ''}</small></span><span class="ma"><b class="num">${eur(Conti.inValutaGruppo(m))}</b>${quota}</span></button>`;
}
async function ricordaConto() {
  const s = Conti.saldi(D.movimenti, D.partecipanti), mio = IO ? (s[IO] || 0) : 0;
  if (mio <= 0) { vistaConti = 'saldi'; return renderConti(); }
  const verso = Conti.rimborsi(s).filter(r => r.a === IO);
  const b = $('ricorda'); if (b) { b.disabled = true; b.textContent = 'Invio…'; }
  // Prima la notifica sul telefono di chi deve; a chi non ha l'app (o le notifiche spente) si manda un messaggio
  const senza = [];
  for (const r of verso) {
    const n = await avvisaGruppo('Promemoria conti', `${CHI} ti ricorda che nei conti di ${G.nome} gli devi ${eur(r.importo)}.`, { tipo: 'conti', scheda: 'conti', a: [r.da] });
    if (!n) senza.push(r);
  }
  renderConti();
  const ok = verso.filter(r => !senza.includes(r));
  if (ok.length) toast('Promemoria inviato a ' + ok.map(r => nomeP(r.da)).join(', ') + ' ✓');
  if (!senza.length) return;
  const testo = senza.map(r => `${nomeP(r.da)}, nei conti di ${G.nome} su ${NOME_APP} mi devi ${eur(r.importo)}. Quando puoi, saldiamo?`).join('\n');
  const chi = senza.map(r => nomeP(r.da)).join(', ');
  foglio(`<h2>Ricordaglielo</h2><p class="q" style="line-height:1.5;margin:4px 0 10px">${esc(chi)} non riceve le notifiche di ${NOME_APP} (non usa l'app o le ha spente). Mandagli questo messaggio:</p><textarea id="rcT" rows="4" readonly>${esc(testo)}</textarea>
    <button class="btn" id="rcCond" type="button" style="margin-top:10px">${ic('condividi', 18, 2)}Invia il messaggio</button><button class="btn ghost" id="rcCopia" type="button">Copia</button>`);
  $('rcCond').onclick = async () => { if (navigator.share) { try { await navigator.share({ title: NOME_APP, text: testo }); chiudi(); return; } catch (e) { if (e.name === 'AbortError') return; } } $('rcCopia').click(); };
  $('rcCopia').onclick = async () => { try { await navigator.clipboard.writeText(testo); toast('Messaggio copiato ✓'); chiudi(); } catch (e) { $('rcT').select(); toast('Seleziona e copia il messaggio'); } };
}

function chipsConti() {
  let h = '<div class="chips conti-chips" role="tablist" aria-label="Conto">' +
    `<button type="button" role="tab" class="chip ${!filtroConto ? 'on' : ''}" data-fc="" aria-selected="${!filtroConto}">Tutti i conti</button>` +
    D.conti.map(c => `<button type="button" role="tab" class="chip ${filtroConto === c.id ? 'on' : ''}" data-fc="${c.id}" aria-selected="${filtroConto === c.id}" style="padding-left:10px"><span class="emo" aria-hidden="true">${EMO.conto(c)}</span>${esc(c.nome)}</button>`).join('') +
    `<button type="button" class="chip solo" data-gc="nuovo" aria-label="Nuovo conto">${ic('piu', 16, 2.2)}</button></div>`;
  const c = contoDi(filtroConto);
  if (c) {
    h += `<div class="chips" aria-label="Voci di ${esc(c.nome)}">` + (c.voci || []).map(v => { const [i, t] = iconaVoce(v, c.tipo); return `<button type="button" class="chip ${filtroVoce === v ? 'on' : ''}" data-fv="${esc(v)}" style="padding-left:6px;min-height:36px;font-size:13px"><span class="tile" style="width:26px;height:26px;border-radius:8px;background:${t[0]};color:${t[1]}">${ic(i, 14)}</span>${esc(v)}</button>`; }).join('') +
      `<button type="button" class="chip solo" data-gc="${c.id}" style="min-height:36px;font-size:13px">${ic('matita', 14)}${c.tipo === 'viaggio' ? 'Aggiungi viaggio' : 'Modifica'}</button></div>`;
  }
  return h;
}

function vistaSpese(s) {
  const q = cercaConti.trim().toLowerCase();
  const lista = D.movimenti.filter(m => (!filtroConto || m.conto_id === filtroConto) && (!filtroVoce || m.categoria === filtroVoce) &&
    (!q || (m.titolo + ' ' + (m.nota || '') + ' ' + nomeP(m.pagato_da) + ' ' + etichettaConto(m)).toLowerCase().includes(q)));
  let h = chipsConti() + `<input id="cerca" type="search" placeholder="Cerca tra le spese" aria-label="Cerca tra le spese" style="margin:0">`;
  if (filtroConto) {
    const tot = lista.filter(m => m.tipo !== 'trasferimento').reduce((t, m) => t + (m.tipo === 'entrata' ? -1 : 1) * Conti.inValutaGruppo(m), 0);
    h += `<p class="q" style="margin:6px 4px 0">Totale ${esc(contoDi(filtroConto).nome)}${filtroVoce ? ' · ' + esc(filtroVoce) : ''}: <b class="num" style="color:var(--tx)">${eur(tot)}</b></p>`;
  }
  let corpo;
  if (!D.movimenti.length) corpo = `<div class="vuoto">${ic('portafoglio', 32)}Nessuna spesa ancora.<br>Tocca "Nuova spesa" per aggiungere la prima: chi ha pagato, quanto e per chi.</div>`;
  else if (!lista.length) corpo = '<div class="vuoto">Nessuna spesa trovata.</div>';
  else {
    const perData = {}; lista.forEach(m => { (perData[m.data] = perData[m.data] || []).push(m); });
    corpo = '<div class="solo-tel" style="display:flex;flex-direction:column;gap:12px">' + Object.keys(perData).sort().reverse().map(d => `<h2 class="sez" style="margin:4px 0 0">${esc(dataLunga(d))}</h2><div class="lista">` + perData[d].map(m => {
      const T = Conti.inValutaGruppo(m); let mia = '';
      if (IO && m.tipo !== 'trasferimento') { const e = Conti.effetti(m)[IO] || 0; if (e) mia = `<span class="num ${e > 0 ? 'pos' : 'neg'}">${e > 0 ? 'ti devono ' : 'devi '}${eur(Math.abs(e))}</span>`; }
      return `<button class="mv" type="button" data-m="${m.id}">${tileMov(m)}<span class="tt"><b>${esc(m.titolo)}</b><span class="by">${descrMov(m)}${!filtroConto && m.conto_id ? ' · ' + esc(contoDi(m.conto_id)?.nome || '') : ''}${m.ha_foto ? ' · scontrino' : ''}</span></span><span class="am"><b class="num ${m.tipo === 'entrata' ? 'pos' : ''}">${eur(T)}</b>${m.valuta !== VG() ? `<span class="by num">${Conti.soldi(m.importo, m.valuta)}</span>` : mia}</span></button>`;
    }).join('') + '</div>').join('') + '</div>';
    corpo += `<div class="solo-pc"><div class="due"><section class="card princ"><div class="tabella"><table><thead><tr><th>Data</th><th>Descrizione</th><th>Conto</th><th>Pagata da</th><th style="text-align:right">Importo</th><th style="text-align:right">Per te</th></tr></thead><tbody class="num">` +
      lista.map(m => { const e = IO && m.tipo !== 'trasferimento' ? (Conti.effetti(m)[IO] || 0) : 0;
        return `<tr data-m="${m.id}" tabindex="0"><td class="q">${new Date(m.data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</td><td><div style="display:flex;align-items:center;gap:10px">${tileMov(m, 30)}<b>${esc(m.titolo)}</b></div></td><td class="q">${esc(m.tipo === 'trasferimento' ? 'Rimborso' : etichettaConto(m))}</td><td>${esc(m.tipo === 'trasferimento' ? nomeTu(m.pagato_da) + ' → ' + nomeTu(Object.keys(m.divisione.parti)[0]) : nomeTu(m.pagato_da))}</td><td style="text-align:right;font-weight:700">${eur(Conti.inValutaGruppo(m))}</td><td style="text-align:right;font-weight:700" class="${e > 0 ? 'pos' : e < 0 ? 'neg' : 'q'}">${e ? (e > 0 ? '+' : '−') + eur(Math.abs(e)) : '—'}</td></tr>`; }).join('') +
      `</tbody></table></div></section><aside class="lato">${bloccoSaldi(s, true)}</aside></div></div>`;
  }
  return h + corpo;
}

function bloccoSaldi(s, compatto) {
  const max = Math.max(1, ...Object.values(s).map(Math.abs));
  let h = `<h2 class="sez">Saldi</h2><div class="lista">` + D.partecipanti.map((p, i) => {
    const v = s[p.id] || 0, w = Math.abs(v) / max * 50;
    return `<div class="bal">${compatto ? '' : avatar(p, i)}<span class="nmb"><b style="font-size:15px">${esc(p.nome)}${p.id === IO ? ' <span class="by">(tu)</span>' : ''}</b><b class="num ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'q'}" style="font-size:13px">${v > 0 ? '+' : v < 0 ? '−' : ''}${eur(Math.abs(v))}</b></span>
      <span class="track" aria-hidden="true"><span class="mid"></span><i style="${v >= 0 ? `left:50%;width:${w}%;background:var(--acc)` : `right:50%;width:${w}%;background:var(--neg)`}"></i></span></div>`;
  }).join('') + '</div>';
  const r = Conti.rimborsi(s);
  h += `<h2 class="sez">Come pareggiare${r.length ? ' · ' + r.length + (r.length === 1 ? ' rimborso' : ' rimborsi') : ''}</h2><div class="lista">` + (r.length ? r.map(x => `<div class="it"><span style="flex:1;min-width:0;font-size:14px;line-height:1.4"><b>${esc(nomeTu(x.da) === 'te' ? 'Tu' : nomeP(x.da))}</b> ${x.da === IO ? 'dai' : 'dà'} <b class="num">${eur(x.importo)}</b> a <b>${esc(nomeTu(x.a))}</b></span><button type="button" class="piccolo" data-rimb='${esc(JSON.stringify(x))}'>Segna rimborsato</button></div>`).join('')
    : `<div class="vuoto" style="padding:18px">Siete in pari.</div>`) + '</div>';
  return h;
}

function vistaSaldi(s) {
  return bloccoSaldi(s, false) +
    `<h2 class="sez">Persone del gruppo</h2><div class="lista">` + D.partecipanti.map((p, i) => `<div class="it">${avatar(p, i)}<span style="flex:1;min-width:0"><b>${esc(p.nome)}</b>${p.id === IO ? ' <span class="by">(tu)</span>' : p.user_id ? ' <span class="by">· usa l\'app</span>' : ' <span class="by">· senza app</span>'}</span><button class="link" type="button" data-pe="${p.id}">Modifica</button></div>`).join('') +
    `</div><div class="card"><p class="q" style="margin:0 0 8px;line-height:1.45">Puoi aggiungere anche chi non usa l'app, come un nonno o un coinquilino che paga in contanti.</p><div class="agg"><input id="pNome" placeholder="Nome della persona" aria-label="Nome della persona"><button id="pAdd" type="button" aria-label="Aggiungi persona">${ic('piu', 20, 2.2)}</button></div></div>
    ${IO ? '' : '<button class="btn" id="chiP" type="button">Indica chi sei nel gruppo</button>'}
    <button class="btn bordo" id="csv" type="button">${ic('scarica', 18)}Esporta per Excel</button>`;
}

// ---------- Torta: dove si spende di più ----------
let statPeriodo = 'tutto';
const COLORI_TORTA = ['#1E7A4C', '#E8833A', '#3B82C4', '#C2417B', '#8B5CF6', '#D4A20F', '#0E9AA7', '#E5484D', '#6B8E23', '#A0522D', '#5B6B8C', '#F06BAA', '#2F9E8F', '#9AA8A0'];
// la voce scelta nella spesa, altrimenti si capisce dal titolo (bollette, ristoranti, trasporti…)
function categoriaTorta(m) {
  if (m.categoria) return m.categoria.trim().replace(/^./, c => c.toUpperCase());
  const nomi = { carrello: 'Spesa alimentare', fulmine: 'Bollette e utenze', chiave: 'Affitto e mutuo', attrezzi: 'Casa e manutenzione', piano: 'Ristoranti e bar', benzina: 'Auto e carburante', aereo: 'Viaggi e trasporti', letto: 'Alloggi', regalo: 'Regali', cuore: 'Salute', festa: 'Svago', borsa: 'Shopping' };
  const [i] = iconaVoce(m.titolo, null); return nomi[i] || 'Altro';
}
function datiTorta() {
  const da = statPeriodo === 'mese' ? oggiISO().slice(0, 7) + '-01' : statPeriodo === 'anno' ? isoDi(new Date(Date.now() - 365 * 864e5)) : '';
  const per = {};
  D.movimenti.filter(m => m.tipo === 'spesa' && (!da || m.data >= da)).forEach(m => { const c = categoriaTorta(m); per[c] = (per[c] || { v: 0, n: 0, es: m }); per[c].v += Conti.inValutaGruppo(m); per[c].n++; });
  const l = Object.entries(per).map(([nome, x]) => ({ nome, v: x.v, n: x.n, emo: EMO.per(nome) || EMO.mov(x.es, contoDi(x.es.conto_id)) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  // oltre 11 fette, il resto finisce in "Altro"
  if (l.length > 12) { const resto = l.splice(11); const a = l.find(x => x.nome === 'Altro') || (l.push({ nome: 'Altro', v: 0, n: 0, emo: '📦' }), l[l.length - 1]); resto.forEach(x => { a.v += x.v; a.n += x.n; }); l.sort((a, b) => b.v - a.v); }
  l.forEach((x, i) => { x.colore = COLORI_TORTA[i % COLORI_TORTA.length]; });
  return l;
}
function svgTorta(l, tot) {
  const R = 100, C = 110; let a0 = -Math.PI / 2;
  if (l.length === 1) return `<svg viewBox="0 0 220 220" class="torta" role="img" aria-label="${esc(l[0].nome)} 100%"><circle cx="${C}" cy="${C}" r="${R}" fill="${l[0].colore}"/></svg>`;
  const fette = l.map(x => {
    const a1 = a0 + x.v / tot * Math.PI * 2, grande = a1 - a0 > Math.PI ? 1 : 0;
    const p = `M${C},${C} L${(C + R * Math.cos(a0)).toFixed(2)},${(C + R * Math.sin(a0)).toFixed(2)} A${R},${R} 0 ${grande} 1 ${(C + R * Math.cos(a1)).toFixed(2)},${(C + R * Math.sin(a1)).toFixed(2)} Z`;
    a0 = a1; return `<path d="${p}" fill="${x.colore}"><title>${esc(x.nome)}</title></path>`;
  });
  return `<svg viewBox="0 0 220 220" class="torta" role="img" aria-label="Spese per categoria">${fette.join('')}</svg>`;
}
function htmlTorta() {
  const l = datiTorta(), tot = l.reduce((t, x) => t + x.v, 0);
  const pct = v => { const p = v / tot * 100; return (p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1).replace('.', ',')) + '%'; };
  return `<section class="card torta-c" aria-labelledby="ttT"><div class="sez-riga"><h2 class="sez" id="ttT">Dove si spende di più</h2></div>
    <div class="chips" style="margin:0 -2px">${[['mese', 'Questo mese'], ['anno', 'Ultimi 12 mesi'], ['tutto', 'Tutto']].map(([k, n]) => `<button type="button" class="chip ${statPeriodo === k ? 'on' : ''}" data-tper="${k}" aria-pressed="${statPeriodo === k}" style="padding:0 14px">${n}</button>`).join('')}</div>
    ${l.length ? `<div class="torta-w">${svgTorta(l, tot)}<div class="torta-tot"><small>Totale spese</small><b class="num">${eur(tot)}</b></div></div>
    <div class="torta-l">${l.map(x => `<div class="tl"><i style="background:${x.colore}"></i><span class="tl-n">${x.emo ? `<span class="emo" aria-hidden="true">${x.emo}</span>` : ''}${esc(x.nome)}<small>${x.n} ${x.n === 1 ? 'spesa' : 'spese'}</small></span><span class="tl-v"><b class="num">${pct(x.v)}</b><small class="num">${eur(x.v)}</small></span><span class="tl-bar"><em style="width:${(x.v / l[0].v * 100).toFixed(1)}%;background:${x.colore}"></em></span></div>`).join('')}</div>`
    : '<p class="q" style="margin:4px 0">Nessuna spesa in questo periodo.</p>'}</section>`;
}
function vistaStat(st) {
  if (!D.movimenti.length) return `<div class="vuoto">${ic('portafoglio', 32)}Le statistiche compaiono dopo la prima spesa.</div>`;
  let h = htmlTorta() + `<div class="kpi" style="margin-top:12px"><div><small>La tua spesa personale</small><b class="num">${IO ? eur(st.mio) : '—'}</b></div><div><small>Pagato da te</small><b class="num">${IO ? eur(st.pagatoDaMe) : '—'}</b></div></div>`;
  const conti = Object.entries(st.perConto).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), maxc = Math.max(1, ...conti.map(c => c[1]));
  h += '<h2 class="sez">Per conto</h2><div class="card">' + conti.map(([k, v]) => {
    const c = contoDi(k), voci = Object.entries(st.perVoce).filter(([kk, vv]) => kk.startsWith(k + '|') && vv > 0).sort((a, b) => b[1] - a[1]);
    return `<div style="padding:8px 0"><div class="riga"><span class="grow" style="display:flex;align-items:center;gap:8px;font-weight:700"><span class="emo" aria-hidden="true">${c ? EMO.conto(c) : '📁'}</span>${esc(c ? c.nome : 'Senza conto')}</span><b class="num">${eur(v)}</b><span class="by num" style="width:42px;text-align:right">${Math.round(v / Math.max(1, st.totale) * 100)}%</span></div><div class="bar" style="margin-top:6px"><i style="width:${v / maxc * 100}%"></i></div>
      ${voci.length > 1 || (voci[0] && voci[0][0] !== k + '|Senza voce') ? `<div style="padding:6px 0 0 26px;display:flex;flex-direction:column;gap:2px">${voci.map(([kk, vv]) => `<div class="riga q" style="font-size:13px"><span class="grow">${esc(kk.split('|')[1])}</span><span class="num">${eur(vv)}</span></div>`).join('')}</div>` : ''}</div>`;
  }).join('') + '</div>';
  const mesi = Object.entries(st.perMese).sort((a, b) => b[0].localeCompare(a[0])), maxm = Math.max(1, ...mesi.map(m => Math.abs(m[1])));
  h += '<h2 class="sez">Per mese</h2><div class="card">' + mesi.map(([k, v]) => {
    const nome = new Date(k + '-15T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return `<div style="padding:8px 0"><div class="riga"><span class="grow" style="text-transform:capitalize;font-weight:600">${esc(nome)}</span><b class="num">${eur(v)}</b></div><div class="bar" style="margin-top:6px"><i style="width:${Math.abs(v) / maxm * 100}%"></i></div></div>`;
  }).join('') + '</div>';
  const pagati = D.partecipanti.map((p, i) => [p, i, D.movimenti.filter(m => m.tipo === 'spesa' && m.pagato_da === p.id).reduce((t, m) => t + Conti.inValutaGruppo(m), 0)]).sort((a, b) => b[2] - a[2]);
  const maxp = Math.max(1, ...pagati.map(x => x[2]));
  h += '<h2 class="sez">Chi ha pagato di più</h2><div class="card">' + pagati.map(([p, i, v]) => `<div style="padding:8px 0"><div class="riga">${avatar(p, i, 'p')}<span class="grow" style="font-weight:600">${esc(p.nome)}</span><b class="num">${eur(v)}</b></div><div class="bar" style="margin-top:6px"><i style="width:${v / maxp * 100}%"></i></div></div>`).join('') + '</div><div style="height:12px"></div>';
  return h;
}

// ---------- Gestione dei conti (Casa, Viaggi, Extra…) ----------
function gestisciConto(id) {
  const nuovo = id === 'nuovo', c = nuovo ? { id: uuid(), nome: '', tipo: 'altro', voci: [] } : JSON.parse(JSON.stringify(contoDi(id)));
  let emo;
  const disegna = () => {
    $('pop').querySelector('.sheet').innerHTML = `<div class="grab"></div><button class="close" type="button" aria-label="Chiudi" id="ovX">${ic('x', 18)}</button>
      <h2>${nuovo ? 'Nuovo conto' : esc(c.nome)}</h2><p class="q" style="line-height:1.5;margin-top:0">Ogni conto raccoglie le sue spese, ma il saldo tra le persone resta uno solo per tutto il gruppo.</p>
      <label class="lb" for="cN">Nome</label><div class="riga" style="gap:8px"><button type="button" class="emo-b" id="cEm" aria-label="Cambia emoji">${emo !== undefined ? (emo.e || EMO.conto({ nome: c.nome, tipo: c.tipo })) : EMO.conto(c)}</button><input id="cN" value="${esc(c.nome)}" placeholder="es. Casa, Viaggi, Auto, Bambini" style="flex:1;min-width:0"></div>
      <label class="lb" for="cT">Tipo</label><select id="cT">${[['casa', 'Casa'], ['viaggio', 'Viaggi'], ['extra', 'Extra'], ['altro', 'Altro']].map(([k, n]) => `<option value="${k}" ${c.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="lb">${c.tipo === 'viaggio' ? 'Viaggi' : 'Voci'}</label>
      <div class="lista">${(c.voci || []).map((v, i) => { const [ii, t] = iconaVoce(v, c.tipo); return `<div class="it"><span class="tile" style="width:30px;height:30px;border-radius:9px;background:${t[0]};color:${t[1]}">${ic(ii, 16)}</span><span style="flex:1;font-weight:600">${esc(v)}</span><button type="button" class="del" data-tv="${i}" aria-label="Togli ${esc(v)}">${ic('x', 16)}</button></div>`; }).join('') || `<p class="q" style="padding:12px 0;margin:0">${c.tipo === 'viaggio' ? 'Aggiungi ogni viaggio, per esempio "Parigi 2026".' : 'Nessuna voce.'}</p>`}</div>
      <div class="agg"><input id="cV" placeholder="${c.tipo === 'viaggio' ? 'Nuovo viaggio, es. Parigi 2026' : 'Nuova voce, es. Utenze'}"><button type="button" id="cVa" aria-label="Aggiungi voce">${ic('piu', 20, 2.2)}</button></div>
      <button class="btn" type="button" id="cS" style="margin-top:14px">Salva</button>
      ${nuovo ? '' : '<button class="btn danger" type="button" id="cE">Elimina conto</button><p class="by" style="margin-top:8px">Si può eliminare solo un conto senza spese.</p>'}`;
    $('ovX').onclick = chiudi;
    const leggi = () => { c.nome = $('cN').value; c.tipo = $('cT').value; };
    $('cT').onchange = () => { leggi(); disegna(); };
    $('cEm').onclick = () => { leggi(); scegliEmoji({ testo: c.nome, chiave: 'c:' + c.id, auto: EMO.luogo(c.nome) || EMO.di(c.nome) || '📁', scelta: (e) => { foglio(''); emo = { e }; disegna(); } }); };
    foglioQ('[data-tv]').forEach(b => b.onclick = () => { leggi(); c.voci.splice(+b.dataset.tv, 1); disegna(); });
    const aggV = () => { leggi(); const v = $('cV').value.trim(); if (!v) return; if (!c.voci.includes(v)) c.voci.push(v); disegna(); $('cV').focus(); };
    $('cVa').onclick = aggV; $('cV').onkeydown = e => { if (e.key === 'Enter') aggV(); };
    $('cS').onclick = async () => {
      leggi(); const pend = $('cV').value.trim(); if (pend && !c.voci.includes(pend)) c.voci.push(pend);
      if (!c.nome.trim()) return toast('Dai un nome al conto');
      chiudi();
      if (nuovo) {
        const r = { id: c.id, gruppo_id: G.id, nome: c.nome.trim(), tipo: c.tipo, voci: c.voci, ordine: D.conti.length + 1, created_at: new Date().toISOString() };
        D.conti.push(r); filtroConto = r.id; renderConti();
        if (await scrivi(() => ST.ins('conti', r))) toast('Conto creato ✓');
      } else {
        const r = contoDi(id); Object.assign(r, { nome: c.nome.trim(), tipo: c.tipo, voci: c.voci }); renderConti();
        if (await scrivi(() => ST.upd('conti', id, { nome: r.nome, tipo: r.tipo, voci: r.voci }))) toast('Salvato ✓');
      }
      if (emo !== undefined) salvaEmoji('c:' + c.id, emo.e);
    };
    if ($('cE')) $('cE').onclick = () => {
      if (D.movimenti.some(m => m.conto_id === id)) return toast('Questo conto ha delle spese: spostale o eliminale prima');
      conferma('Eliminare il conto?', `"${c.nome}" verrà tolto per tutti.`, 'Elimina', async () => {
        D.conti = D.conti.filter(x => x.id !== id); filtroConto = ''; renderConti();
        await scrivi(() => ST.del('conti', id));
      }, true);
    };
  };
  foglio(''); disegna();
}

// ---------- Nuova spesa / modifica ----------
function formMovimento(m, preset) {
  if (!D.partecipanti.length) return toast('Aggiungi prima almeno una persona nei Saldi');
  const nuovo = !m, pp = D.partecipanti;
  const f = m ? JSON.parse(JSON.stringify(m)) : Object.assign({ tipo: 'spesa', titolo: '', importo: 0, valuta: VG(), cambio: 1, data: oggiISO(), conto_id: D.conti[0]?.id || null, categoria: '', pagato_da: IO || pp[0].id, divisione: { modo: 'uguale', parti: Object.fromEntries(pp.map(p => [p.id, 1])) }, nota: '' }, preset || {});
  let foto = undefined; // undefined = invariata, null = tolta, stringa = nuova
  const mid = m ? m.id : uuid(); let emo; // emoji scelta a mano: undefined = invariata
  const disegna = () => {
    const t = f.tipo, tr = t === 'trasferimento', modo = f.divisione.modo, parti = f.divisione.parti, conto = contoDi(f.conto_id);
    const opzP = sel => pp.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.id === IO ? 'Te (' + p.nome + ')' : p.nome)}</option>`).join('');
    const dest = tr ? (Object.keys(parti)[0] || pp.find(p => p.id !== f.pagato_da)?.id || pp[0].id) : null;
    const voci = conto ? (conto.voci || []) : [];
    const importoTesto = f.importo ? (f.importo / 100).toFixed(2).replace('.', ',') : '';
    $('pop').querySelector('.sheet').innerHTML = `<div class="grab"></div>
      <div class="testa-foglio"><button type="button" id="mX">Annulla</button><h2>${nuovo ? 'Nuova' : 'Modifica'} ${tr ? 'rimborso' : t === 'entrata' ? 'entrata' : 'spesa'}</h2><button type="button" class="forte" id="mS2">Salva</button></div>
      <div class="importo"><label for="mI" class="by" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Importo</label><input id="mI" inputmode="decimal" value="${importoTesto}" placeholder="0,00"><select id="mV" aria-label="Valuta">${Conti.VALUTE.concat(Conti.VALUTE.includes(f.valuta) ? [] : [f.valuta]).map(v => `<option ${v === f.valuta ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      ${f.valuta !== VG() ? `<div class="card" style="padding:10px 14px"><label class="lb" for="mC" style="margin:0">Cambio: 1 ${esc(f.valuta)} = ? ${VG()}</label><div class="riga"><input class="grow" id="mC" inputmode="decimal" value="${String(f.cambio).replace('.', ',')}"><button class="piccolo" type="button" id="mCa">Aggiorna</button></div><span class="by num" id="mConv"></span></div>` : ''}
      <div class="seg" role="tablist" aria-label="Tipo">${[['spesa', 'Spesa'], ['entrata', 'Entrata'], ['trasferimento', 'Rimborso']].map(([k, n]) => `<button type="button" role="tab" data-tipo="${k}" class="${t === k ? 'on' : ''}" aria-selected="${t === k}">${n}</button>`).join('')}</div>
      <div class="lista campi" style="margin-top:10px">
        <div class="it"><label for="mT">Titolo</label><button type="button" class="emo-b" id="mEm" aria-label="Cambia emoji">${emo !== undefined ? (emo.e || EMO.scegli(f.titolo) || '🧾') : EMO.mov({ ...f, id: mid }, contoDi(f.conto_id))}</button><input id="mT" value="${esc(f.titolo)}" placeholder="${tr ? 'Rimborso' : 'es. Cena, Bolletta luce, Volo'}"></div>
        <div class="it"><label for="mP">${tr ? 'Da' : t === 'entrata' ? 'Ricevuta da' : 'Pagata da'}</label><select id="mP">${opzP(f.pagato_da)}</select></div>
        ${tr ? `<div class="it"><label for="mA">A</label><select id="mA">${opzP(dest)}</select></div>` : ''}
        <div class="it"><label for="mD">Data</label><input id="mD" type="date" value="${esc(f.data)}"></div>
        ${tr ? '' : `<div class="it"><label for="mK">Conto</label><select id="mK"><option value="">Nessun conto</option>${D.conti.map(c => `<option value="${c.id}" ${c.id === f.conto_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
        <div class="it"><label for="mVo">${conto?.tipo === 'viaggio' ? 'Viaggio' : 'Voce'}</label><select id="mVo"><option value="">—</option>${voci.concat(f.categoria && !voci.includes(f.categoria) ? [f.categoria] : []).map(v => `<option ${v === f.categoria ? 'selected' : ''}>${esc(v)}</option>`).join('')}${conto ? `<option value="__nuova">+ ${conto.tipo === 'viaggio' ? 'Nuovo viaggio' : 'Nuova voce'}…</option>` : ''}</select></div>`}
      </div>
      ${tr ? '' : `<h2 class="sez" style="display:flex;justify-content:space-between"><span>Per chi</span></h2>
        <div class="seg" role="tablist" aria-label="Come dividere">${[['uguale', 'Uguale'], ['quote', 'Quote'], ['importi', 'Importi']].map(([k, n]) => `<button type="button" role="tab" data-modo="${k}" class="${modo === k ? 'on' : ''}" aria-selected="${modo === k}">${n}</button>`).join('')}</div>
        <div class="lista parts" style="margin-top:8px">${pp.map((p, i) => {
          const on = parti[p.id] !== undefined && Number(parti[p.id]) > 0;
          const campo = modo === 'quote' ? `<input type="number" min="0" step="1" data-q="${p.id}" value="${on ? parti[p.id] : 0}" aria-label="Quote di ${esc(p.nome)}">`
            : modo === 'importi' ? `<input inputmode="decimal" data-i="${p.id}" value="${on ? (parti[p.id] / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0,00" aria-label="Importo di ${esc(p.nome)}">` : '';
          return `<div class="pr"><button class="ck" type="button" data-on="${p.id}" style="${on ? 'background:var(--acc);border-color:var(--acc)' : ''}" aria-pressed="${on}" aria-label="${esc(p.nome)}">${on ? ic('spunta', 14, 3) : ''}</button>${avatar(p, i, 'p')}<span style="flex:1;font-weight:${on ? 700 : 500};color:${on ? 'var(--tx)' : 'var(--sub)'}">${esc(p.nome)}</span>${campo}<span class="num" data-quota="${p.id}" style="min-width:74px;text-align:right;font-weight:700;font-size:14px"></span></div>`;
        }).join('')}</div><div class="by" id="mRes" style="margin:6px 4px 0"></div>`}
      <label class="lb" for="mN">Nota</label><textarea id="mN" rows="2" placeholder="Facoltativa" style="background:var(--card)">${esc(f.nota || '')}</textarea>
      <div class="riga" style="margin-top:8px">${(foto || (foto === undefined && f.ha_foto)) ? `<button class="btn bordo grow" type="button" id="fV">${ic('scontrino', 18)}Vedi scontrino</button><button class="btn danger" type="button" id="fX" style="width:auto;margin:0">Togli</button>` : `<button class="btn bordo" type="button" id="fA" style="border-style:dashed">${ic('foto', 18)}Aggiungi la foto dello scontrino</button>`}</div>
      <button class="btn" type="button" id="mS" style="margin-top:14px">${nuovo ? (tr ? 'Registra rimborso' : t === 'entrata' ? 'Aggiungi entrata' : 'Aggiungi spesa') : 'Salva modifiche'}</button>
      ${nuovo ? '' : `<button class="btn danger" type="button" id="mE">${ic('cestino', 18)}Elimina</button><p class="by" style="margin-top:10px">Aggiunta da ${esc(m.creato_da || '?')}${m.modificato_da ? ', modificata da ' + esc(m.modificato_da) : ''}</p>`}`;
    collega();
  };
  const leggi = () => {
    f.titolo = $('mT').value; f.importo = Conti.centesimi($('mI').value) || 0; f.valuta = $('mV').value;
    if ($('mC')) { const c = parseFloat($('mC').value.replace(',', '.')); f.cambio = c > 0 ? c : 1; } else f.cambio = 1;
    f.pagato_da = $('mP').value; f.data = $('mD').value || oggiISO(); f.nota = $('mN').value;
    if ($('mK')) f.conto_id = $('mK').value || null;
    if ($('mVo') && $('mVo').value !== '__nuova') f.categoria = $('mVo').value;
    if ($('mA')) f.divisione = { modo: 'importi', parti: { [$('mA').value]: f.importo } };
    foglioQ('[data-q]').forEach(i => { f.divisione.parti[i.dataset.q] = Math.max(0, Math.round(Number(i.value) || 0)); });
    foglioQ('[data-i]').forEach(i => { const c = Conti.centesimi(i.value); f.divisione.parti[i.dataset.i] = c > 0 ? c : 0; });
  };
  const anteprimaQuote = () => {
    if (f.tipo === 'trasferimento') return;
    const q = Conti.quote(f);
    foglioQ('[data-quota]').forEach(s => { const v = q[s.dataset.quota]; s.textContent = v ? eur(v) : '—'; });
    if ($('mConv')) $('mConv').textContent = '= ' + eur(Conti.inValutaGruppo(f));
    const r = $('mRes'); if (!r) return;
    if (f.divisione.modo === 'importi') {
      const somma = Object.values(f.divisione.parti).reduce((a, b) => a + Number(b || 0), 0), diff = f.importo - somma;
      r.innerHTML = diff === 0 ? '<span class="pos" style="font-weight:700">Importi corretti</span>' : `<span class="neg" style="font-weight:700">${diff > 0 ? 'Mancano ' : 'Troppi '}${Conti.soldi(Math.abs(diff), f.valuta)}</span>`;
    } else r.textContent = '';
  };
  const collega = () => {
    $('mX').onclick = chiudi;
    $('mEm').onclick = () => { leggi(); scegliEmoji({ testo: f.titolo.trim(), chiave: 'm:' + mid, auto: EMO.scegli(f.titolo) || '🧾', scelta: (e, regola) => { foglio('', { senzaX: true }); emo = { e, regola }; disegna(); } }); };
    foglioQ('[data-tipo]').forEach(b => b.onclick = () => {
      leggi(); const prima = f.tipo; f.tipo = b.dataset.tipo;
      if (f.tipo === 'trasferimento') { f.divisione = { modo: 'importi', parti: { [pp.find(p => p.id !== f.pagato_da)?.id || pp[0].id]: f.importo } }; if (!f.titolo) f.titolo = 'Rimborso'; }
      else if (prima === 'trasferimento') { f.divisione = { modo: 'uguale', parti: Object.fromEntries(pp.map(p => [p.id, 1])) }; if (f.titolo === 'Rimborso') f.titolo = ''; }
      disegna();
    });
    foglioQ('[data-modo]').forEach(b => b.onclick = () => {
      leggi(); const nuovoModo = b.dataset.modo, scelti = pp.filter(p => Number(f.divisione.parti[p.id]) > 0).map(p => p.id);
      const base = scelti.length ? scelti : pp.map(p => p.id);
      f.divisione = { modo: nuovoModo, parti: nuovoModo === 'importi' ? Conti.ripartisci(f.importo, Object.fromEntries(base.map(k => [k, 1]))) : Object.fromEntries(base.map(k => [k, 1])) };
      disegna();
    });
    foglioQ('[data-on]').forEach(b => b.onclick = () => {
      leggi(); const k = b.dataset.on, parti = f.divisione.parti, on = Number(parti[k]) > 0;
      if (on) delete parti[k]; else parti[k] = 1;
      if (f.divisione.modo === 'importi') { const sel = Object.keys(parti).filter(x => Number(parti[x]) > 0); f.divisione.parti = Conti.ripartisci(f.importo, Object.fromEntries(sel.map(x => [x, 1]))); }
      disegna();
    });
    ['mI', 'mC'].forEach(id => { if ($(id)) $(id).oninput = () => { leggi(); anteprimaQuote(); }; });
    $('mV').onchange = async () => { leggi(); f.cambio = 1; if (f.valuta !== VG()) await prendiCambio(); disegna(); };
    if ($('mCa')) $('mCa').onclick = async () => { leggi(); await prendiCambio(); disegna(); };
    if ($('mK')) $('mK').onchange = () => { leggi(); const c = contoDi(f.conto_id); f.categoria = c && (c.voci || []).length === 1 ? c.voci[0] : ''; disegna(); };
    if ($('mVo')) $('mVo').onchange = () => {
      if ($('mVo').value !== '__nuova') return leggi();
      leggi(); const c = contoDi(f.conto_id), stato = JSON.parse(JSON.stringify(f));
      chiedi(c.tipo === 'viaggio' ? 'Nuovo viaggio' : 'Nuova voce', `Verrà aggiunta al conto ${c.nome} per tutti.`, '', 'Aggiungi', async v => {
        v = v.trim(); Object.assign(f, stato);
        if (v) { if (!c.voci.includes(v)) { c.voci.push(v); scrivi(() => ST.upd('conti', c.id, { voci: c.voci })); } f.categoria = v; }
        foglio(''); disegna();
      });
    };
    foglioQ('[data-q],[data-i]').forEach(i => i.oninput = () => { leggi(); anteprimaQuote(); });
    if ($('fA')) $('fA').onclick = () => { leggi(); const inp = $('foto'); inp.onchange = async e => { const fl = e.target.files[0]; e.target.value = ''; if (!fl) return; try { foto = await comprimiFoto(fl); disegna(); } catch (er) { toast(er.message); } }; inp.click(); };
    if ($('fX')) $('fX').onclick = () => { leggi(); foto = null; f.ha_foto = false; disegna(); };
    if ($('fV')) $('fV').onclick = async () => {
      const src = foto || await ST.foto(m.id).catch(() => null);
      if (!src) return toast('Foto non disponibile');
      const img = document.createElement('img'); img.src = src; img.className = 'thumb'; img.alt = 'Scontrino';
      $('fV').parentNode.replaceWith(img);
    };
    $('mS').onclick = salva; $('mS2').onclick = salva;
    if ($('mE')) $('mE').onclick = () => conferma('Eliminare questa voce?', `"${m.titolo}" verrà tolta dai conti di tutto il gruppo.`, 'Elimina', async () => {
      D.movimenti = D.movimenti.filter(x => x.id !== m.id); renderConti();
      if (await scrivi(() => ST.del('movimenti', m.id))) toast('Eliminata');
    }, true);
    anteprimaQuote();
  };
  const prendiCambio = async () => {
    const da = f.valuta, a = VG();
    try {
      let r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${da}&symbols=${a}`);
      if (!r.ok) r = await fetch(`https://api.frankfurter.app/latest?from=${da}&to=${a}`);
      const j = await r.json(); const v = j.rates && j.rates[a];
      if (!v) throw new Error();
      f.cambio = v; toast(`Cambio aggiornato: 1 ${da} = ${String(v).replace('.', ',')} ${a}`);
    } catch (e) { toast('Cambio non disponibile: inseriscilo a mano'); }
  };
  const salva = async () => {
    leggi();
    if (f.tipo === 'trasferimento' && !f.titolo.trim()) f.titolo = 'Rimborso';
    if (!f.titolo.trim()) return toast('Scrivi un titolo');
    if (!(f.importo > 0)) return toast('Inserisci un importo maggiore di zero');
    const parti = Object.fromEntries(Object.entries(f.divisione.parti).filter(([, v]) => Number(v) > 0));
    if (!Object.keys(parti).length) return toast('Scegli per chi è la spesa');
    if (f.tipo === 'trasferimento' && parti[f.pagato_da]) return toast('Scegli due persone diverse');
    if (f.divisione.modo === 'importi' && f.tipo !== 'trasferimento' && Object.values(parti).reduce((a, b) => a + b, 0) !== f.importo) return toast('La somma degli importi non corrisponde al totale');
    const tr = f.tipo === 'trasferimento';
    const riga = { gruppo_id: G.id, tipo: f.tipo, titolo: f.titolo.trim(), importo: f.importo, valuta: f.valuta, cambio: f.cambio, data: f.data, conto_id: tr ? null : f.conto_id, categoria: tr ? '' : (f.categoria || ''), pagato_da: f.pagato_da, divisione: { modo: f.divisione.modo, parti }, nota: f.nota.trim() };
    if (foto !== undefined) riga.foto = foto;
    chiudi();
    if (nuovo) {
      riga.id = mid; riga.creato_da = CHI;
      D.movimenti.unshift({ ...riga, ha_foto: !!foto, created_at: new Date().toISOString(), foto: undefined });
      renderConti();
      if (await scrivi(() => ST.ins('movimenti', riga))) {
        toast(tr ? 'Rimborso registrato ✓' : 'Aggiunta ✓');
        avvisaGruppo(tr ? 'Nuovo rimborso' : f.tipo === 'entrata' ? 'Nuova entrata' : 'Nuova spesa', `${CHI}: ${riga.titolo} · ${eur(Conti.inValutaGruppo(riga))}`);
      }
    } else {
      riga.modificato_da = CHI; delete riga.gruppo_id;
      const i = D.movimenti.findIndex(x => x.id === m.id);
      D.movimenti[i] = { ...D.movimenti[i], ...riga, ha_foto: foto === undefined ? m.ha_foto : !!foto, foto: undefined };
      renderConti(); if (await scrivi(() => ST.upd('movimenti', m.id, riga))) toast('Salvata ✓');
    }
    ordinaMov(D.movimenti); renderConti();
    if (emo !== undefined) salvaEmoji(emo.regola ? EMO.chiaveTesto(riga.titolo) : 'm:' + mid, emo.e);
  };
  foglio('', { senzaX: true });
  disegna();
}

function segnaRimborso(r) {
  conferma('Segnare come rimborsato?', `${nomeP(r.da)} ha dato ${eur(r.importo)} a ${nomeP(r.a)}. Verrà aggiunto un rimborso ai conti.`, 'Segna rimborsato', async () => {
    const riga = { id: uuid(), gruppo_id: G.id, tipo: 'trasferimento', titolo: 'Rimborso', importo: r.importo, valuta: VG(), cambio: 1, data: oggiISO(), conto_id: null, categoria: '', pagato_da: r.da, divisione: { modo: 'importi', parti: { [r.a]: r.importo } }, nota: '', creato_da: CHI };
    D.movimenti.unshift({ ...riga, created_at: new Date().toISOString() }); renderConti();
    if (await scrivi(() => ST.ins('movimenti', riga))) { toast('Rimborso registrato ✓'); avvisaGruppo('Nuovo rimborso', `${nomeP(r.da)} → ${nomeP(r.a)} · ${eur(r.importo)}`); }
  });
}
async function aggiungiPartecipante() {
  const n = $('pNome').value.trim(); if (!n) return;
  if (D.partecipanti.some(p => p.nome.toLowerCase() === n.toLowerCase())) return toast('C\'è già una persona con questo nome');
  const r = { id: uuid(), gruppo_id: G.id, nome: n, user_id: null, created_at: new Date().toISOString() };
  D.partecipanti.push(r); renderTutto();
  if (await scrivi(() => ST.ins('partecipanti', r))) toast(n + ' aggiunto ✓');
}
function modificaPartecipante(id) { opzioniMembro(id); }
function esportaCSV() {
  if (ANTEPRIMA) return toast('Nell\'app installata qui scarichi il file per Excel');
  const pp = D.partecipanti, n = c => (c / 100).toFixed(2).replace('.', ','), q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const righe = [['Data', 'Tipo', 'Titolo', 'Conto', 'Voce', 'Importo', 'Valuta', 'Cambio', 'Importo ' + VG(), 'Pagato da'].concat(pp.map(p => 'Saldo ' + p.nome)).concat(['Nota']).map(q).join(';')];
  D.movimenti.slice().reverse().forEach(m => {
    const e = Conti.effetti(m);
    righe.push([m.data, m.tipo === 'trasferimento' ? 'rimborso' : m.tipo, m.titolo, contoDi(m.conto_id)?.nome || '', m.categoria || '', n(m.importo), m.valuta, String(m.cambio).replace('.', ','), n(Conti.inValutaGruppo(m)), nomeP(m.pagato_da)].concat(pp.map(p => n(e[p.id] || 0))).concat([m.nota || '']).map(q).join(';'));
  });
  scarica(`tablemates-${G.nome.replace(/[^\w-]+/g, '_')}-${oggiISO()}.csv`, '﻿' + righe.join('\r\n'), 'text/csv;charset=utf-8');
}
