/* =========================================================
   NAVGOD: the museum, as a line drawing seen from above
   Shared by the loading screen (where it is drawn in ink) and the O of the logo (where it lives).
   Units: the round room has radius 100; the halls run outward from its arches.
   ========================================================= */
import { HALLS, BACKROOM } from './data.js';

export const RC = 100, HL = 200, HW = 92, GAP = 14;
const dir = a => [Math.cos(a), Math.sin(a)];
function circle([cx, cy], rr, n = 26) { return Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(i / n * 6.283) * rr, cy + Math.sin(i / n * 6.283) * rr]); }
function ellipse([cx, cy], a, b, rot, n = 34) { const c = Math.cos(rot), s = Math.sin(rot); return Array.from({ length: n + 1 }, (_, i) => { const t = i / n * 6.283, u = Math.cos(t) * a, v = Math.sin(t) * b; return [cx + u * c - v * s, cy + u * s + v * c]; }); }
function leaf([cx, cy], i) { const s = 9, a = i * 1.3; return [[cx - Math.cos(a) * s, cy - Math.sin(a) * s], [cx + Math.sin(a) * s * .5, cy - Math.cos(a) * s * .5], [cx + Math.cos(a) * s, cy + Math.sin(a) * s], [cx - Math.sin(a) * s * .5, cy + Math.cos(a) * s * .5], [cx - Math.cos(a) * s, cy - Math.sin(a) * s]]; }

export function heartPath(scale = 1) {   // the CenterPiece, as a single line
  const hs = 30 * scale, hp = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60 * 6.283, hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); hp.push([hx * hs / 17, hy * hs / 17 + 2]); }
  return hp;
}

export function buildPlan() {
  const rooms = [...HALLS].sort((a, b) => a.k - b.k).map(h => ({ id: h.id, num: h.num, title: h.title, k: h.k }))
    .concat([{ id: 'backroom', num: '06', title: BACKROOM.title, k: 0 }]);
  rooms.forEach(r => { r.a = Math.PI / 2 - r.k / 6 * Math.PI * 2; });   // as the museum looks from above when you fall in: 06 at the bottom, 03 at the top
  const plan = rooms.map(r => {
    const [dx, dy] = dir(r.a), nx = -dy, ny = dx, P = (u, v) => [(RC + GAP + u) * dx + v * nx, (RC + GAP + u) * dy + v * ny];
    const walls = [[P(-GAP, -18), P(0, -18), P(0, -HW / 2), P(HL, -HW / 2), P(HL, HW / 2), P(0, HW / 2), P(0, 18), P(-GAP, 18)]];
    const inside = [], box = (u, v, w, h) => [P(u, v), P(u + w, v), P(u + w, v + h), P(u, v + h), P(u, v)];
    switch (r.id) {
      case 'packaging': for (let i = 0; i < 3; i++) for (const s of [-1, 1]) inside.push(box(36 + i * 54, s * 24 - 9, 18, 18)); break;   // the vitrines
      case 'identity': inside.push(box(55, -HW / 2 + 5, 75, 6), box(55, HW / 2 - 11, 75, 6)); for (let i = 0; i < 5; i++) inside.push(circle(P(38 + i * 33, i % 2 ? 12 : -12), 7)); break;   // walls of prints, paper lanterns
      case 'campaigns': inside.push([P(16, -9), P(HL - 14, -9)], [P(16, 9), P(HL - 14, 9)]); for (let i = 0; i < 8; i++) inside.push(leaf(P(26 + i * 21, (i % 2 ? 1 : -1) * 30), i)); break;   // the runway through greenery
      case 'editorial': for (const u of [45, 132]) for (const s of [-1, 1]) inside.push(box(u, s * (HW / 2 - 16) - 8, 26, 16)); inside.push(ellipse(P(100, 0), 38, 20, r.a)); break;   // desks and the carpet
      case 'redesign': inside.push(box(55, -HW / 2 + 5, 60, 30), box(125, HW / 2 - 35, 60, 30), box(61, -HW / 2 + 9, 48, 22), box(131, HW / 2 - 31, 48, 22)); break;   // screens
      case 'backroom': {   // the castle (keep and four towers) and the desk
        const c = P(140, 0), Q = (u, v) => [c[0] + u * dx + v * nx, c[1] + u * dy + v * ny];
        inside.push([Q(-24, -28), Q(24, -28), Q(24, 28), Q(-24, 28), Q(-24, -28), Q(-10, -14), Q(10, -14), Q(10, 14), Q(-10, 14), Q(-10, -14)], box(55, -24, 26, 48));
        for (const [u, v] of [[-24, -28], [24, -28], [24, 28], [-24, 28]]) inside.push(circle(Q(u, v), 7, 18));
        break;
      }
    }
    return { r, walls, inside };
  });
  return { rooms, plan, ring: circle([0, 0], RC, 120), ring2: circle([0, 0], RC - 8, 120), extent: RC + GAP + HL };
}

/* the whole plan, finished, painted into a canvas (for the O of the logo) */
export function paintPlan(ctx, size, { color = '#c8261b', line = 2, inner = .8 } = {}) {
  const { plan, ring, ring2, extent } = buildPlan(), s = size / 2 / (extent + 6), c = size / 2;
  ctx.save(); ctx.translate(c, c); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const poly = pts => { ctx.beginPath(); pts.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v))); ctx.stroke(); };
  ctx.lineWidth = line / s; poly(ring); ctx.globalAlpha = .45; poly(ring2); ctx.globalAlpha = 1;
  for (const h of plan) { ctx.lineWidth = line / s; h.walls.forEach(poly); ctx.lineWidth = line * inner / s; ctx.globalAlpha = .85; h.inside.forEach(poly); ctx.globalAlpha = 1; }
  ctx.lineWidth = line * 1.15 / s; poly(heartPath());
  ctx.restore();
}
