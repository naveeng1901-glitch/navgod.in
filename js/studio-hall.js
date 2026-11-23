/* Hall 01, Packaging: "the dieline studio".
   Kraft walls (a paper-fibre multiply layer over the baked tint), his real dielines traced in white line, a framed mockup behind each package,
   a runner of colour chips down the floor (each package's palette), a Kazaar carton floating over its case that unfolds into its net and folds back,
   and on the front wall a clothes rail where the Playable hanger box hangs among tees.
   Unlit materials only (vertex-shaded, like Halls 04 and 05): no lights, no shadows to toggle. studioSteps() returns short startup steps. */
import * as THREE from 'three';

let seed = 5;
const R = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const canvasTex = (draw, w, h, rep) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const MONO = 'Consolas, "SFMono-Regular", Menlo, monospace';

/* the packages' palettes (from their case studies), for the chip runner */
const CHIPS = [
  ['ALTURA', [['#caf0e2', 'Peak mint'], ['#6a5140', 'Earth brown'], ['#fd955f', 'Nilgiri sunrise'], ['#b3b597', 'Himalayan sage']]],
  ['KAZAAR', [['#060502', 'Monsoon black'], ['#aa8800', 'Botanical gold'], ['#ffcc00', 'Gin yellow'], ['#f9f9f9', 'Rhino white']]],
  ['ELEFTHERIA', [['#fae284', 'Butter yellow'], ['#ccb464', 'Rind gold'], ['#f1ead0', 'Cream'], ['#897535', 'Monogram olive']]],
  ['DONUT PROTOCOL', [['#4a3b00', 'Olive night'], ['#74563c', 'Cocoa'], ['#e7a535', 'Glaze gold'], ['#fda6cd', 'Strawberry pink']]],
  ['MISTY MATCHES', [['#0a0809', 'Night black'], ['#d62860', 'Neon pink'], ['#e22c76', 'Hot pink'], ['#c2c2c2', 'Chrome']]],
  ['PLAYABLE', [['#9c1717', 'Playable red'], ['#f7f0e4', 'Cotton cream'], ['#ab7c5a', 'Kraft'], ['#2f3a2a', 'Olive tee']]],
];
// where each package's wall pieces go (its plinth side / z come from the hall): which dieline hangs above its mockup
const DIE_OVER = { altura: 'altura', cheese: 'cheese', playable: 'playable' };

export function studioSteps(world, hall, HALL_H, PLINTHS) {
  const g = hall.group, L = hall.L, xw = 4.47, z0 = -L / 2, z1 = 13.46;   // the baked walls stand at x ±4.50 and the end wall at z 13.48
  const low = world.gpu.tier === 'low', S = low ? .5 : 1;
  const K = world.benchKit(); world.deskMats(K); const { lit } = K, brass = K.brassM, black = K.blackM;
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, h, d, col, m, x, y, z, parent) => add(lit(new THREE.BoxGeometry(w, h, d), col), m, x, y, z, parent);
  const cyl = (r0, r1, h, m, x, y, z, seg = 14, parent) => add(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z, parent);
  const img = url => { const t = world.loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const shade = (kind, w, d, a, x, z) => { const s = world.shadowMesh(kind, w, d, a); s.rotation.x = -Math.PI / 2; s.position.set(x, .012, z); g.add(s); };
  const wallPlane = (w, h, mat, side, y, z) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); p.rotation.y = -side * Math.PI / 2; p.position.set(side * xw, y, z); g.add(p); return p; };   // on a long wall, facing the aisle
  const dieMat = name => new THREE.MeshBasicMaterial({ map: img(`assets/hall01/die_${name}.png`), transparent: true, depthWrite: false, color: new THREE.Color(.96, .94, .9) });
  const DIE_ASP = { kazaar: 1299 / 1680, altura: 1680 / 1079, cheese: 1679 / 1316, playable: 1680 / 1122 };

  return [
    // ---------------------------------------------------------------- 1 · kraft fibre on the walls, the colour-chip runner, the dieline sheet on the end wall
    () => {
      const fibre = canvasTex((c, w, h) => {   // white with kraft fibres and flecks: multiplied over the baked kraft tint
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
        for (let k = 0; k < 2600; k++) { const x = R() * w, y = R() * h, l = 6 + R() * 40, a = R() * 6.28; c.strokeStyle = `rgba(${120 + R() * 40},${85 + R() * 30},${50 + R() * 20},${.05 + R() * .1})`; c.lineWidth = .6 + R() * 1.2;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
        for (let k = 0; k < 900; k++) { c.fillStyle = `rgba(90,60,30,${R() * .15})`; c.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
      }, 1024 * S, 1024 * S, true);
      const fm = (len, hh) => { const t = fibre.clone(); t.repeat.set(len / 2.2, hh / 2.2); t.needsUpdate = true; return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true }); };
      const y0 = .2, y1 = HALL_H - 1.25, hh = y1 - y0;
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L - .2, hh), fm(L, hh)); p.rotation.y = -sx * Math.PI / 2; p.position.set(sx * (xw + .02), y0 + hh / 2, 0); g.add(p); }
      { const p = new THREE.Mesh(new THREE.PlaneGeometry(9, hh), fm(9, hh)); p.rotation.y = Math.PI; p.position.set(0, y0 + hh / 2, z1 - .02); g.add(p); }
      // (the colour-chip runner and the dieline sheet on the end wall came out, 2026-11-14: he wants the room calmer)
    },

    // ---------------------------------------------------------------- 2 · behind each package its mockup in an oak frame, its dieline above where there is one
    () => {
      for (const { id, side, z } of PLINTHS) {
        const fw = 3.0, fh = fw / 1.777, y = 2.95, wx = side * (xw - .03);   // (bigger, 2026-11-14)
        box(.05, fh + .12, fw + .12, '#b98a58', K.woodM, wx - side * .02, y, z);                          // the oak frame
        const ph = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ map: img(`assets/hall01/mock_${id}.jpg`), color: new THREE.Color(.93, .92, .9) }));
        ph.rotation.y = -side * Math.PI / 2; ph.position.set(wx - side * .047, y, z); g.add(ph);
      }
    },

    // ---------------------------------------------------------------- 3 · the Kazaar carton over its case, folding open into its net and closing again
    () => {
      return;   // (the floating carton came out, 2026-11-14)
      const kz = PLINTHS.find(p => p.id === 'kazaar'); if (!kz) return;
      const W = .095, H = .31, D = .095, T = .002, SC = 3.2;
      const inside = new THREE.MeshBasicMaterial({ color: '#efe8da' });
      const face = n => new THREE.MeshBasicMaterial({ map: img(`assets/hall01/fold_${n}.jpg`) });
      const panel = (w, h, n, x0, y0) => {   // a board panel with its print outside (+z) and plain board inside
        const geo = new THREE.BoxGeometry(w, h, T); geo.translate(x0 + w / 2, y0 + h / 2, 0);
        return new THREE.Mesh(geo, [inside, inside, inside, inside, face(n), inside]);
      };
      const root = new THREE.Group(); root.userData.dynamic = true; root.scale.setScalar(SC);
      root.position.set(kz.side * 2.4, 3.55, kz.z); root.rotation.y = -kz.side * Math.PI / 2 + kz.side * .35; g.add(root);
      const net = new THREE.Group(); net.position.set(0, -H / 2, 0); root.add(net);
      net.add(panel(W, H, 'front', -W / 2, 0));
      const r1 = new THREE.Group(); r1.position.x = W / 2; net.add(r1); r1.add(panel(D, H, 'right', 0, 0));
      const r2 = new THREE.Group(); r2.position.x = D; r1.add(r2); r2.add(panel(W, H, 'back', 0, 0));
      const l1 = new THREE.Group(); l1.position.x = -W / 2; net.add(l1); l1.add(panel(D, H, 'left', -D, 0));
      const top = new THREE.Group(); top.position.y = H; r2.add(top); top.add(panel(W, D, 'top', 0, 0));
      const bot = new THREE.Group(); net.add(bot); bot.add(panel(W, D, 'bottom', -W / 2, -D));
      // a slow loop: closed, it opens side by side, lies flat facing you, then folds shut again
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x), seg = (t, a, b) => ease((t - a) / (b - a));
      (world.tickers ||= []).push(t => {
        if (!g.visible) return;
        const c = t % 14, open = c < 7 ? 0 : 1, u = c < 7 ? c : c - 7;   // 0..7 opening, 7..14 closing
        const k = s => (open ? 1 - s : s);
        const a = h => Math.PI / 2 * (1 - h);                              // h = how flat a hinge is
        const f1 = k(seg(u, 1.0, 2.4)), f2 = k(seg(u, 1.8, 3.2)), f3 = k(seg(u, 2.6, 4.0)), f4 = k(seg(u, 3.2, 4.6)), f5 = k(seg(u, 3.6, 5.0));
        bot.rotation.x = a(f1); top.rotation.x = -a(f2); l1.rotation.y = -a(f3); r1.rotation.y = a(f4); r2.rotation.y = a(f5);
        const flat = (f3 + f4 + f5) / 3; net.position.x = -flat * W / 2; net.position.z = (1 - flat) * D / 2;   // keep the net centred as it opens
        root.position.y = 3.55 + Math.sin(t * .6) * .04;
      });
      const glow = new THREE.Mesh(new THREE.CircleGeometry(.9, 40), new THREE.MeshBasicMaterial({ map: world.softTex(), color: '#ffe6bf', transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.rotation.y = root.rotation.y; glow.position.set(kz.side * 2.75, 3.55, kz.z); g.add(glow);
    },

    // ---------------------------------------------------------------- 4 · the end wall: a clothes rail, the Playable hanger box among the tees
    () => {
      const rx = 0, rz = z1 - .55, top = 1.78, half = 1.3, n0 = g.children.length;
      for (const dz of [-half, half]) {   // a black steel rail on two uprights and flat feet
        cyl(.016, .016, top, black, rx + dz, top / 2, rz, 12);
        box(.06, .02, .44, '#1a1a1a', K.steelM, rx + dz, .01, rz);
      }
      { const bar = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, half * 2 + .06, 12), black); bar.rotation.z = Math.PI / 2; bar.position.set(rx, top, rz); g.add(bar); }
      const tee = (col) => {   // a tee on a wooden hanger, front to the room
        const s = new THREE.Shape(), w = .5, h = .66;
        s.moveTo(-.09, 0); s.lineTo(-w * .36, -.03); s.lineTo(-w / 2, -.12); s.lineTo(-w * .42, -.24); s.lineTo(-w * .3, -.2); s.lineTo(-w * .3, -h); s.lineTo(w * .3, -h); s.lineTo(w * .3, -.2); s.lineTo(w * .42, -.24); s.lineTo(w / 2, -.12); s.lineTo(w * .36, -.03); s.lineTo(.09, 0);
        s.quadraticCurveTo(0, -.07, -.09, 0);
        const geo = new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2 }); geo.translate(0, 0, -.015); lit(geo, col, .6);
        const grp = new THREE.Group(); grp.add(new THREE.Mesh(geo, K.paperM));
        const hb = new THREE.Mesh(lit(new THREE.BoxGeometry(.42, .025, .02), '#b98a58'), K.woodM); hb.position.y = .01; grp.add(hb);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(.03, .004, 6, 16, Math.PI * 1.3), brass); hook.position.y = .07; hook.rotation.z = -.3; grp.add(hook);
        return grp;
      };
      // three tees (olive, red, cream, like the Playable shoot) and room left for the hanger box
      [['#5d6b4c', -1.05], ['#9c2a22', -.8], ['#efe6d6', -.55], ['#2f3a2a', -.3], ['#9c2a22', .78], ['#efe6d6', 1.03]].forEach(([col, dx], i) => {
        const t = tee(col); t.position.set(rx + dx, top - .1, rz + (i % 2 ? .02 : -.02)); t.rotation.y = Math.PI + (R() - .5) * .25; g.add(t); });
      shade('rect', 3.0, .8, .3, rx, rz - .1);
      // the hanger box itself: the real model, built with the vitrine packages before the doors open
      const holder = new THREE.Group(); holder.position.set(rx + .22, top - .388 * 1.6 + .05, rz); holder.rotation.y = Math.PI; g.add(holder);
      (world.caseQueue ||= []).push({ holder, model: 'playable', side: 1, fixed: 1.6, bright: 2.4 });
      { const SC = 1.4, grp = new THREE.Group(); for (const o of g.children.slice(n0)) { o.position.x -= rx; o.position.z -= rz; grp.add(o); }
        grp.position.set(rx, 0, rz - .12); grp.scale.setScalar(SC); g.add(grp); }   // the whole rail, 40% bigger (2026-11-14)
      // a small kraft tag on the wall beside it
      const tag = canvasTex((c, w, h) => { c.fillStyle = '#c69c6d'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a1c10'; c.font = `600 ${h * .2}px ${MONO}`; c.fillText('PLAYABLE', w * .08, h * .36); c.font = `400 ${h * .13}px ${MONO}`; c.fillText('the box is the hanger', w * .08, h * .62); c.fillText('hang it · carry it · play in it', w * .08, h * .82); }, 512, 200);
      const tp = new THREE.Mesh(new THREE.PlaneGeometry(.6, .235), new THREE.MeshBasicMaterial({ map: tag })); tp.rotation.y = Math.PI; tp.position.set(rx + 2.55, 1.6, z1 - .02); g.add(tp);
    },
  ];
}
