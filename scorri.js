// Scorri da destra verso sinistra per eliminare, come su iPhone: sotto la riga compare il cestino bianco su fondo rosso.
// Scorrendo poco la riga resta aperta e si tocca il cestino; scorrendo oltre metà si elimina subito.
// elimina(riga, ripristina): ripristina() rimette la riga a posto (per esempio se poi si annulla una conferma).
const APERTA = 84;
let _rigaAperta = null;
function scorriElimina(righe, elimina, etichetta = 'Elimina') {
  righe.forEach(r => {
    if (r.closest('.sw')) return;
    const w = document.createElement('div'); w.className = 'sw';
    r.parentNode.insertBefore(w, r);
    const bg = document.createElement('button'); bg.type = 'button'; bg.className = 'sw-bg'; bg.tabIndex = -1;
    bg.setAttribute('aria-label', etichetta); bg.innerHTML = `<span>${ic('cestino', 22, 2)}</span>`;
    w.append(bg, r); r.classList.add('sw-riga');
    let x0 = 0, y0 = 0, dx = 0, base = 0, attivo = false, deciso = false, aperta = false, pid = null, salta = false;
    const pos = (v, anim) => {
      r.style.transition = anim ? 'transform .26s cubic-bezier(.2,.8,.2,1)' : 'none';
      r.style.transform = v ? `translateX(${v}px)` : '';
      w.classList.toggle('vede', v < 0);
      bg.classList.toggle('pieno', v < -w.clientWidth * .5);
    };
    const chiudiRiga = () => { aperta = false; pos(0, true); if (_rigaAperta === chiudiRiga) _rigaAperta = null; };
    const via = () => {
      vibra(); aperta = false; if (_rigaAperta === chiudiRiga) _rigaAperta = null;
      pos(-w.clientWidth, true);
      const ripristina = () => { w.classList.remove('chiude'); w.style.height = ''; pos(0, true); };
      setTimeout(() => { w.style.height = w.offsetHeight + 'px'; requestAnimationFrame(() => { w.classList.add('chiude'); w.style.height = '0px'; }); setTimeout(() => elimina(r, ripristina), 220); }, 180);
    };
    r.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (_rigaAperta && _rigaAperta !== chiudiRiga) { _rigaAperta(); }
      x0 = e.clientX; y0 = e.clientY; dx = base = aperta ? -APERTA : 0; attivo = true; deciso = false; pid = e.pointerId;
    });
    r.addEventListener('pointermove', e => {
      if (!attivo || e.pointerId !== pid) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!deciso) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        if (Math.abs(my) > Math.abs(mx) || (mx > 0 && !aperta)) { attivo = false; return; }
        deciso = true; try { r.setPointerCapture(pid); } catch (x) {}
      }
      dx = Math.min(0, base + mx);
      const L = w.clientWidth; if (dx < -L) dx = -L;
      pos(dx); e.preventDefault();
    });
    const fine = annulla => {
      if (!attivo) return; attivo = false;
      if (!deciso) return;
      salta = true; setTimeout(() => { salta = false; }, 60);
      if (annulla) return aperta ? pos(-APERTA, true) : pos(0, true);
      if (dx < -w.clientWidth * .5) via();
      else if (dx < -44) { aperta = true; pos(-APERTA, true); _rigaAperta = chiudiRiga; }
      else chiudiRiga();
    };
    r.addEventListener('pointerup', () => fine(false));
    r.addEventListener('pointercancel', () => fine(true));
    // dopo uno scorrimento il tocco non apre la riga; se la riga è aperta, il tocco la chiude
    r.addEventListener('click', e => { if (salta || aperta) { e.stopImmediatePropagation(); e.preventDefault(); if (aperta && !salta) chiudiRiga(); } }, true);
    bg.onclick = via;
  });
}
document.addEventListener('pointerdown', e => { if (_rigaAperta && !e.target.closest('.sw')) _rigaAperta(); }, true);
