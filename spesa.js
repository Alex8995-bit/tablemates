// Scheda Spesa: lista per reparti, spunte, chi ha aggiunto e chi ha preso, collegamento ai Conti.
function renderSpesa() {
  const el = $('t-spesa');
  if (!G) { el.innerHTML = '<div class="testa"><h1>Spesa</h1></div><div class="vuoto">Accedi e scegli un gruppo per iniziare.</div>'; return; }
  const spesa = D.spesa, tot = spesa.length, fatti = spesa.filter(x => x.comprato).length;
  const foc = document.activeElement?.id, val = $('nv')?.value || '', q = $('nq')?.value || '', rep = $('nr')?.value || 'Altro';
  let h = `<div class="testa" style="flex-direction:row;align-items:flex-end;justify-content:space-between"><div style="display:flex;flex-direction:column;gap:2px"><p>${puntoLive()}${esc(G.nome)}</p><h1>Spesa</h1></div>${tot ? `<b class="num" style="font-size:14px">${fatti} di ${tot}</b>` : ''}</div>` +
    (tot ? `<div class="bar" style="margin-bottom:14px" role="progressbar" aria-label="Prodotti presi" aria-valuenow="${fatti}" aria-valuemin="0" aria-valuemax="${tot}"><i style="width:${fatti / tot * 100}%"></i></div>` : '') +
    `<div class="agg"><input id="nv" class="campo-pag" placeholder="Aggiungi un prodotto…" enterkeyhint="done" aria-label="Prodotto"><button id="add" type="button" aria-label="Aggiungi">${ic('piu', 22, 2.2)}</button></div>
     <div class="riga" style="margin:8px 0 4px"><input class="grow campo-pag" id="nq" placeholder="Quantità (facoltativa)" aria-label="Quantità" style="margin:0"><select class="grow campo-pag" id="nr" aria-label="Reparto" style="margin:0">${REPARTI.map(r => `<option>${r}</option>`).join('')}</select></div>`;
  const daPrendere = spesa.filter(x => !x.comprato);
  REPARTI.forEach(r => {
    const v = daPrendere.filter(x => (REPARTI.includes(x.reparto) ? x.reparto : 'Altro') === r);
    if (v.length) h += `<h2 class="sez">${r}</h2><div class="lista">${v.map(rigaSpesa).join('')}</div>`;
  });
  const presi = spesa.filter(x => x.comprato);
  if (presi.length) h += `<h2 class="sez">Nel carrello</h2><div class="lista">${presi.map(rigaSpesa).join('')}</div>
    <button class="btn scuro" id="reg" type="button">${ic('scontrino', 18)}Registra lo scontrino nei conti</button><button class="btn ghost" id="clr" type="button">Svuota il carrello</button><div style="height:20px"></div>`;
  if (!tot) h += `<div class="vuoto">${ic('carrello', 32)}La lista è vuota.<br>Aggiungi i prodotti qui sopra, oppure crea i piatti dal Piano e la lista si riempie da sola.</div>`;
  el.innerHTML = h;
  $('nv').value = val; $('nq').value = q; $('nr').value = rep;
  if (foc === 'nv' || foc === 'nq') $(foc).focus();
  $('add').onclick = aggiungiSpesa; $('nv').onkeydown = e => { if (e.key === 'Enter') aggiungiSpesa(); };
  el.querySelectorAll('.it').forEach(r => {
    const id = r.dataset.id;
    r.querySelector('.ck').onclick = r.querySelector('.nm').onclick = () => spunta(id);
    r.querySelector('.del').onclick = () => eliminaSpesa(id);
  });
  if ($('clr')) $('clr').onclick = () => conferma('Svuotare il carrello?', 'I prodotti presi verranno tolti dalla lista per tutti.', 'Svuota', svuota);
  if ($('reg')) $('reg').onclick = () => {
    const nomi = D.spesa.filter(x => x.comprato).map(x => x.nome + (x.quantita ? ' (' + x.quantita + ')' : ''));
    const casa = D.conti.find(c => c.tipo === 'casa');
    vai('conti'); formMovimento(null, { tipo: 'spesa', titolo: 'Spesa', conto_id: casa?.id || null, categoria: casa ? ((casa.voci || []).find(v => /spesa|aliment/i.test(v)) || '') : '', nota: nomi.join(', ') });
  };
}
const rigaSpesa = x => `<div class="it ${x.comprato ? 'done' : ''}" data-id="${x.id}"><button class="ck" type="button" aria-label="${x.comprato ? 'Togli dal carrello ' : 'Segna come preso '}${esc(x.nome)}">${x.comprato ? ic('spunta', 15, 3) : ''}</button><div class="nm"><b>${esc(x.nome)}</b>${chiTxt(x)}</div>${x.quantita ? `<span class="q">${esc(x.quantita)}</span>` : ''}<button class="del" type="button" aria-label="Elimina ${esc(x.nome)}">${ic('x', 18)}</button></div>`;
function chiTxt(x) {
  const a = x.comprato && x.modificato_da ? 'preso da ' + x.modificato_da : (x.aggiunto_da ? 'aggiunto da ' + x.aggiunto_da : '');
  const per = x.giorno ? ' · ' + x.giorno : '';
  return a || per ? `<span class="by">${esc(a + per)}</span>` : '';
}
// Aggiornamento immediato sullo schermo, poi salvataggio
async function aggiungiSpesa() {
  const n = $('nv').value.trim(); if (!n) return;
  const x = { id: uuid(), gruppo_id: G.id, nome: n, quantita: $('nq').value.trim(), reparto: $('nr').value, comprato: false, aggiunto_da: CHI, created_at: new Date().toISOString() };
  D.spesa.push(x); $('nv').value = ''; $('nq').value = ''; vibra(); renderSpesa(); $('nv').focus();
  await scrivi(() => ST.ins('spesa', x));
}
async function spunta(id) {
  const x = D.spesa.find(i => i.id === id); if (!x) return;
  x.comprato = !x.comprato; x.modificato_da = CHI; vibra(); renderSpesa();
  await scrivi(() => ST.upd('spesa', id, { comprato: x.comprato, modificato_da: CHI }));
}
async function eliminaSpesa(id) { D.spesa = D.spesa.filter(i => i.id !== id); renderSpesa(); await scrivi(() => ST.del('spesa', id)); }
async function svuota() { D.spesa = D.spesa.filter(i => !i.comprato); renderSpesa(); await scrivi(() => ST.delWhere('spesa', { gruppo_id: G.id, comprato: true })); }
