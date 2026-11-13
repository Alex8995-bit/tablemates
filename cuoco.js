// Cuoco di base: crea una ricetta semplice con gli alimenti e le grammature del pasto, senza intelligenza artificiale.
// Serve quando l'IA non c'è o non risponde: così ricetta, modalità cucina, timer e spesa funzionano sempre.
const CUOCO = (() => {
  const T = [
    ['bevanda', /\bcaff|\bte\b|tisana|succo|^acqua|spremut/],
    ['cereale', /pasta|spaghett|penne|fusill|rigaton|linguin|tagliatell|riso|farro|orzo perlato|couscous|cous cous|quinoa|gnocchi|grano saraceno|bulgur/],
    ['pane', /\bpane|fett[ae] biscottat|gallett|cracker|piadin|grissin|friselle|toast|wasa|bruschett/],
    ['snack', /barrett|popcorn|dessert|budino|gelato|snack|gallette di mais|proteic/],
    ['latte', /yogurt|\blatte\b|kefir|skyr/],
    ['fiocchi', /avena|fiocchi(?! di latte)|cereali|muesli|granola|corn ?flakes/],
    ['biscotti', /biscott|frollin|fett[ae] integral/],
    ['legumi', /lenticch|ceci|fagioli(?!ni)|piselli|legumi|edamame|lupini|\bfave/],
    ['tonno', /tonno|sgombro|salmone affumicat|sardin|acciughe sott/],
    ['salume', /prosciutto|bresaola|speck|affettat|fesa di tacchino a fette|cotto\b/],
    ['carne', /pollo|tacchino|manzo|vitello|maiale|hamburger|macinat|carne|fesa|lonza|petto|coscia|bistecc|polpett/],
    ['pesce', /pesce|spigola|branzino|merluzzo|nasello|orata|salmone|trota|sgombro|spada|gamber|polpo|seppi|calamar|platessa|sogliola|alici|acciugh/],
    ['uova', /\buov|albume|frittata/],
    ['formaggio', /mozzarell|ricotta|feta|parmigian|grana|formaggio|fiocchi di latte|stracchino|primo sale|caprino|scamorza|philadelphia|burrata/],
    ['sugo', /passata|sugo|polpa di pomodoro|pelati|salsa di pomodoro/],
    ['verdura', /verdur|insalat|zucchin|spinac|broccol|pomodor|carot|melanzan|peperon|fagiolin|finocch|funghi|cavol|rucola|rughetta|asparag|bietol|cicori|ortagg|lattuga|cetriol|sedano|zucca|carciof|porri|radicchio|minestrone/],
    ['patate', /patat/],
    ['secca', /mandorl|\bnoci\b|nocciol|pistacch|anacard|semi\b|semi di|frutta secca|frutta a guscio|arachid(?!i\b)/],
    ['frutta', /frutta|\bmel[ae]\b|banan|aranc|\bper[ae]\b|kiwi|frutti di bosco|fragol|ananas|pesca|pesche|\buva\b|mirtill|mandarin|albicocc|prugn|ciliegi|anguria|melone|lampon/],
    ['spalma', /marmellat|confettur|miele|burro d|burro di|crema|cioccolat|cacao|nutella/],
    ['olio', /olio|burro\b/],
    ['condimento', /aceto|limone|sale\b|spezie|erbe|origano|basilico|pepe/]
  ];
  const tipoDi = nome => { const n = senzaAccenti(nome); const t = T.find(([, re]) => re.test(n)); return t ? t[0] : 'altro'; };
  const qta = v => v.qta != null ? LETTORE.fmt(v.qta) + (v.unita ? ' ' + v.unita : '') : (v.misura || '');
  // nome completo ripulito (per ingredienti e passaggi) e nome breve (per il titolo del piatto)
  const pulito = n => String(n).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+-\s*$|^\s*-\s+/g, '').replace(/\s+/g, ' ').trim();
  const VUOTE = /^(di|del|della|dei|delle|alla|al|allo|ai|alle|e|con|in|da|a|parzial\.?|uht)$/i;
  const breve = n => { let t = pulito(n).split(/\s+-\s+|,|\s\/\s/)[0].replace(/\s+(in scatola|al naturale|surgelat\w*|cott[ie]|crud[ie]|scolat\w*|preparat\w*|\d+([.,]\d+)?\s?%)/gi, '').trim(); t = t.split(/\s(?:con|al|alla|alle|ai|allo)\s/i)[0]; if (/\se\s/i.test(t) && t.split(' ').length > 2) t = t.split(/\se\s/i)[0]; let w = t.split(' ').slice(0, 3); while (w.length > 1 && VUOTE.test(w[w.length - 1])) w.pop(); return w.join(' '); };
  // nel testo dei passaggi: minuscolo (tranne sigle) e "X - Y" diventa "X (Y)"
  const nelTesto = n => pulito(n).replace(/\s+-\s+/g, ' ').split(' ').map(w => /^[A-Z0-9%]{2,}$/.test(w) || /\d/.test(w) ? w : w.toLowerCase()).join(' ');
  const min = s => s.charAt(0).toLowerCase() + s.slice(1);
  const elenco = l => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1];
  const nomiDi = l => l.map(v => breve(v.nome).toLowerCase());
  const conQ = v => qta(v) ? `${nelTesto(v.nome)} (${qta(v)})` : nelTesto(v.nome);

  function voci(pid, gi, pa) {
    if (pa.voci && pa.voci.length) return pa.voci.map((_, i) => voceEffettiva(pid, gi, pa, i));
    return String(pa.alimenti || '').split(/[;\n]|,(?![^(]*\))/).map(t => t.trim()).filter(Boolean).map(t => LETTORE.voceDaTesto ? LETTORE.voceDaTesto(t) : { nome: t });
  }

  // altreVoci: dosi già sommate (piatto condiviso con altre persone)
  function crea(pid, gi, pa, altreVoci) {
    const vv = (altreVoci || voci(pid, gi, pa)).filter(v => v && v.nome);
    const g = {}; vv.forEach(v => { const t = tipoDi(v.nome); (g[t] = g[t] || []).push(v); });
    const usati = new Set(), has = k => !!(g[k] && g[k].length), L = k => { (g[k] || []).forEach(v => usati.add(v)); return g[k] || []; };
    const lista = k => elenco(L(k).map(conQ));
    const prot = ['carne', 'pesce', 'uova', 'legumi', 'tonno', 'salume', 'formaggio'].find(has);
    const passi = []; let nome = '', cottura = 0;
    const tempo = m => { cottura = Math.max(cottura, m); };
    const cruda = v => /insalat|rucola|rughetta|lattuga|cetriol|pomodorin|radicchio|valerian|songino|finocch/.test(senzaAccenti(v.nome));
    const proteina = () => {
      for (const v of L('carne')) { passi.push(`Taglia ${conQ(v)} a straccetti e cuoci in padella antiaderente ben calda, senza grassi, per 8 min, girando a metà cottura: deve essere dorato fuori e cotto dentro.`); tempo(10); }
      for (const v of L('pesce')) { passi.push(`Cuoci ${conQ(v)} in padella antiaderente con due cucchiai d'acqua e il coperchio per 8 min (oppure in cartoccio al forno a 200 °C per 15 min), con limone ed erbe aromatiche.`); tempo(15); }
      for (const v of L('uova')) { passi.push(`Sbatti ${conQ(v)} con un pizzico di sale e cuoci in padella antiaderente a fuoco basso per 3 min, mescolando, finché sono morbide.`); tempo(4); }
      for (const v of L('legumi')) { passi.push(`Sciacqua ${conQ(v)} sotto l'acqua corrente e scalda in padella con due cucchiai d'acqua e un rametto di rosmarino per 5 min.`); tempo(5); }
      for (const v of L('tonno')) passi.push(`Sgocciola bene ${conQ(v)} e sbriciola con una forchetta.`);
      for (const v of L('salume')) passi.push(`Disponi ${conQ(v)} nel piatto.`);
    };
    const verdure = () => {
      for (const v of L('sugo')) { passi.push(`Scalda ${conQ(v)} in un pentolino con un pizzico di sale e basilico per 5 min.`); tempo(5); }
      for (const v of L('verdura')) {
        if (cruda(v)) passi.push(`Lava, asciuga e taglia ${conQ(v)}; tieni da parte per condire a crudo.`);
        else { passi.push(`Lava e taglia a pezzetti ${conQ(v)}, poi cuoci in padella con un filo d'acqua e il coperchio per 10 min (o al vapore): devono restare tenere ma croccanti.`); tempo(10); }
      }
      for (const v of L('patate')) { passi.push(`Lava e taglia a spicchi ${conQ(v)}, poi cuoci al forno a 200 °C per 25 min (oppure lessa per 20 min).`); tempo(25); }
    };
    const condisci = () => { const o = L('olio').concat(L('condimento')); if (o.length) passi.push(`Condisci a crudo con ${elenco(o.map(conQ))}.`); };
    const finale = () => {
      const resto = k => (g[k] || []).filter(v => !usati.has(v));
      const acc = resto('pane').concat(resto('biscotti')); if (acc.length) { passi.push(`Accompagna con ${elenco(acc.map(conQ))}.`); acc.forEach(v => usati.add(v)); }
      const dopo = resto('frutta').concat(resto('latte'), resto('snack'), resto('spalma'), resto('secca'));
      if (dopo.length) { passi.push(`Per finire: ${elenco(dopo.map(conQ))}.`); dopo.forEach(v => usati.add(v)); }
      const altro = vv.filter(v => !usati.has(v) && tipoDi(v.nome) !== 'bevanda'); if (altro.length) { passi.push(`Aggiungi ${elenco(altro.map(conQ))}.`); altro.forEach(v => usati.add(v)); }
      if (has('bevanda')) passi.push(`Da bere: ${lista('bevanda')}.`);
    };

    if (has('cereale')) {
      const c = L('cereale')[0], nc = senzaAccenti(c.nome), cous = /cous/.test(nc), gnocchi = /gnocchi/.test(nc), lungo = /riso|farro|orzo|grano saraceno/.test(nc);
      const cott = cous ? 5 : lungo ? 15 : gnocchi ? 3 : 10;
      const cond = prot ? nomiDi(g[prot]).slice(0, 1) : [];
      if (has('verdura')) cond.push(nomiDi(g.verdura)[0]); else if (has('sugo')) cond.push('pomodoro');
      nome = breve(c.nome) + (cond.length ? ' con ' + elenco(cond) : '');
      passi.push(cous ? `Versa ${conQ(c)} in una ciotola, copri con lo stesso peso di acqua bollente salata e lascia riposare coperto per 5 min; poi sgrana con una forchetta.` : `Porta a bollore abbondante acqua salata e cuoci ${conQ(c)} per ${cott} min (controlla il tempo sulla confezione).`);
      tempo(cott + 2);
      verdure(); proteina();
      const form = prot === 'formaggio' || has('formaggio');
      passi.push(cous ? 'Unisci al cous cous tutti gli altri ingredienti e mescola.' : 'A fine cottura scola e versa in padella con gli altri ingredienti; mescola a fuoco vivo per 1 min.');
      if (form) passi.push(`Completa fuori dal fuoco con ${lista('formaggio')}.`);
      condisci(); finale();
    } else if (prot && !has('latte') && !has('fiocchi')) {
      nome = breve(g[prot][0].nome) + (has('verdura') ? ' con ' + nomiDi(g.verdura)[0] : has('patate') ? ' con patate' : has('pane') ? ' e ' + nomiDi(g.pane)[0] : '');
      proteina(); verdure();
      if (has('formaggio')) passi.push(`Taglia a fette o a cubetti ${lista('formaggio')}.`);
      if (has('verdura') || has('patate')) passi.push('Componi il piatto: al centro la parte proteica, intorno le verdure.');
      condisci(); finale();
    } else if (has('latte') || has('fiocchi')) {
      const lat = g.latte ? g.latte[0] : null, yog = lat && /yogurt|skyr|kefir/.test(senzaAccenti(lat.nome));
      const sopra = nomiDi((g.fiocchi || []).concat(g.frutta || [], g.secca || []).filter(v => v !== lat)).slice(0, 2);
      nome = (yog ? 'Bowl di ' : lat ? 'Tazza di ' : 'Bowl di ') + breve((lat || g.fiocchi[0]).nome).toLowerCase() + (sopra.length && (lat || sopra.length > 1) ? ' con ' + elenco(lat ? sopra : sopra.slice(1)) : '');
      if (lat) passi.push(`Versa ${lista('latte')} in una ciotola.`);
      if (has('fiocchi')) passi.push(lat ? `Aggiungi ${lista('fiocchi')} e lascia riposare 2 min, così si ammorbidiscono.` : `Metti ${lista('fiocchi')} in una ciotola.`);
      if (has('frutta')) passi.push(`Lava e taglia a pezzetti ${lista('frutta')} e mettila sopra.`);
      if (has('secca')) passi.push(`Completa con ${lista('secca')} tritata grossolanamente.`);
      if (has('pane')) { passi.push(`Tosta ${lista('pane')} per 2 min${has('spalma') ? ' e spalmaci sopra ' + lista('spalma') : ''}.`); tempo(3); }
      else if (has('spalma')) passi.push(`Aggiungi ${lista('spalma')}.`);
      tempo(3); finale();
    } else if (has('pane') || has('biscotti')) {
      const b = (g.pane || g.biscotti)[0];
      nome = breve(b.nome) + (has('spalma') ? ' con ' + nomiDi(g.spalma)[0] : has('salume') ? ' con ' + nomiDi(g.salume)[0] : has('formaggio') ? ' con ' + nomiDi(g.formaggio)[0] : '');
      if (has('pane')) { passi.push(`Tosta ${lista('pane')} per 2 min in tostapane o in padella.`); tempo(3); }
      if (has('spalma')) passi.push(`Spalma ${lista('spalma')} in modo uniforme.`);
      if (has('salume') || has('formaggio')) passi.push(`Farcisci con ${elenco(L('salume').concat(L('formaggio')).map(conQ))}.`);
      tempo(3); finale();
    } else if (has('snack')) {
      nome = pulito(g.snack[0].nome).replace(/\s+-\s+/g, ' ');
      passi.push(`È già pronto: pesa ${lista('snack')} e gustalo.`); tempo(1); finale();
    } else if (has('frutta') || has('secca')) {
      nome = 'Coppa di ' + elenco(nomiDi((g.frutta || []).concat(g.secca || [])).slice(0, 2));
      if (has('frutta')) passi.push(`Lava e taglia a pezzetti ${lista('frutta')}.`);
      if (has('secca')) passi.push(`Aggiungi ${lista('secca')}.`);
      tempo(5); finale();
    } else {
      nome = vv.length ? breve(vv[0].nome) + (vv[1] ? ' con ' + breve(vv[1].nome).toLowerCase() : '') : pa.tipo;
      proteina(); verdure(); condisci(); finale();
      if (!passi.length) passi.push('Pesa gli alimenti con le grammature indicate e servi.');
      tempo(5);
    }
    const min5 = Math.max(5, Math.ceil((cottura + (passi.length > 3 ? 5 : 2)) / 5) * 5);
    const consigli = has('verdura') || has('carne') || has('pesce') || has('cereale') ? 'Per dare sapore senza aggiungere grassi usa erbe aromatiche, spezie, limone o aceto: non cambiano le grammature del piano.' : 'Le grammature sono quelle del tuo piano: pesa gli alimenti per rispettarle.';
    return { nome: nome.charAt(0).toUpperCase() + nome.slice(1), tempo: min5 + ' min', base: true,
      ricetta: { tempo: min5 + ' min', porzioni: '1', difficolta: 'Facile', ingredienti: vv.map(v => pulito(v.nome) + (qta(v) ? ' ' + qta(v) : '')), passaggi: passi, consigli } };
  }
  return { crea, tipoDi };
})();
