/* =========================================================
   MATERIALS: dark modern stone, red velvet, round arches
   All generated in code (no downloads), tileable, with normal + roughness maps.
   ========================================================= */
import * as THREE from 'three';

/* ---------- periodic value noise (tiles seamlessly) ---------- */
function makeNoise(seed) {
  const P = 256, g = new Float32Array(P * P);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < g.length; i++) { s = (s * 9301 + 49297) % 233280; g[i] = s / 233280; }
  return (x, y, period) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = n => ((n % period) + period) % period;
    const at = (a, b) => g[m(a) * P + m(b)];
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(noise, x, y, base, oct) {
  let f = 0, amp = .5, fr = base;
  for (let o = 0; o < oct; o++) { f += amp * noise(x * fr, y * fr, fr); amp *= .5; fr *= 2; }
  return f;
}

/* ---------- stone: color, roughness and normal maps from one height field ---------- */
const stoneCache = {};
function stoneMaps(kind) {
  if (stoneCache[kind]) return stoneCache[kind];
  const S = 512, n1 = makeNoise(kind === 'floor' ? 7 : 3), n2 = makeNoise(kind === 'floor' ? 11 : 5);
  const H = new Float32Array(S * S), col = new Uint8ClampedArray(S * S * 4), rough = new Uint8ClampedArray(S * S * 4);
  const panels = kind === 'floor' ? 2 : 2;            // panel joints per tile
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = y * S + x;
    const big = fbm(n1, u, v, 4, 5), fine = n2(u * 128, v * 128, 128);
    // faint marble veining
    const warp = fbm(n2, u, v, 3, 4);
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 3 + v * 1.4 + warp * 2.6) * Math.PI)), 26);
    // panel joints
    const pu = (u * panels) % 1, pv = (v * panels) % 1;
    const joint = Math.min(pu, 1 - pu, pv, 1 - pv) < .004 ? 1 : 0;
    const panelTone = n1(Math.floor(u * panels) * 7.3, Math.floor(v * panels) * 3.1, 256) * .12;
    const h = big * .8 + fine * .2 - joint * .6;
    H[i] = h;
    const base = kind === 'floor' ? 14 : 22;
    const c = base + big * 22 + fine * 6 + panelTone * 40 + vein * (kind === 'floor' ? 34 : 26) - joint * 14;
    col[i * 4] = c * 1.06; col[i * 4 + 1] = c * .93; col[i * 4 + 2] = c * .9; col[i * 4 + 3] = 255;
    const r = (kind === 'floor' ? 70 : 150) + (1 - big) * 60 + joint * 120 - vein * 40;
    rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r; rough[i * 4 + 3] = 255;
  }
  // normal map from the height field (Sobel)
  const nor = new Uint8ClampedArray(S * S * 4), at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
  const k = kind === 'floor' ? 2.2 : 3.4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    const len = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    nor[i] = (-dx / len * .5 + .5) * 255; nor[i + 1] = (dy / len * .5 + .5) * 255; nor[i + 2] = (1 / len * .5 + .5) * 255; nor[i + 3] = 255;
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  };
  return (stoneCache[kind] = { map: tex(col, true), roughnessMap: tex(rough, false), normalMap: tex(nor, false) });
}

/* a stone material; rx/ry = how many tiles across the surface */
export function stone(kind = 'wall', rx = 1, ry = 1, extra = {}) {
  const m = stoneMaps(kind);
  const rep = t => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({
    map: rep(m.map), roughnessMap: rep(m.roughnessMap), normalMap: rep(m.normalMap),
    normalScale: new THREE.Vector2(kind === 'floor' ? .5 : .9, kind === 'floor' ? .5 : .9),
    roughness: 1, metalness: kind === 'floor' ? .25 : .05, ...extra,
  });
}

/* ---------- red velvet: real sheen, glowing in the folds ---------- */
export function velvet(tone = '#3c0607') {
  return new THREE.MeshPhysicalMaterial({
    color: tone, roughness: .92, metalness: 0,
    sheen: 1, sheenRoughness: .32, sheenColor: new THREE.Color('#ff4232'),
    side: THREE.DoubleSide,
  });
}

/* a hanging drape: deep vertical folds, gathered a little at the top */
export function curtainGeometry(w, h, folds = 7, depth = .16) {
  const g = new THREE.PlaneGeometry(w, h, Math.max(48, folds * 16), 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = (y / h) + .5;        // 0 bottom → 1 top
    const ph = (x / w + .5) * folds * Math.PI * 2;
    const z = Math.sin(ph) * depth * (.75 + .25 * Math.sin(ph * .37 + 1.3)) + Math.sin(ph * 2.1) * depth * .18;
    p.setZ(i, z * (1 - t * .35));
    p.setX(i, x * (1 - t * .06));                                  // slightly gathered at the rail
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- round museum arch: opening path + stone surround ---------- */
export function archPath(w, h, path = new THREE.Path()) {
  const r = w / 2;
  path.moveTo(-r, 0); path.lineTo(-r, h - r); path.absarc(0, h - r, r, Math.PI, 0, true); path.lineTo(r, 0); path.lineTo(-r, 0);
  return path;
}
export function archSurround(w, h, border, depth) {
  const W = w / 2 + border, s = new THREE.Shape();
  s.moveTo(-W, 0); s.lineTo(W, 0); s.lineTo(W, h + border); s.lineTo(-W, h + border); s.lineTo(-W, 0);
  s.holes.push(archPath(w, h));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 64 });
  // world-ish UVs so the stone is not stretched (1 tile ≈ 4 m)
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
  return g;
}
/* the thin red light line that traces the inside of the arch */
export function archCurve(w, h, inset = .06) {
  const r = w / 2 - inset, pts = [];
  pts.push(new THREE.Vector3(-r, 0, 0), new THREE.Vector3(-r, h - w / 2, 0));
  for (let i = 1; i < 40; i++) { const a = Math.PI - i / 40 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * r, h - w / 2 + Math.sin(a) * r, 0)); }
  pts.push(new THREE.Vector3(r, h - w / 2, 0), new THREE.Vector3(r, 0, 0));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

/* ---------- a tube that tapers along its length (for living veins) ---------- */
export function taperedTube(curve, segs, r0, r1, radial = 10) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position, uv = g.attributes.uv, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i); curve.getPointAt(Math.min(1, u), c);
    v.fromBufferAttribute(p, i).sub(c);
    const r = r0 + (r1 - r0) * Math.pow(u, .8);
    v.multiplyScalar(r).add(c); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
