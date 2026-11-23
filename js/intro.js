/* =========================================================
   INTRO: NAVGOD written in living red ink (WebGL2 fluid)
   stir · click to drop · hold = heartbeat → letters bleed into veins
   ========================================================= */

const VS = `#version 300 es
precision highp float;
in vec2 aPos; uniform vec2 texel;
out vec2 vUv, vL, vR, vT, vB;
void main(){ vUv=aPos*.5+.5; vL=vUv-vec2(texel.x,0.); vR=vUv+vec2(texel.x,0.); vT=vUv+vec2(0.,texel.y); vB=vUv-vec2(0.,texel.y); gl_Position=vec4(aPos,0.,1.); }`;
const H = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB; out vec4 o;
`;
const FS = {
  splat: H + `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
    void main(){ vec2 p=vUv-point; p.x*=aspect; vec3 s=exp(-dot(p,p)/radius)*color; o=vec4(texture(uTarget,vUv).xyz+s,1.); }`,
  advect: H + `uniform sampler2D uVelocity, uSource; uniform vec2 vTexel; uniform float dt, dissipation;
    void main(){ vec2 c=vUv-dt*texture(uVelocity,vUv).xy*vTexel; o=texture(uSource,c)/(1.+dissipation*dt); }`,
  divergence: H + `uniform sampler2D uVelocity;
    void main(){ float L=texture(uVelocity,vL).x,R=texture(uVelocity,vR).x,T=texture(uVelocity,vT).y,B=texture(uVelocity,vB).y; vec2 C=texture(uVelocity,vUv).xy;
      if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }`,
  curl: H + `uniform sampler2D uVelocity;
    void main(){ float L=texture(uVelocity,vL).y,R=texture(uVelocity,vR).y,T=texture(uVelocity,vT).x,B=texture(uVelocity,vB).x; o=vec4(.5*(R-L-T+B),0.,0.,1.); }`,
  vorticity: H + `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
    void main(){ float L=texture(uCurl,vL).x,R=texture(uCurl,vR).x,T=texture(uCurl,vT).x,B=texture(uCurl,vB).x,C=texture(uCurl,vUv).x;
      vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=curl*C; f.y*=-1.;
      vec2 v=texture(uVelocity,vUv).xy+f*dt; o=vec4(clamp(v,-1000.,1000.),0.,1.); }`,
  pressure: H + `uniform sampler2D uPressure, uDivergence;
    void main(){ float L=texture(uPressure,vL).x,R=texture(uPressure,vR).x,T=texture(uPressure,vT).x,B=texture(uPressure,vB).x;
      o=vec4((L+R+B+T-texture(uDivergence,vUv).x)*.25,0.,0.,1.); }`,
  gradient: H + `uniform sampler2D uPressure, uVelocity;
    void main(){ float L=texture(uPressure,vL).x,R=texture(uPressure,vR).x,T=texture(uPressure,vT).x,B=texture(uPressure,vB).x;
      o=vec4(texture(uVelocity,vUv).xy-vec2(R-L,T-B),0.,1.); }`,
  clear: H + `uniform sampler2D uTexture; uniform float value; void main(){ o=value*texture(uTexture,vUv); }`,
  source: H + `uniform sampler2D uDye, uMask; uniform float rate, decay;
    void main(){ vec4 d=texture(uDye,vUv); float m=texture(uMask,vUv).r;
      d.r=mix(d.r,max(d.r,m*.7),rate*m);             // letters keep feeding ink
      d.rgb*=1.-decay*(1.-smoothstep(0.,.35,m));     // stray ink fades away from the letters
      o=vec4(d.rgb,1.); }`,
  blur: H + `uniform sampler2D uTex; uniform vec2 dir;
    void main(){ vec4 c=texture(uTex,vUv)*.227; c+=texture(uTex,vUv+dir*1.384)*.316; c+=texture(uTex,vUv-dir*1.384)*.316;
      c+=texture(uTex,vUv+dir*3.23)*.07; c+=texture(uTex,vUv-dir*3.23)*.07; o=c; }`,
  display: H + `uniform sampler2D uDye, uGlow, uVel, uMask; uniform float time, beat, fade, maskAmt; uniform vec2 res, vTexel;
    vec3 pal(float x){ x=clamp(x,0.,1.8);
      vec3 a=vec3(.012,.003,.004), b=vec3(.26,.015,.02), c=vec3(.86,.09,.07), d=vec3(1.,.55,.42);
      return x<.3 ? mix(a,b,x/.3) : x<.85 ? mix(b,c,(x-.3)/.55) : mix(c,d,clamp((x-.85)/.95,0.,1.)); }
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 d=texture(uDye,vUv).rgb, g=texture(uGlow,vUv).rgb;
      // the letters ripple with the ink's motion, so they liquefy but stay readable
      vec2 v=texture(uVel,vUv).xy*vTexel;
      vec2 off=v*.012; off*=.022/max(.022,length(off));
      float m=texture(uMask,vUv-off).r*maskAmt;
      float ink=max(d.r*.85+d.g*.7, m*.9+d.r*.25), glow=g.r*.9+g.g*.8+m*.38;
      vec3 col=pal(ink*(1.+beat*.55));
      col+=vec3(.95,.07,.05)*glow*(.6+beat*1.1);
      col+=vec3(1.,.35,.25)*pow(max(ink-1.,0.),2.)*.4;
      vec2 q=vUv-.5; q.x*=res.x/res.y; col*=1.-dot(q,q)*.55;
      col+=(hash(vUv*res+fract(time)*61.)-.5)*.03;
      o=vec4(max(col,0.)*fade,1.); }`,
};

export function createIntro(canvas, { onBleed, onDone }) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  gl.getExtension('OES_texture_float_linear');

  /* ---------- gl helpers ---------- */
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vs = shader(gl.VERTEX_SHADER, VS);
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u, use() { gl.useProgram(p); return u; } };
  }
  const P = Object.fromEntries(Object.entries(FS).map(([k, src]) => [k, program(src)]));

  function fbo(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h, texel: [1 / w, 1 / h], bind(i) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); return i; } };
  }
  function dfbo(w, h) {
    let a = fbo(w, h), b = fbo(w, h);
    return { w, h, texel: a.texel, get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; } };
  }
  function blit(t) {
    if (t) { gl.viewport(0, 0, t.w, t.h); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function res(r) {
    let a = gl.drawingBufferWidth / gl.drawingBufferHeight; if (a < 1) a = 1 / a;
    const lo = Math.round(r), hi = Math.round(r * a);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? [hi, lo] : [lo, hi];
  }

  /* ---------- state ---------- */
  let vel, dye, div, curlT, pres, glowA, glowB, maskTex, textBox = { x0: .2, x1: .8, y0: .4, y1: .6 }, oBox = null;
  const S = { curl: 14, pressureIters: 22, velDiss: .35, dyeDiss: .9, regen: true, maskAmt: 0, beat: 0, fade: 1, bleeding: false, done: false };

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 1);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    const [sw, sh] = res(128), [dw, dh] = res(Math.min(768, Math.max(512, innerHeight * dpr)));
    vel = dfbo(sw, sh); div = fbo(sw, sh); curlT = fbo(sw, sh); pres = dfbo(sw, sh);
    dye = dfbo(dw, dh); glowA = fbo(dw >> 2, dh >> 2); glowB = fbo(dw >> 2, dh >> 2);
    drawMask(dw, dh);
  }

  /* the word NAVGOD, with the O as an ink drop */
  function drawMask(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const fs = Math.min(w * .16, h * .3);
    x.font = `600 ${fs}px Fraunces, "Playfair Display", Georgia, serif`;
    x.textBaseline = 'alphabetic';
    const parts = ['N', 'A', 'V', 'G', '◆', 'D'], track = fs * .06;
    const dropW = fs * .78;
    const widths = parts.map(p => (p === '◆' ? dropW : x.measureText(p).width));
    const total = widths.reduce((a, b) => a + b, 0) + track * (parts.length - 1);
    let cx = (w - total) / 2; const base = h * .5 + fs * .34;
    x.fillStyle = '#fff'; x.filter = 'blur(1px)';
    parts.forEach((p, i) => {
      if (p === '◆') {
        // the O is a butterfly: four wings around an open counter, so it still reads as a letter
        const ox = cx + dropW / 2, oy = base - fs * .36, s = fs * .4;
        x.save(); x.translate(ox, oy);
        for (const sx of [-1, 1]) {
          x.beginPath(); x.moveTo(0, -s * .05);                                          // forewing
          x.bezierCurveTo(sx * s * .25, -s * .95, sx * s * 1.12, -s * 1.02, sx * s * 1.02, -s * .3);
          x.bezierCurveTo(sx * s * .95, -s * .02, sx * s * .45, s * .05, 0, s * .02); x.fill();
          x.beginPath(); x.moveTo(0, s * .06);                                           // hindwing
          x.bezierCurveTo(sx * s * .6, s * .05, sx * s * .98, s * .45, sx * s * .7, s * .9);
          x.bezierCurveTo(sx * s * .45, s * 1.12, sx * s * .1, s * .7, 0, s * .2); x.fill();
        }
        x.globalCompositeOperation = 'destination-out';                                 // the counter of the O
        x.beginPath(); x.ellipse(0, s * .02, s * .28, s * .42, 0, 0, Math.PI * 2); x.fill();
        x.globalCompositeOperation = 'source-over';
        x.fillRect(-s * .035, -s * .55, s * .07, s * 1.15);                              // the body through the middle
        x.restore();
        oBox = { x: ox / w, y: oy / h, s: s * 2.1 / w };
      } else x.fillText(p, cx, base);
      cx += widths[i] + track;
    });
    textBox = { x0: (w - total) / 2 / w, x1: (w + total) / 2 / w, y0: 1 - base / h, y1: 1 - (base - fs * .75) / h };
    if (!maskTex) maskTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /* ---------- splats ---------- */
  const aspect = () => canvas.width / canvas.height;
  function splat(x, y, dx, dy, color, r = .0022) {
    let u = P.splat.use();
    gl.uniform1i(u.uTarget, vel.read.bind(0)); gl.uniform1f(u.aspect, aspect());
    gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, dx, dy, 0); gl.uniform1f(u.radius, r);
    gl.uniform2fv(u.texel, vel.texel); blit(vel.write); vel.swap();
    if (color) {
      gl.uniform1i(u.uTarget, dye.read.bind(0)); gl.uniform3f(u.color, ...color); gl.uniform1f(u.radius, r * .8);
      gl.uniform2fv(u.texel, dye.texel); blit(dye.write); dye.swap();
    }
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inText = () => [rnd(textBox.x0, textBox.x1), rnd(textBox.y0, textBox.y1)];
  function radialBurst(cx, cy, n, force, rad = .02) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-.2, .2);
      splat(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * aspect(), Math.cos(a) * force, Math.sin(a) * force, null, .0012);
    }
  }

  /* ---------- simulation ---------- */
  function step(dt) {
    let u;
    u = P.curl.use(); gl.uniform2fv(u.texel, vel.texel); gl.uniform1i(u.uVelocity, vel.read.bind(0)); blit(curlT);
    u = P.vorticity.use(); gl.uniform2fv(u.texel, vel.texel); gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uCurl, curlT.bind(1));
    gl.uniform1f(u.curl, S.curl); gl.uniform1f(u.dt, dt); blit(vel.write); vel.swap();
    u = P.divergence.use(); gl.uniform2fv(u.texel, vel.texel); gl.uniform1i(u.uVelocity, vel.read.bind(0)); blit(div);
    u = P.clear.use(); gl.uniform1i(u.uTexture, pres.read.bind(0)); gl.uniform1f(u.value, .8); blit(pres.write); pres.swap();
    u = P.pressure.use(); gl.uniform2fv(u.texel, vel.texel); gl.uniform1i(u.uDivergence, div.bind(0));
    for (let i = 0; i < S.pressureIters; i++) { gl.uniform1i(u.uPressure, pres.read.bind(1)); blit(pres.write); pres.swap(); }
    u = P.gradient.use(); gl.uniform2fv(u.texel, vel.texel); gl.uniform1i(u.uPressure, pres.read.bind(0)); gl.uniform1i(u.uVelocity, vel.read.bind(1)); blit(vel.write); vel.swap();
    u = P.advect.use(); gl.uniform2fv(u.texel, vel.texel); gl.uniform2fv(u.vTexel, vel.texel);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uSource, vel.read.bind(0)); gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, S.velDiss); blit(vel.write); vel.swap();
    if (S.regen) {
      u = P.source.use(); gl.uniform2fv(u.texel, dye.texel); gl.uniform1i(u.uDye, dye.read.bind(0));
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 1);
      gl.uniform1f(u.rate, Math.min(1, 1.8 * dt)); gl.uniform1f(u.decay, Math.min(1, .5 * dt)); blit(dye.write); dye.swap();
    }
    u = P.advect.use(); gl.uniform2fv(u.texel, dye.texel); gl.uniform2fv(u.vTexel, vel.texel);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uSource, dye.read.bind(1)); gl.uniform1f(u.dissipation, S.regen ? S.dyeDiss : .25); blit(dye.write); dye.swap();
    // glow: downsample + blur twice
    u = P.blur.use(); gl.uniform2fv(u.texel, glowA.texel);
    gl.uniform1i(u.uTex, dye.read.bind(0)); gl.uniform2f(u.dir, glowA.texel[0] * 1.5, 0); blit(glowA);
    gl.uniform1i(u.uTex, glowA.bind(0)); gl.uniform2f(u.dir, 0, glowA.texel[1] * 1.5); blit(glowB);
    gl.uniform1i(u.uTex, glowB.bind(0)); gl.uniform2f(u.dir, glowA.texel[0] * 3, 0); blit(glowA);
    gl.uniform1i(u.uTex, glowA.bind(0)); gl.uniform2f(u.dir, 0, glowA.texel[1] * 3); blit(glowB);
  }
  function render(t) {
    const u = P.display.use(); gl.uniform2fv(u.texel, dye.texel);
    gl.uniform1i(u.uDye, dye.read.bind(0)); gl.uniform1i(u.uGlow, glowB.bind(1)); gl.uniform1i(u.uVel, vel.read.bind(2));
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 3);
    gl.uniform2fv(u.vTexel, vel.texel); gl.uniform1f(u.maskAmt, S.maskAmt);
    gl.uniform1f(u.time, t); gl.uniform1f(u.beat, S.beat); gl.uniform1f(u.fade, S.fade);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    blit(null);
  }

  /* ---------- input: stir, drop, hold ---------- */
  const ptr = { x: .5, y: .5, px: .5, py: .5, moved: false, down: false, downAt: 0, hold: 0, lastBeat: 0 };
  const ring = document.getElementById('hold-ring');
  const onMove = e => {
    const x = e.clientX / innerWidth, y = 1 - e.clientY / innerHeight;
    ptr.moved = true; ptr.x = x; ptr.y = y;
    if (ring) ring.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  };
  const onDown = e => { if (S.bleeding) return; onMove(e); ptr.down = true; ptr.downAt = performance.now(); drop(ptr.x, ptr.y); };
  const onUp = () => { ptr.down = false; };
  function drop(x, y) {
    splat(x, y, 0, 0, [.9, 1.1, 0], .0035);
    radialBurst(x, y, 10, 420, .012);
  }
  function heartbeat(strength) {
    S.beat = Math.max(S.beat, strength);
    const cx = (textBox.x0 + textBox.x1) / 2, cy = (textBox.y0 + textBox.y1) / 2;
    radialBurst(cx, cy, 14, 260 * strength, .05);
    for (let i = 0; i < 4; i++) { const [x, y] = inText(); splat(x, y, 0, 0, [0, .35 * strength, 0], .0018); }
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);
  addEventListener('blur', onUp);
  const onKey = e => { if (e.key === 'Enter' && !S.bleeding) bleed(); };
  addEventListener('keydown', onKey);

  /* ---------- the bleed: letters drain into veins ---------- */
  const HOLD = 2.6;
  async function bleed() {
    if (S.bleeding) return; S.bleeding = true; S.regen = false;
    ring && ring.classList.remove('on');
    heartbeat(1.4);
    onBleed && onBleed();
    const t0 = performance.now();
    const drain = () => {
      const k = (performance.now() - t0) / 1000;
      if (k < 2.2) {
        for (let i = 0; i < 5; i++) {
          const x = rnd(textBox.x0, textBox.x1), y = rnd(textBox.y0 - .02, textBox.y1);
          splat(x, y, rnd(-40, 40), -rnd(380, 900), [0, .12, 0], .0009);
        }
        requestAnimationFrame(drain);
      }
    };
    drain();
    setTimeout(() => { S.fadeOut = true; }, 1500);
  }

  /* ---------- loop ---------- */
  let last = performance.now(), ambient = 0, raf;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    const t = now / 1000;
    // stirring
    if (ptr.moved) {
      const dx = (ptr.x - ptr.px) * 5200, dy = (ptr.y - ptr.py) * 5200;
      if (Math.abs(dx) + Math.abs(dy) > .5) splat(ptr.x, ptr.y, dx, dy, [.06, .12, 0], .0016);
      ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false;
    }
    // the ink is alive: small currents keep it curling
    ambient += dt;
    if (ambient > .22 && !S.bleeding) {
      ambient = 0; const [x, y] = inText(); const a = rnd(0, Math.PI * 2);
      splat(x, y, Math.cos(a) * 55, Math.sin(a) * 55, null, .0008);
    }
    // holding = heartbeat, faster and faster
    if (ptr.down && !S.bleeding) {
      ptr.hold = Math.min(HOLD, ptr.hold + dt);
      const p = ptr.hold / HOLD, interval = 1.0 - p * .62;
      if (t - ptr.lastBeat > interval) { ptr.lastBeat = t; heartbeat(.55 + p * .7); setTimeout(() => heartbeat(.3 + p * .4), 170); }
      if (ring) { ring.classList.add('on'); ring.style.setProperty('--p', p); }
      if (ptr.hold >= HOLD) bleed();
    } else if (!S.bleeding) {
      ptr.hold = Math.max(0, ptr.hold - dt * 2);
      if (ring) { ring.style.setProperty('--p', ptr.hold / HOLD); if (ptr.hold === 0) ring.classList.remove('on'); }
    }
    S.beat *= Math.exp(-dt * 4.5);
    S.maskAmt = S.bleeding ? Math.max(0, S.maskAmt - dt * .9) : Math.min(1, S.maskAmt + dt * .7);
    if (S.fadeOut) { S.fade = Math.max(0, S.fade - dt * .9); if (S.fade === 0 && !S.done) { S.done = true; finish(); return; } }
    step(dt); render(t);
    raf = requestAnimationFrame(loop);
  }
  function finish() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp); removeEventListener('keydown', onKey);
    onDone && onDone();
  }

  const onResize = () => { if (!S.done) size(); };
  addEventListener('resize', onResize);
  size();
  // first breath: the ink swirls in from nothing
  for (let i = 0; i < 14; i++) { const [x, y] = inText(); splat(x, y, rnd(-160, 160), rnd(-160, 160), [.15, .2, 0], .0012); }
  raf = requestAnimationFrame(loop);

  return { bleed, redraw: () => size(), oRect: () => oBox && { x: oBox.x * innerWidth, y: oBox.y * innerHeight, size: oBox.s * innerWidth } };
}
