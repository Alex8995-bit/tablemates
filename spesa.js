// Scheda Spesa: Lista (per reparti, spunte, chi ha aggiunto e chi ha preso, collegamento ai Conti) e Dispensa (quanto resta in casa).
let modoSpesa = LS.get('modoSpesa') === 'dispensa' ? 'dispensa' : 'lista';
const ZONE = ['Frigo', 'Dispensa', 'Freezer'];
const LIVELLI = ['Finito', 'Sta finendo', 'A metà', 'Quasi pieno', 'Pieno'];
const dispensa = () => { const d = D.stato.dispensa; return d && Array.isArray(d.items) ? d : { items: [] }; };
// "zucchine 500 g" → nome e quantità
function dividiProdotto(t) {
  const m = String(t).trim().match(/^(.*?)\s+((?:\d+(?:[.,]\d+)?)\s*(?:g|gr|grammi|kg|ml|l|cl|pz|pezzi|porzion[ei]|pacc(?:o|hi)|confezion[ei]|bottigli[ae]|vasett[io])?\.?|x\s*\d+)$/i);
  return m && m[1] ? { nome: m[1].trim(), qta: m[2].trim() } : { nome: String(t).trim(), qta: '' };
}
// Quantità da comprare: grammi, porzioni o pacchi
const UNITA = [['g', 'g'], ['porzioni', 'porz.'], ['pacchi', 'pacchi']];
let unitaSpesa = UNITA.some(u => u[0] === LS.get('unitaSpesa')) ? LS.get('unitaSpesa') : 'g';
const numTesto = n => String(Math.round(n * 100) / 100).replace('.', ',');
function testoQuantita(n, u) {
  const v = parseFloat(String(n).replace(',', '.')); if (!(v > 0)) return '';
  if (u === 'g') return numTesto(v) + ' g';
  if (u === 'porzioni') return numTesto(v) + (v === 1 ? ' porzione' : ' porzioni');
  if (u === 'pacchi') return numTesto(v) + (v === 1 ? ' pacco' : ' pacchi');
  return numTesto(v) + (u ? ' ' + u : '');
}
// "500 g" → { n: '500', u: 'g' } · "1 kg" → 1000 g · "2 pacchi" → pacchi · "1 l" → unità "l" (resta com'era)
function leggiQuantita(t) {
  const m = String(t || '').trim().match(/^x?\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i); if (!m) return { n: '', u: unitaSpesa };
  const v = parseFloat(m[1].replace(',', '.')), r = m[2].toLowerCase().replace(/\.$/, '').trim();
  if (/^(g|gr|grammi)$/.test(r)) return { n: numTesto(v), u: 'g' };
  if (/^(kg|chili|chilo)$/.test(r)) return { n: numTesto(v * 1000), u: 'g' };
  if (/^porzion/.test(r)) return { n: numTesto(v), u: 'porzioni' };
  if (/^(pacc|confez|conf$|pz|pezz)/.test(r)) return { n: numTesto(v), u: 'pacchi' };
  return { n: numTesto(v), u: r };
}
const htmlUnita = (sel, pre, extra) => `<div class="unita" role="group" aria-label="Unità">${(extra ? UNITA.concat([[extra, extra]]) : UNITA).map(([k, n]) => `<button type="button" data-${pre}u="${k}" aria-pressed="${sel === k}" class="${sel === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;

function renderSpesa() {
  const el = $('t-spesa');
  if (!G) { el.innerHTML = '<div class="testa"><h1>Spesa</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const foc = document.activeElement?.id, val = $('nv')?.value || '', valQ = $('nq')?.value || '', valD = $('dv')?.value || '';
  const seg = `<nav class="seg" aria-label="Lista o dispensa">${[['lista', 'Lista'], ['dispensa', 'Dispensa']].map(([k, n]) => modoSpesa === k ? `<span aria-current="page">${n}</span>` : `<button type="button" data-ms="${k}">${n}</button>`).join('')}</nav>`;
  el.innerHTML = modoSpesa === 'dispensa' ? htmlDispensa(seg) : htmlLista(seg);
  el.querySelectorAll('[data-ms]').forEach(b => b.onclick = () => { modoSpesa = b.dataset.ms; LS.set('modoSpesa', modoSpesa); vibra(); renderSpesa(); });
  if (modoSpesa === 'dispensa') return collegaDispensa(el, valD, foc);
  tocaBarraSpesa();
  $('nv').value = val; $('nq').value = valQ; if (foc === 'nv') $('nv').focus(); if (foc === 'nq') $('nq').focus();
  $('add').onclick = aggiungiSpesa; $('nv').onkeydown = e => { if (e.key === 'Enter') aggiungiSpesa(); };
  $('nq').onkeydown = e => { if (e.key === 'Enter') aggiungiSpesa(); };
  el.querySelectorAll('[data-nu]').forEach(b => b.onclick = () => { unitaSpesa = b.dataset.nu; LS.set('unitaSpesa', unitaSpesa); vibra(); el.querySelectorAll('[data-nu]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); $('nq').placeholder = unitaSpesa === 'g' ? 'es. 500' : 'es. 2'; });
  el.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => spunta(b.dataset.sk));
  el.querySelectorAll('[data-se]').forEach(b => b.onclick = () => modificaSpesa(b.dataset.se));
  scorriElimina([...el.querySelectorAll('.sp-riga')], r => eliminaSpesa(r.querySelector('[data-se]').dataset.se, true), 'Togli dalla lista');
  if ($('clr')) $('clr').onclick = () => conferma('Togliere i prodotti presi?', 'I prodotti spuntati verranno tolti dalla lista per tutti.', 'Togli', svuota);
  if ($('reg')) $('reg').onclick = () => {
    const nomi = D.spesa.filter(x => x.comprato).map(x => x.nome + (x.quantita ? ' (' + x.quantita + ')' : ''));
    const casa = D.conti.find(c => c.tipo === 'casa');
    vai('conti'); formMovimento(null, { tipo: 'spesa', titolo: 'Spesa', conto_id: casa?.id || null, categoria: casa ? ((casa.voci || []).find(v => /spesa|aliment/i.test(v)) || '') : '', nota: nomi.join(', ') });
  };
}

function htmlLista(seg) {
  const spesa = D.spesa, tot = spesa.length, fatti = spesa.filter(x => x.comprato).length;
  const giorniDieta = [...new Set(spesa.filter(x => /^Dieta/.test(x.giorno || '')).map(x => x.giorno))];
  let h = htmlBarraSpesa() + `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">${puntoLive()}${giorniDieta.length ? 'Per i pasti del piano' : esc(G.nome) + ' · lista condivisa'}</p><h1>Spesa</h1></div>${tot ? `<span class="cnt num">${fatti} di ${tot} presi</span>` : ''}</div>` + seg;
  if (tot) h += `<div class="prog" role="progressbar" aria-label="Avanzamento spesa" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${fatti}"><i style="width:${Math.round(fatti / tot * 100)}%"></i></div>`;
  h += `<div class="agg-box"><div class="agg"><label for="nv" class="sr">Aggiungi alla lista</label><input id="nv" placeholder="Aggiungi qualcosa…" enterkeyhint="done"><button id="add" type="button" aria-label="Aggiungi">${ic('piu', 22, 2.2)}</button></div>
    <div class="agg-q"><label for="nq" class="sr">Quantità da comprare</label><input id="nq" inputmode="decimal" placeholder="${unitaSpesa === 'g' ? 'es. 500' : 'es. 2'}" enterkeyhint="done" autocomplete="off">${htmlUnita(unitaSpesa, 'n')}</div></div>`;
  REPARTI.forEach(r => {
    const v = spesa.filter(x => (REPARTI.includes(x.reparto) ? x.reparto : 'Altro') === r).sort((a, b) => (a.comprato ? 1 : 0) - (b.comprato ? 1 : 0));
    if (v.length) h += `<section style="display:flex;flex-direction:column;gap:12px"><h2 class="sez" style="margin:0">${EMO.reparto(r)} ${r}</h2><div class="sc">${v.map(rigaSpesa).join('')}</div></section>`;
  });
  if (!tot) h += `<div class="vuoto">${ic('sacchetto', 32)}La lista è vuota.<br>Aggiungi i prodotti qui sopra, oppure creala dal Piano con le quantità della dieta.</div>`;
  if (fatti) h += `<div style="display:flex;flex-direction:column;gap:4px"><button class="btn scuro" id="reg" type="button">${ic('scontrino2', 20, 1.8)}Spesa fatta? Dividi lo scontrino</button><button class="link-txt" id="clr" type="button" style="text-align:center">Togli i prodotti presi dalla lista</button></div>`;
  return h + '<div style="height:8px"></div>';
}
const rigaSpesa = x => `<div class="sp-riga ${x.comprato ? 'done' : ''}"><button type="button" class="sp-ck" data-sk="${x.id}" aria-pressed="${!!x.comprato}" aria-label="${x.comprato ? 'Togli la spunta: ' : 'Segna come preso: '}${esc(x.nome)}">${x.comprato ? ic('spunta', 16, 3) : ''}</button><button type="button" class="sp-nm" data-se="${x.id}" aria-label="Modifica ${esc(x.nome)}"><b>${EMO.html(x.nome, EMO.reparto(x.reparto), 's:' + x.id, true)}${esc(x.nome)}</b>${chiTxt(x)}</button>${x.quantita ? `<span class="sp-q num">${esc(x.quantita)}</span>` : ''}</div>`;
// Per chi e per quando serve un prodotto (scritto nel campo "giorno"):
// "Dieta · Ale — Lunedì · Pranzo · Ale; ven 20 nov · Cena · Pasto comune" (dal piano) oppure "Per: ven 20 nov · Pranzo · Giulia" (a mano)
function perTesto(g) {
  if (g.includes(' — ')) return 'Per ' + g.split(' — ').slice(1).join(' — ');
  if (g.startsWith('Per: ')) return 'Per ' + g.slice(5);
  return g.replace(/^Dieta · /, 'Piano di ').replace(/^Ricetta · /, 'Ricetta: ');
}
const PASTI_SPESA = ['Colazione', 'Pranzo', 'Spuntino', 'Cena'];
function chiTxt(x) {
  const a = x.comprato && x.modificato_da ? 'Preso da ' + x.modificato_da : '';
  const per = x.giorno ? perTesto(x.giorno) : (x.aggiunto_da ? 'Aggiunto da ' + x.aggiunto_da : '');
  const t = [a, per].filter(Boolean).join(' · ');
  return t ? `<small>${esc(t)}</small>` : '';
}
// Aggiornamento immediato sullo schermo, poi salvataggio
async function aggiungiSpesa() {
  const t = $('nv').value.trim(); if (!t) { if ($('nq').value.trim()) { toast('Scrivi prima il prodotto'); $('nv').focus(); } return; }
  const { nome, qta } = dividiProdotto(t), q = testoQuantita($('nq').value, unitaSpesa) || qta;
  const x = { id: uuid(), gruppo_id: G.id, nome, quantita: q, reparto: repartoDi(nome), comprato: false, aggiunto_da: CHI, created_at: new Date().toISOString() };
  D.spesa.push(x); $('nv').value = ''; $('nq').value = ''; vibra(); renderSpesa(); renderOggi(); $('nv').focus();
  if (await scrivi(() => ST.ins('spesa', x))) avvisaSpesa(nome);
}
async function spunta(id) {
  const x = D.spesa.find(i => i.id === id); if (!x) return;
  x.comprato = !x.comprato; x.modificato_da = CHI; vibra(); renderSpesa(); renderOggi();
  if (x.comprato) riempiDispensa(x.nome);
  if (await scrivi(() => ST.upd('spesa', id, { comprato: x.comprato, modificato_da: CHI })) && x.comprato) avvisaSpesa(x.nome, 'preso');
}
function modificaSpesa(id) {
  const x = D.spesa.find(i => i.id === id); if (!x) return;
  const q = leggiQuantita(x.quantita); let u = q.u;
  // un'unità diversa (es. "1 l" arrivato dal piano) resta tra le scelte, così non si perde; un testo senza numero (es. "q.b.") resta se non scrivi nulla
  const extra = u && !UNITA.some(z => z[0] === u) ? u : '', vecchia = x.quantita && q.n === '' ? x.quantita : '';
  // prodotto arrivato dal piano o da una ricetta: il "per chi" è già scritto; a mano si sceglie giorno, pasto e persona
  const autom = !!x.giorno && !x.giorno.startsWith('Per: ');
  const giorniPer = [...Array(14)].map((_, i) => { const iso = isoDi(Date.now() + i * 864e5); return [dataBreve(iso), i === 0 ? 'Oggi' : i === 1 ? 'Domani' : dataBreve(iso)]; });
  const parti = x.giorno && x.giorno.startsWith('Per: ') ? x.giorno.slice(5).split(' · ') : [];
  const perG = parti.find(t => giorniPer.some(g => g[0] === t)) || '', perP = parti.find(t => PASTI_SPESA.includes(t)) || '', perC = parti.find(t => t === 'Pasto comune' || D.partecipanti.some(z => z.nome === t)) || '';
  foglio(`<h2>${esc(x.nome)}</h2><p class="by" style="margin:0 0 6px">${esc(x.aggiunto_da ? 'Aggiunto da ' + x.aggiunto_da : '')}</p>
    <label class="lb" for="seN">Prodotto</label><div class="riga" style="gap:8px"><button type="button" class="emo-b" id="seEm" aria-label="Cambia emoji">${EMO.per(x.nome, EMO.reparto(x.reparto), 's:' + x.id, true)}</button><input id="seN" value="${esc(x.nome)}" style="flex:1;min-width:0"></div>
    <label class="lb" for="seQ">Quantità da comprare</label><div class="agg-q"><input id="seQ" inputmode="decimal" value="${esc(q.n)}" placeholder="Facoltativa" autocomplete="off">${htmlUnita(u, 'se', extra)}</div>${vecchia ? `<p class="q" style="margin:4px 0 0">Ora: ${esc(vecchia)}</p>` : ''}
    ${autom ? `<p class="by" style="margin:8px 0 0;line-height:1.45">${esc(perTesto(x.giorno))}</p>` : `<label class="lb" for="sePg">Per quando e per chi <span style="font-weight:500">(facoltativo)</span></label>
    <select id="sePg"><option value="">Nessun giorno</option>${giorniPer.map(([v, n]) => `<option value="${esc(v)}" ${v === perG ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div class="riga" style="gap:8px;margin-top:8px"><select id="sePp" style="flex:1;min-width:0" aria-label="Pasto"><option value="">Pasto</option>${PASTI_SPESA.map(t => `<option ${t === perP ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <select id="sePc" style="flex:1;min-width:0" aria-label="Per chi"><option value="">Per chi</option>${D.partecipanti.map(z => `<option ${z.nome === perC ? 'selected' : ''}>${esc(z.nome)}</option>`).join('')}<option ${perC === 'Pasto comune' ? 'selected' : ''}>Pasto comune</option></select></div>`}
    <label class="lb" for="seR">Reparto</label><select id="seR">${REPARTI.map(r => `<option ${r === x.reparto ? 'selected' : ''}>${r}</option>`).join('')}</select>
    <button class="btn" id="seS" type="button" style="margin-top:12px">Salva</button><button class="btn danger" id="seD" type="button">${ic('cestino', 18)}Togli dalla lista</button>`);
  $('pop').querySelectorAll('[data-seu]').forEach(b => b.onclick = () => { u = b.dataset.seu; vibra(); $('pop').querySelectorAll('[data-seu]').forEach(z => { const on = z === b; z.classList.toggle('on', on); z.setAttribute('aria-pressed', on); }); });
  $('seS').onclick = async () => {
    const n = $('seN').value.trim(); if (!n) return;
    const qt = testoQuantita($('seQ').value, u) || ($('seQ').value.trim() ? '' : vecchia);
    const per = autom ? x.giorno : ((t => t ? 'Per: ' + t : null)([$('sePg').value, $('sePp').value, $('sePc').value].filter(Boolean).join(' · ')));
    const cambiato = n !== x.nome || qt !== (x.quantita || '') || $('seR').value !== x.reparto || (per || null) !== (x.giorno || null);
    Object.assign(x, { nome: n, quantita: qt, reparto: $('seR').value, giorno: per }); chiudi(); renderSpesa();
    if (await scrivi(() => ST.upd('spesa', id, { nome: x.nome, quantita: x.quantita, reparto: x.reparto, giorno: x.giorno })) && cambiato) avvisaSpesa(x.nome, 'mod');
  };
  $('seD').onclick = () => { chiudi(); eliminaSpesa(id); };
  $('seEm').onclick = () => scegliEmoji({ testo: x.nome, chiave: 's:' + x.id, auto: EMO.cibo(x.nome) || EMO.reparto(x.reparto) });
}
async function eliminaSpesa(id, annullabile) {
  const x = D.spesa.find(i => i.id === id);
  D.spesa = D.spesa.filter(i => i.id !== id); renderSpesa(); renderOggi();
  const tolto = await scrivi(() => ST.del('spesa', id));
  if (tolto && x && !x.comprato) avvisaSpesa(x.nome, 'tolto');
  if (tolto && annullabile && x) toast('Tolto dalla lista: ' + x.nome, { testo: 'Annulla', fn: async () => {
    const c = { ...x }; delete c.id; delete c.created_at; if (await scrivi(() => ST.ins('spesa', [c]))) { ricarica(); avvisaSpesa(x.nome, 'agg'); }
  } });
}
async function svuota() { const n = D.spesa.filter(i => i.comprato).length; D.spesa = D.spesa.filter(i => !i.comprato); renderSpesa(); renderOggi(); if (await scrivi(() => ST.delWhere('spesa', { gruppo_id: G.id, comprato: true })) && n) avvisaSpesa(n === 1 ? '1 prodotto già preso' : n + ' prodotti già presi', 'tolto'); }

// ---------- Dispensa ----------
async function salvaDispensa(d) { D.stato.dispensa = d; renderSpesa(); await scrivi(() => ST.salvaStato(G.id, 'dispensa', d)); }
function riempiDispensa(nome) {
  const d = dispensa(), n = senzaAccenti(nome), it = d.items.find(x => senzaAccenti(x.nome) === n);
  if (it && it.livello < 4) { it.livello = 4; salvaDispensa({ items: d.items }); }
}
function htmlDispensa(seg) {
  const items = dispensa().items, bassi = items.filter(x => x.livello <= 1);
  let h = `<div class="cap"><div><p class="q" style="font-weight:600;margin:0">Tocca un prodotto per dire quanto ne resta</p><h1>Spesa</h1></div></div>` + seg;
  if (bassi.length) h += `<div class="avviso riga">${ic('info', 20, 2)}<span style="flex:1"><strong>${bassi.length === 1 ? '1 cosa sta finendo.' : bassi.length + ' cose stanno finendo.'}</strong> Mettile in lista con un tocco.</span><button type="button" class="l" id="dAgg">Aggiungi</button></div>`;
  ZONE.forEach(z => {
    const v = items.map((x, i) => ({ x, i })).filter(o => (ZONE.includes(o.x.zona) ? o.x.zona : 'Dispensa') === z);
    if (!v.length) return;
    h += `<section style="display:flex;flex-direction:column;gap:12px"><h2 class="sez" style="margin:0">${z}</h2><div class="sc">${v.map(({ x, i }) => {
      const basso = x.livello <= 1;
      return `<button type="button" class="disp-riga" data-dl="${i}" aria-label="${esc(x.nome)}: ${LIVELLI[x.livello]}. Tocca per cambiare"><span class="dn"><b>${EMO.html(x.nome, '🥫', '', true)}${esc(x.nome)}</b><small class="${basso ? 'basso' : ''}">${LIVELLI[x.livello]}</small></span><span class="livello" aria-hidden="true">${[1, 2, 3, 4].map(n => `<i class="${n <= x.livello ? 'on' : ''} ${basso ? 'basso' : ''}"></i>`).join('')}</span></button>`;
    }).join('')}</div></section>`;
  });
  if (!items.length) h += `<div class="vuoto">${ic('casa', 32)}La dispensa è vuota.<br>Aggiungi quello che tieni in casa: quando sta per finire lo metti in lista con un tocco, e le ricette sanno cosa hai già.</div>`;
  h += `<section class="card" style="display:flex;flex-direction:column;gap:8px" aria-labelledby="dT"><h2 id="dT" style="margin:0;font-size:16px;font-weight:700">Aggiungi un prodotto</h2>
    <div class="agg"><label for="dv" class="sr">Prodotto</label><input id="dv" placeholder="es. Olio extravergine" enterkeyhint="done"><button id="dAdd" type="button" aria-label="Aggiungi alla dispensa">${ic('piu', 22, 2.2)}</button></div>
    <div class="seg" role="radiogroup" aria-label="Dove">${ZONE.map((z, i) => `<button type="button" role="radio" data-dz="${z}" aria-checked="${(LS.get('zona') || 'Dispensa') === z}" class="${(LS.get('zona') || 'Dispensa') === z ? 'on' : ''}">${z}</button>`).join('')}</div>
    ${items.length ? '<p class="by" style="margin:0">Tieni premuto su un prodotto per rinominarlo o toglierlo.</p>' : ''}</section><div style="height:8px"></div>`;
  return h;
}
function collegaDispensa(el, valD, foc) {
  $('dv').value = valD; if (foc === 'dv') $('dv').focus();
  const aggiungi = async () => {
    const n = $('dv').value.trim(); if (!n) return;
    const d = dispensa(); if (d.items.some(x => senzaAccenti(x.nome) === senzaAccenti(n))) return toast('C\'è già in dispensa');
    d.items.push({ id: uuid(), nome: n, zona: LS.get('zona') || 'Dispensa', livello: 4 }); $('dv').value = ''; vibra();
    await salvaDispensa({ items: d.items }); $('dv') && $('dv').focus();
  };
  $('dAdd').onclick = aggiungi; $('dv').onkeydown = e => { if (e.key === 'Enter') aggiungi(); };
  el.querySelectorAll('[data-dz]').forEach(b => b.onclick = () => { LS.set('zona', b.dataset.dz); renderSpesa(); });
  el.querySelectorAll('[data-dl]').forEach(b => {
    let pressione = null, lungo = false, px = 0, py = 0;
    b.onpointerdown = e => { lungo = false; px = e.clientX; py = e.clientY; pressione = setTimeout(() => { lungo = true; modificaDispensa(+b.dataset.dl); }, 550); };
    b.onpointermove = e => { if (Math.abs(e.clientX - px) > 8 || Math.abs(e.clientY - py) > 8) clearTimeout(pressione); };
    b.onpointerup = b.onpointerleave = () => clearTimeout(pressione);
    b.oncontextmenu = e => { e.preventDefault(); modificaDispensa(+b.dataset.dl); };
    b.onclick = () => { if (lungo) return; const d = dispensa(), it = d.items[+b.dataset.dl]; it.livello = it.livello === 0 ? 4 : it.livello - 1; vibra(); salvaDispensa({ items: d.items }); };
  });
  scorriElimina([...el.querySelectorAll('.disp-riga')], async r => {
    const i = +r.dataset.dl, d = dispensa(), [tolto] = d.items.splice(i, 1); if (!tolto) return;
    await salvaDispensa({ items: d.items });
    toast('Tolto dalla dispensa: ' + tolto.nome, { testo: 'Annulla', fn: () => { const d2 = dispensa(); d2.items.splice(Math.min(i, d2.items.length), 0, tolto); salvaDispensa({ items: d2.items }); } });
  }, 'Togli dalla dispensa');
  if ($('dAgg')) $('dAgg').onclick = async () => {
    const bassi = dispensa().items.filter(x => x.livello <= 1 && !D.spesa.some(s => !s.comprato && senzaAccenti(s.nome) === senzaAccenti(x.nome)));
    if (!bassi.length) return toast('Sono già tutte nella lista');
    if (await scrivi(() => ST.ins('spesa', bassi.map(x => ({ gruppo_id: G.id, nome: x.nome, quantita: '', reparto: repartoDi(x.nome), comprato: false, aggiunto_da: CHI }))))) {
      await ricarica(); toast((bassi.length === 1 ? '1 prodotto aggiunto' : bassi.length + ' prodotti aggiunti') + ' alla lista ✓'); avvisaSpesa(bassi.map(x => x.nome), 'agg');
    }
  };
}
function modificaDispensa(i) {
  const d = dispensa(), it = d.items[i]; if (!it) return;
  foglio(`<h2>${esc(it.nome)}</h2><label class="lb" for="mdN">Nome</label><input id="mdN" value="${esc(it.nome)}">
    <label class="lb" for="mdZ">Dove</label><select id="mdZ">${ZONE.map(z => `<option ${z === it.zona ? 'selected' : ''}>${z}</option>`).join('')}</select>
    <label class="lb" for="mdL">Quanto ne resta</label><select id="mdL">${LIVELLI.map((l, n) => `<option value="${n}" ${n === it.livello ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <button class="btn" id="mdS" type="button" style="margin-top:12px">Salva</button><button class="btn danger" id="mdD" type="button">${ic('cestino', 18)}Togli dalla dispensa</button>`);
  $('mdS').onclick = () => { const n = $('mdN').value.trim(); if (!n) return; Object.assign(it, { nome: n, zona: $('mdZ').value, livello: +$('mdL').value }); chiudi(); salvaDispensa({ items: d.items }); };
  $('mdD').onclick = () => { d.items.splice(i, 1); chiudi(); salvaDispensa({ items: d.items }); };
}
