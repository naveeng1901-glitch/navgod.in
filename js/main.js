/* =========================================================
   NAVGOD: conductor
   ========================================================= */
import { DEVICE } from './device.js';   // first: phones/tablets get lighter images from here on
import { createEye } from './eye.js';
import { playNameMorph } from './namemorph.js';
import { Museum } from './world.js';
import { createCursor } from './cursor.js';
import { createCreatureLayer } from './creature3d.js';
import { createMetamorph } from './metamorph.js';
import { createSound } from './sound.js';
import { createMusic } from './music.js';
import { HALLS, BACKROOM, WORKS, ORDER, N_ROOMS, hallOf, coverOf, pageOf, caseOf } from './data.js';
const CASE_SOON = new Set(HALLS.find(h => h.id === 'editorial')?.works || []);   // Hall 04: case studies to come
import { createTour } from './tour.js';
import { createLoader } from './loader.js';
import { createContact } from './contact.js';

const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const body = document.body;
const creature = createCreatureLayer({ z: 62 });   // the one 3D animal: your cursor butterfly, its cocoon, the worm
const cursor = createCursor(creature);
const sound = createSound();
// one song per hall (assets/music/music.json): follows the place and the ♪ switch
const music = createMusic();
{ const sp = sound.setPlace, st = sound.set;
  sound.setPlace = id => { sp(id); music.setPlace(id); };
  sound.set = async v => { const r = await st(v); music.setEnabled(sound.on); return r; };
  music.setEnabled(sound.on); }

const fromHeart = location.hash === '#from-centerpiece';
const toRotunda = location.hash === '#rotunda';
if (fromHeart || toRotunda) history.replaceState(null, '', location.pathname + location.search);

// canvases draw text, so the fonts must be ready first
await Promise.race([
  Promise.all(['300 80px Fraunces', '500 80px Fraunces', '600 80px Fraunces', '600 40px Inter', '500 40px Inter', '800 80px Inter', 'italic 400 40px "Instrument Serif"', '600 40px "Bodoni Moda"'].map(f => document.fonts.load(f))),
  wait(2500),
]).catch(() => {});

/* ---------- the map: the museum as a vein system ---------- */
const rooms = [{ ...BACKROOM, works: [] }, ...HALLS];
const NS = 'http://www.w3.org/2000/svg';
const svg = $('#map svg');
const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.append(e); return e; };
const angle = k => k * Math.PI * 2 / N_ROOMS;
el('circle', { cx: 0, cy: 0, r: 64, class: 'ring' });
rooms.forEach(r => {
  const a = angle(r.k), sx = Math.sin(a), sy = Math.cos(a), px = -sy, py = sx;
  const p = (d, w = 0) => `${sx * d + px * w},${sy * d + py * w}`;
  el('path', { d: `M${p(17)} L${p(80)}`, class: 'vein', 'data-room': r.id });   // straight hairlines, not veins
  const g = el('g', { class: 'node', 'data-room': r.id, transform: `translate(${sx * 90},${sy * 90})`, tabindex: 0, role: 'button', 'aria-label': r.title });
  el('circle', { r: 11 }, g);
  const t = el('text', { 'text-anchor': 'middle', dy: 3.5 }, g); t.textContent = r.id === 'backroom' ? 'BR' : r.num;
  const go = () => (r.id === 'backroom' ? museum.goBackroom() : museum.goHall(r.id));
  g.addEventListener('click', go);
  g.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  g.addEventListener('pointerenter', () => { cursor.set(true); cursor.label(r.id === 'backroom' ? '06 · Blender & 3D' : `${r.num} · ${r.title}`); });
  g.addEventListener('pointerleave', () => { cursor.set(false); cursor.label(''); });
});
const heartNode = el('g', { class: 'node heart', 'data-room': 'centerpiece', tabindex: 0, role: 'button', 'aria-label': 'CenterPiece' });
el('circle', { r: 15 }, heartNode);
const ht = el('text', { 'text-anchor': 'middle', dy: 3.5 }, heartNode); ht.textContent = '♥';
heartNode.addEventListener('click', () => museum.enterHeart());
heartNode.addEventListener('pointerenter', () => { cursor.set(true); cursor.label('CenterPiece · the heart'); });
heartNode.addEventListener('pointerleave', () => { cursor.set(false); cursor.label(''); });
const you = el('circle', { r: 3.2, class: 'you' });

/* ---------- UI hooks the museum calls ---------- */
const ui = {
  sound,
  toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(ui._tt); ui._tt = setTimeout(() => t.classList.remove('on'), 4200);
  },
  progress(p) {
    window.__loadP = Math.max(window.__loadP || 0, p);
    if (window.navgod && (window.navgod.allReady || window.navgod.entryReady)) window.__loadP = 1;   // (ready to enter: the rest keeps loading inside)
    p = window.__loadP;   // never runs backwards
    const b = $('#enter-btn'); if (!b) return;
    b.style.setProperty('--p', p.toFixed(3));
    const ready = p >= .999;
    b.classList.toggle('ready', ready);
    window.__eye && window.__eye.setProgress(p);
    b.firstChild.textContent = ready ? 'Enter the museum ' : `Preparing the museum · ${Math.round(p * 100)}% `;
  },
  place(state, place, name, hint) {
    body.dataset.state = state;
    $('#where-name').textContent = name;
    $('#where-hint').textContent = hint || '';
    $('#where-k').textContent = state === 'travel' ? 'travelling to' : state === 'map' ? '' : 'you are in';
    svg.querySelectorAll('[data-room]').forEach(n => n.classList.toggle('here', n.dataset.room === place));
    $('#back').textContent = state === 'exhibit' ? '← Step back' : '← The Rotunda';
    if (state === 'rotunda') ui.onRotunda && ui.onRotunda();
  },
  hover(text, on) { cursor.set(on); cursor.label(DEVICE.mobile ? '' : (text || '')); },   // (touch screens: no floating label under a finger)
  // the card for whatever you are facing in the rotunda
  focus(room, heart) {
    const card = $('#arch-card');
    if (!room && !heart) { card.classList.remove('on'); return; }
    const th = $('#ac-thumbs'); th.innerHTML = '';
    if (heart) {
      const open = museum.heartOpen;
      $('#ac-k').textContent = open ? 'you are facing the heart' : 'the heart · sealed';
      $('#ac-num').textContent = '♥'; $('#ac-title').textContent = 'CenterPiece';
      $('#ac-sub').textContent = open ? 'handmade works' : `sealed · ${museum.hallsSeen.size}/${HALLS.length} halls seen`;
      $('#ac-enter').firstChild.textContent = open ? 'Enter ' : 'Take the tour ';
      $('#ac-heart').textContent = 'Turn to the halls ↻';
    } else {
      const isBR = room.id === 'backroom';
      $('#ac-k').textContent = 'you are facing';
      $('#ac-num').textContent = isBR ? 'BR' : room.num; $('#ac-title').textContent = room.title;
      $('#ac-sub').textContent = isBR ? 'everything you saw' : `${room.works.length} works`;
      (room.works || []).slice(0, 4).forEach(id => { const im = new Image(); im.src = coverOf(id); im.alt = ''; th.append(im); });
      $('#ac-heart').textContent = 'Face the heart ♥';
      $('#ac-enter').firstChild.textContent = 'Enter ';
    }
    card.classList.remove('on'); void card.offsetWidth; card.classList.add('on');
  },
  grab(on) { body.classList.toggle('grabbing', on); },
  records(on) {   // Hall 05: at the turntable, choose which record plays
    const el = $('#ex-records'); if (!el) return; el.hidden = !on;
    if (on) { const rp = museum.recordPlayer, row = el.querySelector('.rec-row');
      if (rp && !row.children.length) rp.records.forEach((r, k) => { const b = document.createElement('button'); b.type = 'button'; b.title = `${r.title} · ${r.artist}`; b.setAttribute('aria-label', `Play ${r.title} by ${r.artist}`);
        b.innerHTML = `<img src="assets/wall/albums/sleeve_${r.file}.jpg" alt="">`; b.addEventListener('click', () => rp.play(k)); hoverable(b); row.append(b); });
      paintRecords(); if (rp) startSong(rp.records[rp.k]); }
    else stopSong();
  },
  pages(st) {   // at a book in Hall 04: turn by hand (the scroll walks on to the next design)
    const el = $('#ex-pages'); if (!el) return;
    el.hidden = !st || st.mode === 'covers'; if (el.hidden) return;
    $('#pg-label').textContent = st.mode === 'fold' ? `unfold · ${st.k + 1} / ${st.K + 1}` : `page ${st.k + 1} / ${st.K + 1}`;
    $('#pg-prev').disabled = st.k <= 0; $('#pg-next').textContent = st.k >= st.K ? 'case study →' : (st.mode === 'fold' ? 'open ›' : 'turn ›');
  },
  exhibit(id) {
    const panel = $('#exhibit');
    if (!id) { panel.classList.remove('on'); $('#big-count').classList.remove('on'); return; }
    const w = WORKS[id];
    $('#ex-cat').textContent = w.cat; $('#ex-title').textContent = w.title; $('#ex-desc').textContent = w.desc;
    panel.style.setProperty('--c', w.color);
    $('#ex-hex').textContent = w.color.toUpperCase();
    const i = ORDER.indexOf(id), next = ORDER[i + 1];
    $('#ex-count').textContent = `${String(i + 1).padStart(2, '0')} / ${String(ORDER.length).padStart(2, '0')}`;
    $('#ex-next-label').textContent = next ? WORKS[next].title.split(':')[0] : 'The Back Room';
    const soon = CASE_SOON.has(id);   // Hall 04: a case study button with nothing behind it yet (his case studies come later)
    $('#ex-view').querySelector('span').textContent = w.video && !soon ? '▶' : '→';
    $('#ex-view').firstChild.textContent = w.case || soon ? 'case study ' : w.video ? 'Play the film ' : (w.n > 1 ? `View all ${w.n} pages ` : 'View the project ');
    panel.classList.add('on');
    // the big counter rolls each digit like an odometer
    const bc = $('#big-count'), num = String(i + 1).padStart(2, '0');
    bc.querySelectorAll('.d').forEach((el, k) => {
      if (!el.firstChild) el.innerHTML = '<span>' + [...'0123456789'].join('</span><span>') + '</span>';
      el.style.setProperty('--n', num[k]);
    });
    bc.querySelector('b').textContent = String(ORDER.length).padStart(2, '0');
    bc.classList.add('on');
  },
  journey(p) { const j = $('#journey'); if (j) j.style.setProperty('--p', p.toFixed(4)); },
  // the bridge to CenterPiece: butterfly <-> cocoon <-> CenterPiece's worm (see metamorph.js)
  cpArrive(pts, g) { cpWorm.hide(false); const w = cpWorm.win(); try { w && w.__ngArrive && w.__ngArrive(innerWidth / 2, innerHeight * .52, pts, g); } catch (e) {} },
  get creature() { return creature.ok ? creature : null; }, cursorCapture() { return cursor.capture(); }, cursorAdopt(p) { cursor.adopt(p); }, cursorPos() { return cursor.pos(); },
  cpWormGet() { return cpWorm.get(); }, cpWormHide(h) { cpWorm.hide(h); },
  cpLeave() { ui.centerpiece.sleep(false); const w = cpWorm.win(); try { w && w.__ngLeave && w.__ngLeave(innerWidth / 2, innerHeight * .6); } catch (e) {} },
  metaIn(x, y) { cursor.hide(true); cpWorm.pending = true; cpWorm.hide(true); const m = meta.inward(x, y); return { cocooned: m.cocooned, hatch: () => { m.onHandoff = () => { cpWorm.pending = false; cpWorm.hide(false); }; cpWorm.hide(true); return m.hatch(() => cpWorm.get()); } }; },
  metaOut() { cpWorm.hide(true); const m = meta.outward(() => cpWorm.get()); return { cocooned: m.cocooned, burst: async () => { await m.burst(); cursor.arrive(m.at[0], m.at[1], 900); cpWorm.hide(false); } }; },
  get film() { return film; }, cursorHide(h) { cursor.hide(h); }, cursorArrive(x, y) { cursor.arrive(x, y, 1000); },
  cursorLead(fn) { cursor.lead(fn); }, cursorInto(px, ms) { cursor.into(px, ms); }, cursorDive(ms) { cursor.dive(ms); }, cursorRelease(x, y) { cursor.release(x, y); },
  // CenterPiece opens as a layer over the museum (no page jump, no black): it loads while you fly to it, then fades up out of the dark
  centerpiece: (() => {
    let fr = null, ready = null;
    const make = () => {
      if (fr) return ready;
      fr = document.createElement('iframe'); fr.id = 'cp-frame'; fr.title = 'CenterPiece'; fr.src = 'centerpiece/index.html';
      fr.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:60;opacity:0;pointer-events:none;transition:opacity .9s ease;background:#030303';
      ready = new Promise(r => fr.addEventListener('load', () => { if (cpWorm.pending) cpWorm.hide(true); r(); }, { once: true })); document.body.append(fr); return ready;   // the worm stays hidden until it hatches
    };
    const sleep = p => { try { if (fr && fr.contentWindow) fr.contentWindow.__ngPaused = !!p; } catch (e) {} };   // hidden, it does no work at all
    return {
      preload: make, sleep,
      async show({ ripple = false, before } = {}) {
        await Promise.race([make(), new Promise(r => setTimeout(r, 9000))]); if (cpWorm.pending) cpWorm.hide(true); cursor.hide(true); sleep(false);
        before && before();
        if (ripple) water(fr, 1, 0, 1300);   // you come up through the surface: CenterPiece wobbles as it settles
        fr.style.opacity = '1'; fr.style.pointerEvents = 'auto'; try { fr.focus(); } catch (e) {} await new Promise(r => setTimeout(r, 950));
      },
      hide({ ripple = false } = {}) { if (!fr) return Promise.resolve(); if (ripple) water(fr, 0, 1, 950); fr.style.opacity = '0'; fr.style.pointerEvents = 'none'; return new Promise(r => setTimeout(() => { if (fr.style.opacity === '0') sleep(true); r(); }, 1000)); },
    };
  })(),
  flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); },
  leaveTo(url) { $('#veil').classList.add('on'); setTimeout(() => (location.href = url), 900); },
};

// a water surface: an SVG displacement whose strength eases between a and b (used as you pass through the ring)
const water = (() => {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', 0); svg.setAttribute('height', 0); svg.style.position = 'absolute';
  svg.innerHTML = '<filter id="cp-water" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence id="cp-turb" type="fractalNoise" baseFrequency=".008 .014" numOctaves="2" seed="4"/><feDisplacementMap id="cp-disp" in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
  document.body.append(svg);
  return (el, a, b, ms) => {
    const disp = svg.querySelector('#cp-disp'), turb = svg.querySelector('#cp-turb'), t0 = performance.now(); el.style.filter = 'url(#cp-water)';
    const step = now => { const k = Math.min(1, (now - t0) / ms), e = k * k * (3 - 2 * k), v = a + (b - a) * e;
      disp.setAttribute('scale', (v * 48).toFixed(1)); turb.setAttribute('baseFrequency', `${(.008 + .004 * Math.sin(now / 300)).toFixed(4)} ${(.014 + .004 * Math.cos(now / 260)).toFixed(4)}`);
      if (k < 1) requestAnimationFrame(step); else if (b === 0) el.style.filter = ''; };
    requestAnimationFrame(step);
  };
})();
const meta = createMetamorph();
/* the metamorphosis film (rendered in Blender): full screen, between the museum and CenterPiece.
   in + hatch going in; spin + emerge coming back. Each clip's last frame is the next one's first. */
const film = (() => {
  const box = document.createElement('div'); box.id = 'film';
  box.style.cssText = 'position:fixed;inset:0;z-index:70;background:#030303;opacity:0;transition:opacity .7s ease;pointer-events:none;display:none';
  document.body.append(box);
  const vids = {};
  const get = name => {
    if (vids[name]) return vids[name];
    const v = document.createElement('video'); v.src = `assets/film/clip_${name}.mp4`; v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0'; box.append(v); return (vids[name] = v);
  };
  const ready = v => v.readyState >= 3 ? Promise.resolve(true) : Promise.race([new Promise(r => v.addEventListener('canplaythrough', () => r(true), { once: true })), new Promise(r => setTimeout(() => r(v.readyState >= 3), 8000))]);
  return {
    preload(names) { names.forEach(get); },
    el: get,   // the <video> itself, to play on the ring as a texture
    async can(names) { const ok = await Promise.all(names.map(n => ready(get(n)))); return ok.every(Boolean); },
    play(name, { fadeIn = false } = {}) {
      const v = get(name);
      const started = (async () => {
        await ready(v); v.currentTime = 0;
        if (fadeIn) { box.style.display = 'block'; void box.offsetWidth; box.style.opacity = '1'; }
        await v.play().catch(() => {});
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        v.style.opacity = '1'; Object.values(vids).forEach(o => { if (o !== v) { o.style.opacity = '0'; o.pause(); } });   // swap only once the new clip shows its first frame
      })();
      const near = sec => started.then(() => new Promise(r => { const chk = () => (v.ended || v.currentTime >= v.duration - sec) ? r() : requestAnimationFrame(chk); chk(); }));
      return { started, near, ended: near(.03) };
    },
    hide() { box.style.opacity = '0'; return new Promise(r => setTimeout(() => { box.style.display = 'none'; Object.values(vids).forEach(v => { v.pause(); v.style.opacity = '0'; }); r(); }, 750)); },
  };
})();
const cpWorm = {   // CenterPiece's own worm, inside its layer
  win: () => { const f = document.getElementById('cp-frame'); try { return f && f.contentWindow; } catch (e) { return null; } },
  get() { const w = this.win(); try { return w && w.__ngWorm ? w.__ngWorm() : null; } catch (e) { return null; } },
  hide(h) { const w = this.win(); try { if (w) w.__ngHide = h ? 1 : 0; } catch (e) {} },
};
const museum = new Museum($('#world'), ui);
// a two-finger tap on a touchpad counts as a right-click: over the museum's canvases Chrome then opened "Save image as / Copy image"
// and that menu swallowed the scroll, so the walk didn't move. No such menu over the drawing (text and links keep theirs).
addEventListener('contextmenu', e => { if (e.target instanceof HTMLCanvasElement) e.preventDefault(); }, true);
// back from CenterPiece: its own "back to studio" button (a message from the layer) or the browser's back button
addEventListener('message', e => { if (e.origin === location.origin && e.data === 'ng-back') { if (location.hash === '#centerpiece') history.back(); else museum.leavePavilion(); } });
addEventListener('popstate', () => { if (museum.state === 'centerpiece' && location.hash !== '#centerpiece') museum.leavePavilion(); });
window.navgod = museum; // handy for debugging in the console

/* ---------- controls ---------- */
$('#back').addEventListener('click', () => (museum.state === 'exhibit' ? museum.closeExhibit() : museum.goRotunda()));
$('#ex-close').addEventListener('click', () => museum.closeExhibit());
$('#cleanup').addEventListener('click', () => museum.desk.cleanUp());
document.querySelectorAll('#mood button').forEach((b, i) => b.addEventListener('click', () => {
  museum.setMood(i);
  document.querySelectorAll('#mood button').forEach(x => x.setAttribute('aria-pressed', x === b));
}));
$('#logo').addEventListener('click', e => { e.preventDefault(); if (museum.state !== 'rotunda') museum.goRotunda(); });
function hoverable(b) {
  b.addEventListener('pointerenter', () => cursor.set(true));
  b.addEventListener('pointerleave', () => cursor.set(false));
}
document.querySelectorAll('button, #logo').forEach(hoverable);
document.addEventListener('click', e => { if (e.target.closest('button')) sound.click(); });
// sound toggle (off by default; the first click also unlocks audio in the browser)
const sndBtns = [...document.querySelectorAll('.snd')];
const paintSnd = () => sndBtns.forEach(b => { b.setAttribute('aria-pressed', sound.on); b.querySelector('b').textContent = sound.on ? 'on' : 'off'; });
sndBtns.forEach(b => b.addEventListener('click', async e => { e.stopPropagation(); await sound.toggle(); paintSnd(); }));
paintSnd();
// if sound was left on last time, start it with the first interaction
if (sound.on) addEventListener('pointerdown', () => sound.set(true), { once: true });

// "you are here" dot on the map while walking around the heart
(function track() {
  if (museum.state === 'rotunda' || museum.state === 'map') {
    const a = museum.ring.a, r = 30 + (1 - museum.ring.h) * -14 + 18; you.setAttribute('cx', Math.sin(a) * r); you.setAttribute('cy', Math.cos(a) * r); you.style.opacity = 1;
  } else you.style.opacity = 0;
  requestAnimationFrame(track);
})();

/* =========================================================
   THE PROJECT GALLERY (lightbox)
   ========================================================= */
/* a finished project opens its case study over the museum (an iframe), everything else the lightbox */
const CS = { el: null, open: false };
function openWork(id) { const url = caseOf(id); if (url) openCase(url); else openLightbox(id); }
function openCase(url) {
  if (!CS.el) {
    CS.el = document.createElement('div'); CS.el.id = 'case';
    CS.el.innerHTML = '<iframe title="Case study"></iframe><button type="button" class="case-x" aria-label="Back to the museum">Back to the museum</button>';
    document.body.append(CS.el); CS.el.querySelector('.case-x').addEventListener('click', closeCase); hoverable(CS.el.querySelector('.case-x'));
  }
  CS.el.querySelector('iframe').src = url + '&embed=1'; CS.open = true; CS.el.hidden = false;
  requestAnimationFrame(() => CS.el.classList.add('on'));
}
function closeCase() { if (!CS.open) return; CS.open = false; CS.el.classList.remove('on'); setTimeout(() => { if (!CS.open) { CS.el.hidden = true; CS.el.querySelector('iframe').src = 'about:blank'; } }, 450); }
addEventListener('message', e => { if (e.data === 'navgod-close-case') closeCase(); });
addEventListener('navgod-open-work', e => openWork(e.detail));   // the last page of a book in Hall 04
addEventListener('keydown', e => { if (e.key === 'Escape' && CS.open) { e.stopImmediatePropagation(); closeCase(); } }, true);

const lb = $('#lightbox'), LB = { id: null, i: 0, items: [], open: false };
function itemsOf(id) {
  const w = WORKS[id];
  if (w.video) return [{ video: `assets/projects/${id}/${w.video}`, thumb: coverOf(id) }];
  if (w.n) return Array.from({ length: w.n }, (_, k) => ({ img: pageOf(id, k + 1) }));
  if (w.cover !== false) return [{ img: coverOf(id) }];
  return [{ empty: true }];
}
function openLightbox(id, start = 0) {
  const w = WORKS[id];
  LB.id = id; LB.items = itemsOf(id); LB.open = true;
  $('#lb-cat').textContent = w.cat; $('#lb-title').textContent = w.title;
  lb.style.setProperty('--c', w.color);
  const th = $('#lb-thumbs'); th.innerHTML = '';
  LB.items.forEach((it, k) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', `Page ${k + 1}`);
    if (it.img || it.thumb) { const im = new Image(); im.loading = 'lazy'; im.src = it.img || it.thumb; im.alt = ''; b.append(im); }
    b.addEventListener('click', () => show(k)); hoverable(b); th.append(b);
  });
  th.hidden = LB.items.length < 2; $('#lb-prev').hidden = $('#lb-next').hidden = LB.items.length < 2;
  show(start);
  lb.hidden = false; requestAnimationFrame(() => lb.classList.add('on'));
  museum.paused = true; // give the GPU a rest while you look at the work
  museum.visited.add(id); try { sessionStorage.setItem('ng-visited', JSON.stringify([...museum.visited])); } catch (e) {}
  $('#lb-close').focus({ preventScroll: true });
}
function show(i) {
  const n = LB.items.length; LB.i = (i + n) % n;
  const it = LB.items[LB.i], media = $('#lb-media');
  media.querySelectorAll('video').forEach(v => v.pause());
  media.innerHTML = '';
  if (it.video) {
    const v = document.createElement('video'); v.src = it.video; v.controls = true; v.autoplay = true; v.playsInline = true; v.loop = true; media.append(v);
  } else if (it.img) {
    const im = new Image(); im.decoding = 'async'; im.alt = `${WORKS[LB.id].title}, page ${LB.i + 1}`; im.src = it.img;
    im.className = 'loading'; im.onload = () => im.classList.remove('loading'); media.append(im);
    [1, -1].forEach(d => { const nx = LB.items[(LB.i + d + n) % n]; if (nx.img) new Image().src = nx.img; });
  } else media.innerHTML = '<p class="lb-empty">The renders for this piece arrive in the art phase.</p>';
  $('#lb-count').textContent = n > 1 ? `${LB.i + 1} / ${n}` : '';
  $('#lb-thumbs').querySelectorAll('button').forEach((b, k) => { b.classList.toggle('on', k === LB.i); if (k === LB.i) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); });
}
function closeLightbox() {
  if (!LB.open) return; LB.open = false;
  $('#lb-media').querySelectorAll('video').forEach(v => v.pause());
  lb.classList.remove('on'); setTimeout(() => { lb.hidden = true; $('#lb-media').innerHTML = ''; }, 350);
  if (!IX.open) museum.paused = false;
}
$('#lb-close').addEventListener('click', closeLightbox);
$('#lb-prev').addEventListener('click', () => show(LB.i - 1));
$('#lb-next').addEventListener('click', () => show(LB.i + 1));
$('#lb-museum').addEventListener('click', () => { const id = LB.id; closeLightbox(); closeIndex(); museum.paused = false; museum.goExhibit(id); });
{ // swipe on phones
  let sx = null;
  $('#lb-stage').addEventListener('pointerdown', e => { sx = e.clientX; });
  $('#lb-stage').addEventListener('pointerup', e => { if (sx !== null && Math.abs(e.clientX - sx) > 50) show(LB.i + (e.clientX < sx ? 1 : -1)); sx = null; });
}

/* =========================================================
   ALL WORKS (index)
   ========================================================= */
const ix = $('#index'), IX = { open: false, built: false };
function buildIndex() {
  const grid = $('#index-grid');
  const section = (num, title, ids, extra) => {
    const s = document.createElement('section');
    s.innerHTML = `<h3><b>${num}</b>${title}<small>${ids.length ? ids.length + (ids.length > 1 ? ' works' : ' work') : ''}</small></h3><div class="cards"></div>`;
    const cards = s.querySelector('.cards');
    ids.forEach(id => {
      const w = WORKS[id], c = document.createElement('button'); c.type = 'button'; c.className = 'card'; c.style.setProperty('--c', w.color);
      c.innerHTML = `<span class="thumb">${w.cover === false ? `<em>${w.title}</em>` : `<img loading="lazy" alt="" src="${coverOf(id)}">`}${w.video ? '<i class="play">▶</i>' : ''}</span><b>${w.title}</b><small>${w.cat}${w.n > 1 ? ` · ${w.n} pages` : w.video ? ' · film' : ''}</small>`;
      c.addEventListener('click', () => openWork(id)); hoverable(c); cards.append(c);
    });
    if (extra) cards.append(extra);
    grid.append(s);
  };
  HALLS.forEach(h => section(h.num, h.title, h.works));
  const heart = document.createElement('button'); heart.type = 'button'; heart.className = 'card heart';
  heart.innerHTML = `<span class="thumb"><img loading="lazy" alt="" src="assets/centerpiece/gate.jpg"><i class="play">♥</i></span><b>CenterPiece</b><small>Handmade works · enter the heart</small>`;
  heart.addEventListener('click', () => { closeIndex(); museum.paused = false; museum.enterHeart(); }); hoverable(heart);
  section('♥', 'The Heart', [], heart);
  IX.built = true;
}
function openIndex() {
  if (!IX.built) buildIndex();
  IX.open = true; ix.hidden = false; requestAnimationFrame(() => ix.classList.add('on'));
  museum.paused = true; $('#index-close').focus({ preventScroll: true });
}
function closeIndex() {
  if (!IX.open) return; IX.open = false;
  ix.classList.remove('on'); setTimeout(() => (ix.hidden = true), 350);
  if (!LB.open) museum.paused = false;
}
$('#index-btn').addEventListener('click', openIndex);
$('#index-close').addEventListener('click', closeIndex);

// overlays get the keyboard first
addEventListener('keydown', e => {
  if (LB.open) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') show(LB.i + 1);
    else if (e.key === 'ArrowLeft') show(LB.i - 1);
    else return;
    e.stopImmediatePropagation(); e.preventDefault();
  } else if (IX.open && e.key === 'Escape') { closeIndex(); e.stopImmediatePropagation(); }
  else if (!IX.open && (e.key === 'i' || e.key === 'I') && body.classList.contains('in-museum')) openIndex();
}, true);

/* =========================================================
   THE TOUR + walking work to work
   ========================================================= */
const tour = createTour({ museum, ui, $, body, ORDER, WORKS, hallOf });
const contact = createContact({ museum, body });   // compass (bottom-left) + about (the name split)
$('#tour-btn').addEventListener('click', () => tour.toggle());
$('#turn-left').addEventListener('click', () => museum.navStep(-1));   // the side arrows: one step back / forward along the walk
$('#turn-right').addEventListener('click', () => museum.navStep(1));
$('#ac-enter').addEventListener('click', () => (museum.ring.h > .5 && !museum.heartOpen) ? tour.start(0) : museum.enterFocus());
$('#to-heart').addEventListener('click', () => museum.enterHeart());
$('#ac-heart').addEventListener('click', () => museum.toggleHeart());
$('#ex-view').addEventListener('click', () => museum.currentWork && !CASE_SOON.has(museum.currentWork) && openWork(museum.currentWork));   // (Hall 04's case studies aren't made yet: the button does nothing for now)
$('#ex-next').addEventListener('click', () => museum.journeyStep(1));
$('#ex-prev').addEventListener('click', () => museum.journeyStep(-1));
$('#pg-prev').addEventListener('click', () => museum.atBook?.turn(-1));
// Hall 05's turntable: the picked record's song plays (once a song file is added in bank-hall.js RECORDS), only with sound on, the music paused under it
let song = null;
function paintRecords() { const k = museum.recordPlayer?.k ?? 0; document.querySelectorAll('#ex-records button').forEach((b, i) => b.setAttribute('aria-pressed', i === k)); }
function stopSong() { if (song) { song.pause(); song = null; music.setEnabled(sound.on); } }
function startSong(r) { stopSong(); if (r?.song && sound.on && museum.atPlayer) { song = new Audio(r.song); song.loop = true; music.setEnabled(false); song.play().catch(() => {}); } }
addEventListener('navgod-record', e => { paintRecords(); startSong(e.detail); });
$('#pg-next').addEventListener('click', () => { const st = museum.atBook; if (st && !st.turn(1)) openWork(st.id); });

/* ---------- quality switch + integrated-GPU hint ---------- */
{
  let saved = null; try { saved = localStorage.getItem('ng-quality'); } catch (e) {}
  const current = saved || 'auto';
  document.querySelectorAll('#quality button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.q === current);
    b.title = b.dataset.q === 'auto' ? `Auto (detected: ${museum.gpu.auto === 'high' ? 'High' : 'Fast'})` : '';
    b.addEventListener('click', () => {
      try { b.dataset.q === 'auto' ? localStorage.removeItem('ng-quality') : localStorage.setItem('ng-quality', b.dataset.q); } catch (e) {}
      location.href = location.pathname + '#rotunda'; location.reload();
    });
  });
  let dismissed = false; try { dismissed = !!sessionStorage.getItem('ng-gpu-hint'); } catch (e) {}
  if (museum.gpu.integrated && museum.gpu.tier === 'low' && !DEVICE.mobile && !dismissed) {
    const h = $('#gpu-hint'); h.hidden = false;
    $('#gpu-hint-x').addEventListener('click', () => { h.hidden = true; try { sessionStorage.setItem('ng-gpu-hint', 1); } catch (e) {} });
  }
  console.info(`[NavGod] GPU: ${museum.gpu.gpu || 'unknown'} → ${museum.gpu.tier} quality`);
}

/* ---------- start ---------- */
if (toRotunda) {
  $('#intro').remove(); $('#intro-ui').remove();
  body.classList.add('in-museum');
  museum.startAtRotunda();
} else if (fromHeart) {
  $('#intro').remove(); $('#intro-ui').remove();
  body.classList.add('in-museum');
  $('#veil').classList.add('on', 'instant');
  requestAnimationFrame(() => { $('#veil').classList.remove('instant'); $('#veil').classList.remove('on'); });
  museum.returnFromHeart();
} else {
  museum.paused = true;
  const introCanvas = $('#intro');
  const start = ringPx => {
    museum.paused = false;
    body.classList.add('in-museum');
    museum.introFromMap(ringPx);
  };
  const intro = window.__eye = createEye(introCanvas, {
    onEnter(ringPx) {
      morph && morph.skip();
      cursor.hide(true);   // the swarm becomes the eye; one butterfly will fly out of the iris and become the cursor
      setTimeout(() => cursor.hide(false), 3500);   // (a safety net, if that moment never comes)
      // the pupil opens and the museum is already there behind it: you fall through into the oculus
      $('#intro-ui').classList.add('gone');
      sound.whoosh && sound.whoosh(2.4);
      start(ringPx);
    },
    onBeat() { sound.heartbeat(); },
    onBlink() { sound.blink(); },
    onHover(on) { cursor.set(on); cursor.label(on ? 'Look closer · enter' : ''); if (on) sound.click(); },
    onDone() { introCanvas.remove(); $('#intro-ui').remove(); window.__eye = null; morph && morph.destroy(); },
  });
  // first the full name, then NAV + GOD (the intro buttons wait for it)
  let morph = null;
  if (intro) {
    $('#intro-ui').classList.add('waiting'); const t0 = performance.now(), gaveUp = () => performance.now() - t0 > 45000;
    // the waiting room: a visitor pass that gets a stamp per hall, butterflies to catch, letters to throw (until the museum is ready)
    const waiting = createLoader({ progress: () => window.__loadP || 0, ready: () => museum.entryReady || museum.allReady || gaveUp(), sound, lineAt: () => morph && morph.lineAt && morph.lineAt() });
    morph = playNameMorph(intro.layout, { sound, view: intro.view, quietHold: true, lineReady: true, swarm: true, onGuide: (gx, gy) => cursor.arrive(gx, gy), hold: () => (!museum.entryReady && !museum.allReady && !gaveUp()) || waiting.active, progress: () => window.__loadP || 0, onDone: () => $('#intro-ui').classList.remove('waiting') });
  }
  if (!intro) {
    introCanvas.remove(); body.classList.add('no-fluid');
    $('#intro-ui').querySelector('.intro-hint').innerHTML = '<button id="enter-fallback">Enter NavGod</button>';
    $('#enter-fallback').addEventListener('click', () => { $('#intro-ui').remove(); start(); });
  }
  $('#skip').addEventListener('click', () => intro ? intro.enter() : $('#enter-fallback').click());
  $('#enter-btn').addEventListener('click', () => intro ? intro.enter() : $('#enter-fallback').click());
}

/* the eye in the logo follows the cursor */
{
  const o = $('#logo .o');
  if (o) addEventListener('pointermove', e => {
    const r = o.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), L = Math.hypot(dx, dy) || 1, k = Math.min(1, L / 300);
    o.style.setProperty('--lx', (dx / L * k * 2.6).toFixed(2)); o.style.setProperty('--ly', (dy / L * k * 2.6).toFixed(2));
  });
}
