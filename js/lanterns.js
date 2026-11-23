/* =========================================================
   PAPER LANTERNS: a cloud of rice-paper globes packed under a hall's ceiling
   Drawn live (sharp at any distance): fine horizontal ribs, warm translucent paper that
   glows brightest near the bulb, an open bottom showing the bright inside, a thin wire rim.
   Positions come from Blender (lanterns.json), so they sit exactly where the baked light comes from.
   ========================================================= */
import * as THREE from 'three';

const VS = `
  attribute float aR; attribute float aSeed;
  uniform float uTime;
  varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vRibs; varying float vSeed;
  void main(){
    vP = position; vSeed = aSeed;
    vRibs = aR * 2. / .042 / 3.14159;                          // a rib every ~4 cm of paper
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
    w.x += sin(uTime * .35 + aSeed * 6.) * .006; w.z += cos(uTime * .3 + aSeed * 4.) * .006;   // the faintest drift
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FS = `
  uniform float uBright;
  varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vRibs; varying float vSeed;
  void main(){
    float lat = acos(clamp(vP.y, -1., 1.));                    // 0 at the top .. pi at the bottom
    if (lat > 2.74) discard;                                   // the open bottom
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    float ndv = abs(dot(N, V));
    // fine horizontal ribs: thin darker lines, a soft ridge between them
    float f = fract(lat * vRibs);
    float rib = smoothstep(0., .1, f) * smoothstep(1., .9, f);
    float ridge = .94 + .06 * sin(f * 3.14159);
    // the light from the bulb: brightest low down, a warm hot spot, softer towards the top
    float low = smoothstep(.4, 2.6, lat);
    float hot = exp(-pow((lat - 2.15) * 1.7, 2.));
    float b = (.7 + .45 * low + .4 * hot) * ridge * mix(.8, 1., rib) * (.88 + .12 * ndv);
    vec3 paper = vec3(1., .84, .62);                           // warm rice paper with a bulb behind it (strong enough to survive tone mapping)
    vec3 col = paper * b;
    if (!gl_FrontFacing) col = vec3(1.1, .88, .58) * (1.05 + .3 * low);   // the inside, seen through the opening: bright and warm
    // a thin wire rim around the opening
    col = mix(col, vec3(.28, .24, .2), smoothstep(2.66, 2.7, lat) * (1. - smoothstep(2.72, 2.74, lat)));
    gl_FragColor = vec4(col * uBright, 1.);
  }`;

export async function buildLanterns(scene, url, halls, time) {
  let data = {};
  try { data = await (await fetch(url, { cache: 'no-store' })).json(); } catch (e) { return []; }
  const made = [];
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: time, uBright: { value: .8 } }, vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e2').multiplyScalar(2.4) });
  for (const [hid, list] of Object.entries(data)) {
    if (!list.length) continue;
    const geo = new THREE.SphereGeometry(1, 56, 40);
    const n = list.length;
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), bulbMat, n);
    const aR = new Float32Array(n), aSeed = new Float32Array(n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(([x, y, z, r0, sq], i) => {
      const r = r0 * 1.26, yC = y + (r - r0) * sq * .35;          // bigger, so the cloud reads as one mass (the extra tucks into the ceiling)
      e.set(0, (i * 2.399) % 6.283, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, yC, z), q, new THREE.Vector3(r, r * sq, r)); mesh.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, yC - r * sq * .45, z), q, new THREE.Vector3(r * .09, r * .09, r * .09)); bulbs.setMatrixAt(i, m4);
      aR[i] = r; aSeed[i] = (i * .618) % 1;
    });
    geo.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    mesh.instanceMatrix.needsUpdate = true; bulbs.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false; bulbs.frustumCulled = false;
    scene.add(mesh); scene.add(bulbs); made.push(mesh, bulbs);
    if (halls && halls[hid]) halls[hid].lanterns = mesh;
  }
  return made;
}
