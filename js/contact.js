/* =========================================================
   NAVGOD: contact compass + about (the name split)
   Contact: a small compass in the bottom-right corner. Its needle follows your cursor;
   click it and the four ways to reach Naveen open as N / E / S / W.
   About: "navgod" splits into NAVeen GODugupalli; red butterflies carry the missing letters in.
   Plain DOM + one small 2D canvas while the about page is open. Nothing runs in the museum loop.
   ========================================================= */

import { sample, makeSprites, SPECIES, RED_P, NF, wordFont } from './swarmword.js';

const PHONE = '919324478171';
const MAIL = 'naveeng1901@gmail.com';
const INSTA = 'https://instagram.com/91nav.in';
const LINKEDIN = 'https://www.linkedin.com/in/91navstudio/';

const WA_TEXT = encodeURIComponent('Hi Naveen, I just walked through navgod.in');
const ICON = {
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M4.2 19.8l1.2-3.6A8 8 0 1 1 8.6 19z"/><path d="M9 8.6c0 3 2.7 6.2 6 6.6l1.3-1.4-1.9-1-1 .8c-1-.4-2.1-1.5-2.5-2.5l.8-1-1-1.9z" class="f"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12.5" rx="1.5"/><path d="M4 7l8 6.2L20 7"/></svg>',
  insta: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.7"/><circle cx="16.9" cy="7.1" r=".9" class="f"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2.4"/><path d="M8.3 10.6v5.6M8.3 7.9v.1M11.5 16.2v-5.6m0 2.6c0-1.6 1-2.7 2.3-2.7s2 .9 2 2.6v3.1"/></svg>',
};
// compass points: angle in degrees, 0 = north, clockwise
const POINTS = [
  { id: 'whatsapp', deg: 0, label: 'whatsapp', sub: 'chat with me', href: `https://wa.me/${PHONE}?text=${WA_TEXT}` },
  { id: 'mail', deg: 90, label: 'mail', sub: MAIL, href: `mailto:${MAIL}` },
  { id: 'insta', deg: 180, label: 'instagram', sub: '@91nav.in', href: INSTA },
  { id: 'linkedin', deg: 270, label: 'linkedin', sub: 'let’s connect', href: LINKEDIN },
].filter(p => p.href);

export function createContact({ museum, body = document.body } = {}) {
  /* ---------------- the compass ---------------- */
  const wrap = document.createElement('div');
  wrap.id = 'compass';
  wrap.innerHTML = `
    <div class="cp-points" role="list">${POINTS.map(p => `
      <a class="cp-pt" role="listitem" data-id="${p.id}" style="--a:${p.deg}deg" href="${p.href}" target="${p.id === 'mail' ? '_self' : '_blank'}" rel="noopener" aria-label="${p.label}: ${p.sub}" tabindex="-1">${ICON[p.id]}</a>`).join('')}
    </div>
    <button class="cp-dial" type="button" aria-expanded="false" aria-label="Contact Naveen">
      <svg viewBox="-30 -30 60 60" aria-hidden="true">
        <circle class="ring" r="27"/>
        <g class="ticks">${Array.from({ length: 16 }, (_, i) => `<line y1="-27" y2="${i % 4 ? -24.5 : -22.5}" transform="rotate(${i * 22.5})"/>`).join('')}</g>
        <text class="nesw" y="-15.5">n</text>
        <g class="needle"><path class="n" d="M0-19 L4.2 0 L-4.2 0Z"/><path class="s" d="M0 19 L4.2 0 L-4.2 0Z"/><circle r="2.2"/></g>
      </svg>
    </button>
    <div class="cp-label" aria-live="polite"><b>contact</b><span></span></div>`;
  body.appendChild(wrap);
  // a quiet credit beside the compass, all through the museum: the site itself is his work (web, 3D, motion)
  const credit = document.createElement('p'); credit.id = 'hud-credit';
  credit.innerHTML = 'website, 3d &amp; motion by <b>naveen godugupalli</b>'; body.appendChild(credit);

  /* phones (2026-11-26, his pick "layout 3"): a named Contact button in the bottom bar opens a sheet from the bottom,
     so the four ways to reach him sit in one row and can never fall off the screen (the compass opened off the edge) */
  const dock = document.createElement('div'); dock.id = 'dock'; dock.setAttribute('aria-hidden', 'true'); body.appendChild(dock);
  const cbtn = document.createElement('button'); cbtn.id = 'dock-contact'; cbtn.type = 'button'; cbtn.textContent = 'Contact'; body.appendChild(cbtn);
  const sheet = document.createElement('div'); sheet.id = 'contact-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Contact Naveen');
  sheet.innerHTML = `<div class="cs-dim"></div><div class="cs-card"><span class="cs-grip"></span>
    <div class="cs-head"><h2>Contact</h2><button class="cs-x" type="button" aria-label="Close">✕</button></div>
    <p>Say hi about an internship, a project, or anything you saw in here.</p>
    <div class="cs-row">${POINTS.map(p => `<a href="${p.href}" target="${p.id === 'mail' ? '_self' : '_blank'}" rel="noopener"><i>${ICON[p.id] || ''}</i><span>${({ whatsapp: 'WhatsApp', mail: 'Mail', insta: 'Instagram', linkedin: 'LinkedIn' })[p.id] || p.label}</span></a>`).join('')}</div>
    <p class="cs-mail">${MAIL}</p>
    <p class="cs-credit">website, 3d &amp; motion by <b>naveen godugupalli</b></p></div>`;
  body.appendChild(sheet);
  let csY = null;
  const openSheet = on => { if (on) { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('on')); }
    else { sheet.classList.remove('on'); setTimeout(() => { sheet.hidden = true; }, 320); } };
  cbtn.addEventListener('click', () => openSheet(true));
  sheet.querySelector('.cs-dim').addEventListener('click', () => openSheet(false));
  sheet.querySelector('.cs-x').addEventListener('click', () => openSheet(false));
  const card = sheet.querySelector('.cs-card');   // swipe the sheet down to close it
  card.addEventListener('touchstart', e => { csY = e.touches[0].clientY; }, { passive: true });
  card.addEventListener('touchend', e => { if (csY != null && e.changedTouches[0].clientY - csY > 60) openSheet(false); csY = null; }, { passive: true });

  const dial = wrap.querySelector('.cp-dial'), needle = wrap.querySelector('.needle'), label = wrap.querySelector('.cp-label');
  const lb = label.querySelector('b'), ls = label.querySelector('span');
  const pts = [...wrap.querySelectorAll('.cp-pt')];
  let open = false, aim = null, ang = 0, vel = 0, target = 0, raf = 0, mx = -1e4, my = -1e4, lastMove = 0;

  const setLabel = (a, b = '') => { lb.textContent = a; ls.textContent = b; label.classList.toggle('sub', !!b); };
  function toggle(on = !open) {
    open = on; wrap.classList.toggle('open', open); dial.setAttribute('aria-expanded', open);
    pts.forEach(p => (p.tabIndex = open ? 0 : -1));
    setLabel(open ? 'find me' : 'contact', open ? 'pick a direction' : '');
    if (!open) aim = null;
    kick();
  }
  const HOVER = matchMedia('(hover: hover) and (pointer: fine)').matches; let shut = 0;
  dial.addEventListener('click', e => { e.stopPropagation(); HOVER ? toggle(true) : toggle(); });
  if (HOVER) {   // with a mouse, hovering opens the four directions; leaving closes them after a short grace (so the cursor can travel to a point)
    wrap.addEventListener('pointerenter', () => { clearTimeout(shut); if (!open) toggle(true); });
    wrap.addEventListener('pointerleave', () => { clearTimeout(shut); shut = setTimeout(() => { if (open && !wrap.matches(':hover') && !wrap.contains(document.activeElement)) toggle(false); }, 450); });
  }
  pts.forEach(p => {
    const P = POINTS.find(q => q.id === p.dataset.id);
    const on = () => { aim = P.deg; setLabel(P.label, P.sub); kick(); };
    const off = () => { aim = null; if (open) setLabel('find me', 'pick a direction'); kick(); };
    p.addEventListener('pointerenter', on); p.addEventListener('focus', on);
    p.addEventListener('pointerleave', off); p.addEventListener('blur', off);
    p.addEventListener('click', e => e.stopPropagation());
  });
  addEventListener('pointerdown', e => { if (open && !wrap.contains(e.target)) toggle(false); });
  addEventListener('keydown', e => { if (open && e.key === 'Escape') { toggle(false); dial.focus(); } });

  // the needle: points at the cursor when it is near, at the hovered point when open, and settles north when idle.
  // A spring with a little overshoot so it swings like a real needle. Only animates while it is moving.
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; lastMove = performance.now(); kick(); }, { passive: true });
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  let last = 0;
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const r = dial.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = mx - cx, dy = my - cy, near = Math.hypot(dx, dy) < 260 && now - lastMove < 2500;
    if (aim != null) target = aim;
    else if (near) target = Math.atan2(dx, -dy) * 180 / Math.PI;
    else target = Math.sin(now / 900) * 6;   // idle: a faint wobble around north
    let d = ((target - ang + 540) % 360) - 180;   // shortest way round
    vel += (d * 90 - vel * 9) * dt; ang += vel * dt;
    needle.setAttribute('transform', `rotate(${ang.toFixed(2)})`);
    const settled = Math.abs(d) < .05 && Math.abs(vel) < .05 && !near && aim == null;
    if (settled || (now - lastMove > 3000 && aim == null && Math.abs(vel) < .3 && !wrap.matches(':hover'))) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
  }
  wrap.addEventListener('pointerenter', kick);
  kick();

  /* ---------------- about: the name, written in butterflies ----------------
     The intro's butterfly "navgod" sits there. nav and god slide apart; Naveen steps into the gap between them;
     butterflies fly in from the edges and land beside each word, spelling nav·een and god·ugupalli (lighter, so
     nav and god still read first). One lands on his hand. Then the lines appear under his feet.
     Same sprites and lettering as the intro (swarmword.js). 2D canvas, runs only while the page is open. */
  // the red admiral's real wings (the same texture as the 3D cursor butterfly): upper side left half, underside right half
  const WING = new Image(); WING.crossOrigin = 'anonymous'; WING.decoding = 'async'; WING.src = 'assets/creature/wings.webp';   // (same request as the 3D butterfly's: one download)
  // the Blender sprite sheet: the film's Red Admiral at 10 wing-fold angles; row 0 upper side, row 1 underside (160 px cells)
  const ATLAS = new Image(); ATLAS.decoding = 'async'; ATLAS.src = 'assets/about/butterflies.webp'; const ACELL = 160;
  const aboutBtn = document.createElement('button');
  aboutBtn.id = 'about-btn'; aboutBtn.type = 'button'; aboutBtn.setAttribute('aria-label', 'About Naveen');
  aboutBtn.innerHTML = '<span>about me</span>';
  body.appendChild(aboutBtn);
  // one wing sprite: both wings from the texture, opened by 'open' (1 flat .. ~0 shut), on a cell of size px centred at (cx, cy)
  function wingPair(c, cx, cy, px, open, under) {
    const s = px * .47, k = s / 930, sx = under ? 1024 : 0;
    for (const side of [-1, 1]) { c.save(); c.translate(cx, cy); c.scale(side * open, 1); c.drawImage(WING, sx, 0, 1024, 1024, -40 * k, -470 * k, 1024 * k, 1024 * k); c.restore(); }
    c.fillStyle = '#140806';   // body, head and antennae
    c.beginPath(); c.ellipse(cx, cy + s * .08, s * .045, s * .3, 0, 0, 6.29); c.fill();
    c.beginPath(); c.arc(cx, cy - s * .25, s * .05, 0, 6.29); c.fill();
    c.strokeStyle = '#140806'; c.lineWidth = Math.max(.6, s * .02);
    for (const d of [-1, 1]) { c.beginPath(); c.moveTo(cx + d * s * .02, cy - s * .28); c.quadraticCurveTo(cx + d * s * .08, cy - s * .55, cx + d * s * .2, cy - s * .66); c.stroke(); }
  }

  const ab = document.createElement('section');
  ab.id = 'about'; ab.hidden = true; ab.setAttribute('aria-label', 'About Naveen');
  ab.innerHTML = `
    <canvas class="ab-fly" aria-hidden="true"></canvas>
    <img class="ab-me" src="assets/about/me.webp" alt="Naveen, standing between nav·een and god·ugupalli" decoding="async">
    <button class="ab-x" type="button" aria-label="Close about">close ✕</button>
    <h2 class="sr">NavGod: Naveen Godugupalli</h2>
    <div class="ab-in">
      <p class="ab-kicker">About</p>
      <p class="ab-lead">I make things you can hold, read and walk through.</p>
      <div class="ab-body">
        <p>I’m Naveen Godugupalli, a visual communication student at École Intuit Lab in Mumbai. I design packaging, brand identities, campaigns and books, and I paint by hand.</p>
        <p>I like work built on one clear idea you can feel: a tea bag shaped like a mountain, a matchbox you want to collect, a donut box with a sense of humour.</p>
        <p>NavGod is just my name cut in two, nav·een god·ugupalli, so I built it a museum. I designed and coded every room myself.</p>
        <p>I’m looking for an internship where I can learn from real briefs and make work people remember.</p>
        <dl class="ab-facts">
          <div><dt>Based in</dt><dd>Mumbai, India</dd></div>
          <div><dt>Studying</dt><dd>Visual Communication, École Intuit Lab</dd></div>
          <div><dt>I make</dt><dd>Packaging, identity, campaigns, editorial, 3D, painting</dd></div>
          <div><dt>Open to</dt><dd>Internships and freelance work</dd></div>
        </dl>
        <p class="ab-sig"><span class="ab-mail">${MAIL}</span></p>
        <button class="ab-hi" type="button">say hi <span>→</span></button>
      </div>
    </div>`;
  body.appendChild(ab);

  const cv = ab.querySelector('.ab-fly'), x = cv.getContext('2d'), me = ab.querySelector('.ab-me'), inner = ab.querySelector('.ab-in');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = { open: false, raf: 0, wasPaused: false, S: null, t0: 0, mx: -1e4, my: -1e4 };
  const HAND = [.34, .285];   // where his hand rests on his chest, as a fraction of the cutout (437 x 1499)
  const ME_AR = 437 / 1499;
  let sprites = null, spx = 0;

  function build() {
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mc = document.createElement('canvas').getContext('2d');
    const wAt = (s, f) => { mc.font = wordFont(f); return mc.measureText(s).width; };
    const PARTS = ['nav', 'een', 'god', 'ugupalli'], GAP = 1.3;   // the gap he stands in, in em
    const sum100 = PARTS.reduce((a, s) => a + wAt(s, 100), 0) / 100;
    const fs = Math.max(30, Math.min(150, W * .92 / (sum100 + GAP), H * .2));
    const wd = PARTS.map(s => wAt(s, fs)), gap = GAP * fs, total = wd.reduce((a, b) => a + b, 0) + gap;
    const base = Math.round(Math.max(fs * 2.35, H * .44));
    const x0 = (W - total) / 2;
    const X = [x0, x0 + wd[0], x0 + wd[0] + wd[1] + gap, x0 + wd[0] + wd[1] + gap + wd[2]];
    const gapC = x0 + wd[0] + wd[1] + gap / 2;
    // where nav and god start: together as "navgod", centred
    const st = (W - wAt('navgod', fs)) / 2, OFF = [st - X[0], 0, st + wAt('nav', fs) - X[2], 0];
    const step = Math.max(3.4, fs * .052), size = step * 2.7;
    const font = wordFont(fs);
    const pts = PARTS.map((s, i) => sample([X[i] - fs * .15, base - fs * 1.15, wd[i] + fs * .3, fs * 1.6], c => { c.fillStyle = '#000'; c.font = font; c.textBaseline = 'alphabetic'; c.fillText(s, X[i], base); }, i === 0 || i === 2 ? step * .82 : step));
    const blend = ATLAS.complete && ATLAS.naturalWidth > 0, want = Math.round(Math.max(28, size * 2)), real = blend || (WING.complete && WING.naturalWidth > 0);
    if (blend) { sprites = ATLAS; spx = ACELL; }
    else if (!sprites || spx !== want || sprites.real !== real) {
      spx = want; sprites = document.createElement('canvas'); sprites.width = NF * spx; sprites.height = 4 * spx; sprites.real = real;
      const sx = sprites.getContext('2d');
      if (real) for (let row = 0; row < 2; row++) for (let f = 0; f < NF; f++) {   // row 0: the dark upper side, row 1: the pale underside
        const th = f / (NF - 1) * 1.45, open = Math.max(.07, Math.cos(th));
        sx.save(); sx.beginPath(); sx.rect(f * spx, row * spx, spx, spx); sx.clip();
        wingPair(sx, f * spx + spx / 2, row * spx + spx / 2, spx, open, row === 1);
        if (row === 0 && open < .9) { sx.globalCompositeOperation = 'source-atop'; sx.fillStyle = `rgba(20,6,4,${(1 - open) * .35})`; sx.fillRect(f * spx, row * spx, spx, spx); }
        sx.restore();
      }
      else SPECIES.forEach((_, i) => makeSprites(sx, i, spx, i, RED_P[i]));
    }
    const R = Math.random, flies = [];
    pts.forEach((P, part) => P.forEach(([px, py]) => {
      const add = part === 1 || part === 3;
      const side = R() < .5 ? -1 : 1, fy = R() * H;
      flies.push({ part, add, tx: px, ty: py, sp: real ? (add ? 1 : 0) : (R() * 4) | 0, k: .85 + R() * .3, rot: (R() - .5) * .9, ph: R() * 6.28,
        fx: add ? (side < 0 ? -60 : W + 60) : px, fy: add ? (R() < .7 ? fy : -60) : py,
        delay: add ? 1.55 + (px - x0) / total * 1.4 + R() * .35 : 0, dur: add ? .95 + R() * .45 : 0, wob: (R() - .5) * 240, scare: 0 });
    }));
    // the one for his hand, from the top
    const mh = Math.min(fs * 3.6, base - 20), mw = mh * ME_AR;
    const meL = gapC - mw / 2, meT = base + fs * .2 - mh;
    flies.push({ hand: true, part: -1, tx: meL + HAND[0] * mw, ty: meT + HAND[1] * mh, sp: 0, k: 1.25, rot: -.4, ph: 1, fx: W * .5 + 200, fy: -60, delay: 3.0, dur: 1.5, wob: -260, scare: 0 });
    me.style.cssText = `left:${meL}px;top:${meT}px;height:${mh}px`;
    inner.style.marginTop = `${base + fs * .6}px`;
    // letter masks: the sitting butterflies are trimmed to the letters (a touch wider), so the name reads crisply
    const layer = document.createElement('canvas'); layer.width = W * dpr; layer.height = H * dpr;
    const mask = document.createElement('canvas'); mask.width = layer.width; mask.height = layer.height;
    A.S = { real, W, H, dpr, fs, base, X, OFF, PARTS, font, step, size, flies, layer, lx: layer.getContext('2d'), mask, mx: mask.getContext('2d') };
  }

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const sm = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
  function frame(now) {
    const S = A.S, T = reduce ? 99 : (now - A.t0) / 1000;
    const split = ease(sm(.9, 2.1, T));
    const { lx, dpr } = S;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.clearRect(0, 0, S.layer.width, S.layer.height);
    const draw = (c, f, px, py, ang, s, fr, a) => { c.globalAlpha = a; c.setTransform(dpr * Math.cos(ang), dpr * Math.sin(ang), -dpr * Math.sin(ang), dpr * Math.cos(ang), px * dpr, py * dpr); c.drawImage(sprites, fr * spx, f.sp * spx, spx, spx, -s / 2, -s / 2, s, s); };
    const flying = [];
    for (const f of S.flies) {
      const dxm = f.tx - A.mx, dym = f.ty - A.my;
      if (dxm * dxm + dym * dym < 900 && f.scare < .3) f.scare = 1;   // the cursor startles them; they flutter up and settle back
      f.scare = Math.max(0, f.scare - .025);
      if (!f.add && !f.hand) {   // nav and god: sitting from the start, sliding apart
        const ox = f.part === 0 || f.part === 2 ? S.OFF[f.part] * (1 - split) : 0;
        const lift = Math.sin(f.scare * Math.PI) * 14;
        const fr = f.scare > .05 ? ((Math.sin(T * 30 + f.ph) * .5 + .5) * (NF - 1)) | 0 : Math.round((NF - 1) * (.35 + .35 * Math.sin(T * .9 + f.ph + f.tx * .01)));
        (lift > 1 ? flying : null)?.push([f, f.tx + ox, f.ty - lift, f.rot, S.size * f.k, fr, 1]);
        if (lift <= 1) draw(lx, f, f.tx + ox, f.ty, f.rot, S.size * f.k, fr, 1);
        continue;
      }
      const k = (T - f.delay) / f.dur;
      if (k < 0) continue;
      if (k < 1) {   // flying in on a curve, flapping hard, slowing as it lands
        const e = ease(k), mx = (f.fx + f.tx) / 2 + f.wob, my = (f.fy + f.ty) / 2 - Math.abs(f.wob) * .45;
        const px = (1 - e) * (1 - e) * f.fx + 2 * (1 - e) * e * mx + e * e * f.tx, py = (1 - e) * (1 - e) * f.fy + 2 * (1 - e) * e * my + e * e * f.ty;
        const vx = 2 * (1 - e) * (mx - f.fx) + 2 * e * (f.tx - mx), vy = 2 * (1 - e) * (my - f.fy) + 2 * e * (f.ty - my);
        const fr = ((Math.sin(T * 26 + f.ph) * .5 + .5) * (NF - 1)) | 0;
        flying.push([f, px, py, Math.atan2(vy, vx) + Math.PI / 2, S.size * f.k * (f.hand ? 1.6 : 1.15), fr, 1]);
        continue;
      }
      const settle = Math.min(1, (k - 1) * 3), lift = Math.sin(f.scare * Math.PI) * 14;
      const fr = f.scare > .05 ? ((Math.sin(T * 30 + f.ph) * .5 + .5) * (NF - 1)) | 0 : Math.round((NF - 1) * (.35 + .35 * Math.sin(T * .9 + f.ph + f.tx * .01)));
      if (f.hand) { flying.push([f, f.tx, f.ty - lift, f.rot, S.size * f.k * 1.6, fr, 1]); continue; }
      if (lift > 1) flying.push([f, f.tx, f.ty - lift, f.rot, S.size * f.k, fr, .5]);
      else draw(lx, f, f.tx, f.ty, f.rot * settle, S.size * f.k, fr, S.real ? 1 : .42 + .58 * (1 - settle));   // the added letters settle lighter
    }
    // trim the sitting ones to the letters
    const mk = S.mx; mk.setTransform(1, 0, 0, 1, 0, 0); mk.clearRect(0, 0, S.mask.width, S.mask.height); mk.setTransform(dpr, 0, 0, dpr, 0, 0);
    mk.font = S.font; mk.textBaseline = 'alphabetic'; mk.lineJoin = 'round'; mk.lineWidth = S.step * 1.1; mk.fillStyle = mk.strokeStyle = '#000';
    S.PARTS.forEach((s, i) => { const ox = i === 0 || i === 2 ? S.OFF[i] * (1 - split) : 0; mk.fillText(s, S.X[i] + ox, S.base); mk.strokeText(s, S.X[i] + ox, S.base); });
    lx.globalAlpha = 1; lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'destination-in'; lx.drawImage(S.mask, 0, 0);
    lx.globalCompositeOperation = 'source-over';
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.drawImage(S.layer, 0, 0);
    for (const [f, px, py, ang, s, fr, a] of flying) draw(x, f, px, py, ang, s, fr, a);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    if (T > 1.5) ab.classList.add('me-in');
    if (T > 3.6) ab.classList.add('lines');
    A.raf = A.open ? requestAnimationFrame(frame) : 0;
  }

  function openAbout() {
    if (A.open) return; A.open = true;
    A.wasPaused = museum ? museum.paused : false; if (museum) museum.paused = true;
    if (open) toggle(false);
    ab.hidden = false; ab.classList.remove('lines', 'me-in');
    requestAnimationFrame(() => {
      ab.classList.add('on'); build(); A.t0 = performance.now();
      if (!A.raf) A.raf = requestAnimationFrame(frame);
    });
    ab.querySelector('.ab-x').focus({ preventScroll: true, focusVisible: false });
  }
  function closeAbout() {
    if (!A.open) return; A.open = false;
    ab.classList.remove('on'); cancelAnimationFrame(A.raf); A.raf = 0;
    setTimeout(() => { if (!A.open) ab.hidden = true; }, 450);
    if (museum && !A.wasPaused) museum.paused = false;
  }
  // get the first open ready ahead of time: the butterfly sprites, the letter samples and his photo (no hitch on the first click)
  const warm = () => { try { if (!A.open) { build(); x.drawImage(sprites, 0, 0, 1, 1); x.clearRect(0, 0, 2, 2); } me.decode && me.decode().catch(() => {}); } catch (e) {} };
  setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 4000 }) : warm()), 2500);
  ab.addEventListener('pointermove', e => { A.mx = e.clientX; A.my = e.clientY; }, { passive: true });
  addEventListener('resize', () => { if (A.open) { const T = (performance.now() - A.t0) / 1000; build(); A.t0 = performance.now() - Math.max(T, 5) * 1000; } });

  aboutBtn.addEventListener('click', openAbout);
  // on the opening screen: an "about me" button beside Enter the museum
  const enter = document.querySelector('#enter-btn'), iui = document.querySelector('#intro-ui');
  if (enter && iui) {
    const ib = document.createElement('button'); ib.id = 'intro-about'; ib.type = 'button';
    ib.innerHTML = '<span>about me</span>';
    iui.appendChild(ib);
    const place = () => { const r = enter.getBoundingClientRect(), narrow = innerWidth < 600;   // a phone: under Enter, centred; otherwise beside it
      if (narrow) { ib.style.left = `${innerWidth / 2}px`; ib.style.top = `${r.bottom + 34}px`; ib.style.transform = 'translate(-50%,-50%)'; } else { ib.style.left = `${r.right + 14}px`; ib.style.top = `${r.top + r.height / 2}px`; ib.style.transform = ''; } };
    place(); new ResizeObserver(place).observe(enter); addEventListener('resize', place);
    ib.addEventListener('click', e => { e.stopPropagation(); openAbout(); });
  }
  ab.querySelector('.ab-x').addEventListener('click', closeAbout);
  ab.querySelector('.ab-hi').addEventListener('click', () => { closeAbout(); setTimeout(() => { toggle(true); dial.focus(); }, 200); });
  // while about is open it owns the keyboard (the museum's arrow keys must not walk underneath)
  addEventListener('keydown', e => {
    if (!A.open) return;
    if (e.key === 'Escape') closeAbout();
    else if (['Tab', 'Enter', ' '].includes(e.key)) return;
    else e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  ab.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

  return { openAbout, closeAbout, toggleContact: toggle };
}
