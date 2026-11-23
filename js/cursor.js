/* =========================================================
   CURSOR: a small Red Admiral that follows your hand
   It flaps faster when you move, banks toward where it is heading,
   opens wide over anything clickable and gives a quick flap when you click.
   It is drawn in 3D (the same Red Admiral that turns into the cocoon), on the creature layer L, when there is one.
   ========================================================= */
export function createCursor(L) {
  if (!matchMedia('(pointer: fine)').matches) return { set() {}, label() {}, hide() {}, arrive() {}, lead() {}, dive() {}, release() {}, into() {}, capture() { return null; }, adopt() {}, pos() { return null; } };
  const use3d = !!(L && L.ok && L.butterfly);
  let captured = false, lastPx = 32;   // captured: the story has the butterfly (it flies into the ring and becomes the cocoon)
  const cv = document.createElement('canvas');
  cv.id = 'cursor-canvas'; document.body.append(cv);
  const ctx = cv.getContext('2d');
  const tag = document.createElement('div'); tag.id = 'cursor-tag'; document.body.append(tag);
  document.body.classList.add('custom-cursor');

  let dpr = 1, mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my, vx = 0, vy = 0;
  let hover = 0, hoverT = 0, press = 0, visible = false, ang = 0, phase = 0, last = performance.now();
  let hidden = false, arrival = null, leading = null;   // entering the museum: hidden while the swarm turns into the eye, then one butterfly flies out of the iris and becomes the cursor
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; visible = true; tag.style.transform = `translate(${mx}px,${my}px)`; }, { passive: true });
  addEventListener('pointerdown', () => { press = 1; });
  document.addEventListener('pointerleave', () => { visible = false; });

  // one wing (right side), drawn in a 0..1 space: forewing up, hindwing down
  function wing(open) {
    const s = open;                                   // 1 = spread, ~0.15 = edge-on
    ctx.save(); ctx.scale(s, 1);
    // forewing: black with a red diagonal band and white tips
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.bezierCurveTo(4, -9, 12, -12, 15, -8); ctx.bezierCurveTo(16, -5, 12, -1, 1, 0); ctx.closePath();
    ctx.fillStyle = '#141111'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -4.5); ctx.bezierCurveTo(8, -7.5, 11, -8.5, 13, -8); ctx.lineTo(12.2, -6); ctx.bezierCurveTo(10, -6.3, 7.5, -5, 5.6, -3); ctx.closePath();
    ctx.fillStyle = '#d42a1c'; ctx.fill();
    ctx.fillStyle = '#f2ece4'; for (const [px, py, r] of [[13.2, -9.6, .9], [11.6, -10.2, .7], [14.4, -8.2, .6]]) { ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); }
    // hindwing: black with a red border
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(6, 0, 11, 3, 10, 7); ctx.bezierCurveTo(8, 10, 3, 9, 0, 3); ctx.closePath();
    ctx.fillStyle = '#141111'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, 7.4); ctx.bezierCurveTo(6.5, 8.8, 9, 8, 9.9, 6.3); ctx.lineTo(9, 5.9); ctx.bezierCurveTo(8, 7.2, 6.2, 7.5, 4.6, 6.6); ctx.closePath();
    ctx.fillStyle = '#d42a1c'; ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    // it trails your hand on a soft spring, never exactly on it
    const k = 1 - Math.exp(-dt * 22);
    let nx = x + (mx - x) * k, ny = y + (my - y) * k, grow = 0, fade = 1, s0 = null, sq = 0;
    if (arrival) {   // out of the iris, along a lazy arc, onto your hand
      const a = arrival, q = Math.min(1, (now - a.t0) / a.dur), e = q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2, u = 1 - e;
      if (a.flat) { nx = a.fx + (mx - a.fx) * e; ny = a.fy + (my - a.fy) * e; s0 = a.s0; sq = e; }   // handed back by the story, right where it is
      else { const cx = (a.fx + mx) / 2 + (a.fy - my) * .35, cy = Math.min(a.fy, my) - 120;
        nx = u * u * a.fx + 2 * u * e * cx + e * e * mx; ny = u * u * a.fy + 2 * u * e * cy + e * e * my; grow = Math.sin(q * Math.PI) * .9; }
      if (q >= 1) arrival = null;
    }
    if (leading) {   // it has left your hand and flies to (and hovers over) a point that may be moving
      const L = leading, q = Math.min(1, (now - L.t0) / L.dur), e = q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2, [tx, ty] = L.get();
      const hx = tx + Math.cos(now / 380) * 7 * e, hy = ty + Math.sin(now / 290) * 5 * e - Math.sin(q * Math.PI) * 90;
      nx = L.fx + (hx - L.fx) * e; ny = L.fy + (hy - L.fy) * e; grow = .45 * e;
      if (L.dive) { const d = Math.min(1, (now - L.dive) / L.diveDur); grow = .45 - 2.3 * d * d; nx = tx; ny = ty; if (d >= 1) { hidden = true; } }
      if (L.into) { const d = Math.min(1, (now - L.into.t0) / L.into.dur), e2 = d * d * (3 - 2 * d); grow = .45 + (L.into.g - .45) * e2; nx = tx; ny = ty; fade = 1 - Math.max(0, (d - .55) / .45); if (d >= 1) hidden = true; }
    }
    vx = (nx - x) / dt; vy = (ny - y) / dt; x = nx; y = ny;
    const speed = Math.hypot(vx, vy);
    if (speed > 30) { const want = Math.atan2(vy, vx) + Math.PI / 2; let d = want - ang; d = Math.atan2(Math.sin(d), Math.cos(d)); ang += d * (1 - Math.exp(-dt * 8)); }
    else ang *= Math.exp(-dt * 2.5);                                     // at rest it settles upright
    hover += (hoverT - hover) * (1 - Math.exp(-dt * 12)); press *= Math.exp(-dt * 7);
    phase += dt * (7 + Math.min(18, speed / 60) + press * 30 + (arrival ? 14 : 0));           // faster wing beats when you move or click
    const flap = .5 + .5 * Math.sin(phase);
    const open = hover > .5 ? .95 : .18 + .8 * flap;                    // over a link it spreads its wings and holds still
    const show = (visible || arrival || leading) && !hidden;
    if (use3d && L.texReady) {
      if (!captured) {
        const B = L.butterfly;
        if (show) {
          if (B.group.parent !== L.scene) L.scene.add(B.group);
          let px = Math.max(.01, (2.0 + hover * .5 + press * .35 + grow * 1.6) * (1 - .06 * Math.sin(phase))) * 16; if (s0) px = s0 + (px - s0) * sq; lastPx = px;
          B.pose({ x, y: -y, heading: -(leading && leading.into ? 0 : ang), flap: Math.acos(Math.max(.06, Math.min(1, open))), bend: Math.cos(phase) * .22, scale: px, fade, shadow: .22, shadowOff: [4, -(4 + 2 * flap)] });
        } else B.group.visible = false;
      }
    } else if (show) {
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.rotate(leading && leading.into ? 0 : ang);
      const sc = Math.max(.01, (2.0 + hover * .5 + press * .35 + grow * 1.6) * (1 - .06 * Math.sin(phase))); ctx.scale(sc, sc);   // bigger: the butterfly is the guide (it lifts a little on each wing beat)
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 4 + 2 * flap;   // its shadow on the paper breathes with the wings
      wing(open); ctx.scale(-1, 1); wing(open); ctx.restore();
      // body and antennae
      ctx.fillStyle = '#100c0c'; ctx.beginPath(); ctx.ellipse(0, 1, 1.1, 6.2, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#100c0c'; ctx.lineWidth = .7; ctx.lineCap = 'round';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -4.6); ctx.quadraticCurveTo(sx * 1.6, -8.5, sx * 3, -10); ctx.stroke(); ctx.beginPath(); ctx.arc(sx * 3, -10, .8, 0, 7); ctx.fillStyle = '#100c0c'; ctx.fill(); }
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    set(h) { hoverT = h ? 1 : 0; },
    label(text) { tag.textContent = text || ''; tag.classList.toggle('on', !!text); },
    hide(h) { hidden = !!h; },
    arrive(fx, fy, dur = 1100) { hidden = false; leading = null; arrival = { fx, fy, t0: performance.now(), dur }; x = fx; y = fy; },
    lead(get, dur = 1400) { hidden = false; arrival = null; leading = { get, fx: x, fy: y, t0: performance.now(), dur }; },
    dive(dur = 1000) { if (leading) { leading.dive = performance.now(); leading.diveDur = dur; } },
    into(px, dur = 700) { if (leading) leading.into = { t0: performance.now(), dur, g: (px / 31 - 2) / 1.6 }; },   // grow to px wide and melt into what is there
    capture() { if (!use3d) return null; captured = true; leading = null; arrival = null; return { x, y, heading: -ang, scale: lastPx }; },   // the story takes the butterfly from your hand
    adopt(p) { captured = false; hidden = false; if (!p) return; x = p.x; y = p.y; ang = -(p.heading || 0); arrival = { fx: p.x, fy: p.y, t0: performance.now(), dur: 600, flat: true, s0: p.scale }; },   // ...and gives it back
    pos() { return [mx, my]; },
    release(fx, fy) { const p = leading ? leading.get() : [fx, fy]; this.arrive(fx ?? p[0], fy ?? p[1], 1200); },
  };
}
