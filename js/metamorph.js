/* =========================================================
   METAMORPH: the bridge between the museum (digital) and CenterPiece (handmade)
   Going in, the story runs backwards. The crisp butterfly lands and folds its wings; a silk thread spins round it,
   layer on layer; the cocoon is shaded by hand in pencil on cream paper (hatching, smudge, highlight, grain). Inside
   CenterPiece it glows, twitches, cracks; the top lifts, a pencil worm pokes its head out, looks around, wriggles free
   and crawls onto CenterPiece's own worm. Coming back it runs forwards: the worm curls up and spins itself a cocoon,
   which glows, twitches, cracks, and a crisp butterfly climbs out and unfolds its wings, flying off as your cursor.
   No words: the drawing tells it.
   ========================================================= */
const GR = '#1d1916', LIGHT = 'rgba(255,244,232,.35)', PAPER = '#efe6d6';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const sm = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const bump = (t, at, w) => Math.exp(-(((t - at) / w) ** 2));
const SLOW = (() => { try { return +new URLSearchParams(location.search).get('metaslow') || 1; } catch (e) { return 1; } })();   // DEV ONLY: slow motion for checking

function drawCrisp(g, x, y, s, open, a, rot = 0) {   // the full-colour butterfly (same drawing as the cursor); open 1 = spread, ~.1 = folded up
  if (a <= .01) return;
  g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(rot); g.scale(s, s);
  for (const sx of [1, -1]) {
    g.save(); g.scale(sx * Math.max(.06, open), 1);
    g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(4, -9, 12, -12, 15, -8); g.bezierCurveTo(16, -5, 12, -1, 1, 0); g.closePath(); g.fillStyle = '#141111'; g.fill();
    g.beginPath(); g.moveTo(5, -4.5); g.bezierCurveTo(8, -7.5, 11, -8.5, 13, -8); g.lineTo(12.2, -6); g.bezierCurveTo(10, -6.3, 7.5, -5, 5.6, -3); g.closePath(); g.fillStyle = '#d42a1c'; g.fill();
    g.fillStyle = '#f2ece4'; for (const [px, py, r] of [[13.2, -9.6, .9], [11.6, -10.2, .7], [14.4, -8.2, .6]]) { g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); }
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(6, 0, 11, 3, 10, 7); g.bezierCurveTo(8, 10, 3, 9, 0, 3); g.closePath(); g.fillStyle = '#141111'; g.fill();
    g.beginPath(); g.moveTo(4, 7.4); g.bezierCurveTo(6.5, 8.8, 9, 8, 9.9, 6.3); g.lineTo(9, 5.9); g.bezierCurveTo(8, 7.2, 6.2, 7.5, 4.6, 6.6); g.closePath(); g.fillStyle = '#d42a1c'; g.fill();
    g.restore();
  }
  g.fillStyle = '#100c0c'; g.beginPath(); g.ellipse(0, 1, 1.1, 6.2, 0, 0, 7); g.fill();
  g.strokeStyle = '#100c0c'; g.lineWidth = .7; g.lineCap = 'round';
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(0, -4.6); g.quadraticCurveTo(sx * 1.6, -8.5, sx * 3, -10); g.stroke(); g.beginPath(); g.arc(sx * 3, -10, .8, 0, 7); g.fillStyle = '#100c0c'; g.fill(); }
  g.restore();
}

// a pencil line: graphite in two slightly different passes over a pale halo, so it reads on dark and on red
function pencil(g, pts, jit, a, seed, w = 1.25, closed = false) {
  if (a <= .01 || pts.length < 2) return;
  for (const [col, lw, al] of [[LIGHT, w * 2.6, a * .5], [GR, w, a * .9], [GR, w * .65, a * .4]]) {
    g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha = al; g.lineCap = g.lineJoin = 'round'; g.beginPath();
    pts.forEach(([x, y], i) => { const nx = (hash(seed + i * 1.7) - .5) * jit, ny = (hash(seed + i * 2.3 + 9) - .5) * jit; i ? g.lineTo(x + nx, y + ny) : g.moveTo(x + nx, y + ny); });
    if (closed) g.closePath(); g.stroke(); seed += 41;
  }
  g.globalAlpha = 1;
}

export function createMetamorph(cursorScale = 4.2) {
  const cv = document.createElement('canvas'); cv.id = 'metamorph';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:70;pointer-events:none';
  const g = cv.getContext('2d');
  let dpr = 1, raf = 0, scene = null;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  const start = () => { if (!cv.isConnected) { size(); document.body.append(cv); } if (!raf) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; cv.remove(); scene = null; };
  function loop(now) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight); if (scene) scene(now); raf = requestAnimationFrame(loop); }

  const S = cursorScale, RX = 23, RY = 54;   // the cocoon (css px): a pear, narrow at the top where it hangs
  const cw = yn => Math.sqrt(Math.max(0, 1 - yn * yn)) * (.72 + .28 * (yn + 1) / 2);   // its width at height yn (-1 top .. 1 bottom)
  const outline = (x, y, k = 1) => Array.from({ length: 64 }, (_, i) => { const a = i / 64 * Math.PI * 2, yn = -Math.cos(a); return [x + Math.sin(a) * RX * k * cw(yn) / .86, y + yn * RY * k]; });
  // the silk: a helix over the cocoon, in passes (down, up, down, up), each a little fuller
  const SILK = (() => { const pts = []; const P = 4, turns = 7, per = 70;
    for (let p = 0; p < P; p++) for (let i = 0; i <= per; i++) {
      const u = i / per, yn = p % 2 ? 1 - 2 * u : -1 + 2 * u, a = (p * per + i) / per * turns * Math.PI * 2 / P * 1.6, r = (.55 + .45 * (p + u) / P);
      pts.push([Math.sin(a) * RX * r * cw(yn * .96) / .86, yn * RY * .96 + Math.cos(a) * RX * .16 * r, Math.cos(a)]);   // [x, y, depth: >0 in front]
    }
    return pts; })();

  // the shaded cocoon, drawn once at high resolution: cream paper, cross-hatching, smudge, highlight, grain, outline
  const COC = (() => {
    const pad = 16, W = (RX * 2 + pad * 2), H = (RY * 2 + pad * 2), k = 3, c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
    const x = c.getContext('2d'); x.scale(k, k); const cx = W / 2, cy = H / 2, ol = outline(cx, cy);
    const path = () => { x.beginPath(); ol.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); };
    path(); x.fillStyle = PAPER; x.fill();
    x.save(); path(); x.clip();
    const sh = x.createLinearGradient(cx - RX, cy - RY, cx + RX, cy + RY); sh.addColorStop(0, 'rgba(40,30,25,0)'); sh.addColorStop(.55, 'rgba(40,30,25,.12)'); sh.addColorStop(1, 'rgba(40,30,25,.42)');
    x.fillStyle = sh; x.fillRect(0, 0, W, H);
    for (let i = -30; i < 40; i++) {            // hatching, heavier on the shadow side
      const xx = cx - RX * 1.4 + i * 2.1, a = clamp((xx - cx + RX * .2) / (RX * 1.6), 0, 1);
      x.strokeStyle = `rgba(29,25,22,${.08 + .4 * a})`; x.lineWidth = .55; x.beginPath(); x.moveTo(xx, cy - RY); x.lineTo(xx + RY * .55, cy + RY); x.stroke();
      if (a > .45) { x.strokeStyle = `rgba(29,25,22,${.25 * a})`; x.beginPath(); x.moveTo(xx + RY * .5, cy - RY); x.lineTo(xx - RY * .1, cy + RY); x.stroke(); }
    }
    for (let j = 0; j < 9; j++) {               // the silk wraps, as curved bands
      const yn = -.85 + j * .21; x.strokeStyle = 'rgba(29,25,22,.22)'; x.lineWidth = .7; x.beginPath();
      for (let i = 0; i <= 20; i++) { const u = i / 20 * 2 - 1, w = RX * cw(yn) / .86; x[i ? 'lineTo' : 'moveTo'](cx + u * w, cy + yn * RY + (1 - u * u) * 3.2 + Math.sin(i + j) * .5); } x.stroke();
    }
    const sm2 = x.createRadialGradient(cx + RX * .5, cy + RY * .5, 2, cx + RX * .5, cy + RY * .5, RY * .9); sm2.addColorStop(0, 'rgba(30,22,18,.28)'); sm2.addColorStop(1, 'rgba(30,22,18,0)');
    x.fillStyle = sm2; x.fillRect(0, 0, W, H);   // a smudge
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '60,45,35' : '255,250,240'},${Math.random() * .14})`; x.fillRect(Math.random() * W, Math.random() * H, .7, .7); }   // paper grain
    x.strokeStyle = 'rgba(255,252,246,.85)'; x.lineWidth = 2.2; x.lineCap = 'round'; x.beginPath();   // the highlight
    for (let i = 0; i <= 14; i++) { const yn = -.6 + i / 14 * .9; x[i ? 'lineTo' : 'moveTo'](cx - RX * cw(yn) / .86 * .55, cy + yn * RY); } x.stroke();
    x.restore();
    for (const [lw, a] of [[2.2, .25], [1.2, .85], [.7, .5]]) { x.strokeStyle = `rgba(29,25,22,${a})`; x.lineWidth = lw; x.beginPath(); ol.forEach(([a1, b], i) => { const j = (hash(i * 3.1 + lw) - .5) * .9; i ? x.lineTo(a1 + j, b + j) : x.moveTo(a1 + j, b + j); }); x.closePath(); x.stroke(); }
    return { c, W, H };
  })();
  const drawCocoon = (x, y, a, rot = 0, clipFn = null) => {
    if (a <= .01) return; g.save(); g.globalAlpha = a; g.translate(x, y - RY); g.rotate(rot); g.translate(0, RY);   // it swings from where it hangs
    if (clipFn) { g.beginPath(); clipFn(); g.clip(); }
    g.drawImage(COC.c, -COC.W / 2, -COC.H / 2, COC.W, COC.H); g.restore();
  };
  const hangThread = (x, y, a, rot, now) => pencil(g, [[x, y - RY * .98], [x + Math.sin(now / 700) * 1.5, y - RY - 80]], .6, a, 3, 1);
  const glow = (x, y, a, now) => {   // light inside the cocoon, breathing
    if (a <= .01) return; const r = RY * (1.3 + .1 * Math.sin(now / 160)), gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, `rgba(255,190,120,${.45 * a})`); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
  };
  // the crack: a zig-zag across the upper third, drawn as it opens
  const CRACK = Array.from({ length: 9 }, (_, i) => [-RX * .82 + i / 8 * RX * 1.64, -RY * .32 + (i % 2 ? -4 : 4) + (hash(i) - .5) * 3]);
  const crackAt = (x, y, k) => CRACK.slice(0, Math.max(2, Math.round(k * CRACK.length))).map(([a, b]) => [x + a, y + b]);
  // the two halves, in the cocoon's own frame (its centre is 0,0), so each half can swing and fall on its own
  const ABOVE = () => { g.moveTo(-RX * 2, -RY * 2); g.lineTo(-RX * 2, CRACK[0][1]); CRACK.forEach(([a, b]) => g.lineTo(a, b)); g.lineTo(RX * 2, CRACK[CRACK.length - 1][1]); g.lineTo(RX * 2, -RY * 2); g.closePath(); };
  const BELOW = () => { g.moveTo(-RX * 2, RY * 2); g.lineTo(-RX * 2, CRACK[0][1]); CRACK.forEach(([a, b]) => g.lineTo(a, b)); g.lineTo(RX * 2, CRACK[CRACK.length - 1][1]); g.lineTo(RX * 2, RY * 2); g.closePath(); };
  // the silk being spun: everything up to the spinner, the far side fainter, and a bright point where it is spinning
  const silk = (x, y, k, a, rot = 0) => {
    const n = Math.max(2, Math.round(k * SILK.length)), pts = SILK.slice(0, n);
    g.save(); g.translate(x, y - RY); g.rotate(rot); g.translate(0, RY);
    for (const front of [false, true]) {
      const seg = []; let segs = [];
      pts.forEach(p => { if ((p[2] > 0) === front) seg.push([p[0], p[1]]); else if (seg.length) { segs.push(seg.splice(0)); } }); if (seg.length) segs.push(seg);
      segs.forEach((s2, j) => pencil(g, s2, .6, a * (front ? 1 : .35), j * 7 + (front ? 3 : 0), front ? .9 : .7));
    }
    if (k < 1) { const p = pts[pts.length - 1]; g.fillStyle = `rgba(255,248,236,${a})`; g.beginPath(); g.arc(p[0], p[1], 2.2, 0, 7); g.fill(); }
    g.restore();
  };

  // the pencil worm on a skeleton (head first), shaped like CenterPiece's own worm
  function drawWorm(sk, w, a, seed, now, look = 0) {
    if (a <= .01) return;
    const n = sk.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p = sk[Math.max(0, i - 1)], q = sk[Math.min(n - 1, i + 1)], ang = Math.atan2(q[1] - p[1], q[0] - p[0]), t = i / (n - 1);
      const ww = w * Math.pow(1 - t, .6) * (.85 + .15 * Math.sin(t * 10 - now / 240)) + .6, nx = -Math.sin(ang), ny = Math.cos(ang);
      L.push([sk[i][0] + nx * ww, sk[i][1] + ny * ww]); R.push([sk[i][0] - nx * ww, sk[i][1] - ny * ww]);
    }
    // paper body, then pencil
    g.save(); g.globalAlpha = a * .9; g.fillStyle = PAPER; g.beginPath(); [...L, ...R.slice().reverse()].forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); g.restore();
    pencil(g, [...L, ...R.slice().reverse()], 1.1, a, seed, 1.3, true);
    for (let i = 2; i < n - 2; i += 2) pencil(g, [L[i], R[i]], .8, a * .45, seed + i * 5, .8);   // segment rings, hatched by hand
    const h = sk[0], hr = w * 1.15;
    g.save(); g.globalAlpha = a; g.fillStyle = PAPER; g.beginPath(); g.arc(h[0], h[1], hr, 0, 7); g.fill(); g.restore();
    pencil(g, Array.from({ length: 16 }, (_, k) => [h[0] + Math.cos(k / 15 * 6.283) * hr, h[1] + Math.sin(k / 15 * 6.283) * hr]), .9, a, seed + 99, 1.2);
    g.globalAlpha = a; g.fillStyle = GR;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(h[0] + hr * (.32 * s + .35 * look), h[1] - hr * .2, Math.max(1.3, hr * .2), 0, 7); g.fill(); }   // two eyes that look around
    g.globalAlpha = 1;
  }
  const curled = (x, y, n) => Array.from({ length: n }, (_, i) => { const u = i / n; return [x + Math.sin(u * Math.PI * 1.7) * RX * .5, y - RY * .45 + u * RY * 1.15]; });
  const resample = (pts, n) => Array.from({ length: n }, (_, i) => pts[Math.min(pts.length - 1, Math.round(i / (n - 1) * (pts.length - 1)))]);
  const twitch = t => .14 * bump(t, .2, .06) - .11 * bump(t, .55, .05) + .05 * bump(t, .7, .05);

  /* ---------- going in ---------- */
  function inward(x, y) {
    start();
    const T0 = performance.now(); let phase = 'spin', h0 = 0, cpw = null, fadeT = 0;
    const res = {}; res.cocooned = new Promise(r => (res._c = r));
    scene = now => {
      if (phase === 'spin') {
        const t = (now - T0) / 1000 / SLOW;
        // lands: the flapping slows, it settles, the wings fold up over its back
        const land = sm(0, .6, t), fold = sm(.55, 1.15, t), spun = sm(1.1, 3.3, t), shade = sm(3.0, 3.8, t);
        const flap = (1 - land) * Math.abs(Math.cos(t * 12)) + land;
        drawCrisp(g, x, y - (1 - land) * 18, S, (.25 + .75 * flap) * (1 - fold * .88), 1 - sm(.35, .85, spun));
        if (t > 1.05) { hangThread(x, y, sm(1.05, 1.4, t), 0, now); silk(x, y, spun, 1 - shade * .7); }
        drawCocoon(x, y, shade);
        if (shade > .6) silk(x, y, 1, (1 - shade) * 1.2 + .15);   // the last silk still shows a little over the shading
        if (t > 3.85 && res._c) { res._c(); res._c = null; }
      } else {
        const t = (now - h0) / 1000 / SLOW;
        const rot = twitch(t - .6), lift = ease(sm(2.0, 2.5, t)), crack = sm(1.45, 1.95, t), free = sm(3.4, 4.2, t), crawl = sm(4.1, 6.0, t);
        glow(x, y, sm(0, .5, t) * (1 - free), now);
        hangThread(x, y, 1 - free, rot, now);
        // the worm: inside, its head appears in the opening, looks left, right, then it wriggles out and away
        const tgt = cpw.pts, n = tgt.length, look = Math.sin(clamp((t - 2.6) / .9, 0, 1) * Math.PI * 2) * .8;
        const out = clamp((t - 2.25) / .6, 0, 1) * .25 + free * .75;
        const from = curled(x, y, n).map(([px, py], i) => [px, py - out * (RY * .9) * (1 - i / n * .5)]);
        const sk = from.map((p, i) => {
          const kk = ease(clamp(crawl * 1.35 - i / n * .35, 0, 1)), q = tgt[i], wav = Math.sin(t * 9 - i * .6) * 9 * (1 - kk) * Math.min(1, kk * 6 + free);
          const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1;
          return [p[0] + dx * kk - dy / d * wav, p[1] + dy * kk + dx / d * wav];
        });
        const wa = sm(2.25, 2.5, t) * (1 - sm(0, 1, fadeT ? (now - fadeT) / 650 / SLOW : 0));
        // lower half of the cocoon over the worm (it is inside), top half lifting away on a hinge
        drawWorm(sk, cpw.w * (.6 + .4 * crawl), wa, 23, now, look);
        const fall = free * free;
        drawCocoon(x, y + fall * 120, 1 - free, rot, crack < 1 ? null : BELOW);
        if (crack < 1) pencil(g, crackAt(x, y, crack), .8, crack, 61, 1.4);
        else drawCocoon(x + lift * 16 + fall * 40, y - lift * 22 - fall * 60, 1 - free, rot - lift * .7 - fall * 1.2, ABOVE);
        if (crawl >= 1 && !fadeT) { fadeT = now; res._h && res._h('handoff'); }
        if (fadeT && now - fadeT > 700 * SLOW) { res._h && res._h('done'); res._h = null; stop(); }
      }
    };
    res.hatch = getWorm => new Promise(r => {
      cpw = getWorm() || { pts: curled(x + 90, y + 160, 24), w: 8 };
      cpw.pts = resample(cpw.pts, Math.min(cpw.pts.length, 40));
      phase = 'hatch'; h0 = performance.now();
      res._h = st => { if (st === 'handoff') res.onHandoff && res.onHandoff(); else r(); };
    });
    return res;
  }

  /* ---------- coming back ---------- */
  function outward(getWorm) {
    start();
    const cpw = getWorm() || null, x = innerWidth / 2, y = innerHeight / 2;
    const pts0 = cpw ? resample(cpw.pts, Math.min(cpw.pts.length, 40)) : curled(x + 80, y + 140, 24), n = pts0.length, w = cpw ? cpw.w : 8;
    const T0 = performance.now(); let phase = 'spin', b0 = 0; const res = {};
    res.cocooned = new Promise(r => (res._c = r));
    scene = now => {
      if (phase === 'spin') {
        const t = (now - T0) / 1000 / SLOW;
        // the worm (in pencil over CenterPiece's own) crawls to the middle, curls up, and spins itself a cocoon
        const crawl = ease(sm(.2, 1.8, t)), tgt = curled(x, y, n), spun = sm(1.6, 3.6, t), shade = sm(3.3, 4.0, t);
        const sk = pts0.map((p, i) => { const kk = clamp(crawl * 1.35 - i / n * .35, 0, 1); return [p[0] + (tgt[i][0] - p[0]) * ease(kk), p[1] + (tgt[i][1] - p[1]) * ease(kk)]; });
        drawWorm(sk, w * (1 - .35 * crawl), sm(0, .4, t) * (1 - sm(.4, .9, spun)), 23, now);
        if (t > 1.5) { hangThread(x, y, sm(1.5, 1.9, t), 0, now); silk(x, y, spun, 1 - shade * .7); }
        drawCocoon(x, y, shade);
        if (t > 4.05 && res._c) { res._c(); res._c = null; }
      } else {
        const t = (now - b0) / 1000 / SLOW;
        // it glows, twitches, cracks; the top lifts and a crisp butterfly climbs out, unfolds its wings and goes
        const rot = twitch(t - .3), crack = sm(1.0, 1.4, t), lift = ease(sm(1.4, 1.8, t)), climb = ease(sm(1.6, 2.3, t)), unfold = ease(sm(2.2, 2.8, t)), gone = sm(2.6, 3.2, t);
        glow(x, y, sm(0, .4, t) * (1 - gone), now);
        hangThread(x, y, 1 - gone, rot, now);
        drawCrisp(g, x, y - RY * .2 - climb * RY * 1.1, S, .1 + .9 * unfold, sm(1.55, 1.75, t), 0);
        drawCocoon(x, y + gone * gone * 120, 1 - gone, rot, crack < 1 ? null : BELOW);
        if (crack < 1) pencil(g, crackAt(x, y, crack), .8, crack, 61, 1.4);
        else drawCocoon(x + lift * 16 + gone * 40, y - lift * 22 - gone * 60, 1 - gone, rot - lift * .7 - gone * 1.2, ABOVE);
        if (t > 3.0) { res._b && res._b(); res._b = null; stop(); }
      }
    };
    res.burst = () => new Promise(r => { phase = 'burst'; b0 = performance.now(); res._b = r; });
    res.at = [x, y - RY * 1.3];
    return res;
  }
  return { inward, outward, stop };
}
