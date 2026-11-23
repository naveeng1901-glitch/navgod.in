import { createSwarm, swarmFontReady } from './swarmword.js';
/* =========================================================
   THE NAME: "naveen godugupalli" becomes NAV + GOD, then stays alive
   1. the full name rises in; the extra letters blush red and fall away;
      nav + god slide together and land on the eye's wordmark (the o is the eye)
   2. play: letters squash and lean away from the cursor and spring back,
      a click scatters them (they bounce home), and hovering nav / god
      whispers the full name underneath in red italic
   ========================================================= */
const FULL = 'naveen godugupalli';
const KEEP = { 0: 0, 1: 1, 2: 2, 7: 3, 8: 'eye', 9: 4 };   // index in FULL -> index in the eye's glyphs (navg + d), or the eye
const PAPER = '#ece8e2', INK = '#111111', RED = '#c8261b';
const END = 3.6;
const MOVING = false;   // the tapes + rows were too busy (kept in case a calmer version comes back)
const RIBBON = false;
const FLAP = false, LIQUID = false;
const STRIPS = false;   // the tapes, but above and below the word (never behind it)   // split-flap board under the word + a liquid line under that   // one satisfying tape instead: soft, bendy, grab-and-fling

const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const back = t => { const c = 1.45; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;

export function playNameMorph(layout, { onDone, sound, view, hold, progress, quietHold, lineReady, swarm: SWARM, onGuide } = {}) {
  let L = layout();
  if (!L || !L.glyphs || !L.type) { onDone && onDone(); return null; }
  const dpr = L.dpr;
  const cv = document.createElement('canvas'); cv.id = 'name-morph';
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:20;pointer-events:none';
  document.body.appendChild(cv);
  const x = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const font = s => `800 ${s}px Inter, system-ui, sans-serif`;

  // where every letter starts: the full name, smaller, centred
  const fsF = L.type.fs, fs0 = Math.min(fsF * .42, W * .9 / 10);
  x.font = font(fs0);
  const sp0 = -fs0 * .03;
  const widths = [...FULL].map(ch => ch === ' ' ? fs0 * .3 : x.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b + sp0, -sp0);
  let cx = (W - total) / 2; const base0 = H * .47 + fs0 * .2;
  const letters = [...FULL].map((ch, i) => { const l = { ch, i, x0: cx, b0: base0 }; cx += widths[i] + sp0; return l; });
  const home = () => {                                      // where the kept ones live (re-read, so a resize still lines up)
    L = layout(); x.font = font(L.type.fs);
    for (const l of letters) {
      const k = KEEP[l.i]; if (k === undefined) continue;
      if (k === 'eye') { const ow = x.measureText('o').width; l.x1 = L.eye.x - ow / 2; l.b1 = L.eye.y + L.type.fs * .275; l.eye = true; }
      else { l.x1 = L.glyphs[k].x; l.b1 = L.type.base; l.w = x.measureText(l.ch).width; }
    }
  };
  home();
  for (const l of letters) if (KEEP[l.i] === undefined) { l.fall = true; l.vx = (Math.random() - .5) * fs0 * 1.4; l.rot = (Math.random() - .5) * 1.6; }
  letters.filter(l => l.fall && l.ch !== ' ').forEach((l, j) => (l.t0 = 1.45 + j * .045));
  const kept = letters.filter(l => !l.fall);
  kept.forEach((l, j) => (l.tm = 1.95 + j * .02));
  const live = kept.filter(l => !l.eye);                    // n a v g d: the ones you can play with
  for (const l of live) Object.assign(l, { ox: 0, oy: 0, vx2: 0, vy2: 0, r: 0, vr: 0, sq: 0, vsq: 0 });

  let swarm = null, preSwarm = null, preAsked = false;
  addEventListener('resize', () => { if (!swarm && preSwarm) { preSwarm.destroy(); preSwarm = null; preAsked = false; } });
  let t = 0, extra = 0, raf, done = false, fellSound = false, last = 0, clock = 0, mode = 'morph';
  let mx = -1e4, my = -1e4, pmx = mx, scatterT = -9, hintNav = 0, hintGod = 0;
  const onWheel = e => { if (mode === 'morph') extra += Math.abs(e.deltaY) * .004; };
  const onMove = e => { mx = e.clientX * dpr; my = e.clientY * dpr; };
  const onClick = e => {
    if (mode === 'morph') { extra += (t < 1.4 ? 1.4 : t < 1.95 ? 1.95 : END) - t; return; }
    // a click scatters the letters (a click on the eye is the eye's own business: it enters)
    const v = view && view(); if (v && Math.hypot(e.clientX * dpr - v.ex, e.clientY * dpr - v.ey) < L.eye.r * 1.05) return;
    if (e.target && e.target.closest && e.target.closest('button,a')) return;
    if (RIBBON && ribbon.onDown(e)) return;                     // grabbed the tape: drag and fling it instead of scattering
    scatterT = clock;
    for (const l of live) { const a = Math.random() * Math.PI * 2, sp = (1400 + Math.random() * 1600) * dpr; l.vx2 += Math.cos(a) * sp; l.vy2 += Math.sin(a) * sp - 600 * dpr; l.vr += (Math.random() - .5) * 18; }
    sound && sound.click && sound.click();
  };
  addEventListener('wheel', onWheel, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onClick);

  function physics(dt) {
    const loose = clock - scatterT < .7;                    // right after a scatter the spring is weak, so they really fly
    const k = loose ? 18 : 150, c = loose ? 2.5 : 13;
    const mvx = (mx - pmx) / Math.max(dt, 1e-3); pmx = mx;
    for (const l of live) {
      const cxl = l.x1 + l.ox + l.w / 2, cyl = l.b1 + l.oy - L.type.fs * .36;
      const dx = cxl - mx, dy = cyl - my, d = Math.hypot(dx, dy), R = L.type.fs * .62;
      let fx = -k * l.ox - c * l.vx2, fy = -k * l.oy - c * l.vy2;
      let sqT = 0, rT = 0;
      if (d < R) {                                          // the cursor presses the letter: it gives way, squashes, leans
        const p = 1 - d / R;
        fx += dx / (d || 1) * p * 2600 * dpr; fy += dy / (d || 1) * p * 1600 * dpr;
        sqT = p * .28; rT = Math.max(-.4, Math.min(.4, mvx / (4000 * dpr))) * p;
      }
      l.vx2 += fx * dt; l.vy2 += fy * dt; l.ox += l.vx2 * dt; l.oy += l.vy2 * dt;
      l.vsq += (-(l.sq - sqT) * 260 - l.vsq * 16) * dt; l.sq += l.vsq * dt;
      l.vr += (-(l.r - rT) * 120 - l.vr * (loose ? 3 : 11)) * dt; l.r += l.vr * dt;
    }
    // hovering nav or god whispers the full name
    const over = grp => { const x0 = Math.min(...grp.map(l => l.x1)), x1 = Math.max(...grp.map(l => l.x1 + l.w)); return mx > x0 && mx < x1 && my > L.type.base - L.type.fs * .8 && my < L.type.base + L.type.fs * .3; };
    const nav = live.slice(0, 3), god = [live[3], live[4]];
    hintNav += ((over(nav) ? 1 : 0) - hintNav) * (1 - Math.exp(-dt * 8));
    hintGod += ((over(god) ? 1 : 0) - hintGod) * (1 - Math.exp(-dt * 8));
  }

  function draw() {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    const v = view ? view() : null, sc = v ? v.sc : 1, fadeOut = v ? v.fade : 0;
    // the swarm: at the moment the extra letters would fall, every letter turns into butterflies that fly to "navgod"
    const BURST = 1.45;
    const makeSwarm = () => { home(); return createSwarm({ canvas: cv, ctx: x, dpr, sound, onGuide,
        sources: letters.filter(l => l.ch !== ' ').map(l => ({ ch: l.ch, x: l.x0, b: l.b0, font: font(fs0) })),
        target: () => ({ glyphs: L.glyphs, base: L.type.base, fs: L.type.fs, font: font(L.type.fs), eye: L.eye }) }); };
    // build the swarm early, in a quiet moment while the loader is still running, so the burst itself costs nothing
    if (SWARM && !swarm && !preSwarm && !preAsked && swarmFontReady()) {
      preAsked = true; const idle = window.requestIdleCallback || (f => setTimeout(f, 30));
      idle(() => { if (!swarm && !preSwarm && !done) preSwarm = makeSwarm(); }, { timeout: 1200 });
    }
    if (SWARM && !swarm && t >= BURST) swarm = preSwarm || makeSwarm();
    // the paper covers the eye only during the morph, then dissolves
    const paper = 1 - clamp01((t - 3.05) / .5);
    if (paper > 0) { x.globalAlpha = paper; x.fillStyle = PAPER; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
    const lineIn = lineReady ? 1 : easeOut(clamp01(t / .6)),   // (handed over already drawn by the loader's butterfly)
          _li = 0, lineOut = easeInOut(clamp01((t - 1.7) / .5));
    const lw = frame.holdP != null ? (quietHold ? 0 : W * .62 * Math.max(.04, frame.holdP)) : W * .62 * Math.max(lineIn, frame.lastHold ? 1 : 0) * (1 - lineOut);   // while loading, the red hairline is the progress bar
    if (lw > 1) { x.fillStyle = RED; x.fillRect(W / 2 - lw / 2, base0 + fs0 * .22, lw, Math.max(1, dpr)); }
    // moving text (after the morph): two tapes cross behind the word, and two rows run above and below it
    const mt = clamp01((t - 3.0) / .8) * (1 - fadeOut) * clamp01(1 - (sc - 1) * 1.5);   // gone as soon as the eye starts to open
    if (mt > 0 && MOVING) movingText(mt, v);
    if (mt > 0 && RIBBON) ribbon.draw(mt);
    if (mt > 0 && STRIPS) strips(mt);
    if (mt > 0 && FLAP) flap.draw(mt);
    if (mt > 0 && LIQUID) liquid.draw(mt);
    // entering: the letters ride the eye's zoom and dissolve with the wall
    const T = (px, py) => v && v.sc !== 1 ? [v.cx + (px - v.ex) * sc, v.cy + (py - v.ey) * sc] : [px, py];
    if (swarm) {   // the letters crumble into the swarm, and the swarm is the word from here on
      const crumble = clamp01((t - BURST) / .35);
      if (crumble < 1) for (const l of letters) { if (l.ch === ' ') continue; x.save(); x.globalAlpha = (1 - crumble) * (1 - fadeOut); x.fillStyle = INK; x.font = font(fs0); x.fillText(l.ch, l.x0, l.b0); x.restore(); }
      if (v && v.sc > 1.002) swarm.leave();
      swarm.update(Math.min(.05, frame.dt || .016)); swarm.draw(1 - clamp01((fadeOut - .75) / .25));   // the butterflies stay while they pour into the eye
    }
    for (const l of (swarm ? [] : letters)) {
      if (l.ch === ' ') continue;
      const rise = clamp01((t - .2 - l.i * .035) / .55);
      let px = l.x0, pb = l.b0 + (1 - back(rise)) * fs0 * .5, size = fs0, col = INK, alpha = clamp01(rise * 2.5), rot = 0, sx = 1, sy = 1;
      if (l.fall) {
        const k = t - l.t0;
        if (k > 0) {
          col = k < .18 ? INK : RED;
          const gr = Math.max(0, k - .18);
          pb += gr * gr * H * 2.2; px += l.vx * gr; rot = l.rot * gr * 2.2;
          alpha *= clamp01(1 - (pb - l.b0) / (H * .7));
        }
        if (alpha <= .001) continue;
      } else {
        const k = easeInOut(clamp01((t - l.tm) / .9)), kb = back(clamp01((t - l.tm) / .9));
        px = lerp(l.x0, l.x1, k); pb = lerp(l.b0, l.b1, kb); size = lerp(fs0, fsF, k);
        if (l.eye) { alpha *= 1 - clamp01((t - 3.0) / .35); if (alpha <= .001) continue; }
        if (mode === 'play' && !l.eye) { px += l.ox; pb += l.oy; rot = l.r; sx = 1 + l.sq * .9; sy = 1 - l.sq; }
        if (v && v.sc > 1 && l.i <= 2) { const k2 = clamp01((v.sc - 1) * .9); px -= k2 * k2 * W * .5; alpha *= 1 - k2; }   // entering: nav slides away; g◉d flows in with the eye
      }
      const [qx, qy] = T(px, pb);
      x.save(); x.globalAlpha = alpha * (1 - fadeOut); x.fillStyle = col; x.font = font(size);
      x.translate(qx, qy); x.rotate(rot); x.scale(sx * sc, sy * sc); x.fillText(l.ch, 0, 0); x.restore();
    }
    // the hint during the morph, and the whispers in play
    const cap = clamp01((t - 1.55) / .3) * (1 - clamp01((t - 2.15) / .3));
    x.font = `600 ${Math.round(16 * dpr)}px Inter, system-ui, sans-serif`; x.fillStyle = RED;
    if (cap > 0) { x.globalAlpha = cap; const capY = base0 + fs0 * .55; x.fillText('nav ← naveen', letters[0].x0, capY); x.fillText('god ← godugupalli', letters[7].x0, capY); }
    x.globalAlpha = 1;
  }
  // ---- the ribbon: one red tape behind the word, soft as cloth, you can push it, grab it, fling it ----
  const ribbon = (() => {
    const NN = 90, ys = new Float32Array(NN), vs = new Float32Array(NN);
    const phrase = 'naveen godugupalli  ·  ';
    let off = 0, vel = 0, grab = null, lastX = 0, lastT = 0, chars = null, pw = 0, fsz = 0;
    const ang = -.07;
    const frameOf = () => { const fsF2 = L.type.fs; return { cx: W / 2, cy: L.type.base - fsF2 * .3, h: fsF2 * .16, len: W * 1.3 }; };
    const toLocal = (px, py, f) => { const dx = px - f.cx, dy = py - f.cy, c = Math.cos(-ang), s2 = Math.sin(-ang); return [dx * c - dy * s2 + f.len / 2, dx * s2 + dy * c]; };
    const yAt = (u, f) => { const k = clamp01(u / f.len) * (NN - 1), i = Math.min(NN - 2, Math.floor(k)), t2 = k - i; return ys[i] * (1 - t2) + ys[i + 1] * t2; };
    function measure(f) {
      const size = f.h * .56; if (chars && Math.abs(size - fsz) < .5) return;
      fsz = size; x.font = `800 ${fsz}px Inter, system-ui, sans-serif`;
      chars = [...phrase].map(ch => ({ ch, w: x.measureText(ch).width })); pw = chars.reduce((a, c) => a + c.w, 0);
    }
    function onDown(e) {
      const f = frameOf(), [u, w] = toLocal(e.clientX * dpr, e.clientY * dpr, f);
      if (u < 0 || u > f.len || Math.abs(w - yAt(u, f)) > f.h * .7) return false;
      grab = { u }; lastX = u; lastT = performance.now(); vel = 0; return true;
    }
    function onMoveR(e) {
      if (!grab) return;
      const f = frameOf(), [u] = toLocal(e.clientX * dpr, e.clientY * dpr, f), now = performance.now();
      off += u - lastX; vel = (u - lastX) / Math.max(.008, (now - lastT) / 1000); lastX = u; lastT = now;
    }
    function onUp() { grab = null; }
    addEventListener('pointermove', onMoveR, { passive: true }); addEventListener('pointerup', onUp);
    function step(dt) {
      if (dt <= 0) return;
      const f = frameOf(); const [mu, mw] = toLocal(mx, my, f), R = f.h * 2.2;
      // the cloth: neighbours pull together, a spring holds it home, damping calms it; your cursor pushes it away
      const sub = 3, h = dt / sub;
      for (let k = 0; k < sub; k++) for (let i = 0; i < NN; i++) {
        const u = i / (NN - 1) * f.len, l = ys[Math.max(0, i - 1)], r = ys[Math.min(NN - 1, i + 1)];
        let a = (l + r - 2 * ys[i]) * 900 - ys[i] * 40 - vs[i] * 5;
        const d = Math.hypot(u - mu, ys[i] - mw);
        if (d < R && !grab) a += Math.sign(ys[i] - mw || 1) * (1 - d / R) * 9000 * dpr;
        vs[i] += a * h; ys[i] += vs[i] * h;
      }
      if (!grab) { vel += ((50 * dpr) - vel) * (1 - Math.exp(-dt * 1.2)); off += vel * dt; }   // flung, then it eases back to a slow drift
    }
    function draw(alpha) {
      const f = frameOf(); measure(f);
      x.save(); x.globalAlpha = alpha;
      const e = L.eye; x.beginPath(); x.rect(0, 0, W, H); x.arc(e.x, e.y, e.r * 1.06, 0, Math.PI * 2, true); x.clip('evenodd');
      x.translate(f.cx, f.cy); x.rotate(ang); x.translate(-f.len / 2, 0);
      // the tape body follows the cloth
      x.beginPath();
      for (let i = 0; i < NN; i++) { const u = i / (NN - 1) * f.len; i ? x.lineTo(u, ys[i] - f.h / 2) : x.moveTo(u, ys[i] - f.h / 2); }
      for (let i = NN - 1; i >= 0; i--) { const u = i / (NN - 1) * f.len; x.lineTo(u, ys[i] + f.h / 2); }
      x.closePath(); x.fillStyle = '#c8261b'; x.fill();
      // the words ride on it, stretching with speed
      const stretch = 1 + Math.min(.35, Math.abs(vel) / (2600 * dpr));
      x.fillStyle = '#fff'; x.font = `800 ${fsz}px Inter, system-ui, sans-serif`; x.textBaseline = 'middle';
      let u = (((off % (pw * stretch)) + pw * stretch) % (pw * stretch)) - pw * stretch;
      while (u < f.len) {
        for (const c of chars) {
          const cu = u + c.w * stretch / 2;
          if (cu > -20 && cu < f.len + 20) {
            const y0 = yAt(cu, f), slope = (yAt(cu + 4, f) - yAt(cu - 4, f)) / 8;
            x.save(); x.translate(cu, y0 + f.h * .03); x.rotate(Math.atan(slope)); x.scale(stretch, 1); x.fillText(c.ch, -c.w / 2, 0); x.restore();
          }
          u += c.w * stretch;
        }
      }
      x.restore();
    }
    return { step, draw, onDown };
  })();

  // ---- 1. split-flap board: 'navgod' flips, clack-clack, into 'naveen godugupalli' while you hover the word ----
  const flap = (() => {
    const LEN = 18, IDLE = '      navgod      ', FULLN = 'naveen godugupalli';
    const SEQ = ' abcdefghijklmnopqrstuvwxyz';
    const tiles = [...IDLE].map(ch => ({ cur: ch, next: ch, p: 1, wait: 0 }));
    let target = IDLE, tickT = 0;
    const geo = () => { const f = L.type.fs, tw = f * .082, gap = tw * .14, th = tw * 1.38; return { tw, th, gap, x0: W / 2 - (LEN * (tw + gap) - gap) / 2, y0: L.type.base + f * .3 }; };
    const overWord = () => { const g0 = L.glyphs[0], g4 = L.glyphs[4]; x.font = font(L.type.fs); const x1 = g4.x + x.measureText('d').width;
      return mx > g0.x && mx < x1 && my > L.type.base - L.type.fs * .78 && my < L.type.base + L.type.fs * .45; };
    function step(dt) {
      const want = overWord() ? FULLN : IDLE;
      if (want !== target) { target = want; tiles.forEach((tl, i) => { tl.goal = want[i]; tl.wait = i * .035; }); }
      for (const tl of tiles) {
        if (tl.goal === undefined || (tl.cur === tl.goal && tl.p >= 1)) continue;
        if (tl.wait > 0) { tl.wait -= dt; continue; }
        if (tl.p >= 1) {                                        // start the next flip: one letter forward through the alphabet
          if (tl.cur === tl.goal) continue;
          const i = SEQ.indexOf(tl.cur), j = SEQ.indexOf(tl.goal);
          const n = SEQ.length, fd = (j - i + n) % n;          // always roll forward through the alphabet
          tl.next = fd > 5 ? SEQ[(j - 5 + n) % n] : SEQ[(i + 1) % n];   // skip ahead so every tile lands in ~5 flaps
          if (tl.next === ' ' && tl.goal !== ' ') tl.next = SEQ[1];
          if (tl.goal === ' ') tl.next = ' ';
          tl.p = 0;
        }
        tl.p += dt / .06;
        if (tl.p >= 1) { tl.p = 1; tl.cur = tl.next; tickT++; }
      }
      if (tickT && sound && sound.blink && clock - (step.lastTick || 0) > .045) { sound.blink(); step.lastTick = clock; }
      tickT = 0;
    }
    function face(ch, cx, cy, tw, th, sy, half) {           // half: -1 top half, 1 bottom half; sy squashes it while flipping
      x.save(); x.beginPath(); half < 0 ? x.rect(cx - tw / 2, cy - th / 2, tw, th / 2) : x.rect(cx - tw / 2, cy, tw, th / 2); x.clip();
      x.translate(cx, cy); x.scale(1, sy);
      x.fillStyle = half < 0 ? '#1b1b1b' : '#141414'; x.fillRect(-tw / 2, -th / 2, tw, th);
      if (ch !== ' ') { x.fillStyle = '#f2efe9'; x.font = `800 ${th * .62}px Inter, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 0, th * .04); x.textAlign = 'start'; x.textBaseline = 'alphabetic'; }
      x.restore();
    }
    function draw(alpha) {
      const gm = geo(); x.save(); x.globalAlpha = alpha;
      tiles.forEach((tl, i) => {
        const cx = gm.x0 + i * (gm.tw + gm.gap) + gm.tw / 2, cy = gm.y0 + gm.th / 2;
        if (tl.cur === ' ' && tl.next === ' ' && tl.p >= 1) { x.fillStyle = 'rgba(17,17,17,.07)'; x.fillRect(cx - gm.tw / 2, cy - gm.th / 2, gm.tw, gm.th); return; }
        // static: new top + old bottom; the flap falls: old top folds down, then new bottom unfolds
        const p = tl.p;
        face(tl.next, cx, cy, gm.tw, gm.th, 1, -1);
        face(p < .5 ? tl.cur : tl.next, cx, cy, gm.tw, gm.th, 1, 1);
        if (p < 1) {
          if (p < .5) face(tl.cur, cx, cy, gm.tw, gm.th, 1 - p * 2, -1);
          else face(tl.next, cx, cy, gm.tw, gm.th, (p - .5) * 2, 1);
        }
        x.fillStyle = '#ece8e2'; x.fillRect(cx - gm.tw / 2, cy - .6 * dpr, gm.tw, 1.2 * dpr);   // the seam
      });
      x.restore();
    }
    return { step, draw };
  })();

  // ---- 5. liquid line: your cursor ripples it like water ----
  const liquid = (() => {
    const text = 'the design museum of naveen godugupalli';
    let img = null, iw = 0, ih = 0, size = 0;
    const waves = []; let lastMX = mx, lastMY = my, spawnT = 0;
    function build() {
      const f = L.type.fs * .062; if (img && Math.abs(f - size) < .5) return; size = f;
      const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = `500 ${f}px Inter, system-ui, sans-serif`;
      iw = Math.ceil(g.measureText(text).width) + 8; ih = Math.ceil(f * 1.6); c.width = iw; c.height = ih;
      g.font = `500 ${f}px Inter, system-ui, sans-serif`; g.fillStyle = '#3a3836'; g.textBaseline = 'middle'; g.fillText(text, 4, ih / 2); img = c;
    }
    const pos = () => ({ x: W / 2 - iw / 2, y: L.type.base + L.type.fs * .58 });
    function step(dt) {
      build(); const pp = pos();
      const near = my > pp.y - ih * 2 && my < pp.y + ih * 3 && mx > pp.x - 60 && mx < pp.x + iw + 60;
      const sp = Math.hypot(mx - lastMX, my - lastMY) / Math.max(dt, .001); lastMX = mx; lastMY = my;
      spawnT -= dt;
      if (near && sp > 40 && spawnT <= 0) { waves.push({ x: mx - pp.x, age: 0, amp: Math.min(1, sp / 2500) * ih * .45 }); spawnT = .05; }
      for (const w of waves) w.age += dt;
      while (waves.length && waves[0].age > 2.4) waves.shift();
    }
    function draw(alpha) {
      if (!img) return; const pp = pos(); x.save(); x.globalAlpha = alpha * .9;
      const col = 2 * dpr;
      for (let sx = 0; sx < iw; sx += col) {
        let dy = 0;
        for (const w of waves) { const d = sx - w.x; dy += w.amp * Math.exp(-w.age * 2.2) * Math.sin(d * .045 - w.age * 11) * Math.exp(-Math.abs(d) / (120 * dpr + w.age * 260 * dpr)); }
        x.drawImage(img, sx, 0, col, ih, pp.x + sx, pp.y + dy, col, ih);
      }
      x.restore();
    }
    return { step, draw };
  })();

  // ---- moving text ----
  let flow = 0, flowV = 0;
  const strip = (text, fsz) => { x.font = `800 ${fsz}px Inter, system-ui, sans-serif`; return { text, w: x.measureText(text).width, fsz }; };
  function runText(st, y, offset, color) {                   // repeat a phrase across the screen, shifted by offset (px)
    x.fillStyle = color; x.font = `800 ${st.fsz}px Inter, system-ui, sans-serif`;
    let xx = -((offset % st.w) + st.w) % st.w - st.w;
    while (xx < W * 1.6) { x.fillText(st.text, xx, y); xx += st.w; }
  }
  function tape(angle, cy, h, bg, fg, st, offset, eye) {
    x.save();
    if (eye) { x.beginPath(); x.rect(0, 0, W, H); x.arc(eye.x, eye.y, eye.r * 1.06, 0, Math.PI * 2, true); x.clip('evenodd'); }   // never over the eye
    x.translate(W / 2, cy); x.rotate(angle); x.translate(-W * .8, 0);
    x.fillStyle = bg; x.fillRect(0, -h / 2, W * 1.6, h);
    x.textBaseline = 'middle'; runText(st, h * .04, offset, fg); x.textBaseline = 'alphabetic';
    x.restore();
  }
  function strips(alpha) {
    const f = L.type.fs, h = f * .15;
    x.save(); x.globalAlpha = alpha;
    const tRed = strip('naveen godugupalli  ·  ', h * .52), tBlack = strip('the design museum  ·  ', h * .52);
    tape(0, L.type.base - f * 1.02, h, '#c8261b', '#fff', tRed, flow * 1.1, null);       // above: red, running one way
    tape(0, L.type.base + f * .48, h, '#111', '#fff', tBlack, -flow * .9, null);          // below: black, running the other
    x.restore();
  }
  function movingText(alpha, v) {
    const fsF2 = L.type.fs, cy = L.type.base - fsF2 * .3, eye = L.eye;
    x.save(); x.globalAlpha = alpha;
    const h = fsF2 * .17;
    const tRed = strip('naveen godugupalli  ·  ', h * .52), tBlack = strip('design museum  ·  ', h * .52);
    tape(-.13, cy + fsF2 * .05, h, '#c8261b', '#fff', tRed, flow * 1.1, eye);
    tape(.1, cy + fsF2 * .12, h, '#111', '#fff', tBlack, -flow * .9, eye);
    // split rows: naveen over nav, godugupalli under god, running opposite ways
    const rowF = fsF2 * .085;
    const top = strip('naveen   ', rowF), bot = strip('godugupalli   ', rowF);
    x.globalAlpha = alpha * .9;
    runText(top, L.type.base - fsF2 * .98, -flow * .7, '#111');
    runText(bot, L.type.base + fsF2 * .42, flow * .7, '#111');
    x.restore();
  }

  function frame(now) {
    const dt = last ? Math.min(.05, Math.max(0, (now - last) / 1000)) : 0; frame.dt = dt;
    const holding = hold && hold() && clock < .01;           // the museum is still getting ready: wait on the hairline
    if (!holding) clock += last ? Math.min(.1, Math.max(0, (now - last) / 1000)) : 0; last = now;
    frame.holdP = holding ? (progress ? progress() : 0) : null; if (holding) frame.lastHold = Math.max(frame.lastHold || 0, frame.holdP);
    t = Math.min(END, clock + extra);
    if (!fellSound && t > 1.5) { fellSound = true; sound && sound.whoosh && sound.whoosh(.8); }
    if (mode === 'morph' && t >= END) { mode = 'play'; home(); onDone && onDone(); }
    if (mode === 'play') physics(dt);
    if (RIBBON && mode === 'play') ribbon.step(dt);
    if (mode === 'play') { FLAP && flap.step(dt); LIQUID && liquid.step(dt); }
    flowV += ((60 + Math.min(900, Math.abs(mx - (frame.lmx ?? mx)) / Math.max(dt, .001) * .25)) * dpr - flowV) * (1 - Math.exp(-dt * 3)); frame.lmx = mx;
    flow += flowV * dt;
    draw();
    if (!done) raf = requestAnimationFrame(frame);
  }
  function destroy() {
    if (done) return; done = true; cancelAnimationFrame(raf);
    removeEventListener('wheel', onWheel); removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onClick); swarm && swarm.destroy(); preSwarm && preSwarm !== swarm && preSwarm.destroy();
    cv.remove(); swarm && swarm.destroy();
  }
  addEventListener('resize', () => { if (mode === 'play') home(); });
  raf = requestAnimationFrame(frame);
  return { skip() { extra = 99; }, destroy, lineAt: () => ({ y: (base0 + fs0 * .22) / dpr, w: W * .62 / dpr }) };
}
