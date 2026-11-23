/* =========================================================
   THE WEAVE WALL: CenterPiece's worm weaving, live, all the way round the red room
   On a loop: paper -> the worm spits fragments of the handmade works -> strands in their
   own colours follow one swirling current -> it rests with its number -> a red wipe -> again.
   Drawn a little every frame (never all at once), seamless around the cylinder.
   ========================================================= */
import * as THREE from 'three';

const W = 1600, H = 672;                       // ~ the cylinder's proportions (17.9 m round x 7.5 m tall)
const PAPER = '#efe6d6';
const rnd = (a, b) => a + Math.random() * (b - a);

export class WeaveWall {
  constructor(getImages, { w = W, h = H, worm = true, strands = 34, spitR = [60, 120], spitEvery = .45, paper = PAPER } = {}) {   // size of the sheet; worm = draw the flat worm into it (off when a 3D worm does the weaving)
    this.W = w; this.H = h; this.drawWorm = worm; this.nStrands = strands; this.spitR = spitR; this.spitEvery = spitEvery; this.paper = paper;
    this.getImages = getImages;                 // () => array of loaded <img> of the handmade works
    this.sheet = document.createElement('canvas'); this.sheet.width = this.W; this.sheet.height = this.H;
    this.g = this.sheet.getContext('2d', { willReadFrequently: true });   // kept in main memory: uploading a GPU canvas forced a slow read-back every time (30-90 ms frames)
    this.view = document.createElement('canvas'); this.view.width = this.W; this.view.height = this.H;
    this.v = this.view.getContext('2d', { willReadFrequently: true });
    this.texture = new THREE.CanvasTexture(this.view);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.wrapS = THREE.RepeatWrapping; this.texture.anisotropy = 8;
    this.palettes = new Map();
    this.worm = { x: this.W * .5, y: this.H * .5, tx: this.W * .5, ty: this.H * .5, body: Array.from({ length: 16 }, () => ({ x: this.W * .5, y: this.H * .5 })) };
    this.no = 0; this.frame = 0;
    this.g.fillStyle = this.paper; this.g.fillRect(0, 0, this.W, this.H);
    this.start();
  }

  palette(img) {                                 // the colours of a work, sampled once
    if (this.palettes.has(img)) return this.palettes.get(img);
    const c = document.createElement('canvas'); c.width = c.height = 20; const x = c.getContext('2d');
    let cols = [];
    try { x.drawImage(img, 0, 0, 20, 20); const d = x.getImageData(0, 0, 20, 20).data;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > 25 && l < 235) cols.push([d[i], d[i + 1], d[i + 2]]); } } catch (e) {}
    if (!cols.length) cols = [[60, 40, 35]];
    this.palettes.set(img, cols); return cols;
  }

  start() {                                      // set up the living weave (it never finishes: it keeps making)
    const imgs = this.getImages().filter(i => i && i.complete && i.naturalWidth);
    if (imgs.length < 6) { this.phase = 'wait'; this.t = 0; return; }   // wait until the handmade works have loaded
    this.imgs = imgs; this.pals = imgs.map(i => this.palette(i));
    this.phase = 'live'; this.t = 0; this.spitT = 0; this.washX = 0; this.act = [];
    const k1 = Math.floor(rnd(1, 4)), k2 = Math.floor(rnd(1, 3)), s1 = rnd(0, 9), s2 = rnd(0, 9), s3 = rnd(0, 9), TAU = Math.PI * 2;
    // one swirling current, periodic around the cylinder so the seam never shows; it slowly drifts over time
    this.ang = (x, y) => (Math.sin(x / this.W * TAU * k1 + s1 + this.drift) * Math.cos(y * .006 + s2) + .6 * Math.sin(x / this.W * TAU * k2 + y * .009 + s3 - this.drift * .7)) * 2.3;
    this.drift = 0;
  }
  newStrand() {
    const p = this.pals[Math.floor(rnd(0, this.pals.length))];
    return { x: rnd(0, this.W), y: rnd(20, this.H - 20), n: Math.floor(rnd(60, 160)), i: 0, w: rnd(3, 14), c: p[Math.floor(rnd(0, p.length))] };
  }
  spit() {                                        // the worm spits a fragment of a work somewhere new
    const I = this.imgs[Math.floor(rnd(0, this.imgs.length))], s2 = rnd(.3, .55) * Math.min(I.naturalWidth, I.naturalHeight);
    const f = { I, sx: rnd(0, I.naturalWidth - s2), sy: rnd(0, I.naturalHeight - s2), s: s2, x: this.worm.x, y: this.worm.y - 20, r: rnd(this.spitR[0], this.spitR[1]), rot: rnd(-.6, .6), ph: rnd(0, 6) };
    const g = this.g;
    for (const ox of [0, -this.W, this.W]) {
      g.save(); this.blob(f.x + ox, f.y, f.r, f.ph); g.clip(); g.translate(f.x + ox, f.y); g.rotate(f.rot);
      g.drawImage(f.I, f.sx, f.sy, f.s, f.s, -f.r * 1.3, -f.r * 1.3, f.r * 2.6, f.r * 2.6); g.restore();
    }
    this.worm.tx = rnd(0, this.W); this.worm.ty = rnd(70, this.H - 70);   // and heads off to the next spot
  }

  blob(x, y, r, ph) {                            // the wobbly shape the worm spits
    const g = this.g; g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = r * (1 + .14 * Math.sin(a * 3 + ph) + .08 * Math.sin(a * 5 + ph * 2)); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath();
  }

  step(dt) {
    if (this.paused) return;                     // held still while the film plays on the ring
    this.t += dt; const g = this.g;
    if (this.phase === 'wait') { if (this.t > .8) this.start(); }
    else if (this.phase === 'live') {
      this.drift += dt * .05;
      // a slow, soft wash travels round the drum: older parts fade so they can be woven again
      this.washX = (this.washX + dt * this.W / 14) % this.W;
      g.globalAlpha = Math.min(.03, dt * .9); g.fillStyle = this.paper;   // gentle: older parts fade over a couple of passes, never wiped bare
      for (const ox of [0, -this.W]) g.fillRect(this.washX + ox - 90, 0, 180, this.H);
      g.globalAlpha = 1;
      // the worm spits on a steady rhythm
      this.spitT -= dt; if (this.spitT <= 0 && Math.hypot(this.worm.tx - this.worm.x, this.worm.ty - this.worm.y) < 60) { this.spit(); this.spitT = this.spitEvery; }
      // strands keep flowing: as one ends, another begins
      while (this.act.length < this.nStrands) this.act.push(this.newStrand());
      g.lineCap = 'round';
      for (const s of this.act) {
        for (let k = 0; k < 5 && s.i < s.n; k++, s.i++) {
          const a = this.ang(s.x, s.y), nx = s.x + Math.cos(a) * 7, ny = s.y + Math.sin(a) * 7, tp = Math.sin(Math.PI * s.i / s.n);
          g.strokeStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`; g.globalAlpha = .88; g.lineWidth = s.w * (.25 + .75 * tp);
          for (const ox of [0, -this.W, this.W]) { g.beginPath(); g.moveTo(s.x + ox, s.y); g.lineTo(nx + ox, ny); g.stroke(); }
          s.x = nx; s.y = Math.max(8, Math.min(this.H - 8, ny)); if (s.x < 0) s.x += this.W; if (s.x > this.W) s.x -= this.W;
        }
        if (s.i >= s.n) s.dead = true;
      }
      g.globalAlpha = 1;
      this.act = this.act.filter(s => !s.dead);
    }
    // the worm: follows its target, its body trailing behind
    const wm = this.worm, sp = 1 - Math.exp(-dt * 5);
    wm.x += (wm.tx - wm.x) * sp; wm.y += (wm.ty - wm.y) * sp;
    wm.body[0].x = wm.x; wm.body[0].y = wm.y;
    for (let i = 1; i < wm.body.length; i++) { const p = wm.body[i - 1], q = wm.body[i], d = Math.hypot(p.x - q.x, p.y - q.y) || 1, L = 7; if (d > L) { q.x = p.x + (q.x - p.x) / d * L; q.y = p.y + (q.y - p.y) / d * L; } }
    // compose: the sheet + the worm on top (only every other frame: uploading the texture is the costly part)
    if ((this.frame++ % 3) === 0) {                       // upload the screen every third frame: it still reads as live, at a third of the cost
      const v = this.v; v.drawImage(this.sheet, 0, 0);
      if (this.phase === 'live' && this.drawWorm) {
        for (let i = wm.body.length - 1; i >= 0; i--) { const b = wm.body[i], r = 9 * (1 - i / wm.body.length * .6); v.fillStyle = i ? '#1c1412' : '#120c0b'; v.beginPath(); v.arc(b.x, b.y, r, 0, 7); v.fill(); }
        const h = wm.body[0], n = wm.body[1]; const ax = h.x - n.x, ay = h.y - n.y, al = Math.hypot(ax, ay) || 1, px = -ay / al, py = ax / al;
        v.fillStyle = '#fff'; for (const sgn of [-1, 1]) { v.beginPath(); v.arc(h.x + px * 4 * sgn + ax / al * 3, h.y + py * 4 * sgn + ay / al * 3, 2.6, 0, 7); v.fill(); }
      }
      if (this.partial) this.dirty = true; else this.texture.needsUpdate = true;
    }
  }

  /* spread the upload, double-buffered: the next picture goes into a second texture a quarter per frame while the first one is on
     screen, then the two swap (users = the uniforms that show it). One full 1024x1024 upload cost ~10 ms and showed as a hitch;
     writing into the texture being drawn made the GPU wait. Now neither happens; the picture still refreshes ~7x a second, plenty for a slow weave. */
  upload(renderer, users) {
    const gl = renderer.getContext(), front = this.texture, props = renderer.properties.get(front);
    const ok = this.partial && users && users.length && props.__webglTexture && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (!ok) { if (this.dirty) { front.needsUpdate = true; this.dirty = false; } return; }
    if (!this.back) { const b = this.back = new THREE.CanvasTexture(this.view); b.colorSpace = front.colorSpace; b.wrapS = front.wrapS; b.wrapT = front.wrapT; b.anisotropy = front.anisotropy; renderer.initTexture(b); return; }
    const bp = renderer.properties.get(this.back); if (!bp.__webglTexture) return;
    const n = 8, h = this.H / n;   // eight thin strips, one a frame: a small, even cost (the picture still refreshes ~7x a second)
    if (this.stripK == null || this.stripK >= n) { if (!this.dirty) return; this.dirty = false; this.stripK = 0; }   // a fresh picture starts a round
    const k = this.stripK++, y0 = k * h, t = this.back;
    // raw pixels (the fast path): read the strip, flip its rows ourselves, hand WebGL the bytes (uploading a canvas element was ~7 ms a frame)
    const src = this.v.getImageData(0, y0, this.W, h).data, row = this.W * 4, buf = this._buf || (this._buf = new Uint8Array(row * h));
    if (t.flipY) for (let r = 0; r < h; r++) buf.set(src.subarray(r * row, r * row + row), (h - 1 - r) * row); else buf.set(src);
    renderer.state.bindTexture(gl.TEXTURE_2D, bp.__webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, t.flipY ? this.H - y0 - h : y0, this.W, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    if (k === n - 1) {   // complete: finish its mipmaps and put it on screen
      if (t.generateMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
      this.back = front; this.texture = t; for (const u of users) u.value = t;
    }
  }

  stamp() {                                     // its number, like the original weaves
    const g = this.g; g.fillStyle = 'rgba(30,20,18,.75)'; g.font = '500 22px Inter, system-ui, sans-serif';
    g.fillText(`weave no. ${String(this.no).padStart(4, '0')} · woven by the worm from naveen's handmade works`, 40, this.H - 26);
  }
}
