/* =========================================================
   PACKAGING MODELS: Naveen's six packages, built from his own dielines, labels and photos
   (textures cut by the scripts in scratchpad/pack; sizes from the real dielines).
   buildProduct(id, renderer) -> THREE.Group, centred on x/z, standing on y = 0
   ========================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const L = new THREE.TextureLoader();
let ANISO = 8;
const tex = (p, opts = {}) => new Promise(res => L.load(p, async t => {
  try { await t.image.decode(); } catch (e) {}   // decoded off the main thread now: otherwise the first upload decodes it on the spot (a 3 s freeze, measured)
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; Object.assign(t, opts); res(t);
}));
const json = p => fetch(p).then(r => r.json());
const card = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: .62, metalness: 0, ...extra });
const plain = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra });
const shadowy = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t;
}

// ---------------- Altura: tuck box with a window on the back, three mountain tea bags inside ----------------
async function altura(base) {
  // v3: the rebuilt faces (Packaging/Altura/master), true size 130 x 95 x 35 mm; die-cut window on the back onto one mountain tag
  const W = .13, H = .095, D = .035;
  const [right, left, top, bottom, front, back] = await Promise.all(['right', 'left', 'top', 'bottom', 'front', 'back_cut'].map(n => tex(`${base}altura/v3_${n}.png`)));
  const g = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 3, .0008),
    [card(right), card(left), card(top), card(bottom), card(front), card(back, { alphaTest: .5, side: THREE.DoubleSide })]);
  box.position.y = H / 2; g.add(box);
  const mint = plain('#cbeee1', { roughness: .9 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(W - .003, H - .003, D - .003), [mint, mint, mint, mint, mint, mint].map(m => m.clone()));
  tray.material.forEach(m => m.side = THREE.BackSide); tray.position.y = H / 2; g.add(tray);
  const WX0 = 14.5 / 130, WY0 = 19.5 / 95, WX1 = 115.5 / 130, WY1 = 77 / 95;          // window in face fractions
  const film = new THREE.Mesh(new THREE.PlaneGeometry(W * (WX1 - WX0), H * (WY1 - WY0)),
    new THREE.MeshStandardMaterial({ roughness: .04, metalness: 0, transparent: true, opacity: .2, depthWrite: false }));   // a clear film: plain transparency (real transmission re-drew the whole museum a second time every frame it was on screen)
  film.position.set(-(-W / 2 + W * (WX0 + WX1) / 2), H - H * (WY0 + WY1) / 2, -D / 2 + .0008); film.rotation.y = Math.PI; g.add(film);
  const t = await tex(`${base}altura/v3_tag_green.png`), a = t.image.height / t.image.width, s = W * .78;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(s, s * a), new THREE.MeshStandardMaterial({ map: t, alphaTest: .4, side: THREE.DoubleSide, roughness: .8 }));
  tag.position.set(0, H - H * WY1 + .004 + s * a / 2, -D / 2 + .008); tag.rotation.y = Math.PI; g.add(tag);
  g.userData.tagTex = t;
  return shadowy(g);
}
// the mountain tag alone, for the exploded / unboxing shots
async function alturaTag(base) {
  const g = new THREE.Group(); const t = await tex(`${base}altura/v3_tag_green.png`), a = t.image.height / t.image.width, s = .07;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * a), new THREE.MeshStandardMaterial({ map: t, alphaTest: .4, side: THREE.DoubleSide, roughness: .8 }));
  m.position.y = s * a / 2; g.add(m); return shadowy(g);
}

// ---------------- Eleftheria: hexagonal cheese box ----------------
async function cheese(base, open = false) {
  // v5: NO outer box. The package is six wedge cartons (80 mm a side, 50 mm tall) that make the hexagon together.
  // Their tops spell C-H-E-E-S-E; their outer faces carry the walls (CHEESE front, info + barcode back, monogram sides);
  // the cream sticker seals the centre and stays there when a slice is pulled away.
  const R = .08, HT = .05, C = `${base}cheese/v3_`;
  const [topT, baseT, front, back, sideT, inner, sticker] = await Promise.all(['lid_nobadge', 'base', 'wall_cheese', 'wall_back', 'wall_side', 'wedge_inner_4_E', 'sticker'].map(n => tex(C + n + '.png')));
  const g = new THREE.Group(), yel = plain('#fae284', { roughness: .6, side: THREE.DoubleSide });
  const UV = (x, z) => [(x + R) / (2 * R), 1 - (z + R * .866) / (R * 1.732)];
  const outerFace = { 3: front, 0: back };
  const tri = (P, y, map, flip) => {
    const geo = new THREE.BufferGeometry(), pos = [], uv = []; const pts = flip ? [P[0], P[2], P[1]] : P;
    for (const [x, z] of pts) { pos.push(x, y, z); uv.push(...UV(x, z)); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
    return new THREE.Mesh(geo, card(map, { side: THREE.DoubleSide }));
  };
  // a cheese texture for what's inside: pale butter paste with a few eyes
  const cheeseT = canvasTex(1024, 1024, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f4d36b'); gr.addColorStop(1, '#e9bf4c'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 4000; k++) { x.fillStyle = `rgba(${200 + Math.random() * 40},${170 + Math.random() * 40},90,${Math.random() * .08})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    for (let k = 0; k < 18; k++) { const cx = Math.random() * w, cy = Math.random() * h, r = 18 + Math.random() * 40;
      const rg = x.createRadialGradient(cx - r * .3, cy - r * .3, 1, cx, cy, r); rg.addColorStop(0, '#b8862a'); rg.addColorStop(.7, '#d9a93c'); rg.addColorStop(1, '#f0cc62'); x.fillStyle = rg; x.beginPath(); x.ellipse(cx, cy, r, r * .8, 0, 0, 7); x.fill(); }
  });
  cheeseT.wrapS = cheeseT.wrapT = THREE.RepeatWrapping; cheeseT.repeat.set(16, 16);               // extrude UVs are in metres
  const cheeseM = new THREE.MeshStandardMaterial({ map: cheeseT, roughness: .5, color: '#ffe9a8' });
  const board = plain('#f3dc86', { roughness: .75 });
  const inners = await Promise.all(['1_C', '2_H', '3_E', '4_E', '5_S', '6_E'].map(n => tex(C + 'wedge_inner_' + n + '.png')));
  const wedge = (i, opened = false) => {
    const a0 = (-120 + 60 * i) * Math.PI / 180, a1 = (-60 + 60 * i) * Math.PI / 180, r = R * .99, h = HT;
    const P = [[0, 0], [Math.cos(a1) * r, Math.sin(a1) * r], [Math.cos(a0) * r, Math.sin(a0) * r]];
    const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cz = (P[0][1] + P[1][1] + P[2][1]) / 3;
    const piece = new THREE.Group(), inn = new THREE.Group(); piece.add(inn); inn.position.set(-cx, 0, -cz); piece.position.set(cx, 0, cz);
    // the carton itself: a solid board prism with softened edges (so every edge has real thickness)
    const shp = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: h - .0016, bevelEnabled: true, bevelThickness: .0008, bevelSize: .0006, bevelSegments: 2 }), board);
    body.rotation.x = -Math.PI / 2; body.position.y = .0008; if (!opened) inn.add(body);
    inn.add(tri(P, h + .0002, topT), tri(P, .0001, baseT, true));
    const faces = [[P[2], P[1], outerFace[i] || sideT], [P[0], P[2], inners[i]], [P[1], P[0], yel]];
    faces.forEach(([p, q, t], k) => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), sd = new THREE.Mesh(new THREE.PlaneGeometry(L, h), t.isMaterial ? t : card(t, { side: THREE.DoubleSide }));
      const nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L, o = .0007;                     // a hair outside the board
      if (opened && k === 1) {                                                                // the pull-tab face, swung open on its outer edge
        const hinge = new THREE.Group(); hinge.position.set(p[0] === P[0][0] && p[1] === P[0][1] ? q[0] : p[0], 0, p[1] === P[0][1] && p[0] === P[0][0] ? q[1] : p[1]);
        sd.position.set((p[0] + q[0]) / 2 - hinge.position.x, h / 2, (p[1] + q[1]) / 2 - hinge.position.z); sd.rotation.y = -Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI;
        hinge.add(sd); hinge.rotation.y = -1.25; inn.add(hinge); return;
      }
      sd.position.set((p[0] + q[0]) / 2 - nx * o, h / 2, (p[1] + q[1]) / 2 - nz * o); sd.rotation.y = -Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI; inn.add(sd);
    });
    if (opened) {                                                                             // the 83 g wedge of cheese inside, now visible
      const cz2 = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x * .93 + cx * .07, -(z * .93 + cz * .07))));
      const ch = new THREE.Mesh(new THREE.ExtrudeGeometry(cz2, { depth: h * .86, bevelEnabled: true, bevelThickness: .002, bevelSize: .0015, bevelSegments: 3 }), cheeseM);
      ch.rotation.x = -Math.PI / 2; ch.position.y = .002; inn.add(ch);
      // the carton's other walls, thin board, so the cut-away reads as a box
      const bw = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: .0012, bevelEnabled: false }), board); bw.rotation.x = -Math.PI / 2; inn.add(bw);
    }
    piece.userData.dir = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)]; return piece;
  };
  const pieces = [0, 1, 2, 3, 4, 5].map(i => wedge(i, open && i === 3)); pieces.forEach(p => g.add(p));
  const sa = sticker.image.height / sticker.image.width, sw = R * .42 * 1.732;
  const st = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * sa), card(sticker, { alphaTest: .5, side: THREE.DoubleSide, roughness: .4 }));
  st.rotation.set(-Math.PI / 2, 0, 0); st.position.y = HT + .0005; g.add(st);
  if (open) {                                                       // one slice pulled out and away, its neighbour eased open; the sticker stays put
    const out = pieces[3], [dx, dz] = out.userData.dir; out.position.x += dx * R * 1.05 + .02; out.position.z += dz * R * 1.05; out.rotation.y = -2.0;
    const half = pieces[2], [hx, hz] = half.userData.dir; half.position.x += hx * .025; half.position.z += hz * .025; half.rotation.y = .06;
  }
  return shadowy(g);
}

// ---------------- Misty Matches: sleeve + tray pulled out, matches inside ----------------
async function matches(base) {
  // v3: 53 x 36 x 15 mm, rebuilt faces (Packaging/Misty Matches/master)
  const [label, labelBack, striker, trayEnd, trayFloor] = await Promise.all(['front', 'back', 'striker', 'tray_end', 'tray_floor'].map(n => tex(`${base}match/v3_${n}.png`)));
  const W = .053, D = .036, H = .015, t = .0006;
  const black = plain('#141414', { roughness: .8 }), hidden = new THREE.MeshBasicMaterial({ visible: false });
  const g = new THREE.Group();
  // sleeve: four 0.6 mm boards; the label and back on the big faces, strikers on the long sides, open ends show the board edge
  const edge = plain('#222', { roughness: .9 }), inner = plain('#1b1b1b', { roughness: .9 });
  const slab = (w, h, d, mats, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.position.set(x, y, z); g.add(m); };
  slab(W, t, D, [edge, edge, card(label, { roughness: .45 }), inner, edge, edge], 0, H - t / 2, 0);
  slab(W, t, D, [edge, edge, inner, card(labelBack, { roughness: .45 }), edge, edge], 0, t / 2, 0);
  slab(W, H - 2 * t, t, [edge, edge, edge, edge, card(striker, { roughness: .95 }), inner], 0, H / 2, D / 2 - t / 2);
  slab(W, H - 2 * t, t, [edge, edge, edge, edge, inner, card(striker, { roughness: .95 })], 0, H / 2, -D / 2 + t / 2);
  // the tray: an open-top box in pink card, slid out 40%
  const tw = W - .001, th = H - 2 * t - .0004, td = D - 2 * t - .0004, out = W * .42;
  const tray = new THREE.Group(); tray.position.set(out, t + .0002, 0); g.add(tray);
  const pink = plain('#e22c76', { roughness: .7 });
  const wall = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .0005), pink); m.position.set(x, y, z); m.rotation.y = ry; tray.add(m); };
  const floor = new THREE.Mesh(new THREE.BoxGeometry(tw, .0005, td), [pink, pink, card(trayFloor), pink, pink, pink]); floor.position.y = .00025; tray.add(floor);
  wall(tw, th, 0, th / 2, td / 2, 0); wall(tw, th, 0, th / 2, -td / 2, 0); wall(td, th, -tw / 2, th / 2, 0, Math.PI / 2);
  const endW = new THREE.Mesh(new THREE.BoxGeometry(td, th, .0005), [pink, pink, pink, pink, card(trayEnd), pink]); endW.position.set(tw / 2, th / 2, 0); endW.rotation.y = Math.PI / 2; tray.add(endW);
  // 25 sticks with pink heads, heads toward the open end
  const N = 25, stick = new THREE.InstancedMesh(new THREE.BoxGeometry(tw * .84, .0021, .0021), plain('#e8d2a8', { roughness: .9 }), N);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(.0024, 10, 8), plain('#e22c76', { roughness: .55 }), N);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), sh = new THREE.Vector3(1.35, .95, 1);
  for (let i = 0; i < N; i++) {
    const row = i % 9, layer = Math.floor(i / 9), z = -td / 2 + .0022 + row * (td - .0044) / 8, y = .0016 + layer * .0021, j = (Math.random() - .5) * .0006;
    q.setFromEuler(new THREE.Euler(0, (Math.random() - .5) * .03, 0));
    M.compose(new THREE.Vector3(0, y, z + j), q, s); stick.setMatrixAt(i, M);
    M.compose(new THREE.Vector3(tw * .42 * (i % 2 ? 1 : -1), y, z + j), q, sh); head.setMatrixAt(i, M);
  }
  tray.add(stick, head);
  return shadowy(g);
}

// ---------------- Playable: kraft hanger box (hook + handle slot), white logo front, red logo back ----------------
async function playable(base) {
  // v3: hanger box 300 x 240 x 50 mm (388 mm with hook), outline from his dieline; gussets, base and swing tag from master faces
  const d = await json(base + 'playable/v3_dims.json'), P = `${base}playable/v3_`;
  const [front, back, sSize, sCare, baseT, tagF, tagB] = await Promise.all(['front', 'back', 'side_size', 'side_care', 'base', 'tag_front', 'tag_back'].map(n => tex(P + n + '.png')));
  const W = d.w / 1000, H = d.h / 1000, B = d.body / 1000, T = d.depth / 1000;
  const toShape = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => { const X = (x - .5) * W, Y = (1 - y) * H; i ? s.lineTo(X, Y) : s.moveTo(X, Y); }); return s; };
  const y0 = 1 - B / H;                                     // body top, in the art's 0..1 (down) space
  const kraft = plain('#ab7c5a', { roughness: .9 }), none = new THREE.MeshBasicMaterial({ visible: false });
  const g = new THREE.Group();
  const caps = (shape, zf, zb) => {
    const geo = new THREE.ShapeGeometry(shape), uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / W + .5, p.getY(i) / H);
    const f = new THREE.Mesh(geo, card(front, { roughness: .85 })); f.position.z = zf + .0002;
    const bk = new THREE.Mesh(geo, card(back, { roughness: .85 })); bk.position.z = zb - .0002; bk.rotation.y = Math.PI; g.add(f, bk);
  };
  // the body: 50 mm deep
  const body = toShape([[0, y0], [0, 1], [1, 1], [1, y0]]);
  const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(body, { depth: T, bevelEnabled: false }), [none, kraft]); bm.position.z = -T / 2; g.add(bm); caps(body, T / 2, -T / 2);
  // shoulders + hook: the two boards glued together, 4 mm thick
  const top = toShape(d.outline.map(([x, y]) => [x, Math.min(y, y0 + .002)])); top.holes.push(new THREE.Path(toShape(d.slot).getPoints()));
  const tt = .004, tm = new THREE.Mesh(new THREE.ExtrudeGeometry(top, { depth: tt, bevelEnabled: false, curveSegments: 4 }), [none, kraft]); tm.position.z = -tt / 2; g.add(tm); caps(top, tt / 2, -tt / 2);
  // the body's top: kraft lids sloping in under the shoulders
  const lidM = new THREE.Mesh(new THREE.PlaneGeometry(W, T), kraft); lidM.rotation.x = -Math.PI / 2; lidM.position.y = B + .0001; g.add(lidM);
  const gus = (t, x, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(T, B), card(t, { roughness: .85 })); m.position.set(x, B / 2, 0); m.rotation.y = ry; g.add(m); };
  gus(sCare, W / 2 + .0003, Math.PI / 2); gus(sSize, -W / 2 - .0003, -Math.PI / 2);
  const bs = new THREE.Mesh(new THREE.PlaneGeometry(W, T), card(baseT, { roughness: .85 })); bs.rotation.x = Math.PI / 2; bs.position.y = -.0002; g.add(bs);
  // the red swing tag on a cotton string from the hook
  const tw = .05, th = .09, tag = new THREE.Group();
  const tf = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), card(tagF, { alphaTest: .5, roughness: .7 })); tf.position.z = .0003;
  const tb = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), card(tagB, { alphaTest: .5, roughness: .7 })); tb.rotation.y = Math.PI; tb.position.z = -.0003;
  tag.add(tf, tb); tag.position.set(W * .16, H - .2, T / 2 + .005); tag.rotation.set(0, -.25, .12); g.add(tag);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.0005, .0005, .095, 6), plain('#f2ece0'));
  str.position.set(W * .1, H - .115, T / 4 + .003); str.rotation.set(-.45, 0, .5); g.add(str);
  return shadowy(g);
}

// ---------------- Donut Protocol: open display tray (donuts printed on the floor, Donuts header at the back) ----------------
async function donut(base, open = false, laid = false) {
  // v3: 280 x 170 x 80 mm tray box + standing DonutS header; lid = doors under the pink seal, welcome card on top
  const P = `${base}donut/v3_`;
  const [header, seal, card_, inside, lidIn, front, back, left, right, bottomT] = await Promise.all(['header', 'lid_seal', 'welcome_card', 'inside', 'lid_inside', 'front', 'back', 'left', 'right', 'bottom'].map(n => tex(P + n + '.png')));
  const W = .28, D = .17, H = .08, brown = plain('#74563c', { roughness: .8 });
  const g = new THREE.Group();
  const T = .0015, edgeM = plain('#d9cbb8', { roughness: .9 });             // 1.5 mm board: every wall and the lid have a real edge
  const panel = (w, h, map, x, y, z, ry, inner = brown) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, T), [edgeM, edgeM, edgeM, edgeM, card(map), inner]); o.position.set(x, y, z); o.rotation.y = ry; g.add(o);
  };
  panel(W, H, front, 0, H / 2, D / 2, 0); panel(W, H, back, 0, H / 2, -D / 2, Math.PI);
  panel(D, H, left, -W / 2, H / 2, 0, -Math.PI / 2); panel(D, H, right, W / 2, H / 2, 0, Math.PI / 2);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), card(inside)); fl.rotation.x = -Math.PI / 2; fl.position.y = .0008; g.add(fl);
  const un = new THREE.Mesh(new THREE.PlaneGeometry(W, D), card(bottomT)); un.rotation.x = Math.PI / 2; g.add(un);
  // the header stands up behind the back wall
  const ha = header.image.height / header.image.width, hd = new THREE.Mesh(new THREE.PlaneGeometry(W, W * ha), card(header, { alphaTest: .5, side: THREE.DoubleSide }));
  hd.position.set(0, W * ha / 2, -D / 2 - .003); g.add(hd);
  // the lid: sealed doors on top, 'protocol complete' inside
  const lid = new THREE.Group();
  const lt = new THREE.Mesh(new THREE.BoxGeometry(W + .003, T, D + .003), [edgeM, edgeM, card(seal), card(lidIn), edgeM, edgeM]); lt.position.y = T / 2; lid.add(lt);
  const ca = card_.image.height / card_.image.width, cw = W * .36;
  const wc = new THREE.Mesh(new THREE.PlaneGeometry(cw, cw * ca), card(card_, { alphaTest: .5, side: THREE.DoubleSide })); wc.rotation.set(-Math.PI / 2, 0, .12);
  if (open && laid) {                                                     // real life: the lid set down on the table beside the box
    lid.position.set(W * 1.02, 0, .03); lid.rotation.y = -.12; g.add(lid);
    wc.position.set(W * .62, .001, D * .78); wc.rotation.set(-Math.PI / 2, 0, .3); g.add(wc);
  } else if (open) {
    lid.position.set(0, H + .2, -.06); lid.rotation.x = .38; g.add(lid);
    wc.position.set(W * .62, .001, D * .55); wc.rotation.set(-Math.PI / 2, 0, -.3); g.add(wc);
  } else {
    lid.position.y = H; g.add(lid);
  }
  return shadowy(g);
}

// ---------------- Kazaar: matte black bottle (label unrolled from his photos) + its box ----------------
async function kazaar(base) {
  const d = await json(base + 'kazaar/dims.json');
  const [label, bf, bs] = await Promise.all(['label', 'box_front', 'box_side'].map(n => tex(`${base}kazaar/${n}.png`)));
  const r = .036, black = `rgb(${d.black.join(',')})`;
  const mBlack = new THREE.MeshPhysicalMaterial({ color: black, roughness: .45, metalness: .3, clearcoat: .35, clearcoatRoughness: .4 });
  const prof = d.profile.map(([y, rr]) => [y * r, rr * r]);
  const total = prof[prof.length - 1][0];
  const g = new THREE.Group();
  // the shape: a lathe from the measured profile (y down from the cap -> up from the base)
  const pts = prof.map(([y, rr]) => new THREE.Vector2(Math.max(rr, .0001), total - y)).reverse();
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), mBlack); g.add(bottle);
  // the printed band: a cylinder just over the body, carrying the unrolled label (front of the photo faces +z)
  const [ly0, ly1] = d.label.map(v => v * r);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.003, r * 1.003, ly1 - ly0, 128, 1, true),
    new THREE.MeshPhysicalMaterial({ map: label, roughness: .5, metalness: .1, clearcoat: .3, clearcoatRoughness: .45 }));
  band.position.y = total - (ly0 + ly1) / 2; band.rotation.y = Math.PI; g.add(band);
  // the box: square section, front + sides straightened from his mockup
  const bw = .1, bh = bw * bf.image.height / bf.image.width * .5;
  const boxH = total * .78, boxW = boxH * bf.image.width / bf.image.height;
  const plainB = plain('#121212', { roughness: .6 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(boxW, boxH, boxW, 3, .0015),
    [card(bs, { roughness: .55 }), card(bs, { roughness: .55 }), plainB, plainB, card(bf, { roughness: .5 }), card(bs, { roughness: .55 })]);
  box.position.set(-r - boxW / 2 - .035, boxH / 2, -.03); box.rotation.y = .22; g.add(box);
  bottle.position.x = band.position.x = .02;
  return shadowy(g);
}

// ---------------- Kazaar v2, real size: 750 ml bottle (75 mm x 306 mm) wearing his vector label; gift box 95 x 95 x 310 mm ----------------
async function kazaarBottle(base) {
  const d = await json(base + 'kazaar/dims.json'), v = await json(base + 'kazaar/v2.json');
  const label = await tex(base + 'kazaar/v2_label_wrap.jpg');
  const R = v.r / 1000, Htot = v.h / 1000;
  const k = Htot / d.profile[d.profile.length - 1][0];                  // his bottle silhouette, scaled to 306 mm tall
  const kr = R / 1.0;                                                     // body radius = 1.0 in the profile
  const pts = d.profile.map(([y, rr]) => new THREE.Vector2(Math.max(rr * kr, .0001), Htot - y * k)).reverse();
  const g = new THREE.Group();
  const glassBlack = new THREE.MeshPhysicalMaterial({ color: '#0b0a08', roughness: .32, metalness: .15, clearcoat: .8, clearcoatRoughness: .18 });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 128), glassBlack));
  // the closure: the lathe's mouth is open, so seat a matte black screw cap with a gold band on the neck
  const top = pts.reduce((a, b) => b.y > a.y ? b : a), capR = Math.max(top.x, .011) * 1.12, capH = .03;
  const capM = new THREE.MeshPhysicalMaterial({ color: '#0a0907', roughness: .55, metalness: .1, clearcoat: .3 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(capR, capR, capH, 64), capM); cap.position.y = top.y - capH / 2 + .006; g.add(cap);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(capR * 1.01, capR * 1.01, .003, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#aa8800', metalness: .9, roughness: .3 }));
  ring.position.y = top.y - capH + .009; g.add(ring);
  // the label: 150 mm tall, its foot 22 mm above the base; the rhino panel faces the front (+z)
  label.wrapS = THREE.RepeatWrapping; label.offset.x = v.front_u - .0; label.repeat.x = 1;
  label.offset.x = v.front_u;                                             // u=0 faces +z: shift so the front panel's centre sits there
  const LH = v.label_h / 1000;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.002, R * 1.002, LH, 192, 1, true),
    new THREE.MeshPhysicalMaterial({ map: label, roughness: .62, metalness: 0, clearcoat: .25, clearcoatRoughness: .5 }));
  band.position.y = .030 + LH / 2; g.add(band);
  return g;
}
async function kazaar2(base) {
  const g = new THREE.Group(); const bottle = await kazaarBottle(base);
  const f = await Promise.all(['right', 'left', 'top', 'bottom', 'front', 'back'].map(n => tex(`${base}kazaar/v2_box_${n}.jpg`)));
  const box = new THREE.Mesh(new RoundedBoxGeometry(.095, .31, .095, 3, .001), f.map(t => card(t, { roughness: .5 })));
  box.position.set(-.068, .155, -.04); box.rotation.y = .32;
  bottle.position.set(.055, 0, .03); bottle.rotation.y = -.25;
  g.add(box, bottle); return shadowy(g);
}
const kazaarHero = async base => shadowy(await kazaarBottle(base));
// open box: the tuck lid lifted and tilted, the bottle rising out (about 45% clear of the box)
async function kazaarOpen(base) {
  const g = new THREE.Group(); const bottle = await kazaarBottle(base);
  const f = await Promise.all(['right', 'left', 'top', 'bottom', 'front', 'back'].map(n => tex(`${base}kazaar/v2_box_${n}.jpg`)));
  const inside = plain('#0d0b08', { roughness: .85, side: THREE.BackSide });
  const W = .095, H = .31, t = .0012;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(W, H, W), [card(f[0]), card(f[1]), new THREE.MeshBasicMaterial({ visible: false }), card(f[3]), card(f[4]), card(f[5])]);
  walls.position.y = H / 2;
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * t, H - t, W - 2 * t), [inside, inside, new THREE.MeshBasicMaterial({ visible: false }), inside, inside, inside]);
  inner.position.y = H / 2 + t / 2;
  const box = new THREE.Group(); box.add(walls, inner); box.rotation.y = .38; box.position.set(-.02, 0, 0);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W, .003, W), [plain('#0d0b08'), plain('#0d0b08'), card(f[2]), plain('#0d0b08'), plain('#0d0b08'), plain('#0d0b08')]);
  lid.position.set(-.07, H + .085, -.03); lid.rotation.set(.55, .5, -.38);
  // exploded view: the bottle levitates fully clear of the open box, the lid floats above its cap, all slightly tilted
  bottle.position.set(-.02, H + .07, .0); bottle.rotation.set(0, .1, -.06);
  lid.position.set(-.03, H + .07 + .306 + .06, -.01); lid.rotation.set(.32, .5, .18);
  g.add(box, bottle, lid); return shadowy(g);
}

const BUILD = { altura, altura_tag: alturaTag, cheese, cheese_open: b => cheese(b, true), matches, playable, donut, donut_open: b => donut(b, true), donut_laid: b => donut(b, true, true), kazaar: kazaar2, kazaar_bottle: kazaarHero, kazaar_open: kazaarOpen };
export const PRODUCTS = {
  altura: { name: 'altura', sub: 'mountain dip tea' },
  altura_tag: { name: 'altura', sub: 'mountain dip tag' },
  cheese: { name: 'eleftheria', sub: 'cheese factory' },
  cheese_open: { name: 'eleftheria', sub: 'cheese factory' },
  matches: { name: 'misty matches', sub: '25 sticks' },
  playable: { name: 'playable', sub: 'clothing · hanger box' },
  donut: { name: 'donut protocol', sub: 'observe donut' },
  donut_open: { name: 'donut protocol', sub: 'observe donut' },
  donut_laid: { name: 'donut protocol', sub: 'observe donut' },
  kazaar: { name: 'kazaar', sub: 'monsoon gin · distilled in assam' },
  kazaar_bottle: { name: 'kazaar', sub: 'monsoon gin · distilled in assam' },
  kazaar_open: { name: 'kazaar', sub: 'monsoon gin · distilled in assam' },
};
export async function buildProduct(id, renderer, base = '') {
  ANISO = renderer.capabilities.getMaxAnisotropy();
  const g = await BUILD[id](base);
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3());
  g.position.x -= c.x; g.position.z -= c.z; g.position.y -= b.min.y;
  const wrap = new THREE.Group(); wrap.add(g); return wrap;
}
