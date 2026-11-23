/* =========================================================
   SOUND: generated live with Web Audio, no files.
   Spatial heartbeat · cello drone · per-hall ambience · footsteps · wings · clicks
   Off until the visitor turns it on (browsers need a click to start audio anyway).
   ========================================================= */
export function createSound() {
  let ctx = null, master, verb, on = false, heartPan, place = 'rotunda';
  const beds = {};          // per-place ambience layers
  try { on = localStorage.getItem('ng-sound') === 'on'; } catch (e) {}

  const noiseBuffer = (sec, brown) => {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w; } }
    return b;
  };
  const impulse = (sec, decay) => {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1); }
    return b;
  };
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const loopNoise = (brown, filterType, f, q, out) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(6, brown); s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); fl.connect(out); s.start(); return fl;
  };

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = gain(0, ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(master);
    const bus = gain(1, comp);
    verb = ctx.createConvolver(); verb.buffer = impulse(4.6, 3.4); verb.connect(gain(.6, bus));
    api._bus = bus;

    // ---- the room: brown-noise air, slowly breathing ----
    const room = gain(.09, bus); room.connect(verb);
    loopNoise(true, 'lowpass', 240, .7, room);
    const lfo = ctx.createOscillator(); lfo.frequency.value = .06; lfo.connect(gain(.035, room.gain)); lfo.start();

    // ---- a cello-like drone: bowed saws, low-passed, with slow vibrato ----
    const cello = gain(0, bus); cello.connect(verb);
    for (const [f, v] of [[55, .5], [82.41, .32], [110, .18]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const vib = ctx.createOscillator(); vib.frequency.value = 4.6 + Math.random(); vib.connect(gain(f * .004, o.frequency)); vib.start();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = .6;
      o.connect(lp); lp.connect(gain(v * .05, cello)); o.start();
    }
    const swell = ctx.createOscillator(); swell.frequency.value = .035; swell.connect(gain(.35, cello.gain)); swell.start();
    cello.gain.setValueAtTime(.55, ctx.currentTime);

    // ---- the heart is a real sound source in space ----
    heartPan = ctx.createPanner(); heartPan.panningModel = 'HRTF'; heartPan.distanceModel = 'inverse';
    heartPan.refDistance = 4; heartPan.rolloffFactor = 1.1; heartPan.maxDistance = 60;
    heartPan.positionX.value = 0; heartPan.positionY.value = 3.5; heartPan.positionZ.value = 0;
    heartPan.connect(bus); heartPan.connect(verb);

    // ---- each hall has its own ambience (crossfaded) ----
    const bed = (id, setup) => { const g = gain(0, bus); g.connect(verb); setup(g); beds[id] = g; };
    bed('packaging', g => loopNoise(false, 'bandpass', 1800, .4, gain(.012, g)));                         // brighter air
    bed('identity', g => { for (const f of [65.4, 98]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(gain(.018, g)); o.start(); } });
    bed('campaigns', g => {   // Meghalaya: soft rain on leaves, a distant roll of thunder-air
      loopNoise(false, 'bandpass', 3200, .35, gain(.028, g)); loopNoise(false, 'highpass', 7000, .4, gain(.008, g));
      const drip = loopNoise(true, 'lowpass', 700, .6, gain(.05, g)); const l = ctx.createOscillator(); l.frequency.value = .11; l.connect(gain(220, drip.frequency)); l.start();
    });
    bed('editorial', g => { loopNoise(false, 'highpass', 4000, .5, gain(.004, g)); });   // a quiet room: just the paper
    bed('redesign', g => { for (const [f, v] of [[50, .02], [100, .01], [150, .005]]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(gain(v, g)); o.start(); } });
    bed('backroom', g => loopNoise(true, 'lowpass', 400, .5, gain(.05, g)));
    // little events that make each place alive
    setInterval(() => {
      if (!on || !ctx) return;
      if (place === 'editorial' && Math.random() < .3) noiseHit(.35 + Math.random() * .4, 2600, 1200, .012, 1.2);   // the print shop: now and then someone squares a stack of paper
      if (place === 'packaging' && Math.random() < .25) creak();
      if (place === 'redesign' && Math.random() < .5) tick(2200, .01);
      if (place === 'backroom') { tick(1400, .02); setTimeout(() => tick(1200, .016), 500); }                     // the clock
      if (place === 'campaigns') {
        if (Math.random() < .22) bird();                                                                          // a bird in the canopy
        if (Math.random() < .35) { loom(); setTimeout(loom, 380 + Math.random() * 120); }                         // the loom: clack, clack
      }
    }, 1000);
  }

  function thump(when, vol, f0, out) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f0 * .55, when + .16);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + .012); g.gain.exponentialRampToValueAtTime(.0005, when + .34);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
    o.connect(lp); lp.connect(g); g.connect(out); o.start(when); o.stop(when + .42);
  }
  function noiseHit(dur, f0, f1, vol, q = 1.2, type = 'bandpass', out) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(Math.max(.2, dur), false);
    const bp = ctx.createBiquadFilter(); bp.type = type; bp.Q.value = q;
    const t = ctx.currentTime;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(bp); bp.connect(g); g.connect(out || api._bus); g.connect(verb); s.start(t); s.stop(t + dur + .05);
    return g;
  }
  function bird() {   // two or three quick falling whistles, far off in the reverb
    const t0 = ctx.currentTime, n = 2 + (Math.random() * 2 | 0), f = 2600 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * (.12 + Math.random() * .05);
      o.frequency.setValueAtTime(f * (1 + Math.random() * .1), t); o.frequency.exponentialRampToValueAtTime(f * .62, t + .09);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.006, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .1);
      o.connect(g); g.connect(verb); g.connect(gain(.4, api._bus)); o.start(t); o.stop(t + .12);
    }
  }
  function loom() {   // a wooden beater against the cloth
    const t = ctx.currentTime; thump(t, .03, 180, api._bus); noiseHit(.06, 1400, 700, .012, 2);
  }
  function tick(f, v) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .03);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    o.connect(hp); hp.connect(g); g.connect(api._bus); g.connect(verb); o.start(t); o.stop(t + .05);
  }
  function creak() {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; const t = ctx.currentTime;
    o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(95, t + .5);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.012, t + .1); g.gain.linearRampToValueAtTime(0, t + .5);
    o.connect(bp); bp.connect(g); g.connect(verb); o.start(t); o.stop(t + .55);
  }
  function step(when, soft) {   // a footstep on stone: a low thud and a little heel click
    thump(when, soft ? .05 : .08, 95, api._bus);
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(.08, false);
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(soft ? .02 : .035, when); g.gain.exponentialRampToValueAtTime(.0001, when + .06);
    s.connect(hp); hp.connect(g); g.connect(api._bus); g.connect(verb); s.start(when); s.stop(when + .1);
  }

  const api = {
    get on() { return on; },
    async set(v) {
      on = v; try { localStorage.setItem('ng-sound', v ? 'on' : 'off'); } catch (e) {}
      if (v && !ctx) build();
      if (!ctx) return;
      if (ctx.state === 'suspended') await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, v ? .8 : .2);
      api.setPlace(place);
    },
    toggle() { return api.set(!on); },
    // the listener is the camera
    listen(cam) {
      if (!ctx || !on) return;
      const L = ctx.listener, p = cam.position, f = new cam.position.constructor(); cam.getWorldDirection(f);
      if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    },
    setPlace(id) {
      place = id || 'rotunda';
      if (!ctx) return;
      for (const [k, g] of Object.entries(beds)) g.gain.setTargetAtTime(k === place ? 1 : 0, ctx.currentTime, .9);
    },
    heartbeat() {
      if (!on || !ctx) return;
      const t = ctx.currentTime + .01;
      thump(t, .9, 60, heartPan); thump(t + .24, .55, 52, heartPan);   // lub · dub, from the heart itself
    },
    whoosh(sec = 2) {
      if (!on || !ctx) return;
      noiseHit(Math.min(3.2, sec * .9), 260, 1300, .035, .8);
      const n = Math.max(2, Math.floor(sec / .55)), t = ctx.currentTime + .15, soft = place === 'backroom';
      for (let i = 0; i < n; i++) step(t + i * .55 + (Math.random() - .5) * .04, soft);
    },
    flutter() {
      if (!on || !ctx) return;
      const g = noiseHit(.45, 2400, 3200, .028, 2, 'highpass');
      const am = ctx.createOscillator(); am.frequency.value = 19; const ag = ctx.createGain(); ag.gain.value = .022;
      am.connect(ag); ag.connect(g.gain); am.start(); am.stop(ctx.currentTime + .5);
    },
    wings(level) {                  // many wings at once: a soft papery flutter, as loud as how many are flying (0..1)
      if (!ctx) return;
      if (!api._wg) {
        const wg = gain(0, api._bus), amp = gain(.55, wg); wg.connect(verb);
        loopNoise(false, 'bandpass', 2400, 1.1, amp);
        const am = ctx.createOscillator(); am.frequency.value = 23; am.connect(gain(.45, amp.gain)); am.start();
        const am2 = ctx.createOscillator(); am2.frequency.value = 17.3; am2.connect(gain(.25, amp.gain)); am2.start();
        api._wg = wg;
      }
      api._wg.gain.setTargetAtTime(on ? Math.min(1, level) * .07 : 0, ctx.currentTime, .12);
    },
    blink() {                       // the eye: a soft, wet tick
      if (!on || !ctx) return;
      noiseHit(.09, 3200, 1800, .012, 3);
    },
    swell() {                       // the eye wakes: a low swell that rises and settles
      if (!on || !ctx) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(110, t + 2.8); o2.frequency.setValueAtTime(82.4, t); o2.frequency.exponentialRampToValueAtTime(164.8, t + 2.8);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 2.2); lp.frequency.exponentialRampToValueAtTime(300, t + 5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + 1.6); g.gain.exponentialRampToValueAtTime(.0005, t + 5.2);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(api._bus); g.connect(verb); o.start(t); o2.start(t); o.stop(t + 5.3); o2.stop(t + 5.3);
    },
    pageTurn() {                    // a page of good paper turning: a soft swish, then the light slap as it lands
      if (!on || !ctx) return;
      noiseHit(.55, 2600, 1400, .03, .9); setTimeout(() => on && noiseHit(.08, 1200, 900, .02, 3), 620);
    },
    click() {
      if (!on || !ctx) return;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 520;
      const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(.04, t); g.gain.exponentialRampToValueAtTime(.0005, t + .12);
      o.connect(g); g.connect(api._bus); o.start(t); o.stop(t + .14);
    },
  };
  return api;
}
