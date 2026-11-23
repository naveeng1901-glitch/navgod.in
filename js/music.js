/* =========================================================
   MUSIC: one song per hall
   Walk into a hall and its track fades in; walk out and it fades away
   (the next hall's song fades in when you enter it). Follows the ♪ sound switch.
   The songs are chosen in assets/music/music.json, e.g.
     { "identity": { "file": "dreamcatcher.mp3", "title": "dreamcatcher — bahramji" } }
   ========================================================= */
const FADE_IN = 2.2, FADE_OUT = 1.6, VOL = .55;

export function createMusic() {
  let config = {}, enabled = false, place = 'rotunda', current = null;
  const players = {};                                     // id -> { audio, target, vol, title }
  const label = document.createElement('div'); label.id = 'now-playing'; document.body.append(label);
  fetch('assets/music/music.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(c => { config = c || {}; apply(); }).catch(() => {});

  function player(id) {
    const c = config[id]; if (!c || !c.file) return null;
    if (!players[id]) {
      const a = new Audio(`assets/music/${c.file}`); a.loop = true; a.preload = 'auto'; a.volume = 0;
      a.addEventListener('error', () => { players[id].broken = true; apply(); });
      players[id] = { audio: a, target: 0, vol: 0, title: c.title || '' };
    }
    return players[id];
  }
  function apply() {
    const want = enabled ? place : null, p0 = want && player(want);
    current = p0 && !p0.broken ? want : null;
    for (const [id, p] of Object.entries(players)) p.target = id === current ? VOL : 0;
    if (current) players[current].audio.play().catch(() => {});
    label.textContent = current ? `♪ ${players[current].title}` : '';
    label.classList.toggle('on', !!current);
  }
  // smooth fades, independent of the 3D loop
  let last = performance.now();
  (function tick(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    for (const p of Object.values(players)) {
      const rate = p.target > p.vol ? VOL / FADE_IN : VOL / FADE_OUT;
      p.vol = p.target > p.vol ? Math.min(p.target, p.vol + rate * dt) : Math.max(p.target, p.vol - rate * dt);
      p.audio.volume = Math.max(0, Math.min(1, p.vol));
      if (p.vol <= 0 && p.target === 0 && !p.audio.paused) p.audio.pause();
    }
    requestAnimationFrame(tick);
  })(last);

  return {
    setPlace(id) { place = id === 'exhibit' ? place : (id || 'rotunda'); apply(); },
    setEnabled(on) { enabled = !!on; apply(); },
  };
}
