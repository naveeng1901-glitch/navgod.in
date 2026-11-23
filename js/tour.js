/* =========================================================
   THE GUIDED TOUR + first-visit coach mark
   The tour walks the visitor from work to work on its own (about 6.5 s each),
   pauses the moment they touch anything, and ends facing the opened heart.
   ========================================================= */
const STAY = 6500;

export function createTour({ museum, ui, $, body, ORDER, WORKS, hallOf }) {
  const T = { on: false, paused: false, i: 0, timer: null, token: 0 };
  const bar = $('#tour-bar'), btn = $('#tour-btn');

  function render() {
    const id = ORDER[Math.min(T.i, ORDER.length - 1)], w = WORKS[id], h = hallOf(id);
    $('#tb-count').textContent = `${String(T.i + 1).padStart(2, '0')} / ${ORDER.length}`;
    $('#tb-title').textContent = w ? `${h ? h.title + ' · ' : ''}${w.title}` : '';
    $('#tb-pause').textContent = T.paused ? '▶ Resume' : '❚❚ Pause';
    bar.classList.toggle('paused', T.paused);
    btn.innerHTML = T.on ? (T.paused ? '<i>▶</i> Resume tour' : '<i>❚❚</i> Pause tour') : '<i>▶</i> Guided tour';
  }
  function restartBar() {
    const p = $('#tb-prog'); p.style.transition = 'none'; p.style.transform = 'scaleX(0)';
    p.getBoundingClientRect();
    if (!T.paused) { p.style.transition = `transform ${STAY}ms linear`; p.style.transform = 'scaleX(1)'; }
  }
  async function step() {
    if (!T.on || T.paused) return;
    if (T.i >= ORDER.length) return finish();
    const my = ++T.token;
    render();
    // wait for any glide in progress, then go (and check we really arrived)
    for (let tries = 0; tries < 3 && museum.currentWork !== ORDER[T.i]; tries++) {
      while (museum.busy) { await new Promise(r => setTimeout(r, 120)); if (my !== T.token) return; }
      await museum.goExhibit(ORDER[T.i]);
      if (my !== T.token) return;
    }
    if (my !== T.token || !T.on || T.paused) return;
    restartBar();
    clearTimeout(T.timer);
    T.timer = setTimeout(() => { if (my === T.token) { T.i++; step(); } }, STAY);
  }
  async function finish() {
    stop();
    await museum.goRotunda(true);
    if (museum.ring.hT < .5) museum.toggleHeart();
    ui.toast && ui.toast(museum.heartOpen ? 'That was every hall. The heart is open: step into CenterPiece.' : 'Tour complete.');
  }
  function start(from) {
    dismissCoach();
    T.on = true; T.paused = false;
    T.i = Number.isInteger(from) ? from : Math.max(0, ORDER.indexOf(museum.currentWork));
    bar.hidden = false; requestAnimationFrame(() => bar.classList.add('on')); body.classList.add('touring');
    step();
  }
  function pause() {
    if (!T.on || T.paused) return;
    T.paused = true; T.token++; clearTimeout(T.timer); render(); restartBar();
  }
  function resume() {
    if (!T.on) return start();
    const here = ORDER.indexOf(museum.currentWork); if (here >= 0) T.i = here;   // carry on from wherever they wandered to
    T.paused = false; step();
  }
  function stop() {
    T.on = false; T.paused = false; T.token++; clearTimeout(T.timer);
    bar.classList.remove('on'); setTimeout(() => { if (!T.on) bar.hidden = true; }, 400); body.classList.remove('touring'); render();
  }
  const toggle = () => (!T.on ? start(museum.currentWork ? undefined : 0) : T.paused ? resume() : pause());

  $('#tb-pause').addEventListener('click', () => (T.paused ? resume() : pause()));
  $('#tb-next').addEventListener('click', () => { T.i = Math.min(ORDER.length, T.i + 1); T.paused = false; clearTimeout(T.timer); step(); });
  $('#tb-end').addEventListener('click', stop);
  // any hand on the controls pauses the tour (it never fights the visitor)
  const userAct = e => { if (!T.on || T.paused) return; if (e.target.closest && e.target.closest('#tour-bar, #quick')) return; pause(); };
  $('#world').addEventListener('pointerdown', userAct);
  addEventListener('wheel', userAct, { passive: true });
  addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) userAct(e); });

  /* ---------- the first-visit coach mark ---------- */
  const coach = $('#coach');
  let seen = false; try { seen = localStorage.getItem('ng-coach') === '1'; } catch (e) {}
  function showCoach() {
    if (seen || !coach) return; seen = true;
    try { localStorage.setItem('ng-coach', '1'); } catch (e) {}
    setTimeout(() => { coach.hidden = false; requestAnimationFrame(() => coach.classList.add('on')); }, 900);
    const off = () => { dismissCoach(); removeEventListener('keydown', off); $('#world').removeEventListener('pointerdown', off); };
    setTimeout(() => { addEventListener('keydown', off); $('#world').addEventListener('pointerdown', off); }, 1200);
  }
  function dismissCoach() { if (!coach || coach.hidden) return; coach.classList.remove('on'); setTimeout(() => (coach.hidden = true), 400); }
  $('#coach-tour')?.addEventListener('click', () => start(0));
  $('#coach-free')?.addEventListener('click', dismissCoach);
  ui.onRotunda = () => { if (!T.on) showCoach(); };

  render();
  return { start, pause, resume, stop, toggle, get on() { return T.on; } };
}
