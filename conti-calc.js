// Calcoli dei conti condivisi (stile Tricount). Tutti gli importi sono in centesimi interi.
(function (root) {
  const CATEGORIE = [
    ['spesa', '🛒', 'Spesa alimentare'], ['cibo', '🍝', 'Cibo e bevande'], ['ristorante', '🍽️', 'Ristorante e bar'],
    ['trasporti', '🚗', 'Trasporti'], ['alloggio', '🏠', 'Casa e affitto'], ['bollette', '💡', 'Bollette'],
    ['svago', '🎉', 'Svago'], ['viaggi', '✈️', 'Viaggi'], ['salute', '💊', 'Salute'], ['shopping', '🛍️', 'Shopping'],
    ['regali', '🎁', 'Regali'], ['altro', '📦', 'Altro']
  ];
  const VALUTE = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'CNY', 'BRL', 'MXN', 'AED', 'THB'];

  // Divide "totale" in parti proporzionali ai pesi, con somma esatta (metodo dei resti più grandi)
  function ripartisci(totale, pesi) {
    const ids = Object.keys(pesi).filter(k => Number(pesi[k]) > 0);
    const somma = ids.reduce((s, k) => s + Number(pesi[k]), 0);
    const out = {};
    if (!ids.length || somma <= 0) return out;
    let assegnato = 0;
    const resti = ids.map((k, i) => {
      const esatto = totale * Number(pesi[k]) / somma, base = Math.floor(esatto);
      out[k] = base; assegnato += base;
      return { k, r: esatto - base, i };
    });
    resti.sort((a, b) => b.r - a.r || a.i - b.i);
    for (let j = 0; j < totale - assegnato; j++) out[resti[j % resti.length].k]++;
    return out;
  }
  // Importo del movimento nella valuta del gruppo
  const inValutaGruppo = m => Math.round(Number(m.importo) * (Number(m.cambio) || 1));

  // Quota di ciascuno nella valuta del gruppo
  function quote(m) {
    const T = inValutaGruppo(m), d = m.divisione || {}, parti = d.parti || {};
    if (m.tipo === 'trasferimento') { const a = Object.keys(parti)[0]; return a ? { [a]: T } : {}; }
    if (d.modo === 'uguale') { const p = {}; Object.keys(parti).forEach(k => { if (parti[k]) p[k] = 1; }); return ripartisci(T, p); }
    return ripartisci(T, parti); // 'quote' (pesi) o 'importi' (centesimi nella valuta originale)
  }
  // Effetto sul saldo di ciascuno: positivo = deve ricevere, negativo = deve dare
  function effetti(m) {
    const T = inValutaGruppo(m), q = quote(m), e = {};
    const add = (k, v) => { e[k] = (e[k] || 0) + v; };
    if (m.tipo === 'entrata') { add(m.pagato_da, -T); for (const k in q) add(k, q[k]); }
    else { add(m.pagato_da, T); for (const k in q) add(k, -q[k]); } // spesa e trasferimento
    return e;
  }
  function saldi(movimenti, partecipanti) {
    const s = {}; (partecipanti || []).forEach(p => { s[p.id] = 0; });
    (movimenti || []).forEach(m => { const e = effetti(m); for (const k in e) s[k] = (s[k] || 0) + e[k]; });
    return s;
  }
  // Rimborsi suggeriti: il minor numero di passaggi, sempre dal più indebitato al più in credito
  function rimborsi(s) {
    const deb = [], cre = [];
    for (const k in s) { if (s[k] < 0) deb.push({ k, v: -s[k] }); else if (s[k] > 0) cre.push({ k, v: s[k] }); }
    deb.sort((a, b) => b.v - a.v || (a.k < b.k ? -1 : 1)); cre.sort((a, b) => b.v - a.v || (a.k < b.k ? -1 : 1));
    const out = []; let i = 0, j = 0;
    while (i < deb.length && j < cre.length) {
      const x = Math.min(deb[i].v, cre[j].v);
      if (x > 0) out.push({ da: deb[i].k, a: cre[j].k, importo: x });
      deb[i].v -= x; cre[j].v -= x;
      if (!deb[i].v) i++; if (!cre[j].v) j++;
    }
    return out;
  }
  function statistiche(movimenti, io) {
    let totale = 0, mio = 0, pagatoDaMe = 0; const perCat = {}, perMese = {}, perConto = {}, perVoce = {};
    (movimenti || []).forEach(m => {
      if (m.tipo === 'trasferimento') return;
      const T = inValutaGruppo(m), q = quote(m), segno = m.tipo === 'entrata' ? -1 : 1;
      totale += segno * T;
      const c = m.tipo === 'entrata' ? 'entrate' : (m.categoria || 'altro');
      perCat[c] = (perCat[c] || 0) + segno * T;
      const co = m.conto_id || ''; perConto[co] = (perConto[co] || 0) + segno * T;
      const vo = co + '|' + (m.tipo === 'entrata' ? 'Entrate' : (m.categoria || 'Senza voce')); perVoce[vo] = (perVoce[vo] || 0) + segno * T;
      const mese = String(m.data || '').slice(0, 7); perMese[mese] = (perMese[mese] || 0) + segno * T;
      if (io) { mio += segno * (q[io] || 0); if (m.pagato_da === io && m.tipo === 'spesa') pagatoDaMe += T; }
    });
    return { totale, mio, pagatoDaMe, perCat, perMese, perConto, perVoce };
  }
  // "12,50" o "12.5" → 1250
  function centesimi(testo) {
    const t = String(testo ?? '').trim().replace(/\s/g, '').replace(/€/g, '');
    if (!t) return NaN;
    let n = t;
    if (n.includes(',') && n.includes('.')) n = n.lastIndexOf(',') > n.lastIndexOf('.') ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, '');
    else n = n.replace(',', '.');
    if (!/^-?\d*(\.\d*)?$/.test(n) || n === '.' || n === '') return NaN;
    return Math.round(parseFloat(n) * 100);
  }
  function soldi(cent, valuta) {
    try { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: valuta || 'EUR' }).format((cent || 0) / 100); }
    catch (e) { return ((cent || 0) / 100).toFixed(2).replace('.', ',') + ' ' + (valuta || ''); }
  }
  const api = { CATEGORIE, VALUTE, ripartisci, inValutaGruppo, quote, effetti, saldi, rimborsi, statistiche, centesimi, soldi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Conti = api;
})(typeof window !== 'undefined' ? window : globalThis);
