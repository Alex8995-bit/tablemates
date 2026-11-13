// Ricetta a schermo intero (ingredienti dal piano, in casa o da comprare, passaggi), ricette salvate e modalità cucina.
const preferiteDi = () => (IO && D.stato['preferite:' + IO]) || [];
const ILLU_PIATTO = '<svg class="illu" width="150" height="150" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#FFFFFF"/><circle cx="50" cy="50" r="32" fill="none" stroke="#BFE3CC" stroke-width="2"/><ellipse cx="42" cy="46" rx="16" ry="11" fill="#F4B266"/><circle cx="62" cy="58" r="6" fill="#8FD0A8"/><circle cx="56" cy="66" r="5" fill="#8FD0A8"/><circle cx="66" cy="44" r="5" fill="#8FD0A8"/><circle cx="38" cy="62" r="5" fill="#F7E27A"/></svg>';
function contenitorePagina() { let e = $('pagina'); if (!e) { e = document.createElement('div'); e.id = 'pagina'; document.body.appendChild(e); } return e; }
function chiudiPagina() { const e = $('pagina'); if (e) e.innerHTML = ''; inerteSotto(false); rilasciaSchermo(); }

// "Petto di pollo 150 g" → nome e quantità
function dividiIngrediente(t) {
  const s = String(t || '').trim();
  const m = s.match(/^(.*?)[\s:,-]+((?:\d+(?:[.,]\d+)?|½|¼)\s*(?:g|gr|kg|ml|cl|l|pz|pezzi?|cucchiai(?:o|ni)?|cucchiaini?|spicchi?o?|fett[ae]|foglie|rametti?|pizzico|bicchier[ei]|tazz[ae]|vasett[io])?\.?|q\.?\s?b\.?)$/i);
  return m && m[1] ? { nome: m[1].trim(), qta: m[2].trim() } : { nome: s, qta: '' };
}
// Si guarda in Dispensa (Tocca un prodotto per dire quanto ne resta) e nella lista della spesa
function statoIngrediente(nome) {
  const n = senzaAccenti(nome), parola = n.split(/\s+/).find(w => w.length > 2) || n;
  const disp = dispensa().items, d = disp.find(x => { const k = senzaAccenti(x.nome); return k.includes(parola) || n.includes(k); });
  const inLista = D.spesa.some(x => !x.comprato && (senzaAccenti(x.nome).includes(parola) || n.includes(senzaAccenti(x.nome))));
  if (inLista) return 'lista';
  if (d) return d.livello >= 2 ? 'casa' : 'compra';
  return disp.length ? 'compra' : '';
}

async function apriRicetta(pid, gi, k) {
  const ric = ricetteDi(pid), x = ric[gi]?.[k]; if (!x) return; vibra();
  mostraRicettaPagina(x, { pid, gi, k });
  if (!x.ricetta && haAI()) {
    try {
      const p = pianoDi(pid).giorni[gi].pasti[k];
      x.ricetta = await ia([{ text: 'Scrivi la ricetta completa del piatto "' + x.nome + '" per questo pasto di dieta. ' + REGOLE + ' Riporta ogni ingrediente con la grammatura della dieta, nel formato "Ingrediente quantità" (es. "Petto di pollo 150 g"). Passaggi chiari e dettagliati, da 4 a 8; se un passaggio ha un tempo di cottura scrivilo in minuti (es. "8 min"). JSON: {"tempo":"","porzioni":"","difficolta":"","ingredienti":[""],"passaggi":[""],"consigli":""}. Pasto: ' + pastoPerIA(pid, gi, p) }]);
      D.stato['ricette:' + pid] = ric; if ($('pagina')?.querySelector('[data-ricetta]')) mostraRicettaPagina(x, { pid, gi, k });
      await salvaRicette(pid);
    } catch (e) {
      if ($('rcCorpo')) {
        $('rcCorpo').innerHTML = `<p class="q" style="color:var(--neg);line-height:1.5;margin:0">${esc(e.message)}</p><button type="button" class="btn" id="rcBase">Usa la ricetta base (senza IA)</button>`;
        $('rcBase').onclick = async () => { const b = CUOCO.crea(pid, gi, pianoDi(pid).giorni[gi].pasti[k]); b.da = x.da || CHI; ric[gi][k] = b; D.stato['ricette:' + pid] = ric; renderPiano(); renderOggi(); mostraRicettaPagina(b, { pid, gi, k }); await salvaRicette(pid); };
      } else toast(e.message);
    }
  }
}

function mostraRicettaPagina(x, ctx) {
  const R = x.ricetta, salvata = preferiteDi().some(r => r.nome === x.nome);
  const passi = R ? (R.passaggi || []) : String(x.preparazione || '').split(/\n+|(?=\b\d+[.)]\s)/).map(t => t.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  const ingr = (R ? R.ingredienti || [] : []).map(dividiIngrediente).map(i => ({ ...i, st: statoIngrediente(i.nome) }));
  const mancanti = ingr.filter(i => i.st === 'compra' || (i.st === '' && !dispensa().items.length));
  const tag = st => st === 'casa' ? '<span class="tag casa">In casa</span>' : st === 'compra' ? '<span class="tag compra">Da comprare</span>' : st === 'lista' ? '<span class="tag casa">In lista</span>' : '';
  const tempo = (R && R.tempo) || x.tempo;
  const h = `<div class="pagina" data-ricetta role="dialog" aria-modal="true" aria-labelledby="rcT">
    <div class="r-top"><button type="button" class="indietro" id="rcB" aria-label="Chiudi la ricetta">${ic('indietro', 22, 2)}</button>
      ${IO ? `<button type="button" class="indietro salva" id="rcS" aria-label="${salvata ? 'Togli dalle ricette salvate' : 'Salva ricetta'}" aria-pressed="${salvata}" style="right:16px;left:auto">${salvata ? ic('segnalibro', 20, 2).replace('fill="none"', 'fill="currentColor"') : ic('segnalibro', 20, 2)}</button>` : ''}
      ${ILLU_PIATTO}</div>
    <div class="r-corpo"><div style="display:flex;flex-direction:column;gap:10px"><h1 id="rcT">${esc(x.nome)}</h1>
      <div class="etich">${tempo ? `<span>${esc(tempo)}</span>` : ''}${R && R.porzioni ? `<span>${esc(/\d+$/.test(R.porzioni) ? R.porzioni + (R.porzioni === '1' ? ' persona' : ' persone') : R.porzioni)}</span>` : ''}${R && R.difficolta ? `<span>${esc(R.difficolta)}</span>` : ''}${ctx ? `<span class="ok">${ic('spunta', 14, 2.6)}Rispetta il piano</span>` : ''}${x.base ? '<span>Ricetta base</span>' : ''}</div></div>
      <div id="rcCorpo" style="display:flex;flex-direction:column;gap:16px">${!R && haAI() && ctx ? `<div class="vuoto"><div class="giro"></div><br>Preparo la ricetta con gli alimenti del piano…</div>` : ''}
      ${ingr.length ? `<section class="ingr" aria-labelledby="rcI"><h2 id="rcI">${ctx ? 'Ingredienti dal piano' : 'Ingredienti'}</h2>${ingr.map(i => `<div class="ir"><b>${esc(i.nome)}</b>${tag(i.st)}<span class="qt">${esc(i.qta)}</span></div>`).join('')}</section>` : ''}
      ${passi.length ? `<section class="passi" aria-labelledby="rcP"><h2 id="rcP">Procedimento</h2>${passi.map((t, n) => `<div class="passo"><i>${n + 1}</i><span>${esc(t)}</span></div>`).join('')}</section>` : ''}
      ${R && R.consigli ? `<div class="info-verde">${ic('info', 20, 2)}<span>${esc(R.consigli)}</span></div>` : ''}
      ${!R && !haAI() ? '<p class="by" style="margin:0">Per la ricetta completa con dosi e consigli serve un\'intelligenza artificiale (Impostazioni).</p>' : ''}</div>
    </div>
    <div class="barra-giu">${ingr.length ? `<button type="button" class="btn" id="rcM">${mancanti.length ? (dispensa().items.length ? 'Metti ' + (mancanti.length === 1 ? 'l\'ingrediente mancante' : 'i ' + mancanti.length + ' mancanti') + ' in spesa' : 'Metti gli ingredienti in spesa') : 'Hai già tutto'}</button>` : `<button type="button" class="btn bordo" id="rcB2">Chiudi</button>`}
      ${passi.length ? `<button type="button" class="quad" id="rcC" aria-label="Avvia la modalità cucina">${ic('play', 22, 1.8)}</button>` : ''}</div></div>`;
  contenitorePagina().innerHTML = h; inerteSotto(true);
  $('rcB').onclick = chiudiPagina; if ($('rcB2')) $('rcB2').onclick = chiudiPagina;
  if ($('rcS')) $('rcS').onclick = () => salvaPreferita(x, ctx);
  if ($('rcC')) $('rcC').onclick = () => modalitaCucina(x, passi, ingr);
  if ($('rcM')) $('rcM').onclick = async () => {
    if (!mancanti.length) return toast('Hai già tutto in casa');
    const righe = mancanti.map(i => ({ gruppo_id: G.id, nome: i.nome, quantita: i.qta, reparto: repartoDi(i.nome), giorno: 'Ricetta · ' + x.nome, comprato: false, aggiunto_da: CHI }));
    $('rcM').disabled = true;
    if (await scrivi(() => ST.ins('spesa', righe))) { await ricarica(); toast((righe.length === 1 ? '1 prodotto aggiunto' : righe.length + ' prodotti aggiunti') + ' alla Spesa ✓'); mostraRicettaPagina(x, ctx); }
  };
}

async function salvaPreferita(x, ctx) {
  if (!IO) return;
  const l = preferiteDi().slice(), i = l.findIndex(r => r.nome === x.nome);
  if (i >= 0) { l.splice(i, 1); toast('Tolta dalle ricette salvate'); }
  else { l.unshift({ nome: x.nome, tempo: x.tempo || '', preparazione: x.preparazione || '', ricetta: x.ricetta || null, salvata: oggiISO() }); toast('Ricetta salvata ✓ La ritrovi nel Piano'); }
  D.stato['preferite:' + IO] = l; mostraRicettaPagina(x, ctx); renderPiano();
  await scrivi(() => ST.salvaStato(G.id, 'preferite:' + IO, l));
}
function foglioPreferite() {
  const l = preferiteDi();
  foglio(`<h2>Ricette salvate</h2><p class="q" style="margin:4px 0 0">${l.length} ${l.length === 1 ? 'ricetta' : 'ricette'}</p><div class="menu-righe" style="margin-top:12px">${l.map((r, i) => `<button type="button" data-pf="${i}"><span class="t"><b>${esc(r.nome)}</b><small>${esc(r.tempo || '')}${r.salvata ? ' · salvata il ' + esc(new Date(r.salvata + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })) : ''}</small></span>${ic('avanti', 18, 2)}</button>`).join('')}</div>`);
  $('pop').querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { chiudi(); mostraRicettaPagina(l[+b.dataset.pf], null); });
}

// ---------- Modalità cucina: un passaggio alla volta, timer, schermo acceso, comandi a voce ----------
let _wake = null, _timer = null, _voce = null;
async function tieniSchermo() { try { if ('wakeLock' in navigator) { _wake = await navigator.wakeLock.request('screen'); return true; } } catch (e) {} return false; }
function rilasciaSchermo() { try { _wake && _wake.release(); } catch (e) {} _wake = null; clearInterval(_timer); _timer = null; try { _voce && _voce.stop(); } catch (e) {} _voce = null; }
function bip() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .35, .7].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.2, a.currentTime + t); o.start(a.currentTime + t); o.stop(a.currentTime + t + .2); }); } catch (e) {} try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {} }

function modalitaCucina(x, passi, ingr) {
  let step = 0, fine = 0, acceso = false, ascolto = false;
  const Riconosci = window.SpeechRecognition || window.webkitSpeechRecognition;
  const minuti = t => { const m = String(t).match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:min|minuti)\b/i); return m ? +(m[2] || m[1]) : 0; };
  const ingrDi = t => { const n = senzaAccenti(t); return ingr.filter(i => { const w = senzaAccenti(i.nome).split(/\s+/).find(z => z.length > 3); return w && n.includes(w); }); };
  const disegna = () => {
    const t = passi[step], last = step === passi.length - 1, min = minuti(t), resta = fine ? Math.max(0, Math.round((fine - Date.now()) / 1000)) : 0;
    contenitorePagina().innerHTML = `<div class="cucina" role="dialog" aria-modal="true" aria-label="Modalità cucina"><div class="in">
      <div class="top"><button type="button" class="x" id="ccX" aria-label="Chiudi modalità cucina">${ic('x', 20, 2)}</button>${acceso ? `<span class="acceso">${ic('sole', 16, 2)}Schermo sempre acceso</span>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:10px"><div class="segs" style="grid-template-columns:repeat(${passi.length},minmax(0,1fr))" aria-hidden="true">${passi.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
        <span class="lbl">Passo ${step + 1} di ${passi.length} · ${esc(x.nome)}</span></div>
      <p class="testo" aria-live="polite">${esc(t)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${ingrDi(t).map(i => `<span class="chip-c">${esc(i.nome + (i.qta ? ' ' + i.qta : ''))}</span>`).join('')}</div>
      ${min ? `<button type="button" class="timer ${fine ? 'va' : ''}" id="ccT">${ic('timer', 22, 2)}${fine ? (resta ? 'Mancano ' + String(Math.floor(resta / 60)).padStart(2, '0') + ':' + String(resta % 60).padStart(2, '0') + ' · ferma' : 'Tempo scaduto') : 'Avvia timer ' + min + ' min'}</button>` : ''}
      <div class="nav-c"><button type="button" class="ind" id="ccI" ${step === 0 ? 'disabled' : ''}>Indietro</button><button type="button" class="ava" id="ccA">${last ? 'Fatto, buon appetito' : 'Avanti'}</button></div>
      ${Riconosci ? `<button type="button" class="voce-c ${ascolto ? 'on' : ''}" id="ccV" aria-pressed="${ascolto}">${ascolto ? 'Ti ascolto: di\' "Avanti" o "Indietro"' : 'Puoi anche dire "Avanti" ad alta voce: tocca qui per attivare'}</button>` : ''}
    </div></div>`;
    inerteSotto(true);
    $('ccX').onclick = () => { rilasciaSchermo(); mostraRicettaPagina(x, null); };
    $('ccI').onclick = () => { if (step > 0) { step--; fine = 0; clearInterval(_timer); disegna(); } };
    $('ccA').onclick = () => { if (last) { rilasciaSchermo(); chiudiPagina(); toast('Buon appetito!'); return; } step++; fine = 0; clearInterval(_timer); vibra(); disegna(); };
    if ($('ccT')) $('ccT').onclick = () => {
      if (fine) { fine = 0; clearInterval(_timer); return disegna(); }
      fine = Date.now() + min * 60000; clearInterval(_timer);
      _timer = setInterval(() => { if (!$('ccT')) return clearInterval(_timer); if (Date.now() >= fine) { clearInterval(_timer); bip(); toast('Tempo scaduto: ' + x.nome); } disegna(); }, 1000);
      disegna();
    };
    if ($('ccV')) $('ccV').onclick = () => {
      if (ascolto) { ascolto = false; try { _voce.stop(); } catch (e) {} _voce = null; return disegna(); }
      try {
        _voce = new Riconosci(); _voce.lang = 'it-IT'; _voce.continuous = true; _voce.interimResults = false;
        _voce.onresult = e => { const t = senzaAccenti(e.results[e.results.length - 1][0].transcript); if (/avanti|prossimo|fatto/.test(t)) $('ccA') && $('ccA').click(); else if (/indietro|torna/.test(t)) $('ccI') && $('ccI').click(); };
        _voce.onend = () => { if (ascolto && _voce) try { _voce.start(); } catch (e) {} };
        _voce.onerror = e => { if (e.error === 'not-allowed') { ascolto = false; toast('Microfono non consentito'); disegna(); } };
        _voce.start(); ascolto = true; disegna();
      } catch (e) { toast('Comandi a voce non disponibili su questo dispositivo'); }
    };
  };
  tieniSchermo().then(v => { acceso = v; disegna(); });
  disegna();
}
