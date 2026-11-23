/* =========================================================
   THE BACK ROOM: recap desk with real physics
   Nothing opens. Grab, throw, stack, push things off the table.
   ========================================================= */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { WORKS, DESK_ITEMS, coverOf } from './data.js';

const loader = new THREE.TextureLoader();
const covers = {};
function cover(id) {
  const w = WORKS[id];
  if (!w || w.cover === false || w.aspect === undefined) return null;
  if (!covers[id]) { const t = loader.load(coverOf(id)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; covers[id] = t; }
  return covers[id];
}

const TABLE = { w: 4.6, d: 2.6, h: 1.0, t: .1 };

function paperTexture(work, w, d) {
  const c = document.createElement('canvas');
  const ratio = w / d; c.width = 512; c.height = Math.round(512 / ratio);
  const x = c.getContext('2d');
  x.fillStyle = '#e9e1d3'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(80,60,40,${Math.random() * .05})`; x.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); }
  x.fillStyle = work.color; x.fillRect(c.width * .08, c.height * .08, c.width * .84, c.height * .46);
  x.fillStyle = '#1b1210'; x.font = `600 ${Math.round(c.width * .075)}px Fraunces, Georgia, serif`;
  x.fillText(work.title, c.width * .08, c.height * .68);
  x.font = `500 ${Math.round(c.width * .035)}px Inter, sans-serif`; x.globalAlpha = .55;
  x.fillText(work.cat.toUpperCase(), c.width * .08, c.height * .78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class Desk {
  constructor(scene, origin) {
    this.scene = scene; this.origin = origin.clone();
    this.group = new THREE.Group(); this.group.position.copy(origin); scene.add(this.group);
    this.top = TABLE.h + TABLE.t / 2;
    this.items = []; this.active = false; this.t = 0;

    /* ---------- physics world ---------- */
    const W = this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    W.allowSleep = true; W.broadphase = new CANNON.SAPBroadphase(W);
    W.defaultContactMaterial.friction = .42; W.defaultContactMaterial.restitution = .12;
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); W.addBody(ground);
    const tableBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(TABLE.w / 2, TABLE.t / 2, TABLE.d / 2)) });
    tableBody.position.set(0, TABLE.h, 0); W.addBody(tableBody);
    // invisible room walls so thrown things bounce back
    for (const [x, z, ry] of [[0, -7.5, 0], [0, 7.5, Math.PI], [-7.5, 0, Math.PI / 2], [7.5, 0, -Math.PI / 2]]) {
      const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
      b.position.set(x, 0, z); b.quaternion.setFromEuler(0, ry, 0); W.addBody(b);
    }
    this.jointBody = new CANNON.Body({ mass: 0 }); this.jointBody.collisionFilterGroup = 0; this.jointBody.collisionFilterMask = 0; W.addBody(this.jointBody);

    /* ---------- table + lamp ---------- */
    const wood = new THREE.MeshStandardMaterial({ color: '#2a1610', roughness: .55, metalness: .05 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, TABLE.t, TABLE.d), wood);
    top.position.y = TABLE.h; top.receiveShadow = true; top.castShadow = true; this.group.add(top);
    const legG = new THREE.BoxGeometry(.12, TABLE.h - TABLE.t / 2, .12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(legG, wood); l.position.set(sx * (TABLE.w / 2 - .2), (TABLE.h - TABLE.t / 2) / 2, sz * (TABLE.d / 2 - .2)); l.castShadow = true; this.group.add(l);
    }
    // no hanging lamp (it stood between you and the castle): a flush spot in the ceiling lights the desk
    const can = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .04, 32), new THREE.MeshBasicMaterial({ color: '#141414' }));
    can.position.set(0, 6.47, -.2); this.group.add(can);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.1, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd2a0').multiplyScalar(2.2), toneMapped: false }));
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 6.445, -.2); this.group.add(lens);
    this.lampPos = new THREE.Vector3(0, 3.0, 0).add(origin);
    const spot = this.spot = new THREE.SpotLight('#ffc48e', 34, 12, .42, .6, 1.3);
    spot.position.set(0, 6.4, -.2); spot.target.position.set(0, 0, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(this.shadowSize || 768, this.shadowSize || 768); spot.shadow.bias = -.0006; spot.shadow.radius = 5;
    this.group.add(spot, spot.target);
    // warm pool on the floor
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), new THREE.MeshBasicMaterial({ color: '#ff8a4a', transparent: true, opacity: .025, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = .01; this.group.add(pool);

    /* ---------- the things on the table ---------- */
    const physMat = new CANNON.Material('obj'), paperMat = new CANNON.Material('paper');
    W.addContactMaterial(new CANNON.ContactMaterial(paperMat, W.defaultMaterial, { friction: .7, restitution: .02 }));
    let n = 0;
    const add = (id, def, k = 0) => {
      const work = WORKS[id] || { title: id, cat: '', color: '#c33b2c' };
      let geo, shape, mass, paper = false;
      const col = new THREE.Color(work.color);
      const art = cover(id);
      let mat = art ? new THREE.MeshStandardMaterial({ map: art, roughness: .55, metalness: .05 }) : new THREE.MeshStandardMaterial({ color: col, roughness: .55, metalness: .05 });
      if (def.shape === 'box' || def.shape === 'book') {
        const [w, h, d] = def.size; geo = new THREE.BoxGeometry(w, h, d);
        shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)); mass = def.shape === 'book' ? .35 : Math.max(.05, w * h * d * 9);
        if (def.shape === 'book') { const edge = new THREE.MeshStandardMaterial({ color: '#e2d9ca', roughness: .9 }); mat = [edge, edge, new THREE.MeshStandardMaterial({ map: art || paperTexture(work, w, d), roughness: .8 }), edge, edge, edge]; }
      } else if (def.shape === 'bottle') {
        const [r, h] = def.size;
        const prof = [[0, -h / 2], [r, -h / 2], [r, h * .18], [r * .45, h * .34], [r * .4, h / 2], [0, h / 2]].map(([a, b]) => new THREE.Vector2(a, b));
        geo = new THREE.LatheGeometry(prof, 28);
        mat = new THREE.MeshStandardMaterial({ color: '#141010', map: art, roughness: .18, metalness: .3, emissive: col, emissiveIntensity: .05 });
        shape = new CANNON.Cylinder(r, r, h, 14); mass = .7;
      } else if (def.shape === 'hex') {
        const [r, h] = def.size; geo = new THREE.CylinderGeometry(r, r, h, 6);
        shape = new CANNON.Cylinder(r, r, h, 6); mass = .25;
      } else { // paper
        const [w, d] = def.size; const th = .012; paper = true;
        geo = new THREE.BoxGeometry(w, th, d);
        const face = new THREE.MeshStandardMaterial({ map: art || paperTexture(work, w, d), roughness: .9 });
        const edge = new THREE.MeshStandardMaterial({ color: '#d8cfbf', roughness: .9 });
        mat = [edge, edge, face, edge, edge, edge];
        shape = new CANNON.Box(new CANNON.Vec3(w / 2, th / 2, d / 2)); mass = .04;
      }
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
      const body = new CANNON.Body({ mass, shape, material: paper ? paperMat : physMat, angularDamping: paper ? .4 : .12, linearDamping: paper ? .08 : .02 });
      body.sleepSpeedLimit = .12; body.sleepTimeLimit = .6;
      const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#ff3b2a', transparent: true, opacity: .28 }));
      const item = { id, mesh, body, ghost, paper, i: n++, solid: false, home: null };
      mesh.userData.deskItem = item;
      this.items.push(item); this.group.add(mesh, ghost);
      return item;
    };
    DESK_ITEMS.forEach(def => { for (let k = 0; k < (def.count || 1); k++) add(def.id, def, k); });
    // a few sketch sheets + the contact card (always there)
    WORKS.sketch = WORKS.sketch || { title: 'Sketches', cat: 'Process', color: '#b9ad99' };
    WORKS.contact = WORKS.contact || { title: 'Say hello', cat: 'Contact', color: '#c3261b' };
    // (the sketches and the contact card are gone: the desk shows the real work now)
    this.arrange(true);
  }

  /* lay everything out in a calm, designed order */
  arrange(instant) {
    const cols = 7, rows = 3;
    this.items.forEach((it, i) => {
      const c = i % cols, r = Math.floor(i / cols) % rows;
      const x = (c - (cols - 1) / 2) * .62 + (Math.random() - .5) * .08;
      const z = (r - (rows - 1) / 2) * .76 + (Math.random() - .5) * .08;
      const y = instant ? this.top + .3 : this.top + 1.4 + i * .18;
      it.home = new CANNON.Vec3(x, y, z);
      it.body.position.copy(it.home);
      it.body.velocity.setZero(); it.body.angularVelocity.setZero();
      it.body.quaternion.setFromEuler(instant ? 0 : (Math.random() - .5) * .6, (Math.random() - .5) * .6, instant ? 0 : (Math.random() - .5) * .6);
      it.body.wakeUp();
      it.ghost.position.set(x, this.top + .1, z); it.ghost.quaternion.set(0, 0, 0, 1);
    });
  }

  /* projects you have not visited stay as faint red outlines */
  setVisited(visited) {
    for (const it of this.items) {
      const solid = it.always || visited.has(it.id);
      if (solid && !it.solid) { this.world.addBody(it.body); it.solid = true; }
      if (!solid && it.solid) { this.world.removeBody(it.body); it.solid = false; }
      it.mesh.visible = solid; it.ghost.visible = !solid;
    }
  }

  cleanUp() { this.arrange(false); }

  /* ---------- grabbing ---------- */
  pick(raycaster) {
    const meshes = this.items.filter(i => i.solid).map(i => i.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const it = hit.object.userData.deskItem;
    const local = this.group.worldToLocal(hit.point.clone());
    const pivot = new CANNON.Vec3(local.x, local.y, local.z);
    it.body.pointToLocalFrame(pivot, pivot);
    this.jointBody.position.set(local.x, local.y, local.z);
    this.constraint = new CANNON.PointToPointConstraint(it.body, pivot, this.jointBody, new CANNON.Vec3(0, 0, 0), 40);
    this.world.addConstraint(this.constraint);
    it.body.wakeUp(); it.body.angularDamping = .7;
    this.held = it;
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(hit.point.y + .28));
    return it;
  }
  drag(raycaster) {
    if (!this.held) return;
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(this.dragPlane, p)) {
      const l = this.group.worldToLocal(p);
      this.jointBody.position.set(THREE.MathUtils.clamp(l.x, -6.5, 6.5), l.y, THREE.MathUtils.clamp(l.z, -6.5, 6.5));
    }
  }
  release() {
    if (!this.held) return;
    this.world.removeConstraint(this.constraint); this.constraint = null;
    this.held.body.angularDamping = this.held.paper ? .4 : .12;
    this.held = null;
  }
  hoverItem(raycaster) {
    const meshes = this.items.filter(i => i.solid).map(i => i.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.deskItem : null;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    for (const it of this.items) {
      if (!it.solid || !it.paper || it === this.held) continue;
      const b = it.body, v = b.velocity;
      // paper falls like paper: slow, swaying, tumbling
      if (v.y < -.25) {
        v.y = Math.max(v.y, -1.3);
        const s = Math.sin(this.t * 5 + it.i * 1.7);
        b.applyForce(new CANNON.Vec3(s * .22, 0, Math.cos(this.t * 4 + it.i) * .18), b.position);
        b.angularVelocity.x += Math.sin(this.t * 6 + it.i) * 6 * dt;
        b.angularVelocity.z += Math.cos(this.t * 5 + it.i) * 6 * dt;
      }
    }
    this.world.fixedStep(1 / 60, dt);
    let awake = !!this.held;   // anything still moving? (the museum only redraws the desk's shadows while something is)
    for (const it of this.items) {
      if (!it.solid) continue;
      if (it.body.sleepState !== CANNON.Body.SLEEPING) awake = true;
      it.mesh.position.copy(it.body.position); it.mesh.quaternion.copy(it.body.quaternion);
    }
    this.awake = awake;
  }
}
