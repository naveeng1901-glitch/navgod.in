/* Hall 05, Redesign: "the Mint & the Pressing Plant", dressed as a marble bank hall.
   Cream marble walls over a green-marble dado with a brass rail, a cream and verde checker floor;
   the currency side gets a teller counter (brass grille, ₹500 bundles, a magnifier, a banker's lamp) under uncut press sheets,
   the end wall a round brass vault door standing ajar with a trolley of bundles; the album side a walnut listening console.
   Everything is unlit (baked-in vertex shading and brass matcaps, like Hall 04's newsroom): no new lights, no shadows to toggle.
   bankSteps() returns small build steps: the museum runs them one per frame during startup, then merges the still pieces. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let seed = 11;
const R = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const canvasTex = (draw, w, h, rep) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const SERIF = 'Fraunces, Georgia, serif', SANS = 'Inter, system-ui, sans-serif';

/* marble that tiles: soft clouds and wandering veins, each drawn nine times (wrapped) so repeats show no seam */
function marble(c, w, h, { base, cloud, vein, soft, gold, nv = 26 }) {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  const wrap = f => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { c.save(); c.translate(dx, dy); f(); c.restore(); } };
  const clouds = Array.from({ length: 36 }, () => [R() * w, R() * h, w * (.05 + R() * .16)]);
  wrap(() => clouds.forEach(([x, y, r]) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, cloud); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }));
  const path = () => { let x = R() * w, y = R() * h, a = -.6 + R() * 1.2 + (R() < .5 ? 0 : Math.PI); const p = [[x, y]]; const n = 50 + R() * 90;
    for (let s = 0; s < n; s++) { a += (R() - .5) * .45; x += Math.cos(a) * w * .009; y += Math.sin(a) * h * .009; p.push([x, y]); } return p; };
  const draw = (paths, col, lw) => wrap(() => paths.forEach(([p, k]) => { c.strokeStyle = col; c.lineWidth = lw * k; c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }));
  draw(Array.from({ length: Math.round(nv * .4) }, () => [path(), .6 + R()]), soft, 9);
  draw(Array.from({ length: nv }, () => [path(), .3 + R()]), vein, 2.2);
  if (gold) draw(Array.from({ length: 7 }, () => [path(), .5 + R() * .6]), gold, 1.3);
}

export function bankSteps(world, hall, HALL_H) {
  const g = hall.group, W = hall.W, z0 = -hall.L / 2, z1 = z0 + 15.9, xw = W / 2;
  const low = world.gpu.tier === 'low', S = low ? .5 : 1;   // built-in graphics: half-size canvases
  const K = world.benchKit(); world.deskMats(K); const { lit } = K;
  const brass = K.brassM, black = K.blackM;
  const shade = (kind, w, d, a, x, z) => { const s = world.shadowMesh(kind, w, d, a); s.rotation.x = -Math.PI / 2; s.position.set(x, .012, z); g.add(s); return s; };
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, h, d, col, m, x, y, z, parent) => add(lit(new THREE.BoxGeometry(w, h, d), col), m, x, y, z, parent);
  const rbox = (w, h, d, r, col, m, x, y, z, parent) => add(lit(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * .999), col), m, x, y, z, parent);
  const cyl = (r0, r1, h, m, x, y, z, seg = 20, parent) => add(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z, parent);
  const rod = (a, b, r, m = brass, parent = g) => { const d = b.clone().sub(a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), m);
    o.position.copy(a).add(b).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(o); return o; };
  const T = {};   // shared textures and materials, made in the first step
  const img = url => { const t = world.loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const spin = (o, speed, axis) => { o.userData.spin = speed; o.userData.spinAxis = axis; (world.spinners ||= []).push(o); };

  /* a ₹500 bundle: the note on top, its banded edge on the sides (a thin strip of the same picture, shaded) */
  const bundleGeo = (() => { const geo = new THREE.BoxGeometry(.24, .016, .106), uv = geo.attributes.uv;
    for (let i = 0; i < 24; i++) { const f = Math.floor(i / 4); if (f === 2) continue;
      const u = uv.getX(i), v = uv.getY(i); if (f <= 1) uv.setXY(i, .5 + (u - .5) * .02, .5 + (v - .5) * .02); else uv.setXY(i, u, .5 + (v - .5) * .03); }
    return lit(geo, '#ffffff', .62); })();
  const bundle = (k, x, y, z, ry = 0, parent = g) => { const o = new THREE.Mesh(bundleGeo, T.bundleM[k]); o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; };

  return [
    // ---------------------------------------------------------------- 1 · the room: checker floor, marble walls, verde dado, brass rail
    () => {
      T.creamM = K.M(canvasTex((c, w, h) => marble(c, w, h, { base: '#efe6d6', cloud: 'rgba(214,198,172,.35)', vein: 'rgba(150,130,108,.42)', soft: 'rgba(170,150,126,.14)', gold: 'rgba(196,160,92,.5)' }), 1024 * S, 512 * S, true));
      T.verde = canvasTex((c, w, h) => marble(c, w, h, { base: '#1d3b2e', cloud: 'rgba(52,96,74,.4)', vein: 'rgba(196,214,196,.17)', soft: 'rgba(120,160,130,.1)', nv: 20 }), 1024 * S, 512 * S, true);
      T.verdeM = K.M(T.verde);
      // the floor: cream and verde squares on the diagonal, thin dark joints
      const tile = canvasTex((c, w, h) => {
        marble(c, w, h, { base: '#e2d6c0', cloud: 'rgba(205,190,165,.25)', vein: 'rgba(140,122,100,.38)', soft: 'rgba(160,140,115,.12)' });
        const v = document.createElement('canvas'); v.width = w; v.height = h; marble(v.getContext('2d'), w, h, { base: '#1e3a2d', cloud: 'rgba(55,98,76,.4)', vein: 'rgba(200,215,200,.16)', soft: 'rgba(120,160,130,.1)', nv: 18 });
        c.save(); c.beginPath(); c.rect(0, 0, w / 2, h / 2); c.rect(w / 2, h / 2, w / 2, h / 2); c.clip(); c.drawImage(v, 0, 0); c.restore();
        c.strokeStyle = 'rgba(40,32,24,.55)'; c.lineWidth = 2; for (const p of [0, w / 2]) { c.beginPath(); c.moveTo(p + 1, 0); c.lineTo(p + 1, h); c.moveTo(0, p + 1); c.lineTo(w, p + 1); c.stroke(); }
      }, 1024 * S, 1024 * S, true);
      const RL = z1 - z0; tile.repeat.set(W / 1.8, RL / 1.8);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - .02, RL - .02), new THREE.MeshBasicMaterial({ map: tile, color: new THREE.Color(.74, .72, .69) }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, .004, (z0 + z1) / 2); g.add(floor);
      // veins over the baked walls: a multiply layer keeps the baked light and adds the stone
      const veins = canvasTex((c, w, h) => marble(c, w, h, { base: '#ffffff', cloud: 'rgba(236,228,214,.16)', vein: 'rgba(140,128,116,.32)', soft: 'rgba(170,158,140,.06)', gold: 'rgba(200,160,90,.45)', nv: 26 }), 2048 * S, 1024 * S, true);   // Calacatta: near-white, fine grey veins, a few gold
      const vm = (len, hh) => { const t = veins.clone(); t.repeat.set(len / 5, hh / 2.5); t.needsUpdate = true; return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true }); };
      const y0 = 1.1, y1 = HALL_H - 1.25, hh = y1 - y0;
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(RL, hh), vm(RL, hh)); p.rotation.y = -sx * Math.PI / 2; p.position.set(sx * (xw - .02), y0 + hh / 2, (z0 + z1) / 2); g.add(p); }
      { const p = new THREE.Mesh(new THREE.PlaneGeometry(W, hh), vm(W, hh)); p.rotation.y = Math.PI; p.position.set(0, y0 + hh / 2, z1 - .02); g.add(p); }
      // the dado: verde panels framed in a lighter line, a brass rail along the top, all round the room
      const dadoTex = (len) => { const t = canvasTex((c, w, h) => { c.drawImage(T.verde.image, 0, 0, w, h); c.strokeStyle = 'rgba(216,190,128,.55)'; c.lineWidth = 3; c.strokeRect(w * .06, h * .14, w * .88, h * .72); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 6; c.strokeRect(2, 2, w - 4, h - 4); }, 512 * S, 448 * S, true); t.repeat.set(len / 1.2, 1); return new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(.82, .82, .8) }); };
      const DH = 1.05, dado = (len, x, z, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(len, DH), dadoTex(len)); p.rotation.y = ry; p.position.set(x, DH / 2, z); g.add(p);
        const r = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, len, 10), brass); r.rotation.set(0, ry, Math.PI / 2); r.position.set(x + Math.sin(ry) * .02, DH + .01, z + Math.cos(ry) * .02); g.add(r); };   // a hair proud of the panel, into the room
      for (const sx of [-1, 1]) dado(RL, sx * (xw - .025), (z0 + z1) / 2, -sx * Math.PI / 2);
      dado(W, 0, z1 - .025, Math.PI);
      for (const sx of [-1, 1]) dado(2, sx * 3.5, z0 + .025, 0);
    },

    // ---------------------------------------------------------------- 2 · the right wall is all currency: past the notes, a teller counter with the bundles, press sheets above
    () => {
      T.bundleM = [1, 2, 3].map(k => new THREE.MeshBasicMaterial({ map: img(`assets/wall/currency/bundle_${k}.jpg`), vertexColors: true }));
      T.noteM = [1, 2, 3].map(k => new THREE.MeshBasicMaterial({ map: img(`assets/wall/currency/note_${k}.jpg`) }));
      const sd = TELLER.side, face = -sd * Math.PI / 2, zc = TELLER.z, len = TELLER.len, cx = sd * (xw - .4), top = 1.02, front = cx - sd * .36, nb = 4, bay = len / nb;
      box(.72, top - .1, len, '#6a442a', K.woodM, cx, .1 + (top - .1) / 2, zc);                          // walnut body
      box(.74, .1, len + .02, '#2a2a2a', K.steelM, cx, .05, zc);                                          // a black kick plinth
      for (let i = 0; i < nb; i++) {                                                                      // verde panels in brass frames
        const pz = zc - len / 2 + bay / 2 + i * bay, pw = bay - .3, p = new THREE.Mesh(new THREE.PlaneGeometry(pw, .6), T.verdeM.clone()); p.material.vertexColors = false; p.material.color = new THREE.Color(.85, .85, .82);
        p.rotation.y = face; p.position.set(front - sd * .006, .55, pz); g.add(p);
        for (const dy of [-.31, .31]) box(.012, .016, pw + .03, '#d2ab62', brass, front - sd * .008, .55 + dy, pz);
        for (const dz of [-1, 1]) box(.012, .62, .016, '#d2ab62', brass, front - sd * .008, .55, pz + dz * (pw / 2 + .007));
      }
      rbox(.86, .06, len + .14, .015, '#ffffff', T.creamM, cx - sd * .06, top + .03, zc);                 // the marble top
      // the brass grille: posts, two rails, close bars, a lacquered frieze with its sign
      const gx = cx + sd * .1, gy0 = 1.45, gy1 = 2.42;
      for (let i = 0; i <= nb; i++) box(.05, gy1 + .08 - top, .05, '#d2ab62', brass, gx, (top + gy1 + .08) / 2, zc - len / 2 + i * bay);
      for (const y of [gy0, gy1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, len, 8), brass); r.rotation.x = Math.PI / 2; r.position.set(gx, y, zc); g.add(r); }
      const barG = new THREE.CylinderGeometry(.0065, .0065, gy1 - gy0, 6);
      for (let z = zc - len / 2 + .06; z < zc + len / 2 - .03; z += .075) if (((z - (zc - len / 2)) % bay) > .05) add(barG, brass, gx, (gy0 + gy1) / 2, z);
      const sign = canvasTex((c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#173326'); gr.addColorStop(1, '#0d1f17'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#c9a24e'; c.lineWidth = 3; c.strokeRect(8, 8, w - 16, h - 16);
        c.fillStyle = '#e2c27a'; c.font = `600 ${h * .46}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('CURRENCY EXCHANGE   ✦   TELLERS 1 – 4', w / 2, h * .54);
      }, 2048 * S, 112 * S);
      box(.09, .3, len + .08, '#4a2e1c', K.woodM, gx, gy1 + .23, zc);
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(len, .26), new THREE.MeshBasicMaterial({ map: sign })); sp.rotation.y = face; sp.position.set(gx - sd * .047, gy1 + .23, zc); g.add(sp);
      for (const y of [gy1 + .075, gy1 + .385]) box(.11, .02, len + .1, '#d2ab62', brass, gx, y, zc);
      shade('rect', 1.2, len + .6, .32, cx - sd * .1, zc);
      // the ledge, gathered in the middle so the close stop takes it all in:
      // bundles on a brass tray, a loose pair, a note under a magnifier, a fan of the three designs, a banker's lamp
      const lx = front + sd * .2, ly = top + .06, nr = sd * Math.PI / 2;
      box(.32, .01, .95, '#d2ab62', brass, lx, ly + .005, zc - .95);
      [-1.25, -.95, -.65].forEach((dz, k) => { for (let n = 0; n < 6; n++) bundle(k, lx, ly + .018 + n * .0165, zc + dz, nr + (R() - .5) * .08); });
      bundle(0, lx + sd * .02, ly + .012, zc - .3, nr + .35); bundle(2, lx - sd * .01, ly + .028, zc - .27, nr + .2);
      rbox(.3, .008, .42, .004, '#ffffff', K.leatherM, lx, ly + .004, zc + .2);
      const note = (k, x, y, z, ry) => { const ge = new THREE.PlaneGeometry(.24, .106); ge.rotateX(-Math.PI / 2); const o = add(ge, T.noteM[k], x, y, z); o.rotation.y = ry; return o; };
      note(0, lx, ly + .01, zc + .2, nr);
      { const lens = new THREE.Group(); lens.position.set(lx - sd * .02, ly + .17, zc + .18); lens.rotation.set(0, face, 0); g.add(lens);
        const tilt = new THREE.Group(); tilt.rotation.x = -1.05; lens.add(tilt);
        tilt.add(new THREE.Mesh(new THREE.CircleGeometry(.085, 48), new THREE.MeshBasicMaterial({ map: img('assets/wall/currency/lens.jpg'), color: new THREE.Color(1.05, 1.05, 1.05) })));
        tilt.add(new THREE.Mesh(new THREE.TorusGeometry(.088, .008, 10, 48), brass));
        const bx = lx + sd * .05, bz = zc + .42; cyl(.045, .05, .012, brass, bx, ly + .006, bz); rod(new THREE.Vector3(bx, ly, bz), new THREE.Vector3(bx, ly + .2, bz), .006);
        rod(new THREE.Vector3(bx, ly + .2, bz), new THREE.Vector3(lx - sd * .01, ly + .2, zc + .27), .005); }
      [[0, -.32], [1, 0], [2, .32]].forEach(([k, a], i) => note(k, lx + sd * .02 + Math.sin(a) * .06, ly + .006 + i * .002, zc + .75 + Math.cos(a) * .01 - i * .02, nr + a));
      { const bz = zc + 1.25, bx = lx + sd * .04;   // the banker's lamp
        cyl(.07, .075, .022, brass, bx, ly + .011, bz, 28); rod(new THREE.Vector3(bx, ly, bz), new THREE.Vector3(bx, ly + .27, bz), .008);
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .36, 32, 1, true, Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ color: '#1d6a46', side: THREE.DoubleSide }));   // the upper half of a tube, lying along the counter
        sh.rotation.x = Math.PI / 2; sh.position.set(bx, ly + .3, bz); g.add(sh);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(.1, .34), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1cf').multiplyScalar(1.5) })); glow.rotation.x = Math.PI / 2; glow.position.set(bx, ly + .29, bz); g.add(glow);
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(.7, .5), new THREE.MeshBasicMaterial({ map: world.softTex(), color: '#ffdca0', transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending }));
        pool.rotation.x = -Math.PI / 2; pool.position.set(bx, ly + .002, bz); g.add(pool); }
      // three uncut sheets, clipped to a brass rail above the counter
      const sx = sd * (xw - .045), railY = 5.3, rx = sd * (xw - .09);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, len, 10), brass); rail.rotation.x = Math.PI / 2; rail.position.set(rx, railY, zc); g.add(rail);
      for (const z of [zc - len / 2, zc + len / 2]) box(.1, .05, .05, '#d2ab62', brass, sd * (xw - .05), railY, z);
      [-1.5, 0, 1.5].forEach((dz, k) => {
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.51), new THREE.MeshBasicMaterial({ map: img(`assets/wall/currency/sheet_${k + 1}.jpg`), color: new THREE.Color(.94, .93, .9) }));
        sh.rotation.set(0, face, (k - 1) * .012); sh.position.set(sx, railY - .08 - .755, zc + dz); g.add(sh);
        for (const cz of [-.45, .45]) { box(.03, .07, .055, '#1a1a1a', K.steelM, sx - sd * .02, railY - .07, zc + dz + cz); rod(new THREE.Vector3(rx, railY, zc + dz + cz), new THREE.Vector3(sx - sd * .02, railY - .04, zc + dz + cz), .004); }
      });
    },

    // ---------------------------------------------------------------- 3 · the vault door, ajar in the end wall (kept quiet: spun brass, two grooves, a plain wheel), bundles on a trolley beside it
    () => {
      const VY = 1.85, VZ = z1 - .02, RO = 1.5, D = .42, F = VZ - D;
      const inside = canvasTex((c, w, h) => {   // the strongroom, painted in perspective: deposit boxes on three walls, warm light
        c.fillStyle = '#17120c'; c.fillRect(0, 0, w, h);
        const bx0 = w * .3, by0 = h * .27, bx1 = w * .7, by1 = h * .7;
        const glow = c.createRadialGradient(w / 2, h * .42, 10, w / 2, h * .5, w * .6); glow.addColorStop(0, 'rgba(255,214,150,.5)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
        const grid = (quad, nx, ny) => { const [a, b, cc, d] = quad, L2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
          for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
            const t0 = i / nx, t1 = (i + 1) / nx, s0 = j / ny, s1 = (j + 1) / ny, P = (t, s) => L2(L2(a, b, t), L2(d, cc, t), s);
            const pts = [P(t0 + .06 / nx, s0 + .08 / ny), P(t1 - .06 / nx, s0 + .08 / ny), P(t1 - .06 / nx, s1 - .08 / ny), P(t0 + .06 / nx, s1 - .08 / ny)];
            c.fillStyle = `rgb(${120 + R() * 30},${92 + R() * 20},${52 + R() * 12})`; c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(...p) : c.moveTo(...p))); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(40,26,10,.8)'; c.lineWidth = 2; c.stroke();
            const m = P((t0 + t1) / 2, (s0 + s1) / 2); c.fillStyle = '#2a1a08'; c.beginPath(); c.arc(m[0], m[1], 2.5, 0, 6.29); c.fill();
          } };
        grid([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], 8, 6);
        grid([[0, 0], [bx0, by0], [bx0, by1], [0, h]], 6, 6);
        grid([[bx1, by0], [w, 0], [w, h], [bx1, by1]], 6, 6);
        c.fillStyle = '#3a2c1c'; c.beginPath(); c.moveTo(0, h); c.lineTo(bx0, by1); c.lineTo(bx1, by1); c.lineTo(w, h); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = glow; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
        const vg = c.createRadialGradient(w / 2, h / 2, w * .25, w / 2, h / 2, w * .5); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
      }, 1024 * S, 1024 * S);
      const back = new THREE.Mesh(new THREE.CircleGeometry(RO, 64), new THREE.MeshBasicMaterial({ map: inside })); back.rotation.y = Math.PI; back.position.set(0, VY, VZ - .004); g.add(back);
      const tunnel = new THREE.CylinderGeometry(RO, RO, D, 64, 1, true); tunnel.rotateX(Math.PI / 2); lit(tunnel, '#8a7552', .35);
      add(tunnel, K.M(null, { side: THREE.DoubleSide }), 0, VY, VZ - D / 2);
      // the frame: one clean brass ring and a fine lip, in a thin verde surround
      const sur = new THREE.Mesh(new THREE.RingGeometry(1.86, 2.0, 96), new THREE.MeshBasicMaterial({ map: T.verde, color: new THREE.Color(.8, .8, .78) })); sur.rotation.y = Math.PI; sur.position.set(0, VY, VZ - .01); g.add(sur);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.68, .17, 24, 128), brass); ring.scale.z = .5; ring.position.set(0, VY, F + .1); g.add(ring);
      { const o = new THREE.Mesh(new THREE.TorusGeometry(RO, .03, 12, 128), brass); o.position.set(0, VY, F + .02); g.add(o); }
      // the door: spun brass, two quiet grooves; hinged on the left and standing half open
      const doorFace = canvasTex((c, w, h) => {
        const cx = w / 2, cy = h / 2;
        const gr = c.createRadialGradient(cx * .85, cy * .75, 10, cx, cy, w * .55); gr.addColorStop(0, '#efd9a2'); gr.addColorStop(.6, '#cfa95e'); gr.addColorStop(1, '#9c7638'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        for (let k = 0; k < 260; k++) { const r = R() * w * .5; c.strokeStyle = `rgba(${R() < .5 ? '255,244,214' : '110,80,30'},${.03 + R() * .04})`; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r, 0, 6.29); c.stroke(); }
        for (const r of [.44, .2]) { c.strokeStyle = 'rgba(90,62,20,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, w * r, 0, 6.29); c.stroke(); c.strokeStyle = 'rgba(255,244,214,.45)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, w * r + 3, 0, 6.29); c.stroke(); }
      }, 1024 * S, 1024 * S);
      const steel = canvasTex((c, w, h) => { c.fillStyle = '#3b3833'; c.fillRect(0, 0, w, h); c.fillStyle = '#56524a';
        for (let i = 0; i < 6; i++) { c.save(); c.translate(w / 2, h / 2); c.rotate(i / 6 * 6.283); c.fillRect(-w * .02, w * .1, w * .04, w * .36); c.restore(); }
        c.fillStyle = '#6a655b'; c.beginPath(); c.arc(w / 2, h / 2, w * .1, 0, 6.29); c.fill(); }, 512 * S, 512 * S);
      const pivot = new THREE.Group(); pivot.position.set(-RO, VY, F); pivot.rotation.y = .62; g.add(pivot);
      const dg = new THREE.CylinderGeometry(RO - .04, RO - .04, .36, 96); dg.rotateX(Math.PI / 2); dg.translate(RO, 0, .18); lit(dg, '#d8b066', .45);
      const edge = K.M(canvasTex((c, w, h) => { c.fillStyle = '#c9a052'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(${R() < .5 ? '255,236,190' : '80,55,15'},.12)`; c.fillRect(0, y, w, 1); } }, 512, 64));
      add(dg, [edge, new THREE.MeshBasicMaterial({ map: steel }), new THREE.MeshBasicMaterial({ map: doorFace, color: new THREE.Color(.95, .93, .9) })], 0, 0, 0, pivot);
      const bolt2 = new THREE.CylinderGeometry(.045, .045, .18, 14);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, o = new THREE.Mesh(bolt2, brass); o.position.set(RO + Math.cos(a) * (RO + .02), Math.sin(a) * (RO + .02), .18); o.rotation.z = a - Math.PI / 2; pivot.add(o); }
      { const wheel = new THREE.Group(); wheel.position.set(RO, 0, -.07); pivot.add(wheel);   // a plain three-arm wheel and a hub
        for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .9, 10), brass); s.rotation.z = i * Math.PI / 3; wheel.add(s); }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.1, .11, .08, 28), brass); hub.rotation.x = Math.PI / 2; wheel.add(hub); }
      for (const dy of [-.85, .85]) { const hb = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .42, 18), brass); hb.position.set(-RO - .08, VY + dy, F - .05); g.add(hb);
        box(.36, .1, .06, '#d2ab62', brass, .12, dy, -.03, pivot); }
      shade('blob', 3.4, 1.6, .3, .4, F - .6);
      // a brass trolley of bundles, on the currency side of the vault
      const tx = TELLER.side * 2.65, tz = z1 - 1.35, tw = .62, tl = .95;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl(.014, .014, .82, brass, tx + sx * tw / 2, .5, tz + sz * tl / 2, 10); cyl(.045, .045, .03, black, tx + sx * tw / 2, .045, tz + sz * tl / 2, 16).rotation.z = Math.PI / 2; }
      for (const y of [.26, .86]) rbox(tw + .06, .03, tl + .06, .01, '#6a442a', K.woodM, tx, y, tz);
      rod(new THREE.Vector3(tx, .91, tz - tl / 2 - .02), new THREE.Vector3(tx, 1.02, tz - tl / 2 - .1), .012);   // the push bar
      rod(new THREE.Vector3(tx - .2, 1.02, tz - tl / 2 - .1), new THREE.Vector3(tx + .2, 1.02, tz - tl / 2 - .1), .014);
      const stack = (y, nx, nz, ny) => { for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (let n = 0; n < ny; n++)
        bundle((i + j + n) % 3, tx - (nx - 1) * .055 + i * .11, y + .009 + n * .0165, tz - (nz - 1) * .13 + j * .26, (R() - .5) * .04); };
      stack(.875, 5, 3, low ? 4 : 6); stack(.275, 5, 3, low ? 3 : 4);
      shade('rect', 1.1, 1.4, .3, tx, tz);
    },

    // ---------------------------------------------------------------- 4 · the left wall is all records: past the covers, a listening console where the visitor picks what plays
    () => {
      const sd = PLAYER.side, face = -sd * Math.PI / 2, zc = PLAYER.z, cx = sd * (xw - .41), len = 3.0, H0 = .17, top = .79, CD = .74;   // a deep console, so a big turntable sits on it
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(.016, .01, H0, brass, cx + sx * (CD / 2 - .06), H0 / 2, zc + sz * (len / 2 - .1), 8);
      box(CD, top - H0, len, '#5c3a22', K.woodM, cx, (H0 + top) / 2, zc);
      const slats = canvasTex((c, w, h) => { c.fillStyle = '#5a3820'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += w / 48) { c.fillStyle = 'rgba(20,10,4,.55)'; c.fillRect(x, 0, 3, h); c.fillStyle = 'rgba(255,220,180,.08)'; c.fillRect(x + 3, 0, 2, h); }
        c.strokeStyle = 'rgba(15,8,3,.9)'; c.lineWidth = 6; for (const k of [1, 2]) { c.beginPath(); c.moveTo(w * k / 3, 0); c.lineTo(w * k / 3, h); c.stroke(); }
        c.fillStyle = '#d2ab62'; for (const k of [0, 1, 2]) c.fillRect(w * (k / 3 + 1 / 6) - 14, h * .45, 28, 6); }, 1024 * S, 256 * S);
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(len - .04, top - H0 - .06), new THREE.MeshBasicMaterial({ map: slats, color: new THREE.Color(.92, .88, .84) })); fr.rotation.y = face; fr.position.set(cx - sd * (CD / 2 + .002), (H0 + top) / 2, zc); g.add(fr);
      rbox(CD + .04, .035, len + .06, .012, '#6a442a', K.woodM, cx, top + .017, zc);
      const T0 = top + .035;
      // the turntable: whichever record the visitor picks
      const tt = new THREE.Group(); tt.position.set(cx, T0, zc); tt.scale.setScalar(1.7); g.add(tt);   // a big display turntable: the record reads from the stop
      rbox(.42, .08, .5, .015, '#4a2e1c', K.woodM, 0, .04, 0, tt);
      cyl(.175, .175, .018, black, 0, .089, 0, 48, tt);
      const recG = new THREE.CircleGeometry(.158, 96); recG.rotateX(-Math.PI / 2);
      const recM = new THREE.MeshBasicMaterial({ map: world.recTex?.['01'] || img('assets/wall/albums/rec_01.jpg') });
      const disc = add(recG, recM, 0, .1, 0, tt); spin(disc, -1.0, 'y');   // turning slowly enough to read the cover
      cyl(.004, .004, .02, brass, 0, .105, 0, 8, tt);
      cyl(.028, .032, .035, brass, sd * .19, .1, .2, 16, tt);
      rod(new THREE.Vector3(sd * .19, .125, .2), new THREE.Vector3(sd * .15, .115, -.02), .006, brass, tt);
      box(.03, .012, .05, '#202020', K.steelM, sd * .148, .108, -.04, tt);   // the arm rests at the outer groove, clear of the label
      // speakers either side, the cloth turned to the room
      const cloth = canvasTex((c, w, h) => { c.fillStyle = '#2a2420'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(80,70,60,${.15 + R() * .1})`; c.fillRect(0, y, w, 1); }
        for (const [y, r] of [[.33, .26], [.74, .14]]) { const gr = c.createRadialGradient(w / 2, h * y, 2, w / 2, h * y, w * r); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(.85, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.beginPath(); c.arc(w / 2, h * y, w * r, 0, 6.29); c.fill(); } }, 256, 384);
      for (const dz of [-1.2, 1.2]) { box(.3, .46, .3, '#5c3a22', K.woodM, cx, T0 + .23, zc + dz);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(.26, .42), new THREE.MeshBasicMaterial({ map: cloth })); f.rotation.y = face; f.position.set(cx - sd * .152, T0 + .23, zc + dz); g.add(f); }
      shade('rect', .9, len + .5, .3, cx - sd * .05, zc);
      // the four sleeves on a brass ledge above: click one to put it on
      const ledgeY = 1.42, lxw = sd * (xw - .07);
      box(.1, .025, 2.0, '#d2ab62', brass, sd * (xw - .05), ledgeY, zc);
      box(.012, .05, 2.0, '#d2ab62', brass, sd * (xw - .1), ledgeY + .03, zc);
      const sleeves = RECORDS.map((r, k) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ map: img(`assets/wall/albums/sleeve_${r.file}.jpg`) }));
        const holder = new THREE.Group(); holder.userData.dynamic = true; holder.position.set(lxw, ledgeY + .015, zc + (k - 1.5) * .46); holder.rotation.y = face; g.add(holder);
        m.position.y = .2; m.rotation.x = -.09; holder.add(m);
        m.userData = { type: 'record', k, title: r.title }; world.interactive.push(m); return { holder, m };
      });
      // the plate above says what is playing
      const plateC = document.createElement('canvas'); plateC.width = 512; plateC.height = 160;
      const plateT = new THREE.CanvasTexture(plateC); plateT.colorSpace = THREE.SRGBColorSpace;
      const drawPlate = title => { const c = plateC.getContext('2d'), w = 512, h = 160; const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e9cd85'); gr.addColorStop(1, '#b38a3e'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(80,55,15,.7)'; c.lineWidth = 3; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#3a2508'; c.textAlign = 'center';
        c.font = `600 ${h * .2}px ${SANS}`; c.fillText('NOW PLAYING', w / 2, h * .38); c.font = `italic 500 ${h * .3}px ${SERIF}`; c.fillText(title, w / 2, h * .76); plateT.needsUpdate = true; };
      drawPlate(RECORDS[0].title);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(.62, .2), new THREE.MeshBasicMaterial({ map: plateT })); pl.rotation.y = face; pl.position.set(sd * (xw - .03), 1.66, zc + 1.33); g.add(pl);   // beside the ledge, so the stop can look down at the record and still read it
      // a crate of records, two velvet poufs, a round rug
      const kx = sd * (xw - .5), kz = PLAYER.crateZ;
      for (const [w2, d2, x2, z2] of [[.44, .02, 0, -.18], [.44, .02, 0, .18], [.02, .36, -.21, 0], [.02, .36, .21, 0]]) box(w2, .3, d2, '#b98a58', K.woodM, kx + x2, .16, kz + z2);
      box(.44, .02, .38, '#a87a4a', K.woodM, kx, .02, kz);
      const cols = ['#e8483a', '#f7a23a', '#2a6fd6', '#151515', '#e9e1d2', '#7a2a6a', '#1f9a3e', '#c9a646', '#3d4b66', '#d81b60'];
      for (let i = 0; i < 12; i++) { const o = box(.31, .31, .006, cols[i % cols.length], K.paperM, kx, .19, kz - .15 + i * .026); o.rotation.x = -.12 - R() * .08; }
      shade('rect', .7, .6, .3, kx, kz);
      const pouf = new THREE.SphereGeometry(.3, 28, 18); pouf.scale(1, .62, 1); lit(pouf, '#6c1f2c', .55);
      for (const dz of [-.65, .65]) { add(pouf, K.paperM, sd * 2.95, .19, zc + dz); shade('blob', .8, .8, .35, sd * 2.95, zc + dz); }
      const rug = canvasTex((c, w, h) => { const r = w / 2; c.translate(r, r);
        for (const [rr, col] of [[1, '#c9a24e'], [.96, '#1d3b2e'], [.8, '#c9a24e'], [.785, '#5a1d28'], [.45, '#c9a24e'], [.435, '#1d3b2e']]) { c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * rr, 0, 6.29); c.fill(); }
        for (let i = 0; i < 64; i++) { c.save(); c.rotate(i / 64 * 6.283); c.fillStyle = 'rgba(201,162,78,.5)'; c.fillRect(-3, -r * .7, 6, r * .12); c.restore(); }
        for (let k = 0; k < 6000; k++) { c.fillStyle = `rgba(0,0,0,${R() * .06})`; c.fillRect((R() - .5) * w, (R() - .5) * h, 2, 2); } }, 1024 * S, 1024 * S);
      const rg = new THREE.Mesh(new THREE.CircleGeometry(1.35, 72), new THREE.MeshBasicMaterial({ map: rug, color: new THREE.Color(.85, .82, .8) })); rg.rotation.x = -Math.PI / 2; rg.position.set(sd * 3.05, .008, zc); g.add(rg);
      // the hall's bench, as a bank would have it: buttoned green leather on a brass frame
      { const bz = .4, bl = 2.0, seat = new RoundedBoxGeometry(.52, .12, bl, 3, .05); lit(seat, '#2c5440', .55); add(seat, K.paperM, 0, .44, bz);
        const tuft = new THREE.SphereGeometry(.012, 8, 6); for (let i = 0; i < 9; i++) for (const dx of [-.12, .12]) add(tuft, black, dx, .5, bz - .8 + i * .2);
        rbox(.5, .03, bl - .04, .01, '#d2ab62', brass, 0, .37, bz);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(.018, .014, .36, brass, sx * .2, .18, bz + sz * (bl / 2 - .1), 10);
        shade('rect', .9, 2.4, .35, 0, bz); }
      // picking a record: the chosen sleeve stands proud, the disc swaps, the plate is rewritten, the page is told (it plays the song once one is added)
      const lift = k => sleeves.forEach((s, i) => { s.holder.position.y = ledgeY + .015 + (i === k ? .05 : 0); s.holder.position.x = lxw - sd * (i === k ? .05 : 0); });
      world.recordPlayer = { k: 0, records: RECORDS, play(k) {
        if (k === this.k) return; this.k = k; const r = RECORDS[k];
        recM.map = world.recTex?.[r.file] || recM.map; recM.needsUpdate = true; drawPlate(r.title); lift(k);
        dispatchEvent(new CustomEvent('navgod-record', { detail: { k, ...r } }));
      } };
      lift(0);
    },
  ];
}

/* Hall 05's records: the four covers, in wall order. To add a song later: put the file in assets/audio/ and set song: 'assets/audio/<name>.mp3' */
export const RECORDS = [
  { file: '01', title: 'In Rainbows', artist: 'Radiohead', song: null },
  { file: '03', title: 'Beta', artist: 'Peter Cat Recording Co.', song: null },
  { file: '04', title: 'Dig Your Own Hole', artist: 'The Chemical Brothers', song: null },
  { file: '05', title: 'Afternoon Ragas', artist: 'Nikhil Banerjee', song: null },
];
const TELLER = { side: -1, z: 4.1, len: 4.6 };                 // the right wall (as you walk in), past the notes
const PLAYER = { side: 1, z: -.6, crateZ: 1.55 };              // the left wall, before the covers

/* the walk's two extra stops in Hall 05: after the notes, the bundles up close; after the covers, the turntable.
   (the journey orders a hall's stops by userData.z, so these carry sort keys, not their places) */
export function bankStops(world, hall) {
  const g = hall.group, xw = hall.W / 2, T = TELLER, P = PLAYER;
  const mk = (id, z, pose, zoom, extra = {}) => { const o = new THREE.Object3D(); o.userData = { type: 'work', id, hallId: hall.def.id, frame: o, size: [2, 1], z, pose, zoom, salon: true, ...extra }; g.add(o); hall.exhibits.push(o); return o; };
  mk('currency', 4.0, [T.side * (xw - 1.75), 2.15, T.z + .1, T.side * (xw - .58), 1.08, T.z + .1], 64);   // over the counter, looking down at the ledge
  mk('albums', 6.0, [P.side * (xw - 1.95), 2.45, P.z + .15, P.side * (xw - .42), 1.08, P.z + .15], 56, { player: true });   // high, looking down onto the spinning record   // higher: looking down onto the spinning record
}

/* each album sleeve on the wall lets its record peek out and turn, slowly, on the open side */
export function sleeveVinyl(world, f, p, file) {
  const s = p.x < 0 ? -1 : 1, r = p.w * .465;
  const holder = new THREE.Group(); holder.userData.dynamic = true; holder.position.set(p.x + s * p.w * .3, p.y, .03); f.add(holder);
  const t = world.loader.load(`assets/wall/albums/rec_${file.slice(0, 2)}.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  (world.recTex ||= {})[file.slice(0, 2)] = t;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 72), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(.95, .95, .95) }));
  holder.add(disc); disc.userData.spin = s * -.55; disc.userData.spinAxis = 'z'; (world.spinners ||= []).push(disc);
}
