/* =========================================================
   NAVGOD: the name becomes a swarm
   Every letter of "naveen godugupalli" crumbles into red butterflies of four kinds (swallowtail,
   monarch, small copper, longwing). They fly the way real ones do: bursts of flapping, short
   glides, a bob on every wingbeat, small sudden turns. They land in the shape of "navgod", fold
   their wings shut, then bask (slowly opening and closing) and sink into deep red-black ink
   lettering, where they stay as a texture. Now and then one lifts off, loops and comes back; a
   curious one may follow your cursor for a moment. Flying ones dodge the cursor. Sweep through
   the word, or tap anywhere on the paper, and the butterfly effect runs: a ripple spreads, the
   ones it reaches startle, and they startle their neighbours.
   Sprites, not shapes: hundreds of butterflies stay light on slow laptops.
   ========================================================= */
const INK = '#150908';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const sstep = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

/* the font of the word: ?font=fraunces (default) | playfair | bricolage | inter */
const FONTS = {
  fraunces: s => `900 ${s}px Fraunces, Georgia, serif`,
  playfair: s => `900 ${s}px "Playfair Display", Georgia, serif`,
  bricolage: s => `800 ${s}px "Bricolage Grotesque", Inter, sans-serif`,
  inter: s => `800 ${s}px Inter, system-ui, sans-serif`,
};
const pick = (() => { try { return new URLSearchParams(location.search).get('font'); } catch (e) { return null; } })();
const wordFont = FONTS[pick] || FONTS.fraunces;
try { document.fonts && document.fonts.load(wordFont(120), 'navgod'); } catch (e) {}   // fetched now, long before the swarm needs it
export const swarmFontReady = () => { try { return !document.fonts || document.fonts.check(wordFont(50), 'navgod'); } catch (e) { return true; } };

/* sample points inside some text drawn with draw(ctx), reading only the box [bx, by, bw, bh] around it (small: fast) */
function sample(box, draw, step) {
  const [bx, by] = [Math.floor(box[0]), Math.floor(box[1])], W = Math.max(1, Math.ceil(box[2])), H = Math.max(1, Math.ceil(box[3]));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.translate(-bx, -by); draw(x); const d = x.getImageData(0, 0, W, H).data, pts = [];
  for (let y = step / 2; y < H; y += step) for (let xx = step / 2 + ((y / step) % 2 ? step / 2 : 0); xx < W; xx += step) {
    const i = (Math.floor(y) * W + Math.floor(xx)) * 4 + 3; if (d[i] > 140) pts.push([bx + xx + (Math.random() - .5) * step * .35, by + y + (Math.random() - .5) * step * .35]);
  }
  return pts;
}

/* ---- four kinds of butterfly: the right half of each, in units of s, head up (-y) ---- */
const SPECIES = [
  { name: 'swallowtail', size: 1.4,
    fore: p => { p.moveTo(.04, -.06); p.bezierCurveTo(.2, -.62, .72, -.98, 1.0, -.8); p.bezierCurveTo(.96, -.46, .6, -.12, .08, .02); },
    hind: p => { p.moveTo(.06, .02); p.bezierCurveTo(.5, 0, .74, .24, .62, .46); p.bezierCurveTo(.54, .6, .4, .62, .34, .66);
      p.bezierCurveTo(.4, .86, .4, 1.1, .32, 1.2); p.bezierCurveTo(.24, 1.1, .25, .86, .22, .7); p.bezierCurveTo(.12, .58, .02, .36, .03, .1); },
    border: .07, dots: [[.82, -.74], [.66, -.84], [.92, -.58], [.5, .52], [.36, .6]], veins: [[.95, -.78], [.75, -.88], [.9, -.5], [.6, .42], [.3, .9]] },
  { name: 'monarch', size: 1.0,
    fore: p => { p.moveTo(.04, -.08); p.bezierCurveTo(.18, -.72, .86, -.92, .96, -.56); p.bezierCurveTo(1.0, -.3, .7, -.05, .08, .03); },
    hind: p => { p.moveTo(.06, .03); p.bezierCurveTo(.62, -.02, .88, .36, .7, .62); p.bezierCurveTo(.55, .86, .2, .8, .04, .2); },
    border: .1, dots: [[.88, -.62], [.78, -.78], [.94, -.42], [.62, -.86], [.74, .5], [.6, .7], [.4, .76]], veins: [[.9, -.6], [.7, -.8], [.85, -.3], [.7, .4], [.5, .7], [.25, .7]] },
  { name: 'copper', size: .78,
    fore: p => { p.moveTo(.04, -.05); p.bezierCurveTo(.15, -.58, .72, -.78, .84, -.46); p.bezierCurveTo(.9, -.2, .55, -.02, .07, .03); },
    hind: p => { p.moveTo(.05, .03); p.bezierCurveTo(.52, .02, .72, .3, .56, .56); p.bezierCurveTo(.42, .74, .12, .62, .04, .18); },
    border: .05, dots: [[.42, -.4], [.56, -.5], [.36, .3], [.48, .4]], veins: [[.8, -.45], [.6, -.65], [.5, .5]] },
  { name: 'longwing', size: 1.05,
    fore: p => { p.moveTo(.04, -.05); p.bezierCurveTo(.25, -.42, .86, -.64, 1.06, -.5); p.bezierCurveTo(1.0, -.32, .55, -.08, .08, .02); },
    hind: p => { p.moveTo(.05, .03); p.bezierCurveTo(.46, .05, .64, .26, .52, .44); p.bezierCurveTo(.36, .58, .12, .44, .04, .15); },
    border: .06, band: true, dots: [[.9, -.52], [.8, -.58]], veins: [[1.0, -.5], [.7, -.5], [.45, .38]] },
];
const RED_P = [
  { root: '#6e0e08', fore: '#c8261b', tip: '#e2442e', hind: '#a3170f', edge: '#170504', dot: 'rgba(255,240,230,.9)', vein: 'rgba(30,4,2,.45)', under: '#3a0805', body: '#1c0503' },
  { root: '#7a1208', fore: '#d0321c', tip: '#e9532f', hind: '#b4220f', edge: '#120403', dot: 'rgba(255,244,236,.95)', vein: 'rgba(20,3,2,.6)', under: '#4a0d06', body: '#120302' },
  { root: '#6a1c06', fore: '#dc5a1c', tip: '#f28a3c', hind: '#c0441a', edge: '#2a0a03', dot: 'rgba(30,8,2,.75)', vein: 'rgba(60,14,4,.35)', under: '#4a1606', body: '#1a0602' },
  { root: '#7d1009', fore: '#d8331f', tip: '#1b0604', hind: '#b8240f', edge: '#180504', dot: 'rgba(255,240,226,.85)', vein: 'rgba(30,4,2,.4)', under: '#3a0805', body: '#150403', band: 'rgba(255,236,200,.97)' },
];


const NF = 10;   // wing fold frames: 0 = flat open, NF-1 = shut above the back
function makeSprites(x, row, px, sp, P) {
  for (let f = 0; f < NF; f++) {
    const th = f / (NF - 1) * 1.45, open = Math.max(.07, Math.cos(th)), dark = 1 - open;   // foreshortened, and darker as it tilts away from the light
    x.save(); x.beginPath(); x.rect(f * px, row * px, px, px); x.clip();
    x.translate(f * px + px / 2, row * px + px / 2); const s = px * .4, lw = v => Math.max(.5, s * v);
    for (const side of [-1, 1]) {
      x.save(); x.scale(side * open * s, s);
      for (const part of ['hind', 'fore']) {
        const path = new Path2D(); SPECIES[sp][part](path); path.closePath();
        if (part === 'fore') { const g = x.createLinearGradient(0, 0, .95, -.75); g.addColorStop(0, P.root); g.addColorStop(.55, P.fore); g.addColorStop(1, P.tip); x.fillStyle = g; }
        else { const g = x.createRadialGradient(0, 0, .05, 0, .1, .8); g.addColorStop(0, P.root); g.addColorStop(1, P.hind); x.fillStyle = g; }
        x.fill(path);
        x.save(); x.clip(path);
        if (part === 'fore' && SPECIES[sp].band && P.band) { x.strokeStyle = P.band; x.lineWidth = .17; x.beginPath(); x.moveTo(.35, -.72); x.quadraticCurveTo(.55, -.45, .75, -.32); x.stroke(); }
        x.strokeStyle = P.vein; x.lineWidth = .022;
        for (const [ex, ey] of SPECIES[sp].veins) if ((ey < 0) === (part === 'fore')) { x.beginPath(); x.moveTo(.05, 0); x.quadraticCurveTo(ex * .5, ey * .3, ex, ey); x.stroke(); }
        x.strokeStyle = P.edge; x.lineWidth = SPECIES[sp].border * 2; x.stroke(path);   // dark rim, inside the wing only
        x.fillStyle = P.dot;
        for (const [dx, dy] of SPECIES[sp].dots) if ((dy < 0) === (part === 'fore')) { x.beginPath(); x.arc(dx, dy, .035, 0, 6.29); x.fill(); }
        if (dark > .02) { x.globalAlpha = dark * .75; x.fillStyle = P.under; x.fill(path); x.globalAlpha = 1; }
        x.restore();
      }
      x.restore();
    }
    // body: head, thorax, abdomen, and clubbed antennae
    x.fillStyle = P.body;
    x.beginPath(); x.ellipse(0, -s * .2, s * .055, s * .13, 0, 0, 6.29); x.fill();
    x.beginPath(); x.ellipse(0, s * .2, s * .04, s * .3, 0, 0, 6.29); x.fill();
    x.beginPath(); x.arc(0, -s * .35, s * .045, 0, 6.29); x.fill();
    x.strokeStyle = P.body; x.lineWidth = lw(.016);
    for (const k of [-1, 1]) { x.beginPath(); x.moveTo(k * s * .02, -s * .38); x.quadraticCurveTo(k * s * .08, -s * .62, k * s * .2, -s * .74); x.stroke(); x.beginPath(); x.arc(k * s * .2, -s * .74, lw(.028), 0, 6.29); x.fill(); }
    x.restore();
  }
}


/* ---- the story, told only with butterflies ----
   1. "naveen godugupalli" becomes butterflies sitting in its letters; their wings open in a wave.
   2. The letters that are not kept lift off: e-e-n and u-g-u-p-a-l-l-i. Only n-a-v and g-o-d stay on the line,
      their wings pulsing together, so you see where the name comes from.
   3. nav and god fly together and grow into the big "navgod"; some of the others circle back to fill it out,
      the rest fly away. Double-tap the word to replay it. */
export function createSwarm({ canvas, ctx, dpr, sources, target, sound, onGuide }) {
  /* sources: [{ch, x, b, font}] the letters of the full name (no space), where they stand (canvas px)
     target(): { glyphs:[{ch,x}], base, fs, font, eye:{x,y,r} } the navgod layout (canvas px) */
  const W = canvas.width, H = canvas.height, T = target();
  // the word in its own font, the same width and centre as the logo it replaces
  const mc = document.createElement('canvas').getContext('2d');
  mc.font = T.font; const x0 = T.glyphs[0].x, x1 = T.glyphs[4].x + mc.measureText('d').width;
  mc.font = wordFont(100); const w100 = mc.measureText('navgod').width;
  const fs = Math.min(T.fs * 1.3, (x1 - x0) * .96 / w100 * 100), wx0 = (x0 + x1) / 2 - w100 * fs / 200;
  const word = x => { x.font = wordFont(fs); x.textBaseline = 'alphabetic'; x.fillText('navgod', wx0, T.base); };
  mc.font = wordFont(fs); const LX = [0, 1, 2, 3, 4, 5, 6].map(k => wx0 + mc.measureText('navgod'.slice(0, k)).width);
  const letterAt = px => { for (let k = 0; k < 6; k++) if (px < LX[k + 1]) return k; return 5; };
  const hv = new Float32Array(6);   // how much each letter is "breathing" (hovered)

  // where the butterflies sit: in navgod (goal) and in every letter of the full name (source)
  const step = Math.max(4.5 * dpr, fs * .046);
  const goal = sample([LX[0] - fs * .2, T.base - fs * 1.15, LX[6] - LX[0] + fs * .4, fs * 1.65], x => { x.fillStyle = '#000'; word(x); }, step);
  const goalBy = [[], [], [], [], [], []]; for (const p of goal) goalBy[letterAt(p[0])].push(p);
  const fs0 = parseFloat((/([\d.]+)px/.exec(sources[0].font) || [0, 40])[1]), srcK = clamp(fs0 / fs, .2, 1);
  const srcStep = Math.max(3 * dpr, step * srcK * 1.12);
  const srcPts = sources.map(q => { mc.font = q.font; const w = mc.measureText(q.ch).width;
    return sample([q.x - fs0 * .1, q.b - fs0 * 1.1, w + fs0 * .2, fs0 * 1.45], x => { x.fillStyle = '#000'; x.font = q.font; x.textBaseline = 'alphabetic'; x.fillText(q.ch, q.x, q.b); }, srcStep); });
  // which letters of the full name are kept: n a v (naveen) and g o d (godugupalli)
  let gi = sources.findIndex((q, i) => i > 2 && q.ch === 'g' && sources[i + 1] && sources[i + 1].ch === 'o' && sources[i + 2] && sources[i + 2].ch === 'd');
  if (gi < 0) gi = Math.min(6, sources.length - 3);
  const keepIdx = [0, 1, 2, gi, gi + 1, gi + 2];
  const nameL = Math.min(...sources.map(q => q.x)), nameR = Math.max(...sources.map(q => q.x)) + fs0 * .6;
  const order = x => clamp((x - nameL) / (nameR - nameL), 0, 1);
  const wordOf = i => (i < (keepIdx[3] || 6) ? 0 : 1);   // 0 = naveen, 1 = godugupalli

  const kind = () => { const r = Math.random(); return r < .3 ? 0 : r < .55 ? 1 : r < .8 ? 2 : 3; };
  const flies = [];
  const make = (sx, sy, gx, gy, role, li, wd) => { const sp = kind(); const f = {
    sx, sy, gx, gy, role, li, wd, x: sx ?? -99, y: sy ?? -99, ox: 0, oy: 0, ang: (Math.random() - .5) * .4, sp, k: srcK * 1.1, la: 1,
    s: SPECIES[sp].size * (.85 + Math.random() * .3) * (Math.random() < .05 ? 1.3 : 1),
    o: sx != null ? order(sx) : Math.random(), sat: false, story: true, st: sx != null ? 'src' : 'away', free: 0, wand: null, h: 0, nb: [],
    depth: .6 + Math.random() * .8, sitAng: (Math.random() - .5) * .5, ph: Math.random() * 6.28, fold: 1, bob: 0, gl: false,
    bt: Math.random() * .4, hz: 9 + Math.random() * 5, landT: -9, bask: Math.random() * 6.28, bw: .8 + Math.random() * .9, wob: Math.random() * 6.28 };
    flies.push(f); return f; };
  const pool = [[], []];   // butterflies of the letters that are not kept, by word
  srcPts.forEach((pts, i) => { if (keepIdx.includes(i)) return; for (const p of pts) pool[wordOf(i)].push(p); });
  for (const p of pool) p.sort(() => Math.random() - .5);
  for (let k = 0; k < 6; k++) {
    const G = goalBy[k].slice(), S = srcPts[keepIdx[k]] || [], q = sources[keepIdx[k]] || sources[0];
    // keepers: each one finds the nearest free spot in the big letter (positions compared relative to each letter)
    const used = new Uint8Array(G.length); let freeN = G.length;
    const gu = G.map(p => [(p[0] - LX[k]) / fs, (T.base - p[1]) / fs]);
    for (const p of S.slice().sort(() => Math.random() - .5)) {
      const u = (p[0] - q.x) / fs0, v = (q.b - p[1]) / fs0; let best = -1, bd = 1e9;
      for (let j = 0; j < G.length; j++) { if (used[j] && freeN > 0) continue; const d = (gu[j][0] - u) ** 2 + (gu[j][1] - v) ** 2; if (d < bd) { bd = d; best = j; } }
      if (best < 0) continue; if (!used[best]) freeN--; used[best] = 1; make(p[0], p[1], G[best][0], G[best][1], 'keep', k, k < 3 ? 0 : 1);
    }
    // the rest of the big letter is filled by butterflies from the dropped letters (or new ones from off screen)
    for (let j = 0; j < G.length; j++) if (!used[j]) {
      const wd = k < 3 ? 0 : 1, pp = pool[wd].pop() || pool[1 - wd].pop();
      if (pp) make(pp[0], pp[1], G[j][0], G[j][1], 'join', k, wd); else make(null, null, G[j][0], G[j][1], 'extra', k, wd);
    }
  }
  for (const wd of [0, 1]) for (const p of pool[wd]) make(p[0], p[1], null, null, 'leave', -1, wd);   // not needed: they fly away
  const N = flies.length, homed = flies.filter(f => f.gx != null);

  const spx = Math.round(Math.max(28, step * 3.4));   // drawn at ~1.6x the size they are shown: crisp
  const atlas = document.createElement('canvas'); atlas.width = NF * spx; atlas.height = 4 * spx;
  { const ax = atlas.getContext('2d'); SPECIES.forEach((_, i) => makeSprites(ax, i, spx, i, RED_P[i])); }
  const shown = step * 2.5;
  const shade = document.createElement('canvas'); shade.width = shade.height = 64;   // a soft shadow, drawn once
  { const g = shade.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(40,18,12,.9)'); r.addColorStop(.45, 'rgba(40,18,12,.35)'); r.addColorStop(1, 'rgba(40,18,12,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }


  const cell = step * 2.2, grid = new Map(), key = (a, b) => a + ',' + b;   // neighbours in the word, for the butterfly effect
  homed.forEach(f => { const k = key(Math.floor(f.gx / cell), Math.floor(f.gy / cell)); (grid.get(k) || grid.set(k, []).get(k)).push(f); });
  homed.forEach(f => { const cx = Math.floor(f.gx / cell), cy = Math.floor(f.gy / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const g of grid.get(key(cx + a, cy + b)) || []) if (g !== f && f.nb.length < 7) f.nb.push(g); });
  const gxs = goal.map(p => p[0]), gys = goal.map(p => p[1]), pad = step * 3;
  const bx = Math.floor(Math.min(...gxs) - pad), by = Math.floor(Math.min(...gys) - pad), bw = Math.ceil(Math.max(...gxs) + pad - bx), bh = Math.ceil(Math.max(...gys) + pad - by);
  // the sitting butterflies are drawn into a layer and trimmed to the letters (a little wider, so wings still spill softly): crisp, readable shapes
  const wl = document.createElement('canvas'); wl.width = bw; wl.height = bh; const wx = wl.getContext('2d');
  const mask = document.createElement('canvas'); mask.width = bw; mask.height = bh;
  { const m = mask.getContext('2d'); m.translate(-bx, -by); m.fillStyle = m.strokeStyle = '#000'; m.lineJoin = 'round'; m.lineWidth = step * .9; word(m);
    m.font = wordFont(fs); m.strokeText('navgod', wx0, T.base); }
  const nbx = Math.floor(nameL - fs0 * .4), nby = Math.floor(sources[0].b - fs0 * 1.3), nbw = Math.ceil(nameR - nameL + fs0 * 1.2), nbh = Math.ceil(fs0 * 1.9);
  const nl = document.createElement('canvas'); nl.width = Math.max(1, nbw); nl.height = Math.max(1, nbh); const nx2 = nl.getContext('2d');
  const nmask = document.createElement('canvas'); nmask.width = nl.width; nmask.height = nl.height;
  { const m = nmask.getContext('2d'); m.translate(-nbx, -nby); m.fillStyle = m.strokeStyle = '#000'; m.lineJoin = 'round'; m.lineWidth = srcStep * .9; m.textBaseline = 'alphabetic';
    for (const q of sources) { m.font = q.font; m.fillText(q.ch, q.x, q.b); m.strokeText(q.ch, q.x, q.b); } }
  const letterLift = sources.map((q, i) => keepIdx.includes(i) ? null : .9 + order(q.x) * .7);   // when each dropped letter's butterflies lift

  try { ctx.save(); ctx.globalAlpha = .003; ctx.drawImage(atlas, 0, 0, 2, 2); ctx.drawImage(shade, 0, 0, 2, 2); ctx.drawImage(mask, 0, 0, 2, 2); ctx.restore(); } catch (e) {}   // to the GPU now, not on the first flying frame
  const EX = W / 2, EY = H / 2, RM = Math.min(H * .2, W * .3), IRIS_IN = .2, IRIS_OUT = .8, GUIDE_R = .45, GUIDE_T = 1.15;
  let guideFired = false, t = 0, leaving = 0, leaveT = 0, landedAt = 0, nextWander = 0, nextFollow = 0, nextCourt = 4, waves = [], ripples = [];
  let st0 = 0, off = 0;   // the story clock, and how long the replay first takes to bring everyone back to the full name
  const M = { x: W / 2, y: H / 2, px: W / 2, py: H / 2, has: false, movedAt: -9 };
  const onMove = e => { M.x = e.clientX * dpr; M.y = e.clientY * dpr; M.has = true; M.movedAt = t; };
  let down = null, gathering = false, pendingTap = null, lastTap = null, soundT = 0;
  const inWord = (px, py) => px > bx && px < bx + bw && py > by && py < by + bh;
  const onDown = e => {
    if (leaving || (e.target && e.target.closest && e.target.closest('button,a,input'))) return;
    down = { x: e.clientX * dpr, y: e.clientY * dpr, t };
  };
  const onUp = () => {
    if (!down) return; const d = down; down = null;
    if (gathering) { release(); return; }
    if (!landedAt || t - d.t > .3) return;
    // a tap: on the word it might be the first of a double tap, so wait a moment; on the paper, ripple at once
    if (inWord(d.x, d.y)) {
      if (lastTap && t - lastTap.t < .32) { lastTap = null; pendingTap = null; replay(); return; }
      lastTap = { t }; pendingTap = { x: d.x, y: d.y, at: t + .3 };
    } else ripple(d.x, d.y);
  };
  const ripple = (px, py) => ripples.push({ x: px, y: py, t0: t, hit: new Set() });
  addEventListener('pointermove', onMove);
  addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);

  /* ---- the story timeline (seconds on the story clock) ---- */
  for (const f of flies) plan(f);
  function plan(f) {
    f.wingT = off + .05 + f.o * .45;                                   // wings open in a wave along the name
    f.liftT = off + .9 + f.o * .7 + Math.random() * .15;             // dropped letters lift off, left to right
    f.outT = off + 2.1 + Math.random() * .7;                         // the ones not needed head off screen
    f.goT = f.role === 'keep' ? off + 2.75 + (f.wd ? .18 : 0) + Math.random() * .2   // nav and god fly together
      : off + 2.6 + Math.random() * .7;                              // the helpers come back to fill the big letters
  }
  const offscreen = () => { const a = Math.random() < .5, side = Math.random(); return a ? [side * W, -60 * dpr] : [Math.random() < .5 ? -60 * dpr : W + 60 * dpr, side * H * .6]; };
  function fly(f, x1, y1, dur, k1, lift = 90) {   // a curved flight from where it is now
    const d = Math.hypot(x1 - f.x, y1 - f.y);
    f.b = { t0: t, dur, x0: f.x, y0: f.y, x1, y1, k0: f.k, k1, lift: lift * dpr,
      cx: (f.x + x1) / 2 + (Math.random() - .5) * d * .45, cy: Math.min(f.y, y1) - d * (.18 + Math.random() * .22) - 30 * dpr };
  }
  function storyStep(f, dt) {
    const s = t - st0;
    if (f.st === 'away') {
      if (f.role === 'extra' && s >= f.goT && f.gx != null) { const o = offscreen(); f.x = o[0]; f.y = o[1]; f.k = 1; f.st = 'toGoal'; fly(f, f.gx, f.gy, 1.5 + Math.random() * .6, 1); }
      return;
    }
    if (f.st === 'toSrc' || f.st === 'toGoal' || f.st === 'exit') {
      const b = f.b, k = clamp((t - b.t0) / b.dur, 0, 1); if (k <= 0) { wings(f, dt, false); return; }
      const e = easeIO(k), a = 1 - e, env = Math.sin(k * Math.PI);
      let nx = a * a * b.x0 + 2 * a * e * b.cx + e * e * b.x1, ny = a * a * b.y0 + 2 * a * e * b.cy + e * e * b.y1;
      const tx = 2 * a * (b.cx - b.x0) + 2 * e * (b.x1 - b.cx), ty = 2 * a * (b.cy - b.y0) + 2 * e * (b.y1 - b.cy), tl = Math.hypot(tx, ty) || 1;
      const wv = env * (Math.sin(t * 3.3 + f.wob) * 18 + Math.sin(t * 8.1 + f.wob * 2) * 6) * dpr;   // drifts side to side
      nx += -ty / tl * wv; ny += tx / tl * wv;
      steer(f, nx, ny, .3); f.x = nx; f.y = ny; f.k = b.k0 + (b.k1 - b.k0) * e; f.h = env * b.lift;
      wings(f, dt, true, k > .78);   // flutters hard just before touching down
      if (k >= 1) {
        if (f.st === 'toGoal') { f.story = false; f.sat = true; f.k = 1; settle(f); }
        else if (f.st === 'exit') f.st = 'away';
        else { f.st = 'src'; f.h = 0; f.ang = (Math.random() - .5) * .4; f.landT = t - .5; }
      }
      return;
    }
    if (f.st === 'src') {   // sitting in the full name
      f.x = f.sx; f.y = f.sy; f.h = 0;
      if (s < f.wingT) { f.fold += (1 - f.fold) * Math.min(1, dt * 10); f.landT = t - .5; }
      else wings(f, dt, false);
      if (f.role === 'keep') {
        const spot = sstep(off + 1.2, off + 1.6, s);   // nav and god, left alone, pulse together
        if (spot > 0) f.fold = f.fold * (1 - spot) + (.04 + .55 * (.5 + .5 * Math.cos((s - off) * 4.2))) * spot;
        if (s >= f.goT) { f.st = 'toGoal'; fly(f, f.gx, f.gy, 1.35 + Math.random() * .35, 1, 70); }
      } else if (s >= f.liftT) {   // up and away from the line, then wander above it
        f.st = 'wander'; const a = -Math.PI / 2 + (Math.random() - .5) * 1.6;
        f.w = { a, turn: (Math.random() - .5) * 3, sp: (300 + Math.random() * 220) * dpr, cruise: (90 + Math.random() * 80) * dpr, alt: (80 + Math.random() * 90) * dpr };
      }
      return;
    }
    if (f.st === 'wander') {
      const w = f.w;
      w.turn += (Math.random() - .5) * 14 * dt; w.turn *= Math.exp(-dt * 1.5); w.a += w.turn * dt * 2.2;
      const hx = W / 2 + (f.o - .5) * W * .7, hy = T.base - fs * 1.5;   // drift around above the line, roughly over where they came from
      const toA = Math.atan2(hy - f.y, hx - f.x), dA = ((toA - w.a + Math.PI) % 6.283 + 6.283) % 6.283 - Math.PI;
      w.a += dA * dt * .9;
      w.sp += (w.cruise - w.sp) * Math.min(1, dt * 1.6);
      const nx = f.x + Math.cos(w.a) * w.sp * dt, ny = f.y + Math.sin(w.a) * w.sp * dt;
      steer(f, nx, ny, .2); f.x = nx; f.y = ny; f.k += (1 - f.k) * Math.min(1, dt * 2.5);
      f.h += (w.alt - f.h) * Math.min(1, dt * 3); wings(f, dt, true, false);
      if (f.role === 'join' && s >= f.goT) { f.st = 'toGoal'; fly(f, f.gx, f.gy, 1.2 + Math.random() * .5, 1, 60); }
      if (f.role === 'leave' && s >= f.outT) { const o = offscreen(); f.st = 'exit'; fly(f, o[0], o[1], 1.3 + Math.random() * .6, 1.1, 140); }
    }
  }
  function steer(f, nx, ny, r) { if (Math.hypot(nx - f.x, ny - f.y) > .3) { const ta = Math.atan2(ny - f.y, nx - f.x) + Math.PI / 2; f.ang += (((ta - f.ang + Math.PI) % 6.283 + 6.283) % 6.283 - Math.PI) * r; } }

  // double-tap the word: everyone flies back into "naveen godugupalli" and the story plays again
  function replay() {
    if (gathering || leaving) return; landedAt = 0; st0 = t; off = 1.5; sound && sound.whoosh && sound.whoosh(.8);
    for (const f of flies) {
      plan(f); f.wand = null; f.free = 0; f.sat = false; f.story = true;
      if (f.sx == null) { if (f.st !== 'away') { const o = offscreen(); f.st = 'exit'; fly(f, o[0], o[1], 1 + Math.random() * .4, 1, 120); } else f.st = 'away'; continue; }
      if (f.st === 'away' || f.x < -40 || f.y < -40 || f.x > W + 40) { const o = offscreen(); f.x = o[0]; f.y = o[1]; }
      f.st = 'toSrc'; fly(f, f.sx, f.sy, 1.05 + Math.random() * .3, srcK * 1.1, 80); f.b.t0 += Math.random() * .2;
    }
  }
  // hold: every butterfly leaves its letter and swirls round the cursor; let go and they rebuild the word
  function gather() {
    gathering = true;
    for (const f of homed) { if (!f.sat) continue;
      f.free = 0; f.wand = { gather: true, t0: t, delay: Math.random() * .25 + Math.hypot(f.x - M.x, f.y - M.y) / (2200 * dpr),
        r: (25 + Math.sqrt(Math.random()) * 150) * dpr, a: Math.random() * 6.28, w: 1.4 + Math.random() * 1.6 }; }
  }
  function goHome(f, delay = 0, dur) {   // fly back to its own spot in the word along a soft arc
    const d = Math.hypot(f.gx - f.x, f.gy - f.y);
    f.wand = { home: true, t0: t, delay, h0: f.h || 60 * dpr, dur: dur || .9 + d / (700 * dpr) + Math.random() * .5, sx: f.x, sy: f.y,
      cx: (f.x + f.gx) / 2 + (Math.random() - .5) * d * .5, cy: Math.min(f.y, f.gy) - d * (.2 + Math.random() * .25) };
  }
  function release() { gathering = false; for (const f of homed) if (f.wand && f.wand.gather) goHome(f, Math.random() * .25); }
  function startle(f, gen, ax, ay, wave) {
    if (!f.sat || f.free > 0 || f.wand) return;
    const hop = !wave && Math.random() < .3;   // some only hop up and drop back
    const a0 = ax != null ? Math.atan2(f.y - ay, f.x - ax) + (Math.random() - .5) * 1.4 : Math.random() * 6.28;
    const a = Math.atan2(Math.sin(a0) - .55, Math.cos(a0));   // away from the disturbance, and up
    f.wand = { flee: true, t0: t, react: wave ? Math.random() * .09 : .02 + Math.random() * .12, a, turn: (Math.random() - .5) * 4,
      sp: (hop ? 170 : 360 + Math.random() * 300) * dpr, cruise: (hop ? 50 : 100 + Math.random() * 100) * dpr,
      alt: (hop ? 22 : 80 + Math.random() * 100) * dpr, wander: hop ? .25 + Math.random() * .25 : wave ? .95 + Math.random() * .4 : .7 + Math.random() * 1.2 };
    f.gl = false; f.bt = .35;
    if (gen < 5) for (const g of f.nb) if (Math.random() < .42 - gen * .07) waves.push({ f: g, at: t + .05 + Math.random() * .08, gen: gen + 1 });
  }
  function settle(f) { f.x = f.gx; f.y = f.gy; f.ang = f.sitAng; f.h = 0; f.landT = t; }

  /* wings and bobbing: flying = bursts of fast flaps and short glides; sitting = shut, then a slow bask */
  function wings(f, dt, flying, hurry) {
    if (flying) {
      f.bt -= dt;
      if (f.bt <= 0) { f.gl = !f.gl && !hurry && Math.random() < .7; f.bt = f.gl ? .14 + Math.random() * .3 : .25 + Math.random() * .55; }
      if (f.gl) { f.fold += (.12 - f.fold) * Math.min(1, dt * 10); f.bob += (0 - f.bob) * Math.min(1, dt * 4); }
      else { f.ph += dt * 6.283 * f.hz * (hurry ? 1.25 : 1); f.fold = .08 + .86 * (.5 - .5 * Math.cos(f.ph)); f.bob = Math.sin(f.ph) * 5 * dpr; }
      return;
    }
    f.bob = 0;
    const since = t - f.landT;
    if (since < .3) { f.fold += (1 - f.fold) * Math.min(1, dt * 12); return; }   // just landed: wings shut for a moment
    f.bask += dt * f.bw * .55;
    const k = .5 - .5 * Math.cos(f.bask);                          // then open, sunning: they stay open and only now and then fold half shut
    const tg = .05 + .5 * sstep(.7, 1, k);
    f.fold += (tg - f.fold) * Math.min(1, dt * 3.5);
    const hb = f.li >= 0 && f.sat ? hv[f.li] : 0;
    if (hb > .01) f.fold = f.fold * (1 - hb) + (.04 + .6 * (.5 + .5 * Math.cos(t * 2.6))) * hb;
  }

  function update(dt) {
    t += dt;
    const mv = Math.hypot(M.x - M.px, M.y - M.py); M.px = M.x; M.py = M.y;
    if (pendingTap && t >= pendingTap.at) { ripple(pendingTap.x, pendingTap.y); pendingTap = null; }
    if (down && !gathering && landedAt && !leaving && t - down.t > .3) gather();
    // a letter you hover breathes: its butterflies open their wings together
    const over = landedAt && !leaving && M.has && M.y > T.base - fs * .78 && M.y < T.base + fs * .28 && M.x > LX[0] && M.x < LX[6] ? letterAt(M.x) : -1;
    for (let k = 0; k < 6; k++) hv[k] += ((k === over ? 1 : 0) - hv[k]) * Math.min(1, dt * 5);
    if (sound && sound.wings && t > soundT) { soundT = t + .1; let n = 0; for (const f of flies) if (f.h > 2 && f.st !== 'away') n++; sound.wings(n / homed.length * 2.2); }
    for (let k = waves.length - 1; k >= 0; k--) if (waves[k].at <= t) { const w = waves.splice(k, 1)[0]; startle(w.f, w.gen); }
    // ripples from taps on the paper: each butterfly lifts as the ring reaches it
    const RS = 650 * dpr;
    for (let k = ripples.length - 1; k >= 0; k--) {
      const r = ripples[k], R = (t - r.t0) * RS; if (R > Math.hypot(W, H)) { ripples.splice(k, 1); continue; }
      for (let i = 0; i < N; i++) { const f = flies[i]; if (r.hit.has(i) || f.st === 'away') continue; const d = Math.hypot(f.x - r.x, f.y - r.y); if (d > R) continue; r.hit.add(i);
        if (f.sat && !f.free && !f.wand) startle(f, 9, r.x, r.y, true);
        else { const a = Math.atan2(f.y - r.y, f.x - r.x), p = 90 * dpr * clamp(1 - d / W, .2, 1); f.ox += Math.cos(a) * p; f.oy += Math.sin(a) * p; } }
    }
    if (!landedAt && !leaving && homed.every(f => f.sat)) landedAt = t;
    if (landedAt && !leaving && t > nextWander) {   // now and then one lifts off, loops around the word and comes back
      nextWander = t + .25 + Math.random() * .55;
      const busy = homed.filter(f => f.wand).length;
      if (busy < Math.max(3, homed.length * .04)) { const f = homed[Math.floor(Math.random() * homed.length)]; if (f.sat && !f.free && !f.wand) f.wand = { t0: t, dur: 2.4 + Math.random() * 2.4, A: (50 + Math.random() * 130) * dpr, w: 1.2 + Math.random() * 1.4, p: Math.random() * 6.28, dir: Math.random() < .5 ? -1 : 1 }; }
    }
    if (landedAt && !leaving && t > nextCourt && t - landedAt > 2) {   // a courting pair: they chase each other in a spiral, up and back down
      nextCourt = t + 5 + Math.random() * 5;
      const f = homed[Math.floor(Math.random() * homed.length)], g = f.nb.find(g => g.sat && !g.wand && !g.free);
      if (f.sat && !f.wand && !f.free && g) {
        const C = { t0: t, dur: 3.4 + Math.random() * 1.2, x: (f.gx + g.gx) / 2, y: (f.gy + g.gy) / 2, dir: Math.random() < .5 ? -1 : 1, r: (18 + Math.random() * 10) * dpr,
          rise: (130 + Math.random() * 110) * dpr, drift: (Math.random() - .5) * 220 * dpr };
        f.wand = { court: C, ph: 0 }; g.wand = { court: C, ph: Math.PI };
      }
    }
    if (landedAt && !leaving && M.has && t > nextFollow && t - M.movedAt < 2.5) {   // a curious one circles your cursor for a while
      nextFollow = t + 3.5 + Math.random() * 3.5;
      let best = null, bd = 1e9;
      for (let k = 0; k < 24; k++) { const f = homed[Math.floor(Math.random() * homed.length)]; if (!f.sat || f.free || f.wand) continue; const d = Math.hypot(f.gx - M.x, f.gy - M.y); if (d < bd) { bd = d; best = f; } }
      if (best) best.wand = { follow: true, t0: t, dur: 3.5 + Math.random() * 2, r: (45 + Math.random() * 35) * dpr, w: (2 + Math.random()) * (Math.random() < .5 ? -1 : 1), p: Math.random() * 6.28 };
    }
    const lt = t - leaveT;
    if (leaving && !guideFired && lt > GUIDE_T) { guideFired = true; onGuide && onGuide(EX / dpr, (EY - RM * GUIDE_R) / dpr); }
    for (let i = 0; i < N; i++) {
      const f = flies[i];
      if (f.st === 'away' && !(f.role === 'extra' && f.story)) continue;
      // flying ones dodge the cursor softly; the push fades
      if (f.h > 2 && M.has && !leaving) { const dx = f.x + f.ox - M.x, dy = f.y + f.oy - M.y, d = Math.hypot(dx, dy), R = 110 * dpr;
        if (d < R && !(f.wand && (f.wand.follow || f.wand.gather || f.wand.court))) { const p = (1 - d / R) * 900 * dpr * dt; f.ox += dx / (d || 1) * p; f.oy += dy / (d || 1) * p; } }
      const dk = Math.exp(-dt * 2.6); f.ox *= dk; f.oy *= dk;
      if (leaving) {   // entering: a spinning ring forms round the centre, then they spiral down and become the eye's iris
        if (f.st === 'away') continue;
        const spinA = f.ra + lt * (2.2 + Math.max(0, lt - .45) * 4), ring = Math.min(W, H) * .27;
        const e = easeIO(clamp((lt - .45 - f.o * .15) / .6, 0, 1));
        let px, py;
        if (f.iris) {   // a fibre of the iris: lands with its head pointing outward, wings flat
          const da = ((f.ia - spinA + Math.PI) % 6.283 + 6.283) % 6.283 - Math.PI, pa = spinA + da * e, pr = ring + (f.ir - ring) * e;
          px = EX + Math.cos(pa) * pr; py = EY + Math.sin(pa) * pr;
          if (e < 1) steer(f, px, py, .35); else f.ang += (f.ia + Math.PI / 2 - f.ang) * Math.min(1, dt * 10);
          f.k = 1 + (f.ik - 1) * e; f.h = 150 * dpr * (1 - e);
          if (e < .85) wings(f, dt, true, true); else f.fold += (.04 - f.fold) * Math.min(1, dt * 8);
          if (f.guide && lt > GUIDE_T) f.la = 0;   // this one flies out as your cursor
        } else {        // the rest pour into the pupil
          const pr = ring * (1 - e); px = EX + Math.cos(spinA) * pr; py = EY + Math.sin(spinA) * pr * .95;
          steer(f, px, py, .3); f.k = 1 - .85 * e; f.la = 1 - sstep(.6, 1, e); f.h = 150 * dpr; wings(f, dt, true, true);
        }
        f.x += (px - f.x) * Math.min(1, dt * (lt < .45 ? 4.5 + f.o * 2 : 14)); f.y += (py - f.y) * Math.min(1, dt * (lt < .45 ? 4.5 + f.o * 2 : 14));
        continue;
      }
      if (f.story) { storyStep(f, dt); continue; }
      if (f.wand) {
        const w = f.wand, k = (t - w.t0) / w.dur;
        if (!w.home && !w.court && k >= 1) { f.wand = null; settle(f); continue; }
        let nx, ny;
        if (w.court) {   // the pair: round and round each other, rising and drifting, then back down
          const C = w.court, kc = (t - C.t0) / C.dur;
          if (kc >= 1) { goHome(f, Math.random() * .2); continue; }
          const env = Math.pow(Math.sin(kc * Math.PI), .7), ang = (t - C.t0) * 7.5 * C.dir + w.ph, r = C.r * (.7 + .5 * env) * (1 + .25 * Math.sin(t * 3.1));
          const cx = C.x + C.drift * env * Math.sin(kc * 2.2), cy = C.y - C.rise * env;
          const tx = cx + Math.cos(ang) * r, ty = cy + Math.sin(ang) * r * .65;
          nx = f.x + (tx - f.x) * Math.min(1, dt * 9); ny = f.y + (ty - f.y) * Math.min(1, dt * 9); f.h = env * 150 * dpr;
        } else if (w.flee) {
          const kf = t - w.t0 - w.react;
          if (kf < 0) { wings(f, dt, false); continue; }   // a split second before it reacts
          w.turn += (Math.random() - .5) * 16 * dt; w.turn *= Math.exp(-dt * 1.5); w.a += w.turn * dt * 2.2;   // erratic, zig-zagging heading
          w.sp += (w.cruise - w.sp) * Math.min(1, dt * 1.6);
          nx = f.x + Math.cos(w.a) * w.sp * dt; ny = f.y + Math.sin(w.a) * w.sp * dt;
          f.h += (w.alt - f.h) * Math.min(1, dt * (kf < .35 ? 8 : 2));   // climbs steeply, then cruises
          if (kf > w.wander) { f.x = nx; f.y = ny; goHome(f, 0); continue; }
        } else if (w.gather || w.home) {
          const tt = t - w.t0 - w.delay;
          if (tt < 0) { wings(f, dt, false); continue; }
          if (w.gather) {   // swirl round the cursor
            w.a += w.w * dt * (1 + 40 * dpr / w.r);
            const tx = M.x + Math.cos(w.a) * w.r, ty = M.y + Math.sin(w.a) * w.r * .8;
            nx = f.x + (tx - f.x) * Math.min(1, dt * 3.2); ny = f.y + (ty - f.y) * Math.min(1, dt * 3.2);
            f.h += ((70 + w.r * .3) * dpr - f.h) * Math.min(1, dt * 3);
          } else {
            const kh = clamp(tt / w.dur, 0, 1), e = easeIO(kh), a = 1 - e;
            nx = a * a * w.sx + 2 * a * e * w.cx + e * e * f.gx; ny = a * a * w.sy + 2 * a * e * w.cy + e * e * f.gy;
            f.h = Math.max(0, (w.h0 || 0) * (1 - e) + Math.sin(kh * Math.PI) * 50 * dpr) * (1 - sstep(.85, 1, kh));
            if (kh >= 1) { f.wand = null; settle(f); continue; }
          }
        } else if (w.follow) {   // out to the cursor, round it, back home
          const m = sstep(0, .22, k) * (1 - sstep(.78, 1, k)), oa = (t - w.t0) * w.w + w.p;
          const tx = M.x + Math.cos(oa) * w.r, ty = M.y + Math.sin(oa) * w.r * .7 - 10 * dpr;
          const dx = f.gx + (tx - f.gx) * m, dy = f.gy + (ty - f.gy) * m - Math.sin(k * Math.PI) * 30 * dpr;
          nx = f.x + (dx - f.x) * Math.min(1, dt * 5); ny = f.y + (dy - f.y) * Math.min(1, dt * 5);
          if (k > .9) { nx = f.gx + (nx - f.gx) * (1 - sstep(.9, 1, k)); ny = f.gy + (ny - f.gy) * (1 - sstep(.9, 1, k)); }
          f.h = Math.sin(k * Math.PI) * 120 * dpr;
        } else {   // a loop around the word and back
          const env = Math.sin(k * Math.PI), tt = (t - w.t0) * w.w * w.dir;
          nx = f.gx + env * w.A * Math.sin(tt * 2 + w.p); ny = f.gy + env * (w.A * .55 * Math.sin(tt * 3.1 + w.p) - w.A * .5);
          f.h = env * 110 * dpr;
        }
        steer(f, nx, ny, .2);
        f.x = nx; f.y = ny; wings(f, dt, true, w.home ? (t - w.t0 - w.delay) / w.dur > .7 : w.flee ? t - w.t0 - w.react < .35 : w.court ? false : k > .85);
      } else wings(f, dt, false);
    }
    if (mv > 1.5) for (const f of homed) if (f.sat && !f.free && !f.wand && Math.hypot(f.x - M.x, f.y - M.y) < 46 * dpr) startle(f, 0, M.x, M.y);
  }

  const frame = f => Math.round(clamp(f.fold, 0, 1) * (NF - 1));
  function draw(alpha = 1) {
    const par = M.has && !leaving ? [(M.x - W / 2) / W, (M.y - H / 2) / H] : [0, 0];
    ctx.save(); ctx.globalAlpha = alpha;
    // ripples on the paper
    for (const r of ripples) { const R = (t - r.t0) * 650 * dpr, k = R / Math.hypot(W, H); if (k >= 1) continue;   // the ring is exactly where butterflies take off
      ctx.strokeStyle = '#8f140c';
      for (const [o, a] of [[0, .32], [-14 * dpr, .14], [-30 * dpr, .06]]) { if (R + o <= 0) continue; ctx.globalAlpha = alpha * a * (1 - k) * (1 - k); ctx.lineWidth = dpr * (1.6 - k); ctx.beginPath(); ctx.arc(r.x, r.y, R + o, 0, 6.29); ctx.stroke(); } }
    // shadows on the paper for every butterfly in the air
    for (const f of flies) {
      const hh = f.h + f.bob; if (!(hh > 1) || f.st === 'away') continue;
      const s = shown * f.s * f.k * (1 + hh / (500 * dpr)), sx = f.x + f.ox + hh * .28 + par[0] * hh * .4, sy = f.y + f.oy + hh * .5 + par[1] * hh * .4;
      const blur = 1 + hh / (90 * dpr);   // the higher it flies, the larger and softer its shadow
      ctx.globalAlpha = alpha * f.la * .22 * clamp(1 - hh / (420 * dpr), .2, 1) / Math.sqrt(blur) * (.55 + .45 * (1 - f.fold));
      ctx.drawImage(shade, sx - s * .5 * blur, sy - s * .38 * blur, s * blur, s * .76 * blur);
    }
    const sNow = t - st0, storyOn = sNow < off + 4.6;
    // light shades of the words behind the butterflies: the full name while the story plays, and navgod
    if (!leaving && storyOn) {
      ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
      const back = off ? sstep(off - .5, off, sNow) : 1;   // in a replay the name's shade comes back as they arrive
      sources.forEach((q, i) => {
        const lift = letterLift[i], a = lift != null ? 1 - sstep(off + lift, off + lift + .6, sNow) : 1 - sstep(off + 2.75, off + 3.4, sNow);
        if (a * back > .01) { ctx.globalAlpha = alpha * .12 * a * back; ctx.font = q.font; ctx.fillText(q.ch, q.x, q.b); }
      });
    }
    const ghost = leaving ? 1 - clamp(leaving * 3, 0, 1) : storyOn ? (off && sNow < off ? 1 - sstep(0, .7, sNow) : sstep(off + 2.5, off + 3.6, sNow)) : 1;
    if (ghost > .01) { ctx.globalAlpha = alpha * .16 * ghost; ctx.fillStyle = INK; word(ctx); }
    // the full name: its sitting butterflies, trimmed to the letters
    const inName = f => f.story && f.st === 'src' && !leaving;
    if (storyOn) {
      nx2.setTransform(1, 0, 0, 1, 0, 0); nx2.clearRect(0, 0, nl.width, nl.height); nx2.globalCompositeOperation = 'source-over';
      for (const f of flies) if (inName(f)) { const s = shown * f.s * f.k; nx2.setTransform(Math.cos(f.ang), Math.sin(f.ang), -Math.sin(f.ang), Math.cos(f.ang), f.x - nbx, f.y - nby); nx2.drawImage(atlas, frame(f) * spx, f.sp * spx, spx, spx, -s / 2, -s / 2, s, s); }
      nx2.setTransform(1, 0, 0, 1, 0, 0); nx2.globalCompositeOperation = 'destination-in'; nx2.drawImage(nmask, 0, 0); nx2.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha; ctx.drawImage(nl, nbx, nby);
    }
    // the word: the butterflies sitting in it, trimmed to the letter shapes
    const sitting = f => f.sat && !f.wand && !f.free && !leaving;
    wx.setTransform(1, 0, 0, 1, 0, 0); wx.clearRect(0, 0, bw, bh); wx.globalCompositeOperation = 'source-over';
    for (const f of homed) if (sitting(f)) { const s = shown * f.s * f.k; wx.setTransform(Math.cos(f.ang), Math.sin(f.ang), -Math.sin(f.ang), Math.cos(f.ang), f.x - bx, f.y - by); wx.drawImage(atlas, frame(f) * spx, f.sp * spx, spx, spx, -s / 2, -s / 2, s, s); }
    wx.setTransform(1, 0, 0, 1, 0, 0); wx.globalCompositeOperation = 'destination-in'; wx.drawImage(mask, 0, 0); wx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha; ctx.drawImage(wl, bx, by);
    // the butterflies in the air (and the ones still telling the story)
    for (const f of flies) {
      if (f.st === 'away' || f.la <= .001 || sitting(f) || inName(f)) continue;
      const lift = (f.h + f.bob) / dpr, s = shown * f.s * f.k * (1 + lift / 600);
      const ox = f.ox + par[0] * lift * .35 * f.depth, oy = f.oy + par[1] * lift * .35 * f.depth - f.bob * .5;   // depth: the higher ones drift more with your mouse
      ctx.globalAlpha = alpha * f.la;
      ctx.setTransform(Math.cos(f.ang), Math.sin(f.ang), -Math.sin(f.ang), Math.cos(f.ang), f.x + ox, f.y + oy);
      ctx.drawImage(atlas, frame(f) * spx, f.sp * spx, spx, spx, -s / 2, -s / 2, s, s);
    }
    ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  return {
    update(dt) { if (leaving) leaving = Math.min(1, leaving + dt * .9); update(dt); },
    draw, get landed() { return !!landedAt; },
    leave() { if (!leaving) { leaving = .001; leaveT = t; gathering = false;
      const live = flies.filter(f => f.st !== 'away'), nIris = Math.round(clamp(live.length * .55, 60, 340));
      live.sort(() => Math.random() - .5);
      live.forEach((f, i) => { f.wand = null; f.free = 0; f.story = false; f.ra = Math.atan2(f.y - EY, f.x - EX) + (Math.random() - .5) * .3;
        f.iris = i < nIris; if (!f.iris) return;
        f.ia = Math.random() * 6.283; const u = Math.sqrt(Math.random());
        f.ir = RM * (IRIS_IN + (IRIS_OUT - IRIS_IN) * u); f.ik = clamp(RM * (.12 + .1 * u) / (shown * f.s), .15, 1);   // smaller at the pupil, bigger at the rim
      });
      // the guide: the one at the top of the iris
      let best = null, bd = 9; for (const f of live) if (f.iris) { const d = Math.abs(((f.ia + Math.PI / 2 + Math.PI) % 6.283 + 6.283) % 6.283 - Math.PI); if (d < bd) { bd = d; best = f; } }
      if (best) { best.guide = true; best.ia = -Math.PI / 2; best.ir = RM * GUIDE_R; }
    } },
    guidePoint() { return { x: EX / dpr, y: (EY - RM * GUIDE_R) / dpr, t: GUIDE_T }; },
    destroy() { removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); sound && sound.wings && sound.wings(0); },
  };
}

// shared with the about page (contact.js): the same butterflies and lettering
export { sample, makeSprites, SPECIES, RED_P, NF, wordFont };
