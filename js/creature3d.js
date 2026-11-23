/* =========================================================
   THE ONE ANIMAL: butterfly → cocoon → worm (and back), live 3D
   Shared by the museum (your cursor, the ring) and CenterPiece (its worm),
   so it is the same creature everywhere: never swapped for a film or a drawing.
   ========================================================= */
import * as THREE from 'three';

const C01 = v => Math.max(0, Math.min(1, v)), sm = t => { t = C01(t); return t * t * (3 - 2 * t); }, lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = C01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const rgb = h => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
export const WORM_N = 34;
export const TEAL = [.2, .89, 1];                     // CenterPiece's first room colour: hsl(188, 100%, 60%)
export const hslRgb = (h, s = 1, l = .6) => { h = ((h % 360) + 360) % 360 / 360; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; };
// fat with what it ate at the head, thinning to a point at the tail; it breathes along its length
export const wormProfile = (t, now) => Math.pow(1 - t, .6) * (.86 + .14 * Math.sin(t * 10 - now / 240)) + .06;
// the cocoon's outline, top (where it hangs) to bottom: pointed at both ends, fullest a third of the way down
export const cocoonR = s => .19 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(C01(s), .8))), .75) * (1 - .25 * s);

/* ---------- shading: one light set for everything, in view space ---------- */
const VARY = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;`;
const VS = `${VARY}
void main(){ vUv = uv;
#ifdef USE_INSTANCING
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
#else
  vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal);
#endif
  vV = projectionMatrix[2][3] == 0. ? vec3(0., 0., 1.) : normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv; }`;
const FSH = lin => `${VARY}
#define OUT(c) ${lin ? 'pow(max(c, vec3(0.)), vec3(2.2))' : 'c'}
vec3 lit(vec3 base, vec3 N, vec3 V, float gloss, float spec){
  vec3 L1 = normalize(vec3(-.45, .6, .68)), L2 = normalize(vec3(.55, -.4, .5));
  vec3 c = base * (.3 + .8 * max(dot(N, L1), 0.) + .22 * max(dot(N, L2), 0.));
  c += vec3(pow(max(dot(N, normalize(L1 + V)), 0.), gloss) * spec + pow(max(dot(N, normalize(L2 + V)), 0.), gloss * .5) * spec * .25);
  return c; }
`;
const mat = (fs, uniforms, o = {}) => new THREE.ShaderMaterial({ vertexShader: o.vs || VS, fragmentShader: fs, uniforms, transparent: true, side: o.side ?? THREE.FrontSide,
  depthWrite: o.depthWrite ?? true, blending: o.blending ?? THREE.NormalBlending, toneMapped: false });
const glossFS = lin => FSH(lin) + `uniform vec3 uCol; uniform float uFade, uGloss, uSpec;
void main(){ vec3 N = normalize(vN) * (gl_FrontFacing ? 1. : -1.); gl_FragColor = vec4(OUT(lit(uCol, N, normalize(vV), uGloss, uSpec)), uFade); }`;
const gloss = (hex, lin, fade, gl = 40, sp = .5) => mat(glossFS(lin), { uCol: { value: rgb(hex) }, uFade: fade, uGloss: { value: gl }, uSpec: { value: sp } }, { side: THREE.DoubleSide });
const noCull = o => { o.traverse(c => { c.frustumCulled = false; }); return o; };

/* =========================================================
   THE WORM: CenterPiece's own (dark gloss, its room's glow at the edges, stripes of what it ate,
   white eyes with pink pupils, a toothy mouth when it chews, a splayed bristle tail), as a real tube
   ========================================================= */
export class Worm3D {
  constructor({ low = false, linear = false } = {}) {
    const n = this.n = WORM_N, R = this.R = low ? 10 : 16, R1 = R + 1, nv = n * R1;
    this.group = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    this.P = new Float32Array(nv * 3); this.Nm = new Float32Array(nv * 3); this.Cn = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2), idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j <= R; j++) { const k = i * R1 + j; uv[k * 2] = i / (n - 1); uv[k * 2 + 1] = j / R; }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < R; j++) { const a = i * R1 + j, b = a + 1, c = a + R1, d = c + 1; idx.push(a, c, b, b, c, d); }
    geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(this.P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(this.Nm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aCen', new THREE.BufferAttribute(this.Cn, 3)); this.geo = geo;
    this.palTex = new THREE.DataTexture(new Uint8Array(64), 16, 1); this.palTex.needsUpdate = true; this.palKey = '';
    const U = this.U = { uPal: { value: this.palTex }, uPalN: { value: 0 }, uHue: { value: new THREE.Vector3(...TEAL) }, uTime: { value: 0 }, uFade: { value: 1 }, uGlow: { value: 1 },
      uStripe: { value: 1 }, uInfl: { value: .5 }, uOff: { value: new THREE.Vector2() }, uShadow: { value: 0 } };
    const bodyFS = FSH(linear) + `uniform sampler2D uPal; uniform float uPalN, uTime, uFade, uGlow, uStripe; uniform vec3 uHue;
float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){ vec3 N = normalize(vN), V = normalize(vV); float t = vUv.x, th = vUv.y * 6.28318;
  vec3 base = vec3(.047, .039, .039);
  if (uStripe > .5) {
    float up = cos(th);
    if (uPalN > .5 && up > 0.) {                       // everything it has eaten runs down it in brush strokes of colour
      float K = uPalN, sg = floor(t * 33.);
      float x = sin(th) * .5 + .5 + sin(t * 23. + uTime * 3.3) * .03;
      float k = clamp(floor(x * K), 0., K - 1.), f = fract(x * K);
      float br = 1. - smoothstep(.55, 1., t) * step(h1(floor(t * 11.) * 7. + k * 3.), .45);
      float a = .85 * smoothstep(0., .35, up) * br * smoothstep(0., .22, f) * smoothstep(1., .78, f) * (1. - t * .45);
      base = mix(base, texture2D(uPal, vec2((k + .5) / 16., .5)).rgb, a);
    }
    float fs = fract(t * 17.);
    base *= .58 + .42 * smoothstep(.0, .22, fs) * smoothstep(1., .78, fs);       // soft rings between its segments
    base *= .9 + .2 * sin(fs * 3.14159);                                           // each segment a little plump in the middle
  }
  vec3 c = lit(base, N, V, 52., .6);
  vec3 L1 = normalize(vec3(-.45, .6, .68));
  c += vec3(pow(max(dot(N, normalize(L1 + V)), 0.), 150.)) * (.55 + .45 * sin(t * 19. - uTime * 2.6)) * .9;   // wet: a sharp sheen that slides along it
  c += uHue * pow(1. - max(dot(N, V), 0.), 2.4) * .95 * uGlow;                   // its glow, brightest at the edges
  if (uStripe > .5 && t > .06 && t < .86) {                                      // a row of little breathing spots along each side, in its room's colour
    float thw = th > 3.14159 ? th - 6.28318 : th, fs2 = fract(t * 17.) - .5;
    float d = length(vec2(fs2 * 1.1, (abs(thw) - 1.2) * .9));
    c += uHue * smoothstep(.17, .07, d) * (.55 + .45 * sin(uTime * 3. - t * 9.)) * 1.3 * uGlow;
  }
  gl_FragColor = vec4(OUT(c), uFade); }`;
    const haloVS = `uniform float uInfl; attribute vec3 aCen; ${VARY}
void main(){ vUv = uv; vec3 p = aCen + (position - aCen) * (1. + uInfl); vec4 mv = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * normal);
  vV = projectionMatrix[2][3] == 0. ? vec3(0., 0., 1.) : normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
    const haloFS = FSH(linear) + `uniform vec3 uHue; uniform float uGlow, uFade;
void main(){ float f = pow(clamp(-dot(normalize(vN), normalize(vV)), 0., 1.), 1.6); gl_FragColor = vec4(OUT(uHue), f * uGlow * .55 * uFade); }`;
    const shVS = `uniform vec2 uOff; attribute vec3 aCen; varying float vA;
void main(){ vec3 p = aCen + (position - aCen) * 1.12; p.z = 0.; p.xy += uOff; vA = max(normal.z, 0.); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`;
    const shFS = `uniform float uShadow, uFade; varying float vA; void main(){ gl_FragColor = vec4(0., 0., 0., pow(vA, 1.5) * uShadow * uFade); }`;
    this.shadow = new THREE.Mesh(geo, mat(shFS, U, { vs: shVS, depthWrite: false })); this.shadow.renderOrder = -1;
    this.halo = new THREE.Mesh(geo, mat(haloFS, U, { vs: haloVS, side: THREE.BackSide, depthWrite: false })); this.halo.renderOrder = -.5;
    this.body = new THREE.Mesh(geo, mat(bodyFS, U));
    // head, eyes, mouth, tail
    const sg = new THREE.SphereGeometry(1, low ? 18 : 28, low ? 12 : 20); sg.setAttribute('aCen', new THREE.BufferAttribute(new Float32Array(sg.attributes.position.count * 3), 3));
    this.head = new THREE.Group();
    this.headMesh = new THREE.Mesh(sg, mat(bodyFS, { ...U, uStripe: { value: 0 } }));
    this.headHalo = new THREE.Mesh(sg, mat(haloFS, U, { vs: haloVS, side: THREE.BackSide, depthWrite: false })); this.headHalo.renderOrder = -.5;
    this.head.add(this.headMesh, this.headHalo);
    const white = gloss('#f6efe2', linear, U.uFade, 70, .8), pink = gloss('#ff5fb8', linear, U.uFade, 70, .8);
    const lidM = gloss('#1c1515', linear, U.uFade, 50, .55);
    this.eyes = [-1, 1].map(s => { const e = new THREE.Mesh(sg, white), p = new THREE.Mesh(sg, pink), l = new THREE.Mesh(sg, lidM); this.head.add(e, p, l); return [e, p, s, l]; });
    // two small jaws at the front that open sideways and chew; a bite of colour between them while it eats
    const jawG = new THREE.ConeGeometry(1, 1, 8); jawG.translate(0, .5, 0);
    this.jaws = [-1, 1].map(s => { const j = new THREE.Mesh(jawG, gloss('#7a3a24', linear, U.uFade, 60, .8)); this.head.add(j); return [j, s]; });
    this.biteU = { uCol: { value: new THREE.Vector3(1, .4, .3) }, uFade: U.uFade, uGloss: { value: 40 }, uSpec: { value: .5 } };
    this.bite = new THREE.Mesh(sg, mat(glossFS(linear), this.biteU)); this.head.add(this.bite);
    // stubby legs underneath that ripple as it crawls, and fine hairs along its sides
    const legG = new THREE.CapsuleGeometry(.5, 1, 2, 6); legG.translate(0, 1, 0);
    this.legs = new THREE.InstancedMesh(legG, gloss('#120e0d', linear, U.uFade, 30, .35), 24);
    this.hairs = low ? null : new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 3).translate(0, .5, 0), gloss('#8a807a', linear, U.uFade, 20, .3), 36);
    this.legPh = 0; this.lastHead = null; this.lastNow = 0; this.blinkAt = 1500; this.blinkK = 0;
    this.bristles = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), gloss('#0c0a0a', linear, U.uFade, 30, .4), 3);
    this.group.add(this.shadow, this.halo, this.legs, this.body, this.head, this.bristles); if (this.hairs) this.group.add(this.hairs); noCull(this.group);
    this._Q = Array.from({ length: n }, () => [0, 0]); this._r = new Float32Array(n);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  setPal(pal) {
    const key = pal.map(c => c.join(',')).join('|'); if (key === this.palKey) return; this.palKey = key;
    const d = this.palTex.image.data; d.fill(0); pal.slice(-16).forEach((c, k) => { d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; d[k * 4 + 3] = 255; });
    this.U.uPalN.value = Math.min(16, pal.length); this.palTex.needsUpdate = true;
  }
  /* pts: its spine, head first (any count ≥ 2), in the group's plane (y up). o.rad: radius at the head. */
  update(pts, o = {}) {
    const n = this.n, R = this.R, R1 = R + 1, now = o.now ?? performance.now(), fade = o.fade ?? 1, U = this.U;
    this.group.visible = fade > .003 && pts && pts.length > 1; if (!this.group.visible) return;
    U.uFade.value = fade; U.uTime.value = now / 1000; U.uGlow.value = o.glow ?? 1;
    if (o.hue) U.uHue.value.set(o.hue[0], o.hue[1], o.hue[2]);
    this.setPal(o.pal || []);
    const Q = this._Q, m = pts.length;
    if (m === n) for (let i = 0; i < n; i++) { Q[i][0] = pts[i][0]; Q[i][1] = pts[i][1]; }
    else for (let i = 0; i < n; i++) { const u = i / (n - 1) * (m - 1), k = Math.min(m - 2, Math.floor(u)), q = u - k; Q[i][0] = lerp(pts[k][0], pts[k + 1][0], q); Q[i][1] = lerp(pts[k][1], pts[k + 1][1], q); }
    const rad = o.rad ?? 10, lift = o.lift ?? 1, P = this.P, Nm = this.Nm, Cn = this.Cn, r = this._r;
    for (let i = 0; i < n; i++) r[i] = rad * wormProfile(i / (n - 1), now);
    for (let i = 0; i < n; i++) {
      const a = Q[Math.max(0, i - 1)], b = Q[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const sx = -ty, sy = tx, cx = Q[i][0], cy = Q[i][1], cz = r[i] * lift;
      for (let j = 0; j <= R; j++) { const th = j / R * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), k = (i * R1 + j) * 3, nx = sx * s, ny = sy * s;
        Nm[k] = nx; Nm[k + 1] = ny; Nm[k + 2] = c; P[k] = cx + nx * r[i]; P[k + 1] = cy + ny * r[i]; P[k + 2] = cz + c * r[i]; Cn[k] = cx; Cn[k + 1] = cy; Cn[k + 2] = cz; }
    }
    const A = this.geo.attributes; A.position.needsUpdate = A.normal.needsUpdate = A.aCen.needsUpdate = true;
    U.uShadow.value = o.shadow ?? 0; U.uOff.value.set(rad * .3, -rad * .6);
    // head: a glossy blob turned the way it is going
    const h = Q[0], h3 = Q[3]; let fx = h[0] - h3[0], fy = h[1] - h3[1]; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    const hr = r[1] * 1.25; let look = o.look ?? 0;
    const dtw = this.lastNow ? Math.min(.05, Math.max(0, (now - this.lastNow) / 1000)) : .016; this.lastNow = now;
    const hm = this.lastHead ? Math.hypot(h[0] - this.lastHead[0], h[1] - this.lastHead[1]) / Math.max(1e-6, rad) : 0; this.lastHead = [h[0], h[1]];
    const moving = Math.min(1, hm / Math.max(.001, dtw) * .25);
    if (o.lookAt) { const ang = Math.atan2(o.lookAt[1] - h[1], o.lookAt[0] - h[0]) - Math.atan2(fy, fx); look = Math.max(-1, Math.min(1, Math.sin(ang) * 1.3)); }
    // a blink every few seconds; half-shut when it sleeps
    this.blinkAt -= dtw * 1000; if (this.blinkAt < 0) { this.blinkK = 1; this.blinkAt = 1800 + Math.random() * 3500; }
    this.blinkK = Math.max(0, this.blinkK - dtw * 6.5);
    const shut = Math.max(Math.sin(this.blinkK * Math.PI), o.sleepy ?? 0), open = 1 - shut * .92;
    this.head.position.set(h[0] + fx * hr * .15, h[1] + fy * hr * .15, r[0] * lift); this.head.rotation.set(0, 0, Math.atan2(fy, fx));
    this.headMesh.scale.set(hr * 1.15, hr, hr * .9); this.headHalo.scale.copy(this.headMesh.scale);
    for (const [e, p, s, l] of this.eyes) { l.visible = shut > .55; l.position.set(hr * .3, s * hr * .42, hr * .72); l.scale.set(hr * .28, hr * .22, hr * .2 * Math.min(1, shut));   // closed lids: soft dark bumps
      e.visible = shut < .9; e.position.set(hr * .3, s * hr * .42, hr * .7); e.scale.set(hr * .26 * open, hr * .2, hr * .2);
      p.position.set(hr * (.4 + .03 * Math.abs(look)) - (1 - open) * hr * .06, s * hr * .42 + look * hr * .08, hr * .84); p.scale.set(hr * .11 * Math.max(.05, open), hr * .11, hr * .11 * Math.max(.3, open)); p.visible = open > .25; }
    const mo = o.chew ?? 0, M = this._m, V = this._v, S = this._s, q = this._q, E = this._e;
    this.headMesh.scale.y *= 1 + .1 * mo; this.headHalo.scale.copy(this.headMesh.scale);   // cheeks bulge with each bite
    for (const [j, s] of this.jaws) { const a = .35 + mo * .55; j.position.set(hr * 1.12, s * hr * (.24 + .14 * mo), hr * .32); j.rotation.set(0, 0, -Math.PI / 2 + s * (a - .5)); j.scale.set(hr * .13, hr * .42, hr * .1); }
    this.bite.visible = mo > .05 && (o.pal || []).length > 0;
    if (this.bite.visible) { const c = o.pal[o.pal.length - 1]; this.biteU.uCol.value.set(c[0] / 255, c[1] / 255, c[2] / 255); this.bite.position.set(hr * 1.32, 0, hr * .42); this.bite.scale.setScalar(hr * (.08 + .1 * mo)); }
    this.legPh += dtw * (1.5 + 16 * moving);
    for (let k = 0; k < 12; k++) { const i = Math.min(n - 3, 5 + k * 2), a = Q[i - 1], b = Q[i + 1], ta = Math.atan2(b[1] - a[1], b[0] - a[0]);   // body runs head→tail: ta points tailward
      for (const sd of [-1, 1]) { const w = Math.sin(this.legPh - k * .75) * (.25 + .45 * moving), ang = ta + sd * (Math.PI / 2 + w * .6) ;
        M.compose(V.set(Q[i][0] - Math.sin(ta) * sd * r[i] * .62, Q[i][1] + Math.cos(ta) * sd * r[i] * .62, r[i] * lift * .2), q.setFromEuler(E.set(0, 0, ang - Math.PI / 2)), S.set(r[i] * .26, r[i] * .2, r[i] * .26));
        this.legs.setMatrixAt(k * 2 + (sd > 0 ? 1 : 0), M); } }
    this.legs.instanceMatrix.needsUpdate = true;
    if (this.hairs) { for (let k = 0; k < 18; k++) { const i = Math.min(n - 2, 3 + Math.round(k * 1.6)), a = Q[i - 1], b = Q[i + 1], ta = Math.atan2(b[1] - a[1], b[0] - a[0]);
        for (const sd of [-1, 1]) { const sway = Math.sin(now / 260 + k * .9 + sd) * .18, ang = ta + sd * (Math.PI / 2 - .55) + sway;
          M.compose(V.set(Q[i][0] - Math.sin(ta) * sd * r[i] * .92, Q[i][1] + Math.cos(ta) * sd * r[i] * .92, r[i] * lift * .9), q.setFromEuler(E.set(0, 0, ang - Math.PI / 2)), S.set(r[i] * .035, r[i] * .7, r[i] * .035));
          this.hairs.setMatrixAt(k * 2 + (sd > 0 ? 1 : 0), M); } }
      this.hairs.instanceMatrix.needsUpdate = true; }
    const t1 = Q[n - 1], t2 = Q[n - 4], ba = Math.atan2(t1[1] - t2[1], t1[0] - t2[0]), bl = rad * .85;
    [-.35, 0, .3].forEach((s, k) => { const a = ba + s; M.compose(V.set(t1[0] + Math.cos(a) * bl * .5, t1[1] + Math.sin(a) * bl * .5, r[n - 1] * lift), q.setFromEuler(E.set(0, 0, a - Math.PI / 2)), S.set(rad * .05, bl, rad * .05)); this.bristles.setMatrixAt(k, M); });
    this.bristles.instanceMatrix.needsUpdate = true;
  }
}

/* a worm's body that follows its head (as CenterPiece's does) */
export class WormSim {
  constructor(n = WORM_N) { this.n = n; this.p = Array.from({ length: n }, () => [0, 0]); }
  lay(x, y, ang, sp) { for (let i = 0; i < this.n; i++) { this.p[i][0] = x - Math.cos(ang) * sp * i; this.p[i][1] = y - Math.sin(ang) * sp * i; } }
  copy(P) { for (let i = 0; i < this.n; i++) { const q = P[Math.min(P.length - 1, i)]; this.p[i][0] = q[0]; this.p[i][1] = q[1]; } }
  rescale(f) { const h = this.p[0]; for (let i = 1; i < this.n; i++) { this.p[i][0] = h[0] + (this.p[i][0] - h[0]) * f; this.p[i][1] = h[1] + (this.p[i][1] - h[1]) * f; } }
  step(tx, ty, dt, speed, sp, now, wig = 1) {
    const h = this.p[0], dx = tx - h[0], dy = ty - h[1], d = Math.hypot(dx, dy);
    if (d > 1e-6) { const v = Math.min(d, speed * dt), ux = dx / d, uy = dy / d, w = Math.sin(now / 130) * Math.min(1, d / (sp * 3)) * sp * wig * dt * 4; h[0] += ux * v - uy * w; h[1] += uy * v + ux * w; }
    for (let i = 1; i < this.n; i++) { const a = this.p[i - 1], b = this.p[i], ex = a[0] - b[0], ey = a[1] - b[1], l = Math.hypot(ex, ey); if (l > sp) { b[0] += ex * (1 - sp / l); b[1] += ey * (1 - sp / l); } }
  }
  hang(x, k) { for (let i = 1; i < this.n; i++) this.p[i][0] += (x - this.p[i][0]) * k * (i / this.n); }   // let the body fall straight below its head
}

/* =========================================================
   THE BUTTERFLY: a Red Admiral (the Blender wings: top + underside), wings that really fold
   ========================================================= */
export class Butterfly3D {
  constructor(tex, { linear = false } = {}) {
    const g = this.group = new THREE.Group(), roll = this.rollG = new THREE.Group(); g.add(roll);
    const U = this.U = { uTex: { value: tex }, uFade: { value: 1 }, uBend: { value: 0 }, uOff: { value: new THREE.Vector2(6, -10) }, uFloor: { value: -900 }, uShadow: { value: .22 } };
    const wg = new THREE.PlaneGeometry(1, 1, 10, 6); wg.translate(.47, 0, 0);   // the wing's root (left, middle of the picture) on the body
    const wingVS = `uniform float uBend; ${VARY}
void main(){ vUv = uv; vec3 p = position; float x = max(p.x, 0.); p.z += uBend * x * x * .45; vec4 mv = modelViewMatrix * vec4(p, 1.);
  vN = normalize(normalMatrix * normalize(vec3(-uBend * x * .9, 0., 1.))); vV = projectionMatrix[2][3] == 0. ? vec3(0., 0., 1.) : normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
    const wingFS = FSH(linear) + `uniform sampler2D uTex; uniform float uFade;
void main(){ bool fr = gl_FrontFacing; vec4 c = texture2D(uTex, vec2(vUv.x * .5 + (fr ? 0. : .5), vUv.y)); if (c.a < .5) discard;
  vec3 N = normalize(vN) * (fr ? 1. : -1.), V = normalize(vV), L = normalize(vec3(-.45, .6, .68));
  vec3 col = c.rgb * (.62 + .5 * max(dot(N, L), 0.)) + vec3(pow(max(dot(N, normalize(L + V)), 0.), 24.) * .1);
  gl_FragColor = vec4(OUT(col), uFade); }`;
    const shVS = `uniform float uBend, uFloor; uniform vec2 uOff; varying vec2 vUv;
void main(){ vUv = uv; vec3 p = position; float x = max(p.x, 0.); p.z += uBend * x * x * .45; vec4 w = modelMatrix * vec4(p, 1.); w.xy += uOff; w.z = uFloor; gl_Position = projectionMatrix * viewMatrix * w; }`;
    const shFS = `uniform sampler2D uTex; uniform float uFade, uShadow; varying vec2 vUv; void main(){ if (texture2D(uTex, vec2(vUv.x * .5, vUv.y)).a < .5) discard; gl_FragColor = vec4(0., 0., 0., uShadow * uFade); }`;
    const wm = mat(wingFS, U, { vs: wingVS, side: THREE.DoubleSide }), sh = mat(shFS, U, { vs: shVS, side: THREE.DoubleSide, depthWrite: false });
    this.piv = [1, -1].map(s => { const p = new THREE.Group(), w = new THREE.Mesh(wg, wm), d = new THREE.Mesh(wg, sh); w.scale.x = s; d.scale.x = s; w.renderOrder = 1; d.renderOrder = -2; p.add(w, d); roll.add(p); return { p, w, d, s }; });
    // body: thorax, abdomen, head with big dark eyes, white-tipped antennae
    const fur = gloss('#1f1612', linear, U.uFade, 14, .16), eye = gloss('#3b1c14', linear, U.uFade, 60, .7), tip = gloss('#d8d0c2', linear, U.uFade, 30, .3);
    const sph = new THREE.SphereGeometry(1, 16, 12);
    const abd = new THREE.Mesh(new THREE.LatheGeometry([[0, -.52], [.018, -.5], [.034, -.44], [.045, -.33], [.048, -.2], [.044, -.08], [.03, -.02], [0, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 14), fur);
    const thx = new THREE.Mesh(sph, fur); thx.scale.set(.066, .13, .062); thx.position.y = .04;
    const hd = new THREE.Mesh(sph, fur); hd.scale.setScalar(.05); hd.position.y = .17;
    roll.add(abd, thx, hd);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(sph, eye); e.scale.setScalar(.028); e.position.set(s * .032, .18, .018); roll.add(e);
      const an = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(s * .02, .2, .01), new THREE.Vector3(s * .06, .36, .03), new THREE.Vector3(s * .12, .54, .05)]), 12, .0055, 5), fur);
      const cl = new THREE.Mesh(sph, tip); cl.scale.set(.016, .024, .016); cl.position.set(s * .12, .55, .05); roll.add(an, cl);
    }
    noCull(g); abd.renderOrder = thx.renderOrder = hd.renderOrder = 1;
  }
  pose(o) {
    const g = this.group, fade = o.fade ?? 1; g.visible = fade > .003;
    g.position.set(o.x, o.y, o.z ?? 0); g.rotation.set(0, 0, o.heading ?? 0); g.scale.setScalar(Math.max(1e-4, o.scale));
    this.rollG.rotation.set(o.pitch ?? 0, o.roll ?? 0, 0);
    const th = o.flap ?? 0, tk = o.tuck ?? 0, ws = o.wingScale ?? 1;
    for (const { p, w, d, s } of this.piv) { p.rotation.set(0, -s * th, -s * tk); w.scale.set(s * ws, ws, ws); d.scale.copy(w.scale); }
    this.U.uFade.value = fade; this.U.uBend.value = o.bend ?? 0; this.U.uShadow.value = o.shadow ?? .22;
    if (o.shadowOff) this.U.uOff.value.set(o.shadowOff[0], o.shadowOff[1]);
  }
}

/* =========================================================
   THE COCOON: spun silk wound round it from the top down, lit from inside; it cracks along a ragged line
   ========================================================= */
export class Cocoon3D {
  constructor({ low = false, linear = false } = {}) {
    this.group = new THREE.Group(); this.body = new THREE.Group(); this.group.add(this.body);   // the top (where it hangs) at the origin, hanging down; scale = its length
    const pts = []; for (let i = 0; i < 48; i++) { const s = i / 47; pts.push(new THREE.Vector2(i === 0 || i === 47 ? 0 : Math.max(.004, cocoonR(s)), -s)); }
    const geo = new THREE.LatheGeometry(pts, low ? 28 : 48);
    const U = this.U = { uWrap: { value: 1 }, uGlow: { value: 0 }, uCrack: { value: 0 }, uCrackY: { value: .8 }, uCapTop: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 }, uCapFade: { value: 1 } };
    const fs = FSH(linear) + `uniform float uWrap, uGlow, uCrack, uCrackY, uCapTop, uPart, uTime, uFade, uCapFade;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){ float u = vUv.x, s = vUv.y;
  float th = smoothstep(s - .02, s + .14, uWrap * 1.16);                         // spun from the top down: thin and see-through at the growing edge
  if (th < .02) discard;
  float yc = uCrackY + .022 * sin(u * 43.98) + .012 * sin(u * 81.7 + 1.3);       // a ragged crack all the way round
  if (uCrack > 0.) { float above = step(s, yc), keep = uCapTop > .5 ? 1. - above : above; if (uPart > .5) keep = 1. - keep; if (keep < .5) discard; }
  else if (uPart > .5) discard;
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1. : -1.), V = normalize(vV);
  float f1 = sin(u * 31.4 + s * 70.), f2 = sin(-u * 25.1 + s * 52. + 1.7), f3 = sin(u * 69.1 + s * 23.);
  float fib = .5 + .5 * max(max(f1, f2), f3 * .6); fib = .55 + .45 * fib;                                 // fibres wound round it, crossing
  vec3 silk = mix(vec3(.84, .79, .70), vec3(.97, .95, .89), fib) * (.86 + .14 * smoothstep(0., .25, s));
  silk = mix(silk, vec3(.86, .67, .26), step(.986, hh(floor(vec2(u * 60., s * 34.)))) * .8);   // a few gold flecks
  vec3 c = gl_FrontFacing ? lit(silk, N, V, 20., .18) : silk * .32 * vec3(1., .82, .66);       // inside: warm and dim
  float thin = max(dot(N, V), 0.);
  c += vec3(1., .78, .5) * uGlow * .55 * (.2 + .8 * thin) * (.7 + .3 * fib);         // the light inside, through the silk
  c += vec3(1., .78, .45) * exp(-abs(s - yc) * 70.) * uCrack * 1.6;               // and pouring out of the crack
  gl_FragColor = vec4(OUT(c), uFade * th * (uPart > .5 ? uCapFade : 1.)); }`;
    this.main = new THREE.Mesh(geo, mat(fs, { ...U, uPart: { value: 0 } }, { side: THREE.DoubleSide }));
    this.capPiv = new THREE.Group(); this.cap = new THREE.Mesh(geo, mat(fs, { ...U, uPart: { value: 1 } }, { side: THREE.DoubleSide })); this.capPiv.add(this.cap);
    this.main.renderOrder = this.cap.renderOrder = 2; this.body.add(this.main, this.capPiv);
    const silkFS = FSH(linear) + `uniform float uFade, uA; void main(){ vec3 N = normalize(vN) * (gl_FrontFacing ? 1. : -1.); gl_FragColor = vec4(OUT(lit(vec3(.93, .9, .84), N, normalize(vV), 30., .55)), uFade * uA); }`;
    this.silkU = { uFade: U.uFade, uA: { value: 1 } }; this.silkMat = mat(silkFS, this.silkU, { side: THREE.DoubleSide });
    this.helix = [[13, 1, 0], [10, -1, 2.1], [16, 1, 4.2]].slice(0, low ? 2 : 3).map(([tn, dir, ph]) => {
      const cp = []; for (let i = 0; i <= 160; i++) { const s = .02 + i / 160 * .96, r = cocoonR(s) * 1.05 + .006, a = ph + dir * s * tn * Math.PI * 2; cp.push(new THREE.Vector3(Math.cos(a) * r, -s, Math.sin(a) * r)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), low ? 260 : 420, .003, 4, false), this.silkMat); m.renderOrder = 3; this.body.add(m); return m; });
    const pad = new THREE.Mesh(new THREE.SphereGeometry(.024, 12, 8), this.silkMat); pad.scale.y = .7; pad.renderOrder = 3; this.body.add(pad);
    noCull(this.group); this.setHinge(.8, false);
  }
  setHinge(y, top) { this.capTop = top; const hx = cocoonR(y), hy = -y; this.hinge = [hx, hy]; this.capPiv.position.set(hx, hy, 0); this.cap.position.set(-hx, -hy, 0); this.U.uCrackY.value = y; this.U.uCapTop.value = top ? 1 : 0; }
  reset() { this.set({ wrap: 0, spin: 0, glow: 0, crack: 0, fade: 1, capFade: 1, capOpen: 0, capDrop: 0, silkA: 1, sway: 0, breathe: 0 }); this.group.visible = true; }
  set(o) {
    const U = this.U;
    if (o.wrap != null) U.uWrap.value = o.wrap; if (o.glow != null) U.uGlow.value = o.glow; if (o.crack != null) U.uCrack.value = o.crack;
    if (o.fade != null) U.uFade.value = o.fade; if (o.capFade != null) U.uCapFade.value = o.capFade; if (o.silkA != null) this.silkU.uA.value = o.silkA;
    if (o.spin != null) for (const m of this.helix) { const c = m.geometry.index.count; m.geometry.setDrawRange(0, Math.floor(c * C01(o.spin) / 3) * 3); m.visible = o.spin > .001; }
    if (o.sway != null) this.body.rotation.z = o.sway;
    if (o.breathe != null) { this.main.scale.set(1 + o.breathe, 1, 1 + o.breathe); this.cap.scale.copy(this.main.scale); }
    if (o.capOpen != null || o.capDrop != null) { const op = o.capOpen ?? 0, dr = o.capDrop ?? 0, [hx, hy] = this.hinge;
      if (this.capTop) { this.capPiv.rotation.z = -op * 1.7; this.capPiv.position.set(hx + dr * .35, hy + dr * .45, 0); }
      else { this.capPiv.rotation.z = op * 1.4; this.capPiv.position.set(hx + dr * .1, hy - dr * .7, 0); } }
  }
}

/* a thread of silk between two points */
class Thread {
  constructor(linear) { this.U = { uCol: { value: rgb('#efe9dd') }, uFade: { value: 1 }, uGloss: { value: 30 }, uSpec: { value: .5 } };
    this.m = noCull(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), mat(glossFS(linear), this.U, { side: THREE.DoubleSide }))); this.m.renderOrder = 3; this.m.visible = false; }
  set(ax, ay, bx, by, r, a = 1) { const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-6; this.m.position.set((ax + bx) / 2, (ay + by) / 2, 0); this.m.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2); this.m.scale.set(r, l, r); this.U.uFade.value = a; this.m.visible = a > .003; }
}

/* =========================================================
   THE LAYER: a see-through 3D canvas over the page, in screen pixels (y up inside: scene y = -screen y).
   `ring` is a group that sits on the museum's ring (centre, radius = 1) when a ring is given.
   ========================================================= */
export function createCreatureLayer({ inside = null, after = null, z = 62, worm = true, butterfly = true, wings = 'assets/creature/wings.webp' } = {}) {
  let renderer; const canvas = document.createElement('canvas');
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' }); } catch (e) { return { ok: false }; }
  let low = false;
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'), s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; low = /intel|swiftshader|basic render|llvmpipe|mali|adreno \(tm\) [1-5]/i.test(s) && !/\barc\b/i.test(s); } catch (e) {}
  renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0, 0);
  canvas.style.cssText = `position:${inside ? 'absolute' : 'fixed'};left:0;top:0;width:100%;height:100%;pointer-events:none;${inside ? '' : `z-index:${z};`}`;
  if (after) after.after(canvas); else (inside || document.body).append(canvas);
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000), ring = new THREE.Group(); scene.add(ring);
  const L = { ok: true, low, canvas, renderer, scene, cam, ring, w: 1, h: 1, hooks: new Set(), ringFn: null, texReady: !butterfly };
  const size = () => { const r = inside ? inside.getBoundingClientRect() : { width: innerWidth, height: innerHeight }; L.w = Math.max(1, r.width); L.h = Math.max(1, r.height);
    renderer.setSize(L.w, L.h, false); cam.right = L.w; cam.bottom = -L.h; cam.updateProjectionMatrix(); };
  size(); addEventListener('resize', size); if (inside && window.ResizeObserver) new ResizeObserver(size).observe(inside);
  const parts = [];
  if (worm) { L.worm = new Worm3D({ low }); scene.add(L.worm.group); parts.push(L.worm.group); }
  if (butterfly) {
    const tex = new THREE.TextureLoader().load(wings, () => { L.texReady = true; }); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
    L.butterfly = new Butterfly3D(tex); L.cocoon = new Cocoon3D({ low }); L.thread = new Thread(false);
    scene.add(L.butterfly.group, L.cocoon.group, L.thread.m); parts.push(L.butterfly.group, L.cocoon.group, L.thread.m);
  }
  // compile every shader now, so nothing stalls the first time it appears
  parts.forEach(p => { p.visible = true; }); try { renderer.compile(scene, cam); } catch (e) {} parts.forEach(p => { p.visible = false; });
  let last = performance.now(), drew = false;
  const loop = now => {
    if (window.__ngPaused) { last = now; requestAnimationFrame(loop); return; }   // (CenterPiece, while hidden behind the museum)
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
    if (L.ringFn) { const r = L.ringFn(); if (r) { ring.position.set(r[0], -r[1], 0); ring.scale.setScalar(Math.max(1e-3, r[2])); } }
    for (const f of [...L.hooks]) f(now, dt);
    if (L.focusAt && L.onFocus) L.onFocus(L.focusAt, dt);
    if (parts.some(p => p.visible)) { renderer.render(scene, cam); drew = true; } else if (drew) { renderer.clear(); drew = false; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  L.focusAt = null;   // where on the ring the light should fall (ring units), set by the stories
  L.syncRing = () => { if (L.ringFn) { const r = L.ringFn(); if (r) { ring.position.set(r[0], -r[1], 0); ring.scale.setScalar(Math.max(1e-3, r[2])); } } };
  L.tween = (ms, fn) => new Promise(res => { ms *= window.__cslow || 1; const t0 = performance.now(); let lt = t0; const h = now => { const s = Math.min(1, (now - t0) / ms), dt = Math.min(.05, Math.max(.001, (now - lt) / 1000)); lt = now; fn(s, now, dt); if (s >= 1) { L.hooks.delete(h); res(); } }; L.hooks.add(h); });
  if (butterfly) { L.enterStory = from => enterStory(L, from); L.leaveStory = o => leaveStory(L, o); }
  return L;
}

/* ---------- going in: your butterfly lands in the ring, is spun into a cocoon, and a worm comes out ---------- */
const WL = .3, LEN = .58, AY = .5, RIM = .965, CURSOR_PX = 32, WR = .038, WS = .0139;   // wing, cocoon length, where it hangs; the worm's radius and spacing in the cocoon
function enterStory(L, from) {
  const B = L.butterfly, C = L.cocoon, W = L.worm, T = L.thread, ring = L.ring, sim = new WormSim();
  let ph = 0, rad = WR, sp = WS, look = 0;
  const worm = (o = {}) => W.update(sim.p, { rad, look, lift: 0, glow: 1, hue: TEAL, shadow: 0, ...o });
  return {
    async run() {
      L.syncRing(); const R = ring.scale.x, rp = ring.position;
      const f = from || { x: rp.x + R * .8, y: -(rp.y + R * .9), heading: 0, scale: CURSOR_PX };
      const p0 = [(f.x - rp.x) / R, (-f.y - rp.y) / R], s0 = f.scale / R, tgt = [0, AY - .13], hang = [0, AY - .21];
      const c1 = [p0[0] * .35 + .4 * (p0[0] >= 0 ? 1 : -1), Math.max(p0[1], tgt[1]) + .4];
      let hx = p0[0], hy = p0[1], hd = f.heading || 0;
      ring.add(B.group, C.group, W.group, T.m); W.group.visible = false; C.group.visible = false;
      // it leaves your hand and flies into the circle; a silk line comes down from the top of the ring to meet it
      await L.tween(1500, (s, now, dt) => {
        const e = ease(s), u = 1 - e, nx = u * u * p0[0] + 2 * u * e * c1[0] + e * e * tgt[0], ny = u * u * p0[1] + 2 * u * e * c1[1] + e * e * tgt[1];
        if (Math.hypot(nx - hx, ny - hy) > 1e-5) hd += angD(Math.atan2(ny - hy, nx - hx) - Math.PI / 2, hd) * .16; hx = nx; hy = ny;
        ph += dt * 24;
        L.focusAt = [hx, hy];
        B.pose({ x: hx + Math.sin(now / 170) * .006, y: hy, heading: hd * (1 - sm((s - .7) / .3)), flap: .2 + .55 * (.5 + .5 * Math.sin(ph)), bend: Math.cos(ph) * .25,
          scale: lerp(s0, WL, ease(s)), shadow: .16, shadowOff: [5, -8] });
        T.set(0, RIM, 0, lerp(RIM, tgt[1] + .05, sm((s - .15) / .7)), .004);
      });
      // it lands on the end of the line, turns side-on and folds its wings shut
      await L.tween(900, (s, now, dt) => {
        ph += dt * lerp(24, 5, s); const k = sm((s - .25) / .75); L.focusAt = [0, hang[1]];
        B.pose({ x: 0, y: lerp(tgt[1], hang[1], ease(Math.min(1, s * 1.6))), heading: 0, flap: lerp(.2 + .55 * (.5 + .5 * Math.sin(ph)), 1.45, k), roll: -Math.PI / 2 * sm((s - .3) / .7), scale: WL, shadow: .16 * (1 - s) });
        T.set(0, RIM, 0, lerp(tgt[1] + .05, hang[1] + .045, s), .004);
      });
      // silk winds round it from the top down; inside, its wings shrink and fold away along its body
      C.group.position.set(0, AY, 0); C.group.scale.setScalar(LEN); C.setHinge(.8, false); C.reset(); L.focusAt = [0, AY - LEN * .45];
      await L.tween(2600, (s, now) => {
        C.set({ spin: ease(s), wrap: sm((s - .08) / .85), glow: .15 * s, sway: Math.sin(now / 700) * .03 * (1 - s) });
        const k = sm(s / .7);
        B.pose({ x: 0, y: hang[1] - .008 * Math.sin(now / 110) * (1 - s), heading: 0, flap: 1.45, roll: -Math.PI / 2, scale: WL * lerp(1, .85, s), wingScale: lerp(1, .38, k), tuck: 1.5 * k, shadow: 0 });
      });
      B.group.visible = false;
      // it rests; the cocoon breathes, lit from inside like a heartbeat
      await L.tween(1100, (s, now) => { const beat = Math.pow(Math.max(0, Math.sin(s * Math.PI * 2 - .3)), 3);
        C.set({ glow: .2 + .7 * beat, silkA: lerp(1, .2, s), breathe: .035 * beat, sway: Math.sin(now / 900) * .02 }); });
      // a ragged crack opens round its lower end, light pouring out
      await L.tween(800, (s, now) => C.set({ crack: sm(s), glow: .5 + .4 * s, sway: Math.sin(now / 40) * .012 * s }));
      // the end drops away and a worm's head pushes out, and looks round
      sim.lay(0, AY - .8 * LEN + .012, -Math.PI / 2, sp); W.group.visible = true;
      await L.tween(1300, (s, now, dt) => {
        C.set({ crack: 1, glow: lerp(.9, .4, s), capOpen: ease(Math.min(1, s * 1.6)), capDrop: s * s, capFade: 1 - sm((s - .4) / .6), sway: Math.sin(now / 600) * .015 });
        sim.step(Math.sin(now / 300) * .02 * sm(s * 2 - 1), lerp(AY - .8 * LEN + .012, AY - .8 * LEN - .09, ease(Math.min(1, s * 1.5))), dt, .25, sp, now, .3);
        look = Math.sin(s * Math.PI * 2.5) * sm(s * 3 - .5); worm(); L.focusAt = [sim.p[0][0], sim.p[0][1] + .08];
      });
      // it crawls out and down over the ring; the empty shell and its thread fade away
      const a = [sim.p[0][0], sim.p[0][1]], b = [a[0], a[1] - .22], c = [.32, -.3], d = [.1, -.5];
      await L.tween(1800, (s, now, dt) => {
        const t = ease(s), u = 1 - t, tx = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], ty = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
        sim.step(tx, ty, dt, .6, sp, now, 1); rad = lerp(WR, WR * 1.15, s); look *= .9; worm(); L.focusAt = [sim.p[4][0], sim.p[4][1]];
        C.set({ fade: 1 - sm((s - .5) / .5), glow: .4 * (1 - s), sway: Math.sin(now / 600) * .015 }); T.set(0, RIM, 0, hang[1] + .045, .004, 1 - sm((s - .45) / .55));
      });
      C.group.visible = false; T.m.visible = false;
    },
    headRing() { return sim.p[0]; },
    // through the liquid surface: the worm leaves the ring for the screen, crawling to where CenterPiece's worm will be
    portal(ms, tx, ty, radT, spT) {
      const r = ring, toS = p => { p[0] = r.position.x + p[0] * r.scale.x; p[1] = r.position.y + p[1] * r.scale.y; };
      sim.p.forEach(toS); rad *= r.scale.x; sp *= r.scale.x; L.scene.add(W.group);
      const rad0 = rad, sp0 = sp, T2 = [tx, -ty];
      return L.tween(ms, (s, now, dt) => { const k = ease(s), nsp = lerp(sp0, spT, k); sim.rescale(nsp / sp); sp = nsp; rad = lerp(rad0, radT, k);
        const h = sim.p[0], dd = Math.hypot(T2[0] - h[0], T2[1] - h[1]); sim.step(T2[0], T2[1], dt, Math.max(60, dd / Math.max(.06, (1 - s) * ms / 1000)), sp, now, .5);
        worm({ lift: k, shadow: .3 * k }); });
    },
    wormScreen() { return sim.p.map(p => [p[0], -p[1]]); },
    // CenterPiece's worm now lies exactly under this one: ride along on it until its page has settled, then let it go
    follow(get, ms) {
      return L.tween(ms, (s, now) => { const w = get && get(); if (w && w.pts) { sim.copy(w.pts.map(p => [p[0], -p[1]])); rad = .009 * w.rmW * w.g; } worm({ lift: 1, shadow: 0 }); })
        .then(() => { W.group.visible = false; });
    },
  };
}

/* ---------- coming back: CenterPiece's worm climbs up, is spun into a cocoon, and your butterfly comes out ---------- */
function leaveStory(L, { Rc }) {
  const B = L.butterfly, C = L.cocoon, W = L.worm, T = L.thread, ring = L.ring, sim = new WormSim();
  const Ls = LEN * Rc, Ax = L.w / 2, Ay = L.h / 2 - AY * Rc;   // where the cocoon will hang (its top), on screen: right where it will be on the ring
  let rad = 20, sp = 10, ph = 0;
  const worm = (o = {}) => W.update(sim.p, { rad, lift: 1, glow: 1, hue: TEAL, shadow: .3, ...o });
  return {
    takeFrom(w) {
      L.scene.add(W.group, C.group, T.m, B.group); W.group.position.set(0, 0, 0); W.group.scale.setScalar(1);
      if (w && w.pts) { sim.copy(w.pts.map(p => [p[0], -p[1]])); rad = .009 * w.rmW * w.g; sp = .0056 * Math.pow(w.g, .35) * w.rmW; }
      else { sp = .009 * L.w; rad = .03 * L.w; sim.lay(L.w / 2, -L.h * .6, Math.PI / 2, sp); }
      worm();
    },
    // it climbs up a line of silk let down from above
    climb(ms) {
      const tgt = [Ax, -(Ay + .1 * Ls)], h0 = sim.p[0], speed = Math.hypot(tgt[0] - h0[0], tgt[1] - h0[1]) / (ms / 1000) * 1.35;
      return L.tween(ms, (s, now, dt) => { sim.step(tgt[0], tgt[1], dt, speed, sp, now, 1); sim.hang(Ax + Math.sin(now / 500) * 4, (1 - Math.exp(-dt * 3)) * s);
        worm({ shadow: .3 * (1 - s), lift: 1 - s }); T.set(Ax, 40, Ax, lerp(40, sim.p[0][1], sm(s * 1.4)), 1.3); });
    },
    // it draws itself up small and silk winds round it
    spin(ms) {
      C.group.position.set(Ax, -Ay, 0); C.group.scale.setScalar(Ls); C.setHinge(.2, true); C.reset();
      const rad0 = rad, sp0 = sp, radC = WR / LEN * Ls, spC = WS / LEN * Ls;
      return L.tween(ms, (s, now, dt) => { const k = sm(s / .6), nsp = lerp(sp0, spC, k); sim.rescale(nsp / sp); sp = nsp; rad = lerp(rad0, radC, k); sim.hang(Ax, 1 - Math.exp(-dt * 6));
        worm({ shadow: 0, lift: 0 }); C.set({ spin: ease(s), wrap: sm((s - .1) / .85), glow: .15 * s, sway: Math.sin(now / 700) * .03 * (1 - s) }); T.set(Ax, 40, Ax, -Ay, 1.3); })
        .then(() => { W.group.visible = false; });
    },
    // it hangs there, glowing, while you come back out through the ring (the line now runs up to the ring's rim)
    hold(ms, rf) {
      return L.tween(ms, (s, now) => { const beat = Math.pow(Math.max(0, Math.sin(s * Math.PI * 3)), 3); C.set({ glow: .2 + .5 * beat, silkA: lerp(1, .4, s), breathe: .03 * beat, sway: Math.sin(now / 900) * .02 });
        const r = rf && rf(), top = r ? Math.max(-40, r[1] - RIM * r[2]) : -40; T.set(Ax, -top, Ax, -Ay, 1.3); });
    },
    toRing() { L.syncRing(); ring.attach(C.group); L.focusAt = [0, C.group.position.y - C.group.scale.x * .4]; ring.add(T.m); T.set(0, RIM, 0, C.group.position.y, .004); },
    // the top cracks off; your butterfly climbs out, its wings opening, and turns to you
    async hatch() {
      const A = C.group.position.y, S = C.group.scale.x; ring.add(B.group);
      await L.tween(900, (s, now) => { C.set({ crack: sm(s), glow: .5 + .4 * s, sway: Math.sin(now / 40) * .012 * s }); T.set(0, RIM, 0, A, .004); });
      await L.tween(1000, (s, now) => { C.set({ capOpen: ease(Math.min(1, s * 1.7)), capDrop: s * s, capFade: 1 - sm((s - .3) / .7), glow: lerp(.9, .5, s), sway: Math.sin(now / 600) * .012 });
        B.pose({ x: 0, y: lerp(A - .32 * S, A + .02, ease(s)), heading: 0, roll: -Math.PI / 2, flap: 1.45, tuck: 1.5, wingScale: .38, scale: WL * .85, shadow: 0 }); });
      await L.tween(1100, s => { const k = ease(s);
        B.pose({ x: 0, y: A + .02 + .04 * k, heading: 0, roll: -Math.PI / 2, flap: 1.45, tuck: lerp(1.5, .15, k), wingScale: lerp(.38, 1, k), scale: lerp(WL * .85, WL, k), shadow: 0 });
        C.set({ fade: 1 - .5 * s, glow: .5 * (1 - s) }); T.set(0, RIM, 0, A, .004, 1 - .5 * s); });
      await L.tween(800, (s, now, dt) => { ph += dt * lerp(4, 22, s); const k = ease(s);
        L.focusAt = [0, A + .08];
        B.pose({ x: 0, y: A + .06 + .02 * k, heading: 0, roll: lerp(-Math.PI / 2, 0, k), flap: lerp(1.45, .3 + .45 * (.5 + .5 * Math.sin(ph)), k), tuck: .15 * (1 - k), scale: WL, bend: Math.cos(ph) * .2 * k, shadow: 0 });
        C.set({ fade: .5 * (1 - s) }); T.set(0, RIM, 0, A, .004, .5 * (1 - s)); });
      C.group.visible = false; T.m.visible = false;
    },
    // and flies out of the ring to your hand, becoming your cursor again
    async flyOff(getMouse) {
      L.scene.attach(B.group); const p0 = [B.group.position.x, B.group.position.y], s0 = B.group.scale.x; let hd = 0, hx = p0[0], hy = p0[1];
      await L.tween(1300, (s, now, dt) => {
        const m = (getMouse && getMouse()) || [L.w * .62, L.h * .42], tx = m[0], ty = -m[1], e = ease(s), u = 1 - e, cx = (p0[0] + tx) / 2 + 140, cy = Math.max(p0[1], ty) + 170;
        const nx = u * u * p0[0] + 2 * u * e * cx + e * e * tx, ny = u * u * p0[1] + 2 * u * e * cy + e * e * ty;
        if (Math.hypot(nx - hx, ny - hy) > .5) hd += angD(Math.atan2(ny - hy, nx - hx) - Math.PI / 2, hd) * .2; hx = nx; hy = ny; ph += dt * 26;
        B.pose({ x: hx, y: hy, heading: hd * (1 - sm((s - .8) / .2)), flap: .25 + .6 * (.5 + .5 * Math.sin(ph)), bend: Math.cos(ph) * .25, scale: lerp(s0, CURSOR_PX, ease(s)), shadow: .22 * s, shadowOff: [6, -10] });
      });
      return { x: hx, y: -hy, heading: 0, scale: B.group.scale.x };
    },
  };
}

/* =========================================================
   AN EYE (CenterPiece Room 01): a glossy eyeball in real lids, sewn into the velvet. It looks where it is told,
   blinks on its own, and can close (o.shut) or open slowly (o.open)
   ========================================================= */
const EYE_VS = `${VARY} varying vec3 vO;
void main(){ vUv = uv; vO = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal);
  vV = projectionMatrix[2][3] == 0. ? vec3(0., 0., 1.) : normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
let EYE_KIT = null;
function eyeKit(low) {
  if (EYE_KIT) return EYE_KIT;
  const ballFS = FSH(false) + `varying vec3 vO; uniform vec3 uIris, uScl; uniform float uPupil, uFade, uWet, uIR;
float hh(float n){ return fract(sin(n) * 43758.5453); }
void main(){ vec3 p = normalize(vO), N = normalize(vN), V = normalize(vV);
  float th = acos(clamp(p.z, -1., 1.)), an = atan(p.y, p.x);
  vec3 scl = uScl - vec3(.04, .14, .14) * smoothstep(.5, 1.5, th);                        // the white, pinker toward the back
  float vein = pow(abs(sin(an * 7. + sin(th * 9. + an * 3.) * 1.4)), 60.) * smoothstep(.75, 1.45, th);
  scl = mix(scl, vec3(.6, .16, .12), vein * .45);
  float fib = .55 + .45 * sin(an * 46. + sin(an * 9.) * 2.3) * sin(an * 13. + th * 30.);
  vec3 iris = uIris * (.62 + .5 * fib) * (1. - .4 * smoothstep(uPupil + .2, uPupil, th)) + uIris * .45 * smoothstep(uIR - .2, uIR - .06, th) * (1. - smoothstep(uIR - .06, uIR, th));
  iris *= 1. - .6 * smoothstep(uIR - .09, uIR + .01, th);                                           // the dark ring at its edge
  vec3 col = mix(iris, scl, smoothstep(uIR - .01, uIR + .03, th));
  col = mix(vec3(.01), col, smoothstep(uPupil - .02, uPupil + .015, th));                            // the pupil
  vec3 c = lit(col, N, V, 90., .7);
  vec3 L1 = normalize(vec3(-.45, .6, .68)); c += vec3(pow(max(dot(N, normalize(L1 + V)), 0.), 420.)) * 1.6 * uWet;   // wet: a sharp window of light
  gl_FragColor = vec4(c, uFade); }`;
  const skinFS = FSH(false) + `varying vec3 vO; uniform float uFade, uEdge; uniform vec3 uSkin;
void main(){ vec3 N = normalize(vN) * (gl_FrontFacing ? 1. : -1.), V = normalize(vV);
  float e = uEdge < .5 ? vUv.y : 1. - vUv.y;                                                       // 0 at the lid's edge
  float cr = uEdge < .5 ? 1. - vUv.y : vUv.y; vec3 sk = uSkin * (.97 + .03 * sin(vO.y * 22. + vO.x * 5.)) * (.82 + .18 * smoothstep(.0, .5, e)) * (1. - .25 * smoothstep(.6, 1., cr));   // soft creases, shading toward the fold
  sk = mix(vec3(.55, .2, .18), sk, smoothstep(.02, .14, e));                                        // the wet pink rim
  sk = mix(vec3(.08, .04, .03), sk, smoothstep(.0, .03, e));                                        // the lash line
  gl_FragColor = vec4(lit(sk, N, V, 30., .35), uFade); }`;
  const rimFS = FSH(false) + `uniform float uFade, uFat; uniform vec3 uSkin; void main(){ vec3 N = normalize(vN), V = normalize(vV); vec3 L1 = normalize(vec3(-.45, .6, .68));
  vec3 c = uFat > .5 ? uSkin * (.78 + .32 * max(dot(N, L1), 0.)) + vec3(pow(max(dot(N, normalize(L1 + V)), 0.), 18.) * .08) : lit(uSkin * vec3(.7, .5, .48), N, V, 24., .25);   // fat: soft and matte, like the painting
  gl_FragColor = vec4(c, uFade); }`;
  const shFS = `varying vec2 vUv; uniform float uFade; void main(){ float d = length(vUv - .5) * 2.; gl_FragColor = vec4(.02, 0., 0., (1. - smoothstep(.45, 1., d)) * .7 * uFade); }`;
  const shVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  EYE_KIT = {
    ball: new THREE.SphereGeometry(1, low ? 28 : 44, low ? 18 : 30), up: new THREE.SphereGeometry(1.07, low ? 28 : 40, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    lo: new THREE.SphereGeometry(1.06, low ? 28 : 40, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), rim: new THREE.TorusGeometry(1.05, .11, 10, low ? 36 : 56), rimFat: new THREE.TorusGeometry(1.3, .32, 14, low ? 40 : 64), sh: new THREE.PlaneGeometry(3, 3),
    ballFS, skinFS, rimFS, shFS, shVS,
  };
  return EYE_KIT;
}
export class Eye3D {
  constructor({ iris = [.42, .62, .6], skin = [.6, .44, .38], low = false, fat = false, scl = [.86, .8, .72], wet = 1, almond = 1 } = {}) {
    const K = eyeKit(low), F = this.F = { value: 1 }, SK = new THREE.Vector3(...skin);
    const M = (fs, u, o = {}) => mat(fs, { uFade: F, ...u }, { vs: o.vs || EYE_VS, side: o.side, depthWrite: o.dw });
    this.group = new THREE.Group();
    this.shadow = new THREE.Mesh(K.sh, M(K.shFS, {}, { vs: K.shVS, dw: false })); this.shadow.position.set(.12, -.2, -1.2); this.shadow.renderOrder = -3;
    this.ball = new THREE.Mesh(K.ball, M(K.ballFS, { uIris: { value: new THREE.Vector3(...iris) }, uScl: { value: new THREE.Vector3(...scl) }, uWet: { value: wet }, uIR: { value: fat ? .66 : .5 }, uPupil: { value: fat ? .26 : .2 } })); this.ball.rotation.order = 'YXZ';
    this.up = new THREE.Mesh(K.up, M(K.skinFS, { uSkin: { value: SK }, uEdge: { value: 0 } }, { side: THREE.DoubleSide }));
    this.lo = new THREE.Mesh(K.lo, M(K.skinFS, { uSkin: { value: SK }, uEdge: { value: 1 } }, { side: THREE.DoubleSide }));
    this.rim = new THREE.Mesh(fat ? K.rimFat : K.rim, M(K.rimFS, { uSkin: { value: SK }, uFat: { value: fat ? 1 : 0 } })); if (fat) { this.rim.scale.set(almond, almond > 1.3 ? .74 : 1, .32); this.rim.position.z = -.25; } else { this.rim.scale.set(1.04, .98, .6); this.rim.position.z = -.25; }   // fat: a thick cream lid ring, as in the painting
    this.group.add(this.shadow, this.rim, this.ball, this.up, this.lo); noCull(this.group);
    this.blinkAt = 800 + Math.random() * 5000; this.bk = 0; this.lx = 0; this.ly = 0; this.openK = 1; this.fat = fat;
  }
  /* o: { x, y (scene px), r (px), look: [tx, ty] scene px or null, shut 0..1, open 0..1 (how awake), fade, dt, wide 0..1 } */
  update(o) {
    const g = this.group, dt = o.dt ?? .016; g.visible = (o.fade ?? 1) > .003; if (!g.visible) return;
    g.position.set(o.x, o.y, o.z ?? -400); g.scale.setScalar(o.r); this.F.value = o.fade ?? 1;
    if (o.look) { const dx = o.look[0] - o.x, dy = o.look[1] - o.y, D = 520 + o.r * 3; const lm = this.fat ? .26 : .55; this.lx += (Math.max(-lm, Math.min(lm, Math.atan2(dx, D))) - this.lx) * Math.min(1, dt * 7); this.ly += (Math.max(-lm * .8, Math.min(lm * .8, Math.atan2(dy, D))) - this.ly) * Math.min(1, dt * 7); }
    this.ball.rotation.set(-this.ly, this.lx, 0);
    this.blinkAt -= dt * 1000; if (this.blinkAt < 0) { this.bk = 1; this.blinkAt = 2200 + Math.random() * 6500; }
    this.bk = Math.max(0, this.bk - dt * 5.5);
    const blink = Math.sin(this.bk * Math.PI), shut = Math.max(blink, o.shut ?? 0, 1 - (o.open ?? 1)), wide = o.wide ?? 0;
    this.up.rotation.x = lerp((this.fat ? -1.12 : -.82) - wide * .25 - this.ly * .35, .14, shut);       // the upper lid follows the eye a little, and drops to close
    this.lo.rotation.x = lerp((this.fat ? .82 : .5) + wide * .15 - this.ly * .2, -.02, shut);
    this.ball.material.uniforms.uPupil.value = .2 + (o.dilate ?? 0) * .1;
  }
}
