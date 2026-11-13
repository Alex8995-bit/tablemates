// Intelligenza artificiale: Gemini, ChatGPT o Claude. Vale la chiave personale di questo dispositivo;
// se non c'è, quella che qualcuno ha condiviso con tutto il gruppo.
function iaAttiva() {
  const prov = LS.get('aiProv'), chiave = LS.get('gKey');
  if (prov === 'off') return { prov: 'nessuna', chiave: '', condivisa: false };
  if (prov && prov !== 'nessuna' && chiave) return { prov, chiave, condivisa: false };
  const g = (typeof D !== 'undefined' && D.stato && D.stato.ia) || null;
  if (g && g.prov && g.prov !== 'nessuna' && g.chiave) return { prov: g.prov, chiave: g.chiave, condivisa: true, da: g.da };
  return { prov: 'nessuna', chiave: '', condivisa: false };
}
const AI = () => iaAttiva().prov;
const haAI = () => !ANTEPRIMA && AI() !== 'nessuna';

// Attesa visibile mentre l'IA lavora: resta aperta finché non finisce, poi mostra l'esito
function attesaIA(titolo, testo) {
  foglio(`<div style="text-align:center;padding:8px 0 2px" role="status" aria-live="polite"><div class="giro" id="atG" aria-hidden="true"></div><h2 style="margin:14px 0 6px">${esc(titolo)}</h2><p class="q" id="atT" style="line-height:1.5;margin:0 0 4px">${esc(testo)}</p><button class="btn" id="atX" type="button" hidden style="margin-top:12px">Chiudi</button></div>`, { fisso: true, senzaX: true });
  return {
    fine: chiudi,
    errore(m) { if (!$('atT')) return toast(m); $('atG').hidden = true; $('atT').textContent = m; $('atT').style.color = 'var(--neg)'; $('atX').hidden = false; $('atX').onclick = chiudi; }
  };
}
const NOMI_IA = { gemini: 'Gemini', openai: 'ChatGPT', claude: 'Claude' };
// Chiamata di rete con tempo massimo ed errori in italiano
async function chiamaIA(prov, url, opz) {
  const nome = NOMI_IA[prov] || 'l\'IA', ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 170000);
  let r; try { r = await fetch(url, { ...opz, signal: ctrl.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? nome + ' ci sta mettendo troppo. Riprova tra poco.' : 'Non riesco a collegarmi a ' + nome + '. Controlla la connessione e riprova.'); }
  finally { clearTimeout(t); }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    const m = (j && (j.error?.message || j.message)) || '';
    if (r.status === 429 || /quota|rate.?limit|exhaust/i.test(m)) throw new Error('Hai finito le richieste gratuite di ' + nome + ' per ora. Riprova tra qualche minuto o domani.');
    if (r.status === 401 || r.status === 403 || /api.?key|credential|permission/i.test(m)) throw new Error('La chiave di ' + nome + ' non è valida o non ha il permesso. Controlla di averla copiata intera, senza spazi.');
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
const MODELLI_GEMINI = ['gemini-2.5-flash', 'gemini-flash-latest'];

async function ia(parts) {
  const { prov: p, chiave: K } = iaAttiva();
  if (p === 'gemini') {
    let ultimo;
    for (const modello of MODELLI_GEMINI) {
      try {
        const j = await chiamaIA(p, 'https://generativelanguage.googleapis.com/v1beta/models/' + modello + ':generateContent?key=' + encodeURIComponent(K), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 32768 } })
        });
        const c = j.candidates?.[0], testo = (c?.content?.parts || []).map(x => x.text || '').join('');
        if (!testo) throw new Error(j.promptFeedback?.blockReason || c?.finishReason === 'SAFETY' ? 'Gemini ha rifiutato questo contenuto.' : 'Gemini non ha dato nessuna risposta. Riprova.');
        return leggiJSON(testo, c.finishReason === 'MAX_TOKENS');
      } catch (e) { ultimo = e; if (e.stato !== 404) throw e; }  // modello ritirato: prova il successivo
    }
    throw ultimo;
  }
  const txt = parts.filter(x => x.text).map(x => x.text).join('\n') + '\nRispondi SOLO con JSON valido.';
  const pdf = parts.find(x => x.inline_data)?.inline_data.data;
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
    const j = await chiamaIA(p, 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': K, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 8000, messages: [{ role: 'user', content }] })
    });
    return leggiJSON(j.content?.[0]?.text || '', j.stop_reason === 'max_tokens');
  }
  throw new Error('Nessuna intelligenza artificiale attiva');
}
