// Lettore di diete senza intelligenza artificiale: legge il PDF nel telefono (pdf.js) e ricostruisce giorni, pasti,
// alimenti e alternative dalla posizione del testo. Pensato per i piani "Nutribook"; se il PDF ha un'altra
// impaginazione restituisce null e l'app passa all'intelligenza artificiale.
const LETTORE = (() => {
  const SOGLIA_QTA = 280, SOGLIA_TITOLO = 100, TOL_RIGA = 2.5, MAX_CONTINUA = 12.5;
  const numero = t => t.replace(/\d+(?:[.,]\d+)?/g, m => { const n = parseFloat(m.replace(',', '.')); return isFinite(n) ? String(+n.toFixed(2)).replace('.', ',') : m; });
  const pulisci = t => t.replace(/(\d)\s*\u0000\s*(\d)/g, '$1-$2').replace(/\u0000/g, '(').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+/g, ' ').trim();
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
      const voce = { nome: r.testo, qta, misura };
      if (!alt || !r.sez.cur) { r.sez.voci = r.sez.voci || []; r.sez.voci.push(voce); r.sez.ultimo = voce; r.sez.cur = null; }
      else r.sez.cur.sost.push(voce);
      prec = { pag: r.pag, y: r.y, x0: r.x0, voce, sez: r.sez };
    }
    const txt = v => v.nome + (v.qta ? ' ' + v.qta : '') + (v.misura ? ' (' + v.misura + ')' : '');
    const giorni = []; let sicuro = true;
    for (const s of sezioni) {
      if (!s.voci || !s.voci.length) { sicuro = false; continue; }
      let g = giorni.find(x => x.giorno === s.giorno); if (!g) giorni.push(g = { giorno: s.giorno, pasti: [] });
      g.pasti.push({
        tipo: s.tipo, alimenti: s.voci.map(txt).join('; '),
        alternative: s.voci.filter(v => v.sost && v.sost.length).map(v => v.nome + ': ' + v.sost.map(txt).join(', ')).join('; '),
        ...(s.nota && s.nota.length ? { nota: s.nota.join('\n') } : {})
      });
    }
    if (!giorni.length) return null;
    if (giorni.some(g => g.pasti.length < 2)) sicuro = false;
    return { giorni, sicuro };
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
  return { parsaDieta, leggi };
})();
if (typeof module !== 'undefined') module.exports = LETTORE;
