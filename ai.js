// Intelligenza artificiale: Gemini, Groq, ChatGPT o Claude. Vale la chiave personale di questo dispositivo;
// se non c'è, quella che qualcuno ha condiviso con tutto il gruppo.
function iaAttiva() {
  const prov = LS.get('aiProv'), chiave = LS.get('gKey');
  if (prov === 'off') return { prov: 'nessuna', chiave: '', condivisa: false };
  if (prov && prov !== 'nessuna' && chiave) return { prov, chiave, condivisa: false };
  const g = (typeof D !== 'undefined' && D.stato && D.stato.ia) || null;
  if (g && g.prov && g.prov !== 'nessuna' && g.chiave) return { prov: g.prov, chiave: g.chiave, condivisa: true, da: g.da };
  // nessuna chiave: si usa l'intelligenza artificiale del server (funzione "cucina" con la chiave Groq salvata su Supabase)
  if (LS.get('iaServer') === 'si' && typeof ST !== 'undefined' && ST && ST.modo === 'supabase') return { prov: 'server', chiave: '', condivisa: true, da: 'server' };
  return { prov: 'nessuna', chiave: '', condivisa: false };
}
const AI = () => iaAttiva().prov;
const haAI = () => !ANTEPRIMA && AI() !== 'nessuna';

// Attesa visibile mentre l'IA lavora: resta aperta finché non finisce, poi mostra l'esito
function attesaIA(titolo, testo) {
  foglio(`<div style="text-align:center;padding:8px 0 2px" role="status" aria-live="polite"><div class="giro" id="atG" aria-hidden="true"></div><h2 style="margin:14px 0 6px">${esc(titolo)}</h2><p class="q" id="atT" style="line-height:1.5;margin:0 0 4px">${esc(testo)}</p><button class="btn" id="atX" type="button" hidden style="margin-top:12px">Chiudi</button></div>`, { fisso: true, senzaX: true });
  window._atTesto = m => { if ($('atT')) $('atT').textContent = m; };
  return {
    fine() { window._atTesto = null; chiudi(); },
    testo(m) { if ($('atT')) $('atT').textContent = m; },
    errore(m, alt) {
      if (!$('atT')) return toast(m, alt);
      $('atG').hidden = true; $('atT').textContent = m; $('atT').style.color = 'var(--neg)'; $('atX').hidden = false; $('atX').onclick = chiudi;
      if (alt) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.id = 'atAlt'; b.style.marginTop = '12px'; b.textContent = alt.testo; b.onclick = () => { chiudi(); alt.fn(); }; $('atX').before(b); $('atX').className = 'btn ghost'; $('atX').style.marginTop = '0'; }
    }
  };
}
const NOMI_IA = { gemini: 'Gemini', groq: 'Groq', openai: 'ChatGPT', claude: 'Claude', server: 'Tablemates (server)' };
// All'accesso: il server ha l'intelligenza artificiale? (segreto GROQ_API_KEY nella funzione "cucina")
async function controllaIAServer() {
  if (ANTEPRIMA || !ST || ST.modo !== 'supabase') return;
  try { const r = await ST.cucina({ azione: 'stato' }); const v = r && r.ia ? 'si' : 'no'; if (v !== LS.get('iaServer')) { LS.set('iaServer', v); renderTutto(); } }
  catch (e) { if (/non è ancora pubblicata/.test(e.message) && LS.get('iaServer')) { LS.del('iaServer'); renderTutto(); } }
}
// Chiamata di rete con tempo massimo ed errori in italiano
async function chiamaIA(prov, url, opz) {
  const nome = NOMI_IA[prov] || 'l\'IA', ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 170000);
  let r; try { r = await fetch(url, { ...opz, signal: ctrl.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? nome + ' ci sta mettendo troppo. Riprova tra poco.' : 'Non riesco a collegarmi a ' + nome + '. Controlla la connessione e riprova.' + (prov === 'groq' ? ' Se la connessione c\'è, usa Gemini: Groq potrebbe non accettare chiamate da questa app.' : '')); }
  finally { clearTimeout(t); }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    const m = (j && (j.error?.message || j.message)) || '';
    if ([400, 403, 404].includes(r.status) && /model|not found|no longer|not available|deprecat|not supported/i.test(m) && !/api.?key/i.test(m)) { const e = new Error(nome + ': modello non disponibile (' + m.slice(0, 120) + ')'); e.stato = 404; throw e; }
    if (prov === 'gemini' && (/prepay|credits?.{0,20}(depleted|required|exhaust)|free.?tier|limit: ?0|enable billing|billing/i.test(m) || r.status === 402)) throw new Error('Gemini ora richiede crediti a pagamento per questa chiave. Per usare l\'app senza spendere passa a Groq (gratuito): Impostazioni → Intelligenza artificiale → Groq.');
    if (/credit balance|insufficient.?quota|billing/i.test(m)) throw new Error('L\'account di ' + nome + ' non ha credito. Aggiungi credito dalla sezione di fatturazione (Billing) del suo sito e riprova.');
    if (r.status === 429 || /quota|rate.?limit|exhaust/i.test(m)) throw new Error('Hai finito le richieste gratuite di ' + nome + ' per ora. Riprova tra qualche minuto o domani.' + (prov === 'gemini' ? ' Se succede sempre, Gemini potrebbe richiedere crediti: passa a Groq (gratuito) da Impostazioni → Intelligenza artificiale.' : ''));
    if (r.status === 401 || r.status === 403 || /api.?key|credential|permission/i.test(m)) throw new Error('La chiave di ' + nome + ' non è valida o non ha il permesso. Controlla di averla copiata intera, senza spazi.');
    if (r.status === 503 || r.status === 500 || r.status === 529 || /high demand|overloaded|unavailable/i.test(m)) { const e = new Error(nome + ' è molto richiesto in questo momento.'); e.stato = 503; e.riprova = true; throw e; }
    if (r.status === 413 || /too large|exceeds|size/i.test(m)) throw new Error('Il file è troppo grande per ' + nome + '. Prova con un PDF più leggero.');
    const e = new Error(nome + ': ' + (m || 'errore ' + r.status)); e.stato = r.status; throw e;
  }
  return j;
}
function leggiJSON(t, troncata) {
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  try { if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)); } catch (e) {}
  throw new Error(troncata ? 'La dieta è troppo lunga per una sola lettura. Caricala a pezzi (meno giorni per volta) oppure inseriscila a mano.' : 'L\'IA ha risposto in un formato che non riesco a leggere. Riprova.');
}
// Modelli in ordine di preferenza: se uno non è disponibile per la chiave (ritirato o riservato a chi lo usava già) si passa al successivo
const MODELLI_GEMINI = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
// Groq ha ritirato Llama 4 Scout e Llama 3.3 per il piano gratuito (luglio-agosto 2026): ora GPT-OSS e Qwen
const MODELLI_GROQ = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
const MODELLI_CLAUDE = ['claude-sonnet-5-5', 'claude-sonnet-4-5'];
const PAUSE_RIPROVA = window.PAUSE_RIPROVA || [4000, 10000, 20000];
const attendi = ms => new Promise(r => setTimeout(r, ms));

// Groq non legge i PDF: il testo si estrae qui, nel telefono, con pdf.js (caricato solo quando serve)
let _pdfjs = null;
function caricaPdfjs() {
  if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js'; return Promise.resolve(window.pdfjsLib); }
  return _pdfjs || (_pdfjs = new Promise((ok, no) => {
    const sc = document.createElement('script'); sc.src = 'pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js'; ok(window.pdfjsLib); };
    sc.onerror = () => { _pdfjs = null; no(new Error('Non riesco a caricare il lettore di PDF. Controlla la connessione e riprova.')); };
    document.head.appendChild(sc);
  }));
}
async function testoDaPDF(b64) {
  const lib = await caricaPdfjs(), bin = atob(b64), dati = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) dati[i] = bin.charCodeAt(i);
  let doc; try { doc = await lib.getDocument({ data: dati }).promise; } catch (e) { throw new Error('Non riesco ad aprire questo PDF.'); }
  let out = '';
  for (let n = 1; n <= doc.numPages; n++) {
    const pag = await doc.getPage(n), c = await pag.getTextContent();
    let riga = '', y = null;
    for (const it of c.items) {
      const yy = it.transform ? Math.round(it.transform[5]) : null;
      if (y !== null && yy !== null && Math.abs(yy - y) > 2) { out += riga.trim() + '\n'; riga = ''; }
      riga += it.str + (it.hasEOL ? '\n' : ' '); if (yy !== null) y = yy;
    }
    out += riga.trim() + '\n\n';
  }
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (out.length < 80) throw new Error('Questo PDF sembra una foto o una scansione: Groq legge solo PDF con testo selezionabile. Usa Gemini oppure scrivi la dieta a mano.');
  return out.slice(0, 40000);
}

async function ia(parts) {
  const { prov: p, chiave: K } = iaAttiva();
  if (p === 'gemini') {
    // Se un modello è ritirato (404) o sovraccarico (503) prova gli altri e poi riprova con calma
    let ultimo, giro = 0;
    for (;;) {
      let sovraccarico = false;
      for (const modello of MODELLI_GEMINI) {
        try {
          const j = await chiamaIA(p, 'https://generativelanguage.googleapis.com/v1beta/models/' + modello + ':generateContent?key=' + encodeURIComponent(K), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 32768 } })
          });
          const c = j.candidates?.[0], testo = (c?.content?.parts || []).map(x => x.text || '').join('');
          if (!testo) throw new Error(j.promptFeedback?.blockReason || c?.finishReason === 'SAFETY' ? 'Gemini ha rifiutato questo contenuto.' : 'Gemini non ha dato nessuna risposta. Riprova.');
          return leggiJSON(testo, c.finishReason === 'MAX_TOKENS');
        } catch (e) { ultimo = e; if (e.riprova) sovraccarico = true; else if (e.stato !== 404) throw e; }
      }
      if (!sovraccarico || giro >= PAUSE_RIPROVA.length) break;
      if (window._atTesto) window._atTesto('Gemini è molto richiesto: riprovo tra pochi secondi… (tentativo ' + (giro + 2) + ' di ' + (PAUSE_RIPROVA.length + 1) + ')');
      await attendi(PAUSE_RIPROVA[giro++]);
      if (window._atTesto) window._atTesto('Riprovo con Gemini…');
    }
    if (ultimo && ultimo.riprova) throw new Error('Gemini è troppo richiesto in questo momento: succede nelle ore di punta con il piano gratuito. Riprova tra qualche minuto (meglio la sera tardi o la mattina presto).');
    throw ultimo;
  }
  const txt = parts.filter(x => x.text).map(x => x.text).join('\n') + '\nRispondi SOLO con JSON valido.';
  const pdf = parts.find(x => x.inline_data)?.inline_data.data;
  if (p === 'server') {
    let testo = txt; if (pdf) testo += '\n\nTESTO ESTRATTO DAL PDF:\n' + await testoDaPDF(pdf);
    const r = await ST.cucina({ azione: 'ia', testo });
    if (!r || !r.dati) throw new Error('L\'intelligenza artificiale non ha risposto. Riprova.');
    return r.dati;
  }
  if (p === 'groq') {
    let testo = txt;
    if (pdf) testo += '\n\nTESTO ESTRATTO DAL PDF:\n' + await testoDaPDF(pdf);
    let ultimo, giro = 0;
    for (;;) {
      let sovraccarico = false;
      for (const modello of MODELLI_GROQ) {
        try {
          const j = await chiamaIA(p, 'https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + K },
            body: JSON.stringify(Object.assign({ model: modello, response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 12000, messages: [{ role: 'user', content: testo }] }, /gpt-oss/.test(modello) ? { reasoning_effort: 'low' } : {}))
          });
          return leggiJSON(j.choices?.[0]?.message?.content || '', j.choices?.[0]?.finish_reason === 'length');
        } catch (e) { ultimo = e; if (e.riprova) sovraccarico = true; else if (!(e.stato === 404 || (e.stato === 400 && /model|json|generate/i.test(e.message)))) throw e; }
      }
      if (!sovraccarico || giro >= PAUSE_RIPROVA.length) break;
      if (window._atTesto) window._atTesto('Groq è molto richiesto: riprovo tra pochi secondi… (tentativo ' + (giro + 2) + ' di ' + (PAUSE_RIPROVA.length + 1) + ')');
      await attendi(PAUSE_RIPROVA[giro++]);
    }
    if (ultimo && ultimo.riprova) throw new Error('Groq è troppo richiesto in questo momento. Riprova tra qualche minuto.');
    throw ultimo;
  }
  if (p === 'openai') {
    const content = [{ type: 'text', text: txt }];
    if (pdf) content.unshift({ type: 'file', file: { filename: 'dieta.pdf', file_data: 'data:application/pdf;base64,' + pdf } });
    const j = await chiamaIA(p, 'https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + K },
      body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] })
    });
    return leggiJSON(j.choices?.[0]?.message?.content || '', j.choices?.[0]?.finish_reason === 'length');
  }
  if (p === 'claude') {
    const content = [{ type: 'text', text: txt }];
    if (pdf) content.unshift({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } });
    let ultimo, giro = 0;
    for (;;) {
      let sovraccarico = false;
      for (const modello of MODELLI_CLAUDE) {
        try {
          const j = await chiamaIA(p, 'https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': K, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: modello, max_tokens: 16000, messages: [{ role: 'user', content }] })
          });
          return leggiJSON(j.content?.[0]?.text || '', j.stop_reason === 'max_tokens');
        } catch (e) { ultimo = e; if (e.riprova) sovraccarico = true; else if (e.stato !== 404) throw e; }
      }
      if (!sovraccarico || giro >= PAUSE_RIPROVA.length) break;
      if (window._atTesto) window._atTesto('Claude è molto richiesto: riprovo tra pochi secondi… (tentativo ' + (giro + 2) + ' di ' + (PAUSE_RIPROVA.length + 1) + ')');
      await attendi(PAUSE_RIPROVA[giro++]);
    }
    if (ultimo && ultimo.riprova) throw new Error('Claude è troppo richiesto in questo momento. Riprova tra qualche minuto.');
    throw ultimo;
  }
  throw new Error('Nessuna intelligenza artificiale attiva');
}
