// Livello dati: Supabase (condiviso tra dispositivi) oppure "locale" (solo questo dispositivo).
const TABELLE = ['spesa', 'partecipanti', 'conti', 'movimenti'];
// La foto dello scontrino si scarica solo quando la apri
const COL_MOV = 'id,gruppo_id,conto_id,tipo,titolo,importo,valuta,cambio,data,categoria,pagato_da,divisione,nota,ha_foto,creato_da,modificato_da,created_at,updated_at';
const CONTI_INIZIALI = [
  { nome: 'Casa', tipo: 'casa', voci: ['Spesa alimentare', 'Utenze', 'Affitto o mutuo', 'Manutenzione', 'Altro'], ordine: 1 },
  { nome: 'Viaggi', tipo: 'viaggio', voci: [], ordine: 2 },
  { nome: 'Extra', tipo: 'extra', voci: ['Svago', 'Ristoranti', 'Regali', 'Salute', 'Altro'], ordine: 3 }
];
const ordinaMov = arr => arr.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.created_at || '').localeCompare(a.created_at || ''));

function storeSupabase(url, key) {
  const db = supabase.createClient(url, key);
  const ok = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  let canale = null;
  return {
    modo: 'supabase', db,
    async sessione() { const { data } = await db.auth.getSession(); return data.session ? { id: data.session.user.id, email: data.session.user.email } : null; },
    async inviaCodice(email) { ok(await db.auth.signInWithOtp({ email })); },
    async verifica(email, token) { ok(await db.auth.verifyOtp({ email, token, type: 'email' })); },
    async accedi(email, password) { ok(await db.auth.signInWithPassword({ email, password })); },
    async impostaPassword(password) { ok(await db.auth.updateUser({ password })); },
    async esci() { await db.auth.signOut(); },
    // Chiave IA personale salvata nel proprio account (solo la persona la vede): resta anche se il telefono cancella i dati del sito
    async chiaveIA() { const { data } = await db.auth.getSession(); return (data.session && data.session.user.user_metadata && data.session.user.user_metadata.ia) || null; },
    async salvaChiaveIA(v) { ok(await db.auth.updateUser({ data: { ia: v } })); },
    async gruppi() { return ok(await db.from('gruppi').select('id,nome,valuta,creato_da').order('nome')); },
    async creaGruppo(nome, valuta, nomeUtente) { return ok(await db.rpc('crea_gruppo', { nome_gruppo: nome, valuta_gruppo: valuta, nome_utente: nomeUtente })); },
    async unisciti(codice, nomeUtente) { return ok(await db.rpc('unisciti', { codice, nome_utente: nomeUtente })); },
    async aggiornaGruppo(id, campi) { ok(await db.from('gruppi').update(campi).eq('id', id)); },
    async codiceInvito(id) { return ok(await db.from('gruppi').select('invito').eq('id', id).single()).invito; },
    async lasciaGruppo(id) { ok(await db.rpc('lascia_gruppo', { g: id })); },
    async carica(g) {
      const [st, sp, pa, co, mo] = await Promise.all([
        db.from('stato').select('id,data').eq('gruppo_id', g),
        db.from('spesa').select('*').eq('gruppo_id', g).order('created_at'),
        db.from('partecipanti').select('*').eq('gruppo_id', g).order('created_at'),
        db.from('conti').select('*').eq('gruppo_id', g).order('ordine').order('created_at'),
        db.from('movimenti').select(COL_MOV).eq('gruppo_id', g).order('data', { ascending: false }).order('created_at', { ascending: false })
      ]);
      const stato = {}; ok(st).forEach(r => { stato[r.id] = r.data; });
      return { stato, spesa: ok(sp), partecipanti: ok(pa), conti: ok(co), movimenti: ok(mo) };
    },
    async foto(id) { return ok(await db.from('movimenti').select('foto').eq('id', id).single()).foto; },
    async salvaStato(g, id, data) { ok(await db.from('stato').upsert({ gruppo_id: g, id, data })); },
    async ins(t, righe) { ok(await db.from(t).insert(righe)); },
    async upd(t, id, campi) { ok(await db.from(t).update(campi).eq('id', id)); },
    async del(t, id) { ok(await db.from(t).delete().eq('id', id)); },
    async delWhere(t, filtri) { ok(await db.from(t).delete().match(filtri)); },
    // Notifiche push: iscrizione di questo dispositivo e invio agli altri del gruppo
    async iscrivi(sub) { const j = sub.toJSON(); ok(await db.from('push_iscrizioni').upsert({ endpoint: j.endpoint, dati: j })); },
    async disiscrivi(endpoint) { ok(await db.from('push_iscrizioni').delete().eq('endpoint', endpoint)); },
    // Funzione "cucina" sul server: intelligenza artificiale (Groq con la chiave del server) e importazione di ricette da un link
    async cucina(corpo) {
      const r = await db.functions.invoke('cucina', { body: corpo });
      if (r.error) {
        const ctx = r.error.context; let m = '';
        try { m = (await ctx.clone().json()).errore || ''; } catch (e) {}
        if (!m && ((ctx && ctx.status === 404) || /not found|Failed to send/i.test(r.error.message || ''))) m = 'La funzione "cucina" non è ancora pubblicata su Supabase.';
        throw new Error(m || r.error.message || 'Il server non risponde. Riprova.');
      }
      return r.data;
    },
    async provaNotifica(g) {
      const r = await db.functions.invoke('notifica', { body: { gruppo_id: g, prova: true } });
      if (r.error) { let m = ''; try { m = (await r.error.context.clone().json()).errore || ''; } catch (e) {} throw new Error(m || 'La funzione "notifica" non risponde: controlla che sia pubblicata con il codice nuovo.'); }
      return r.data || {};
    },
    async notifica(g, titolo, testo, scheda, tipo, a) { try { const r = await db.functions.invoke('notifica', { body: { gruppo_id: g, titolo, testo, scheda, tipo, a } }); return (r.data && r.data.inviate) || 0; } catch (e) { return 0; } },
    ascolta(g, cb, stato) {
      this.smetti();
      const F = 'gruppo_id=eq.' + g;
      canale = db.channel('g-' + g);
      TABELLE.forEach(t => {
        canale.on('postgres_changes', { event: 'INSERT', schema: 'public', table: t, filter: F }, p => cb(t, 'INSERT', p.new));
        canale.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: t, filter: F }, p => cb(t, 'UPDATE', p.new));
        canale.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, p => cb(t, 'DELETE', p.old));
      });
      canale.on('postgres_changes', { event: '*', schema: 'public', table: 'stato', filter: F }, p => cb('stato', p.eventType, p.new));
      canale.subscribe(s => stato(s === 'SUBSCRIBED'));
    },
    smetti() { if (canale) { db.removeChannel(canale); canale = null; } }
  };
}

function storeLocale() {
  const VUOTO = { gruppi: [], stato: [], spesa: [], partecipanti: [], conti: [], movimenti: [] };
  let D = Object.assign(JSON.parse(JSON.stringify(VUOTO)), LS.getJ('tm_locale', {}));
  const salva = () => LS.setJ('tm_locale', D);
  const match = (r, f) => Object.keys(f).every(k => r[k] === f[k]);
  const ora = () => new Date().toISOString();
  const cp = x => JSON.parse(JSON.stringify(x));
  return {
    modo: 'locale',
    async sessione() { return { id: 'locale', email: '' }; },
    async inviaCodice() {}, async verifica() {}, async accedi() {}, async impostaPassword() {}, async esci() {},
    async chiaveIA() { return null; }, async salvaChiaveIA() {},
    async gruppi() { return D.gruppi.map(g => ({ id: g.id, nome: g.nome, valuta: g.valuta })).sort((a, b) => a.nome.localeCompare(b.nome)); },
    async creaGruppo(nome, valuta, nomeUtente) {
      const id = uuid();
      D.gruppi.push({ id, nome, valuta, invito: Math.random().toString(36).slice(2, 14) });
      D.partecipanti.push({ id: uuid(), gruppo_id: id, nome: nomeUtente || 'Io', user_id: 'locale', created_at: ora() });
      CONTI_INIZIALI.forEach(c => D.conti.push({ id: uuid(), gruppo_id: id, created_at: ora(), ...cp(c) }));
      salva(); return id;
    },
    async unisciti() { throw new Error('Gli inviti funzionano solo con il server collegato'); },
    async aggiornaGruppo(id, campi) { Object.assign(D.gruppi.find(g => g.id === id) || {}, campi); salva(); },
    async codiceInvito(id) { return (D.gruppi.find(g => g.id === id) || {}).invito; },
    async lasciaGruppo(id) {
      D.gruppi = D.gruppi.filter(g => g.id !== id);
      ['stato', 'spesa', 'partecipanti', 'conti', 'movimenti'].forEach(t => { D[t] = D[t].filter(r => r.gruppo_id !== id); });
      salva();
    },
    async carica(g) {
      const stato = {}; D.stato.filter(x => x.gruppo_id === g).forEach(x => { stato[x.id] = cp(x.data); });
      return {
        stato,
        spesa: cp(D.spesa.filter(r => r.gruppo_id === g)),
        partecipanti: cp(D.partecipanti.filter(r => r.gruppo_id === g)),
        conti: cp(D.conti.filter(r => r.gruppo_id === g)).sort((a, b) => a.ordine - b.ordine),
        movimenti: ordinaMov(cp(D.movimenti.filter(r => r.gruppo_id === g)).map(m => { m.ha_foto = !!m.foto; delete m.foto; return m; }))
      };
    },
    async foto(id) { return (D.movimenti.find(m => m.id === id) || {}).foto || null; },
    async salvaStato(g, id, data) {
      const r = D.stato.find(x => x.gruppo_id === g && x.id === id);
      if (r) r.data = cp(data); else D.stato.push({ gruppo_id: g, id, data: cp(data) });
      salva();
    },
    async ins(t, righe) { (Array.isArray(righe) ? righe : [righe]).forEach(r => D[t].push(Object.assign({ id: uuid(), created_at: ora() }, cp(r)))); salva(); },
    async upd(t, id, campi) { const r = D[t].find(x => x.id === id); if (r) Object.assign(r, cp(campi)); salva(); },
    async del(t, id) {
      if (t === 'partecipanti' && D.movimenti.some(m => m.pagato_da === id || (m.divisione && m.divisione.parti && id in m.divisione.parti))) throw new Error('Questa persona compare in alcune spese');
      if (t === 'conti' && D.movimenti.some(m => m.conto_id === id)) throw new Error('Questo conto ha delle spese');
      D[t] = D[t].filter(x => x.id !== id); salva();
    },
    async delWhere(t, f) { D[t] = D[t].filter(r => !match(r, f)); salva(); },
    async iscrivi() {}, async disiscrivi() {}, async notifica() { return 0; }, async provaNotifica() { return { inviate: 0, dispositivi: 0 }; },
    async cucina() { throw new Error('Serve il server Supabase: in modalità "solo su questo dispositivo" non è disponibile.'); },
    ascolta(g, cb, stato) { stato(false); },
    smetti() {}
  };
}

// ---------- Senza rete: le modifiche restano sul telefono e partono appena torna la connessione ----------
// Avvolge il negozio Supabase: salvaStato/ins/upd/del/delWhere, se la rete manca, finiscono in una coda salvata
// sul telefono (in ordine) e la modifica si vede subito nell'app. Al ritorno online la coda si svuota da sola.
const CODA = 'coda_modifiche';
const reteGiu = e => !navigator.onLine || e instanceof TypeError || /Failed to fetch|Load failed|NetworkError|network|fetch failed|ERR_INTERNET|timeout/i.test(String((e && e.message) || e));
const TABELLE_UUID = ['spesa', 'partecipanti', 'conti', 'movimenti'];
function conCoda(st) {
  const coda = () => LS.getJ(CODA, []), salva = l => LS.setJ(CODA, l);
  const scritture = ['salvaStato', 'ins', 'upd', 'del', 'delWhere'], orig = {};
  let inCorso = null;
  scritture.forEach(m => {
    orig[m] = st[m].bind(st);
    st[m] = async (...args) => {
      // le righe nuove hanno subito il loro codice: così si possono modificare anche prima di essere sul server
      if (m === 'ins' && TABELLE_UUID.includes(args[0])) args[1] = (Array.isArray(args[1]) ? args[1] : [args[1]]).map(r => r.id ? r : { id: uuid(), ...r });
      if (navigator.onLine) {
        if (coda().length) await st.svuota();
        if (!coda().length) {
          try { return await orig[m](...args); }
          catch (e) { if (!reteGiu(e)) throw e; }
        }
      }
      const l = coda(); l.push({ m, args, t: Date.now() }); salva(l);
      if (st.applica) st.applica(m, args);
      if (st.inCoda) st.inCoda(l.length);
    };
  });
  st.inAttesa = () => coda().length;
  st.inSospeso = () => coda();
  // manda le modifiche in sospeso, una alla volta e nell'ordine in cui sono state fatte
  st.svuota = () => inCorso || (inCorso = (async () => {
    let fatte = 0, scartate = 0;
    try {
      while (navigator.onLine) {
        const l = coda(); if (!l.length) break;
        const op = l[0];
        try { await orig[op.m](...op.args); fatte++; }
        catch (e) { if (reteGiu(e)) break; scartate++; console.warn('Modifica non accettata dal server', op.m, e && e.message); }
        const ora = coda(); ora.shift(); salva(ora);
      }
    } finally { inCorso = null; }
    return { fatte, scartate, restano: coda().length };
  })());
  return st;
}
