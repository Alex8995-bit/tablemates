// Scheda Conti (come Tricount): più conti (Casa, Viaggi, Extra…) con le loro voci, ma un unico saldo e uniche statistiche.
let vistaConti = LS.get('contiVista') || 'spese', cercaConti = '', filtroConto = LS.get('filtroConto') || '', filtroVoce = '';
const VG = () => (G && G.valuta) || 'EUR';
const eur = (c, v) => Conti.soldi(c, v || VG());
const contoDi = id => D.conti.find(c => c.id === id) || null;
const foglioQ = sel => $('pop').querySelectorAll(sel);
function tileMov(m, dim = 40) {
  let nome, t;
  if (m.tipo === 'trasferimento') { nome = 'scambio'; t = TONI.grigio; }
  else if (m.tipo === 'entrata') { nome = 'entrata'; t = TONI.verde; }
  else { const c = contoDi(m.conto_id); [nome, t] = iconaVoce(m.categoria, c?.tipo); }
  return `<span class="tile" style="width:${dim}px;height:${dim}px;background:${t[0]};color:${t[1]}">${ic(nome, Math.round(dim / 2))}</span>`;
}
const descrMov = m => m.tipo === 'trasferimento' ? `${esc(nomeTu(m.pagato_da))} → ${esc(nomeTu(Object.keys(m.divisione.parti)[0]))}` : (m.tipo === 'entrata' ? 'ricevuta da ' : 'pagata da ') + esc(nomeTu(m.pagato_da));
const nomeTu = id => id === IO ? 'te' : nomeP(id);
const etichettaConto = m => { const c = contoDi(m.conto_id); return c ? c.nome + (m.categoria ? ' · ' + m.categoria : '') : (m.categoria || ''); };

function renderConti() {
  const el = $('t-conti');
  if (!G) { el.innerHTML = '<div class="testa"><h1>Conti</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  if (filtroConto && !contoDi(filtroConto)) filtroConto = '';
  const s = Conti.saldi(D.movimenti, D.partecipanti), st = Conti.statistiche(D.movimenti, IO), mio = IO ? (s[IO] || 0) : 0;
  const daPareggiare = Conti.rimborsi(s).length;
  let h = `<div class="testa con-azioni"><div style="display:flex;flex-direction:column;gap:2px"><p>${esc(G.nome)} · ${D.partecipanti.length} ${D.partecipanti.length === 1 ? 'persona' : 'persone'} · ${VG()}</p><h1>Conti</h1></div>
    <div class="azioni-pc"><button class="btn bordo" type="button" id="csvPc">${ic('scarica', 17)}Esporta per Excel</button><button class="btn" type="button" id="fabPc">${ic('piu', 17, 2.4)}Nuova spesa</button></div></div>`;
  h += `<section class="riepilogo" aria-label="Riepilogo di tutti i conti"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div style="display:flex;flex-direction:column;gap:4px"><small>${!IO ? 'Il tuo saldo' : mio > 0 ? 'Ti devono' : mio < 0 ? 'Devi' : 'Sei in pari'}</small>
      <span class="grande num" style="color:${mio > 0 ? 'var(--ink-pos)' : mio < 0 ? 'var(--ink-neg)' : 'var(--ink-tx)'}">${IO ? (mio > 0 ? '+' : mio < 0 ? '−' : '') + eur(Math.abs(mio)) : '—'}</span></div>
      ${daPareggiare ? `<button type="button" class="piccolo" data-v="saldi">Pareggia${ic('destra', 14, 2.2)}</button>` : ''}</div>
      <div style="display:flex;gap:10px"><div class="box"><small>Spese di tutti i conti</small><b class="num">${eur(st.totale)}</b></div><div class="box"><small>La tua parte</small><b class="num">${IO ? eur(st.mio) : '—'}</b></div></div></section>`;
  h += `<div class="seg" role="tablist" aria-label="Vista">${[['spese', 'Spese'], ['saldi', 'Saldi'], ['stat', 'Statistiche']].map(([k, n]) => `<button type="button" role="tab" data-v="${k}" class="${vistaConti === k ? 'on' : ''}" aria-selected="${vistaConti === k}">${n}</button>`).join('')}</div>`;
  if (vistaConti === 'spese') h += vistaSpese(s);
  else if (vistaConti === 'saldi') h += vistaSaldi(s);
  else h += vistaStat(st);
  h += `<button class="fab" id="fab" type="button">${ic('piu', 20, 2.4)}Nuova spesa</button><div style="height:80px"></div>`;
  el.innerHTML = h;
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { vistaConti = b.dataset.v; LS.set('contiVista', vistaConti); renderConti(); });
  el.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { filtroConto = b.dataset.fc; filtroVoce = ''; LS.set('filtroConto', filtroConto); renderConti(); });
  el.querySelectorAll('[data-fv]').forEach(b => b.onclick = () => { filtroVoce = filtroVoce === b.dataset.fv ? '' : b.dataset.fv; renderConti(); });
  $('fab').onclick = $('fabPc').onclick = () => formMovimento(null, filtroConto ? { conto_id: filtroConto, categoria: filtroVoce } : {});
  $('csvPc').onclick = esportaCSV;
  el.querySelectorAll('tr[data-m]').forEach(r => r.onkeydown = e => { if (e.key === 'Enter') r.click(); });
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => formMovimento(D.movimenti.find(m => m.id === b.dataset.m)));
  if ($('cerca')) { $('cerca').value = cercaConti; $('cerca').oninput = e => { cercaConti = e.target.value; const p = e.target.selectionStart; renderConti(); $('cerca').focus(); $('cerca').setSelectionRange(p, p); }; }
  el.querySelectorAll('[data-rimb]').forEach(b => b.onclick = () => segnaRimborso(JSON.parse(b.dataset.rimb)));
  el.querySelectorAll('[data-pe]').forEach(b => b.onclick = () => modificaPartecipante(b.dataset.pe));
  if ($('pAdd')) { $('pAdd').onclick = aggiungiPartecipante; $('pNome').onkeydown = e => { if (e.key === 'Enter') aggiungiPartecipante(); }; }
  if ($('csv')) $('csv').onclick = esportaCSV;
  if ($('chiP')) $('chiP').onclick = scegliPartecipante;
  el.querySelectorAll('[data-gc]').forEach(b => b.onclick = () => gestisciConto(b.dataset.gc));
}

function chipsConti() {
  let h = '<div class="chips conti-chips" role="tablist" aria-label="Conto">' +
    `<button type="button" role="tab" class="chip ${!filtroConto ? 'on' : ''}" data-fc="" aria-selected="${!filtroConto}">Tutti i conti</button>` +
    D.conti.map(c => `<button type="button" role="tab" class="chip ${filtroConto === c.id ? 'on' : ''}" data-fc="${c.id}" aria-selected="${filtroConto === c.id}" style="padding-left:10px">${ic(ICONA_CONTO[c.tipo] || 'cartella', 16)}${esc(c.nome)}</button>`).join('') +
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
  let h = chipsConti() + `<input id="cerca" class="campo-pag" type="search" placeholder="Cerca tra le spese" aria-label="Cerca tra le spese" style="margin:2px 0 4px">`;
  if (filtroConto) {
    const tot = lista.filter(m => m.tipo !== 'trasferimento').reduce((t, m) => t + (m.tipo === 'entrata' ? -1 : 1) * Conti.inValutaGruppo(m), 0);
    h += `<p class="q" style="margin:6px 4px 0">Totale ${esc(contoDi(filtroConto).nome)}${filtroVoce ? ' · ' + esc(filtroVoce) : ''}: <b class="num" style="color:var(--tx)">${eur(tot)}</b></p>`;
  }
  let corpo;
  if (!D.movimenti.length) corpo = `<div class="vuoto">${ic('portafoglio', 32)}Nessuna spesa ancora.<br>Tocca "Nuova spesa" per aggiungere la prima: chi ha pagato, quanto e per chi.</div>`;
  else if (!lista.length) corpo = '<div class="vuoto">Nessuna spesa trovata.</div>';
  else {
    const perData = {}; lista.forEach(m => { (perData[m.data] = perData[m.data] || []).push(m); });
    corpo = '<div class="solo-tel">' + Object.keys(perData).sort().reverse().map(d => `<h2 class="sez">${esc(dataLunga(d))}</h2><div class="lista">` + perData[d].map(m => {
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

function vistaStat(st) {
  if (!D.movimenti.length) return `<div class="vuoto">${ic('portafoglio', 32)}Le statistiche compaiono dopo la prima spesa.</div>`;
  let h = `<div class="kpi" style="margin-top:12px"><div><small>La tua spesa personale</small><b class="num">${IO ? eur(st.mio) : '—'}</b></div><div><small>Pagato da te</small><b class="num">${IO ? eur(st.pagatoDaMe) : '—'}</b></div></div>`;
  const conti = Object.entries(st.perConto).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), maxc = Math.max(1, ...conti.map(c => c[1]));
  h += '<h2 class="sez">Per conto</h2><div class="card">' + conti.map(([k, v]) => {
    const c = contoDi(k), voci = Object.entries(st.perVoce).filter(([kk, vv]) => kk.startsWith(k + '|') && vv > 0).sort((a, b) => b[1] - a[1]);
    return `<div style="padding:8px 0"><div class="riga"><span class="grow" style="display:flex;align-items:center;gap:8px;font-weight:700">${ic(ICONA_CONTO[c?.tipo] || 'cartella', 18)}${esc(c ? c.nome : 'Senza conto')}</span><b class="num">${eur(v)}</b><span class="by num" style="width:42px;text-align:right">${Math.round(v / Math.max(1, st.totale) * 100)}%</span></div><div class="bar" style="margin-top:6px"><i style="width:${v / maxc * 100}%"></i></div>
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
  const nuovo = id === 'nuovo', c = nuovo ? { nome: '', tipo: 'altro', voci: [] } : JSON.parse(JSON.stringify(contoDi(id)));
  const disegna = () => {
    $('pop').querySelector('.sheet').innerHTML = `<div class="grab"></div><button class="close" type="button" aria-label="Chiudi" id="ovX">${ic('x', 18)}</button>
      <h2>${nuovo ? 'Nuovo conto' : esc(c.nome)}</h2><p class="q" style="line-height:1.5;margin-top:0">Ogni conto raccoglie le sue spese, ma il saldo tra le persone resta uno solo per tutto il gruppo.</p>
      <label class="lb" for="cN">Nome</label><input id="cN" value="${esc(c.nome)}" placeholder="es. Casa, Viaggi, Auto, Bambini">
      <label class="lb" for="cT">Tipo</label><select id="cT">${[['casa', 'Casa'], ['viaggio', 'Viaggi'], ['extra', 'Extra'], ['altro', 'Altro']].map(([k, n]) => `<option value="${k}" ${c.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="lb">${c.tipo === 'viaggio' ? 'Viaggi' : 'Voci'}</label>
      <div class="lista">${(c.voci || []).map((v, i) => { const [ii, t] = iconaVoce(v, c.tipo); return `<div class="it"><span class="tile" style="width:30px;height:30px;border-radius:9px;background:${t[0]};color:${t[1]}">${ic(ii, 16)}</span><span style="flex:1;font-weight:600">${esc(v)}</span><button type="button" class="del" data-tv="${i}" aria-label="Togli ${esc(v)}">${ic('x', 16)}</button></div>`; }).join('') || `<p class="q" style="padding:12px 0;margin:0">${c.tipo === 'viaggio' ? 'Aggiungi ogni viaggio, per esempio "Parigi 2026".' : 'Nessuna voce.'}</p>`}</div>
      <div class="agg"><input id="cV" placeholder="${c.tipo === 'viaggio' ? 'Nuovo viaggio, es. Parigi 2026' : 'Nuova voce, es. Utenze'}"><button type="button" id="cVa" aria-label="Aggiungi voce">${ic('piu', 20, 2.2)}</button></div>
      <button class="btn" type="button" id="cS" style="margin-top:14px">Salva</button>
      ${nuovo ? '' : '<button class="btn danger" type="button" id="cE">Elimina conto</button><p class="by" style="margin-top:8px">Si può eliminare solo un conto senza spese.</p>'}`;
    $('ovX').onclick = chiudi;
    const leggi = () => { c.nome = $('cN').value; c.tipo = $('cT').value; };
    $('cT').onchange = () => { leggi(); disegna(); };
    foglioQ('[data-tv]').forEach(b => b.onclick = () => { leggi(); c.voci.splice(+b.dataset.tv, 1); disegna(); });
    const aggV = () => { leggi(); const v = $('cV').value.trim(); if (!v) return; if (!c.voci.includes(v)) c.voci.push(v); disegna(); $('cV').focus(); };
    $('cVa').onclick = aggV; $('cV').onkeydown = e => { if (e.key === 'Enter') aggV(); };
    $('cS').onclick = async () => {
      leggi(); const pend = $('cV').value.trim(); if (pend && !c.voci.includes(pend)) c.voci.push(pend);
      if (!c.nome.trim()) return toast('Dai un nome al conto');
      chiudi();
      if (nuovo) {
        const r = { id: uuid(), gruppo_id: G.id, nome: c.nome.trim(), tipo: c.tipo, voci: c.voci, ordine: D.conti.length + 1, created_at: new Date().toISOString() };
        D.conti.push(r); filtroConto = r.id; renderConti();
        if (await scrivi(() => ST.ins('conti', r))) toast('Conto creato ✓');
      } else {
        const r = contoDi(id); Object.assign(r, { nome: c.nome.trim(), tipo: c.tipo, voci: c.voci }); renderConti();
        if (await scrivi(() => ST.upd('conti', id, { nome: r.nome, tipo: r.tipo, voci: r.voci }))) toast('Salvato ✓');
      }
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
        <div class="it"><label for="mT">Titolo</label><input id="mT" value="${esc(f.titolo)}" placeholder="${tr ? 'Rimborso' : 'es. Cena, Bolletta luce, Volo'}"></div>
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
      riga.id = uuid(); riga.creato_da = CHI;
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
function modificaPartecipante(id) {
  const p = D.partecipanti.find(x => x.id === id); if (!p) return;
  foglio(`<h2>${esc(p.nome)}</h2><label class="lb" for="peN">Nome</label><input id="peN" value="${esc(p.nome)}" style="background:var(--card)">
    <button class="btn" type="button" id="peS" style="margin-top:10px">Salva</button>
    ${p.id === IO ? '<button class="btn ghost" type="button" id="peU">Non sono io</button>' : ''}
    <button class="btn danger" type="button" id="peD">Togli dal gruppo</button>
    <p class="by" style="margin-top:10px">Si può togliere solo chi non compare in nessuna spesa.</p>`);
  $('peS').onclick = async () => { const n = $('peN').value.trim(); if (!n) return; p.nome = n; chiudi(); renderTutto(); await scrivi(() => ST.upd('partecipanti', id, { nome: n })); };
  if ($('peU')) $('peU').onclick = async () => { chiudi(); if (await scrivi(() => ST.upd('partecipanti', id, { user_id: null }))) { await ricarica(); scegliPartecipante(); } };
  $('peD').onclick = async () => {
    if (D.movimenti.some(m => m.pagato_da === id || id in ((m.divisione || {}).parti || {}))) return toast(p.nome + ' compare in alcune spese: non si può togliere');
    chiudi(); D.partecipanti = D.partecipanti.filter(x => x.id !== id); trovaIO(); renderTutto();
    if (await scrivi(() => ST.del('partecipanti', id))) toast('Tolto dal gruppo');
  };
}
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
