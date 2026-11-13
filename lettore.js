// Lettore di diete senza intelligenza artificiale: legge il PDF nel telefono (pdf.js) e ricostruisce giorni, pasti,
// alimenti e alternative dalla posizione del testo. Pensato per i piani "Nutribook"; se il PDF ha un'altra
// impaginazione restituisce null e l'app passa all'intelligenza artificiale.
const LETTORE = (() => {
  const SOGLIA_QTA = 280, SOGLIA_TITOLO = 100, TOL_RIGA = 2.5, MAX_CONTINUA = 12.5;
  const numero = t => t.replace(/\d+(?:[.,]\d+)?/g, m => { const n = parseFloat(m.replace(',', '.')); return isFinite(n) ? String(+n.toFixed(1)).replace('.', ',') : m; });
  const pulisci = t => t.replace(/(\d)\s*\u0000\s*(\d)/g, '$1-$2').replace(/\u0000/g, '(').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+/g, ' ').trim();
  const SLOT = ['Colazione', 'Spuntino mattina', 'Pranzo', 'Spuntino pomeriggio', 'Cena'];
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const slot = t => { const x = norm(t); if (/colazione/.test(x)) return SLOT[0]; if (/pomeriggio|merenda|arco/.test(x)) return SLOT[3]; if (/spuntino/.test(x)) return SLOT[1]; if (/pranzo/.test(x)) return SLOT[2]; if (/cena/.test(x)) return SLOT[4]; return String(t).trim(); };
  const fmt = n => String(+Number(n).toFixed(1)).replace('.', ',');
  const testoVoce = v => v.nome + (v.qta != null ? ' ' + fmt(v.qta) + (v.unita ? ' ' + v.unita : '') : '') + (v.misura ? ' (' + v.misura + ')' : '');
  const parseQta = t => { const m = String(t || '').match(/^([\d.,]+)\s*([a-zA-Z]*)/); if (!m) return { qta: null, unita: '' }; const n = parseFloat(m[1].replace(',', '.')); const u = m[2].toLowerCase(); return { qta: isFinite(n) ? n : null, unita: ['g', 'ml', 'kg', 'l', 'cl'].includes(u) ? u : '' }; };
  const rumore = it => /powered by nutribook/i.test(it.s) || (it.y < 45 && /^\d+$/.test(it.s.trim()));

  // pagine = [[{ s, x, y }]] → { giorni:[{giorno, pasti:[{tipo, alimenti, alternative}]}], sicuro }
  function parsaDieta(pagine) {
    const righe = []; // { pag, y, x0, testo, qta:[], sez }
    let sez = null; const sezioni = [];
    pagine.forEach((items, pag) => {
      items = items.filter(it => it.s.trim() && !rumore(it)).sort((a, b) => b.y - a.y || a.x - b.x);
      const nomi = items.filter(it => it.x < SOGLIA_QTA), quantita = items.filter(it => it.x >= SOGLIA_QTA);
      const linee = [];
      for (const it of nomi) { const l = linee[linee.length - 1]; if (l && Math.abs(l.y - it.y) <= TOL_RIGA) l.parti.push(it); else linee.push({ y: it.y, parti: [it] }); }
      const dellaPagina = [];
      for (const l of linee) {
        l.parti.sort((a, b) => a.x - b.x);
        const x0 = l.parti[0].x, testo = pulisci(l.parti.map(p => p.s).join(' '));
        if (x0 > SOGLIA_TITOLO) { // titolo centrato: "Lunedì - Pranzo" apre una sezione, qualsiasi altro titolo la chiude
          const m = testo.match(/^(.+?)\s+-\s+(.+)$/);
          if (m && l.parti.length === 1) { sez = { giorno: m[1].trim(), tipo: m[2].trim(), righe: [] }; sezioni.push(sez); } else sez = null;
          continue;
        }
        const r = { pag, y: l.y, x0, testo, qta: [], sez };
        righe.push(r); dellaPagina.push(r);
      }
      // ogni quantità va alla riga più vicina in verticale
      for (const q of quantita) {
        let best = null, d = 1e9;
        for (const r of dellaPagina) { const dd = Math.abs(r.y - q.y); if (dd < d) { d = dd; best = r; } }
        if (best && d <= 12) best.qta.push(q);
      }
    });
    const dentro = righe.filter(r => r.sez);
    if (!dentro.length) return null;
    const conQta = dentro.filter(r => r.qta.length);
    if (!conQta.length) return null;
    const xPrincipale = Math.min(...conQta.map(r => r.x0));
    // costruzione delle voci
    let prec = null;
    for (const r of dentro) {
      if (r.sez !== (prec && prec.sez)) prec = null;
      const marc = r.testo.match(/^Puoi sostituire (.+?)\s*con:?$/i);
      if (marc) { r.sez.mode = 'alt'; r.sez.ultimo && (r.sez.ultimo.sost = r.sez.ultimo.sost || []); r.sez.cur = r.sez.ultimo; continue; }
      let qta = '', misura = '';
      if (r.qta.length) {
        const q = r.qta.sort((a, b) => Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x).map(p => p.s.trim()).join(' ');
        const [sx, dx] = q.split(/\boppure\b/i); qta = numero((sx || '').trim()); misura = numero((dx || '').trim());
      }
      const alt = r.x0 > xPrincipale + 4;
      if (!r.qta.length) {
        // note del nutrizionista: "Nota a Colazione" e il testo sotto, oppure righe più a sinistra delle voci
        if (/^Nota\b/i.test(r.testo)) { r.sez.inNota = true; continue; }
        if (r.sez.inNota || r.x0 < xPrincipale - 4) { if (!r.sez.chiusa) (r.sez.nota = r.sez.nota || []).push(r.testo); continue; }
        // seconda riga di un nome andato a capo
        if (prec && prec.pag === r.pag && Math.abs(prec.y - r.y) <= MAX_CONTINUA && Math.abs(prec.x0 - r.x0) < 3) { prec.voce.nome += ' ' + r.testo; continue; }
        if (!(r.testo.length <= 60 && !/^[-•*]/.test(r.testo) && r.testo !== r.testo.toUpperCase())) { r.sez.chiusa = true; }
      } else r.sez.inNota = false;
      if (r.sez.chiusa) continue;
      const voce = { nome: r.testo.replace(/\s*\(media\)/gi, '').trim(), ...parseQta(qta), misura };
      if (!alt || !r.sez.cur) { r.sez.voci = r.sez.voci || []; r.sez.voci.push(voce); r.sez.ultimo = voce; r.sez.cur = null; }
      else r.sez.cur.sost.push(voce);
      prec = { pag: r.pag, y: r.y, x0: r.x0, voce, sez: r.sez };
    }
    const giorni = []; let sicuro = true;
    for (const sz of sezioni) {
      if (!sz.voci || !sz.voci.length) { sicuro = false; continue; }
      let g = giorni.find(x => x.giorno === sz.giorno); if (!g) giorni.push(g = { giorno: sz.giorno, pasti: [] });
      const tipo = slot(sz.tipo); let pa = g.pasti.find(x => x.tipo === tipo);
      if (!pa) g.pasti.push(pa = { tipo, voci: [] });
      sz.voci.forEach(v => pa.voci.push({ nome: v.nome, qta: v.qta, unita: v.unita, misura: v.misura, sost: (v.sost || []).map(x => ({ nome: x.nome, qta: x.qta, unita: x.unita, misura: x.misura })) }));
      if (sz.nota && sz.nota.length) pa.nota = (pa.nota ? pa.nota + '\n' : '') + sz.nota.join('\n');
    }
    for (const g of giorni) {
      g.pasti.sort((x, y) => { const i = SLOT.indexOf(x.tipo), j = SLOT.indexOf(y.tipo); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
      // testo semplice di riserva (chat, assistente, modifica a mano): le voci restano la fonte vera
      g.pasti.forEach(pa => {
        pa.alimenti = pa.voci.map(testoVoce).join('; ');
        pa.alternative = pa.voci.filter(v => v.sost.length).map(v => v.nome + ': ' + v.sost.map(testoVoce).join(', ')).join('; ');
      });
    }
    if (!giorni.length) return null;
    if (giorni.some(g => g.pasti.length < 2)) sicuro = false;
    return { giorni, sicuro };
  }


  // PDF di altri formati: lettura del testo riga per riga (giorni, pasti, alimenti con grammature, "oppure").
  // È meno precisa: il risultato passa sempre dalla schermata di controllo prima di essere salvato.
  const NOMI_G = { lunedi: 'Lunedì', martedi: 'Martedì', mercoledi: 'Mercoledì', giovedi: 'Giovedì', venerdi: 'Venerdì', sabato: 'Sabato', domenica: 'Domenica' };
  const UNITA = u => { u = norm(u).replace(/\.$/, ''); return /^(g|gr|grammi|grammo)$/.test(u) ? 'g' : /^(ml|millilitri)$/.test(u) ? 'ml' : u === 'kg' ? 'kg' : u === 'cl' ? 'cl' : u === 'l' ? 'l' : ''; };
  function voceDaTesto(s) {
    s = String(s || '').replace(/^[-•*·]\s*/, '').trim(); if (!s) return null;
    let m = s.match(/^(.*?)[\s:]+(\d+(?:[.,]\d+)?)\s*(g|gr|grammi|ml|kg|cl|l)\b\.?\s*(?:\((.*?)\))?\s*(?:oppure\s+(.*)|(.*))$/i);
    if (m && m[1].trim()) return { nome: (m[1].trim().replace(/[:\-–]$/, '').trim() + (m[6] && m[6].trim() ? ' ' + m[6].trim() : '')), qta: parseFloat(m[2].replace(',', '.')), unita: UNITA(m[3]), misura: (m[4] || m[5] || '').trim(), sost: [] };
    m = s.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|grammi|ml|kg|cl|l)\b\.?\s+(?:di\s+)?(.+)$/i);
    if (m) return { nome: m[3].trim(), qta: parseFloat(m[1].replace(',', '.')), unita: UNITA(m[2]), misura: '', sost: [] };
    m = s.match(/^(.*?)\s+(\d+\s*(?:cucchiai[oi]?|cucchiaini?|tazzin[ae]|tazz[ae]|vasetti?|vasetto|frutti?|fette|fetta|uova|uovo|pezzi?|bicchieri?|bicchiere|porzion[ei])\b.*)$/i);
    if (m) return { nome: m[1].trim(), qta: null, unita: '', misura: m[2].trim(), sost: [] };
    return { nome: s, qta: null, unita: '', misura: '', sost: [] };
  }
  function parsaTesto(testo) {
    const righe = String(testo || '').split(/\n+/).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const reGiorno = /^(luned[iìÌ]|marted[iìÌ]|mercoled[iìÌ]|gioved[iìÌ]|venerd[iìÌ]|sabato|domenica|giorno\s*\d+)(?![a-zà-ü])\.?/i;
    const rePasto = /^(prima colazione|colazione|spuntino(?:\s+(?:di\s+|del\s+)?(?:mattina|mattutino|metà mattina|pomeriggio|pomeridiano))?|merenda|pranzo|cena|nell'arco della giornata)\b\s*[:\-–]?\s*/i;
    const reAlt = /^(oppure|in alternativa|alternativa|o in alternativa|puoi sostituire[^:]*:?|sostituibile con)\s*[:,]?\s*/i;
    const reQta = /\d+(?:[.,]\d+)?\s*(g|gr|grammi|ml|kg|cl)\b/i;
    const giorni = []; let g = null, pa = null, ultima = null, inAlt = false;
    const vaiGiorno = n => { g = giorni.find(x => x.giorno === n); if (!g) giorni.push(g = { giorno: n, pasti: [] }); pa = null; ultima = null; };
    const vaiPasto = t => { if (!g) vaiGiorno('Giorno 1'); const tipo = slot(t); pa = g.pasti.find(x => x.tipo === tipo); if (!pa) g.pasti.push(pa = { tipo, voci: [] }); ultima = null; inAlt = false; };
    for (let r of righe) {
      let m = r.match(reGiorno);
      if (m) { const k = norm(m[1]).replace(/\s+/g, ' '); vaiGiorno(NOMI_G[k] || k.replace(/^giorno\s*/, 'Giorno ')); r = r.slice(m[0].length).replace(/^\s*[-–:]\s*/, ''); if (!r) continue; }
      m = r.match(rePasto);
      if (m) { vaiPasto(m[1]); r = r.slice(m[0].length); if (!r) continue; }
      if (!pa) continue;
      const alt = reAlt.test(r); if (alt) { r = r.replace(reAlt, ''); inAlt = true; if (!r) continue; }
      const pezzi = reQta.test(r) ? r.split(/\s*[;,]\s+|\s+\+\s+/).filter(Boolean) : [r];
      for (const pz of pezzi) {
        if (!reQta.test(pz) && pz.length > 60) { pa.nota = (pa.nota ? pa.nota + '\n' : '') + pz; continue; }
        const v = voceDaTesto(pz); if (!v) continue;
        if ((alt || inAlt) && ultima) { delete v.sost; ultima.sost.push(v); }
        else { pa.voci.push(v); ultima = v; }
      }
      if (!alt) inAlt = false;
    }
    giorni.forEach(gg => { gg.pasti = gg.pasti.filter(x => x.voci.length || x.nota); gg.pasti.sort((x, y) => { const i = SLOT.indexOf(x.tipo), j = SLOT.indexOf(y.tipo); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }); });
    const ok = giorni.filter(gg => gg.pasti.length);
    return ok.length ? { giorni: ok, sicuro: false } : null;
  }

  async function leggi(buffer) {
    const lib = await caricaPdfjs();
    let doc; try { doc = await lib.getDocument({ data: new Uint8Array(buffer) }).promise; } catch (e) { return null; }
    const pagine = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const c = await (await doc.getPage(n)).getTextContent();
      pagine.push(c.items.filter(i => i.transform).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5] })));
    }
    return parsaDieta(pagine);
  }
  return { parsaDieta, parsaTesto, voceDaTesto, leggi, SLOT, slot, testoVoce, fmt };
})();
if (typeof module !== 'undefined') module.exports = LETTORE;
