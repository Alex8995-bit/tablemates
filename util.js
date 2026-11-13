// Funzioni comuni a tutte le schede
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS = {
  get(k){ try { return localStorage.getItem(k) || ''; } catch(e){ return ''; } },
  set(k,v){ try { localStorage.setItem(k, v); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} },
  getJ(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e){ return d; } },
  setJ(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const SS = {
  get(k){ try { return sessionStorage.getItem(k) || ''; } catch(e){ return ''; } },
  set(k,v){ try { sessionStorage.setItem(k, v); } catch(e){} },
  del(k){ try { sessionStorage.removeItem(k); } catch(e){} }
};
const S = k => LS.get(k) || (window.CFG && window.CFG[k]) || '';
const ANTEPRIMA = !!window.ANTEPRIMA;
window.VERSIONE = '9.1';
const NOME_APP = 'Tablemates';
const REPARTI = ['Frutta e verdura','Carne e pesce','Latticini e uova','Pane e cereali','Dispensa','Surgelati','Bevande','Casa e igiene','Altro'];
const vibra = () => { try { navigator.vibrate && navigator.vibrate(10); } catch(e){} };

function toast(t, azione){
  const e = $('toast');
  e.innerHTML = esc(t) + (azione ? ` <button type="button">${esc(azione.testo)}</button>` : '');
  if (azione) e.querySelector('button').onclick = () => { e.classList.remove('on'); azione.fn(); };
  e.classList.add('on'); clearTimeout(e._t);
  e._t = setTimeout(() => e.classList.remove('on'), azione ? 8000 : 2400);
}
// Foglio dal basso (sul PC finestra centrale)
function foglio(html, opz = {}){
  $('pop').innerHTML = `<div class="ov" id="ov"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${opz.senzaX ? '' : `<button class="close" type="button" aria-label="Chiudi" id="ovX">${ic('x', 18)}</button>`}${html}</div></div>`;
  $('ov').onclick = e => { if (e.target.id === 'ov' && !opz.fisso) chiudi(); };
  if ($('ovX')) $('ovX').onclick = chiudi;
}
function chiudi(){ $('pop').innerHTML = ''; }
// Conferma dentro l'app (al posto di confirm())
function conferma(titolo, testo, siTesto, fn, pericoloso){
  foglio(`<h2>${esc(titolo)}</h2><p class="q" style="line-height:1.45">${esc(testo)}</p><button class="btn ${pericoloso ? 'danger' : ''}" id="cfS" type="button">${esc(siTesto)}</button><button class="btn ghost" id="cfN" type="button">Annulla</button>`);
  $('cfN').onclick = chiudi;
  $('cfS').onclick = () => { chiudi(); fn(); };
}
// Domanda con campo di testo (al posto di prompt())
function chiedi(titolo, testo, valore, siTesto, fn, tipo){
  foglio(`<h2>${esc(titolo)}</h2><p class="q">${esc(testo)}</p><input id="chV" type="${tipo || 'text'}" value="${esc(valore || '')}"><button class="btn" id="chS" type="button">${esc(siTesto)}</button><button class="btn ghost" id="chN" type="button">Annulla</button>`);
  const v = $('chV'); v.focus(); v.select();
  $('chN').onclick = chiudi;
  const ok = () => { const x = v.value; chiudi(); fn(x); };
  $('chS').onclick = ok; v.onkeydown = e => { if (e.key === 'Enter') ok(); };
}
// Schede: Oggi, Piano, Spesa, Conti, Gruppo. A tavola, Assistente e Impostazioni si aprono da queste.
const SCHEDE = ['oggi', 'piano', 'spesa', 'conti', 'gruppo', 'presenze', 'chat', 'imp'];
const SCHEDA_NAV = { presenze: 'oggi', chat: 'oggi', imp: 'gruppo' };
function vai(t){
  if (!SCHEDE.includes(t)) t = 'oggi';
  const nav = SCHEDA_NAV[t] || t;
  document.querySelectorAll('nav.sezioni button[data-t]').forEach(b => { const on = b.dataset.t === nav || b.dataset.t === t; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (t === 'chat') document.querySelectorAll('nav.sezioni button[data-t="oggi"]').forEach(b => { if (matchMedia('(min-width:900px)').matches) { b.classList.remove('on'); b.removeAttribute('aria-current'); } });
  SCHEDE.forEach(x => { const e = $('t-' + x); if (e) e.hidden = x !== t; });
  LS.set('scheda', t); scrollTo(0, 0);
  if (t === 'presenze' && typeof renderPresenze === 'function') renderPresenze();
  if (t === 'chat') setTimeout(() => scrollTo(0, document.body.scrollHeight), 0);
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const oggiISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
function dataLunga(iso){
  const d = new Date(iso + 'T12:00:00');
  const oggi = oggiISO(), ieri = new Date(Date.now() - 864e5); ieri.setMinutes(ieri.getMinutes() - ieri.getTimezoneOffset());
  if (iso === oggi) return 'Oggi';
  if (iso === ieri.toISOString().slice(0, 10)) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
// Riduce una foto a max 1280px in JPEG, per salvarla nel database senza Storage
function comprimiFoto(file, lato = 1280, q = 0.72){
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, lato / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Immagine non leggibile')); };
    img.src = url;
  });
}
function scarica(nome, testo, tipo){
  const b = new Blob([testo], { type: tipo || 'text/plain' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
