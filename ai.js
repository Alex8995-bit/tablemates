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

async function ia(parts) {
  const { prov: p, chiave: K } = iaAttiva();
  if (p === 'gemini') {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(K), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } })
    });
    const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'Errore Gemini');
    return JSON.parse(j.candidates[0].content.parts[0].text);
  }
  const txt = parts.filter(x => x.text).map(x => x.text).join('\n') + '\nRispondi SOLO con JSON valido.';
  const pdf = parts.find(x => x.inline_data)?.inline_data.data;
  if (p === 'openai') {
    const content = [{ type: 'text', text: txt }];
    if (pdf) content.unshift({ type: 'file', file: { filename: 'dieta.pdf', file_data: 'data:application/pdf;base64,' + pdf } });
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + K },
      body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] })
    });
    const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'Errore OpenAI');
    return JSON.parse(j.choices[0].message.content);
  }
  if (p === 'claude') {
    const content = [{ type: 'text', text: txt }];
    if (pdf) content.unshift({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': K, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 8000, messages: [{ role: 'user', content }] })
    });
    const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'Errore Claude');
    const t = j.content[0].text; return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  }
  throw new Error('Nessuna intelligenza artificiale attiva');
}
