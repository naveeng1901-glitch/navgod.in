/* =========================================================
   NAVGOD: the plan, drawn in ink while the museum prepares
   Paper. Red hairline ink draws the museum from above: the round room and the beating heart,
   then each hall in walking order with what is inside. The red butterfly flies round the plan,
   leaving a fine ink trail: one full loop = ready. You can nudge it; it flutters off and comes back.
   When ready, the butterfly's circle unrolls into one straight line and the plan folds into it:
   that line is where the name is written next (the hand-off to the name morph).
   No text. Two light 2D layers, so slow laptops are not slowed further.
   ========================================================= */
import { buildPlan, heartPath } from './plan.js';

const PAPER = '#ece8e2', RED = '#c8261b', INK = '#141110';   // the plan in black ink; the butterfly and its trail in red
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = t => 1 - Math.pow(1 - t, 3), easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createLoader({ progress, ready, sound, lineAt } = {}) {
  const dpr = Math.min(devicePixelRatio || 1, 1.5), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas'); cv.id = 'ink-plan';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:24;touch-action:none';
  document.body.appendChild(cv); document.body.classList.add('ink-loading');
  const x = cv.getContext('2d');
  const ink = document.createElement('canvas'), ix = ink.getContext('2d');   // the soft bleed, at half resolution
  let W = 0, H = 0, U = 1;
  const resize = () => { W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr); ink.width = Math.round(W / 2); ink.height = Math.round(H / 2); U = Math.min(W, H * 1.15) / 1000; };
  resize(); addEventListener('resize', resize);

  const { plan, ring, ring2, extent } = buildPlan();
  plan.forEach((h, i) => { h.from = .16 + i * .135; h.to = h.from + .135; });
  const heart = { from: 0, to: .16 };

  const M = { x: -1e4, y: -1e4, px: -1e4, py: -1e4 };
  const onMove = e => { M.x = e.clientX * dpr; M.y = e.clientY * dpr; };
  addEventListener('pointermove', onMove);

  const view = { cx: 0, cy: 0, s: 1, rot: 0, k: 1 };   // k: how much of the plan is left (it folds away at the end)
  const T = ([u, v]) => { const c = Math.cos(view.rot), s = Math.sin(view.rot); return [view.cx + (u * c - v * s) * view.s * view.k, view.cy + (u * s + v * c) * view.s * view.k]; };
  function stroke(ctx, pts, t, k = 1) {
    if (t <= 0 || pts.length < 2) return null;
    const L = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
    let left = tot * clamp(t, 0, 1); ctx.beginPath(); const p = T(pts[0]); ctx.moveTo(p[0] * k, p[1] * k); let tip = p;
    for (let i = 1; i < pts.length && left > 0; i++) { const f = Math.min(1, left / L[i - 1]), a = pts[i - 1], b = pts[i], q = T([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); ctx.lineTo(q[0] * k, q[1] * k); tip = q; left -= L[i - 1]; }
    ctx.stroke(); return tip;
  }

  /* the butterfly: a guide on an orbit, shy of the cursor */
  const fly = { off: [0, 0], vel: [0, 0], ph: 0 };
  function drawFly(px, py, ang, s, alpha = 1) {
    const flap = Math.abs(Math.sin(fly.ph)) * .8 + .2;
    x.save(); x.translate(px, py); x.rotate(ang); x.globalAlpha = alpha; x.fillStyle = RED;
    for (const side of [-1, 1]) { x.save(); x.scale(1, side * flap);
      x.beginPath(); x.ellipse(-s * .15, s * .55, s * .48, s * .62, .5, 0, 6.29); x.fill();
      x.globalAlpha = alpha * .75; x.beginPath(); x.ellipse(-s * .62, s * .38, s * .3, s * .4, -.4, 0, 6.29); x.fill(); x.restore(); }
    x.fillStyle = '#5a0d07'; x.beginPath(); x.ellipse(-s * .2, 0, s * .55, s * .07, 0, 0, 6.29); x.fill();
    x.restore();
  }

  let raf = 0, last = 0, shown = 0, gone = false, doneAt = 0, destroyed = false;
  const t0 = performance.now(), pens = new Map();
  function frame(now) {
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
    const target = clamp(progress ? progress() : 0, 0, 1), isReady = ready && ready(), time = (now - t0) / 1000;
    const creep = Math.min(.96, Math.max(target, Math.min(.1 + time * .006, target + .07)));
    shown += (creep - shown) * (1 - Math.exp(-dt * 2.2)); if (isReady) shown = Math.min(1, shown + dt * .45);
    const fit = Math.min(W, H) * .86 / ((extent + 40) * 2);
    view.cx = W / 2 + Math.sin(time * .11) * 8 * U; view.cy = H / 2 + Math.cos(time * .09) * 6 * U;
    view.s = fit * (1.02 + Math.sin(time * .13) * .015); view.rot = reduced ? 0 : Math.sin(time * .05) * .05;

    // the end: the plan folds into the centre while the butterfly's circle unrolls into the name's line
    let u = 0; if (doneAt) u = clamp((now - doneAt) / 1500, 0, 1);
    const fold = easeIO(clamp(u * 1.6, 0, 1)), unroll = easeIO(clamp((u - .15) / .85, 0, 1));
    view.k = 1 - fold; const planA = 1 - fold;
    const line = (lineAt && lineAt()) || { y: innerHeight * .55, w: innerWidth * .62 }, ly = line.y * dpr, lw2 = line.w * dpr;

    ix.globalCompositeOperation = 'destination-out'; ix.fillStyle = `rgba(0,0,0,${reduced ? .2 : .022})`; ix.fillRect(0, 0, ink.width, ink.height);
    ix.globalCompositeOperation = 'source-over';
    if (M.px > -1e3 && Math.hypot(M.x - M.px, M.y - M.py) > .5 && !reduced) {   // the cursor smudges the wet ink, a soft round fingertip
      const r = 50 * U / 2, sx = M.px / 2, sy = M.py / 2, ddx = (M.x - M.px) / 2, ddy = (M.y - M.py) / 2;
      for (let i = 1; i <= 3; i++) { const ox = sx + ddx * i * .45, oy = sy + ddy * i * .45;
        for (const [rr, al] of [[r, .18], [r * .7, .22], [r * .4, .25]]) { ix.save(); ix.beginPath(); ix.arc(ox, oy, rr, 0, 6.29); ix.clip(); ix.globalAlpha = al; ix.drawImage(ink, sx - r, sy - r, r * 2, r * 2, ox - r, oy - r, r * 2, r * 2); ix.restore(); } }
      ix.globalAlpha = 1;
    }
    M.px = M.x; M.py = M.y;

    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    x.globalAlpha = planA; x.drawImage(ink, 0, 0, W, H); x.globalAlpha = 1;

    const lw = Math.max(1.6, 2.1 * U), seg = (a, b) => clamp((shown - a) / (b - a), 0, 1);
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = INK; x.lineWidth = lw;
    ix.lineCap = 'round'; ix.lineJoin = 'round'; ix.strokeStyle = 'rgba(20,17,16,.12)'; ix.lineWidth = lw * 2.6;
    const dual = (pts, t) => {
      const tip = stroke(x, pts, t);
      if (t > 0 && t < 1 && tip && !doneAt) { const prev = pens.get(pts), jump = prev ? Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) : 0;
        if (!prev || jump > 1.5 * dpr) { if (prev && jump < 14 * dpr) { ix.beginPath(); ix.moveTo(prev[0] / 2, prev[1] / 2); ix.lineTo(tip[0] / 2, tip[1] / 2); ix.stroke(); } pens.set(pts, tip); }
        x.fillStyle = INK; x.beginPath(); x.arc(tip[0], tip[1], lw * 1.1, 0, 6.29); x.fill(); }   // the pen's nib
      return tip;
    };

    if (planA > .01) {
      x.globalAlpha = planA;
      const h0 = seg(heart.from, heart.to);
      dual(ring, ease(clamp(h0 * 1.6, 0, 1))); x.globalAlpha = planA * .45; dual(ring2, ease(clamp(h0 * 1.6 - .2, 0, 1))); x.globalAlpha = planA;
      const beat = 1 + Math.max(0, Math.sin(time * 6.2)) ** 6 * .08 + Math.max(0, Math.sin(time * 6.2 - .9)) ** 6 * .05;
      x.lineWidth = lw * 1.15; stroke(x, heartPath(beat), ease(clamp(h0 * 1.4 - .3, 0, 1))); x.lineWidth = lw;
      for (const h of plan) {
        const s = seg(h.from, h.to); if (s <= 0) continue;
        x.lineWidth = lw; h.walls.forEach(p => dual(p, ease(clamp(s * 1.8, 0, 1))));
        x.lineWidth = lw * .8; x.globalAlpha = planA * .85; h.inside.forEach((p, j) => dual(p, ease(clamp((s - .45 - j * .025) * 2.4, 0, 1)))); x.globalAlpha = planA;
        if (s >= 1 && !h.doneT) { h.doneT = now; sound?.click?.(); }
        if (h.doneT && now - h.doneT < 900) {   // a finished hall breathes out once: a thin echo of its walls
          const k = (now - h.doneT) / 900, sc = 1 + ease(k) * .07, mid = (extent - 100) / 2 + 100, c = [Math.cos(h.r.a) * mid, Math.sin(h.r.a) * mid];
          x.globalAlpha = (1 - k) * .5 * planA; x.lineWidth = lw * .8;
          h.walls.forEach(p => stroke(x, p.map(([a, b]) => [c[0] + (a - c[0]) * sc, c[1] + (b - c[1]) * sc]), 1));
          x.globalAlpha = planA;
        }
      }
      x.globalAlpha = 1;
    }

    /* the butterfly's orbit: one full loop = ready; at the end it unrolls into a straight line */
    const R = (extent + 30) * view.s, a0 = -Math.PI / 2, sweep = Math.PI * 2 * shown;
    const P = th => {   // a point of the trail: on the circle, or (unrolling) on the name's line
      const wob = Math.sin(th * 9 + 1.3) * .9 * dpr + Math.sin(th * 23) * .4 * dpr;   // a hand's tremor
      const cxp = W / 2 + Math.cos(a0 + th) * (R + wob), cyp = H / 2 + Math.sin(a0 + th) * (R + wob);
      const lx = W / 2 - lw2 / 2 + lw2 * (th / (Math.PI * 2));
      return [cxp + (lx - cxp) * unroll, cyp + (ly - cyp) * unroll];
    };
    x.strokeStyle = RED; x.lineWidth = lw * 1.1; x.beginPath();
    const n = 240; for (let i = 0; i <= n; i++) { const p = P(sweep * i / n); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); } x.stroke();
    // the butterfly at the tip of its trail; the cursor makes it flutter aside and a spring brings it back
    const tp = P(sweep), tq = P(sweep + .02), tan = Math.atan2(tq[1] - tp[1], tq[0] - tp[0]);
    const fx = tp[0] + fly.off[0], fy = tp[1] + fly.off[1], dmx = fx - M.x, dmy = fy - M.y, dm = Math.hypot(dmx, dmy);
    if (dm < 90 * dpr && dm > 1 && !doneAt) { fly.vel[0] += dmx / dm * 900 * dpr * dt; fly.vel[1] += dmy / dm * 900 * dpr * dt; }
    fly.vel[0] += -fly.off[0] * 18 * dt; fly.vel[1] += -fly.off[1] * 18 * dt; const damp = Math.pow(.02, dt); fly.vel[0] *= damp; fly.vel[1] *= damp;
    fly.off[0] += fly.vel[0] * dt; fly.off[1] += fly.vel[1] * dt; fly.ph += dt * (dm < 90 * dpr ? 30 : 16);
    const flyA = doneAt ? 1 - clamp((u - .6) / .4, 0, 1) : 1;
    if (flyA > 0) drawFly(fx + (doneAt ? u * u * 220 * dpr : 0), fy - (doneAt ? u * u * 160 * dpr : 0), tan, 17 * dpr, flyA);   // it flies off once its work is done

    if (isReady && shown > .995 && !doneAt) { doneAt = now; sound?.whoosh?.(1); }
    if (doneAt && u >= 1 && !gone) { gone = true; setTimeout(destroy, 60); }   // the name morph takes over on the same line
    if (!destroyed) raf = requestAnimationFrame(frame);
  }
  function destroy() { if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); document.body.classList.remove('ink-loading'); removeEventListener('resize', resize); removeEventListener('pointermove', onMove); cv.remove(); }
  raf = requestAnimationFrame(frame);
  return { get active() { return !gone; }, destroy, skip() { if (!gone) { gone = true; destroy(); } } };
}
