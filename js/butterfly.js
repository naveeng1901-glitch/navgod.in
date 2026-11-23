/* =========================================================
   THE BUTTERFLY: what the worm grew into
   Black wings, glowing red veins, learns each work's colour.
   ========================================================= */
import * as THREE from 'three';

const RED = new THREE.Color('#ff2a1a');

/* ---------- wing shapes (y = forward): a Red Admiral, with scalloped margins ---------- */
function outline(segs) {
  // segs: [[p0,c1,c2,p1, scallopAmp, bumps], ...]  (cubic Béziers, scallops push outward)
  const pts = [];
  for (const [a, b, c, d, amp, bumps] of segs) {
    const cv = new THREE.CubicBezierCurve(new THREE.Vector2(...a), new THREE.Vector2(...b), new THREE.Vector2(...c), new THREE.Vector2(...d));
    const n = 40;
    for (let k = 0; k < n; k++) {
      const t = k / n, pt = cv.getPoint(t);
      if (amp) { const tg = cv.getTangent(t); pt.add(new THREE.Vector2(tg.y, -tg.x).multiplyScalar(amp * Math.abs(Math.sin(t * bumps * Math.PI)))); }
      pts.push(pt);
    }
  }
  return new THREE.Shape(pts);
}
function foreShape() {
  return outline([
    [[.02, .02], [.25, .38], [.6, .62], [.96, .56], 0, 0],          // leading edge to the apex
    [[.96, .56], [1.02, .4], [.86, .13], [.8, .0], .012, 9],        // outer margin, slightly hollow, scalloped
    [[.8, .0], [.6, -.08], [.3, -.09], [.07, -.06], 0, 0],          // trailing edge back to the body
  ]);
}
function hindShape() {
  return outline([
    [[.04, -.03], [.3, 0], [.55, -.05], [.62, -.16], 0, 0],
    [[.62, -.16], [.74, -.4], [.5, -.78], [.26, -.8], .02, 7],       // rounded, scalloped border
    [[.26, -.8], [.12, -.7], [.03, -.4], [.02, -.22], 0, 0],
  ]);
}

/* paint a wing like a real one: velvet scales, true venation, a red band, white spots */
function paintWing(shape, fore) {
  const pts = shape.getPoints(120);
  const b = new THREE.Box2().setFromPoints(pts);
  const W = 1024, Hh = 1024, sx = W / (b.max.x - b.min.x), sy = Hh / (b.max.y - b.min.y);
  const map = p => [(p.x - b.min.x) * sx, Hh - (p.y - b.min.y) * sy];
  const path = ctx => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = map(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
  const root = map(new THREE.Vector2(0.03, -0.01));
  const rnd = (() => { let s = fore ? 7 : 13; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  const lerp2 = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];

  // vein endpoints along the outer margin (not along the body edge)
  const outer = pts.filter((p, i) => { const k = i / pts.length; return fore ? k > .06 && k < .62 : k > .1 && k < .9; });
  const nV = fore ? 9 : 7, ends = [];
  for (let i = 0; i < nV; i++) ends.push(map(outer[Math.floor((i + .5) / nV * outer.length)]));
  const veinPath = (ctx, e, i) => {
    const mid = lerp2(root, e, .45), bend = (i - nV / 2) * 9;
    ctx.beginPath(); ctx.moveTo(root[0], root[1]);
    ctx.quadraticCurveTo(mid[0] + bend, mid[1] - bend * .6, e[0], e[1]); ctx.stroke();
  };

  /* ---------- colour ---------- */
  const base = document.createElement('canvas'); base.width = W; base.height = Hh;
  const c = base.getContext('2d');
  path(c); c.save(); c.clip();
  c.fillStyle = '#0a0505'; c.fillRect(0, 0, W, Hh);
  const g = c.createRadialGradient(root[0], root[1], 0, root[0], root[1], W * .62);
  g.addColorStop(0, 'rgba(92,22,14,.95)'); g.addColorStop(.35, 'rgba(40,10,7,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, Hh);
  // velvet scales: thousands of tiny strokes pointing away from the body
  for (let i = 0; i < 16000; i++) {
    const x = rnd() * W, y = rnd() * Hh, a = Math.atan2(y - root[1], x - root[0]), l = 3 + rnd() * 6;
    const v = rnd(); c.strokeStyle = v < .5 ? `rgba(0,0,0,${.15 + rnd() * .2})` : `rgba(${70 + rnd() * 50},${14 + rnd() * 12},${10 + rnd() * 8},${.06 + rnd() * .08})`;
    c.lineWidth = 1 + rnd(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  c.restore();

  /* ---------- mask: R = veins (glow), G = the red band (learns colours) ---------- */
  const mask = document.createElement('canvas'); mask.width = W; mask.height = Hh;
  const m = mask.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, W, Hh);
  path(m); m.save(); m.clip();
  // the red band
  const band = (ctx, style, widthK) => {
    ctx.strokeStyle = style; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // forewing: a diagonal band from the leading edge to the outer corner; hindwing: a border band
    const path = fore
      ? [[.4, .44], [.5, .36], [.62, .25], [.74, .12], [.8, .04]].map(([x, y]) => map(new THREE.Vector2(x, y)))
      : pts.filter((_, i) => { const k = i / pts.length; return k > .35 && k < .66; }).map(p => lerp2(map(p), root, .1));
    for (let k = 0; k < 26; k++) {
      ctx.lineWidth = W * widthK * (.55 + rnd() * .5);
      ctx.beginPath();
      path.forEach((p, i) => { i ? ctx.lineTo(p[0] + (rnd() - .5) * 16, p[1] + (rnd() - .5) * 16) : ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
    }
  };
  m.globalCompositeOperation = 'lighter'; band(m, 'rgba(0,26,0,1)', fore ? .085 : .06); m.globalCompositeOperation = 'source-over';
  // veins
  m.strokeStyle = '#f00'; m.lineCap = 'round';
  ends.forEach((e, i) => { m.lineWidth = i % 2 ? 2.4 : 3.4; veinPath(m, e, i); });
  // the discal cell: a closed loop of cross-veins
  m.lineWidth = 2.2; m.beginPath();
  ends.slice(1, nV - 1).forEach((e, i) => { const p = lerp2(root, e, .42 + Math.sin(i) * .03); i ? m.lineTo(p[0], p[1]) : m.moveTo(p[0], p[1]); }); m.stroke();
  // forks near the margin
  ends.forEach((e, i) => { if (i % 2) return; const s = lerp2(root, e, .78), n2 = ends[Math.min(nV - 1, i + 1)], f = lerp2(e, n2, .35);
    m.lineWidth = 1.6; m.beginPath(); m.moveTo(s[0], s[1]); m.lineTo(f[0], f[1]); m.stroke(); });
  m.lineWidth = 4; path(m); m.stroke();
  m.restore();

  // paint the same structure into the colour map: dark veins, a red band, white spots, a scalloped margin
  c.save(); path(c); c.clip();
  band(c, fore ? 'rgba(178,32,22,.07)' : 'rgba(160,28,20,.07)', fore ? .085 : .06);
  c.strokeStyle = 'rgba(0,0,0,.85)';
  ends.forEach((e, i) => { c.lineWidth = i % 2 ? 2 : 3; veinPath(c, e, i); });
  c.lineWidth = 26; c.strokeStyle = 'rgba(4,2,2,1)'; path(c); c.stroke();
  // pale fringe between the veins
  ends.forEach((e, i) => { const n2 = ends[i + 1]; if (!n2) return; const mid = lerp2(e, n2, .5), q = lerp2(mid, root, .025);
    c.fillStyle = 'rgba(232,218,200,.7)'; c.beginPath(); c.ellipse(q[0], q[1], 7, 4, Math.atan2(mid[1] - root[1], mid[0] - root[0]), 0, 7); c.fill(); });
  if (fore) {
    // white spots near the tip, like a red admiral
    for (const [x, y, r] of [[.8, .48, 20], [.87, .43, 16], [.72, .5, 14], [.91, .36, 12], [.65, .47, 11], [.6, .52, 9]]) {
      const q = map(new THREE.Vector2(x, y)); c.fillStyle = 'rgba(238,230,218,.92)'; c.beginPath(); c.ellipse(q[0], q[1], r, r * .7, -.6, 0, 7); c.fill();
    }
    const q = map(new THREE.Vector2(.94, .5)); c.fillStyle = 'rgba(90,120,170,.5)'; c.beginPath(); c.arc(q[0], q[1], 7, 0, 7); c.fill();
  } else {
    // black dots inside the red border band + an eyespot (a nod to the CenterPiece gate)
    ends.forEach((e, i) => { if (!i || i === nV - 1) return; const p = lerp2(root, e, .84);
      c.fillStyle = 'rgba(0,0,0,.9)'; c.beginPath(); c.arc(p[0], p[1], 9, 0, 7); c.fill(); });
    const bl = map(new THREE.Vector2(.3, -.72));
    c.fillStyle = 'rgba(70,110,170,.85)'; c.beginPath(); c.ellipse(bl[0], bl[1], 16, 10, .4, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.9)'; c.beginPath(); c.arc(bl[0], bl[1], 5, 0, 7); c.fill();
  }
  c.restore();

  const under = document.createElement('canvas'); under.width = W; under.height = Hh;
  const u = under.getContext('2d');
  path(u); u.save(); u.clip();
  u.fillStyle = fore ? '#3b2a24' : '#2e2420'; u.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * W, y = rnd() * Hh, r = 4 + rnd() * 26, v = rnd();
    u.fillStyle = v < .45 ? `rgba(12,8,6,${.15 + rnd() * .3})` : v < .8 ? `rgba(120,96,80,${.08 + rnd() * .15})` : `rgba(170,150,135,${.08 + rnd() * .1})`;
    u.beginPath(); u.ellipse(x, y, r, r * (.3 + rnd() * .6), rnd() * 3, 0, 7); u.fill();
  }
  u.strokeStyle = 'rgba(200,185,170,.18)'; u.lineWidth = 2;
  for (let i = 0; i < 9; i++) { u.beginPath(); for (let k = 0; k < 8; k++) { const x = k / 7 * W, y = (i + .5) / 9 * Hh + Math.sin(k * 1.3 + i) * 30; k ? u.lineTo(x, y) : u.moveTo(x, y); } u.stroke(); }
  if (fore) { u.globalAlpha = .55; band(u, 'rgba(150,60,50,.08)', .085); u.globalAlpha = 1;
    for (const [x, y, r] of [[.8, .48, 16], [.87, .43, 12], [.72, .5, 11]]) { const q = map(new THREE.Vector2(x, y)); u.fillStyle = 'rgba(225,220,210,.7)'; u.beginPath(); u.arc(q[0], q[1], r, 0, 7); u.fill(); } }
  u.strokeStyle = 'rgba(0,0,0,.6)'; ends.forEach((e, i) => { u.lineWidth = 2; veinPath(u, e, i); });
  u.restore();

  const t1 = new THREE.CanvasTexture(base); t1.colorSpace = THREE.SRGBColorSpace; t1.anisotropy = 8;
  const t3 = new THREE.CanvasTexture(under); t3.colorSpace = THREE.SRGBColorSpace; t3.anisotropy = 8;
  const t2 = new THREE.CanvasTexture(mask); t2.anisotropy = 8;
  return { base: t1, under: t3, veins: t2, bounds: new THREE.Vector4(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y) };
}

function wingMaterial(tex, shared) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uBase: { value: tex.base }, uUnder: { value: tex.under }, uVeins: { value: tex.veins }, uB: { value: tex.bounds }, uBend: { value: 0 }, uSide: { value: 1 }, ...shared },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform vec4 uB; uniform float uBend;
      void main(){
        vUv=(uv-uB.xy)/uB.zw;
        vec3 p=position; float s=max(0.,p.x);
        p.y+=uBend*s*s*.55;                               // the tip trails behind the beat
        p.y+=.035*sin(clamp(vUv.y,0.,1.)*3.1416)*clamp(s*2.,0.,1.);   // a gentle camber, like a real wing
        vec4 mv=modelViewMatrix*vec4(p,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform sampler2D uBase,uUnder,uVeins; uniform vec3 uRed,uTint; uniform float uTintAmt,uGlow,uPulse,uSide;
      void main(){
        bool top=uSide>0. ? !gl_FrontFacing : gl_FrontFacing;
        vec3 base=top ? texture2D(uBase,vUv).rgb : texture2D(uUnder,vUv).rgb;
        vec3 m=top ? texture2D(uVeins,vUv).rgb : vec3(0.);
        vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n; vec3 v=normalize(vV);
        float ndl=max(0.,dot(n,normalize(vec3(.25,.9,.35))))*.7+.3;
        float fres=pow(1.-abs(dot(n,v)),2.5);
        vec3 bandCol=mix(uRed*.85,uTint,uTintAmt);
        float band=smoothstep(.02,.35,m.g);
        vec3 col=mix(base,bandCol*(.55+.45*base.r*3.),band*.92);
        col*=.5+.7*ndl;
        vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+dot(n,v)*1.2+.15));
        col+=fres*(vec3(.4,.05,.04)*.55+irid*.05);            // velvet sheen + a hint of iridescence
        col+=bandCol*m.r*(.18+uPulse*.3)*uGlow;               // veins glow softly in the dark
        col+=bandCol*band*(.08+uPulse*.12);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  });
}

export class Butterfly {
  constructor(scene, scale = .32, opts = {}) {
    const { glow = true, dust = true, template = null } = opts;
    this.scene = scene; this.hasDust = dust;
    this.group = new THREE.Group(); this.group.scale.setScalar(scale); scene.add(this.group);
    let gF, gH, mF, mH;
    if (template) {
      // swarm members share wings with their template: cheap to draw many
      this.shared = template.shared; ({ gF, gH, mF, mH } = template.parts);
    } else {
      this.shared = { uRed: { value: RED.clone() }, uTint: { value: new THREE.Color('#ff2a1a') }, uTintAmt: { value: 0 }, uGlow: { value: 1 }, uPulse: { value: 0 } };
      const fore = foreShape(), hind = hindShape();
      const tf = paintWing(fore, true), th = paintWing(hind, false);
      gF = new THREE.ShapeGeometry(fore, 24); gF.rotateX(Math.PI / 2);
      gH = new THREE.ShapeGeometry(hind, 24); gH.rotateX(Math.PI / 2);
      mF = wingMaterial(tf, this.shared); mH = wingMaterial(th, this.shared);
    }
    this.parts = { gF, gH, mF, mH };
    this.flapSpeed = .85 + Math.random() * .35; this.bend = 0;

    this.wings = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group(); pivot.scale.x = side;
      const f = new THREE.Mesh(gF, mF), h = new THREE.Mesh(gH, mH);
      h.position.y = -0.004;
      for (const [mesh, k] of [[f, 1], [h, .75]]) mesh.onBeforeRender = (r, sc, cam, geo, mat) => { mat.uniforms.uBend.value = this.bend * k; mat.uniforms.uSide.value = side; mat.uniformsNeedUpdate = true; };
      pivot.add(f, h); this.group.add(pivot);
      this.wings.push({ pivot, side, f, h });
    }
    // body: fuzzy thorax, segmented abdomen, eyes, legs, clubbed antennae
    const B = Butterfly.bodyParts || (Butterfly.bodyParts = (() => {
      const shell = new THREE.MeshStandardMaterial({ color: '#160706', roughness: .55, metalness: .1, emissive: '#2a0503', emissiveIntensity: .5 });
      const fuzz = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; float h(vec3 p){ return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5); } void main(){ float f=pow(1.-abs(dot(vN,vV)),1.4); float hair=h(floor(vP*260.)); gl_FragColor=vec4(vec3(.32,.09,.06)*(.6+hair*.6),f*(.35+hair*.65)); }',
      });
      const eye = new THREE.MeshStandardMaterial({ color: '#050202', roughness: .15, metalness: .6 });
      const leg = new THREE.LineBasicMaterial({ color: '#1a0806' });
      const ant = new THREE.MeshStandardMaterial({ color: '#120505', roughness: .5, emissive: '#ff2a1a', emissiveIntensity: .05 });
      const club = new THREE.MeshStandardMaterial({ color: '#2a0806', roughness: .4, emissive: '#ff3a24', emissiveIntensity: .8 });
      return { shell, fuzz, eye, leg, ant, club, sph: new THREE.SphereGeometry(1, 20, 14) };
    })());
    const part = (mat, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(B.sph, mat); o.scale.set(sx, sy, sz); o.position.set(x, y, z); this.group.add(o); return o; };
    part(B.shell, .058, .056, .1, 0, 0, .03); part(B.fuzz, .075, .072, .12, 0, .004, .03);           // thorax + its fuzz
    part(B.shell, .045, .045, .045, 0, 0, .15); part(B.eye, .022, .022, .022, .03, .012, .17); part(B.eye, .022, .022, .022, -.03, .012, .17);
    for (let i = 0; i < 6; i++) part(B.shell, .042 - i * .005, .04 - i * .005, .05, 0, -.004 * i, -.08 - i * .072);   // abdomen segments
    part(B.fuzz, .05, .05, .2, 0, 0, -.2);
    for (const sxn of [1, -1]) for (let i = 0; i < 3; i++) {
      const z = .07 - i * .05, pts = [new THREE.Vector3(.03 * sxn, -.03, z), new THREE.Vector3(.09 * sxn, -.06, z + .02 - i * .02), new THREE.Vector3(.12 * sxn, -.14, z + .04 - i * .05)];
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), B.leg));
    }
    for (const sxn of [1, -1]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(.02 * sxn, .03, .18), new THREE.Vector3(.08 * sxn, .13, .34), new THREE.Vector3(.15 * sxn, .11, .5));
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .006, 5), B.ant));
      part(B.club, .018, .018, .03, .15 * sxn, .11, .5);
    }

    // glowing dust trail
    this.dustN = dust ? 160 : 1; this.dustI = 0;
    const g = new THREE.BufferGeometry();
    this.dustPos = new Float32Array(this.dustN * 3); this.dustAge = new Float32Array(this.dustN).fill(99);
    g.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    g.setAttribute('age', new THREE.BufferAttribute(this.dustAge, 1));
    this.dust = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: this.shared.uTint, uRed: this.shared.uRed, uAmt: this.shared.uTintAmt, uPx: { value: Math.min(devicePixelRatio, 2) } },
      vertexShader: `attribute float age; varying float vA; uniform float uPx;
        void main(){ vA=age; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=uPx*max(0.,(1.-age/1.6))*9./-mv.z*4.; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; uniform vec3 uColor,uRed; uniform float uAmt;
        void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d)*max(0.,1.-vA/1.6); gl_FragColor=vec4(mix(uRed,uColor,uAmt)*1.6,a); }`,
    }));
    this.dust.frustumCulled = false; scene.add(this.dust);

    // flight state
    this.pos = new THREE.Vector3(0, 3, 0); this.vel = new THREE.Vector3();
    this.target = new THREE.Vector3(0, 3, 0);
    this.mode = 'fly';             // fly | perch | fold | hidden
    this.perch = null;            // { point, normal }
    this.speed = 3.2; this.flap = 0; this.open = 1; this.t = Math.random() * 10;
    this.wander = new THREE.Vector3();
    this.tint = new THREE.Color('#ff2a1a'); this.tintAmt = 0;
    this.lookTmp = new THREE.Vector3(); this.qTmp = new THREE.Quaternion();
    this.group.position.copy(this.pos);
    // it carries its own small glow through the dark
    if (glow) { this.glow = new THREE.PointLight('#ff3a24', 2.2, 3.2, 1.6); this.group.add(this.glow); }
  }

  /* --- behaviour API --- */
  goTo(v, speed = 3.2) { this.mode = 'fly'; this.perch = null; this.target.copy(v); this.speed = speed; }
  land(point, normal) { this.mode = 'fly'; this.perch = { point: point.clone(), normal: normal.clone().normalize() }; this.target.copy(point).addScaledVector(normal, .02); this.speed = 2.6; }
  learn(hex) { this.tint.set(hex); this.shared.uTint.value.copy(this.tint); this.tintTarget = .7; }
  forget() { this.tintTarget = 0; }
  teleport(v) { this.pos.copy(v); this.vel.set(0, 0, 0); this.group.position.copy(v); }
  fold() { this.mode = 'fold'; }
  hide(h) { this.group.visible = !h; this.dust.visible = !h; }

  update(dt) {
    this.t += dt;
    const flying = this.mode === 'fly';
    // steer
    if (flying) {
      const to = this.lookTmp.subVectors(this.target, this.pos);
      const d = to.length();
      const arrive = this.perch ? Math.min(1, d / 1.2) : Math.min(1, d / 2.5);
      // a butterfly never flies straight: wander
      this.wander.set(Math.sin(this.t * 1.7) + Math.sin(this.t * 3.1), Math.sin(this.t * 2.3) * 1.3, Math.cos(this.t * 1.3) + Math.sin(this.t * 2.9));
      const catchUp = 1 + Math.max(0, d - 3) * .45; // far behind? hurry
      const desired = to.normalize().multiplyScalar(this.speed * arrive * catchUp).addScaledVector(this.wander, this.perch ? .25 * arrive : .7);
      this.vel.lerp(desired, 1 - Math.exp(-dt * 2.6));
      this.pos.addScaledVector(this.vel, dt);
      if (this.perch && d < .3) this.mode = 'perch';
    } else if (this.mode === 'perch' && this.perch) {
      const goal = this.lookTmp.copy(this.perch.point).addScaledVector(this.perch.normal, .03);
      this.pos.lerp(goal, 1 - Math.exp(-dt * 6)); this.vel.multiplyScalar(.8);
    }
    // wings
    let angle;
    if (this.mode === 'fly') {
      // flap in bursts, then glide with the wings held up in a shallow V (like a real butterfly)
      this.glideT = (this.glideT ?? 2) - dt;
      if (this.glideT < 0) { this.gliding = !this.gliding; this.glideT = this.gliding ? .35 + Math.random() * .5 : 1.2 + Math.random() * 1.8; }
      const fast = this.vel.length() > 3.5 || (this.perch && !this.gliding);
      const gl = this.gliding && !fast;
      this.glideAmt = (this.glideAmt || 0) + ((gl ? 1 : 0) - (this.glideAmt || 0)) * (1 - Math.exp(-dt * 7));
      this.flap += dt * (13 + Math.min(6, this.vel.length() * 1.5)) * this.flapSpeed * (1 - this.glideAmt * .85);
      const beat = Math.sin(this.flap) + .28 * Math.sin(this.flap * 2 + .6);   // quicker downstroke, softer upstroke
      angle = THREE.MathUtils.lerp(beat * .95 + .25, .42 + Math.sin(this.t * 3) * .04, this.glideAmt);
      this.pos.y += (Math.cos(this.flap) * .35 * (1 - this.glideAmt) - this.glideAmt * .18) * dt; // beats lift it, glides sink it
    } else if (this.mode === 'perch') {
      // slow, proud opening and closing
      const s = Math.sin(this.t * 1.6);
      const cyc = Math.sin(this.t * .55 + this.flapSpeed * 7) * .5 + .5;
      const open = THREE.MathUtils.smoothstep(cyc, .55, .95);          // folded upright most of the time, opening slowly to bask
      angle = THREE.MathUtils.lerp(1.47, .16, open);
    } else { // fold
      angle = THREE.MathUtils.lerp(this.wings[0].pivot.rotation.z, 1.5, 1 - Math.exp(-dt * 6));
    }
    this.bend = this.mode === 'fly' ? -Math.sin(this.flap + .7) * .55 : (this.mode === 'perch' ? .08 : 0);
    for (const w of this.wings) {
      w.pivot.rotation.z = angle * w.side;
      w.h.rotation.z = Math.sin(this.flap - .5) * .08 * w.side; // hindwing lags a touch
    }
    // orientation
    this.group.position.copy(this.pos);
    if (this.mode === 'fly' && this.vel.lengthSq() > .0004) {
      const look = this.lookTmp.copy(this.pos).add(this.vel);
      const m = new THREE.Matrix4().lookAt(look, this.pos, new THREE.Vector3(0, 1, 0));
      this.qTmp.setFromRotationMatrix(m);
      // bank into turns
      const bank = THREE.MathUtils.clamp(-this.vel.x * .08, -.5, .5);
      this.qTmp.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bank));
      this.group.quaternion.slerp(this.qTmp, 1 - Math.exp(-dt * 6));
    } else if (this.mode === 'perch' && this.perch) {
      // sit on the surface, body pointing up the wall
      const n = this.perch.normal;
      const up = Math.abs(n.y) > .9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const fwd = up.clone().sub(n.clone().multiplyScalar(up.dot(n))).normalize();
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(n, fwd), n, fwd);
      this.qTmp.setFromRotationMatrix(m);
      this.group.quaternion.slerp(this.qTmp, 1 - Math.exp(-dt * 5));
    }
    // colour learning
    const tt = this.tintTarget ?? 0;
    this.tintAmt += (tt - this.tintAmt) * (1 - Math.exp(-dt * 2));
    this.shared.uTintAmt.value = this.tintAmt;
    this.shared.uPulse.value = .35 + .35 * Math.sin(this.t * 2.2);

    // dust
    if (!this.hasDust) return;
    if (this.group.visible && this.mode === 'fly') {
      for (let k = 0; k < 2; k++) {
        const i = this.dustI = (this.dustI + 1) % this.dustN;
        this.dustPos[i * 3] = this.pos.x + (Math.random() - .5) * .12;
        this.dustPos[i * 3 + 1] = this.pos.y + (Math.random() - .5) * .08;
        this.dustPos[i * 3 + 2] = this.pos.z + (Math.random() - .5) * .12;
        this.dustAge[i] = 0;
      }
    }
    for (let i = 0; i < this.dustN; i++) { this.dustAge[i] += dt; this.dustPos[i * 3 + 1] -= dt * .12; }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.dust.geometry.attributes.age.needsUpdate = true;
  }
}

/* =========================================================
   THE CHRYSALIS: where butterfly and worm swap places
   ========================================================= */
export function makeChrysalis() {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, y = (t - .5) * 1.1;
    const r = Math.sin(Math.PI * Math.pow(t, .85)) * .26 * (1 - .25 * t) + (t > .92 ? 0 : 0);
    pts.push(new THREE.Vector2(Math.max(.001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 40);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 }, uCrack: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; varying vec3 vN; uniform float uTime,uGlow,uCrack;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5); }
      float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float a=atan(vP.x,vP.z);
        float vein=smoothstep(.06,0.,abs(fract(a*1.9+vP.y*1.4+n(vP*6.)*.4)-.5));
        float beat=pow(.5+.5*sin(uTime*7.),6.);
        float fres=pow(1.-abs(dot(vN,vec3(0,0,1))),2.);
        vec3 col=vec3(.05,.01,.01)+vec3(.9,.06,.04)*(vein*(.6+uGlow*2.+beat*uGlow)+fres*.4*uGlow);
        col+=vec3(1.,.6,.5)*uCrack*smoothstep(.45,.5,n(vP*9.+uTime));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.mat = mat;
  return mesh;
}
