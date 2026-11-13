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
    async gruppi() { return ok(await db.from('gruppi').select('id,nome,valuta').order('nome')); },
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
    async notifica(g, titolo, testo, scheda) { try { await db.functions.invoke('notifica', { body: { gruppo_id: g, titolo, testo, scheda } }); } catch (e) {} },
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
    async iscrivi() {}, async disiscrivi() {}, async notifica() {},
    ascolta(g, cb, stato) { stato(false); },
    smetti() {}
  };
}
