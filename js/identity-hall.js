/* Hall 02, Identity: one room, two worlds, split down the middle.
   Fork Yeah's half (x > 0) is a festival lot: asphalt, string lights, and the Fork Yeah food truck parked at the end with its hatch open.
   Brain 2.0's half (x < 0) is a calm study: beige carpet, daylight through a window you never see, and a desk laid out like his mockup:
   the tote, the notebook, the pen.
   Unlit materials only (vertex-shaded, like Halls 01, 04, 05): no lights, nothing to toggle. identitySteps() returns short startup steps. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let seed = 11;
const R = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const canvasTex = (draw, w, h, rep) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const DISPLAY = '"Bricolage Grotesque", Inter, sans-serif', HAND = '"Instrument Serif", Georgia, serif';
const FY = { teal: '#147d92', orange: '#f07c1f', purple: '#6a2b8f', red: '#dc1e3c', cream: '#fbf5e6' };

// where things stand (hall-local: the door at z −L/2, the end wall at z +L/2; Brain's wall at x −4.5, Fork Yeah's at x +4.5)
export const TRUCK = { x: 2.3, z: 6.72, len: 3.4, dep: 1.75, sc: 1.15 };   // against the end wall, on Fork Yeah's side (built at 3.4 m, shown 15% larger)
export const KIOSK = { z0: 1.95, z1: 4.65, d: 1.3, sc: 1.25, X: -2.45, Z: 7.84 };   // Brain 2.0's stall: built in its own frame, then turned to stand against the end wall on Brain's side, 25% larger

export function identitySteps(world, hall, HALL_H) {
  const g = hall.group, L = hall.L, xw = 4.47;
  const low = world.gpu.tier === 'low', S = low ? .5 : 1;
  const K = world.benchKit(); world.deskMats(K); const { lit } = K, black = K.blackM;
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, h, d, col, m, x, y, z, parent) => add(lit(new THREE.BoxGeometry(w, h, d), col), m, x, y, z, parent);
  const cyl = (r0, r1, h, col, m, x, y, z, seg = 14, parent) => add(lit(new THREE.CylinderGeometry(r0, r1, h, seg), col), m, x, y, z, parent);
  const img = url => { const t = world.loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const shade = (kind, w, d, a, x, z) => { const s = world.shadowMesh(kind, w, d, a); s.rotation.x = -Math.PI / 2; s.position.set(x, .014, z); g.add(s); };
  const regroup = (n0, px, pz) => { const grp = new THREE.Group(); for (const o of g.children.slice(n0)) { o.position.x -= px; o.position.z -= pz; grp.add(o); } grp.position.set(px, 0, pz); g.add(grp); return grp; };
  const glowPool = (w, d, col, a, x, y, z, rx = -Math.PI / 2) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: world.softTex(), color: col, transparent: true, opacity: a, depthWrite: false, blending: THREE.AdditiveBlending })); p.rotation.x = rx; p.position.set(x, y, z); g.add(p); return p; };

  return [
    // ---------------------------------------------------------------- 1 · the lawn: green festival turf wall to wall, warm pools of light on it
    () => {
      const turf = canvasTex((c, w, h) => {   // festival turf: short green blades, a little uneven, worn paler in patches
        c.fillStyle = '#4c7536'; c.fillRect(0, 0, w, h);
        { const id = c.getImageData(0, 0, w, h), px = id.data; for (let k = 0; k < px.length; k += 4) { const v = R() * 34 - 17; px[k] += v * .6; px[k + 1] += v; px[k + 2] += v * .4; } c.putImageData(id, 0, 0); }
        for (let k = 0; k < 9000 * S; k++) { const x = R() * w, y = R() * h, l = 3 + R() * 7, a = -Math.PI / 2 + (R() - .5) * .9, g2 = 90 + R() * 80; c.strokeStyle = `rgba(${40 + R() * 40},${g2},${30 + R() * 25},${.35 + R() * .4})`; c.lineWidth = .8 + R() * .8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
        for (let k = 0; k < 10; k++) { const x = R() * w, y = R() * h, r = 60 + R() * 160, gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${R() < .5 ? '170,185,110' : '30,55,25'},${.08 + R() * .08})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
      }, 1024 * S, 1024 * S, true);
      turf.repeat.set(2 * xw / 2.2, L / 2.2);
      const a = new THREE.Mesh(new THREE.PlaneGeometry(2 * xw, L - .1), new THREE.MeshBasicMaterial({ map: turf, color: new THREE.Color(.8, .84, .76) }));
      a.rotation.x = -Math.PI / 2; a.position.set(0, .005, 0); g.add(a);
      // warm pools under the string lights, all down the lot
      for (const z of [-5.6, -2.6, .4, 3.2]) for (const x of [-2.2, 2.2]) glowPool(3.6, 3.2, '#ffb767', .09, x, .011, z);
    },

    // ---------------------------------------------------------------- 2 · the Fork Yeah food truck, parked against the end wall on Fork Yeah's side, hatch open toward you
    () => {
      const { x, z, len, dep, sc } = TRUCK, H = 2.2, y0 = .5;
      const truck = new THREE.Group(); truck.position.set(x, 0, z); truck.scale.setScalar(sc); g.add(truck);
      // the serving side: cream body, a teal skirt with the festival's "DIG IN!", an orange pinstripe; the hatch opening shows a warm kitchen inside
      const HU0 = .38, HU1 = .86, HV0 = .14, HV1 = .56;   // the hatch, as fractions of the side (u from the viewer's left, v from the top)
      const side = canvasTex((c, w, h) => {
        c.fillStyle = FY.cream; c.fillRect(0, 0, w, h);
        c.fillStyle = FY.purple; c.fillRect(0, h * .66, w, h * .34);
        c.fillStyle = FY.orange; c.fillRect(0, h * .63, w, h * .03);
        c.fillStyle = FY.teal; c.fillRect(0, 0, w, h * .05);
        // the cab door at the far left with its window
        c.strokeStyle = 'rgba(40,40,40,.55)'; c.lineWidth = 4; c.strokeRect(w * .02, h * .08, w * .15, h * .86);
        c.fillStyle = '#2b3a40'; c.fillRect(w * .035, h * .12, w * .12, h * .3); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(w * .04, h * .4); c.lineTo(w * .1, h * .13); c.lineTo(w * .13, h * .13); c.lineTo(w * .07, h * .4); c.fill();
        c.fillStyle = '#333'; c.fillRect(w * .14, h * .5, w * .02, h * .02);
        // the kitchen through the hatch
        const hx = w * HU0, hy = h * HV0, hw = w * (HU1 - HU0), hh = h * (HV1 - HV0);
        let gr = c.createLinearGradient(0, hy, 0, hy + hh); gr.addColorStop(0, '#5a3a22'); gr.addColorStop(1, '#2a1a10'); c.fillStyle = gr; c.fillRect(hx, hy, hw, hh);
        for (let q = 0; q < 16; q++) for (let r = 0; r < 5; r++) { c.fillStyle = (q + r) % 2 ? '#1d6f80' : '#1a6474'; c.fillRect(hx + q * hw / 16 + 1, hy + hh * .2 + r * hh * .09 + 1, hw / 16 - 2, hh * .09 - 2); }   // teal tiles
        c.fillStyle = '#c9c9c4'; c.fillRect(hx, hy + hh * .64, hw, hh * .05);   // steel shelf
        const jar = ['#e9b44c', '#d9472b', '#7aa65a', '#f0e2c0', '#e07a2b'];
        for (let q = 0; q < 12; q++) { c.fillStyle = jar[q % 5]; c.fillRect(hx + hw * (.05 + q * .075), hy + hh * (.5 + (q % 3) * .015), hw * .045, hh * .14 - (q % 3) * hh * .015); }
        for (let q = 0; q < 7; q++) { const bx = hx + hw * (.08 + q * .14), by = hy + hh * .1, rg = c.createRadialGradient(bx, by, 1, bx, by, hh * .2); rg.addColorStop(0, 'rgba(255,220,150,.9)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = rg; c.fillRect(bx - hh * .2, by - hh * .2, hh * .4, hh * .4); }   // bulbs inside
        c.fillStyle = '#b7b7b2'; c.fillRect(hx, hy + hh * .8, hw, hh * .2);   // the steel counter top inside
        c.fillStyle = '#e9e7e0'; c.fillRect(hx - 8, hy - 8, hw + 16, 8); c.fillRect(hx - 8, hy, 8, hh); c.fillRect(hx + hw, hy, 8, hh);   // the frame
        // DIG IN! on the skirt, under the hatch
        c.fillStyle = FY.cream; c.font = `800 ${h * .15}px ${DISPLAY}`; c.textAlign = 'center'; c.fillText('DIG IN!', w * .51, h * .88);   // between the wheel arches
        // the wheel arches
        c.fillStyle = '#1b1b1b'; for (const u of [.2, .82]) { c.beginPath(); c.arc(w * u, h, h * .2, Math.PI, 0); c.fill(); }
      }, 2048 * S, 1324 * S);
      const back = canvasTex((c, w, h) => {   // the back doors: two panels, a handle, the teal skirt
        c.fillStyle = FY.cream; c.fillRect(0, 0, w, h); c.fillStyle = FY.purple; c.fillRect(0, h * .66, w, h * .34); c.fillStyle = FY.orange; c.fillRect(0, h * .63, w, h * .03); c.fillStyle = FY.teal; c.fillRect(0, 0, w, h * .05);
        c.strokeStyle = 'rgba(40,40,40,.5)'; c.lineWidth = 4; c.strokeRect(w * .05, h * .08, w * .44, h * .88); c.strokeRect(w * .51, h * .08, w * .44, h * .88);
        c.fillStyle = '#333'; c.fillRect(w * .46, h * .5, w * .025, h * .08); c.fillRect(w * .515, h * .5, w * .025, h * .08);
        c.fillStyle = '#c41d1d'; for (const u of [.1, .86]) c.fillRect(w * u, h * .74, w * .05, h * .06);   // tail lights
      }, 1024 * S, 1024 * S);
      const front = canvasTex((c, w, h) => {   // the cab: a windscreen, headlamps, a chrome grille
        c.fillStyle = FY.cream; c.fillRect(0, 0, w, h); c.fillStyle = FY.purple; c.fillRect(0, h * .66, w, h * .34); c.fillStyle = FY.teal; c.fillRect(0, 0, w, h * .05);
        c.fillStyle = '#2b3a40'; c.fillRect(w * .08, h * .1, w * .84, h * .32);
        c.fillStyle = '#c9c9c4'; for (let q = 0; q < 6; q++) c.fillRect(w * .3, h * (.7 + q * .03), w * .4, h * .012);
        c.fillStyle = '#fff3c8'; for (const u of [.15, .78]) { c.beginPath(); c.arc(w * (u + .035), h * .72, h * .05, 0, 6.29); c.fill(); }
      }, 1024 * S, 1024 * S);
      const plain = canvasTex((c, w, h) => { c.fillStyle = FY.cream; c.fillRect(0, 0, w, h); c.fillStyle = FY.purple; c.fillRect(0, h * .66, w, h * .34); c.fillStyle = FY.teal; c.fillRect(0, 0, w, h * .05); }, 256, 256);
      const roofC = '#e8e2d3', M = t => K.M(t);
      // body (a box with its own face for each side: +x cab, −x back doors, −z serving side)
      const bodyGeo = lit(new THREE.BoxGeometry(len, H, dep), '#ffffff', .72);
      const body = new THREE.Mesh(bodyGeo, [M(front), M(back), K.paperM, K.paperM, M(plain), M(side)]); body.position.set(0, y0 + H / 2, 0); truck.add(body);
      body.userData.multi = true;
      box(len - .1, .1, dep - .1, roofC, K.paperM, 0, y0 + H + .05, 0, truck);           // roof cap
      box(.5, .26, .5, '#d0cabb', K.paperM, -.6, y0 + H + .2, .1, truck);                 // the extractor on the roof
      cyl(.07, .07, .3, '#9a9a96', K.steelM, .5, y0 + H + .25, .3, 10, truck);           // its little chimney
      box(len + .06, .14, dep + .02, '#2a2a2a', K.steelM, 0, y0 - .04, 0, truck);        // chassis
      for (const sx of [-1, 1]) box(.08, .12, dep + .1, '#bdbdb8', K.steelM, sx * (len / 2 + .05), y0 + .05, 0, truck);   // bumpers
      for (const wx of [len * (.5 - .2), len * (.5 - .82)]) for (const sz of [-1, 1]) {   // wheels (u .2 is the cab end, at +x)
        const t = cyl(.36, .36, .24, '#1a1a1a', black, wx, .36, sz * (dep / 2 - .1), 20, truck); t.rotation.x = Math.PI / 2;
        const hub = cyl(.16, .16, .25, '#c9c9c4', K.steelM, wx, .36, sz * (dep / 2 - .1), 16, truck); hub.rotation.x = Math.PI / 2;
      }
      shade('rect', (len + .7) * sc, (dep + .7) * sc, .5, x, z);
      // the forkyeah logo on the serving side, between the cab and the hatch
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62 / .833), new THREE.MeshBasicMaterial({ map: img('assets/wall/forkyeah/logo.png'), transparent: true, depthWrite: false, color: new THREE.Color(.95, .95, .95) }));
      logo.rotation.y = Math.PI; logo.position.set(len / 2 - .27 * len, y0 + H * .62, -dep / 2 - .004); truck.add(logo);
      // the hatch: an awning flap propped up and out, a counter ledge in front of it, bottles on the ledge
      const hx0 = len / 2 - HU0 * len, hx1 = len / 2 - HU1 * len, hcx = (hx0 + hx1) / 2, hw = hx0 - hx1, htop = y0 + H * (1 - HV0), hbot = y0 + H * (1 - HV1);
      const hinge = new THREE.Group(); hinge.position.set(hcx, htop + .02, -dep / 2); hinge.rotation.x = .42; truck.add(hinge);
      const flapUnder = canvasTex((c, w, h) => { for (let q = 0; q < 12; q++) { c.fillStyle = q % 2 ? FY.orange : FY.cream; c.fillRect(q * w / 12, 0, w / 12, h); } }, 512, 128);
      const flap = new THREE.Mesh(lit(new THREE.BoxGeometry(hw + .14, .035, .82), '#ffffff', .8), [K.paperM, K.paperM, K.paperM, M(flapUnder), K.paperM, K.paperM]); flap.position.set(0, 0, -.41); hinge.add(flap);
      const valance = canvasTex((c, w, h) => { c.fillStyle = FY.teal; c.fillRect(0, 0, w, h * .45); for (let q = 0; q < 14; q++) { c.fillStyle = q % 2 ? FY.orange : FY.purple; c.beginPath(); c.arc((q + .5) * w / 14, h * .45, w / 28, 0, Math.PI); c.fill(); } }, 1024, 160);
      { const v = new THREE.Mesh(new THREE.PlaneGeometry(hw + .14, .2), new THREE.MeshBasicMaterial({ map: valance, transparent: true, alphaTest: .5, side: THREE.DoubleSide })); v.position.set(0, -.1, -.82); v.rotation.x = -.42; hinge.add(v); }   // a scalloped valance hanging off the flap's edge
      for (const sx of [-1, 1]) {   // the two props from the side to the flap
        const a = new THREE.Vector3(hcx + sx * hw / 2, hbot + .35, -dep / 2), b = new THREE.Vector3(hcx + sx * hw / 2, htop + .02 + Math.sin(.42) * .78, -dep / 2 - Math.cos(.42) * .78);
        const d = b.clone().sub(a), rod = new THREE.Mesh(lit(new THREE.CylinderGeometry(.012, .012, d.length(), 8), '#9a9a96'), K.steelM);
        rod.position.copy(a).add(b).multiplyScalar(.5); rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); truck.add(rod);
      }
      box(hw + .14, .045, .34, '#c9c9c4', K.steelM, hcx, hbot - .02, -dep / 2 - .17, truck);   // counter ledge
      for (const sx of [-1, 1]) box(.03, .22, .03, '#8a8a86', K.steelM, hcx + sx * (hw / 2 - .05), hbot - .14, -dep / 2 - .1, truck);
      [['#d9301f', -.5], ['#e8b51e', -.42], ['#f6f1e4', .45]].forEach(([col, dx]) => { cyl(.03, .034, .17, col, K.paperM, hcx + dx, hbot + .09, -dep / 2 - .2, 10, truck); cyl(.012, .02, .04, col, K.paperM, hcx + dx, hbot + .195, -dep / 2 - .2, 8, truck); });   // ketchup, mustard, a napkin pot
      box(.24, .12, .14, '#f6f1e4', K.paperM, hcx + .1, hbot + .06, -dep / 2 - .19, truck);   // a paper boat of fries
      cyl(.07, .05, .05, FY.orange, K.paperM, hcx + .1, hbot + .14, -dep / 2 - .19, 12, truck);
      glowPool((hw + .6) * sc, 2.0, '#ffcf8a', .16, x + hcx * sc, .012, z - dep / 2 * sc - .9);    // the hatch spills warm light on the asphalt
      hall.truckHatch = new THREE.Vector3(x + hcx * sc, (htop + hbot) / 2 * sc, z - dep / 2 * sc);

      // the A-frame chalkboard menu on the asphalt
      const menu = canvasTex((c, w, h) => {
        c.fillStyle = '#1e2422'; c.fillRect(0, 0, w, h);
        for (let k = 0; k < 400; k++) { c.fillStyle = `rgba(255,255,255,${R() * .04})`; c.fillRect(R() * w, R() * h, 2 + R() * 30, 1 + R() * 2); }   // chalk dust
        c.textAlign = 'center'; c.fillStyle = FY.orange; c.font = `800 ${h * .1}px ${DISPLAY}`; c.fillText('MENU', w / 2, h * .14);
        c.textAlign = 'left'; c.fillStyle = '#f3efe4'; c.font = `500 ${h * .055}px ${HAND}`;
        [['Prego no pão', '7'], ['Bifana', '6'], ['Piri-piri fries', '4'], ['Burger do Porto', '9'], ['Pastel de nata', '2'], ['Gelado', '3.5']].forEach(([n, p], i) => {
          const yy = h * (.26 + i * .1); c.fillText(n, w * .1, yy); c.textAlign = 'right'; c.fillText('€' + p, w * .9, yy); c.textAlign = 'left';
          c.fillStyle = 'rgba(243,239,228,.25)'; c.fillRect(w * .1, yy + h * .015, w * .8, 2); c.fillStyle = '#f3efe4'; });
        c.textAlign = 'center'; c.fillStyle = '#e8b51e'; c.font = `800 ${h * .075}px ${DISPLAY}`; c.fillText('DIG IN!', w / 2, h * .9);
      }, 512, 768);
      const af = new THREE.Group(); af.position.set(x + len / 2 * sc - .2, 0, z - dep / 2 * sc - .9); af.rotation.y = .3; g.add(af);
      for (const s of [-1, 1]) {
        const leaf = new THREE.Group(); leaf.position.z = s * .15; leaf.rotation.x = -s * .17; af.add(leaf);   // the feet spread, the tops meet
        box(.6, .9, .03, '#a77a4c', K.woodM, 0, .45, s * .015, leaf);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(.5, .76), new THREE.MeshBasicMaterial({ map: menu })); face.position.set(0, .46, s * .032); if (s < 0) face.rotation.y = Math.PI; leaf.add(face);
      }
      af.updateMatrixWorld(true);
      shade('blob', .9, .6, .35, af.position.x, af.position.z);

      // details: the parrot standing on the roof with his fork, a marquee board with bulbs, wing mirrors, a fold-down step, a gas bottle, "order here", steam
      const roofY = y0 + H + .1;
      { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0 * 401 / 515, 1.0), new THREE.MeshBasicMaterial({ map: img('assets/hall02/mascot.png'), transparent: true, alphaTest: .4, side: THREE.DoubleSide })); m.rotation.y = Math.PI; m.position.set(len / 2 - .55, roofY + .5, -dep / 2 + .35); truck.add(m); }
      const marquee = canvasTex((c, w, h) => { c.fillStyle = FY.teal; c.fillRect(0, 0, w, h); c.fillStyle = FY.cream; c.fillRect(w * .03, h * .14, w * .94, h * .72); c.textAlign = 'center'; c.fillStyle = FY.red; c.font = `800 ${h * .42}px ${DISPLAY}`; c.fillText('FORK YEAH', w * .5, h * .58); c.fillStyle = FY.purple; c.font = `700 ${h * .14}px ${DISPLAY}`; c.fillText('STREET FOOD · DIG IN!', w * .5, h * .79); }, 1024, 256);
      const MW = 1.9, MH = MW / 4, mx = -.35;
      box(MW + .06, MH + .06, .06, '#1a1a1a', black, mx, roofY + MH / 2 + .12, -dep / 2 + .3, truck);
      { const mp = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ map: marquee })); mp.rotation.y = Math.PI; mp.position.set(mx, roofY + MH / 2 + .12, -dep / 2 + .265); truck.add(mp); }
      for (const sx of [-1, 1]) box(.04, .14, .04, '#1a1a1a', black, mx + sx * MW * .4, roofY + .06, -dep / 2 + .3, truck);
      { const bulbs = []; for (let k = 0; k <= 12; k++) { const u = k / 12; bulbs.push([mx - MW / 2 + u * MW, roofY + .12 + MH + .02], [mx - MW / 2 + u * MW, roofY + .1]); } for (let k = 1; k < 3; k++) { const v = k / 3; bulbs.push([mx - MW / 2 - .02, roofY + .12 + v * MH], [mx + MW / 2 + .02, roofY + .12 + v * MH]); }
        const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a8').multiplyScalar(1.6), toneMapped: false }), im = new THREE.InstancedMesh(new THREE.SphereGeometry(.022, 8, 6), bm, bulbs.length), M4 = new THREE.Matrix4();
        bulbs.forEach(([bx, by], i) => im.setMatrixAt(i, M4.makeTranslation(bx, by, -dep / 2 + .25))); truck.add(im); }
      for (const sz of [-1, 1]) { box(.22, .04, .04, '#1a1a1a', black, len / 2 + .1, y0 + H * .72, sz * (dep / 2 + .02), truck); box(.04, .2, .13, '#1a1a1a', black, len / 2 + .2, y0 + H * .72, sz * (dep / 2 + .1), truck); }   // wing mirrors
      box(.6, .03, .26, '#bdbdb8', K.steelM, hcx, .3, -dep / 2 - .13, truck);   // the fold-down step
      for (const sx of [-1, 1]) box(.02, .26, .02, '#8a8a86', K.steelM, hcx + sx * .28, .43, -dep / 2 - .02, truck);
      cyl(.13, .13, .55, '#c4302b', K.paperM, -len / 2 + .25, .3, dep / 2 - .3, 16, truck); cyl(.04, .06, .08, '#9a9a96', K.steelM, -len / 2 + .25, .62, dep / 2 - .3, 10, truck);   // the gas bottle at the back
      const order = canvasTex((c, w, h) => { c.fillStyle = FY.orange; c.fillRect(0, 0, w, h); c.fillStyle = FY.cream; c.textAlign = 'center'; c.font = `800 ${h * .42}px ${DISPLAY}`; c.fillText('ORDER HERE \u2193', w / 2, h * .66); }, 512, 128);
      { const os = new THREE.Mesh(new THREE.PlaneGeometry(.62, .155), new THREE.MeshBasicMaterial({ map: order, side: THREE.DoubleSide })); os.position.set(hcx - hw / 2 + .45, htop - .12, -dep / 2 - .55); os.rotation.y = Math.PI; truck.add(os);
        const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([hcx - hw / 2 + .2, htop - .045, -dep / 2 - .55, hcx - hw / 2 + .2, htop + .26, -dep / 2 - .55, hcx - hw / 2 + .7, htop - .045, -dep / 2 - .55, hcx - hw / 2 + .7, htop + .26, -dep / 2 - .55], 3)); truck.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: '#333' }))); }
      if (!low) {   // a little steam out of the chimney
        const puffs = []; for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.35, .35), new THREE.MeshBasicMaterial({ map: world.softTex(), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); p.position.set(.5, y0 + H + .45, .3); truck.add(p); puffs.push(p); }
        (world.tickers ||= []).push(t => { if (!g.visible) return; puffs.forEach((p, k) => { const u = ((t * .25 + k / 4) % 1); p.position.y = y0 + H + .45 + u * 1.1; p.position.x = .5 + Math.sin(u * 3 + k) * .08; p.scale.setScalar(.6 + u * 1.4); p.material.opacity = Math.sin(u * Math.PI) * .22; p.lookAt(p.position.x, p.position.y, p.position.z - 1); }); });
      }
    },

    // ---------------------------------------------------------------- 3 · string lights all over the hall: zig-zagging wall to wall, a run along each wall, one on the truck's roof edge
    () => {
      const T = TRUCK, ty = (.5 + 2.2 + .02) * T.sc, tz = T.z - T.dep / 2 * T.sc - .02, tl = T.len / 2 * T.sc;
      const spans = [], Y = 5.6;
      const zs = []; for (let z = -7.2; z <= 4.9; z += 1.35) zs.push(z);
      zs.forEach((z, i) => { if (i < zs.length - 1) { const s0 = i % 2 ? 1 : -1; spans.push([new THREE.Vector3(s0 * (xw - .03), Y, z), new THREE.Vector3(-s0 * (xw - .03), Y, zs[i + 1]), .6]); } });
      for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i += 2) spans.push([new THREE.Vector3(sx * (xw - .03), Y, zs[i]), new THREE.Vector3(sx * (xw - .03), Y, Math.min(zs[i + 2] ?? 7.6, 7.6)), .35]);   // scalloped along each wall
      spans.push([new THREE.Vector3(xw - .03, Y, zs[zs.length - 1]), new THREE.Vector3(T.x + tl - .1, ty + .05, tz + .1), .3]);   // down to the truck's roof
      spans.push([new THREE.Vector3(T.x - tl + .05, ty, tz), new THREE.Vector3(T.x + tl - .05, ty, tz), .12]);   // along the truck's roof edge
      const wire = [], bulbs = [];
      for (const [a, b, sag] of spans) {
        const n = 24, len = a.distanceTo(b);
        for (let k = 0; k < n; k++) for (const t of [k / n, (k + 1) / n]) { const p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag; wire.push(p.x, p.y, p.z); }
        const nb = Math.max(3, Math.round(len / .42));
        for (let k = 1; k < nb; k++) { const t = k / nb, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag + .07; bulbs.push(p); }
      }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
      g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#141414' })));
      const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd590').multiplyScalar(1.5), toneMapped: false });
      const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(.04, 10, 8), bm, bulbs.length), M4 = new THREE.Matrix4();
      bulbs.forEach((p, i) => bi.setMatrixAt(i, M4.makeTranslation(p.x, p.y, p.z))); bi.instanceMatrix.needsUpdate = true; g.add(bi);
      if (!low) {   // a soft halo round each bulb
        const pg = new THREE.BufferGeometry(); pg.setFromPoints(bulbs);
        const halo = new THREE.Points(pg, new THREE.PointsMaterial({ map: world.softTex(), color: '#ffb766', size: .42, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
        g.add(halo);
        (world.tickers ||= []).push(t => { if (!g.visible) return; halo.material.opacity = .5 + Math.sin(t * 1.7) * .03 + Math.sin(t * 5.3) * .015; });   // the faintest festival shimmer
      }
    },

    // ---------------------------------------------------------------- 4 · somewhere to eat: café tables with orange folding chairs (like his poster), two striped parasols, food on the tables
    () => {
      const CH = FY.orange, TOP = [FY.teal, FY.cream, FY.teal, FY.cream];
      const SETS = [[1.55, 2.35, 3, 0], [3.4, 3.15, 2, 0], [1.7, 4.0, 3, 0], [.35, 1.9, 3, 0]];   // x, z, chairs, parasol: in front of the truck, (no parasols: they blocked the views)
      const chair = (px, pz, ry) => {
        const c = new THREE.Group(); c.position.set(px, 0, pz); c.rotation.y = ry; g.add(c);
        box(.42, .035, .4, CH, K.paperM, 0, .46, 0, c);                                   // seat
        box(.42, .3, .03, CH, K.paperM, 0, .78, -.19, c).rotation.x = -.1;               // back
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = cyl(.012, .012, .47, '#2a2a2a', K.steelM, sx * .18, .235, sz * .17, 6, c); l.rotation.x = sz * .08; }
      };
      SETS.forEach(([x, z, n, para], k) => { const n0 = g.children.length;
        cyl(.4, .4, .03, TOP[k % 4], K.paperM, x, .74, z, 28);                             // round top
        cyl(.025, .025, .72, '#2a2a2a', K.steelM, x, .37, z, 8); cyl(.2, .22, .03, '#2a2a2a', K.steelM, x, .015, z, 16);
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + k; chair(x + Math.sin(a) * .62, z + Math.cos(a) * .62, a + Math.PI); }
        shade('blob', 1.9, 1.9, .3, x, z);
        // on the table: a paper boat of fries, a cup, a napkin
        box(.16, .06, .1, '#f6f1e4', K.paperM, x + .1, .785, z - .05); cyl(.05, .035, .03, FY.orange, K.paperM, x + .1, .82, z - .05, 10);
        cyl(.035, .03, .11, k % 2 ? FY.red : FY.purple, K.paperM, x - .15, .81, z + .1, 12);
        if (para) {   // a striped parasol through the table
          cyl(.018, .018, 2.3, '#e9e2d2', K.paperM, x, 1.15, z, 8);
          const pg = new THREE.ConeGeometry(.85, .36, 16, 1, true), cols = [], ca = new THREE.Color(FY.orange), cb = new THREE.Color(FY.cream);
          const pos = pg.attributes.position; for (let v = 0; v < pos.count; v++) { const ang = Math.atan2(pos.getZ(v), pos.getX(v)), seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16 + .001) % 2, c = seg ? ca : cb; cols.push(c.r, c.g, c.b); }
          const pm = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide })); pg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); pm.position.set(x, 2.25, z); g.add(pm);
        }
        regroup(n0, x, z).scale.setScalar(1.2);   // chairs and tables at a size people would sit at, next to the truck
      });
    },

    // ---------------------------------------------------------------- 5 · Fork Yeah's street: his eight posters pasted on a limewashed wall over azulejos (like his mockup), bunting, a pot of geraniums;
        () => {
      const PZ0 = 1.75, PZ1 = 5.85, PH = 4.4, wx = xw - .012;
      const plaster = canvasTex((c, w, h) => {   // old limewash: warm white, mottled, a few patches and hairline cracks
        c.fillStyle = '#efe9dd'; c.fillRect(0, 0, w, h);
        for (let k = 0; k < 60; k++) { const x = R() * w, y = R() * h, r = 30 + R() * 140, gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${R() < .5 ? '180,165,140' : '255,252,245'},${.1 + R() * .15})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
        for (let k = 0; k < 9; k++) { const x = R() * w, y = R() * h; c.fillStyle = 'rgba(200,185,160,.35)'; c.beginPath(); c.ellipse(x, y, 20 + R() * 60, 10 + R() * 30, R() * 3, 0, 6.29); c.fill(); }
        c.strokeStyle = 'rgba(120,105,85,.35)'; c.lineWidth = 1.2; for (let k = 0; k < 6; k++) { let x = R() * w, y = R() * h; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (R() - .5) * 40; y += 8 + R() * 22; c.lineTo(x, y); } c.stroke(); }
      }, 1024 * S, 1024 * S);
      const pw = PZ1 - PZ0, wall = new THREE.Mesh(new THREE.PlaneGeometry(pw, PH), new THREE.MeshBasicMaterial({ map: plaster, color: new THREE.Color(.86, .84, .8) }));
      wall.rotation.y = -Math.PI / 2; wall.position.set(wx, PH / 2, (PZ0 + PZ1) / 2); g.add(wall);
      const tiles = canvasTex((c, w, h) => {   // one blue-and-white azulejo, repeated
        c.fillStyle = '#f3efe6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2c4f9e'; c.fillStyle = '#2c4f9e'; c.lineWidth = w * .03;
        for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) { c.beginPath(); c.arc(x, y, w * .26, 0, 6.29); c.stroke(); c.beginPath(); c.arc(x, y, w * .1, 0, 6.29); c.fill(); }
        c.beginPath(); c.arc(w / 2, h / 2, w * .08, 0, 6.29); c.fill();
        for (let k = 0; k < 4; k++) { c.save(); c.translate(w / 2, h / 2); c.rotate(k * Math.PI / 2 + Math.PI / 4); c.beginPath(); c.ellipse(0, -w * .2, w * .06, w * .13, 0, 0, 6.29); c.fill(); c.restore(); }
        c.globalAlpha = .5; for (let k = 0; k < 4; k++) { c.save(); c.translate(w / 2, h / 2); c.rotate(k * Math.PI / 2); c.beginPath(); c.ellipse(0, -w * .3, w * .03, w * .07, 0, 0, 6.29); c.fill(); c.restore(); } c.globalAlpha = 1;
        c.strokeStyle = 'rgba(150,140,120,.6)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
      }, 128, 128, true);
      const TH = .84; tiles.repeat.set(pw / .15, TH / .15);
      const dado = new THREE.Mesh(new THREE.PlaneGeometry(pw, TH), new THREE.MeshBasicMaterial({ map: tiles, color: new THREE.Color(.86, .86, .86) })); dado.rotation.y = -Math.PI / 2; dado.position.set(wx - .004, .08 + TH / 2, (PZ0 + PZ1) / 2); g.add(dado);
      box(.03, .04, pw, '#d9d2c4', K.paperM, wx - .015, .08 + TH + .02, (PZ0 + PZ1) / 2);   // a stone cap on the tiles
      // the eight posters, two rows, pasted a little crooked
      const W = .8, H = W * 1.413, gap = (pw - 4 * W - .3) / 3;
      for (let i = 0; i < 8; i++) {
        const col = i % 4, row = i < 4 ? 0 : 1, pz = PZ0 + .15 + W / 2 + col * (W + gap), py = row ? 1.52 : 2.78;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: img(`assets/hall02/poster_${i + 1}.jpg`), color: new THREE.Color(.95, .94, .92) }));
        m.rotation.set(0, -Math.PI / 2, 0); m.rotateZ((R() - .5) * .03); m.position.set(wx - .008 - i * .0004, py, pz); g.add(m);
      }
      // bunting along the top of the wall: triangles in the festival colours
      const flagCols = [FY.red, FY.orange, FY.teal, FY.purple, '#e8b51e'].map(c => new THREE.Color(c)), pos = [], cols = [];
      const drape = (a, b, sag, n) => { for (let k = 0; k < n; k++) { const t0 = (k + .1) / n, t1 = (k + .9) / n, tm = (t0 + t1) / 2, P = t => { const p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag; return p; }; const p0 = P(t0), p1 = P(t1), pm = P(tm); pm.y -= .2; const c = flagCols[k % 5]; pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, pm.x, pm.y, pm.z); for (let q = 0; q < 3; q++) cols.push(c.r, c.g, c.b); } };
      drape(new THREE.Vector3(wx - .06, 4.05, PZ0 + .05), new THREE.Vector3(wx - .06, 4.05, PZ1 - .05), .28, 14);
      drape(new THREE.Vector3(xw - .03, 4.9, PZ1 + .2), new THREE.Vector3(TRUCK.x + TRUCK.len / 2 * TRUCK.sc - .3, 3.2, TRUCK.z - TRUCK.dep / 2 * TRUCK.sc + .05), .25, 6);   // and from the wall to the truck
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.add(new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(.92, .9, .88) })));
      // a terracotta pot of red geraniums at the foot of the wall
      { const px = xw - .32, pz = PZ0 - .35;
        cyl(.2, .15, .36, '#b8603a', K.paperM, px, .18, pz, 18); cyl(.215, .215, .05, '#a9542f', K.paperM, px, .35, pz, 18);
        const leaves = new THREE.InstancedMesh(lit(new THREE.IcosahedronGeometry(.09, 0), '#3f6b33', .7), K.paperM, 18), flowers = new THREE.InstancedMesh(lit(new THREE.IcosahedronGeometry(.045, 0), '#d9262b', .75), K.paperM, 14), M4 = new THREE.Matrix4();
        for (let k = 0; k < 18; k++) { const a = R() * 6.28, r = R() * .2; leaves.setMatrixAt(k, M4.makeTranslation(px + Math.cos(a) * r, .45 + R() * .2, pz + Math.sin(a) * r)); }
        for (let k = 0; k < 14; k++) { const a = R() * 6.28, r = R() * .22; flowers.setMatrixAt(k, M4.makeTranslation(px + Math.cos(a) * r, .6 + R() * .2, pz + Math.sin(a) * r)); }
        g.add(leaves, flowers); shade('blob', .7, .7, .4, px, pz); }

    },

    // ---------------------------------------------------------------- 6 · the Brain 2.0 store: a small, calm shop in a loud festival.
    //   Built as if its back were on Brain's wall (facing +x), then turned to stand against the end wall.
    //   Ash slats, a framed "Brains forget. Systems don't." print, shelves of his notebooks (his own cover artwork on proper rounded books),
    //   totes in his canvas print hanging on the outside, a counter with pens, pencils, sticky notes, a mug and dried flowers,
    //   two warm pendant bulbs, the dark sign lit from within, memory cards on threads, and the mark thrown on the ground.
    () => {
      const { z0, z1, d } = KIOSK, zc = (z0 + z1) / 2, len = z1 - z0, xb = -xw, xf = -xw + d, n0 = g.children.length;
      const ASH = '#f2e8d8', ASH_D = '#ddcdb4', ASH_DD = '#c9b593', LINEN = '#e6dccb';
      const glowMat = (map, k = 1.12) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k), toneMapped: false });
      const coverM = K.M(img('assets/hall02/brain_notebook.jpg'), { color: new THREE.Color(.86, .83, .78) }), toteT = img('assets/hall02/brain_tote.jpg'), stickyM = K.M(img('assets/hall02/brain_sticky.jpg'));
      const plainM = K.paperM, pagesM = K.sheetsM;
      const rbox = (w, h, dd, col, r = .004) => lit(new RoundedBoxGeometry(w, h, dd, 2, Math.min(r, w / 2, h / 2, dd / 2) * .99), col, .82);
      // a notebook standing face-out: cover on its +x face, page edges on top / bottom / fore-edge, a darker spine
      const notebook = (x, y, z, lean = .14, s = 1) => {
        const m = new THREE.Mesh(rbox(.013 * s, .21 * s, .148 * s, '#ffffff'), [coverM, plainM, pagesM, pagesM, pagesM, plainM]);
        m.position.set(x, y + .105 * s, z); m.rotation.z = -lean; g.add(m); return m;
      };
      const stack = (x, y, z, n, ry = 0) => { for (let k = 0; k < n; k++) { const m = new THREE.Mesh(rbox(.148, .013, .21, k % 2 ? '#f4efe6' : '#ece6da'), [pagesM, pagesM, coverM, plainM, pagesM, pagesM]); m.position.set(x, y + .0065 + k * .0135, z); m.rotation.y = ry + (R() - .5) * .08; g.add(m); } };

      // the shop: an ash deck, a slatted back, posts, rails, linen sides, the awning
      box(d, .06, len, ASH_D, K.woodM, xb + d / 2, .03, zc);
      for (let k = 0; k < 18; k++) { const w = len / 18; box(.04, 2.72, w - .008, k % 2 ? ASH : '#eadcc6', K.woodM, xb + .03, 1.42, z0 + w * (k + .5)); }   // vertical slats
      for (const z of [z0 + .04, z1 - .04]) { box(.07, 2.95, .07, ASH, K.woodM, xf - .04, 1.475, z); box(d, .07, .07, ASH, K.woodM, xb + d / 2, 2.9, z); box(d - .1, 2.75, .04, LINEN, K.paperM, xb + d / 2 - .02, 1.405, z); }
      { const aw = new THREE.Mesh(lit(new THREE.BoxGeometry(.55, .02, len + .1), LINEN, .8), K.paperM); aw.position.set(xf + .22, 2.78, zc); aw.rotation.z = -.32; g.add(aw); }
      const scal = canvasTex((c, w, h) => { c.fillStyle = '#e6dccb'; for (let q = 0; q < 16; q++) { c.beginPath(); c.arc((q + .5) * w / 16, 0, w / 32, 0, Math.PI); c.fill(); } c.fillRect(0, 0, w, 2); }, 1024, 64);
      { const v = new THREE.Mesh(new THREE.PlaneGeometry(len + .1, .1), new THREE.MeshBasicMaterial({ map: scal, transparent: true, alphaTest: .5, side: THREE.DoubleSide, color: new THREE.Color(.92, .9, .86) })); v.rotation.y = Math.PI / 2; v.position.set(xf + .48, 2.65, zc); g.add(v); }

      // the sign: a deep oak frame on the roof rails, a linen face with the logo in deep brown, a hairline border and the line under it, a warm halo behind
      { const SW = len + .26, SHh = .74, sy = 3.24;
        box(.12, SHh + .1, SW + .1, '#b98a58', K.woodM, xf - .03, sy, zc);
        const face = canvasTex((c, w, h) => {
          c.fillStyle = '#efe7d8'; c.fillRect(0, 0, w, h);
          for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(150,130,100,${.03 + R() * .05})`; c.fillRect(0, y, w, 1); }
          for (let x = 0; x < w; x += 2) { c.fillStyle = `rgba(255,252,244,${.03 + R() * .04})`; c.fillRect(x, 0, 1, h); }
          const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,210,.35)'); gr.addColorStop(.5, 'rgba(255,240,210,0)'); gr.addColorStop(1, 'rgba(90,60,30,.12)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
          c.strokeStyle = 'rgba(74,51,34,.55)'; c.lineWidth = 3; c.strokeRect(w * .018, h * .07, w * .964, h * .86);
        }, 2048, Math.round(2048 * SHh / SW));
        const fp = new THREE.Mesh(new THREE.PlaneGeometry(SW, SHh), new THREE.MeshBasicMaterial({ map: face, color: new THREE.Color(1.02, 1.0, .97), toneMapped: false })); fp.rotation.y = Math.PI / 2; fp.position.set(xf + .035, sy, zc); g.add(fp);
        const lg = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.62 / 2.606), new THREE.MeshBasicMaterial({ map: img('assets/wall/brain/logo.png'), transparent: true, depthWrite: false, color: new THREE.Color('#3a2516') })); lg.rotation.y = Math.PI / 2; lg.position.set(xf + .042, sy, zc); g.add(lg);
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(SW + 1.2, SHh + 1.0), new THREE.MeshBasicMaterial({ map: world.softTex(), color: '#ffe3b0', transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.y = Math.PI / 2; halo.position.set(xf - .12, sy, zc); g.add(halo);
        for (const dz of [-SW / 2 + .25, SW / 2 - .25]) box(.04, .14, .04, '#2a2420', black, xf - .03, sy - SHh / 2 - .1, zc + dz);   // brackets onto the rails
      }

      // on the back: the framed print, two shelves of notebooks, a plant, the dried flowers
      { const pw = .98, ph = pw * 576 / 1024; box(.03, ph + .07, pw + .07, '#2a2420', black, xb + .07, 2.36, zc);
        const pp = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: img('assets/hall02/brain_poster.jpg'), color: new THREE.Color(1.05, 1.05, 1.05) })); pp.rotation.y = Math.PI / 2; pp.position.set(xb + .088, 2.36, zc); g.add(pp); }
      for (const y of [1.32, 1.78]) {
        box(.26, .028, len - .16, ASH, K.woodM, xb + .18, y, zc);
        for (const sz of [-1, 0, 1]) box(.2, .07, .02, ASH_DD, K.woodM, xb + .14, y - .05, zc + sz * (len / 2 - .2));   // brackets
      }
      // lower shelf: face-out notebooks in a row, a stack at each end
      for (let k = 0; k < 6; k++) notebook(xb + .17, 1.334, z0 + .55 + k * .32, .12 + (k % 2) * .04);
      stack(xb + .18, 1.334, z0 + .2, 6, Math.PI / 2); stack(xb + .18, 1.334, z1 - .2, 5, Math.PI / 2);
      // upper shelf: a stack, three face-out, a plant, the dried flowers in a pale vase
      stack(xb + .18, 1.794, z0 + .9, 4, Math.PI / 2);
      for (let k = 0; k < 3; k++) notebook(xb + .17, 1.794, zc - .05 + k * .3, .13);
      { const px = xb + .17, pz = z0 + .3; cyl(.07, .055, .12, '#d8cbb6', K.paperM, px, 1.854, pz, 16);
        const lv = new THREE.InstancedMesh(lit(new THREE.IcosahedronGeometry(.05, 0), '#5d7a4c', .7), K.paperM, 22), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
        for (let k = 0; k < 22; k++) { const a = R() * 6.28, r = R() * .09; lv.setMatrixAt(k, M4.compose(new THREE.Vector3(px + Math.cos(a) * r, 1.95 + R() * .2, pz + Math.sin(a) * r), Q.setFromEuler(E.set(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(1, .45, 1.6))); }
        g.add(lv); }
      { const px = xb + .17, pz = z1 - .35; cyl(.045, .055, .16, '#efe9df', K.paperM, px, 1.874, pz, 16);
        const st = []; for (let k = 0; k < 9; k++) { const a = R() * 6.28, h = .22 + R() * .14; st.push(px, 1.95, pz, px + Math.cos(a) * .09, 1.95 + h, pz + Math.sin(a) * .09); }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(st, 3)); g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: '#a08a6a' })));
        const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(.009, 6, 4), new THREE.MeshBasicMaterial({ color: '#f1e7d6' }), 60), M4 = new THREE.Matrix4();
        for (let k = 0; k < 60; k++) { const s = (k % 9) * 6; const t = .55 + R() * .45; fl.setMatrixAt(k, M4.makeTranslation(st[s] + (st[s + 3] - st[s]) * t + (R() - .5) * .04, st[s + 1] + (st[s + 4] - st[s + 1]) * t + (R() - .5) * .03, st[s + 2] + (st[s + 5] - st[s + 2]) * t + (R() - .5) * .04)); }
        g.add(fl); }

      // the counter: ash, a linen runner, its front a lit panel of the pattern
      box(.5, .06, len - .1, ASH, K.woodM, xf - .27, 1.0, zc);
      box(.42, .9, len - .2, '#e6d9c2', K.woodM, xf - .3, .5, zc);
      { const pt = img('assets/case/brain/b03.jpg'); pt.repeat.set(1, .85); pt.offset.set(0, .075); const p = new THREE.Mesh(new THREE.PlaneGeometry(len - .2, .82), glowMat(pt, .92)); p.material.color.multiply(new THREE.Color(1, .97, .9)); p.rotation.y = Math.PI / 2; p.position.set(xf - .085, .53, zc); g.add(p); }
      { const m = new THREE.Mesh(lit(new THREE.BoxGeometry(.3, .004, len - .5), '#e9e0cf', .95), K.matM); m.position.set(xf - .27, 1.032, zc); g.add(m); }
      const ct = 1.034, cx = xf - .27;
      // a notebook on a little easel, open-faced to you
      { const e = notebook(cx - .05, ct, zc - .75, .32, 1.25); e.position.x = cx - .02; box(.1, .012, .16, ASH_DD, K.woodM, cx + .02, ct + .006, zc - .75); }
      stack(cx, ct, zc - .4, 3, .2);
      // sticky-note pads, a fan of three
      for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(rbox(.076, .018, .076, '#ffffff', .002), [plainM, plainM, stickyM, plainM, plainM, plainM]); m.position.set(cx + .02, ct + .009 + k * .019, zc - .05); m.rotation.y = k * .25; g.add(m); }
      // a wooden tray of pens and pencils
      { box(.12, .02, .3, ASH_DD, K.woodM, cx + .02, ct + .01, zc + .28);
        for (let k = 0; k < 5; k++) { const pencil = k % 2; const c = cyl(.0055, .0055, pencil ? .175 : .14, pencil ? '#c9c4bb' : '#1b1b1b', pencil ? K.paperM : black, cx - .03 + k * .022, ct + .028, zc + .28, 8); c.rotation.x = Math.PI / 2; } }
      // eraser sleeves in a small bowl
      { cyl(.06, .04, .04, '#e9e2d6', K.paperM, cx - .06, ct + .02, zc + .62, 16); for (let k = 0; k < 4; k++) { const er = box(.05, .015, .022, '#e8e0d2', K.paperM, cx - .06 + (R() - .5) * .05, ct + .045, zc + .62 + (R() - .5) * .05); er.rotation.y = R() * 3; } }
      // the mug of chai
      { cyl(.04, .036, .09, '#e3dccf', K.paperM, cx + .05, ct + .045, zc + .85, 18); const tea = new THREE.Mesh(new THREE.CircleGeometry(.035, 18), new THREE.MeshBasicMaterial({ color: '#a8784a' })); tea.rotation.x = -Math.PI / 2; tea.position.set(cx + .05, ct + .086, zc + .85); g.add(tea);
        const hd = new THREE.Mesh(lit(new THREE.TorusGeometry(.022, .006, 6, 12), '#e3dccf'), K.paperM); hd.position.set(cx + .05, ct + .045, zc + .85 + .045); g.add(hd); }
      const card = canvasTex((c, w, h) => { c.fillStyle = '#f3ede2'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a3322'; c.textAlign = 'center'; c.font = `400 ${h * .2}px ${HAND}`; c.fillText('archives', w / 2, h * .42); c.fillText('for the future', w / 2, h * .72); }, 256, 160);
      { const cp = new THREE.Mesh(new THREE.PlaneGeometry(.2, .125), new THREE.MeshBasicMaterial({ map: card })); cp.rotation.set(0, Math.PI / 2, 0); cp.rotateX(-.25); cp.position.set(cx + .16, ct + .065, zc + .05); g.add(cp); }

      // totes in his canvas print, hanging on a peg rail on the outside wall that faces the truck
      { const sz = z1 + .005; box(1.15, .05, .04, ASH, K.woodM, xb + d / 2 - .02, 1.67, sz + .02);
        const totePlane = (front) => { const ge = new THREE.PlaneGeometry(.3, .34, 6, 8), p = ge.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / .3 + .5, v = p.getY(i) / .34 + .5; p.setZ(i, (front ? 1 : -1) * .018 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.2))); } ge.computeVertexNormals(); return lit(ge, '#ffffff', .85); };
        const toteFront = K.M(toteT, { color: new THREE.Color(.9, .87, .82) }), toteBack = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#e9e0cf' });
        [-.38, 0, .38].forEach((dx, k) => {
          const t = new THREE.Group(); t.position.set(xb + d / 2 - .02 + dx, 1.25, sz + .04); t.rotation.z = (k - 1) * .03; g.add(t);
          t.add(new THREE.Mesh(totePlane(true), toteFront)); const b = new THREE.Mesh(totePlane(false), toteBack); b.position.z = -.012; t.add(b);
          for (const s of [-1, 1]) { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * .07, .17, 0), new THREE.Vector3(s * .05, .3, .005), new THREE.Vector3(0, .42, .01), new THREE.Vector3(-s * .01, .3, .005), new THREE.Vector3(-s * .03, .17, 0)]);
            t.add(new THREE.Mesh(lit(new THREE.TubeGeometry(curve, 16, .008, 5), '#e2d8c6', .85), K.paperM)); }
          box(.022, .022, .06, ASH_DD, K.woodM, 0, .42, -.02, t);   // its peg
        }); }

      // two warm pendant bulbs inside
      for (const dz of [-.7, .7]) {
        const cord = new THREE.BufferGeometry(); cord.setAttribute('position', new THREE.Float32BufferAttribute([xf - .45, 2.9, zc + dz, xf - .45, 2.42, zc + dz], 3)); g.add(new THREE.LineSegments(cord, new THREE.LineBasicMaterial({ color: '#222' })));
        cyl(.025, .025, .05, '#2a2420', black, xf - .45, 2.4, zc + dz, 10);
        const b = new THREE.Mesh(new THREE.SphereGeometry(.045, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd79a').multiplyScalar(1.7), toneMapped: false })); b.position.set(xf - .45, 2.33, zc + dz); g.add(b);
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshBasicMaterial({ map: world.softTex(), color: '#ffc77a', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.y = Math.PI / 2; halo.position.set(xf - .43, 2.33, zc + dz); g.add(halo);
      }
      glowPool(.9, len, '#ffe2b4', .18, cx, ct + .01, zc);                 // their light on the counter
      glowPool(len, 1.8, '#ffe9c8', .1, xb + .1, 1.7, zc, 0).rotation.y = Math.PI / 2;   // and on the back

      // the mark thrown on the asphalt in front, breathing very slowly
      const gobo = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: img('assets/hall02/brain_mark.png'), color: '#fff1d6', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
      gobo.rotation.x = -Math.PI / 2; gobo.position.set(xf + 1.2, .016, zc); gobo.userData.dynamic = true; g.add(gobo);
      glowPool(2.6, 3.2, '#fff4e2', .12, xf + 1.0, .013, zc);

      // memory cards on threads under the awning, each a word in his hand, turning a little in the air
      const WORDS = ['idea', 'remember', 'system', 'archive', 'notes', 'keep', 'later', 'why?', 'today'];
      const swing = [];
      WORDS.forEach((wd, i) => {
        const t = canvasTex((c, w, h) => { c.fillStyle = '#f6f0e4'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(160,140,115,.35)'; c.lineWidth = 2; for (let y = h * .62; y < h; y += h * .18) { c.beginPath(); c.moveTo(w * .06, y); c.lineTo(w * .94, y); c.stroke(); } c.fillStyle = '#4a3322'; c.textAlign = 'center'; c.font = `italic 400 ${h * .42}px ${HAND}`; c.fillText(wd, w / 2, h * .52); }, 256, 160);
        const zz = z0 + .2 + i * (len - .4) / (WORDS.length - 1), xx = xf + .08 + (i % 2) * .2, yy = 2.25 + ((i * 37) % 5) * .06;
        const piv = new THREE.Group(); piv.position.set(xx, 2.7, zz); piv.userData.dynamic = true; g.add(piv);
        const card = new THREE.Mesh(new THREE.PlaneGeometry(.2, .125), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.08, 1.06, 1.02), toneMapped: false, side: THREE.DoubleSide }));
        card.position.y = yy - 2.7; card.rotation.y = Math.PI / 2; piv.add(card);
        const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, yy - 2.7 + .0625, 0], 3));
        piv.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: '#8a7a66' }))); swing.push([piv, i * 1.7]);
      });
      (world.tickers ||= []).push(t => {
        if (!g.visible) return;
        for (const [p, ph] of swing) { p.rotation.y = Math.sin(t * .5 + ph) * .45; p.rotation.x = Math.sin(t * .7 + ph * 1.3) * .03; }
        gobo.material.opacity = .34 + Math.sin(t * .4) * .06; gobo.rotation.z = t * .02;
      });
      shade('rect', d + .9, len + .8, .35, xb + d / 2 + .2, zc);
      const st = regroup(n0, xb, zc); st.rotation.y = Math.PI / 2; st.scale.setScalar(KIOSK.sc); st.position.set(KIOSK.X, 0, KIOSK.Z);   // its back on the end wall, facing the door
    },

    // ---------------------------------------------------------------- 7 · the festival up front: an entrance arch you walk under, the parrot greeting you, olive trees,
    //                                                                      the parrot as a giant cut-out greeting you, and bunting criss-crossing overhead
    () => {
      // the arch: two striped plywood pillars and a sign board edged with bulbs
      const AZ = -7.25, AX = 3.0, AH = 3.55, SW = 6.9, SH = 1.05;
      const stripes = canvasTex((c, w, h) => { const cols = [FY.orange, FY.cream, FY.purple, FY.cream]; for (let q = 0; q < 16; q++) { c.fillStyle = cols[q % 4]; c.fillRect(0, q * h / 16, w, h / 16 + 1); } }, 64, 512);
      for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(lit(new THREE.BoxGeometry(.42, AH, .32), '#ffffff', .78), K.M(stripes)); p.position.set(sx * AX, AH / 2, AZ); g.add(p);
        box(.56, .1, .44, '#2a2a2a', K.steelM, sx * AX, .05, AZ);
        shade('rect', .9, .8, .35, sx * AX, AZ);
      }
      const archT = canvasTex((c, w, h) => {
        c.fillStyle = FY.teal; c.fillRect(0, 0, w, h); c.fillStyle = FY.cream; c.fillRect(w * .012, h * .06, w * .976, h * .88);
        c.textAlign = 'center'; const word = (txt, x, col, f) => { c.fillStyle = col; c.font = f; c.fillText(txt, x, h * .64); };
        const f = `800 ${h * .5}px ${DISPLAY}`; c.font = f; const parts = [['FORK', FY.red], [' ', FY.red], ['YEAH', FY.purple]], wsum = parts.reduce((a, [t]) => a + c.measureText(t).width, 0);
        let x = w * .5 - wsum / 2; for (const [t, col] of parts) { const tw = c.measureText(t).width; word(t, x + tw / 2, col, f); x += tw; }
        c.fillStyle = FY.orange; c.font = `700 ${h * .16}px ${DISPLAY}`; c.fillText('FOOD FESTIVAL  ·  DIG IN!  ·  ALCAFOZES', w / 2, h * .86);
      }, 2048, 312);
      const sb = new THREE.Group(); sb.position.set(0, AH + SH / 2 - .05, AZ); g.add(sb);
      box(SW + .1, SH + .1, .1, '#1a1a1a', black, 0, 0, .02, sb);
      for (const sgn of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: archT })); f.position.z = sgn * .075; if (sgn < 0) f.rotation.y = Math.PI; sb.add(f); }   // readable from the door and from inside
      { const bl = []; const n = 30; for (let k = 0; k <= n; k++) { const x = -SW / 2 + k * SW / n; bl.push([x, SH / 2 + .02], [x, -SH / 2 - .02]); } for (let k = 1; k < 4; k++) { const y = -SH / 2 + k * SH / 4; bl.push([-SW / 2 - .03, y], [SW / 2 + .03, y]); }
        const im = new THREE.InstancedMesh(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a8').multiplyScalar(1.6), toneMapped: false }), bl.length * 2), M4 = new THREE.Matrix4();
        let i = 0; for (const [x, y] of bl) for (const z of [-.085, .085]) im.setMatrixAt(i++, M4.makeTranslation(x, y, z)); sb.add(im); }

      // the parrot, a 1.5 m plywood cut-out on a strut, greeting you on the left as you come in
      { const H2 = 1.5, W2 = H2 * 401 / 515, px = 3.75, pz = -7.5;
        const cut = new THREE.Group(); cut.position.set(px, 0, pz); cut.rotation.y = Math.PI + .3; g.add(cut);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(W2, H2), new THREE.MeshBasicMaterial({ map: img('assets/hall02/mascot.png'), transparent: true, alphaTest: .4 })); face.position.set(0, H2 / 2 + .06, 0); cut.add(face);
        const ply = new THREE.Mesh(new THREE.PlaneGeometry(W2, H2), new THREE.MeshBasicMaterial({ color: '#a8885f', map: img('assets/hall02/mascot.png'), alphaTest: .4, transparent: true, side: THREE.BackSide })); ply.position.set(0, H2 / 2 + .06, -.012); cut.add(ply);
        const strut = new THREE.Mesh(lit(new THREE.BoxGeometry(.05, 1.1, .05), '#b98a58'), K.woodM); strut.position.set(0, .55, -.3); strut.rotation.x = -.3; cut.add(strut);
        box(.42, .06, .26, '#2a2a2a', K.steelM, 0, .03, .0, cut);
        shade('blob', 1.1, .8, .35, px, pz); }

      // trees here and there: young olive trees in oak planters (kept clear of every wall of work and every view)
      { const TREES = [[-.2, 7.3, 1.05]], leaves = [], LV = ['#6f8a58', '#5b7647', '#84a06a', '#7a9460'];
        for (const [x, z, sc] of TREES) {
          box(.62 * sc, .5 * sc, .62 * sc, '#b98a58', K.woodM, x, .25 * sc, z);
          box(.66 * sc, .05 * sc, .66 * sc, '#a77a4c', K.woodM, x, .5 * sc, z);
          const soil = new THREE.Mesh(new THREE.CircleGeometry(.26 * sc, 16), new THREE.MeshBasicMaterial({ color: '#3a2a1c' })); soil.rotation.x = -Math.PI / 2; soil.position.set(x, .53 * sc, z); g.add(soil);
          let px2 = x, pz2 = z, py = .5 * sc;   // a trunk in three bending pieces
          for (let k = 0; k < 3; k++) { const hgt = (.55 - k * .08) * sc, nx = px2 + (R() - .5) * .14, nz = pz2 + (R() - .5) * .14, a = new THREE.Vector3(px2, py, pz2), b = new THREE.Vector3(nx, py + hgt, nz), dv = b.clone().sub(a);
            const tr = new THREE.Mesh(lit(new THREE.CylinderGeometry(.045 * sc - k * .008, .06 * sc - k * .008, dv.length(), 8), '#7a6a58', .7), K.paperM); tr.position.copy(a).add(b).multiplyScalar(.5); tr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize()); g.add(tr);
            px2 = nx; pz2 = nz; py += hgt; }
          for (let k = 0; k < 46; k++) { const a = R() * 6.28, r = R() * .62 * sc, y = py - .15 + R() * .85 * sc - r * .25; leaves.push([px2 + Math.cos(a) * r, y, pz2 + Math.sin(a) * r, (.16 + R() * .14) * sc]); }
          shade('blob', 1.4 * sc, 1.4 * sc, .4, x, z);
        }
        const im = new THREE.InstancedMesh(lit(new THREE.IcosahedronGeometry(1, 1), '#ffffff', .62), K.paperM, leaves.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), C = new THREE.Color();
        leaves.forEach(([x, y, z, r], k) => { im.setMatrixAt(k, M4.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(E.set(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(r, r * .62, r))); im.setColorAt(k, C.set(LV[k % 4])); });
        g.add(im); }

      // bunting criss-crossing overhead, between the string lights
      const flagCols = [FY.red, FY.orange, FY.teal, FY.purple, '#e8b51e'].map(c => new THREE.Color(c)), pos = [], cols = [];
      const drape = (a, b, sag, n) => { for (let k = 0; k < n; k++) { const t0 = (k + .1) / n, t1 = (k + .9) / n, tm = (t0 + t1) / 2, P = t => { const p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag; return p; }; const p0 = P(t0), p1 = P(t1), pm = P(tm); pm.y -= .26; const c = flagCols[k % 5]; pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, pm.x, pm.y, pm.z); for (let q = 0; q < 3; q++) cols.push(c.r, c.g, c.b); } };
      const BY = 5.7;
      for (let z = -6.4; z < 4.6; z += 2.7) { drape(new THREE.Vector3(-xw + .05, BY, z), new THREE.Vector3(xw - .05, BY, z + 1.35), .8, 17); drape(new THREE.Vector3(xw - .05, BY, z), new THREE.Vector3(-xw + .05, BY, z + 1.35), .8, 17); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.add(new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(.9, .88, .86) })));
    },
  ];
}

/* more stops on Hall 02's walk (the two walls come from data.js): Brain's kiosk after its wall; the poster street and the truck's hatch after Fork Yeah's */
export function identityStops(world, hall) {
  const g = hall.group, xw = 4.47;
  const mk = (id, z, pose, zoom) => { const o = new THREE.Object3D(); o.userData = { type: 'work', id, hallId: hall.def.id, frame: o, size: [2, 1], z, pose, zoom, salon: true }; g.add(o); hall.exhibits.push(o); return o; };
  const T = TRUCK, hx = T.x + (T.len / 2 - (.38 + .86) / 2 * T.len) * T.sc, fz = T.z - T.dep / 2 * T.sc;
  const Kc = (KIOSK.z0 + KIOSK.z1) / 2;
  const KF = KIOSK.Z - KIOSK.d * KIOSK.sc;   // the stall's front
  mk('brain', -3.01, [KIOSK.X - .1, 2.9, KF - 6.6, KIOSK.X, 1.75, KF + .2], 50);   // in front of Brain's stall, its mark on the ground at your feet
  mk('forkyeah', 2.0, [.15, 2.15, 3.8, xw, 2.1, 3.8], 60);   // the poster street
  mk('forkyeah', 5.0, [hx - .4, 2.1, fz - 5.0, hx + .1, 1.85, fz], 50);   // in the queue at the hatch, the tables on your right
}
