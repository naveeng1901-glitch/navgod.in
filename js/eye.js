import { paintPlan } from './plan.js';
/* =========================================================
   INTRO: THE OCULUS EYE
   The O of NAVGOD is a living eye, set in an engraved brass ring.
   It sleeps while the museum loads, wakes, and follows you.
   Enter → the pupil opens and you fall through it, straight into
   the oculus of the Rotunda (the museum is drawn behind the pupil).
   ========================================================= */

const VS = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=aPos*.5+.5; gl_Position=vec4(aPos,0.,1.); }`;

const FS = `precision highp float;
uniform vec2 uRes; uniform float uT;
uniform vec2 uEye; uniform float uR;
uniform vec2 uLook; uniform float uDil, uSc, uOpen, uFade, uRingFade, uHole, uBlink, uWake, uBeat, uHover, uSpin, uTwist;
uniform vec2 uMouse, uCtr; uniform vec3 uClick;
uniform sampler2D uText; uniform sampler2D uPlan;
varying vec2 vUv;

float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }

void main(){
  vec2 fc = gl_FragCoord.xy;
  // entering: the eye glides to the centre and grows to the size of the heart's crown below
  vec2 p = uEye + (fc - uCtr)/uSc;                 // position in the resting layout
  float R = uR;
  vec2 e = p - uEye; float de = length(e)/R;
  float alpha = 1.;

  /* ---- the wall: clean white paper ---- */
  float x = p.x/uRes.y, y = p.y/uRes.y;
  vec3 col = vec3(.925,.91,.886) + (h21(floor(fc*.5))-.5)*.012;            // a whisper of paper tooth (cheap)
  col -= vec3(.0,.06,.07)*exp(-max(de-1.,0.)*1.6)*(.12+.25*uHover)*(.55+.45*uBeat)*uWake;   // a faint red bloom around the eye
  // a click sends a shiver through the velvet
  float cr = length(p-uClick.xy)/uRes.y, wave = uClick.z*.85;
  float ripple = exp(-pow((cr-wave)*38.,2.))*exp(-uClick.z*2.2)*step(0.,uClick.z);
  col = mix(col, vec3(.78,.15,.1), ripple*.35);
  // your cursor carries a little light
  float near = exp(-dot(p-uMouse,p-uMouse)/(R*R*5.));
  col -= vec3(.02,.02,.02)*near*uWake;

  /* ---- the letters: engraved brass ---- */
  vec2 tuv = p/uRes;
  if (tuv.x>0. && tuv.x<1. && tuv.y>0. && tuv.y<1.) {
    float m = texture2D(uText,tuv).a;
    if (m > .002) {
      vec2 tx = 2.2/uRes;
      float mx = texture2D(uText,tuv+vec2(tx.x,0.)).a - texture2D(uText,tuv-vec2(tx.x,0.)).a;
      float my = texture2D(uText,tuv+vec2(0.,tx.y)).a - texture2D(uText,tuv-vec2(0.,tx.y)).a;
      vec3 n = normalize(vec3(-mx,-my,.45));
      vec3 L = normalize(vec3(-.35,.65,.7));
      float dif = max(dot(n,L),0.);
      float spec = pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),22.);
      float sweep = fract(uT*.055)*2.2-.6;
      float sheen = exp(-pow((p.x/uRes.x - sweep)*9. - (p.y/uRes.y)*2.,2.));
      vec3 brass = vec3(.06) + vec3(.1)*pow(dif,3.) + spec*.12 + sheen*.06;
      vec3 toEye = normalize(vec3(-e/R, .9));
      brass += vec3(.6,.05,.03)*pow(max(dot(n,toEye),0.),3.)*exp(-de*.45)*.35*uWake;
      vec3 Lm = normalize(vec3((uMouse-p)/(R*1.6), .55));
      float gl = pow(max(dot(n,Lm),0.),5.)*exp(-dot(p-uMouse,p-uMouse)/(R*R*7.));
      brass += vec3(.25)*gl + vec3(.7,.08,.05)*ripple;
      brass += vec3(.5,.03,.02)*uHover*.15*exp(-de*.35);
      col = mix(col, brass, m);                                     // always crisp black ink
    }
  }

  /* ---- the O: the museum itself, seen from above, in red hairline ink ---- */
  if (de < 1.12) {
    float inS = 1.-smoothstep(.85,.862,de);
    // the plan turns very slowly, breathes with the heart, and leans a little towards your cursor
    vec2 q = e/(R*.84);
    float ang = uSpin*.25 + uT*.03, cs = cos(ang), sn = sin(ang);
    q = mat2(cs,-sn,sn,cs)*q;
    q /= 1. + .018*uBeat + .03*uHover;
    vec2 puv = q*.5 + .5;
    float ink = 0.;   // (the swarm draws the O now; the plan lives in the loader)
    vec3 paper = vec3(.925,.91,.886);
    vec3 eyec = mix(paper, vec3(.78,.15,.1), ink*(.85+.15*uHover)*(.35+.65*uWake));
    // entering: the round room at the plan's centre opens, and you fall through it into the museum
    float d = de/.86;
    float hr = mix(0., 1.02, uOpen);
    float pm = 1.-smoothstep(hr-.012, hr+.004, d);
    eyec = mix(eyec, paper, pm*(1.-uHole));
    alpha = mix(1., 1.-uHole, pm);
    // the O: a single hairline of ink, with fine marks round it
    float ringL = exp(-pow((de-.93)*130.,2.));
    float a = atan(e.y,e.x);
    float ticks = step(.82, fract((a+uSpin)/6.2832*72.))*smoothstep(.955,.96,de)*(1.-smoothstep(.985,.99,de))*.5;
    vec3 ringc = vec3(.78,.15,.1);
    col = mix(col, eyec, inS);
    // (no ring: the butterflies are the O)
    alpha = mix(1., alpha, inS);
  }

  // film: vignette and grain
  vec2 v = vUv-.5; col *= 1.-.06*pow(length(v*vec2(1.,.8))*1.25,2.2);
  col += (h21(fc+fract(uT)*91.)-.5)*.012;
  col = max(col,0.);
  // the wall and letters dissolve; then the brass ring hands over to the real one on the heart
  float outside = smoothstep(.995,1.012,de);
  alpha *= 1. - uFade;   // (no eye in the O any more: the whole sheet of paper dissolves together)
  alpha *= 1. - uRingFade*(1.-outside);
  gl_FragColor = vec4(col*alpha, alpha);
}`;

export function createEye(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); }
  catch (err) { console.warn('[NavGod] eye shader', err); return null; }
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uRes', 'uT', 'uEye', 'uR', 'uLook', 'uDil', 'uSc', 'uOpen', 'uFade', 'uRingFade', 'uCtr', 'uHole', 'uBlink', 'uWake', 'uBeat', 'uText', 'uHover', 'uSpin', 'uTwist', 'uMouse', 'uClick', 'uPlan']) U[n] = gl.getUniformLocation(prog, n);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // the museum plan that lives in the O (drawn once, in the same ink as the loading screen)
  { const planTex = gl.createTexture(), pc = document.createElement('canvas'); pc.width = pc.height = 1024; paintPlan(pc.getContext('2d'), 1024, { line: 7, inner: .7 });
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, planTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pc); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uPlan, 1); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); }

  const S = {
    dpr: 1, W: 0, H: 0, eye: [0, 0], R: 40, eyeCss: { x: 0, y: 0, r: 20 },
    look: [0, 0], lookT: [0, 0], mouse: null, lastMove: 0, nextSacc: 0,
    dil: .3, dilT: .3, blink: 1, wake: .15, wakeT: .15, progress: 0, opened: false, nextBlink: 0, blinkT0: -1,
    sc: 1, ctr: null, open: 0, fade: 0, ringFade: 0, hole: 0, hover: 0, hoverOn: false, spin: 0, click: [-9999, -9999, -1], clickT: -1, diving: false, t0: performance.now(), lastBeat: -1,
  };

  /* lay out NAVG ◉ D, centred, and paint the letters into a mask */
  function layout() {
    S.dpr = Math.min(1.5, devicePixelRatio || 1);   // the eye is soft; this keeps it light
    const W = S.W = canvas.width = Math.round(innerWidth * S.dpr), H = S.H = canvas.height = Math.round(innerHeight * S.dpr);
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    gl.viewport(0, 0, W, H);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    let fs = Math.min(W * .2, H * .32);
    const font = s => `800 ${s}px Inter, system-ui, sans-serif`;
    x.font = font(fs);
    const sp = -fs * .045;
    const widthOf = str => [...str].reduce((w, ch) => w + x.measureText(ch).width + sp, -sp);
    const cap = fs * .55;                               // Inter x-height ≈ .55em: the eye is an o
    const eyeD = cap * 1.28, gap = fs * .03;
    let total = widthOf('navg') + gap * 2 + eyeD + widthOf('d');
    if (total > W * .9) { fs *= W * .9 / total; x.font = font(fs); }
    const sp2 = -fs * .045, cap2 = fs * .55, eyeD2 = cap2 * 1.28, gap2 = fs * .03;
    const w1 = [...'navg'].reduce((w, ch) => w + x.measureText(ch).width + sp2, -sp2), w2 = x.measureText('d').width;
    total = w1 + gap2 * 2 + eyeD2 + w2;
    let cx = (W - total) / 2; const base = H * .47 + cap2 / 2;
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    S.glyphs = [];
    for (const ch of 'navg') { x.fillText(ch, cx, base); S.glyphs.push({ ch, x: cx }); cx += x.measureText(ch).width + sp2; }
    cx += -sp2 + gap2;
    const ex = cx + eyeD2 / 2, ey = base - cap2 / 2;
    cx += eyeD2 + gap2; x.fillText('d', cx, base); S.glyphs.push({ ch: 'd', x: cx });
    S.type = { fs, base, sp: sp2, font: font(fs) };
    x.clearRect(0, 0, W, H);   // the letters live in the name layer now (so each can move on its own); the shader draws only the eye
    S.eye = [ex, H - ey]; S.R = eyeD2 / 2;
    S.eyeCss = { x: ex / S.dpr, y: ey / S.dpr, r: S.R / S.dpr };
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }
  layout();
  addEventListener('resize', layout);

  /* ---- input: it watches you ---- */
  const onMove = e => { S.mouse = [e.clientX, e.clientY]; S.lastMove = performance.now(); };
  const overEye = (cx, cy) => Math.hypot(cx - S.eyeCss.x, cy - S.eyeCss.y) < S.eyeCss.r * 1.05;
  const onDown = e => {
    S.click = [e.clientX * S.dpr, S.H - e.clientY * S.dpr]; S.clickT = performance.now();
    if (overEye(e.clientX, e.clientY)) { enter(); return; }
    // startled: a quick blink and the pupil snaps small, then looks at where you clicked
    S.flinch = performance.now(); S.dil = .14; S.dilT = .14; setTimeout(() => { S.dilT = .3; }, 450);
    if (S.opened && S.openFrom === undefined) { S.blinkT0 = (performance.now() - S.t0) / 1000; S.dbl = false; }
  };
  const onUp = () => {};
  const onKey = e => { if ((e.key === 'Enter' || e.key === ' ') && !S.diving && e.target === document.body) { e.preventDefault(); enter(); } };
  addEventListener('pointermove', onMove); addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('keydown', onKey);

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let raf, last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(.05, ((now || performance.now()) - last) / 1000) || 0); last = now || performance.now();
    const t = (now - S.t0) / 1000;

    // where it looks: at you, or wandering in quick saccades when you sit still
    if (!S.diving) {
      if (S.mouse && now - S.lastMove < 2600) {
        const dx = S.mouse[0] - S.eyeCss.x, dy = S.eyeCss.y - S.mouse[1], L = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, L / (S.eyeCss.r * 7));
        S.lookT = [dx / L * k, dy / L * k];
        if (!S.flinch || now - S.flinch > 450) S.dilT = overEye(...S.mouse) ? .6 : .3;   // it opens up when you come close
      } else if (now > S.nextSacc) {
        const a = Math.random() * 6.283, r = Math.random() * .8;
        S.lookT = [Math.cos(a) * r, Math.sin(a) * r * .6]; S.nextSacc = now + 700 + Math.random() * 1800;
      }
    } else S.lookT = [0, 0];
    const isOver = !S.diving && S.mouse && overEye(...S.mouse);
    if (isOver !== S.hoverOn) { S.hoverOn = isOver; canvas.style.cursor = isOver ? 'pointer' : ''; opts.onHover && opts.onHover(isOver); }
    S.hover += ((isOver ? 1 : 0) - S.hover) * (1 - Math.exp(-dt * 6));
    S.spin += dt * (.04 + .5 * S.hover);
    const kL = 1 - Math.exp(-dt * (S.diving ? 40 : 16));
    S.look[0] += (S.lookT[0] - S.look[0]) * kL; S.look[1] += (S.lookT[1] - S.look[1]) * kL;
    if (!Number.isFinite(S.look[0] + S.look[1])) S.look = [0, 0];   // never let a bad frame lose the iris
    if (!Number.isFinite(S.lookT[0] + S.lookT[1])) S.lookT = [0, 0];
    S.dil += (S.dilT - S.dil) * (1 - Math.exp(-dt * 3));

    // waking: dim and closed while the museum loads; opens once it is ready
    S.wakeT = .15 + .85 * Math.min(1, S.progress * 1.1);
    S.wake += (S.wakeT - S.wake) * (1 - Math.exp(-dt * 1.5));
    if (!S.opened) {
      S.blink = 1 - .08 * Math.max(0, Math.sin(t * 1.3)) * S.progress;   // stirring in its sleep
      if (S.progress >= .999) { S.opened = true; S.blinkT0 = t; S.openFrom = S.blink; S.nextBlink = t + 4 + Math.random() * 3; }
    } else if (S.blinkT0 >= 0 && S.openFrom !== undefined) {
      const k = Math.min(1, (t - S.blinkT0) / 1.4);                       // the first, slow opening
      S.blink = S.openFrom * (1 - ease(k)) + (k < .35 ? .05 * Math.sin(k / .35 * Math.PI) : 0);
      if (k >= 1) S.openFrom = undefined;
    } else if (!S.diving) {
      if (t > S.nextBlink) { S.blinkT0 = t; S.nextBlink = t + 3.5 + Math.random() * 4.5; S.dbl = Math.random() < .2; opts.onBlink && opts.onBlink(); }
      const bt = t - S.blinkT0, dur = .22;
      S.blink = bt < dur ? Math.sin(bt / dur * Math.PI) : (S.dbl && bt > .3 && bt < .3 + dur ? Math.sin((bt - .3) / dur * Math.PI) : 0);
    } else S.blink *= Math.exp(-dt * 12);

    // a heartbeat, lub-dub, that the iris answers
    const ph = (t * 1.05) % 1;
    const beat = Math.exp(-ph * 9) + .6 * Math.exp(-Math.max(0, ph - .22) * 9) * (ph > .22 ? 1 : 0);
    if (Math.floor(t * 1.05) !== S.lastBeat) { S.lastBeat = Math.floor(t * 1.05); if (S.opened && !S.diving) opts.onBeat && opts.onBeat(); }

    // the dive
    if (S.diving) {
      const k = Math.min(1, (now - S.diveT0) / 2600);
      const cl = (a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
      // the eye turns as it glides to the centre and grows to the red room's ring, then hands over to the 3D eye beneath
      const mv = ease(cl(0, .5));
      S.sc = 1 + (S.Rm / S.R - 1) * mv;
      S.ctr = [S.eye[0] + (S.W / 2 - S.eye[0]) * mv, S.eye[1] + (S.H / 2 - S.eye[1]) * mv];
      S.open = 0; S.hole = 0;
      S.fade = ease(cl(.3, .65)); S.ringFade = ease(cl(.66, 1));
      const turning = 1 - ease(cl(.2, .62));                 // spins up, then settles exactly as it lands
      S.twist = (S.twist || 0) + dt * 2.6 * turning; S.spin += dt * 3.4 * turning; S.lookT = [0, 0];
      S.dilT = .3;   // match the 3D eye it lands on
      if (k >= 1 && !S.done) { S.done = true; finish(); }
    }

    gl.uniform2f(U.uRes, S.W, S.H); gl.uniform1f(U.uT, t);
    gl.uniform2f(U.uEye, S.eye[0], S.eye[1]); gl.uniform1f(U.uR, S.R);
    gl.uniform2f(U.uLook, S.look[0], S.look[1]); gl.uniform1f(U.uDil, S.dil);
    const ctr = S.ctr || S.eye;
    gl.uniform2f(U.uCtr, ctr[0], ctr[1]); gl.uniform1f(U.uSc, S.sc); gl.uniform1f(U.uOpen, S.open);
    gl.uniform1f(U.uFade, S.fade); gl.uniform1f(U.uRingFade, S.ringFade); gl.uniform1f(U.uHole, S.hole); gl.uniform1f(U.uBlink, Math.max(0, Math.min(1, S.blink)));
    gl.uniform1f(U.uWake, S.wake); gl.uniform1f(U.uBeat, beat);
    gl.uniform1f(U.uHover, S.hover); gl.uniform1f(U.uSpin, S.spin); gl.uniform1f(U.uTwist, S.twist || 0);
    gl.uniform2f(U.uMouse, S.mouse ? S.mouse[0] * S.dpr : -9999, S.mouse ? S.H - S.mouse[1] * S.dpr : -9999);
    gl.uniform3f(U.uClick, S.click[0], S.click[1], S.clickT < 0 ? -1 : (now - S.clickT) / 1000);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uText, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  raf = requestAnimationFrame(frame);

  function enter() {
    if (S.diving) return;
    S.diving = true; S.diveT0 = performance.now(); S.progress = 1; S.opened = true; S.openFrom = undefined;
    canvas.style.pointerEvents = 'none'; if (S.hoverOn) { S.hoverOn = false; opts.onHover && opts.onHover(false); }
    S.Rm = Math.min(S.H * .2, S.W * .3);                 // the red room's ring size on screen when the camera starts above it
    opts.onEnter && opts.onEnter(S.Rm / S.dpr);
  }
  function finish() {
    cancelAnimationFrame(raf);
    removeEventListener('resize', layout); removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp); removeEventListener('keydown', onKey);
    opts.onDone && opts.onDone();
  }
  return {
    enter,
    setProgress(p) { S.progress = Math.max(S.progress, p); },
    eyeRect: () => S.eyeCss,
    layout: () => ({ dpr: S.dpr, glyphs: S.glyphs, type: S.type, eye: { x: S.eye[0], y: S.H - S.eye[1], r: S.R } }),
    view: () => { const c = S.ctr || S.eye; return { sc: S.sc, cx: c[0], cy: S.H - c[1], fade: S.fade, ex: S.eye[0], ey: S.H - S.eye[1] }; },
  };
}
