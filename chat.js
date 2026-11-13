// Scheda Assistente: domande su pasti, spesa e conti, risposta scritta e a voce. Funziona anche dal Comando Rapido di Siri (?chiedi=...).
let chat = [];
function renderChat() {
  const el = $('t-chat');
  const testa = `<div class="sub-cap"><button type="button" class="indietro" id="chB" aria-label="Torna a Oggi">${ic('indietro', 22, 2)}</button><div><h1>Assistente</h1><p>Pasti, spesa e conti di ${esc(G ? G.nome : 'tutto il gruppo')}</p></div></div>`;
  if (!haAI()) {
    el.innerHTML = testa + `<div class="card vuoto" style="text-align:left">${ic('scintille', 28)}<b>Serve un'intelligenza artificiale</b><p class="q" style="margin:6px 0 0;line-height:1.5">${ANTEPRIMA ? 'Nell\'anteprima non si collega nessuna intelligenza artificiale.' : 'In Impostazioni (dalla scheda Gruppo) inserisci una chiave di Gemini, Groq, ChatGPT o Claude: puoi condividerla con tutto il gruppo.'} Poi qui chiedi "cosa mangio domani?", "cosa mangia Giulia stasera?", "aggiungi il latte alla spesa" o "quanto devo e a chi?", e ti risponde anche a voce.</p></div>`;
    $('chB').onclick = () => vai('oggi');
    return;
  }
  el.innerHTML = testa + `<div class="sug">` +
    ['Cosa mangio oggi?', 'Cosa mangiamo stasera?', 'Cosa devo comprare?', 'Quanto devo e a chi?', 'Quanto abbiamo speso in casa?'].map(s => `<button type="button">${s}</button>`).join('') +
    `</div><div class="msgs" id="msgs">${chat.length ? chat.map(m => `<div class="m ${m.r}">${esc(m.t)}</div>`).join('') : `<p class="q" style="text-align:center;margin-top:30px">Scrivi o detta una domanda.${iaAttiva().condivisa ? '<br><span class="by">Usi l\'intelligenza artificiale condivisa da ' + esc(iaAttiva().da || 'un membro del gruppo') + '.</span>' : ''}</p>`}</div>` +
    `<div class="ask"><input id="dom" placeholder="Scrivi o detta…" enterkeyhint="send" aria-label="Domanda"><button class="mic" id="mic" type="button" aria-label="Detta">${ic('microfono', 20)}</button><button id="inv" type="button" aria-label="Invia">${ic('invia', 20)}</button></div>`;
  $('chB').onclick = () => vai('oggi');
  el.querySelectorAll('.sug button').forEach(b => b.onclick = () => chiediAI(b.textContent));
  $('inv').onclick = () => chiediAI($('dom').value);
  $('dom').onkeydown = e => { if (e.key === 'Enter') chiediAI($('dom').value); };
  $('mic').onclick = ascolta;
}
function parla(t) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'it-IT'; speechSynthesis.speak(u); } catch (e) {} }
function ascolta() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { toast('Usa il microfono della tastiera per dettare'); $('dom').focus(); return; }
  const r = new R(); r.lang = 'it-IT'; $('mic').classList.add('rec');
  r.onresult = e => chiediAI(e.results[0][0].transcript);
  r.onend = () => $('mic')?.classList.remove('rec');
  r.onerror = () => { toast('Microfono non disponibile: detta dalla tastiera'); $('dom').focus(); };
  r.start();
}
async function chiediAI(q) {
  q = (q || '').trim(); if (!q) return;
  if (!G || !haAI()) { toast('Attiva un\'intelligenza artificiale in Impostazioni'); return; }
  chat.push({ r: 'io', t: q }); chat.push({ r: 'ai', t: '…' }); renderChat(); scrollTo(0, document.body.scrollHeight);
  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const s = Conti.saldi(D.movimenti, D.partecipanti);
  const diete = D.partecipanti.map(p => ({ persona: p.nome, dieta: pianoDi(p.id), piatti_scelti: ricetteDi(p.id) })).filter(x => x.dieta);
  const conti = {
    valuta: VG(), conti: D.conti.map(c => ({ nome: c.nome, voci: c.voci })),
    saldi: D.partecipanti.map(p => ({ nome: p.nome, saldo: (s[p.id] || 0) / 100 })),
    rimborsi_suggeriti: Conti.rimborsi(s).map(r => ({ da: nomeP(r.da), a: nomeP(r.a), importo: r.importo / 100 })),
    ultime_spese: D.movimenti.slice(0, 40).map(m => ({ data: m.data, tipo: m.tipo, titolo: m.titolo, conto: contoDi(m.conto_id)?.nome || '', voce: m.categoria, importo: Conti.inValutaGruppo(m) / 100, pagato_da: nomeP(m.pagato_da) }))
  };
  try {
    const out = await ia([{ text: `Sei l'assistente di ${NOME_APP}, l'app con cui un gruppo (famiglia o coinquilini) gestisce pasti, spesa e conti condivisi. Chi ti scrive è ${IO ? nomeP(IO) : CHI}. Rispondi in italiano, in modo breve e naturale, adatto a essere letto ad alta voce, senza elenchi puntati con simboli. Oggi è ${oggi}. Usa SOLO i dati qui sotto, non inventare pasti né importi. Ognuno può avere una dieta diversa: se la domanda non dice di chi, rispondi per chi scrive e, se utile, cita gli altri. Se i giorni di una dieta non hanno il nome del giorno della settimana, chiedi a quale giorno corrisponde oggi. Saldo positivo = deve ricevere soldi, negativo = deve darne. Se l'utente chiede di aggiungere prodotti alla spesa mettili in "aggiungi". JSON: {"risposta":"","aggiungi":[{"nome":"","quantita":"","reparto":""}]} con reparto tra: ${REPARTI.join(', ')}.\nDIETE: ${JSON.stringify(diete)}\nSPESA: ${JSON.stringify(D.spesa.map(x => ({ nome: x.nome, quantita: x.quantita, comprato: x.comprato })))}\nCONTI: ${JSON.stringify(conti)}\nCONVERSAZIONE: ${JSON.stringify(chat.slice(-10, -1))}\nDOMANDA: ${q}` }]);
    chat[chat.length - 1].t = out.risposta;
    if (out.aggiungi?.length) {
      const righe = out.aggiungi.map(x => ({ id: uuid(), gruppo_id: G.id, nome: x.nome, quantita: x.quantita || '', reparto: REPARTI.includes(x.reparto) ? x.reparto : 'Altro', comprato: false, aggiunto_da: CHI, created_at: new Date().toISOString() }));
      D.spesa.push(...righe); renderSpesa();
      if (await scrivi(() => ST.ins('spesa', righe))) toast('Aggiunto alla spesa ✓');
    }
    renderChat(); scrollTo(0, document.body.scrollHeight); parla(out.risposta);
  } catch (e) { chat[chat.length - 1].t = 'Errore: ' + e.message; renderChat(); }
}
// Domanda arrivata dal Comando Rapido di Siri
(function () {
  const att = setInterval(() => {
    const d = SS.get('chiedi'); if (!d) return clearInterval(att);
    if (G && D && haAI()) { clearInterval(att); SS.del('chiedi'); vai('chat'); chiediAI(d); }
  }, 400);
  setTimeout(() => clearInterval(att), 30000);
})();
