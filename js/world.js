/* =========================================================
   THE MUSEUM: a body with CenterPiece as its heart.
   Red ink runs through veins in the floor to every hall.
   ========================================================= */
import * as THREE from 'three';
import { DEVICE, mob, loadFull } from './device.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Worm3D, TEAL } from './creature3d.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HALLS, BACKROOM, WORKS, DESK_ITEMS, ORDER, N_ROOMS, hallOf, coverOf } from './data.js';
import { Butterfly, makeChrysalis } from './butterfly.js';
import { Desk } from './desk.js';
import { CeilingEye } from './ceiling-eye.js';
import { WeaveWall } from './weave-wall.js';
import { buildLanterns } from './lanterns.js';
import { bankSteps, bankStops, sleeveVinyl } from './bank-hall.js';
import { studioSteps } from './studio-hall.js';
import { identitySteps, identityStops } from './identity-hall.js';
import { stone, velvet, curtainGeometry, archSurround, archCurve, taperedTube } from './materials.js';

const TIME = { value: 0 }; // one clock for every shader
const BAKED = true;
const PAVILION = false;    // CenterPiece as the iris pavilion (tried 2026-11-12, replaced by the loom)
const LOOM = true;         // CenterPiece as a round loom on an eye-shaped dais; the worm weaves the handmade works on it, live
const LOOM_RL = 2.4, LOOM_Y = 3.45, DAIS_R = 3.4, DAIS_Y = .32;   // loom ring radius and centre height; the dais (its top is the eye seen from above)        // rooms come from Blender (assets/museum), light baked in Cycles
const NO_ART = true;       // artwork stays out for now: empty frames and vitrines...
const ART_HALLS = new Set(['packaging', 'identity', 'campaigns', 'editorial', 'redesign']);   // ...except the halls Naveen has signed off (Hall 01 + Hall 02, 2026-11-10)
const artIn = hallId => !NO_ART || ART_HALLS.has(hallId);
// Hall 01: each vitrine holds the real 3D package (trials/products.js), built from his artwork at true size
const CASE_MODEL = { altura: 'altura', kazaar: 'kazaar', cheese: 'cheese_open', donuts: 'donut', misty: 'matches', playable: 'playable' };
const TALL_CASE = new Set(['kazaar', 'playable']);   // the bottle and the hanger box stand tall: aim higher, step back a touch
let productsMod = null;
const loadProducts = () => productsMod || (productsMod = import('../trials/products.js'));

/* ---------- layout ---------- */
const R = 15, WALL_H = 10, ARCH_W = 5, ARCH_H = 6.6, HALL_W = 9, HALL_H = 7, CH_R = 2.5, ORBIT_R = 12.4, EYE = 2.2;
const N = N_ROOMS, STEP = Math.PI * 2 / N, R0 = R - 0.3, ARCH_CAM_R = 4.3;
const ARC_R = 13.4; // the inner arcade ring (matches blender/build_museum.py)
const angleOf = k => k * Math.PI * 2 / N;
const LOCAL = /^(127\.|localhost$|\[::1\])/.test(location.hostname);
const Z_STALE = (n, at) => n - at > 3;   // an occlusion answer older than 3 frames is not trusted
const dir = a => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
const rightOf = a => new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
const hallLen = n => Math.max(16, 8 + n * 3.2);
const CENTER = new THREE.Vector3(0, 2.7, 0);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = t => t * t * (3 - 2 * t);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------- reusable shaders ---------- */
const NOISE = `
  float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float n21(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }`;

function veinMaterial(shared, len, swell = .02, offset = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uBoost: { value: 0 }, uBoostT: { value: -10 }, uLen: { value: len }, uSwell: { value: swell }, uOff: { value: offset } },
    vertexShader: `uniform float uTime,uLen,uSwell,uOff; varying float vX; varying float vPulse; varying vec3 vN; varying vec3 vV;
      void main(){
        vX=uOff+uv.x*uLen;
        float ph=uTime*7.5-vX*.9;
        // each heartbeat swells the vessel as it passes through
        float pulse=pow(max(0.,sin(ph*.5)),28.)+pow(max(0.,sin(ph*.5-1.1)),40.)*.6;
        vPulse=pulse;
        vec3 p=position+normal*pulse*uSwell;
        vec4 mv=modelViewMatrix*vec4(p,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vX; varying float vPulse; varying vec3 vN; varying vec3 vV; uniform float uTime,uBeat,uBoost,uBoostT,uVein;
      void main(){
        float f=abs(dot(normalize(vN),normalize(vV)));          // 1 = facing you, 0 = the edge
        float core=pow(f,1.6);
        vec3 deep=vec3(.22,.008,.01), hot=vec3(1.,.085,.05);
        float boost=exp(-pow((vX-(uTime-uBoostT)*14.)/2.2,2.))*uBoost;
        vec3 c=mix(deep,hot*.62,core*.6)*uVein + hot*vPulse*(.95+uBeat)*(.3+core*.8) + hot*boost*2.4;
        c+=vec3(.5,.03,.02)*pow(1.-f,3.)*.25;                    // a dark, wet rim
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function weaveMaterial(map, shared) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uReveal: { value: 1 }, uTime: shared.uTime, uHover: { value: 0 }, uLit: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uReveal,uTime,uHover,uLit;
      ${NOISE}
      void main(){
        // red ink strands weave the work into existence (the worm in reverse)
        float strands=n21(vec2(vUv.x*70.,vUv.y*2.+uTime*.15))*.6+n21(vec2(vUv.x*14.,vUv.y*5.))*.4;
        float thr=uReveal*1.35-(1.-vUv.y)*.3-strands*.32;
        float m=smoothstep(0.,.05,thr);
        float edge=smoothstep(.09,0.,abs(thr-.02))*(uReveal<1.?1.:0.);
        vec3 art=texture2D(uMap,vUv).rgb;
        vec3 c=art*m*(.8+uLit*.25+uHover*.1)+vec3(1.,.08,.05)*edge*3.+vec3(.25,.02,.02)*strands*(1.-m)*.25;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function coneMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#ffe9d6') }, uI: { value: .14 }, uTime: TIME },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform vec3 uColor; uniform float uI,uTime;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float ndv=dot(vN,vV)/max(1e-4,length(vN)*length(vV));
        float edge=pow(clamp(abs(ndv),0.,1.),2.2);   // soft edges, no hard outline (guarded: NaN showed as black dashes on white)
        float drift=n(vUv*vec2(9.,3.)+vec2(0.,-uTime*.06))*.6+n(vUv*vec2(23.,7.)+vec2(uTime*.03,0.))*.4;
        float a=pow(clamp(vUv.y,0.,1.),1.4)*(1.-smoothstep(.9,1.,vUv.y))*edge*uI*(.6+.7*drift);
        gl_FragColor=vec4(uColor*max(a,0.),1.); }`,
  });
}
function poolMaterial(color = '#ff6a4a', i = .25) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: i } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uI;
      void main(){ float d=length(vUv-.5)*2.; gl_FragColor=vec4(uColor*pow(max(0.,1.-d),2.2)*uI,1.); }`,
  });
}

/* ---------- canvas text ---------- */
function textTexture(draw, w = 1024, h = 512, full = false) {
  // phones/tablets: drawn at half size (the same drawing, scaled), a quarter of the GPU memory; iPhone Safari closes a page that holds too much
  const S = !full && DEVICE.mobile ? .5 : 1;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * S)); c.height = Math.max(1, Math.round(h * S));
  const x = c.getContext('2d'); if (S !== 1) x.scale(S, S); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const SERIF = 'Fraunces, Georgia, serif', SANS = 'Inter, system-ui, sans-serif', ITALIC = '"Instrument Serif", Georgia, serif';

// lettering painted straight onto plinths and walls (2026-11-25, his pick): the name in Bodoni, one line about the idea in Hanken, deep red
const BODONI = '"Bodoni Moda", Didot, Georgia, serif', HANKEN = '"Hanken Grotesk", "Helvetica Neue", Arial, sans-serif';
const hookOf = work => work.hook || (work.cat || '').split(' · ').join(', ');
function letterLabel(work, align, light) {   // light: cream letters for the dark feature walls   // a transparent texture: the words only, no card
  return textTexture((x, w, hh) => {
    const X = align === 'right' ? w - 40 : align === 'center' ? w / 2 : 40; x.textAlign = align || 'left';
    let fs = 118; x.font = `500 ${fs}px ${BODONI}`; while (x.measureText(work.title).width > w - 80 && fs > 60) { fs -= 4; x.font = `500 ${fs}px ${BODONI}`; }
    x.fillStyle = light ? '#f1e9dc' : '#2a1d12'; x.fillText(work.title, X, 150);
    x.fillStyle = light ? '#f0a597' : '#8a1b12'; x.font = `500 40px ${HANKEN}`; x.fillText(hookOf(work), X, 230);
  }, 1024, 330);
}
const letterMat = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, color: new THREE.Color(.92, .9, .88) });

function placeholderArt(work, aspect) {
  const w = 1024, h = Math.round(1024 / aspect);
  return textTexture((x) => {
    const g = x.createLinearGradient(0, 0, w, h);
    const c = new THREE.Color(work.color);
    g.addColorStop(0, `#${c.clone().multiplyScalar(.55).getHexString()}`); g.addColorStop(1, `#${c.clone().multiplyScalar(.16).getHexString()}`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .03})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(255,240,230,.18)'; x.lineWidth = 2; x.strokeRect(36, 36, w - 72, h - 72);
    x.fillStyle = '#f2e9dc'; x.font = `500 ${Math.round(Math.min(w, h) * .13)}px ${SERIF}`;
    x.fillText(work.title, 70, h * .55);
    x.font = `600 ${Math.round(Math.min(w, h) * .035)}px ${SANS}`; x.globalAlpha = .7;
    x.fillText(work.cat.toUpperCase().split('').join(' '), 72, h * .55 + Math.min(w, h) * .09);
    x.globalAlpha = .4; x.fillText('ARTWORK ARRIVES IN THE ART PHASE', 72, h - 70);
  }, w, h);
}

/* ---------- quality tiers: an RTX gets the full museum ---------- */
function detectTier(renderer) {
  let forced = new URLSearchParams(location.search).get('q');
  try { forced = forced || localStorage.getItem('ng-quality'); } catch (e) {}
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  const integrated = /intel|swiftshader|llvmpipe|microsoft basic/i.test(gpu);
  const discrete = !integrated && /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|apple m\d/i.test(gpu);   // every Apple M chip carries the full museum (it lowers resolution itself if a frame runs slow)
  const auto = discrete ? 'high' : 'low';
  const ok = forced === 'high' || forced === 'low';
  if (DEVICE.mobile) return { tier: 'low', device: DEVICE.kind, auto: 'low', forced: null, gpu, integrated: true };   // phones and tablets: the light museum, with their own settings (MOBILE_Q)
  return { tier: integrated ? 'low' : (ok ? forced : auto), device: 'desktop', auto, forced: ok ? forced : null, gpu, integrated };   // built-in graphics always start light (they can't carry the high tier)
}
const TIERS = {
  high: { prStart: Math.min(devicePixelRatio, 1.25), prMax: Math.min(devicePixelRatio, 1.5), prMin: .8, msaa: 2, reflect: 0, hallLights: true, softShadows: true, shadowMap: 2048, dust: 1400, flock: 0 },
  low:  { prStart: Math.min(devicePixelRatio, 1), prMax: Math.min(devicePixelRatio, 1.1), prMin: .6, msaa: 0, reflect: 0, hallLights: false, softShadows: false, shadowMap: 768, dust: 350, flock: 0 },
};
// phones and tablets (on top of 'low'): their screens are dense (2-3x), so the resolution is held lower and adapts with the frame rate; smaller shadow maps, less dust
const MOBILE_Q = {
  phone:  { prStart: Math.min(devicePixelRatio, 1.25), prMax: Math.min(devicePixelRatio, 1.75), prMin: .75, shadowMap: 512, dust: 120, noShadows: true },   // (1.25x on a 3x screen read as blur; adapt() lowers it if the phone can't hold the frame rate)
  tablet: { prStart: Math.min(devicePixelRatio, 1.25), prMax: Math.min(devicePixelRatio, 1.75), prMin: .8, shadowMap: 768, dust: 200, noShadows: true },
};

/* =========================================================
   MUSEUM
   ========================================================= */
export class Museum {
  constructor(canvas, ui) {
    this.ui = ui; this.canvas = canvas;
    this.readyP = new Promise(res => (this._readyResolve = res)); this.ready = false;
    // every texture and model reports here: the Enter button fills with ink as the museum loads
    // everything is loaded and prepared BEFORE the visitor can enter (nothing loads while walking):
    // the rotunda is the first quarter of the bar, then every hall picture, bake, package, the castle and their shaders
    this.prep = { n: 0, d: 0, open: 3 };   // open = parts still to finish (hall bakes, pictures, builds)
    this.allReadyP = new Promise(res => (this._allReadyResolve = res)); this.allReady = false;
    this.prepAdd = (k = 1) => { this.prep.n += k; };
    this.prepTick = (k = 1) => { this.prep.d += k; this.prepReport(); };
    this.prepPart = () => { this.prep.open--; this.prepReport(); };
    this.prepReport = () => {
      const f = this.prep.n ? Math.min(1, this.prep.d / this.prep.n) : 0;
      if (!this.allReady) ui.progress && ui.progress(Math.min(.99, .25 + .74 * f));
      if (!this.allReady && this.ready && this.prep.open <= 0 && this.prep.d >= this.prep.n && !(this._upQ && this._upQ.length)) {
        this.allReady = true; this.mark('ready'); ui.progress && ui.progress(1); this._allReadyResolve();
      }
    };
    THREE.DefaultLoadingManager.onProgress = (url, done, total) => ui.progress && !this.allReady && ui.progress(.25 * done / Math.max(1, total));
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    // (no clipping planes: they made every shader need a second version. Seeing in from above uses the camera's near limit instead.)
    this.gpu = detectTier(r); this.Q = { ...TIERS[this.gpu.tier], ...(MOBILE_Q[this.gpu.device] || {}) };
    if (/[?&]stats/.test(location.search)) { const el = document.createElement('pre'); el.style.cssText = 'position:fixed;left:6px;top:calc(env(safe-area-inset-top,0px) + 70px);z-index:999;margin:0;padding:6px 8px;font:10px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.72);border-radius:6px;pointer-events:none;white-space:pre-wrap;max-width:92vw'; document.body.appendChild(el); this._stats = { el }; this.mark('start'); }
    this.prMax = this.Q.prMax; this.pr = this.Q.prStart;
    r.setPixelRatio(this.pr); r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1;
    r.shadowMap.enabled = !this.Q.noShadows; r.shadowMap.type = this.Q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; r.shadowMap.autoUpdate = false;
    this.reflectors = []; this.floorOverlays = [];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e6e0d7');
    this.fog = this.scene.fog = new THREE.FogExp2('#e6e0d7', .008);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .05, 220);
    // HDR target, multisampled (anti-aliased) on strong GPUs
    const rt = new THREE.WebGLRenderTarget(innerWidth * this.pr, innerHeight * this.pr, { type: THREE.HalfFloatType, samples: this.Q.msaa });
    this.composer = new EffectComposer(r, rt);
    { const rp = new RenderPass(this.scene, this.camera), draw = rp.render.bind(rp), cut = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 7.7)];
      rp.render = (...a) => { const r = a[0]; r.clippingPlanes = this.nearCut && !DEVICE.mobile ? cut : []; try { draw(...a); }   /* (phones/tablets: no cut, it needs a second version of every shader) */ finally { r.clippingPlanes = []; } };   // from above: a level cut at the ceiling (the old near-plane trick tilted with the camera and sliced the eye)
      this.composer.addPass(rp); }
    // safety net: one invalid pixel (NaN/Inf) would otherwise be smeared over the whole screen by the bloom
    this.composer.addPass(this.nanPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); if(any(isnan(c))||any(isinf(c))) c=vec4(0.,0.,0.,1.); gl_FragColor=clamp(c,0.,64.); }',
    }));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .3, .5, 1.05);   // only real light glows (white walls must not)
    this.composer.addPass(this.bloom);
    if (this.gpu.tier === 'low') this.bloom.enabled = this.nanPass.enabled = false;   // built-in graphics: skip the glow pass (and its NaN guard, which only protects the glow)
    this.composer.addPass(new OutputPass());
    this.focus = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uC: { value: new THREE.Vector2(.5, .5) }, uR: { value: .34 }, uAsp: { value: innerWidth / innerHeight } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt,uR,uAsp; uniform vec2 uC; varying vec2 vUv;
        void main(){
          vec2 d=vUv-uC; d.x*=uAsp; float k=smoothstep(uR,uR+.32,length(d))*uAmt;
          vec4 c=texture2D(tDiffuse,vUv); if(k<.01){ gl_FragColor=c; return; }
          vec3 s=c.rgb; float tw=1.;
          for(int i=0;i<16;i++){ float a=float(i)*2.39996; float r=sqrt(float(i)+.5)/4.*k*.012; vec2 o=vec2(cos(a),sin(a))*r; o.x/=uAsp; s+=texture2D(tDiffuse,vUv+o).rgb; tw+=1.; }
          gl_FragColor=vec4(s/tw,1.); }`,
    });
    this.composer.addPass(this.focus);
    this.film = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: .022 }, uVig: { value: .28 }, uCA: { value: .003 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uGrain,uVig,uCA; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){ vec2 c=vUv-.5; float d=dot(c,c); vec2 o=c*d*uCA;
          vec3 col=vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b);
          col*=1.-d*uVig; col+=(h(vUv*vec2(1733.,977.)+fract(uTime*7.)*91.)-.5)*uGrain;
          gl_FragColor=vec4(col,1.); }`,
    });
    this.composer.addPass(this.film);

    this.shared = { uTime: TIME, uBeat: { value: 0 }, uVein: { value: 1 } };
    this.sway = new THREE.Vector3();
    this.goalPos = new THREE.Vector3(); this.goalLook = new THREE.Vector3(); this.lookCur = new THREE.Vector3();
    this.velPos = new THREE.Vector3(); this.velLook = new THREE.Vector3(); this.snapNext = true;
    this.interactive = []; this.frames = []; this.veins = {}; this.ceilings = []; this.halls = {};
    this.visited = new Set(JSON.parse(sessionStorage.getItem('ng-visited') || '[]'));
    // CenterPiece is the finale: it opens once the visitor has walked the halls (or reached the back room)
    this.hallsSeen = new Set(JSON.parse(sessionStorage.getItem('ng-halls') || '[]'));
    this.heartOpen = sessionStorage.getItem('ng-heart') === 'open'; this.heartReveal = this.heartOpen ? 1 : 0;
    this.state = 'idle'; this.place = null;
    this.mouse = new THREE.Vector2(); this.ndc = new THREE.Vector2(); this.ray = new THREE.Raycaster(); this.ray.layers.enableAll();   // (it reaches things skipped by the arch-view culling too)
    // where you stand in the rotunda: angle a, h = how much you face the heart (1) vs the halls (0)
    this.ring = { a: Math.PI, h: 1, hT: 1, vel: 0, snap: null, dragging: false };
    this.look = { x: 0, y: 0 }; this.lookOff = { x: 0, y: 0 };
    this.hallZ = 0; this.hallZT = 0;
    this.clock = new THREE.Clock();
    this.loader = new THREE.TextureLoader();
    { // first things first: the Rotunda's own light and the heart load alone; every hall picture waits until they are in (they were all racing it)
      const real = this.loader.load.bind(this.loader), queue = []; this._gate = false;
      const bmp = window.createImageBitmap ? new THREE.ImageBitmapLoader(new THREE.LoadingManager()).setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' }) : null;
      this.loader.load = (url, onLoad, onProg, onErr) => {
        if (this._gate || /bake_(rot|cp)_|centerpiece/.test(url)) return real(url, onLoad, onProg, onErr);
        const t = new THREE.Texture(), pri = hallRank(url); this.prepAdd(); let counted = false; if (DEVICE.mobile && mob(url) !== url) t.userData.fullSrc = url; /* (phones: a lighter copy now, the full one when you stand at it) */ const tick = () => { if (!counted) { counted = true; this.prepTick(); } };
        if (bmp) { t.flipY = false; queue.push(Object.assign(() => bmp.load(url, img => { t.image = img; t.needsUpdate = true; onLoad && onLoad(t); this.idleUpload(t); tick(); }, onProg, e => { tick(); onErr && onErr(e); }), { pri })); }   // decoded off the main thread, already flipped
        else queue.push(Object.assign(() => real(url, tt => { t.image = tt.image; t.needsUpdate = true; onLoad && onLoad(t); this.idleUpload(t); tick(); }, onProg, e => { tick(); onErr && onErr(e); }), { pri }));
        if (this._gate) this._pump && this._pump();
        return t;
      };
      // pictures go to the GPU in quiet moments, one at a time, not in the frame they first come into view (that froze the walk for seconds)
      const up = this._upQ = []; let busy = false;
      const onGPU = t => { const p = this.renderer.properties.get(t); return !!p.__webglTexture && p.__version === t.version; };
      this.idleUpload = t => {
        if (!t || !t.image || onGPU(t) || up.includes(t)) return;   // already there (or queued): nothing to do
        up.push(t); this.prepAdd(); if (busy) return; busy = true;
        // behind the loading screen: short timed bursts (~12 ms) so it finishes fast and the opening keeps moving; after that, only in idle moments
        const next = () => (this.allReady || this.entered) ? (window.requestIdleCallback || setTimeout)(step, { timeout: 150 }) : setTimeout(step, 30);
        const step = dl => {
          const t0 = performance.now(); let k = 0;
          while (up.length && (k === 0 || ((this.allReady || this.entered) ? (dl && dl.timeRemaining && dl.timeRemaining() > 6) : performance.now() - t0 < 12))) { const x = up.shift(); try { if (!onGPU(x)) this.renderer.initTexture(x); } catch (e) {} this.prepTick(); k++; }
          if (!up.length) { busy = false; this.prepReport(); return; }
          next();
        };
        next();
      };
      // pictures arrive in walking order (Hall 01 first), and the hall you are heading for always jumps the queue
      const walk = [...HALLS].sort((a, b) => a.k - b.k), seg = {};
      walk.forEach((h, i) => h.works.forEach(id => { seg[id] = i; if (WORKS[id]?.case) seg[WORKS[id].case] = i; }));
      function hallRank(url) { for (const p of url.split(/[\/?#.]/)) if (p in seg) return seg[p]; return 50; }
      const heading = () => {   // the hall the visitor is in or walking towards
        const J = this.journey; if (!J || !J.nodes) return -1;
        const n = J.nodes.find(n => n.d >= (J.s ?? 0) - .5 && (n.facing || walk.some(h => h.id === n.place)));
        const id = n ? (n.facing || n.place) : null; return walk.findIndex(h => h.id === id);
      };
      let pumping = false;
      this._pump = () => { if (pumping) return; pumping = true; (async () => {
        while (queue.length) {
          const want = heading();
          queue.sort((a, b) => ((a.pri === want ? -1 : a.pri) - (b.pri === want ? -1 : b.pri)));
          queue.splice(0, LOCAL ? 4 : 8).forEach(f => f());   // (the local test server handles few connections; Netlify's CDN many)
          await new Promise(r => setTimeout(r, LOCAL ? 180 : 40));
        }
        pumping = false; if (!this._galleryDone) { this._galleryDone = true; this.prepPart(); } })(); };
      this.openGate = () => { if (this._gate) return; this._gate = true; this._pump(); };
      setTimeout(() => this.openGate(), 9000);   // never wait forever
    }

    this.buildLights(); this.buildRotunda(); this.buildHeart();
    this.buildStrip(); this.buildFloorNumbers();
    // the NavGod eye lives in the oculus
    this.ceilEye = new CeilingEye(this.scene, { y: WALL_H + 1.55, r: 3.6 }); this.ceilEye.setOpen(this.heartOpen);
    this.ceilEye.onBlink = () => { if (this.state === 'rotunda') this.ui.sound?.blink?.(); };
    // the halls are built one at a time between frames, so the opening keeps playing smoothly while the museum assembles behind it
    this.hallsBuilt = new Promise(res => (this._hallsDone = res));
    { const steps = [...HALLS.map(h => () => this.buildHall(h)), () => this.buildBackroom(), () => this.buildDust(), () => this.archNames()];
      (async () => {
        const run = async f => { await new Promise(r => setTimeout(r, 16)); const t0 = performance.now(); try { f(); } catch (e) { console.warn('[NavGod] build', e); } (this._buildT || (this._buildT = [])).push(Math.round(performance.now() - t0)); };
        for (const f of steps) { await run(f); while (this._pending?.length) await run(this._pending.shift()); }
        this.scene.updateMatrixWorld(true); this.setMood(this.mood ?? 1); this._hallsDone();
      })(); }
    this.butterfly = new Butterfly(this.scene, .27, { dust: false, glow: false }); this.butterfly.hide(true);   // hidden: the cursor is the butterfly now this.butterfly.teleport(new THREE.Vector3(0, 8, 0));
    // the swarm: smaller relatives of the guide, sharing one set of wings
    const nFlock = this.Q.flock, template = nFlock ? new Butterfly(this.scene, .22, { glow: false, dust: false }) : null;
    this.flock = template ? [template] : [];
    for (let i = 1; i < nFlock; i++) this.flock.push(new Butterfly(this.scene, .17 + (i % 4) * .03, { glow: false, dust: false, template }));
    this.flock.forEach((b, i) => b.teleport(new THREE.Vector3(Math.sin(i) * 5, 3 + (i % 3), Math.cos(i) * 5)));
    this.chrysalis = makeChrysalis(); this.chrysalis.visible = false; this.chrysalis.scale.setScalar(.75); this.scene.add(this.chrysalis);
    this.scene.updateMatrixWorld(true);
    this.setMood(1);
    this.bindInput();
    if (BAKED) this.loadBaked();
    addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }

  /* ---------- lights ---------- */
  buildLights() {
    this.ambient = new THREE.AmbientLight('#2c2622', .3); this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight('#4a3e34', '#0a0605', .35); this.scene.add(this.hemi);
    this.heartLight = new THREE.PointLight('#ff2a14', 40, 26, 1.5); this.heartLight.position.set(0, 3, 0); this.scene.add(this.heartLight);
    // one light travels with you from room to room (cheap on laptops)
    this.roomLight = new THREE.PointLight('#ffdcbc', 16, 24, 1.4); this.roomLight.position.set(0, 9, 0); this.scene.add(this.roomLight);
    this.roomLightTarget = new THREE.Vector3(0, 9, 0);
  }

  /* ---------- the rotunda ---------- */
  buildRotunda() {
    // the baked museum brings its own stone: the procedural materials are only drawn for the unbaked fallback (they cost ~1 s at startup)
    const floorMat = BAKED ? null : stone('floor', 7.5, 7.5);
    const segArc = (STEP - ARCH_W / R) * R;
    const wallMat = BAKED ? null : stone('wall', segArc / 4, WALL_H / 4, { side: THREE.BackSide });
    const overMat = BAKED ? null : stone('wall', ARCH_W / 4, (WALL_H - ARCH_H) / 4, { side: THREE.BackSide });
    const archMat = BAKED ? null : stone('wall', 1, 1, { color: new THREE.Color(1.15, 1.08, 1.05) });
    const drape = BAKED ? null : velvet();
    if (!BAKED || this.Q.reflect) this.addFloor(this.scene, new THREE.CircleGeometry(R + .4, 128), floorMat, 0);
    // inlaid floor rings (modern touch)
    if (!BAKED) for (const [rr, o] of [[CH_R + 1.2, .5], [ORBIT_R - 1.4, .25]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr, rr + .025, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(o), toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .006; this.scene.add(ring);
    }
    const half = ARCH_W / 2 / R;
    if (!BAKED) for (let k = 0; k < N; k++) {
      const a = angleOf(k), b = angleOf(k + 1);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL_H, 48, 1, true, a + half, (b - half) - (a + half)), wallMat);
      seg.position.y = WALL_H / 2; this.scene.add(seg);
      const over = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL_H - ARCH_H, 8, 1, true, a - half, half * 2), overMat);
      over.position.y = ARCH_H + (WALL_H - ARCH_H) / 2; this.scene.add(over);
      // a soft wash of red light on each wall section
      const mid = (a + b) / 2, wash = new THREE.Mesh(new THREE.PlaneGeometry(9, 11), poolMaterial('#ff3424', .2));
      wash.position.copy(dir(mid).multiplyScalar(R - .08)).setY(4.2); wash.lookAt(0, 4.2, 0); this.scene.add(wash);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(.03, WALL_H - .6, .03), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(.35), toneMapped: false }));
      rib.position.copy(dir(mid).multiplyScalar(R - .05)).setY((WALL_H - .6) / 2 + .3); this.scene.add(rib);
    }
    // glowing lines that run round the room
    if (!BAKED) for (const [y, o] of [[.12, .9], [WALL_H - .5, .5]]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(R - .03, R - .03, .025, 160, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(o), side: THREE.BackSide, toneMapped: false }));
      band.position.y = y; this.scene.add(band);
    }
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(R + .4, 96), new THREE.MeshStandardMaterial({ color: '#0a0404', roughness: .9, side: THREE.BackSide }));
    ceil.rotation.x = -Math.PI / 2; ceil.position.y = WALL_H; if (!BAKED) { this.scene.add(ceil); this.ceilings.push(ceil); }
    const oculus = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.66, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a24').multiplyScalar(.9), side: THREE.DoubleSide, toneMapped: false }));
    oculus.rotation.x = Math.PI / 2; oculus.position.y = WALL_H - .02; if (!BAKED) { this.scene.add(oculus); this.ceilings.push(oculus); }

    // arches
    [BACKROOM, ...HALLS].forEach(h => {
      const a = angleOf(h.k);
      const g = new THREE.Group(); g.position.copy(dir(a).multiplyScalar(R - .02)); g.rotation.y = a; this.scene.add(g);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(.7), toneMapped: false });
      // a deep round stone arch, cut through the wall
      if (!BAKED) {
      const surround = new THREE.Mesh(archSurround(ARCH_W, ARCH_H, 1.15, 1.0), archMat);
      surround.position.z = -.55; g.add(surround);
      const line = new THREE.Mesh(new THREE.TubeGeometry(archCurve(ARCH_W, ARCH_H, .05), 160, .022, 6), mat);
      line.position.z = -.6; g.add(line);
      // red velvet drapes on either side, like the curtain at the CenterPiece gate
      for (const sx of [-1, 1]) {
        const x = sx * (ARCH_W / 2 + 1.15 + .95), sag = R - Math.sqrt(R * R - x * x);
        const c = new THREE.Mesh(curtainGeometry(1.9, WALL_H - 1.2, 6, .14), drape);
        c.position.set(x, (WALL_H - 1.2) / 2, -sag - .22); c.rotation.y = Math.PI; g.add(c);
      }
      }
      const label = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.08), new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, color: new THREE.Color(1, 1, 1),
        map: textTexture((x, w, hh) => {
          x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillStyle = '#c8261b'; x.font = `600 ${hh * .16}px ${SANS}`; x.fillText(h === BACKROOM ? 'back room' : `hall ${h.num}`, w / 2, hh * .18);
          x.fillStyle = '#111'; x.font = `800 ${hh * .5}px ${SANS}`; x.letterSpacing = `${-hh * .02}px`;
          x.fillText((h === BACKROOM ? 'blender & 3d' : h.title).toLowerCase(), w / 2, hh * .6);
          x.letterSpacing = '0px'; x.fillRect(w * .1, hh * .94, w * .8, 2);
        }, 1600, 320),
      }));
      label.position.set(0, 8.0, (ARC_R - .3) - (R - .02)); label.rotation.y = Math.PI; g.add(label);
      // invisible hit area filling the arch
      const hit = new THREE.Mesh(new THREE.PlaneGeometry(ARCH_W, ARCH_H), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(0, ARCH_H / 2, -.1); hit.rotation.y = Math.PI; g.add(hit);
      hit.userData = { type: 'arch', hall: h, mat, label };
      this.interactive.push(hit);
    });
  }

  /* ---------- the hall names, cut into the limestone over each portal, the letters following the curve of the arch ---------- */
  archNames() {
    // over each arcade arch: the hall's name carved straight into the band above (gilt capitals),
    // and its number cut into a keystone at the crown. Font: Bodoni Moda (his pick of 5, 2026-11-17). (Was: the name bent round the arch, which went small and hard to read.)
    const crown = 4.95 + 2.45, BAND_Y = 8.13, PW = 5.4, PH = .72, px = 2048 / PW, cw = 2048, ch = Math.round(PH * px);
    const F = this._archFont = this._archFont || { fam: '"Bodoni Moda", "Cormorant Garamond", Georgia, serif', wt: 600 };   // (dev: setArchFont() swaps it to compare)
    this._nameRedraw = [];
    const carve = (x, txt, cx, cy, fs, track) => {   // a cut letter: shadow under the top lip, the recessed face, a lit sliver on the lower lip
      const w = x.canvas.width, hh = x.canvas.height, d = Math.max(3, fs * .07);
      const each = (c, dy, style) => { c.fillStyle = style; c.font = `${F.wt} ${fs}px ${F.fam}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.letterSpacing = `${track}px`;
        const tw = c.measureText(txt).width - track; c.fillText(txt, cx - tw / 2, cy + dy);
        c.strokeStyle = style; c.lineWidth = fs * .022; c.lineJoin = 'round'; c.strokeText(txt, cx - tw / 2, cy + dy); };   // a touch of weight: Bodoni's hairlines vanish from across the Rotunda
      const L = document.createElement('canvas'); L.width = w; L.height = hh; const l = L.getContext('2d');
      each(l, 0, '#b48a46'); l.globalCompositeOperation = 'source-atop'; each(l, -d * .32, 'rgb(74,52,24)');   // gilt in the cut, the top lip in shadow
      const M = document.createElement('canvas'); M.width = w; M.height = hh; const m = M.getContext('2d');
      each(m, d, 'rgb(240,214,150)'); m.globalCompositeOperation = 'destination-in'; each(m, -d * .32, '#000');
      l.globalCompositeOperation = 'source-over'; l.drawImage(M, 0, 0); x.drawImage(L, 0, 0);
    };
    const trk = txt => txt.length > 14 ? .08 : .2;   // long names close up a little so their letters stay large
    const fit = (txt, maxW, fs0) => { const c = document.createElement('canvas').getContext('2d'); let fs = fs0;
      const wOf = () => { c.font = `${F.wt} ${fs}px ${F.fam}`; c.letterSpacing = `${fs * trk(txt)}px`; return c.measureText(txt).width; };
      while (wOf() > maxW) fs *= .97; return fs; };
    // the keystone: a tapered block standing proud of the arch, its number cut into the face
    const KB = .5, KT = .7, KY0 = crown - .16, KY1 = crown + .36, KD = .1;
    const ks = new THREE.Shape(); ks.moveTo(-KB / 2, 0); ks.lineTo(KB / 2, 0); ks.lineTo(KT / 2, KY1 - KY0); ks.lineTo(-KT / 2, KY1 - KY0); ks.closePath();
    const kgeo = new THREE.ExtrudeGeometry(ks, { depth: KD, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1, steps: 1 });
    const side = new THREE.MeshBasicMaterial({ color: '#c9b9a4' });
    this._keys = [];
    [BACKROOM, ...HALLS].forEach(h => {
      const num = h === BACKROOM ? '06' : h.num, name = (h === BACKROOM ? 'Blender & 3D' : h.title).toUpperCase();
      const draw = () => textTexture((x, w, hh) => carve(x, name, w / 2, hh * .52, fit(name, w * .9, .44 * px), fit(name, w * .9, .44 * px) * trk(name)), cw, ch, true);   // (full size: the cut letters read canvas.width)
      const tex = draw();
      const a = angleOf(h.k), out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      pl.position.copy(out.clone().multiplyScalar(12.8)).setY(BAND_Y); pl.lookAt(0, BAND_Y, 0); pl.renderOrder = 3; pl.raycast = () => {};
      this.scene.add(pl);
      // the keystone's face: plaster white (tinted by the wall's own colour later) with the number cut in
      const kt = textTexture((x, w, hh) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); carve(x, num, w / 2, hh * .5, w * .42, w * .03); }, 256, Math.round(256 * (KY1 - KY0) / KT), true);
      kt.repeat.set(1 / KT, 1 / (KY1 - KY0)); kt.offset.set(.5, 0);
      const face = new THREE.MeshBasicMaterial({ map: kt, color: '#e2d4c1' });
      const k = new THREE.Mesh(kgeo, [face, side]); k.name = 'keystone_' + h.k; k.raycast = () => {};
      k.position.copy(out.clone().multiplyScalar(12.8 + KD * .3)).setY(KY0); k.lookAt(0, KY0, 0);   // its front faces the Rotunda's centre
      this.scene.add(k); this._keys.push(k);
      this._nameRedraw.push(() => { const o = pl.material.map; pl.material.map = draw(); o.dispose();
        const k2 = textTexture((x, w, hh) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); carve(x, num, w / 2, hh * .5, w * .42, w * .03); }, 256, kt.image.height, true); k2.repeat.copy(kt.repeat); k2.offset.copy(kt.offset); face.map.dispose(); face.map = k2; });
      if (document.fonts && !document.fonts.check('600 40px "Bodoni Moda"')) document.fonts.load('600 40px "Bodoni Moda"').then(() => { pl.material.map = draw(); pl.material.map.needsUpdate = true; tex.dispose();
        const k2 = textTexture((x, w, hh) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); carve(x, num, w / 2, hh * .5, w * .42, w * .03); }, 256, kt.image.height, true); k2.repeat.copy(kt.repeat); k2.offset.copy(kt.offset); face.map = k2; face.needsUpdate = true; }).catch(() => {});
    });
  }
  setArchFont(fam, wt = 600) { Object.assign(this._archFont, { fam, wt }); return document.fonts.load(`${wt} 40px ${fam}`).then(() => this._nameRedraw.forEach(f => f())); }
  keyColours() {   // the keystones take the arcade's own plaster colour, read from the Rotunda bake just above each arch
    if (!this._keys || this._keysCol) return; let rot = null; this.scene.traverse(o => { if (!rot && o.isMesh && o.name === 'rot_shell') rot = o; });
    const img = rot?.material?.map?.image; if (!img || !img.width) return; this._keysCol = true;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * img.height / img.width); const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, cv.width, cv.height);
    const rc = new THREE.Raycaster(), tint = rot.material.color.clone(), cols = [];
    for (const k of this._keys) { const o = k.position.clone().setY(0).normalize();
      for (const y of [7.7, 7.9, 8.4]) for (const s of [-1.6, -1.1, 1.1, 1.6]) { const t = new THREE.Vector3(o.z, 0, -o.x).multiplyScalar(s).add(o.clone().multiplyScalar(12.8)).setY(y);
        rc.set(t.clone().sub(o.clone().multiplyScalar(2)), o); rc.far = 4; const hit = rc.intersectObject(rot, false)[0];
        if (hit && hit.uv) { const d = x.getImageData(Math.min(cv.width - 1, Math.floor(hit.uv.x * cv.width)), Math.min(cv.height - 1, Math.floor(hit.uv.y * cv.height)), 1, 1).data; cols.push([d[0], d[1], d[2]]); } } }
    if (!cols.length) return;
    cols.sort((p, q) => (q[0] + q[1] + q[2]) - (p[0] + p[1] + p[2])); const top = cols.slice(0, Math.ceil(cols.length * .5));
    const avg = top.reduce((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2]], [0, 0, 0]).map(v => v / top.length / 255);
    const base = new THREE.Color().setRGB(avg[0], avg[1], avg[2], THREE.SRGBColorSpace).multiply(tint);
    this._keys[0].material[0].color.copy(base).multiplyScalar(1.1); this._keys[0].material[1].color.copy(base).multiplyScalar(.8);
    this._keys.forEach(k => { k.material[0].color.copy(this._keys[0].material[0].color); });   // (the side material is shared)
    this._keyBase = base;
  }

  /* ---------- the Blender hall (was the back room): the castle behind the desk, and on the desk the real 3D packages and the books ---------- */
  async buildCastle() {
    if (!this.desk || this.castle) return;
    const gltf = await new GLTFLoader().loadAsync('assets/museum/castle2-glb.wasm');   // rebuilt in Blender: battlements, lit windows, slate spires, gilt finials, pennants
    const root = gltf.scene; root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), H = 5.8, k = H / size.y;
    // stone, slate and gilt, drawn once; UVs projected from the world so every block is the same size
    const R_ = (a, b) => a + Math.random() * (b - a);
    const stone = textTexture((c, w, h) => {   // weathered limestone: uneven blocks, each its own tone, dirt in the joints, rain streaks
      c.fillStyle = '#4a3e30'; c.fillRect(0, 0, w, h);
      const rows = 8, bh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -R_(0, w / 6);
        while (x < w) {
          const bw = R_(w / 7, w / 3.6), t = R_(.8, 1.08), warm = R_(-8, 8);
          c.fillStyle = `rgb(${(196 + warm) * t | 0},${178 * t | 0},${(146 - warm) * t | 0})`;
          const jx = 3 + R_(0, 2), jy = 3 + R_(0, 2);
          c.fillRect(x + jx, r * bh + jy, bw - jx * 2, bh - jy * 2);
          for (let k = 0; k < 90; k++) {   // pitting and lichen
            const lt = Math.random() < .55; c.fillStyle = lt ? `rgba(255,248,230,${R_(.03, .1)})` : (Math.random() < .15 ? `rgba(70,84,40,${R_(.05, .14)})` : `rgba(60,45,30,${R_(.04, .14)})`);
            const s2 = R_(1, 5); c.fillRect(x + R_(0, bw), r * bh + R_(0, bh), s2, s2);
          }
          const gr = c.createLinearGradient(0, r * bh, 0, r * bh + bh); gr.addColorStop(0, 'rgba(255,245,225,.08)'); gr.addColorStop(1, 'rgba(40,30,18,.16)');
          c.fillStyle = gr; c.fillRect(x + jx, r * bh + jy, bw - jx * 2, bh - jy * 2);
          x += bw;
        }
      }
      for (let k = 0; k < 26; k++) {   // rain streaks running down from the joints
        const x = R_(0, w), y = R_(0, h), len = R_(h * .1, h * .45), gr = c.createLinearGradient(0, y, 0, y + len);
        gr.addColorStop(0, `rgba(55,45,32,${R_(.08, .2)})`); gr.addColorStop(1, 'rgba(55,45,32,0)'); c.fillStyle = gr; c.fillRect(x, y, R_(3, 10), len);
      }
    }, 1024, 1024);
    const slate = textTexture((c, w, h) => {   // aged slate: uneven tiles, lighter weathered edges, a little moss
      c.fillStyle = '#1a2130'; c.fillRect(0, 0, w, h);
      const rows = 20, sh = h / rows, tw = w / 18;
      for (let r = 0; r < rows; r++) for (let x = -(r % 2) * tw / 2; x < w; x += tw) {
        const t = R_(.78, 1.18), bl = R_(-6, 10); c.fillStyle = `rgb(${(48 + bl * .4) * t | 0},${(58 + bl * .3) * t | 0},${(78 + bl) * t | 0})`;
        c.beginPath(); c.moveTo(x + 2, r * sh); c.lineTo(x + tw - 2, r * sh); c.lineTo(x + tw - 2, r * sh + sh * .72); c.quadraticCurveTo(x + tw / 2, r * sh + sh * 1.08, x + 2, r * sh + sh * .72); c.fill();
        c.fillStyle = `rgba(200,210,220,${R_(.03, .09)})`; c.fillRect(x + 2, r * sh + sh * .62, tw - 4, sh * .1);
        if (Math.random() < .06) { c.fillStyle = `rgba(90,110,50,${R_(.15, .35)})`; c.beginPath(); c.arc(x + R_(0, tw), r * sh + R_(0, sh), R_(3, 9), 0, 6.3); c.fill(); }
      }
      for (let k = 0; k < 30; k++) { const x = R_(0, w), gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(230,235,240,0)'); gr.addColorStop(1, `rgba(230,235,240,${R_(.02, .06)})`); c.fillStyle = gr; c.fillRect(x, 0, R_(4, 14), h); }
    }, 1024, 1024);
    [stone, slate].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; });
    const env = this.caseEnv || (() => { const pm = new THREE.PMREMGenerator(this.renderer); const t = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); return (this.caseEnv = t); })();
    const stoneM = new THREE.MeshStandardMaterial({ map: stone, bumpMap: stone, bumpScale: 1.2, roughness: .92, envMap: env, envMapIntensity: .9, vertexColors: true });
    const slateM = new THREE.MeshStandardMaterial({ map: slate, bumpMap: slate, bumpScale: 1.6, roughness: .55, metalness: .1, envMap: env, envMapIntensity: 1.1, vertexColors: true });
    const trimM = new THREE.MeshStandardMaterial({ map: stone, bumpMap: stone, bumpScale: 1.4, color: '#f6ecd8', roughness: .85, envMap: env, envMapIntensity: 1.0, vertexColors: true });
    const goldM = new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: .28, metalness: 1, envMap: env, envMapIntensity: 1.6 });
    const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb86a').multiplyScalar(1.6), toneMapped: false });
    const flagM = new THREE.MeshStandardMaterial({ color: '#b3170f', roughness: .7, side: THREE.DoubleSide, envMap: env, envMapIntensity: .8 });
    const leafM = new THREE.MeshStandardMaterial({ color: '#3b5a2a', roughness: .9, flatShading: true, envMap: env, envMapIntensity: .6 });
    const woodM = new THREE.MeshStandardMaterial({ color: '#4a2e18', roughness: .85 });
    const darkM = new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: .5, metalness: .5, envMap: env, envMapIntensity: .8 });
    const byName = { stone: stoneM, trim: trimM, slate: slateM, gold: goldM, glow: glowM, flag: flagM, dark: darkM, leaf: leafM, wood: woodM };
    const g = new THREE.Group(); g.name = 'castle';
    root.traverse(o => {
      if (!o.isMesh) return;
      const mname = (o.material && o.material.name) || 'stone', mt = byName[mname] || stoneM;
      let geo = o.geometry.clone().applyMatrix4(o.matrixWorld); geo = geo.index ? geo.toNonIndexed() : geo; geo.computeVertexNormals();
      geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); geo.scale(k, k, k);
      if (mt.map) {   // box-projected UVs so every block is the same size; a little darker at the foot
        const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2), col = new Float32Array(p.count * 3);
        const S = mt === slateM ? 2.6 : 2.3;
        for (let i = 0; i < p.count; i += 3) {
          const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
          for (let j = i; j < i + 3; j++) {
            const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
            if (ay > ax && ay > az) uv.set([x * S, z * S], j * 2); else if (ax > az) uv.set([z * S, y * S], j * 2); else uv.set([x * S, y * S], j * 2);
            const ao = .62 + .38 * Math.min(1, y / 1.6), moss = Math.max(0, 1 - y / .9) * .12; col.set([ao - moss, ao - moss * .4, ao - moss * 1.2], j * 3);   // grimy, a little green at the foot
          }
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      const m = new THREE.Mesh(geo, mt); m.castShadow = mt !== glowM; m.receiveShadow = true; g.add(m);
    });
    // it stands on its own stepped stone base (modelled), straight on the floor
    const at = this.castleAt;
    g.position.copy(at).setY(.12); g.rotation.y = Math.PI;
    this.scene.add(g); this.castle = g;
    // a dark stone dais and a ring of brass posts with red velvet ropes, like a museum's prize exhibit
    const fb = new THREE.Box3().setFromObject(g), rx = (fb.max.x - fb.min.x) / 2 + .55, rz = (fb.max.z - fb.min.z) / 2 + .6;
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.03, .12, 96), new THREE.MeshStandardMaterial({ color: '#2b2520', roughness: .55, envMap: env, envMapIntensity: .7 }));
    dais.scale.set(rx + .25, 1, rz + .25); dais.position.copy(at).setY(.06); dais.receiveShadow = true; this.scene.add(dais);
    const brass = new THREE.MeshStandardMaterial({ color: '#c8963e', roughness: .25, metalness: 1, envMap: env, envMapIntensity: 1.5 });
    const velvet = new THREE.MeshStandardMaterial({ color: '#7a0c14', roughness: .95, envMap: env, envMapIntensity: .4 });
    const posts = new THREE.Group(), NP = 10, ph = .95, tops = [];
    for (let i = 0; i < NP; i++) {
      const a = i / NP * Math.PI * 2, p = new THREE.Vector3(at.x + Math.cos(a) * rx, 0, at.z + Math.sin(a) * rz);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, .04, 32), brass); base.position.copy(p).setY(.14);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.026, .03, ph, 16), brass); pole.position.copy(p).setY(.14 + ph / 2);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.055, 20, 14), brass); cap.position.copy(p).setY(.14 + ph + .03);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.04, .01, 8, 20), brass); ring.position.copy(p).setY(.14 + ph - .06); ring.rotation.y = -a;
      [base, pole, cap, ring].forEach(m => { m.castShadow = true; posts.add(m); }); tops.push(p.clone().setY(.14 + ph - .07));
    }
    for (let i = 0; i < NP; i++) {   // each rope sags between its posts
      const A = tops[i], B = tops[(i + 1) % NP], mid = A.clone().lerp(B, .5).setY(A.y - .2);
      const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, mid, B), 24, .022, 10), velvet);
      rope.castShadow = true; posts.add(rope);
    }
    this.scene.add(posts);
    // (its key, fill and rim lights are made at startup in buildBackroom: adding lights later recompiles every material in the museum, a ~10 s freeze)
  }
  /* ---------- the showreel: a framed screen on the end wall, turning the 3D work round one piece at a time ---------- */
  buildReel(origin, wallZ) {
    const W = 6.2, H = W * 9 / 16, Y = 3.5;
    const rt = new THREE.WebGLRenderTarget(1920, 1080, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const fr = new THREE.Group(); fr.position.set(origin.x, Y, wallZ - .36); fr.rotation.y = Math.PI; this.scene.add(fr);
    const bez = new THREE.Mesh(new THREE.BoxGeometry(W + .16, H + .16, .06), new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: .35, metalness: .4 })); bez.position.z = -.03; fr.add(bez);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W + .2, H + .2, .04), new THREE.MeshStandardMaterial({ color: '#b98a3c', roughness: .3, metalness: 1, envMap: this.caseEnv || null })); rim.position.z = -.05; fr.add(rim);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false })); scr.position.z = .002; fr.add(scr);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.6, H + 1.4), new THREE.MeshBasicMaterial({ map: this.softTex(), color: '#7aa0ff', transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.z = -.055; fr.add(halo);
    // the little studio inside the screen
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 16 / 9, .05, 50);
    const bg = textTexture((c, w, h) => { const g = c.createRadialGradient(w * .5, h * .45, 10, w * .5, h * .5, w * .7); g.addColorStop(0, '#5a524c'); g.addColorStop(.6, '#2a2624'); g.addColorStop(1, '#100e0d'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 512, 288);
    sc.background = bg;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.75, .77, .04, 64), new THREE.MeshStandardMaterial({ color: '#1b1918', roughness: .4, metalness: .2 })); disc.position.y = -.02; sc.add(disc);
    const k1 = new THREE.DirectionalLight('#fff1dc', 2.2); k1.position.set(1.5, 2.5, 2); sc.add(k1);
    const k2 = new THREE.DirectionalLight('#dfe6ff', .9); k2.position.set(-2, 1.2, 1.2); sc.add(k2);       // soft fill
    const k3 = new THREE.DirectionalLight('#ffffff', 1.8); k3.position.set(-.6, 2.4, -2.6); sc.add(k3);     // a rim from behind: the edges catch the light
    sc.add(new THREE.AmbientLight('#ffffff', .3));
    const capC = document.createElement('canvas'); capC.width = 2048; capC.height = 120; const capT = new THREE.CanvasTexture(capC); capT.colorSpace = THREE.SRGBColorSpace;
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(W, W * 120 / 2048), new THREE.MeshBasicMaterial({ map: capT, transparent: true, toneMapped: false })); cap.position.set(0, -H / 2 + W * 60 / 2048 + .04, .006); fr.add(cap);
    this.reel = { rt, sc, cam, disc, cap, capC, capT, turn: new THREE.Group(), idx: -1, t0: 0, frame: 0, items: null };
    sc.add(this.reel.turn);
  }
  updateReel(t) {
    const R = this.reel; if (!R) return;
    const here = this._reelForce || ((this.state === 'backroom' || this.desk?.active || this.travelTo === 'backroom') && this.zoneVis('backroom'));
    if (!here) return;
    if (!R.items && this.deskReady && this.reelModels?.length && this.castle) {
      const NAMES = { altura: 'Altura', kazaar: 'Kazaar', cheese_open: 'Cheese', donut: 'Donut', matches: 'Misty Matches', playable: 'Playable' };
      R.cam.layers.enableAll();   // (clones copy the source's layer; the studio camera sees them all)
      // each piece: its name, one line, and its own colour for the backdrop
      const LOOK = { castle: ['The Castle', 'modelled and lit in Blender', '#3e4c60'], altura: ['Altura', 'mountain dip tea', '#a9cdbd'], kazaar: ['Kazaar', 'monsoon gin · distilled in assam', '#4a3714'],
        cheese_open: ['Eleftheria', 'cheese factory', '#d9b24e'], donut: ['Donut Protocol', 'observe donut', '#d98ea2'], matches: ['Misty Matches', '25 sticks', '#8ea3b8'], playable: ['Playable', 'clothing · hanger box', '#c9a26e'] };
      const backdrop = hex => { const b = new THREE.Color(hex), hi = b.clone().lerp(new THREE.Color('#ffffff'), .35), lo = b.clone().multiplyScalar(.28);
        return textTexture((c, w, h) => { const g = c.createRadialGradient(w * .5, h * .42, 10, w * .5, h * .55, w * .72); g.addColorStop(0, '#' + hi.getHexString()); g.addColorStop(.55, '#' + b.getHexString()); g.addColorStop(1, '#' + lo.getHexString()); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 1024, 576); };
      R.items = [{ id: 'castle', name: 'The Castle', obj: this.castle }, ...this.reelModels.map(m => ({ id: m.id, name: NAMES[m.id] || m.id, obj: m.obj }))].map(({ id, name, obj }) => {
        const c = obj.clone(true); c.position.set(0, 0, 0); c.rotation.set(obj === this.castle ? 0 : obj.rotation.x, 0, obj.rotation.z); c.scale.copy(obj.scale);
        const b = new THREE.Box3().setFromObject(c), sz = b.getSize(new THREE.Vector3()), k = .95 / Math.max(sz.x, sz.y, sz.z);
        c.scale.multiplyScalar(k); b.setFromObject(c); const ctr = b.getCenter(new THREE.Vector3());
        c.position.set(-ctr.x, -b.min.y, -ctr.z); const g = new THREE.Group(); g.add(c); g.userData.h = b.max.y - b.min.y; g.userData.w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z); g.visible = false; R.turn.add(g);
        c.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
        const L = LOOK[id] || [name, '', '#3a3634']; return { name: L[0], line: L[1], g, bg: backdrop(L[2]), disc: new THREE.Color(L[2]).multiplyScalar(.45) };
      });
      if (this.caseEnv) R.sc.environment = this.caseEnv;
      R.ok = false; R.items.forEach(it => (it.g.visible = true));
      // compile the little studio off the main thread first, for the buffer it is really drawn into (no tone mapping there:
      // compiled for the screen, every piece re-compiled the first time it came round and froze the room ~1.5 s)
      { const r = this.renderer, prev = r.getRenderTarget(), clip = r.clippingPlanes; r.setRenderTarget(R.rt); r.clippingPlanes = [];   // (never with the descent's ceiling cut: that is another variant)
        this.normalizeMaterials(R.sc); const job = r.compileAsync ? r.compileAsync(R.sc, R.cam) : null; r.setRenderTarget(prev); r.clippingPlanes = clip;
        Promise.resolve(job).catch(() => {}).then(() => { R.items.forEach(it => (it.g.visible = false)); R.ok = true; }); }
    }
    if (!R.items || !R.ok) return;
    if (R.idx < 0 || t - R.t0 > 5) {   // a new piece every five seconds
      if (R.idx >= 0) R.items[R.idx].g.visible = false;
      R.idx = (R.idx + 1) % R.items.length; R.t0 = t; const it = R.items[R.idx]; it.g.visible = true;
      const h = it.g.userData.h, w = it.g.userData.w * 1.42, th = Math.tan(THREE.MathUtils.degToRad(R.cam.fov / 2));   // (w: its widest as it turns, corner to corner)
      const d = Math.max(h / .76 / 2 / th, w / .66 / 2 / th / R.cam.aspect) + w * .35;   // whole, and large: ~3/4 of the screen's height
      { const el = THREE.MathUtils.degToRad(clamp(30 - 18 * h / Math.max(.01, w / 1.42), 10, 30)), cy = h * .48, dd = d;   // flat pieces: from a little above, so you see the top
        R.cam.position.set(0, cy + dd * Math.sin(el), dd * Math.cos(el)); R.cam.lookAt(0, cy, 0); }
      if (it.bg) R.sc.background = it.bg; if (it.disc) R.disc.material.color.copy(it.disc);
      const c = R.capC.getContext('2d'); c.clearRect(0, 0, 2048, 120); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,.42)'; c.fillRect(0, 0, 2048, 120);
      const nm = it.name.toUpperCase(), ln = it.line ? `  \u2014  ${it.line}` : ''; c.textAlign = 'left';
      c.font = `700 50px ${SANS}`; c.letterSpacing = '8px'; const w1 = c.measureText(nm).width; c.font = `400 40px ${SANS}`; c.letterSpacing = '2px'; const w2 = c.measureText(ln).width, x0 = 1024 - (w1 + w2) / 2;
      c.fillStyle = '#f4ead8'; c.font = `700 50px ${SANS}`; c.letterSpacing = '8px'; c.fillText(nm, x0, 62);
      c.fillStyle = 'rgba(244,234,216,.75)'; c.font = `400 40px ${SANS}`; c.letterSpacing = '2px'; c.fillText(ln, x0 + w1, 64);
      c.textAlign = 'right'; c.font = `500 30px ${SANS}`; c.letterSpacing = '4px'; c.fillStyle = 'rgba(244,234,216,.5)'; c.fillText(`${String(R.idx + 1).padStart(2, '0')} / ${String(R.items.length).padStart(2, '0')}`, 1990, 62);
      R.capT.needsUpdate = true;
    }
    const s = (t - R.t0) / 5, it = R.items[R.idx];
    R.turn.rotation.y = t * .8;
    const fade = Math.min(1, s * 6, (1 - s) * 6);   // a short fade in and out between pieces
    it.g.scale.setScalar(.92 + .08 * fade);
    if (this._reelForce || this.perfOff || (R.odd = !R.odd)) {   // every other frame: a turntable on a screen reads the same at 30 fps
      const r = this.renderer, prev = r.getRenderTarget(), sh = r.shadowMap.autoUpdate, clip = r.clippingPlanes; r.shadowMap.autoUpdate = false; r.clippingPlanes = [];   // the little studio is never cut
      r.setRenderTarget(R.rt); r.render(R.sc, R.cam); r.setRenderTarget(prev); r.shadowMap.autoUpdate = sh; r.clippingPlanes = clip;
    }
  }
  async fillDesk() {
    if (!this.desk || this.deskFilled) return; this.deskFilled = true;
    await this.buildCastle().catch(e => console.warn('[NavGod] castle', e));
    await new Promise(r => setTimeout(r, 30));
    const { buildProduct } = await loadProducts(), g = this.desk.group, top = 1.05;
    // the six packages across the back of the desk, each shown at about the same height
    const models = ['altura', 'kazaar', 'cheese_open', 'donut', 'matches', 'playable'];
    for (let i = 0; i < models.length; i++) {
      try {
        const m = await buildProduct(models[i], this.renderer, 'trials/');
        const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3());
        const k = Math.min(.46 / Math.max(s.x, s.z), .5 / s.y, models[i] === 'matches' ? 5 : 3.5);
        m.scale.setScalar(k); m.rotation.y = Math.PI + (i - 2.5) * -.14;
        if (models[i] === 'matches') m.rotation.set(-1.0, Math.PI, 0);
        const holder = new THREE.Group(); holder.position.set(-1.85 + i * .74, top, .55); holder.add(m); g.add(holder); (this.reelModels ||= []).push({ id: models[i], obj: m });
        b.setFromObject(holder); holder.position.y += top - b.min.y;
        m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; [].concat(o.material).forEach(mt => { if ('envMap' in mt) { mt.envMap = this.caseEnv; mt.envMapIntensity = 1.25; mt.needsUpdate = true; } }); } });
      } catch (e) { console.warn('desk model', models[i], e); }
      await new Promise(r => setTimeout(r, 30));
    }
    // the books and magazines in front: the lookbook, the two INKED covers, The Characters, the Donut fold-out closed
    const load = f => { const t = this.loader.load(f); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const paper = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: .9 });
    const book = (f, w, d, th, x, z, ry, y0 = 0) => {
      const cover = new THREE.MeshStandardMaterial({ map: load(f), roughness: .6 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), [paper, paper, cover, paper, paper, paper]);
      m.position.set(x, top + th / 2 + y0, z); m.rotation.y = Math.PI + ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };
    book('assets/editorial/daily/p00.jpg', .4, .4, .035, -1.5, -.45, .12);
    book('assets/editorial/inked/p00.jpg', .3, .42, .006, -.62, -.42, -.08); book('assets/editorial/inked/p01.jpg', .3, .42, .006, -.48, -.5, .16, .007);
    book('assets/editorial/characters/p00.jpg', .32, .42, .01, .42, -.45, -.1);
    book('assets/projects/donutbook/cover.jpg', .4, .4, .012, 1.4, -.45, .06);
    this.deskReady = true;
  }

  /* ---------- the strip: navgodnavgodnavgod, running round the red walls between the halls ---------- */
  buildStrip() {
    const H = 1.9, Y = 3.3, r = R - .06;                      // letters ~1.6 m tall, at eye level through the arcade
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const font = `800 400px ${SANS}`; x.font = font; x.letterSpacing = '-18px';
    const word = 'navgod', ww = Math.ceil(x.measureText(word).width) + 10;
    c.width = ww; c.height = 512; x.font = font; x.letterSpacing = '-18px';
    x.fillStyle = '#0d0d0d'; x.textBaseline = 'alphabetic'; x.fillText(word, 0, 400);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
    const wordM = H * ww / 512, reps = Math.round(Math.PI * 2 * r / wordM);
    const half = (ARCH_W / 2 + 2.0) / R;                          // keep well clear of the hall portals (their stone frames are thick)
    this.strip = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 360, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uMap: { value: tex }, uRep: { value: reps }, uOff: { value: 0 }, uN: { value: N }, uHalf: { value: half } },
      vertexShader: `varying vec2 vUv; varying vec2 vXZ; void main(){ vUv=uv; vXZ=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uRep,uOff,uN,uHalf; varying vec2 vUv; varying vec2 vXZ;
        void main(){
          float vA=atan(vXZ.x,vXZ.y);                                       // per pixel: no seam where the angle wraps (it leaked into hall 03)
          float step_=6.2831853/uN, k=vA/step_, d=abs(k-floor(k+.5))*step_;   // angular distance to the nearest portal
          float m=smoothstep(uHalf,uHalf+.05,d);
          vec4 t=texture2D(uMap,vec2(fract((1.-vUv.x)*uRep+uOff),vUv.y));
          gl_FragColor=vec4(t.rgb,t.a*m); }`,
    }));
    this.strip.position.y = Y; this.scene.add(this.strip);

    // a second strip of tape crosses it in a slow wave: white tape, red words
    const c2 = document.createElement('canvas'), y2 = c2.getContext('2d');
    const phrase = 'designed, built and painted by naveen godugupalli  ·  ', f2 = `700 150px ${SANS}`; y2.font = f2;
    const pw = Math.ceil(y2.measureText(phrase).width);
    c2.width = pw; c2.height = 220; y2.fillStyle = '#fbfaf7'; y2.fillRect(0, 0, pw, 220);
    y2.fillStyle = '#c8261b'; y2.font = f2; y2.textBaseline = 'middle'; y2.fillText(phrase, 0, 116);
    const t2 = new THREE.CanvasTexture(c2); t2.wrapS = THREE.RepeatWrapping; t2.anisotropy = 8; t2.colorSpace = THREE.SRGBColorSpace;
    const H2 = .62, r2 = R - .09, reps2 = Math.round(Math.PI * 2 * r2 / (H2 * pw / 220));
    this.tape = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2, H2, 720, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uMap: { value: t2 }, uRep: { value: reps2 }, uOff: { value: 0 }, uN: { value: N }, uHalf: { value: half }, uAmp: { value: 1.25 } },
      vertexShader: `uniform float uN,uAmp; varying vec2 vUv; varying vec2 vXZ;
        void main(){ vUv=uv; vXZ=position.xz; float a=atan(position.x,position.z); vec3 p=position; p.y+=uAmp*sin(a*uN+1.5708);   // rises and dips across each red wall
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uRep,uOff,uN,uHalf; varying vec2 vUv; varying vec2 vXZ;
        void main(){
          float vA=atan(vXZ.x,vXZ.y);
          float step_=6.2831853/uN, k=vA/step_, d=abs(k-floor(k+.5))*step_;
          float m=smoothstep(uHalf,uHalf+.05,d);
          vec4 t=texture2D(uMap,vec2(fract((1.-vUv.x)*uRep-uOff),vUv.y));
          gl_FragColor=vec4(t.rgb,m); }`,
    }));
    this.tape.position.y = Y; this.tape.renderOrder = 2; this.scene.add(this.tape);
  }

  /* ---------- giant numbers painted on the floor before each arch (supergraphics) ---------- */
  buildFloorNumbers() {
    for (const h of [...HALLS, BACKROOM]) {
      const a = angleOf(h.k);
      // a brass inlay set into the stone (2026-11-25, his pick): a ring, the number and the hall's name all in brass, cut slightly into the floor.
      // Drawn once into the texture (light from the heart side), so it costs nothing per frame: no lights, no reflections.
      const tex = textTexture((x, w, hh) => {
        const cx = w / 2, cy = hh / 2, brass = (y0, y1) => { const g = x.createLinearGradient(0, y0, 0, y1);
          g.addColorStop(0, '#f1d89a'); g.addColorStop(.35, '#c9a256'); g.addColorStop(.6, '#9b7432'); g.addColorStop(1, '#d6b46e'); return g; };
        // the ring: a dark cut, then the brass, then a lit edge
        x.lineWidth = w * .038; x.strokeStyle = 'rgba(40,28,14,.55)'; x.beginPath(); x.arc(cx, cy + 3, w * .445, 0, Math.PI * 2); x.stroke();
        x.lineWidth = w * .03; x.strokeStyle = brass(cy - w * .47, cy + w * .47); x.beginPath(); x.arc(cx, cy, w * .445, 0, Math.PI * 2); x.stroke();
        x.lineWidth = 2; x.strokeStyle = 'rgba(255,240,205,.7)'; x.beginPath(); x.arc(cx, cy, w * .432, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
        x.lineWidth = w * .006; x.strokeStyle = brass(cy - w * .4, cy + w * .4); x.beginPath(); x.arc(cx, cy, w * .395, 0, Math.PI * 2); x.stroke();
        // the number and the name, inlaid: a dark cut under each letter, the brass on top
        const inlay = (txt, font, y, track) => { x.font = font; x.textAlign = 'center'; x.letterSpacing = track;
          x.fillStyle = 'rgba(40,28,14,.5)'; x.fillText(txt, cx, y + 4); x.fillStyle = brass(y - hh * .45, y + hh * .05); x.fillText(txt, cx, y); };
        inlay(h === BACKROOM ? '06' : h.num, `800 ${hh * .46}px ${SANS}`, hh * .6, `${-hh * .02}px`);
        inlay((h === BACKROOM ? 'blender & 3d' : h.title).toLowerCase(), `700 ${hh * .062}px ${SANS}`, hh * .74, `${hh * .004}px`);
        x.letterSpacing = '0px';
      }, 1024, 1024);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .96 }));
      m.rotation.x = -Math.PI / 2;
      const g = new THREE.Group(); g.add(m); g.rotation.y = a + Math.PI;            // reads upright from the heart, looking out at the arch
      g.position.copy(dir(a).multiplyScalar(9.6)).setY(.012); this.scene.add(g);
      m.renderOrder = 3;
    }
  }

  /* ---------- the heart: CenterPiece chamber ---------- */
  buildHeart() {
    const g = this.heart = new THREE.Group(); this.scene.add(g);
    // a dark stone base and a crown, the glass column between them
    const stoneM = new THREE.MeshStandardMaterial({ color: '#f1eee9', roughness: .55, metalness: 0, emissive: '#e9e5de', emissiveIntensity: .35 });
    const brass = new THREE.MeshBasicMaterial({ color: '#141414' });   // black hairline rings
    const base = new THREE.Mesh(new THREE.CylinderGeometry(CH_R + .25, CH_R + .4, .35, 96), stoneM); base.position.y = .175; g.add(base);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(CH_R + .35, CH_R + .2, .3, 96), stoneM); crown.position.y = 7.35; g.add(crown);
    {
      const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'), m = 512;
      const ro = 512, ri = ro * .86;
      const gr = x.createRadialGradient(m, m, ri, m, m, ro); gr.addColorStop(0, '#0e0e0e'); gr.addColorStop(.5, '#2a2a2a'); gr.addColorStop(1, '#0e0e0e');
      x.fillStyle = gr; x.beginPath(); x.arc(m, m, ro, 0, 7); x.arc(m, m, ri, 0, 7, true); x.fill();
      x.fillStyle = 'rgba(245,242,236,.85)';
      for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; x.save(); x.translate(m, m); x.rotate(a); x.fillRect(ro * .925, -ro * .019, ro * .05, ro * .038); x.restore(); }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
      const top = new THREE.Mesh(new THREE.RingGeometry((CH_R + .35) * .86, CH_R + .35, 128, 1),
        new THREE.MeshBasicMaterial({ map: tx }));
      top.rotation.x = -Math.PI / 2; top.position.y = 7.512; g.add(top); this.crownRing = top;
    }
    for (const y of [.36, 7.18]) { const r = new THREE.Mesh(new THREE.TorusGeometry(CH_R + .06, .035, 10, 160), brass); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    // the core: a column of living red light that beats
    this.coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(1.6), transparent: true, opacity: .9 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 6.8, 24, 1, true), this.coreMat); core.position.y = 3.75; g.add(core);
    const haze = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 6.8, 48, 1, true), coneMaterial()); haze.material.uniforms.uColor.value.set('#ff3a22'); haze.material.uniforms.uI.value = .5;
    haze.position.y = 3.75; g.add(haze); this.coreHaze = haze;
    // the handmade works float and slowly orbit inside the glass
    const ART = [['a01', .68], ['a02', .681], ['a03', .705], ['a04', .603], ['a05', .881], ['a08', 1.404], ['a09', .711], ['a10', .658], ['a11', .498], ['a12', .702], ['a13', .82], ['a14', .716], ['a16', 1.063], ['a18', .769], ['a19', .723]];
    this.floaters = [];
    ART.forEach(([n, asp], i) => {
      const t = this.loader.load(`assets/centerpiece/art/${n}.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const h = .95, w = h * asp;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, color: new THREE.Color(.82, .78, .76) }));
      const piv = new THREE.Group(); g.add(piv); piv.add(m);
      const tier = Math.floor(i / 5), k = i % 5;
      const ang = k / 5 * Math.PI * 2 + tier * Math.PI / 5, y = 1.95 + tier * 1.75;
      piv.userData = { ang, y, r: 1.62, sp: (tier % 2 ? -1 : 1) * .07, bob: tier * 2 };
      m.material.transparent = true;
      this.floaters.push({ piv, m });
    });
    // the glass itself: real refraction on strong GPUs, a fresnel sheen everywhere
    // clear glass: almost invisible face-on, catching light at the edges (the sheen below)
    const glassMat = new THREE.MeshStandardMaterial({ color: '#fff6f2', transparent: true, opacity: .07, roughness: .05, metalness: .3, depthWrite: false, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(CH_R, CH_R, 6.8, 128, 1, true), glassMat); glass.position.y = 3.75; g.add(glass); this.glassMat = glassMat;
    const sheen = new THREE.Mesh(new THREE.CylinderGeometry(CH_R + .02, CH_R + .02, 6.8, 128, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uBeat: this.shared.uBeat },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform float uBeat; void main(){ float f=pow(1.-abs(dot(vN,vV)),3.); gl_FragColor=vec4(mix(vec3(1.,.92,.86),vec3(1.,.15,.08),.5+uBeat*.5)*f*(.45+uBeat*.5),1.); }',
    }));
    sheen.position.y = 3.75; g.add(sheen);

    // ---------- the white edition: CenterPiece is a red room ----------
    // a solid red cylinder with one pill-shaped doorway that turns to face you; the works float inside;
    // the open top is ringed by the same marked black ring as the eye, so the intro can fall straight in
    for (const o of [base, crown, core, haze, glass, sheen]) o.visible = false;
    g.children.forEach(o => { if (o.geometry?.type === 'TorusGeometry') o.visible = false; });
    {
      const RR = CH_R + .35, RH = 7.5;
      const room = this.redRoom = new THREE.Group(); g.add(room);
      this.roomMat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uWeave: { value: (this.weave = new WeaveWall(() => this.floaters.map(f => f.m.material.map && f.m.material.map.image))).texture }, uSeal: { value: 1 }, uRR: { value: RR }, uDW: { value: 2.2 }, uDH: { value: 4.9 }, uBeat: this.shared.uBeat, uTime: TIME },
        vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec2 vUv2; void main(){ vP=position; vUv2=uv; vW=(modelMatrix*vec4(position,1.)).xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform float uSeal,uRR,uDW,uDH,uBeat,uTime; uniform sampler2D uWeave; varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec2 vUv2;
          float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
          void main(){
            float s = atan(vP.x, vP.z)*uRR, y = vP.y + ${(RH / 2).toFixed(2)};
            float r = uDW*.5, cy = uDH - r;
            float sdf = y < cy ? abs(s) - r : length(vec2(s, y - cy)) - r;      // the pill-shaped doorway
            // the outside is the worm's live weave; the inside is a deep red that breathes
            float H_ = ${RH.toFixed(2)};
            vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
            float shade = .82 + .18*max(dot(N, normalize(vec3(-.4,.6,.6))), 0.);
            vec3 col = texture2D(uWeave, vUv2).rgb * shade;
            float alpha = 1.;
            #ifdef INNER
            col = vec3(.5,.018,.012)*(.45 + .25*smoothstep(0., H_, y))*(1. + .25*uBeat);   // inside: only deep red, never the weave
            #endif
            float rim = 1. - smoothstep(.06,.1,y) + 1. - smoothstep(.06,.1,H_-y);
            if (sdf < 0.) {
              if (h(gl_FragCoord.xy) > uSeal) discard;                          // the door clears as the heart opens
              col = vec3(.93,.9,.86);                                            // sealed: a plain paper panel
            }
            col = mix(col, vec3(.78,.1,.07), 1. - smoothstep(.012, .03, abs(sdf)));   // a red hairline round the door
            col = mix(col, vec3(.03), clamp(rim,0.,1.));                            // thin black rims, top and bottom
            gl_FragColor = vec4(col, alpha);
          }`,
      });
      // two layers in a fixed order: the inside of the far wall first, then the paper in front (one double-sided mesh flickered)
      // the drum itself (plinth, thick shell with a real doorway, crown, red inside) is modelled and lit in Blender: cp_shell.
      // Here: the curved display on its outer face, and the smoked-glass door panel while the heart is sealed.
      const ZB = .26, ZT = 7.32, SH = ZT - ZB, DW = 2.2, DH = 4.9;
      this.screenMat = new THREE.ShaderMaterial({
        uniforms: { uWeave: this.roomMat.uniforms.uWeave, uSeal: this.roomMat.uniforms.uSeal, uRR: { value: RR }, uDW: { value: DW }, uDH: { value: DH }, uSH: { value: SH }, uTime: TIME },
        vertexShader: `varying vec2 vUv; varying vec3 vP; varying vec3 vW; varying vec3 vN;
          void main(){ vUv=uv; vP=position; vW=(modelMatrix*vec4(position,1.)).xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform sampler2D uWeave; uniform float uSeal,uRR,uDW,uDH,uSH,uTime; varying vec2 vUv; varying vec3 vP; varying vec3 vW; varying vec3 vN;
          void main(){
            float s = atan(vP.x, vP.z)*uRR, y = vP.y + uSH*.5, r = uDW*.5, cy = uDH - r;
            float sdf = y < cy ? abs(s) - r : length(vec2(s, y - cy)) - r;
            float hsh = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453);
            bool doorway = sdf < .015;
            if (doorway && hsh > uSeal) discard;                                  // once the heart opens, the doorway is a real opening into the drum
            vec3 N = normalize(vN), V = normalize(cameraPosition - vW), Rf = reflect(-V, N);
            float ndv = max(dot(N, V), 0.);
            vec3 col = texture2D(uWeave, vUv).rgb;
            // an LED panel: a fine pixel grid you only notice up close
            vec2 px = vUv*vec2(2400., 1008.); vec2 f = abs(fract(px) - .5);
            col *= mix(.8, 1., smoothstep(.5, .36, max(f.x, f.y)));
            // emissive, a touch brighter than the room, dimming at grazing angles like a real display
            col *= 1.08 * (.62 + .38*pow(ndv, .6));
            // the glass in front: a soft reflection of the room, strongest at the edges, and a highlight that slides as you move
            float fres = pow(1. - ndv, 3.5);
            vec3 env = mix(vec3(.80,.77,.73), vec3(1.,.99,.97), smoothstep(-.3, .9, Rf.y));
            col = mix(col, env, fres*.6);
            col += vec3(1.)*pow(max(dot(Rf, normalize(vec3(-.35,.55,.75))), 0.), 90.)*.55;
            col += vec3(1.)*pow(max(dot(Rf, normalize(vec3(.6,.2,.75))), 0.), 40.)*.12;
            // the bezels cast a soft shadow onto the screen; the doorway's edge too
            col *= .78 + .22*smoothstep(0., .22, y)*smoothstep(0., .22, uSH - y);
            if (!doorway) col *= .72 + .28*smoothstep(.015, .12, sdf);
            col = mix(col, vec3(.85,.1,.06), (1. - smoothstep(.0, .022, abs(sdf - .015))) * .9);   // while sealed: just a fine red outline where the door is
            gl_FragColor = vec4(col, 1.);
          }`,
      });
      const screen = new THREE.Mesh(new THREE.CylinderGeometry(RR + .012, RR + .012, SH, 256, 1, true), this.screenMat);
      screen.position.y = ZB + SH / 2; room.add(screen);
      // the sealed door: a curved pane of smoked glass set into the opening, with a thin red edge; it fades as the heart opens
      this.doorMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uSeal: this.roomMat.uniforms.uSeal, uRR: { value: RR - .09 }, uDW: { value: DW }, uDH: { value: DH }, uBeat: this.shared.uBeat },
        vertexShader: `varying vec3 vP; varying vec3 vW; varying vec3 vN; void main(){ vP=position; vW=(modelMatrix*vec4(position,1.)).xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform float uSeal,uRR,uDW,uDH,uBeat; varying vec3 vP; varying vec3 vW; varying vec3 vN;
          void main(){
            float s = atan(vP.x, vP.z)*uRR, y = vP.y, r = uDW*.5 - .02, cy = uDH - r;
            float sdf = y < cy ? abs(s) - r : length(vec2(s, y - cy)) - r;
            if (sdf > 0. || uSeal < .01) discard;
            vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
            float fres = pow(1. - abs(dot(N, V)), 3.);
            vec3 col = mix(vec3(.10,.07,.07), vec3(.85,.82,.8), fres*.7) + vec3(.35,.03,.02)*(.25 + .25*uBeat)*(1. - y/uDH);
            col = mix(col, vec3(.85,.1,.06), 1. - smoothstep(.0, .025, -sdf));     // a thin red edge
            gl_FragColor = vec4(col, (.86 + .1*fres) * uSeal);
          }`,
      });
      const door = new THREE.Mesh(new THREE.CylinderGeometry(RR - .09, RR - .09, DH + .1, 64, 1, true, -(DW / 2 + .1) / (RR - .09), (DW + .2) / (RR - .09)), this.doorMat);
      door.position.y = ZB + (DH + .1) / 2; door.renderOrder = 4;   // (smoked panel retired: the weave covers the sealed door)
      door.geometry.translate(0, 0, 0); door.position.y = ZB; door.geometry.translate(0, (DH + .1) / 2, 0);
      // seen from above, the red room IS the eye: an iris lid inside the marked black ring (the intro's eye lands exactly here)
      this.roomEye = new CeilingEye(g, { y: 7.49, r: RR * .97, up: true }); this.roomEye.setOpen(true); this.roomEye.lid = 1;
      const floor = new THREE.Mesh(new THREE.CircleGeometry(RR, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a0805') }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = .015; g.add(floor);
      const pool = this.lanternPool = new THREE.Mesh(new THREE.CircleGeometry(RR * 2.4, 64), poolMaterial('#ff3a24', .22)); pool.rotation.x = -Math.PI / 2; pool.position.y = .02; g.add(pool);
      // a small sign beside the door: lowercase name, italic accent
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: textTexture((x, w, hh) => {
        x.fillStyle = '#fff'; x.font = `800 ${hh * .5}px ${SANS}`; x.letterSpacing = '-6px'; x.fillText('centerpiece', 10, hh * .55);
        x.letterSpacing = '0px'; x.font = `italic 400 ${hh * .3}px ${ITALIC}`; x.fillText('handmade works', 12, hh * .92);
      }, 1024, 340) }));
      // (the small sign is gone: the spiral tape names it now)
      {
        const c = document.createElement('canvas'), x = c.getContext('2d'), phrase = 'centerpiece  ·  handmade works  ·  ', f = `700 150px ${SANS}`;
        x.font = f; const pw = Math.ceil(x.measureText(phrase).width); c.width = pw; c.height = 220;
        x.fillStyle = '#fbfaf7'; x.fillRect(0, 0, pw, 220); x.fillStyle = '#c8261b'; x.font = f; x.textBaseline = 'middle'; x.fillText(phrase, 0, 116);
        const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const turns = 1.7, y0 = .7, y1 = 6.8, w = .44, rT = RR + .035, S2 = 420, th0 = Math.PI * .55;
        const len = Math.hypot(Math.PI * 2 * rT * turns, y1 - y0);
        const pos = [], uv = [], idx = [];
        for (let i = 0; i <= S2; i++) {
          const t = i / S2, th = th0 + t * turns * Math.PI * 2, y = y0 + (y1 - y0) * t;
          for (const k of [0, 1]) { pos.push(Math.sin(th) * rT, y + (k ? w / 2 : -w / 2), Math.cos(th) * rT); uv.push(t * len, k); }
          if (i < S2) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
        this.roomTape = new THREE.Mesh(geo, new THREE.ShaderMaterial({
          side: THREE.DoubleSide,
          uniforms: { uMap: { value: tex }, uScale: { value: 220 / (w * pw) }, uOff: { value: 0 }, uRR: { value: RR }, uDW: { value: 2.2 }, uDH: { value: 4.9 } },
          vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
          fragmentShader: `uniform sampler2D uMap; uniform float uScale,uOff,uRR,uDW,uDH; varying vec2 vUv; varying vec3 vP;
            void main(){
              float s = atan(vP.x, vP.z)*uRR;                                  // keep the doorway clear
              if (abs(s) < uDW*.5 + .25 && vP.y < uDH + .35) discard;
              gl_FragColor = texture2D(uMap, vec2(fract(vUv.x*uScale - uOff), vUv.y));
            }`,
        }));
        // (the spiral tape is off for the lantern)
      }
    }
    // a single thin black ring floats under the oculus, slowly turning
    {
      const halo = new THREE.Group(); halo.position.y = 8.65; this.scene.add(halo); this.halo = halo;
      const ink = new THREE.MeshBasicMaterial({ color: '#141414' });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, .02, 8, 200), ink); ring.rotation.x = Math.PI / 2; halo.add(ring);
      for (let i = 0; i < 72; i++) {                       // tick marks, like the eye's ring
        const a = i / 72 * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(.012, i % 6 ? .08 : .2, .012), ink);
        t.position.set(Math.cos(a) * 5.2, i % 6 ? -.04 : -.1, Math.sin(a) * 5.2); halo.add(t);
      }
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2, wire = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, WALL_H - 8.65, 4), ink);
        wire.position.set(Math.cos(a) * 5.2, (WALL_H - 8.65) / 2, Math.sin(a) * 5.2); halo.add(wire);
      }
    }
    // a beam of light falls from the oculus onto the heart, with dust drifting inside it
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, WALL_H + .4, 64, 1, true), coneMaterial());
    shaft.material.uniforms.uColor.value.set('#fff4e6'); shaft.material.uniforms.uI.value = .09; shaft.position.y = (WALL_H + .4) / 2; this.lightShaft = shaft;   // (not in the scene: invisible on white)
    {
      const n = this.Q.reflect ? 700 : 220, pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) { const a = Math.random() * 7, r = Math.sqrt(Math.random()) * 3.3; pos.set([Math.cos(a) * r, Math.random() * 10, Math.sin(a) * r], i * 3); seed[i] = Math.random() * 100; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: TIME, uPx: { value: this.pr } },
        vertexShader: `attribute float seed; uniform float uTime,uPx; varying float vA;
          void main(){ vec3 p=position; p.y=mod(p.y-uTime*.08*(.5+fract(seed)),10.); p.x+=sin(uTime*.3+seed)*.25; p.z+=cos(uTime*.25+seed)*.25;
            vec4 mv=modelViewMatrix*vec4(p,1.); vA=.35+.65*pow(.5+.5*sin(uTime*1.7+seed*4.),3.);
            gl_PointSize=uPx*(16./-mv.z)*(.6+fract(seed*7.)); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(1.,.95,.88),smoothstep(.5,0.,d)*vA*.5); }`,
      }));
      pts.frustumCulled = false;   // (shaft dust: not in the scene)
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(CH_R * .96, CH_R, .18, 96), new THREE.MeshStandardMaterial({ color: '#efece7', roughness: .5, emissive: '#e6e2db', emissiveIntensity: .35 }));
    cap.position.y = 7.29; g.add(cap); this.heartCap = cap;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(CH_R * .7, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(1.6), toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 7.39; g.add(glow); this.heartGlow = glow;
    // floating title
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      map: textTexture((x, w, h) => {
        x.textAlign = 'center';
        x.fillStyle = '#111'; x.font = `800 128px ${SANS}`; x.letterSpacing = '-6px'; x.fillText('centerpiece', w / 2, h * .52);
        // (the red line under it came out, 2026-11-14)
      }),
    }));
    sprite.scale.set(5.2, 2.6, 1); sprite.position.y = 8.7; g.add(sprite); this.heartTitle = sprite;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(CH_R + .1, CH_R + .1, 7.4, 24), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 3.7; hit.userData = { type: 'heart' }; g.add(hit); this.interactive.push(hit);
    if (PAVILION) this.buildPavilion(g);
    if (LOOM) this.buildLoom(g);
  }

  /* ---------- CenterPiece as an iris pavilion ----------
     A round gallery: the handmade works framed on its outside wall, roofed by an aperture of red wing-shaped blades
     inside the marked black ring. From above it IS the eye (the intro's butterflies land on it as the iris);
     when you go in, the blades turn open like a camera lens and the butterfly dives into the pupil. */
  buildPavilion(g) {
    const RR = CH_R + .35, TOP = 7.5;
    // retire the drum: its baked shell, weave screen, door, the shader eye on top, the floating works, the red glow
    if (this.redRoom) this.redRoom.visible = false;
    if (this.roomEye) { this.roomEye.update = () => {}; g.traverse(o => { if (o !== g && o.position && Math.abs(o.position.y - 7.49) < .005 && o.type !== 'Group') o.visible = false; }); }
    this.floaters.forEach(f => (f.piv.visible = false));
    this.weave = null; this.roomTape = null;
    if (this.heartGlow) this.heartGlow.visible = false;
    if (this.heartCap) this.heartCap.visible = false;
    const P = this.pav = new THREE.Group(); g.add(P);
    // the wall: warm plaster with a red frieze near the top ("centerpiece · handmade works"), softly shaded so it reads round
    const wc = document.createElement('canvas'); wc.width = 4096; wc.height = 1024; const wx = wc.getContext('2d');
    wx.fillStyle = '#f4f0ea'; wx.fillRect(0, 0, 4096, 1024);
    for (let i = 0; i < 9000; i++) { wx.fillStyle = `rgba(${Math.random() < .5 ? '120,100,90' : '255,255,255'},${Math.random() * .06})`; wx.fillRect(Math.random() * 4096, Math.random() * 1024, 2, 2); }
    const fy = 1024 * (1 - .905), fh = 1024 * .085;   // the frieze band (top of the canvas = top of the wall)
    wx.fillStyle = '#c8261b'; wx.fillRect(0, fy, 4096, fh);
    wx.fillStyle = '#141414'; wx.fillRect(0, fy - 6, 4096, 3); wx.fillRect(0, fy + fh + 3, 4096, 3);
    wx.fillStyle = '#fbf7f2'; wx.font = `700 ${fh * .5}px ${SANS}`; wx.textBaseline = 'middle';
    { const ph = 'centerpiece  ·  handmade works  ·  ', pw = wx.measureText(ph).width, n = Math.max(1, Math.round(4096 / pw)), sx = 4096 / (n * pw);   // a whole number of phrases, so the seam is invisible
      wx.save(); wx.scale(sx, 1); for (let k = 0; k < n; k++) wx.fillText(ph, k * pw, fy + fh * .54); wx.restore(); }
    const wtex = new THREE.CanvasTexture(wc); wtex.colorSpace = THREE.SRGBColorSpace; wtex.anisotropy = 8;
    const plaster = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: wtex } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 c = texture2D(uMap, vUv).rgb; vec3 V = normalize(cameraPosition - vW);
          float ndv = max(dot(normalize(vN), V), 0.), l = .5 + .5*max(dot(normalize(vN), normalize(vec3(-.5,.3,.8))), 0.);
          c *= mix(.72, 1., pow(ndv, .55)) * (.9 + .12*l) * (.86 + .14*smoothstep(0., .35, vUv.y));   // round edges darken, a little darker near the floor
          gl_FragColor = vec4(c, 1.); }`,
    });
    const ink = new THREE.MeshBasicMaterial({ color: '#141414' });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(RR, RR, TOP - .3, 160, 1, true), plaster); wall.position.y = .3 + (TOP - .3) / 2; P.add(wall);
    // inside: a deep red that glows from below, like the inside of an eye (never a black-out while you pass through)
    const innerMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uBeat: this.shared.uBeat },
      vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uBeat; varying float vY; void main(){ float k = clamp(.5 - vY/${(TOP - .3).toFixed(2)}, 0., 1.);
        gl_FragColor = vec4(mix(vec3(.16,.012,.008), vec3(.55,.04,.02)*(1. + .25*uBeat), k*k), 1.); }` });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(RR - .05, RR - .05, TOP - .3, 96, 1, true), innerMat); inner.position.y = wall.position.y; P.add(inner);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(RR + .14, RR + .2, .3, 160), ink); plinth.position.y = .15; P.add(plinth);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(RR + .03, RR + .03, .16, 160, 1, true), ink); lip.position.y = TOP - .06; P.add(lip);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(RR - .05, 96), poolMaterial('#ff2a1a', .9)); floor.rotation.x = -Math.PI / 2; floor.position.y = .31; P.add(floor);
    // the handmade works, framed on the outside wall in two staggered rows
    const n = Math.ceil(this.floaters.length / 2);
    this.floaters.forEach((f, i) => {
      const t = f.m.material.map, asp = f.m.geometry.parameters.width / f.m.geometry.parameters.height;
      const row = i % 2, k = Math.floor(i / 2), a = (k + row * .5) / n * Math.PI * 2 + Math.PI * .5;
      let h = row ? 1.35 : 1.6, w = h * asp; if (w > 1.55) { w = 1.55; h = w / asp; }
      const fr = new THREE.Group(); fr.position.set(Math.sin(a) * (RR + .09), row ? 4.75 : 2.55, Math.cos(a) * (RR + .09)); fr.rotation.y = a; P.add(fr);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w + .1, h + .1), ink); fr.add(back);
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(w + .05, h + .05), new THREE.MeshBasicMaterial({ color: '#f6f3ee' })); mat.position.z = .002; fr.add(mat);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(.94, .92, .9) })); art.position.z = .004; fr.add(art);
    });
    // the aperture: red wing-blades pivoting on the rim, under the marked black ring
    const NB = 12, R0 = RR * .9, L = RR * .86, BW = 1.55;   // BW widens the blades so they overlap like a lens iris
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 256; const bx = bc.getContext('2d');
    const grd = bx.createLinearGradient(0, 0, 512, 0); grd.addColorStop(0, '#3e0604'); grd.addColorStop(.4, '#a81b0e'); grd.addColorStop(.8, '#d23019'); grd.addColorStop(1, '#e8502e');
    bx.fillStyle = grd; bx.fillRect(0, 0, 512, 256);
    bx.strokeStyle = 'rgba(30,4,2,.5)'; bx.lineWidth = 3;
    for (const v of [.18, .34, .5, .66, .82]) { bx.beginPath(); bx.moveTo(0, 128); bx.quadraticCurveTo(260, 128 + (v - .5) * 140, 512, v * 256); bx.stroke(); }
    bx.fillStyle = 'rgba(255,240,228,.85)'; for (const [u, v] of [[.88, .32], [.92, .55], [.82, .72]]) { bx.beginPath(); bx.arc(u * 512, v * 256, 7, 0, 7); bx.fill(); }
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace; btex.anisotropy = 8;
    const sh = new THREE.Shape();
    sh.moveTo(0, -.2 * BW); sh.bezierCurveTo(.35 * L, -.44 * BW, .8 * L, -.38 * BW, L, -.06 * BW); sh.bezierCurveTo(1.04 * L, .2 * BW, .7 * L, .44 * BW, .3 * L, .4 * BW); sh.bezierCurveTo(.12 * L, .36 * BW, 0, .22 * BW, 0, -.2 * BW);
    const bgeo = new THREE.ShapeGeometry(sh, 24), buv = bgeo.attributes.uv, bpos = bgeo.attributes.position;
    for (let i = 0; i < buv.count; i++) buv.setXY(i, bpos.getX(i) / L, (bpos.getY(i) / BW + .46) / .92);
    bgeo.rotateX(-Math.PI / 2);   // lie flat: shape x -> world x, shape y -> world -z
    const bmat = new THREE.MeshBasicMaterial({ map: btex, side: THREE.DoubleSide });
    const edge = new THREE.BufferGeometry().setFromPoints(sh.getPoints(60).map(q => new THREE.Vector3(q.x, .002, -q.y)));
    const emat = new THREE.LineBasicMaterial({ color: '#1a0503' });
    this.blades = [];
    for (let i = 0; i < NB; i++) {
      const th = i / NB * Math.PI * 2, piv = new THREE.Group();
      piv.position.set(Math.cos(th) * R0, TOP + .012 + i * .0035, Math.sin(th) * R0); P.add(piv);
      piv.add(new THREE.Mesh(bgeo, bmat)); piv.add(new THREE.Line(edge, emat));
      piv.userData.th = th; this.blades.push(piv);
    }
    if (this.crownRing) this.crownRing.position.y = TOP + .07;   // the marked ring sits over the blades' pivots
    this.irisV = null; this.setIris(0);
  }
  /* ---------- CenterPiece as a round loom ----------
     A black lacquer ring loom standing on a round dais. Red warp threads run across it and the worm weaves the
     handmade works into it, live, in a loop (the WeaveWall). It slowly turns to face you. The dais top is the eye
     seen from above: red iris fibres inside the marked black ring, with the loom's dark edge as a slit pupil. */
  buildLoom(g) {
    if (this.redRoom) this.redRoom.visible = false;
    if (this.roomEye) { this.roomEye.update = () => {}; g.traverse(o => { if (o !== g && o.position && Math.abs(o.position.y - 7.49) < .005 && o.type !== 'Group') o.visible = false; }); }
    this.floaters.forEach(f => (f.piv.visible = false));
    this.roomTape = null;
    for (const o of [this.heartGlow, this.heartCap, this.crownRing]) if (o) o.visible = false;
    const L = this.loom = new THREE.Group(); g.add(L);
    const ink = new THREE.MeshBasicMaterial({ color: '#141414' });
    // the dais: black edge, the eye on top
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(DAIS_R, DAIS_R + .06, DAIS_Y, 160), ink); dais.position.y = DAIS_Y / 2; g.add(dais);
    {
      const S_ = DEVICE.mobile ? .5 : 1, c = document.createElement('canvas'); c.width = c.height = 2048 * S_; const x = c.getContext('2d'), m = 1024, ro = 1024; x.scale(S_, S_);   // (phones/tablets: half size)
      x.fillStyle = '#0f0f0f'; x.beginPath(); x.arc(m, m, ro, 0, 7); x.fill();
      x.fillStyle = 'rgba(245,242,236,.88)';   // the film-strip ticks, as on the eye's ring
      for (let i = 0; i < 96; i++) { x.save(); x.translate(m, m); x.rotate(i / 96 * Math.PI * 2); x.fillRect(ro * .925, -ro * .014, ro * .05, ro * .028); x.restore(); }
      const ri = ro * .86, rp = ro * .17;
      const gr = x.createRadialGradient(m, m, rp, m, m, ri); gr.addColorStop(0, '#3a0503'); gr.addColorStop(.35, '#a3180c'); gr.addColorStop(.8, '#c8261b'); gr.addColorStop(1, '#5a0a06');
      x.fillStyle = gr; x.beginPath(); x.arc(m, m, ri, 0, 7); x.fill();
      for (let i = 0; i < 900; i++) {          // iris fibres = warp threads fanning out from the pupil
        const a = Math.random() * Math.PI * 2, r0 = rp * (1 + Math.random() * .3), r1 = ri * (.55 + Math.random() * .45), bend = (Math.random() - .5) * .25;
        x.strokeStyle = Math.random() < .5 ? `rgba(255,${120 + Math.random() * 80 | 0},${80 + Math.random() * 40 | 0},${.08 + Math.random() * .18})` : `rgba(40,4,2,${.15 + Math.random() * .2})`;
        x.lineWidth = 1 + Math.random() * 2.5; x.beginPath(); x.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0);
        x.quadraticCurveTo(m + Math.cos(a + bend) * (r0 + r1) / 2, m + Math.sin(a + bend) * (r0 + r1) / 2, m + Math.cos(a + bend * .5) * r1, m + Math.sin(a + bend * .5) * r1); x.stroke();
      }
      x.strokeStyle = '#1a0302'; x.lineWidth = 18; x.beginPath(); x.arc(m, m, ri - 9, 0, 7); x.stroke();   // the dark limbal ring
      x.fillStyle = '#070505'; x.beginPath(); x.arc(m, m, rp, 0, 7); x.fill();
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
      const top = new THREE.Mesh(new THREE.CircleGeometry(DAIS_R, 160), new THREE.MeshBasicMaterial({ map: tx }));
      top.rotation.x = -Math.PI / 2; top.position.y = DAIS_Y + .004; g.add(top);
    }
    // the loom stand: a low black foot and a post up to the ring
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, .12, 48), ink); foot.position.y = DAIS_Y + .06; L.add(foot);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, LOOM_Y - LOOM_RL - DAIS_Y + .1, 16), new THREE.MeshStandardMaterial({ color: '#c3c6cb', roughness: .28, metalness: 1, emissive: '#3a3c40', emissiveIntensity: .5 })); post.position.y = DAIS_Y + (LOOM_Y - LOOM_RL - DAIS_Y + .1) / 2; L.add(post);
    const F = this.loomFace = new THREE.Group(); F.position.y = LOOM_Y; L.add(F);
    // the ring: black lacquer with brass pegs all round (a circular loom's notches)
    const metal = this.loomMetal = new THREE.MeshStandardMaterial({ color: '#8f949a', roughness: .55, metalness: .85, emissive: '#26282b', emissiveIntensity: .6 });   // soft brushed steel: no red glare
    this.loomRings = [new THREE.Mesh(new THREE.TorusGeometry(LOOM_RL, .11, 24, 200), metal), new THREE.Mesh(new THREE.TorusGeometry(LOOM_RL - .2, .025, 12, 200), metal)];   // and a fine inner ring
    this.loomRings.forEach(r => F.add(r));
    const brass = new THREE.MeshStandardMaterial({ color: '#b08a4a', roughness: .35, metalness: .8, emissive: '#3a2a10' });
    const pegs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .025, .34, 8), brass, 72), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion();
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; Q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); M4.compose(new THREE.Vector3(Math.cos(a) * (LOOM_RL + .1), Math.sin(a) * (LOOM_RL + .1), 0), Q, new THREE.Vector3(1, 1, 1)); pegs.setMatrixAt(i, M4); }
    // (no pegs: a clean metal structure, not a loom)
    // the woven circle: the live weave, with red warp threads over and under it
    this.weave = this.loomWeave = new WeaveWall(() => this.floaters.map(f => f.m.material.map && f.m.material.map.image), { w: 1024, h: 1024, worm: false, strands: 5, spitR: [80, 165], spitEvery: .3, paper: '#0e0c0b' });   // dark ground: the works read clearly, no white glare
    this.loomMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uWeave: { value: this.loomWeave.texture }, uTime: TIME, uIn: { value: 0 }, uMix: { value: 0 }, uFocus: { value: 0 }, uFocusC: { value: new THREE.Vector2(.5, .5) }, uRip: { value: 0 }, uRipT: { value: 0 }, uSuck: { value: 0 }, uRipC: { value: new THREE.Vector2(.5, .4) }, uVid: { value: (() => { const t = new THREE.DataTexture(new Uint8Array([3, 3, 3, 255]), 1, 1); t.needsUpdate = true; return t; })() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D uWeave, uVid; uniform float uTime, uIn, uMix, uRip, uRipT, uSuck, uFocus; uniform vec2 uRipC, uFocusC; varying vec2 vUv;
        void main(){
          vec2 q = vUv - .5; float r = length(q)*2.;
          // the liquid surface: rings run out from where the worm came out; the picture bends and is drawn in toward it
          vec2 uv = vUv, dv = vUv - uRipC; float dd = length(dv) + 1e-4;
          float wave = sin(dd*28. - uRipT*6. + sin(atan(dv.y, dv.x)*3. + uRipT)*.6) * exp(-dd*4.2) * uRip;   // a few soft, slightly uneven rings, dying out quickly
          uv += dv/dd * wave * .018; uv = uRipC + (uv - uRipC) * (1. - uSuck);
          vec2 vu = .5 + (uv - .5) * 1.8; vu.x = .5 + (vu.x - .5) * .5625;                                       // the film, zoomed out inside the circle
          float inF = smoothstep(0., .08, vu.y) * smoothstep(1., .92, vu.y) * smoothstep(0., .05, vu.x) * smoothstep(1., .95, vu.x);
          vec3 film = mix(vec3(.012, .009, .008), pow(texture2D(uVid, clamp(vu, 0., 1.)).rgb, vec3(1.3)) * .64, inF);
          vec3 col = mix(texture2D(uWeave, uv, uFocus * 3.5).rgb, film, uMix);
          vec2 fq = vUv - uFocusC; float fd = dot(fq, fq);
          col = mix(col, col * (.04 + .14 * exp(-fd * 22.)) + vec3(1., .8, .58) * exp(-fd * 30.) * .1, uFocus);   // a spotlight finds the creature; the art sinks into the dark
          col += vec3(1., .96, .9) * pow(max(0., wave), 2.) * .1;   // light catching the crests   // (the room's exposure and bloom would blow the film out: brought back to how it was rendered)   // the art itself, crisp (or the film, cropped to the circle)
          col *= .9 + .1*smoothstep(1., .6, r);                                            // a soft shade just inside the ring
          gl_FragColor = vec4(col, 1.);
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(LOOM_RL - .06, 128), this.loomMat); F.add(disc); this.loomDisc = disc;
    this.loomDark = this.loomMat.uniforms.uVid.value;   // (the ring's dark backdrop, used to dim the art while the creature is on it)
    { // the worm, in 3D: the very same creature as in CenterPiece, crawling over the weave and spitting the art where it stops
      this.loomWorm = new Worm3D({ low: this.gpu?.tier === 'low', linear: true }); this.loomWorm.group.position.z = .07; F.add(this.loomWorm.group);
    }
    // a soft red pool of light on the dais under it
    const pool = new THREE.Mesh(new THREE.CircleGeometry(DAIS_R * .9, 64), poolMaterial('#ff3a24', .18)); pool.rotation.x = -Math.PI / 2; pool.position.y = DAIS_Y + .01; g.add(pool);
    if (this.heartTitle) this.heartTitle.position.y = LOOM_Y + LOOM_RL + 1.1;
    this.loomFace.userData.yaw = 0;
  }
  setIris(v) {   // 0 = shut to a small pupil, 1 = wide open
    const phi = lerp(.04, .95, clamp(v, 0, 1));
    for (const b of this.blades) b.rotation.y = Math.PI - b.userData.th + phi;
  }

  /* ---------- veins from the heart to a room ---------- */
  buildVein(k, endDist) {
    return null;   // the white edition has no veins
    const a = angleOf(k), d = dir(a), rt = rightOf(a), seed = k * 13.7;
    const rnd = (i) => { const s = Math.sin(seed * 91.7 + i * 47.3) * 43758.5; return s - Math.floor(s); };
    const main = [];
    for (let s = 0; s <= 1.0001; s += 1 / 28) {
      const dist = lerp(CH_R + .05, endDist, s);
      const wob = Math.sin(s * 9 + seed) * .45 * Math.sin(s * Math.PI) + Math.sin(s * 23 + seed) * .08;
      main.push(d.clone().multiplyScalar(dist).addScaledVector(rt, dist < R ? wob : wob * .25).setY(BAKED ? -.012 : .045));
    }
    const curve = new THREE.CatmullRomCurve3(main), len = curve.getLength();
    const mat = veinMaterial(this.shared, len / 4, .022);
    this.scene.add(new THREE.Mesh(taperedTube(curve, 320, .075, .022, 14), mat));
    // branches and twigs, thinning as they leave the main vessel
    const branch = (root, dirv, length, r0, off, depth, i) => {
      const pts = [root.clone()], n = 6; let p = root.clone(), dv = dirv.clone();
      for (let j = 1; j <= n; j++) {
        dv.applyAxisAngle(new THREE.Vector3(0, 1, 0), (rnd(i * 7 + j) - .5) * .5);
        p = p.clone().addScaledVector(dv, length / n); p.y = BAKED ? -.01 : .035; pts.push(p);
      }
      const c = new THREE.CatmullRomCurve3(pts), bl = c.getLength();
      this.scene.add(new THREE.Mesh(taperedTube(c, 48, r0, .006, 8), veinMaterial(this.shared, bl / 4, r0 * .3, off)));
      if (depth > 0) for (let t = 1; t <= 2; t++) {
        const s = .35 + t * .22, rp = c.getPointAt(s), tg = c.getTangentAt(s), sd = (i + t) % 2 ? 1 : -1;
        branch(rp, tg.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), sd * (.6 + rnd(i * 3 + t) * .4)), length * .45, r0 * .5, off + s * bl / 4, depth - 1, i * 5 + t);
      }
    };
    const nb = Math.round(len / 2.2);
    for (let i = 0; i < nb; i++) {
      const s = .06 + (i / nb) * .86 + rnd(i) * .04, root = curve.getPointAt(s), tg = curve.getTangentAt(s), side = i % 2 ? 1 : -1;
      const ang = side * (.55 + rnd(i + 3) * .5);
      branch(root, tg.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang), 1.4 + rnd(i + 9) * 1.6, lerp(.075, .022, s) * .6, s * len / 4, this.Q.hallLights ? 1 : 0, i);
    }
    this.veins[k] = mat;
    return mat;
  }

  /* ---------- a hall ---------- */
  hallGroup(k, L, W) {
    const a = angleOf(k);
    const g = new THREE.Group(); g.position.copy(dir(a).multiplyScalar(R0 + L / 2)); g.rotation.y = a; this.scene.add(g);
    return g;
  }
  hallShade(hall, shell) {   // soft contact shade where the walls meet the floor and the ceiling: the baked rooms read flat without it
    const g = hall.group, W = hall.W, rc = new THREE.Raycaster(); g.updateMatrixWorld(true); shell.updateMatrixWorld();
    const o = g.localToWorld(new THREE.Vector3(0, 1.5, -hall.L / 2 + 1)), d = g.localToWorld(new THREE.Vector3(0, 1.5, -hall.L / 2 + 2)).sub(o).normalize();
    rc.set(o, d); const hit = rc.intersectObject(shell, false)[0];
    const z0 = -hall.L / 2 + .02, z1 = (hit ? -hall.L / 2 + 1 + hit.distance : hall.L / 2) - .02, x = W / 2 - .015, top = HALL_H - .02;
    const P = [], C = [], col = [.16, .12, .09];
    const quad = (a, b, c, e, al) => { for (const [v, k] of [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [e, 3]]) { P.push(...v); C.push(...col, al[k]); } };
    for (const sx of [-1, 1]) {
      quad([sx * x, .007, z0], [sx * x, .007, z1], [sx * (x - 1.25), .007, z1], [sx * (x - 1.25), .007, z0], [.46, .46, 0, 0]);   // floor, along the wall
      quad([sx * x, .0, z0], [sx * x, .0, z1], [sx * x, 1.7, z1], [sx * x, 1.7, z0], [.32, .32, 0, 0]);                       // wall foot
      quad([sx * x, top - 1.6, z0], [sx * x, top - 1.6, z1], [sx * x, top, z1], [sx * x, top, z0], [0, 0, .32, .32]);         // up into the ceiling corner
    }
    quad([-x, .007, z1], [x, .007, z1], [x, .007, z1 - 1.2], [-x, .007, z1 - 1.2], [.42, .42, 0, 0]);                            // floor at the end wall
    quad([-x, .0, z1 - .01], [x, .0, z1 - .01], [x, 1.7, z1 - .01], [-x, 1.7, z1 - .01], [.3, .3, 0, 0]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.renderOrder = 2; m.name = 'contact-shade'; g.add(m);
  }
  /* ---------- zone (portal) culling ----------
     The museum is a hub: the Rotunda, and through one arch each, the five halls and the back room. Before each frame is drawn,
     work out which room the camera stands in and which arches fall inside the view. Rooms that can't be seen are switched off
     whole (their group, their baked shell, their lanterns, their loose props), so the renderer, the matrix updates and their
     little animations all skip them. Lights never change (they're moved to the scene root once), so no shader ever recompiles.
     From above the ceiling (the descent), before entry, or while something is being prepared, everything shows. */
  zoneOf(x, y, z) {
    const r = Math.hypot(x, z); if (r < R) return 'rot';
    const ang = Math.atan2(x, z);
    for (const m of this.zones.rooms) { let d = ang - m.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      const lat = r * Math.sin(d), rad = r * Math.cos(d);
      if (Math.abs(lat) < m.W / 2 + 1.2 && rad > R0 - .5 && rad < R0 + m.L + 1.5) return m.id; }
    return 'out';
  }
  setupZones() {
    const rooms = [...Object.entries(this.halls).map(([id, h]) => ({ id, a: h.a, L: h.L, W: h.W, group: h.group })), { id: 'backroom', a: this.backroom.a, L: this.backroom.L, W: this.backroom.W, group: this.backroom.group }];
    const Z = this.zones = { rooms, box: {}, vis: { rot: true }, seen: new Set(), frustum: new THREE.Frustum(), m: new THREE.Matrix4(), hold: 0, n: 0 };
    for (const id of ['rot', ...rooms.map(r => r.id)]) { const g = Z.box[id] = new THREE.Group(); g.name = 'zone_' + id; this.scene.add(g); Z.seen.add(g); Z.vis[id] = true; }
    rooms.forEach(r => {
      const c = dir(r.a), sd = new THREE.Vector3(c.z, 0, -c.x), b = new THREE.Box3();   // the arch, wide and tall enough for the name over it
      for (const dr of [R0 - 1.6, R + .6]) for (const ds of [-(HALL_W / 2 + .6), HALL_W / 2 + .6]) for (const y of [0, WALL_H]) b.expandByPoint(c.clone().multiplyScalar(dr).addScaledVector(sd, ds).setY(y));
      r.portal = b;
      const ls = []; r.group.traverse(o => { if (o.isLight) ls.push(o); }); ls.forEach(l => { this.scene.attach(l); Z.seen.add(l); });   // never change the light count
      Z.seen.add(r.group);
    });
    this.setupOcclusion();
    for (const m of Object.values(this._linings || {})) Z.seen.add(m);   // the arch linings span both sides of an arch: always on
    this.zoneSort();
    this.decalGuard();
    this.archLiningColours(); this.keyColours();
  }
  decalGuard() {   // pictures, decals and strips lying flat on a wall or floor: a small, fixed depth bias so they always win over the surface under them (they fought it: z-fighting)
    const flat = new Set(), solid = new Set(), roots = [...this.zones.rooms.map(r => r.group), ...Object.values(this.zones.box)];
    for (const g of roots) g.traverse(o => {
      if (!o.isMesh || !o.geometry || /_(shell|floor)$/.test(o.name)) return;
      const ms = [].concat(o.material), bb = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox), sz = bb.getSize(new THREE.Vector3());
      for (const m of ms) (Math.min(sz.x, sz.y, sz.z) > .002 ? solid : flat).add(m);
    });
    let n = 0; for (const m of flat) if (!solid.has(m) && !m.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -4; n++; }   // only finishes used by flat things alone; a fixed bias (a slope-scaled one grew at grazing angles and let things show through walls)
    return n;
  }
  /* occlusion culling: an invisible card in each arch opening (a little larger than the opening), drawn after the solid things
     with a GPU occlusion query. If no pixel of it passed the depth test last frame (the heart, a wall or a pillar is in the way),
     the room behind it is skipped. A room switches back on the frame its card shows a pixel; the oversize card makes that early. */
  setupOcclusion() {
    const Z = this.zones, gl = this.renderer.getContext();
    if (!(typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)) return;
    const T = gl.ANY_SAMPLES_PASSED_CONSERVATIVE, cards = this.portalCards();
    for (const r of Z.rooms) {
      const card = cards[r.id], st = r.occ = { q: gl.createQuery(), pending: false, active: false, seen: true, at: 0 };
      if (!card) continue;
      card.onBeforeRender = () => { if (!st.pending && !st.active && Z.n !== st.issued) { gl.beginQuery(T, st.q); st.active = true; st.issued = Z.n; } };
      card.onAfterRender = () => { if (st.active) { gl.endQuery(T); st.active = false; st.pending = true; } };
      Z.seen.add(card); r.card = card;
    }
    Z.occ = gl;
  }
  /* the arch linings: the baked texture on each arch's inner faces was stretched, had dark seams, and the Rotunda's and the hall's shells
     overlapped there (the "crack" you saw walking in). A clean plaster lining, 5 mm in front of the reveal, in each arch's own stone colour,
     softly shaded (a touch darker under the curve and deeper in). Made before the warm-up, coloured from the bake once it's in. */
  archLinings() {
    if (this._linings) return this._linings;
    const rooms = [...Object.entries(this.halls || {}).map(([id, h]) => [id, h.a]), ...(this.backroom ? [['backroom', this.backroom.a]] : [])];
    const hw = ARCH_W / 2 - .005, spring = ARCH_H - ARCH_W / 2, r0 = R - .64, r1 = R + .31, prof = [];
    prof.push([-hw, 0]); for (let k = 0; k <= 24; k++) { const t = Math.PI - k / 24 * Math.PI; prof.push([Math.cos(t) * hw, spring + Math.sin(t) * hw]); } prof.push([hw, 0]);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const L = this._linings = {};
    for (const [id, a] of rooms) {
      const c = dir(a), sd = new THREE.Vector3(c.z, 0, -c.x), P = [], C = [], I = [], shade = [];
      // the Blender room's ceiling is 6.5 m, under the arch's 6.6 m crown: from just before that ceiling starts (R - .28) the lining's crown
      // eases down under it and the 7 cm lip of its edge (at R - .3), or a dark strip of the room's ceiling cuts across the top of the arch as you walk in
      const cap = id === 'backroom' ? 6.42 : Infinity, rings = cap < ARCH_H ? [r0, R - .42, r1] : [r0, r1], nR = rings.length;
      prof.forEach(([u, y], k) => { for (const r of rings) { const yy = r > r0 ? Math.min(y, cap) : y, v = c.clone().multiplyScalar(r).addScaledVector(sd, u).setY(yy); P.push(v.x, v.y, v.z); C.push(1, 1, 1);
        const top = yy > spring ? (yy - spring) / (ARCH_H - spring) : 0; shade.push((.96 - .1 * top) * (r === r0 ? 1 : r === r1 ? .9 : .95) * (yy < .4 ? .9 + .25 * yy : 1)); } });
      for (let k = 0; k < prof.length - 1; k++) for (let j = 0; j < nR - 1; j++) { const i = k * nR + j, n = i + nR; I.push(i, i + 1, n, i + 1, n + 1, n); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setIndex(I);
      const m = new THREE.Mesh(geo, mat); m.name = 'arch_lining_' + id; m.userData.shade = shade; m.userData.a = a; m.raycast = () => {}; this.scene.add(m); L[id] = m;
    }
    return L;
  }
  archLiningColours() {   // each arch's own stone colour, read from the Rotunda bake (bright texels only: the dark seams are what we're covering)
    const L = this._linings; if (!L || this._liningsCol) return; let rot = null; this.scene.traverse(o => { if (!rot && o.isMesh && o.name === 'rot_shell') rot = o; });
    const img = rot?.material?.map?.image; if (!img || !img.width) return; this._liningsCol = true;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * img.height / img.width); const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, cv.width, cv.height);
    const rc = new THREE.Raycaster(), tint = rot.material.color.clone();
    for (const m of Object.values(L)) {
      const a = m.userData.a, c = dir(a), sd = new THREE.Vector3(c.z, 0, -c.x), cols = []; m.visible = false;
      for (const r of [R - .5, R - .2, R + .1]) for (const y of [.8, 2, 3.4]) for (const sg of [1, -1]) { rc.set(c.clone().multiplyScalar(r).setY(y), sd.clone().multiplyScalar(sg)); rc.far = 4;
        const h = rc.intersectObject(rot, false)[0]; if (h && h.uv) { const px = x.getImageData(Math.min(cv.width - 1, Math.floor(h.uv.x * cv.width)), Math.min(cv.height - 1, Math.floor(h.uv.y * cv.height)), 1, 1).data; cols.push([px[0], px[1], px[2]]); } }
      m.visible = true; if (!cols.length) continue;
      cols.sort((p, q) => (q[0] + q[1] + q[2]) - (p[0] + p[1] + p[2])); const top = cols.slice(0, Math.max(1, Math.ceil(cols.length * .5)));   // the brighter half
      const avg = top.reduce((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2]], [0, 0, 0]).map(v => v / top.length / 255);
      const base = new THREE.Color().setRGB(avg[0], avg[1], avg[2], THREE.SRGBColorSpace).multiply(tint), col = m.geometry.attributes.color;
      m.userData.shade.forEach((k, i) => col.setXYZ(i, base.r * k, base.g * k, base.b * k)); col.needsUpdate = true;
    }
  }
  portalCards() {   // the invisible cards in the arch openings: made before the warm-up, so their shader is prepared behind the loading screen
    if (this._cards) return this._cards;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const geo = new THREE.PlaneGeometry(ARCH_W + 1.4, ARCH_H + 1.2), cards = this._cards = {};
    const rooms = [...Object.entries(this.halls || {}).map(([id, h]) => [id, h.a]), ...(this.backroom ? [['backroom', this.backroom.a]] : [])];
    for (const [id, a] of rooms) {
      const card = cards[id] = new THREE.Mesh(geo, mat);
      card.position.copy(dir(a).multiplyScalar(R - .05)).setY((ARCH_H + 1.2) / 2 - .15); card.rotation.y = a; card.renderOrder = 1e6; card.name = 'portal_' + id;
      card.raycast = () => {}; this.scene.add(card);
    }
    return cards;
  }
  readOcclusion() {   // last frame's answers (non-blocking: only results the GPU already has)
    const Z = this.zones, gl = Z.occ; if (!gl) return;
    for (const r of Z.rooms) { const st = r.occ;
      if (st.pending && gl.getQueryParameter(st.q, gl.QUERY_RESULT_AVAILABLE)) { const vis = gl.getQueryParameter(st.q, gl.QUERY_RESULT) > 0; st.pending = false; st.at = Z.n;
        st.blocked = vis ? 0 : (st.blocked || 0) + 1; st.seen = st.blocked < 30; } }   // seen: at once; hidden: only after ~30 frames fully blocked (the camera's sway made it blink)
  }
  occluded(r, cp) {   // only trust a fresh answer, and never when standing in the arch itself
    const st = r.occ; if (!st || Z_STALE(this.zones.n, st.at)) return false;
    if (r.card && cp.distanceTo(r.card.position) < 3.2) return false;
    return !st.seen;
  }
  zoneSort() {   // file the loose top-level things (and the baked shells) under their room; anything that spans rooms, moves, or holds a light stays out
    const Z = this.zones, skip = new Set([this.chrysalis, this.bakedScene, ...(this.flock || []).flatMap(f => [f, f.group, f.root, f.mesh])].filter(Boolean));
    if (this.butterfly) for (const k of ['group', 'root', 'mesh', 'obj']) if (this.butterfly[k]) skip.add(this.butterfly[k]);
    const zoneOfBox = o => { o.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(o); if (b.isEmpty() || !isFinite(b.min.x)) return null;
      if (Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) <= R + .6 && Math.hypot((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2) < R - 2) return 'rot';   // inside the Rotunda's footprint
      if (b.max.x - b.min.x > 1.8 && b.max.z - b.min.z > 1.8) b.expandByScalar(-.8);   // a prop that pokes a little through an arch still belongs to its room
      let z0; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const zz of [b.min.z, b.max.z]) { const z = this.zoneOf(x, y, zz); if (z0 === undefined) z0 = z; else if (z !== z0) return null; } return z0; };
    const file = o => { if (Z.seen.has(o)) return; Z.seen.add(o); if (skip.has(o) || o.isLight || o.isCamera) return;
      const ls = []; o.traverse(c => { if (c.isLight) ls.push(c); }); ls.forEach(l => { this.scene.attach(l); Z.seen.add(l); });   // lights stay on, at the scene root
      let moves = false; o.traverse(c => { if (c.isSkinnedMesh) moves = true; }); if (moves) return;
      const z = zoneOfBox(o); if (z && Z.box[z]) Z.box[z].attach(o); };
    this.scene.children.slice().forEach(file);
    if (this.bakedScene) { const ms = []; this.bakedScene.traverse(o => { if (o.isMesh) ms.push(o); });   // the baked rooms: filed by name (rot_…, packaging_…)
      ms.forEach(o => { if (Z.seen.has(o)) return; Z.seen.add(o); const id = o.name.startsWith('rot') ? 'rot' : o.name.split('_')[0]; if (Z.box[id]) Z.box[id].attach(o); }); }
  }
  zonesShowAll(ms = 4000) { const Z = this.zones; if (!Z) return; Z.hold = performance.now() + ms; this.applyZones(null); this.portalRestore(); }
  /* arch-view culling: from the Rotunda a hall is only seen through its arch. Each of its objects is tested against the narrow
     pyramid from the camera through that opening (and skipped when it would be under a pixel). A skipped object is moved to
     layer 1, which the camera doesn't draw: its own visible flag is never touched. */
  portalLeaves(r) {
    const Z = this.zones, list = []; const take = o => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.geometry && !o.name.startsWith('portal_')) {
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (g.boundingSphere && isFinite(g.boundingSphere.radius)) list.push(o); } };
    r.group.traverse(take); Z.box[r.id]?.traverse(take); r.leaves = list; r.leavesAt = Z.n; return list;
  }
  portalRestore() { const Z = this.zones; if (!Z?.culled) return; for (const o of Z.culled) o.layers.mask = 1; Z.culled.clear(); }
  portalCull(here, show) {
    const Z = this.zones, cam = this.camera, cp = cam.position; Z.culled ||= new Set();
    const keep = new Set(), sph = Z._s || (Z._s = new THREE.Sphere()), pl = Z._pl || (Z._pl = [0, 1, 2, 3].map(() => new THREE.Plane()));
    const fpx = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));   // pixels per unit at distance 1
    if (here === 'rot') for (const r of Z.rooms) {
      if (!show[r.id]) continue;
      const c = dir(r.a), sd = Z._sd || (Z._sd = new THREE.Vector3()); sd.set(c.z, 0, -c.x);
      const mid = c.clone().multiplyScalar(R); if (cp.distanceTo(mid.clone().setY(EYE)) < 3.5) continue;   // standing in the arch: draw it all
      const hw = ARCH_W / 2 + .35, top = ARCH_H + .35, P = [[-hw, -.2], [hw, -.2], [hw, top], [-hw, top]].map(([u, y]) => mid.clone().addScaledVector(sd, u).setY(y));
      const inside = c.clone().multiplyScalar(R + 6).setY(3);
      for (let k = 0; k < 4; k++) { pl[k].setFromCoplanarPoints(cp, P[k], P[(k + 1) % 4]); if (pl[k].distanceToPoint(inside) < 0) pl[k].negate(); }
      if (!r.leaves || Z.n - r.leavesAt > 90) this.portalLeaves(r);
      for (const o of r.leaves) {
        const bs = o.geometry.boundingSphere; sph.copy(bs).applyMatrix4(o.matrixWorld);
        let out = false; for (let k = 0; k < 4 && !out; k++) if (pl[k].distanceToPoint(sph.center) < -sph.radius) out = true;
        if (!out && sph.radius * fpx / Math.max(.1, sph.center.distanceTo(cp)) < .9) out = true;   // smaller than a pixel
        if (out) { keep.add(o); if (o.layers.mask !== 2) { o.layers.mask = 2; Z.culled.add(o); } }
      }
    }
    for (const o of Z.culled) if (!keep.has(o)) { o.layers.mask = 1; Z.culled.delete(o); }
  }
  zoneVis(id) { return !this.zones || this.zones.vis[id] !== false; }
  applyZones(show) {
    const Z = this.zones;
    for (const id in Z.box) { const v = show ? !!show[id] : true; if (Z.vis[id] === v) continue; Z.vis[id] = v;
      const objs = [Z.box[id]]; const room = Z.rooms.find(r => r.id === id); if (room) objs.push(room.group);
      for (const o of objs) { o.visible = v; o.matrixWorldAutoUpdate = v; } }
  }
  updateZones() {
    if (!this.zones) { if ((this.allReady || this.entryReady) && this.journey && this.state !== 'idle' && this.state !== 'map') this.setupZones(); return; }
    const Z = this.zones, cam = this.camera, cp = cam.position;
    if (++Z.n % 90 === 0) this.zoneSort();   // late arrivals (the desk's things, lanterns)
    this.readOcclusion();
    if (this.perfOff || performance.now() < Z.hold || cp.y > WALL_H - .3 || this.state === 'map' || this.state === 'idle' || this.state === 'centerpiece') { Z.heartSeen = true; this.portalRestore(); return this.applyZones(null); }
    const here = this.zoneOf(cp.x, cp.y, cp.z);
    if (here === 'out') { Z.heartSeen = true; this.portalRestore(); return this.applyZones(null); }
    cam.updateMatrixWorld(); Z.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); Z.frustum.setFromProjectionMatrix(Z.m);
    if (!Z.heartS || (!Z.heartFit && this.weave?.users?.length)) {   // the disc that shows the weave (its own size: a sphere round the whole heart held the camera inside it)
      let disc = null; const u = this.weave?.users?.[0]; if (u) this.scene.traverse(o => { if (!disc && o.material?.uniforms?.uWeave === u) disc = o; });
      Z.heartS = disc ? new THREE.Box3().setFromObject(disc).getBoundingSphere(new THREE.Sphere()) : new THREE.Sphere(new THREE.Vector3(0, 3.5, 0), 3.5); Z.heartFit = !!disc; }
    Z.heartSeen = Z.frustum.intersectsSphere(Z.heartS);   // the weave on the heart only needs painting while the heart is in view
    const own = Z.rooms.find(r => r.id === here), show = {}, rotSeen = here === 'rot' || (Z.frustum.intersectsBox(own.portal) && !this.occluded(own, cp));
    show.rot = rotSeen;
    for (const r of Z.rooms) show[r.id] = r.id === here || (rotSeen && Z.frustum.intersectsBox(r.portal) && !this.occluded(r, cp));
    this.applyZones(show);
    this.portalCull(here, show);
  }
  hideOtherHalls(own) { const hid = []; for (const h of Object.values(this.halls || {})) if (h.group !== own && h.group.visible) { h.group.visible = false; hid.push(h.group); } return hid; }
  mergeStatic(hall) { return this.mergeGroup(hall.group); }
  mergeExtras() {
    const skip = new Set(); for (const it of this.desk?.items || []) for (const o of [it.mesh, it.ghost]) if (o) o.traverse(c => skip.add(c));   // the desk's things move (physics) and show/hide (ghosts)
    for (const f of this.flames || []) skip.add(f);
    for (const m of this.reelModels || []) m.obj?.traverse(c => skip.add(c));   // the TV's turntable copies these: merging them away left it showing half a package
    try {
      if (this.halo) this.mergeGroup(this.halo, skip);
      if (this.castle) this.mergeGroup(this.castle, skip);
      for (const o of this.scene.children) {   // the back room's own still props (loose groups standing in it)
        if (o === this.castle || o.isLight || !o.isObject3D || o.isMesh) continue;
        const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) continue;
        const c = b.getCenter(new THREE.Vector3()), a = Math.atan2(c.x, c.z), d = Math.atan2(Math.sin(a - this.backroom.a), Math.cos(a - this.backroom.a));
        if (Math.hypot(c.x, c.z) > R + 1 && Math.abs(d) < .35 && !o.userData.dynamic) this.mergeGroup(o, skip);
      }
    } catch (e) { console.warn('[NavGod] merge', e); }
  }
  mergeGroup(g, skip = new Set()) {   // one group's still furniture, merged into one mesh per finish (in the group's own frame, so a turning group still turns): hundreds of draw calls become a handful.
    // A box with a different finish on each face (cover, pages, edges) is split into its faces first, so they join the others of the same finish.
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), buckets = new Map(), M = new THREE.Matrix4(), T = new THREE.Matrix4();
    const comp = (a, v, c) => c === 0 ? a.getX(v) : c === 1 ? a.getY(v) : c === 2 ? a.getZ(v) : a.getW(v);
    const piece = (ge, start, count) => {   // the triangles of one face group, as their own (non-indexed) geometry
      const out = new THREE.BufferGeometry(), idx = ge.index, n0 = idx ? idx.count : ge.attributes.position.count; count = Math.min(count, n0 - start);
      for (const [k, a] of Object.entries(ge.attributes)) { const n = a.itemSize, arr = new Float32Array(count * n);
        for (let i = 0; i < count; i++) { const v = idx ? idx.getX(start + i) : start + i; for (let c = 0; c < n; c++) arr[i * n + c] = comp(a, v, c); }
        out.setAttribute(k, new THREE.BufferAttribute(arr, n, false)); }   // (values come out already converted to floats)
      return out;
    };
    const add = (o, m, ge, multi) => { const sig = m.uuid + '|' + Object.keys(ge.attributes).sort().join(',') + '|' + !!ge.index; if (!buckets.has(sig)) buckets.set(sig, { m, items: [] }); buckets.get(sig).items.push({ o, ge, multi }); };
    g.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || o.userData.type || skip.has(o)) return;
      for (let p = o.parent; p && p !== g; p = p.parent) if (p.userData.dynamic || !p.visible || skip.has(p)) return;
      if (T.multiplyMatrices(inv, o.matrixWorld).determinant() < 0) return;   // mirrored: merging would turn its faces inside out
      const ms = o.material;
      if (Array.isArray(ms)) {
        const ge = o.geometry; if (!ge.groups.length || ms.some(m => !m || m.transparent) || ge.groups.some(gr => !ms[gr.materialIndex])) return;
        for (const gr of ge.groups) add(o, ms[gr.materialIndex], piece(ge, gr.start, gr.count), true);
      } else if (!ms.transparent) add(o, ms, o.geometry, false);
    });
    const gone = new Set();
    for (const { m, items } of buckets.values()) {
      if (items.length < 2 && !items[0].multi) continue;   // a lone plain mesh stays as it is
      const geos = items.map(({ o, ge }) => { const x = ge === o.geometry ? ge.clone() : ge; for (const k of Object.keys(x.morphAttributes)) delete x.morphAttributes[k]; x.applyMatrix4(M.multiplyMatrices(inv, o.matrixWorld)); return x; });
      const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
      const parts = merged ? [merged] : geos;   // (if they won't merge, each face still stands on its own: nothing goes missing)
      for (const part of parts) { const mesh = new THREE.Mesh(part, m); mesh.name = 'merged'; g.add(mesh);
        mesh.castShadow = items.some(it => it.o.castShadow); mesh.receiveShadow = items.some(it => it.o.receiveShadow); mesh.renderOrder = items[0].o.renderOrder; }   // (the castle casts shadows)
      if (merged && geos.length > 1) geos.forEach(x => x !== merged && x.dispose());
      items.forEach(it => gone.add(it.o));
    }
    // anything resting on a merged piece (a printed cover on a stack, a label) is handed to its parent first, or it would vanish with it
    gone.forEach(o => { const p = o.parent; if (!p) return; for (const c of [...o.children]) if (!gone.has(c)) p.attach(c); p.remove(o); });
  }

  /* a polished dark floor: on strong GPUs a real mirror under a thin dark layer */
  addFloor(parent, geo, mat, y) {
    if (BAKED) {
      if (!this.Q.reflect) return null;
      const pr = this.pr * this.Q.reflect;
      const mirror = new Reflector(geo, { clipBias: .003, textureWidth: innerWidth * pr, textureHeight: innerHeight * pr, color: 0x6e6e6e });
      mirror.rotation.x = -Math.PI / 2; mirror.position.y = y - .004; parent.add(mirror);
      const before = mirror.onBeforeRender;
      mirror.onBeforeRender = (...args) => {   // one reflection at a time: a mirror seen inside another mirror's reflection keeps its last image (nesting them cost ~60 renders a frame)
        if (this._reflecting || (this._mirrorOK && !this._mirrorOK.has(mirror)) || mirror._fr === this._mirrorFrame) return; this._reflecting = true; mirror._fr = this._mirrorFrame;
        this.floorOverlays.forEach(o => (o.visible = false)); const hid = this.hideOtherHalls(parent);
        try { before.apply(mirror, args); } finally { hid.forEach(o => (o.visible = true)); this.floorOverlays.forEach(o => (o.visible = true)); this._reflecting = false; }
      };
      this.reflectors.push(mirror);
      return null;
    }
    if (this.Q.reflect) {
      const pr = this.pr * this.Q.reflect;
      const mirror = new Reflector(geo, { clipBias: .003, textureWidth: innerWidth * pr, textureHeight: innerHeight * pr, color: 0x6e6e6e });
      mirror.rotation.x = -Math.PI / 2; mirror.position.y = y; parent.add(mirror);
      const before = mirror.onBeforeRender;
      mirror.onBeforeRender = (...args) => {           // the dark layer must not hide the reflection itself
        if (this._reflecting || (this._mirrorOK && !this._mirrorOK.has(mirror)) || mirror._fr === this._mirrorFrame) return; this._reflecting = true; mirror._fr = this._mirrorFrame;
        this.floorOverlays.forEach(o => (o.visible = false)); const hid = this.hideOtherHalls(parent);
        try { before.apply(mirror, args); } finally { hid.forEach(o => (o.visible = true)); this.floorOverlays.forEach(o => (o.visible = true)); this._reflecting = false; }
      };
      this.reflectors.push(mirror);
      const layer = mat.clone(); layer.transparent = true; layer.opacity = .78; layer.depthWrite = false;
      const over = new THREE.Mesh(geo, layer); over.rotation.x = -Math.PI / 2; over.position.y = y + .002; parent.add(over);
      this.floorOverlays.push(over);
      return over;
    }
    const floor = new THREE.Mesh(geo, mat); floor.rotation.x = -Math.PI / 2; floor.position.y = y; parent.add(floor);
    return floor;
  }

  shell(g, L, W, Hh) {
    if (BAKED) { this.addFloor(g, new THREE.PlaneGeometry(W, L), null, .002); return; }
    const floorMat = stone('floor', W / 4, L / 4);
    const wallMat = stone('wall', L / 4, Hh / 4), endMat = stone('wall', W / 4, Hh / 4);
    const floor = this.addFloor(g, new THREE.PlaneGeometry(W, L), floorMat, .002);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ color: '#0a0404', roughness: .9 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = Hh; g.add(ceil); this.ceilings.push(ceil);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(L, Hh), wallMat); left.rotation.y = Math.PI / 2; left.position.set(-W / 2, Hh / 2, 0); g.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(L, Hh), wallMat); right.rotation.y = -Math.PI / 2; right.position.set(W / 2, Hh / 2, 0); g.add(right);
    const end = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), endMat); end.rotation.y = Math.PI; end.position.set(0, Hh / 2, L / 2); g.add(end);
    // front wall with the doorway
    const sideW = (W - ARCH_W) / 2;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(sideW, Hh), endMat); p.position.set(sx * (ARCH_W / 2 + sideW / 2), Hh / 2, -L / 2); g.add(p); }
    const over = new THREE.Mesh(new THREE.PlaneGeometry(ARCH_W, Hh - ARCH_H), endMat); over.position.set(0, ARCH_H + (Hh - ARCH_H) / 2, -L / 2); g.add(over);
    // modern glow lines: skirting + one line down the ceiling
    const line = c => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(c), toneMapped: false });
    for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, L), line(.8)); s.position.set(sx * (W / 2 - .02), .1, 0); g.add(s); }
    const c = new THREE.Mesh(new THREE.BoxGeometry(.03, .02, L - 1), line(.55)); c.position.set(0, Hh - .02, 0); g.add(c); this.ceilings.push(c);
  }

  buildHall(h) {
    const L = hallLen(h.works.length), W = HALL_W, a = angleOf(h.k);
    const g = this.hallGroup(h.k, L, W);
    this.shell(g, L, W, HALL_H);
    this.buildVein(h.k, R0 + L - 2);
    if (this.Q.hallLights) { const lamp = new THREE.PointLight('#ffe2c6', 12, 22, 1.4); lamp.position.set(0, HALL_H - 1.4, 0); g.add(lamp); }
    const LANTERN_HALLS = ['identity'];                     // these halls are lit by a baked cloud of paper lanterns instead
    for (const zz of (LANTERN_HALLS.includes(h.id) || h.stage === 'runway' || (h.stage === 'press' && artIn(h.id)) ? [] : h.id === 'packaging' ? [-L / 3, 0, L / 3] : [-L / 4, L / 4])) {      // chandeliers on the centre line
      const ch = this.makeChandelier(8, 1); ch.position.set(0, HALL_H - 2.45, zz); g.add(ch);
      const wash = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: this.softTex(), color: '#fff3e2', transparent: true, opacity: .55, depthWrite: false }));
      wash.rotation.x = Math.PI / 2; wash.position.set(0, HALL_H - .02, zz); g.add(wash);                                // the ceiling lit around it
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ map: this.softTex(), color: '#ffe9cf', transparent: true, opacity: .14, depthWrite: false, blending: THREE.AdditiveBlending }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(0, .01, zz); g.add(pool);                                       // a faint warm pool on the floor
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, 1.15, 4), this.inkMat); chain.position.set(0, HALL_H - .58, zz); g.add(chain);
    }
    // end-wall title
    const title = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.6), new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, color: new THREE.Color(1, 1, 1),
      map: textTexture((x, w, hh) => {
        x.textAlign = 'center';
        x.fillStyle = '#c8261b'; x.font = `600 ${hh * .1}px ${SANS}`; x.fillText(`hall ${h.num}`, w / 2, hh * .2);
        x.fillStyle = '#111'; x.font = `800 ${hh * .34}px ${SANS}`; x.letterSpacing = `${-hh * .015}px`; x.fillText(h.title.toLowerCase().split(' ')[0], w / 2, hh * .55);
      }, 1024, 372),
    }));
    title.position.set(0, 3.15, L / 2 + .3); title.rotation.y = Math.PI;   // (replaced by the red end wall below)
    this.hallProps(g, h, L, W);

    const hall = this.halls[h.id] = { def: h, group: g, L, W, a, exhibits: [] };
    if (h.stage === 'press' && artIn(h.id)) (this._pending ||= []).push(() => { if (!hall.pressProps) { hall.pressProps = true; this.pressProps(hall); this._pending.push(() => this.mergeStatic(hall)); } });   // the room first, on its own frame
    if (h.id === 'packaging' && artIn(h.id)) { const P = h.works.map((id, i) => ({ id, side: i % 2 ? 1 : -1, z: -L / 2 + 6.2 + Math.floor(i / 2) * 6.4 })), q = (this._pending ||= []);   // Hall 01: the dieline studio
      q.push(...studioSteps(this, hall, HALL_H, P).map(f => () => f()), () => this.mergeStatic(hall)); }
    if (h.id === 'identity' && artIn(h.id)) { const q = (this._pending ||= []); q.push(...identitySteps(this, hall, HALL_H).map(f => () => f()), () => this.mergeStatic(hall)); identityStops(this, hall); }   // Hall 02: festival lot | quiet study, split down the middle
    if (h.id === 'redesign' && artIn(h.id)) { const q = (this._pending ||= []); q.push(...bankSteps(this, hall, HALL_H).map(f => () => f()), () => this.mergeStatic(hall)); bankStops(this, hall); }   // Hall 05: the marble bank hall, in short steps; two more stops on its walk
    h.works.forEach((id, i) => {
      const work = WORKS[id];
      if (h.stage === 'plinths') this.addPlinth(hall, id, work, i);
      else if (h.stage === 'runway' && work.runway && artIn(h.id)) this.addRunway(hall, id, work);
      else if (h.stage === 'press' && work.book && artIn(h.id)) (this._pending ||= []).push(() => this.addPress(hall, id, work, i));   // one desk per frame (built together they froze the page ~1 s)
      else if (work.wall && artIn(h.id)) this.addSalon(hall, id, work, i);
      else this.addFrame(hall, id, work, i, h.stage);
    });
  }

  /* the real artwork, woven in by red ink */
  artTexture(id, work) {
    if (!artIn(hallOf(id)?.id)) return this.linen || (this.linen = textTexture((x, w, h) => {   // an empty, primed linen canvas (halls not yet signed off)
      x.fillStyle = '#e4dccd'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${90 + Math.random() * 40},${70 + Math.random() * 30},50,${Math.random() * .06})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 1 + Math.random() * 3); }
      for (let i = 0; i < w; i += 3) { x.fillStyle = 'rgba(80,60,40,.025)'; x.fillRect(i, 0, 1, h); }
    }, 1024, 1024));
    if (work.video) {
      const v = document.createElement('video');
      v.src = `assets/projects/${id}/${work.video}`; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
      this.videos = this.videos || {}; this.videos[id] = v;
      const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    if (work.cover === false) return placeholderArt(work, work.aspect);
    const t = this.loader.load(coverOf(id)); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); return t;
  }
  fit(aspect, maxW, maxH) { let w = maxW, h = w / aspect; if (h > maxH) { h = maxH; w = h * aspect; } return [w, h]; }

  addFrame(hall, id, work, i, stage) {
    const { group: g, L, W } = hall;
    const n = hall.def.works.length;
    const side = i % 2 ? 1 : -1;
    const z = n === 1 ? 0 : -L / 2 + 4.5 + i * (L - 8) / Math.max(1, n - 1);
    const box = { frames: [2.7, 2.0], portraits: [2.1, 2.7], lightboxes: [3.3, 2.5], screens: [3.4, 2.1] }[stage] || [2.7, 2.0];
    const [fw, fh] = this.fit(work.aspect || 1.4, ...box);
    const f = new THREE.Group(); f.position.set(side * (W / 2 - .09), 2.5, z); f.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(f);
    const black = new THREE.MeshStandardMaterial({ color: '#0b0707', roughness: .32, metalness: .55 });
    const moulding = (ow, oh, mw, depth, mat) => {
      for (const [x, y, ww, hh] of [[0, oh / 2 - mw / 2, ow, mw], [0, -oh / 2 + mw / 2, ow, mw], [-ow / 2 + mw / 2, 0, mw, oh - mw * 2], [ow / 2 - mw / 2, 0, mw, oh - mw * 2]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, depth), mat); b.position.set(x, y, depth / 2 - .01); f.add(b);
      }
    };
    // an upholstered velvet panel behind the work, floor to near-ceiling
    const vh = HALL_H - 1.0, vw = fw + 1.5;
    const panel = new THREE.Mesh(curtainGeometry(vw, vh, Math.round(vw * 2.2), .025), this.velvetMat || (this.velvetMat = velvet('#350506')));
    panel.position.set(0, .35 + vh / 2 - 2.5, -.07); if (!BAKED) f.add(panel);
    let mat;
    if (stage === 'screens') {
      // a black screen with a thin bezel, the work plays on it
      const bez = .07; moulding(fw + bez * 2, fh + bez * 2, bez, .06, black);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(fw + bez * 2, fh + bez * 2), black); back.position.z = -.005; f.add(back);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(fw + 2, fh + 2), poolMaterial('#ff6a4a', .14)); glow.position.z = -.02; f.add(glow);
    } else if (stage === 'lightboxes') {
      // backlit, like a billboard at night
      const al = .05; moulding(fw + al * 2, fh + al * 2, al, .12, new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: .3, metalness: .85 }));
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(fw + 1.6, fh + 1.6), poolMaterial('#ff8a6a', .2)); glow.position.z = -.02; f.add(glow);
    } else {
      // museum frame: dark moulding + bone-white mat
      const m = Math.min(fw, fh) * .1 + .06, mw = .08;
      const matBoard = new THREE.Mesh(new THREE.PlaneGeometry(fw + m * 2, fh + m * 2), new THREE.MeshStandardMaterial({ color: '#e6ddcf', roughness: .95, emissive: '#d9cfc0', emissiveIntensity: .3 }));
      matBoard.position.z = .012; f.add(matBoard);
      moulding(fw + m * 2 + mw * 2, fh + m * 2 + mw * 2, mw, .09, black);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(fw + m * 2 + mw * 2, fh + m * 2 + mw * 2), black); back.position.z = -.005; f.add(back);
      const ds = this.shadowMesh('rect', (fw + m * 2 + mw * 2) * 1.6, (fh + m * 2 + mw * 2) * 1.6, .32); ds.position.set(.05, -.09, -.012); f.add(ds);   // a soft drop shadow on the wall
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * (fw / 2 + .012), y * (fh / 2 + .012), .03))), new THREE.LineBasicMaterial({ color: '#b08a5a', transparent: true, opacity: .45 }));
      f.add(line);
    }
    mat = weaveMaterial(this.artTexture(id, work), this.shared);
    if (stage === 'lightboxes' || stage === 'screens') mat.uniforms.uLit.value = 1;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mat); art.position.z = .025; f.add(art);
    // the light from above + a warm pool on the wall
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.12, Math.max(fw, 1.4) * .62, 3.2, 32, 1, true), coneMaterial());
    cone.position.set(0, fh / 2 + 1.5, 1.0); cone.rotation.x = -.38;   // (not added: invisible on white, costly to draw)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(fw * 1.9, fh * 1.9), poolMaterial('#ffe9d6', .14)); pool.position.z = -.03;
    // museum label
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .42), letterMat(letterLabel(work, 'right')));   // lettered on the wall, right-aligned to the frame's edge
    label.position.set(fw / 2 - .55, -fh / 2 - .5, .03); if (artIn(hall.def.id)) f.add(label);
    // (wall lettering returns with the mockups)
    art.userData = { type: 'work', id, hallId: hall.def.id, frame: f, mat, size: [fw, fh], z };
    this.interactive.push(art); hall.exhibits.push(art); this.frames.push(art);
  }

  /* a salon hang: one project as a cluster of floating panels on a wall painted in its brand colour */
  addSalon(hall, id, work, i) {
    const { group: g, L, W } = hall, n = hall.def.works.length, side = i % 2 ? 1 : -1;
    const P = work.wall.pieces.map(([file, a, x, y, w]) => ({ file, a, x, y, w, h: w / a }));
    const x0 = Math.min(...P.map(p => p.x - p.w / 2)), x1 = Math.max(...P.map(p => p.x + p.w / 2));
    const y0 = Math.min(...P.map(p => p.y - p.h / 2)), y1 = Math.max(...P.map(p => p.y + p.h / 2));
    const cw = x1 - x0, ch = y1 - y0, CY = 2.3;   // the cluster hangs at eye level, its logo painted above
    P.forEach(p => { p.x -= (x0 + x1) / 2; p.y -= (y0 + y1) / 2; });   // centre it on the hanging point
    // spread along the hall but keep the painted wall clear of the end walls
    const z = work.wall.z ?? (n === 1 ? 0 : (2 * i / (n - 1) - 1) * Math.max(0, L / 2 - cw / 2 - 1.6));   // (a wall can pin its own spot: Fork Yeah faces Brain across the aisle)
    const f = new THREE.Group(); f.position.set(side * (W / 2 - .06), CY, z); f.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(f);
    // the painted wall: brand colour, floor to just under the cornice, lit softly from above
    const pw = cw + 2.2, ph = HALL_H - 1.65,   // stops under the LED display
      bg = new THREE.Color(work.wall.bg);
    const paint = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: textTexture((x, w, h) => {
      const c = '#' + bg.getHexString(), lt = '#' + bg.clone().lerp(new THREE.Color('#fff6ea'), .16).getHexString(), dk = '#' + bg.clone().multiplyScalar(.72).getHexString();
      let gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, dk); gr.addColorStop(.22, lt); gr.addColorStop(.62, c); gr.addColorStop(1, dk);
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,.16)'); gr.addColorStop(.12, 'rgba(0,0,0,0)'); gr.addColorStop(.88, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.16)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 14000; k++) { x.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .025})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }   // a matt, brushed finish
    }, 1024, 1024) }));
    paint.position.set(0, ph / 2 + .02 - CY, .005); f.add(paint);
    if (work.wall.logo) {   // the logo, cut out and painted straight onto the wall like gallery lettering
      const [file, la, ly, lh] = work.wall.logo, lt = this.loader.load(`assets/wall/${work.case}/${file}`); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = 8;
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(lh * la, lh), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, color: new THREE.Color(.94, .93, .91) }));
      decal.position.set(0, ly - CY, .009); f.add(decal);
    }
    const edge = new THREE.MeshStandardMaterial({ color: work.wall.edge || '#f4efe6', roughness: .8 });
    const meshes = [];
    P.forEach((p, k) => {
      const d = .028, off = .045;   // a 2.8 cm board standing ~4.5 cm off the wall
      const board = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, d), edge); board.position.set(p.x, p.y, off + d / 2); f.add(board);
      const sh = this.shadowMesh('rect', p.w * 1.28 + .2, p.h * 1.28 + .2, .38); sh.position.set(p.x + .06, p.y - .1, .012); f.add(sh);
      const t = this.loader.load(`assets/wall/${work.case}/${p.file}`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const mat = weaveMaterial(t, this.shared); mat.uniforms.uLit.value = .8;   // true colour: prints, not paintings in the dark
      const art = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat); art.position.set(p.x, p.y, off + d + .002); f.add(art);
      art.userData = { type: 'work', id, hallId: hall.def.id, frame: f, mat, size: [cw, ch], z, salon: true };
      this.interactive.push(art); meshes.push(art);
      if (work.wall.vinyl) sleeveVinyl(this, f, p, p.file);   // the record peeks out of its sleeve and turns
    });
    // one museum label for the whole wall, under the bottom-right corner
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .42), letterMat(letterLabel(work, 'right', true)));   // lettered on the wall (the feature walls are dark: cream letters)
    label.position.set(cw / 2 - .65, -ch / 2 - .42, .03); f.add(label);
    const hero = meshes[0];
    hall.exhibits.push(hero); this.frames.push(hero);
    (hall.extras = hall.extras || []).push(...meshes.slice(1));
  }

  /* ---------- Hall 03, the Ryndia Runway: a woven runner on a raised catwalk, four models mid-walk, the key poster as
     the backdrop, ferns and moss along the catwalk, vines and a leaf canopy overhead, mist at the feet, fine rain ---------- */
  addRunway(hall, id, work) {
    const { group: g, L, W } = hall, R = work.runway, base = 'assets/runway/', T = this.shared.uTime;
    const PH = .55, PW = 1.8, z0 = -L / 2 + 1.7, z1 = L / 2 - .22, len = z1 - z0, zc = (z0 + z1) / 2;   // the catwalk runs right up to the back wall, where the painted runner takes over
    const rnd = (a, b) => a + Math.random() * (b - a);
    const load = f => { const t = this.loader.load(base + f); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); return t; };
    const sway = (mat, amp, inst) => { mat.onBeforeCompile = sh => {   // leaves move in a slow breeze, more the further they hang from their stem
      sh.uniforms.uTime = T;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ap = ${inst ? 'instanceMatrix[3].xyz' : 'position'};
        float ph = uTime * .9 + ap.x * 1.3 + ap.z * .8, k = ${amp};
        transformed.x += (sin(ph) * .7 + sin(ph * 2.3) * .3) * k; transformed.z += cos(ph * .8) * k * .6;`); }; };

    // ---- the catwalk: dark wood, and a Ryndia runner woven in natural silk with rust and brown borders ----
    const deck = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, len), new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: .5 }));
    deck.position.set(0, PH / 2, zc); g.add(deck);
    const runTex = textTexture((x, w, h) => {
      x.fillStyle = '#e2d3bb'; x.fillRect(0, 0, w, h);   // the same runner as on the back wall: raw silk, a band of rust lines near each edge
      for (const [a, b, c] of [[30, 36, '#7a2a1e'], [41, 55, '#963326'], [59, 62, '#e8dcc6'], [62, 72, '#963326'], [77, 81, '#5a2418'], [88, 91, '#963326']]) { x.fillStyle = c; x.fillRect(a, 0, b - a, h); }
      for (const [a, b, c] of [[30, 36, '#5a2a18'], [41, 52, '#6e3520'], [56, 70, '#7a3a22'], [75, 78, '#4a2414'], [85, 89, '#6e3520']]) { x.fillStyle = c; x.fillRect(w - b, 0, b - a, h); }
      for (let i = 0; i < h; i += 2) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,248,230' : '110,80,50'},${.05 + Math.random() * .08})`; x.fillRect(0, i, w, 1); }   // the weft
      for (let i = 0; i < w; i += 3) { x.fillStyle = `rgba(70,45,25,${.03 + Math.random() * .05})`; x.fillRect(i, 0, 1, h); }                                         // the warp
      for (const s of [0, 1]) for (let i = 0; i < h; i += 3) { x.fillStyle = `rgba(80,60,40,${Math.random() * .35})`; x.fillRect(s ? w - 6 - Math.random() * 6 : 0, i, 6 + Math.random() * 6, 2); }   // frayed edges
    }, 512, 2048);
    runTex.wrapT = THREE.RepeatWrapping; runTex.anisotropy = 16;
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, len), new THREE.ShaderMaterial({
      uniforms: { uMap: { value: runTex }, uRep: { value: len / 2.6 }, uTime: T },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
      fragmentShader: `uniform sampler2D uMap; uniform float uRep,uTime; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec3 c=texture2D(uMap,vec2(vUv.x,vUv.y*uRep)).rgb;
          vec2 p=vW.xz*1.7+vec2(uTime*.06,uTime*.035);
          float d=smoothstep(.42,.78,n(p)*.6+n(p*2.4-uTime*.05)*.4);                  // light through the canopy, drifting
          float e=smoothstep(1.,.94,vUv.y);                                             // (no fade at the wall: it runs on into the painting)
          gl_FragColor=vec4(c*(.55+.55*d)*(.75+.25*e),1.); }`,
    }));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, PH + .003, zc); g.add(runner);
    // warm footlights along both edges
    const nL = Math.floor((len - 1.2) / .62), M4 = new THREE.Matrix4();   // (they stop short of the wall: the painted runner has none)
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(.022, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6a0').multiplyScalar(2.6), toneMapped: false }), nL * 2);
    for (let i = 0; i < nL; i++) for (const s of [0, 1]) lamps.setMatrixAt(i * 2 + s, M4.makeTranslation((s ? 1 : -1) * (PW / 2 - .05), PH + .02, z0 + .3 + i * .62));
    g.add(lamps);
    // a wet stone terrace edge along the foot of the back wall, level with the catwalk: the painted terrace starts on it
    const ledgeMat = new THREE.MeshStandardMaterial({ color: '#555a5e', roughness: .26, metalness: .08, emissive: '#30353a', emissiveIntensity: .5 });
    for (const s of [-1, 1]) { const lw = W / 2 - PW / 2; const ledge = new THREE.Mesh(new THREE.BoxGeometry(lw, PH, .5), ledgeMat); ledge.position.set(s * (PW / 2 + lw / 2), PH / 2, L / 2 - .2 - .25); g.add(ledge); }

    // ---- the backdrop: the whole end wall becomes the hills of Meghalaya, the waterfall straight down the runway ----
    const board = (grp, w, h, file) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .03), new THREE.MeshStandardMaterial({ color: '#efe8dc', roughness: .8 })); b.position.z = .06; grp.add(b);
      const sh = this.shadowMesh('rect', w * 1.25 + .2, h * 1.25 + .2, .42); sh.position.set(.06, -.1, .012); grp.add(sh);
      const mat = weaveMaterial(load(file), this.shared); mat.uniforms.uLit.value = .8;
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); art.position.z = .077; grp.add(art); return [art, mat];
    };
    const bw = W - .06, bh = HALL_H - .06, f = new THREE.Group(); f.position.set(0, HALL_H / 2, L / 2 - .2); f.rotation.y = Math.PI; g.add(f);
    const hmat = weaveMaterial(load(R.backdrop), this.shared); hmat.uniforms.uLit.value = .75;
    const hero = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), hmat); hero.position.z = .02; f.add(hero);
    hero.userData = { type: 'work', id, hallId: hall.def.id, frame: f, mat: hmat, size: [bw, bh], z: L / 2 - .2, salon: true, endPose: true };
    this.interactive.push(hero); this.frames.push(hero);
    const extras = hall.extras = [];
    // the first stop: the head of the runway, looking all the way down it (an invisible marker on the walk)
    const start = new THREE.Object3D(); start.userData = { type: 'work', id, hallId: hall.def.id, frame: f, size: [bw, bh], z: -L / 2 + .5, runway: true, salon: true }; g.add(start);
    hall.exhibits.push(start);
    // the scroll walks you down the runway: up close as the first model passes, then on under the cloths to the hills
    for (const [z, pose, pass] of [
      [-5.3, [-1.3, EYE, -5.3, -.1, EYE + .05, -2.7], false],      // beside the catwalk, the first model coming straight at you
      [-1.4, [1.25, EYE + .05, -1.4, .1, EYE, .4], true],          // past her, the next one walking in between the posts
      [-.2, [-.95, EYE + .05, -.2, .2, 2.9, 7.8], true],           // turning to the hills
    ]) { const mk = new THREE.Object3D(); mk.userData = { type: 'work', id, hallId: hall.def.id, frame: f, size: [bw, bh], z, pose, pass, salon: true }; g.add(mk); hall.exhibits.push(mk); }
    // ---- six Ryndia artworks, hung among the green, three on each wall: every one a stop on the walk ----
    for (const [file, a, side, z, w] of R.creatives) {
      const grp = new THREE.Group(); grp.position.set(side * (W / 2 - .06), 2.55, z); grp.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(grp);
      const [art, mat] = board(grp, w, w / a, file);
      art.userData = { type: 'work', id, hallId: hall.def.id, frame: grp, mat, size: [w, w / a], z, salon: true };
      this.interactive.push(art); hall.exhibits.push(art);
    }
    hall.exhibits.push(hero);   // the last stop: the hills themselves
    // ---- the models, life-size, mid-walk toward you ----
    this.runwayModels = [];
    const zs = [z0 + 3.6, z0 + 6.2, z0 + 8.8, z0 + 11.3], xs = [-.12, .14, -.1, .15];
    R.models.forEach(([file, a, hh], i) => {
      const pv = new THREE.Group(); pv.position.set(xs[i], PH, zs[i]); pv.userData.dynamic = true; g.add(pv);   // (they turn toward you: never merged)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(hh * a, hh), new THREE.MeshBasicMaterial({ map: load(file), transparent: true, alphaTest: .06, color: new THREE.Color(.94, .93, .9) }));
      m.position.y = hh / 2; m.rotation.y = Math.PI; pv.add(m);
      const sh = this.shadowMesh('blob', .62, .34, .55); sh.rotation.x = -Math.PI / 2; sh.position.set(0, .006, .02); pv.add(sh);
      m.userData = { type: 'work', id, hallId: hall.def.id, frame: f, size: [bw, bh], z: zs[i] };
      this.interactive.push(m); extras.push(m); this.runwayModels.push({ pv, g, yaw: 0 });
    });
    if (!hall.merged) { hall.merged = true; (this._pending ||= []).push(() => this.mergeStatic(hall)); }   // the still runway, trees and benches: one mesh per finish (hundreds of draws became a handful)
    // the label, by the entrance
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .42), new THREE.MeshBasicMaterial({ color: new THREE.Color(.42, .4, .38), map: textTexture((x, w, hh) => {
      x.fillStyle = '#efe6d6'; x.fillRect(0, 0, w, hh);
      x.fillStyle = '#1a0d0b'; x.font = `500 74px ${SERIF}`; x.fillText(work.title, 40, 120);
      x.fillStyle = '#c3261b'; x.font = `600 34px ${SANS}`; x.fillText('CAMPAIGN · MEGHALAYA TOURISM', 42, 190);
    }, 1024, 330) }));
    label.position.set(W / 2 - .03, 1.45, -L / 2 + 1.6); label.rotation.y = -Math.PI / 2; g.add(label);

    // ---- leaves: drawn once, used by the ferns, the vines and the canopy ----
    const pinna = textTexture((x, w, h) => {   // a fern leaflet: long, pointed, a darker midrib
      const gr = x.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#3f6a24'); gr.addColorStop(1, '#7aa63a');
      x.fillStyle = gr; x.beginPath(); x.moveTo(w / 2, h); x.quadraticCurveTo(w * 1.02, h * .55, w / 2, 0); x.quadraticCurveTo(-w * .02, h * .55, w / 2, h); x.fill();
      x.strokeStyle = 'rgba(30,50,15,.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, h * .08); x.stroke();
      for (let y = h * .9; y > h * .12; y -= 14) { x.strokeStyle = 'rgba(25,45,12,.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(w / 2, y); x.lineTo(w * .12, y - 18); x.moveTo(w / 2, y); x.lineTo(w * .88, y - 18); x.stroke(); }
    }, 64, 256);
    const broad = textTexture((x, w, h) => {   // a vine leaf: ovate, glossy, veined
      const gr = x.createRadialGradient(w * .45, h * .55, 4, w / 2, h / 2, w * .7); gr.addColorStop(0, '#6f9a3c'); gr.addColorStop(1, '#2e5320');
      x.fillStyle = gr; x.beginPath(); x.moveTo(w / 2, h * .98); x.bezierCurveTo(w * 1.05, h * .7, w * .9, h * .12, w / 2, h * .02); x.bezierCurveTo(w * .1, h * .12, -w * .05, h * .7, w / 2, h * .98); x.fill();
      x.strokeStyle = 'rgba(200,230,150,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, h * .96); x.lineTo(w / 2, h * .06); x.stroke();
      for (let i = 1; i < 6; i++) { const y = h * (.85 - i * .13); x.lineWidth = 1; x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(w * .3, y - 10, w * .16, y - 22); x.moveTo(w / 2, y); x.quadraticCurveTo(w * .7, y - 10, w * .84, y - 22); x.stroke(); }
    }, 128, 160);
    // ---- ferns: real 3D fronds, arching out of a clump, each made of dozens of leaflets ----
    const fern = (() => {
      const P = [], N = [], U = [], up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < 11; k++) {
        const a = k / 11 * Math.PI * 2 + rnd(-.25, .25), Lf = rnd(.6, 1.0), dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), steps = 18, rise = rnd(1.45, 2.0);
        const at = t => dir.clone().multiplyScalar(Lf * t * .7).addScaledVector(up, Lf * (rise * t - 1.05 * t * t));   // up first, then arching over
        for (let i = 2; i < steps; i++) {
          const t = i / steps, p = at(t), tg = at(t + .01).sub(p).normalize(), sd = new THREE.Vector3().crossVectors(tg, up).normalize();
          const ll = .15 * Math.pow(1 - t, .55) * Math.min(1, t / .2) + .02, ww = .028 + .02 * (1 - t);
          for (const s of [-1, 1]) {
            const d = sd.clone().multiplyScalar(s).addScaledVector(tg, .35).addScaledVector(up, -.18).normalize();
            const a0 = p.clone().addScaledVector(tg, -ww / 2), a1 = p.clone().addScaledVector(tg, ww / 2), b0 = a0.clone().addScaledVector(d, ll), b1 = a1.clone().addScaledVector(d, ll);
            const nrm = new THREE.Vector3().crossVectors(tg, d).normalize(); if (nrm.y < 0) nrm.negate();
            for (const [v, uv] of [[a0, [0, 0]], [a1, [1, 0]], [b1, [1, 1]], [a0, [0, 0]], [b1, [1, 1]], [b0, [0, 1]]]) { P.push(v.x, v.y, v.z); N.push(nrm.x, nrm.y, nrm.z); U.push(...uv); }
          }
        }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      return geo;
    })();
    const fernMat = new THREE.MeshStandardMaterial({ map: pinna, alphaTest: .45, side: THREE.DoubleSide, roughness: .7, emissive: '#1d3a10', emissiveIntensity: 1 });
    sway(fernMat, '.035 * max(position.y, 0.) * 1.6', true);
    const spots = [];
    for (let z = z0 - .4; z < z1 + .2; z += rnd(.45, .7)) for (const s of [-1, 1]) spots.push([s * (PW / 2 + rnd(.28, .7)), z, rnd(.85, 1.25)]);   // along the catwalk
    for (let z = -L / 2 + 1.2; z < L / 2 - .4; z += rnd(.55, .9)) for (const s of [-1, 1]) spots.push([s * (W / 2 - rnd(.4, .8)), z, rnd(1.1, 1.7)]); // along the walls
    const ferns = new THREE.InstancedMesh(fern, fernMat, spots.length), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), C = new THREE.Color();
    spots.forEach(([x, z, sc], i) => {
      Q.setFromEuler(new THREE.Euler(rnd(-.08, .08), rnd(0, 6.28), rnd(-.08, .08))); ferns.setMatrixAt(i, M4.compose(V.set(x, 0, z), Q, S.set(sc, sc * rnd(.85, 1.15), sc)));
      ferns.setColorAt(i, C.setHSL(rnd(.23, .3), rnd(.4, .6), rnd(.55, .75)));
    });
    g.add(ferns);
    // ---- moss: soft lumpy cushions at the feet of the ferns and along the catwalk's edges ----
    const mossGeo = new THREE.IcosahedronGeometry(1, 3), mp = mossGeo.attributes.position;
    for (let i = 0; i < mp.count; i++) { V.fromBufferAttribute(mp, i); const nn = 1 + .18 * Math.sin(V.x * 7) * Math.sin(V.z * 6) + .08 * Math.sin(V.x * 19 + V.z * 13); V.multiplyScalar(nn); if (V.y < 0) V.y *= .05; mp.setXYZ(i, V.x, V.y * .4, V.z); }
    mossGeo.computeVertexNormals();
    const mossTex = textTexture((x, w, h) => { x.fillStyle = '#6f8f3c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { x.fillStyle = `hsl(${rnd(70, 100)},${rnd(40, 65)}%,${rnd(30, 55)}%)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, 256, 256);
    mossTex.wrapS = mossTex.wrapT = THREE.RepeatWrapping; mossTex.repeat.set(3, 3);
    const mossSpots = [];
    spots.forEach(([x, z]) => { if (Math.random() < .6) mossSpots.push([x + rnd(-.2, .2), 0, z + rnd(-.2, .2), rnd(.16, .3)]); });
    const moss = new THREE.InstancedMesh(mossGeo, new THREE.MeshStandardMaterial({ map: mossTex, roughness: 1, color: '#d8e6b0', emissive: '#22350f', emissiveIntensity: .8 }), mossSpots.length);
    mossSpots.forEach(([x, y, z, sc], i) => moss.setMatrixAt(i, M4.compose(V.set(x, y, z), Q.setFromEuler(new THREE.Euler(0, rnd(0, 6.28), 0)), S.set(sc, sc * rnd(.6, 1), sc * rnd(.7, 1.2)))));
    g.add(moss);
    // ---- vines from the ceiling, leaves along them, and a leaf canopy along both sides ----
    const leafGeo = new THREE.PlaneGeometry(1, 1.25); leafGeo.translate(0, .55, 0);
    const leafMat = new THREE.MeshStandardMaterial({ map: broad, alphaTest: .5, side: THREE.DoubleSide, roughness: .45, emissive: '#0a1606', emissiveIntensity: .7 });
    sway(leafMat, '.06 * clamp((7. - ap.y) * .3, .15, 1.)', true);
    const vineMat = new THREE.MeshStandardMaterial({ color: '#3a4524', roughness: .8 }); sway(vineMat, '.06 * clamp((7. - position.y) * .3, 0., 1.)', false);
    const leaves = [];
    for (let v = 0; v < 44; v++) {
      const side = v % 2 ? 1 : -1, x = side * (v < 28 ? rnd(W / 2 - .45, W / 2 - .15) : rnd(2.8, 3.4)), z = v < 28 ? rnd(-L / 2 + 1, L / 2 - 1) : rnd(-L / 2 + 1, L / 2 - 2.2), far = Math.abs(x) > 3;   // most climb down the walls
      const over = R.creatives.some(([, ca, cs, cz, cw]) => cs === side && Math.abs(z - cz) < cw / 2 + .25);   // keep the posters clear
      const dl = over && far ? rnd(.9, 1.5) : far ? rnd(2.2, 4.4) : rnd(.8, 1.6), pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(x + Math.sin(t * 3 + v) * .12, HALL_H - .05 - dl * t, z + Math.cos(t * 2.4 + v) * .1)); }
      const curve = new THREE.CatmullRomCurve3(pts); g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .007, 5), vineMat));
      const nLeaves = Math.round(dl * 9);
      for (let i = 0; i < nLeaves; i++) leaves.push([curve.getPoint(rnd(.05, 1)), rnd(.07, .12)]);
    }
    for (let c = 0; c < 52; c++) {   // canopy clusters, high along both walls
      const side = c % 2 ? 1 : -1, cx = side * rnd(2.2, W / 2 - .25), cz = rnd(-L / 2 + .6, L / 2 - .6), cy = HALL_H - rnd(.25, .6);
      if (cz > L / 2 - 2.2 && Math.abs(cx) < 3.3) continue;   // the sky over the title stays clear
      for (let i = 0; i < 52; i++) leaves.push([new THREE.Vector3(cx + rnd(-.65, .65), cy + rnd(-.45, .3), cz + rnd(-.75, .75)), rnd(.09, .17)]);
    }
    // ---- wet stones along both sides of the catwalk, like a hill path after rain ----
    const stoneGeo = new THREE.IcosahedronGeometry(1, 2), sp = stoneGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) { V.fromBufferAttribute(sp, i); V.multiplyScalar(1 + .14 * Math.sin(V.x * 5 + V.y * 3) + .07 * Math.sin(V.z * 11)); if (V.y < 0) V.y *= .3; sp.setXYZ(i, V.x, V.y * .55, V.z); }
    stoneGeo.computeVertexNormals();
    const stoneSpots = [];
    for (let z = z0 - .2; z < z1; z += rnd(.3, .55)) for (const s of [-1, 1]) if (Math.random() < .75) stoneSpots.push([s * (PW / 2 + rnd(.06, .3)), z, rnd(.07, .17)]);
    const stones = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial({ color: '#6c6a62', roughness: .32, metalness: .05 }), stoneSpots.length);
    stoneSpots.forEach(([x, z, sc], i) => { stones.setMatrixAt(i, M4.compose(V.set(x, 0, z), Q.setFromEuler(new THREE.Euler(0, rnd(0, 6.28), 0)), S.set(sc * rnd(1, 1.6), sc, sc * rnd(.8, 1.3)))); stones.setColorAt(i, C.setHSL(rnd(.08, .2), rnd(.03, .1), rnd(.28, .46))); });
    g.add(stones);

    // ---- bamboo: tall clumps in the corners and beside the hills ----
    const culmTex = textTexture((x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5f7a2c'); gr.addColorStop(.45, '#a3b55a'); gr.addColorStop(1, '#4d6624');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 128) { x.fillStyle = 'rgba(60,70,25,.85)'; x.fillRect(0, y, w, 5); x.fillStyle = 'rgba(230,235,180,.35)'; x.fillRect(0, y + 5, w, 3); }   // the nodes
      for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(80,90,40,.15)'; x.fillRect(Math.random() * w, Math.random() * h, 1, 20 + Math.random() * 40); }
    }, 64, 512);
    culmTex.wrapT = THREE.RepeatWrapping; culmTex.repeat.set(1, 3);
    const culmMat = new THREE.MeshStandardMaterial({ map: culmTex, roughness: .45, emissive: '#1a2408', emissiveIntensity: .5 }); sway(culmMat, '.012 * max(position.y - 1., 0.)', false);
    const bamboo = (cx, cz, n) => {
      for (let i = 0; i < n; i++) {
        const hh = rnd(5.2, 6.7), r = rnd(.035, .055), x = cx + rnd(-.35, .35), z = cz + rnd(-.35, .35);
        const culm = new THREE.Mesh(new THREE.CylinderGeometry(r * .8, r, hh, 10), culmMat); culm.geometry.translate(0, hh / 2, 0);
        culm.position.set(x, 0, z); culm.rotation.set(rnd(-.06, .06), 0, rnd(-.06, .06)); g.add(culm);
        for (let k = 0; k < 22; k++) {   // narrow leaves sprouting along the top third
          const t = rnd(.55, 1); leaves.push([new THREE.Vector3(x + rnd(-.45, .45), hh * t, z + rnd(-.45, .45)), rnd(.07, .11), true]);
        }
      }
    };
    for (const [x, z] of [[-W / 2 + .55, -L / 2 + .8], [W / 2 - .55, -L / 2 + .8], [-W / 2 + .6, L / 2 - .8], [W / 2 - .6, L / 2 - .8], [-3.75, L / 2 - .9], [3.75, L / 2 - .9]]) bamboo(x, z, 5);   // framing the hills, clear of the title

    // ---- big-leaf plants (wild banana, elephant ear) between the artworks ----
    const bigLeaf = textTexture((x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2f5a1f'); gr.addColorStop(.5, '#5f8f35'); gr.addColorStop(1, '#2f5a1f');
      x.fillStyle = gr; x.beginPath(); x.moveTo(w / 2, h); x.bezierCurveTo(w * 1.1, h * .75, w * 1.0, h * .15, w / 2, 0); x.bezierCurveTo(0, h * .15, -w * .1, h * .75, w / 2, h); x.fill();
      x.strokeStyle = 'rgba(210,230,160,.55)'; x.lineWidth = 4; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, h * .03); x.stroke();
      x.strokeStyle = 'rgba(200,225,150,.25)'; x.lineWidth = 1.5;
      for (let y = h * .92; y > h * .08; y -= 9) { x.beginPath(); x.moveTo(w / 2, y); x.lineTo(w * .04, y - 30); x.moveTo(w / 2, y); x.lineTo(w * .96, y - 30); x.stroke(); }
      x.globalCompositeOperation = 'destination-out';   // a few tears, as banana leaves have
      for (let i = 0; i < 4; i++) { const y = rnd(h * .2, h * .8), s = Math.random() < .5 ? 0 : w; x.beginPath(); x.moveTo(s, y); x.lineTo(w / 2, y - 26); x.lineTo(s, y + 3); x.fill(); }
    }, 256, 512);
    const bigMat = new THREE.MeshStandardMaterial({ map: bigLeaf, alphaTest: .5, side: THREE.DoubleSide, roughness: .5, emissive: '#122a08', emissiveIntensity: .7 }); sway(bigMat, '.05 * max(position.y, 0.)', false);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#5a7a30', roughness: .6 });
    const leafG = (() => { const geo = new THREE.PlaneGeometry(.55, 1.25, 4, 10), q = geo.attributes.position;   // a curved, drooping blade
      for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i) + .625; q.setXYZ(i, x, y - y * y * .28, -Math.abs(x) * .35 + y * y * .12); }
      geo.computeVertexNormals(); return geo; })();
    const plant = (x, z, sc) => {
      const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.scale.setScalar(sc); grp.rotation.y = rnd(0, 6.28); g.add(grp);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 6.28 + rnd(-.3, .3), sh = rnd(.7, 1.3);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(.012, .02, sh, 6), stemMat); stem.position.set(Math.cos(a) * .1, sh / 2, Math.sin(a) * .1); stem.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); grp.add(stem);
        const lf = new THREE.Mesh(leafG, bigMat); lf.position.set(Math.cos(a) * .3, sh, Math.sin(a) * .3); lf.rotation.set(-.6, -a + Math.PI / 2, 0); grp.add(lf);
      }
    };
    for (const z of [-4.4, -1.6, 1.2, 3.95]) for (const s of [-1, 1]) plant(s * (W / 2 - .7), z + rnd(-.3, .3), rnd(.9, 1.25));   // between the avenue's posts

    // ---- orchids: small white and violet sprays where the vines end and along the canopy ----
    const orchid = textTexture((x, w, h) => {
      const petal = (a, l, c) => { x.save(); x.translate(w / 2, h / 2); x.rotate(a); x.fillStyle = c; x.beginPath(); x.ellipse(0, -l / 2, l * .28, l / 2, 0, 0, 6.28); x.fill(); x.restore(); };
      for (let i = 0; i < 5; i++) petal(i / 5 * 6.28, w * .44, i === 0 ? '#f6eef8' : '#efe4f4');
      x.fillStyle = '#a2407e'; x.beginPath(); x.ellipse(w / 2, h * .56, w * .1, h * .12, 0, 0, 6.28); x.fill();   // the lip
      x.fillStyle = '#f4d24a'; x.beginPath(); x.arc(w / 2, h / 2, w * .04, 0, 6.28); x.fill();
    }, 64, 64);
    const flowers = [];
    for (let i = 0; i < leaves.length; i += 9) { const [p] = leaves[i]; if (p.y > 3 && p.y < HALL_H - .3) flowers.push(p); }
    const orchids = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: orchid, alphaTest: .4, side: THREE.DoubleSide, color: new THREE.Color(.95, .93, .95) }), flowers.length * 3);
    let oi = 0; for (const p of flowers) for (let k = 0; k < 3; k++) { const sc = rnd(.05, .08); orchids.setMatrixAt(oi, M4.compose(V.set(p.x + rnd(-.08, .08), p.y - k * .07, p.z + rnd(-.08, .08)), Q.setFromEuler(new THREE.Euler(rnd(-.5, .5), rnd(0, 6.28), 0)), S.set(sc, sc, sc))); orchids.setColorAt(oi, Math.random() < .35 ? C.set('#d7a6e6') : C.set('#ffffff')); oi++; }
    g.add(orchids);

    // ---- bamboo lanterns hanging low among the vines: woven slats over warm glowing paper ----
    const lanternTex = textTexture((x, w, h) => {
      const gr = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * .7); gr.addColorStop(0, '#fff2cf'); gr.addColorStop(1, '#f2b866'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(90,55,20,.85)'; for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 4, h);          // the bamboo slats
      for (const y of [h * .08, h * .5, h * .92]) x.fillRect(0, y - 3, w, 6);                                // the binding rings
    }, 256, 128);
    const lMat = new THREE.MeshBasicMaterial({ map: lanternTex, color: new THREE.Color(1.6, 1.35, 1.05), toneMapped: false });
    const capMat = new THREE.MeshStandardMaterial({ color: '#4a3018', roughness: .7 }), cordMat = new THREE.MeshBasicMaterial({ color: '#2a1c10' });
    const glowMat = new THREE.SpriteMaterial({ map: this.softTex(), color: '#ffcf8a', transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending });
    // ---- the avenue from the back wall, carried on into the hall: bamboo posts, a crossbar, a Ryndia cloth hanging
    //      from it, a woven lantern at its end and a lantern box at its foot, staggered so each faces an artwork's gap ----
    const clothGeo = (() => { const geo = new THREE.PlaneGeometry(.82, 2.05, 8, 16), q = geo.attributes.position;   // hangs in soft vertical folds
      for (let i = 0; i < q.count; i++) q.setZ(i, Math.sin(q.getX(i) * 15) * .025 * (1.1 - q.getY(i) * .4)); geo.computeVertexNormals(); return geo; })();
    const clothMats = [1, 2, 3].map(k => { const t = load(`cloth${k}.png`);   // the very cloths of the painted avenue, cut from it
      const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: .4, side: THREE.DoubleSide, roughness: .95, emissive: '#fff3e2', emissiveMap: t, emissiveIntensity: .8 });
      sway(m, '.035 * (1.03 - position.y)', false); return m; });
    const postMat = new THREE.MeshStandardMaterial({ map: culmTex, roughness: .5, emissive: '#2a2410', emissiveIntensity: .5 });
    this.lanterns3 = [];
    const posts = [-5.8, -3.0, -.2, 2.6, 5.3].flatMap(z => [[-1, z], [1, z]]);   // in pairs, as on the back wall
    posts.forEach(([side, z], i) => {
      const px = side * 3.25, ph = 4.75, by = 4.38;   // close to the walls, the runway open between them
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, ph, 10), postMat); post.position.set(px, ph / 2, z); g.add(post);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.032, .032, 1.22, 8), postMat); bar.rotation.z = Math.PI / 2; bar.position.set(px - side * .55, by, z); g.add(bar);
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .08, 10), capMat); tie.position.set(px, by, z); g.add(tie);
      const cloth = new THREE.Mesh(clothGeo, clothMats[i % 3]); cloth.position.set(px - side * .5, by - .04 - 1.025, z); cloth.rotation.y = Math.PI + rnd(-.06, .06); g.add(cloth);   // its face toward the entrance, where you first see it
      const lg = new THREE.Group(); lg.position.set(px - side * 1.08, by - .42, z); g.add(lg);   // the woven lantern at the end of the bar
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .32, 18, 1, true), lMat); lg.add(body);
      for (const dy of [.17, -.17]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(.06, .13, .04, 18), capMat); cap.position.y = dy; if (dy < 0) cap.rotation.x = Math.PI; lg.add(cap); }
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .24, 4), cordMat); cord.position.y = .3; lg.add(cord);
      const glow = new THREE.Sprite(glowMat); glow.scale.set(1.2, 1.2, 1); lg.add(glow); this.lanterns3.push(lg);
      const box = new THREE.Mesh(new THREE.BoxGeometry(.26, .4, .26), lMat); box.position.set(px - side * .28, .2, z + .22); g.add(box);   // a lantern box at its foot
      const bg = new THREE.Sprite(glowMat); bg.scale.set(.9, .9, 1); bg.position.copy(box.position); g.add(bg);
    });
    if (this.Q.hallLights) for (const z of [-L / 3, L / 3]) { const l = new THREE.PointLight('#ffc98a', 4, 7, 1.6); l.position.set(0, 4.3, z); g.add(l); }   // the lanterns' warmth on the runway
    const leafIM = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
    leaves.forEach(([p, sc, thin], i) => {
      Q.setFromEuler(new THREE.Euler(rnd(-2.6, -.3), rnd(0, 6.28), rnd(-.6, .6))); leafIM.setMatrixAt(i, M4.compose(p, Q, S.set(thin ? sc * .35 : sc, thin ? sc * 1.6 : sc, sc)));
      leafIM.setColorAt(i, C.setHSL(rnd(.23, .3), rnd(.3, .55), rnd(.4, .65)));
    });
    g.add(leafIM);
    // ---- mist: three slow drifting layers, hugging the floor and the models' feet ----
    for (const [y, op, sc] of [[.06, .32, .32], [.28, .16, .45], [.62, .08, .6]]) {
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(W - .1, L - .2), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: T, uOp: { value: op }, uSc: { value: sc }, uY: { value: y } },
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
        fragmentShader: `uniform float uTime,uOp,uSc,uY; varying vec2 vUv; varying vec3 vW;
          float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          float fb(vec2 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*n(p); p=p*2.03+vec2(uY*7.,1.7); a*=.5; } return s; }
          void main(){
            vec2 p=vW.xz*uSc+vec2(uTime*.045,-uTime*.03)*(1.+uY);
            float m=smoothstep(.5,.95,fb(p+fb(p*.7+uTime*.02)));
            float e=smoothstep(0.,.08,vUv.x)*smoothstep(1.,.92,vUv.x)*smoothstep(0.,.06,vUv.y)*smoothstep(1.,.9,vUv.y);
            gl_FragColor=vec4(vec3(.8,.86,.82),m*e*uOp); }`,
      }));
      mist.rotation.x = -Math.PI / 2; mist.position.y = y; mist.renderOrder = 3; g.add(mist);
    }
    // ---- fine rain, falling through the light ----
    const NR = 240, rp = new Float32Array(NR * 6), rs = new Float32Array(NR * 2);
    for (let i = 0; i < NR; i++) { const x = rnd(-W / 2 + .2, W / 2 - .2), y = rnd(0, HALL_H), z = rnd(-L / 2 + .3, L / 2 - .3); rp.set([x, y, z, x - .02, y - .3, z], i * 6); rs[i * 2] = rs[i * 2 + 1] = rnd(.7, 1.3); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aSp', new THREE.BufferAttribute(rs, 1));
    const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: T, uH: { value: HALL_H } },
      vertexShader: 'uniform float uTime,uH; attribute float aSp; varying float vA; void main(){ vec3 p=position; p.y=mod(p.y-uTime*5.5*aSp,uH); vA=smoothstep(0.,.6,p.y)*smoothstep(uH,uH-.8,p.y); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor=vec4(.86,.9,.92,.07*vA); }',
    }));
    rain.frustumCulled = false; g.add(rain);
    if (this.Q.hallLights) for (const z of [-L / 4, L / 4]) { const l = new THREE.PointLight('#f4f0dc', 7, 11, 1.5); l.position.set(0, HALL_H - 1.6, z); g.add(l); }   // daylight through the canopy
  }
  updateRunway() {   // the models turn a little toward you as you pass, as a real person would
    const cam = this.camera.position, v = new THREE.Vector3();
    for (const m of this.runwayModels) {
      m.g.worldToLocal(v.copy(cam)); const dx = v.x - m.pv.position.x, dz = v.z - m.pv.position.z;
      const want = clamp(Math.atan2(-dx, -dz), -.42, .42); m.yaw += (want - m.yaw) * .06; m.pv.rotation.y = m.yaw;
    }
  }

  /* ---------- Hall 04, inside the press: a dark hall where one endless sheet of paper comes off four ink rollers
     (C M Y K) at the door and runs the length of the hall, carrying the printed mockups past; at every station it
     dips down behind a lectern and the book lies open there, turning page by page as you scroll. A walk in chapters. ---------- */
  pressPlants(hall, spots) {   // potted plants for an earthy room: fiddle-leaf figs and snake plants in terracotta and glazed pots (no lights needed: shading baked in)
    const g = hall.group, K = this.benchKit(), lit = K.lit, rnd = (a, b) => a + Math.random() * (b - a);
    const leafTex = textTexture((c, w, h) => {   // a fiddle-leaf: broad, wavy, a pale midrib and veins, a glossy sheen
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2f5524'); gr.addColorStop(.48, '#4f7d36'); gr.addColorStop(.52, '#5b8a3e'); gr.addColorStop(1, '#2f5524');
      c.fillStyle = gr; c.beginPath(); c.moveTo(w / 2, h); c.bezierCurveTo(w * .2, h * .92, w * .02, h * .55, w * .1, h * .25); c.bezierCurveTo(w * .18, h * .02, w * .82, h * .02, w * .9, h * .25); c.bezierCurveTo(w * .98, h * .55, w * .8, h * .92, w / 2, h); c.fill();
      c.strokeStyle = 'rgba(205,225,160,.75)'; c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2, h); c.quadraticCurveTo(w * .52, h * .5, w / 2, h * .06); c.stroke();
      c.strokeStyle = 'rgba(190,215,150,.35)'; c.lineWidth = 2;
      for (let y = h * .86; y > h * .14; y -= h * .07) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * w * .2, y - h * .02, w / 2 + s * w * .38, y - h * .08); c.stroke(); } }
      const sh = c.createRadialGradient(w * .38, h * .35, 4, w * .38, h * .35, w * .45); sh.addColorStop(0, 'rgba(255,255,240,.22)'); sh.addColorStop(1, 'rgba(255,255,240,0)'); c.globalCompositeOperation = 'source-atop'; c.fillStyle = sh; c.fillRect(0, 0, w, h);
    }, 256, 320);
    const snakeTex = textTexture((c, w, h) => {   // sansevieria: dark green with pale bands and a gold edge
      c.fillStyle = '#2c4a26'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 10 + Math.random() * 14) { c.fillStyle = `rgba(160,190,120,${.18 + Math.random() * .2})`; c.beginPath(); c.ellipse(w / 2, y, w * .45, 3 + Math.random() * 4, (Math.random() - .5) * .3, 0, 6.29); c.fill(); }
      c.fillStyle = '#c9b45a'; c.fillRect(0, 0, w * .09, h); c.fillRect(w * .91, 0, w * .09, h);
    }, 64, 512);
    const leafM = new THREE.MeshBasicMaterial({ map: leafTex, alphaTest: .5, side: THREE.DoubleSide, vertexColors: true });
    const snakeM = new THREE.MeshBasicMaterial({ map: snakeTex, side: THREE.DoubleSide, vertexColors: true });
    const leafG = (() => { const geo = new THREE.PlaneGeometry(1, 1.25, 4, 8), q = geo.attributes.position;   // cupped along the midrib, curling at the tip
      for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i) + .625; q.setXYZ(i, x * (1 - Math.pow(y / 1.25, 6) * .3), y, x * x * .45 - y * y * .12); }
      geo.computeVertexNormals(); return lit(geo, '#ffffff', .55); })();
    const bladeG = (() => { const geo = new THREE.PlaneGeometry(1, 1, 2, 8), q = geo.attributes.position;   // a blade tapering to a point, slightly folded
      for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i) + .5, t = 1 - Math.pow(y, 2.2); q.setXYZ(i, x * t, y, -Math.abs(x * t) * .25 + y * y * .05); }
      geo.computeVertexNormals(); return lit(geo, '#ffffff', .6); })();
    const potM = new THREE.MeshBasicMaterial({ vertexColors: true, map: textTexture((c, w, h) => {   // clay: warm, a little mottled, darker where it's been watered
      c.fillStyle = '#c0714a'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 2500; k++) { c.fillStyle = `rgba(${Math.random() < .5 ? '90,40,20' : '240,180,140'},${Math.random() * .08})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2); }
      const gr = c.createLinearGradient(0, h * .6, 0, h); gr.addColorStop(0, 'rgba(70,30,15,0)'); gr.addColorStop(1, 'rgba(70,30,15,.35)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, 256, 256) });
    const soilM = new THREE.MeshBasicMaterial({ map: textTexture((c, w, h) => { c.fillStyle = '#3a2618'; c.fillRect(0, 0, w, h); for (let k = 0; k < 1800; k++) { c.fillStyle = `rgba(${Math.random() < .3 ? '170,150,120' : '20,12,6'},${Math.random() * .6})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, Math.random() * 2.4, 0, 6.29); c.fill(); } }, 256, 256) });
    const pot = (grp, r, h, glaze) => {   // a pot with a rolled rim and a saucer, soil inside
      const prof = [[0, 0], [r * .78, 0], [r * .8, .01], [r * .97, h * .85], [r * 1.02, h * .86], [r * 1.06, h * .9], [r * 1.06, h], [r * .98, h], [r * .96, h * .9]].map(([a, b]) => new THREE.Vector2(a, b));
      const m = glaze ? new THREE.MeshBasicMaterial({ vertexColors: true }) : potM;
      grp.add(new THREE.Mesh(lit(new THREE.LatheGeometry(prof, 36), glaze || '#ffffff', .5), m));
      const sau = new THREE.Mesh(lit(new THREE.CylinderGeometry(r * 1.1, r * .95, .025, 36), glaze || '#ffffff', .5), m); sau.position.y = .0125; grp.add(sau);
      const soil = new THREE.Mesh(new THREE.CircleGeometry(r * .95, 28), soilM); soil.rotation.x = -Math.PI / 2; soil.position.y = h * .88; grp.add(soil);
      const sh = this.shadowMesh('round', r * 3.4, r * 3.4, .5); sh.rotation.x = -Math.PI / 2; sh.position.y = .003; grp.add(sh);
      return h * .88;
    };
    const leaves = [], blades = [], M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), C = new THREE.Color();
    const fig = (grp, H) => {   // a fiddle-leaf fig: three leaning stems from one pot, big leaves stepping up each, all reaching out to the light
      const soil = pot(grp, .22, .44, null), trunkM = new THREE.MeshBasicMaterial({ vertexColors: true });
      for (let k = 0; k < 3; k++) {
        const a0 = k * 2.1 + rnd(-.3, .3), lean = rnd(.08, .2), hk = H * (k ? rnd(.7, .9) : 1);
        const pts = [0, .35, .7, 1].map(t => new THREE.Vector3(Math.cos(a0) * (.03 + lean * t), soil + hk * t, Math.sin(a0) * (.03 + lean * t)).add(new THREE.Vector3(rnd(-.02, .02), 0, rnd(-.02, .02))));
        const trunk = new THREE.CatmullRomCurve3(pts);
        grp.add(new THREE.Mesh(lit(new THREE.TubeGeometry(trunk, 20, .016 - k * .003, 8), '#6e5338', .5), trunkM));
        const n = Math.round(10 + hk * 9);
        for (let i = 0; i < n; i++) {
          const t = .3 + .7 * (i / n), p = trunk.getPointAt(Math.min(1, t)), a = a0 + i * 2.39 + rnd(-.3, .3), sc = .26 + .12 * Math.sin(t * Math.PI) + rnd(-.03, .04);
          Q.setFromEuler(new THREE.Euler(rnd(-1.15, -.55) + t * .35, a, rnd(-.3, .3), 'YXZ'));
          grp.updateMatrixWorld(); const wp = grp.localToWorld(p.clone());
          leaves.push([wp, grp.getWorldQuaternion(new THREE.Quaternion()).multiply(Q), sc, C.setHSL(rnd(.22, .29), rnd(.38, .58), rnd(.36, .56)).clone()]);
        }
      }
    };
    const snake = (grp, H, r = .16, glaze = '#2d4a3e') => {   // a snake plant in a glazed pot
      const soil = pot(grp, r, r * 1.9, glaze);
      for (let i = 0; i < 13; i++) {
        const a = i * 2.4 + rnd(-.2, .2), d = rnd(0, r * .55), hh = H * rnd(.55, 1);
        Q.setFromEuler(new THREE.Euler(rnd(-.15, .15), a, rnd(-.12, .12), 'YXZ'));
        grp.updateMatrixWorld(); const wp = grp.localToWorld(new THREE.Vector3(Math.cos(a) * d, soil - .01, Math.sin(a) * d));
        blades.push([wp, grp.getWorldQuaternion(new THREE.Quaternion()).multiply(Q), [rnd(.06, .09) * (H / .9), hh], C.setHSL(rnd(.25, .3), rnd(.3, .45), rnd(.5, .7)).clone()]);
      }
    };
    g.updateMatrixWorld();
    for (const sp of spots) {
      const grp = new THREE.Group(); grp.position.set(sp.x, sp.y || 0, sp.z); grp.rotation.y = rnd(0, 6.28); grp.scale.setScalar(sp.s || 1); (sp.parent || g).add(grp);
      if (sp.kind === 'fig') fig(grp, sp.h || 1.5); else snake(grp, sp.h || .9, sp.r, sp.glaze);
    }
    const inst = (geo, m, list, sz) => { const im = new THREE.InstancedMesh(geo, m, list.length), inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
      list.forEach(([wp, wq, sc, col], i) => { const s3 = Array.isArray(sc) ? S.set(sc[0], sc[1], sc[0]) : S.setScalar(sc); im.setMatrixAt(i, M4.compose(wp, wq, s3).premultiply(inv)); im.setColorAt(i, col); });
      im.instanceMatrix.needsUpdate = true; g.add(im); };
    if (leaves.length) inst(leafG, leafM, leaves);
    if (blades.length) inst(bladeG, snakeM, blades);
  }
  pressRoom(hall) { const z0 = -hall.L / 2; return [z0, z0 + 15.9]; }   // the baked room is 16 m long from the door, whatever the hall's nominal length
  pressStations(hall) {   // four desks against the walls (down the left, back up the right), the fifth in the middle on the carpet
    const { W } = hall, [z0, z1] = this.pressRoom(hall), wx = W / 2 - .5 - .06, zA = z0 + 4.4, zB = z1 - 3.0;
    return [{ x: -wx, z: zA, ry: Math.PI / 2 }, { x: -wx, z: zB, ry: Math.PI / 2 }, { x: wx, z: zB, ry: -Math.PI / 2 }, { x: wx, z: zA, ry: -Math.PI / 2 }, { x: 0, z: z1 - .1 - .5, ry: Math.PI }]
      .map(q => ({ ...q, fx: Math.sin(q.ry), fz: Math.cos(q.ry) }));
  }
  addPress(hall, id, work, i) {
    const { group: g } = hall, B = work.book, base = `assets/editorial/${id}/`;
    const load = f => { const t = this.loader.load(base + f); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); return t; };
    if (!hall.pressProps) { hall.pressProps = true; this.pressProps(hall); (this._pending ||= []).push(() => this.mergeStatic(hall)); }
    const { x, z, ry, fx, fz } = this.pressStations(hall)[i];
    const ph = B.h, pw = B.h * B.aspect, TOP = 1.0, fold = B.mode === 'fold', covers = B.mode === 'covers';
    const FS = .98 / 2975;   // the fold-out: metres per master pixel (fully open it is ~80 cm wide)
    const bw = fold ? .515 : covers ? pw + .02 : pw, bh = fold ? .86 : ph;   // half-width and height of what lies on the lectern
    const mk = (B.mk || []).map(([f, a]) => [load(f), a]);
    const { top } = this.lectern(g, x, z, bw, bh, TOP, { mk, ry, cover: load(fold ? 'fold/top_out.png' : 'p00.jpg'), pw: fold ? 1488 * FS : pw, ph: fold ? 886 * FS : ph });
    const bk = new THREE.Group(); bk.position.z = B.thick + .002; bk.userData.dynamic = true; top.add(bk);
    const st = fold ? this.pressFold(bk, load, FS) : covers ? this.pressCovers(bk, load, B, pw, ph) : this.pressBook(bk, load, B, pw, ph);
    st.id = id; st.mode = B.mode || 'book'; st.hallG = g;
    st.readL = [[x + fx * (fold ? .8 : .6), TOP + (fold ? 1.08 : .84), z + fz * (fold ? .8 : .6)], [x + fx * .02, TOP - .02, z + fz * .02]];   // reading: over the desk, looking down at the pages
    st.done = () => { if (this.atBook === st) this.ui.pages?.(st); };
    (this.books = this.books || []).push(st);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(bw * 2, bh), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.z = .01; bk.add(hit);
    hit.userData = { type: 'work', id, hallId: hall.def.id, frame: bk, size: [bw * 2, bh], z, salon: true, book: st, zoom: fold ? 56 : 54,
      pose: [x + fx * (fold ? 1.5 : 1.38), 1.66, z + fz * (fold ? 1.5 : 1.38), x - fx * .56, 1.36, z - fz * .56] };   // sit in the chair: the work on the desk, its prints on the wall above
    this.interactive.push(hit); hall.exhibits.push(hit);
    this.chapter(g, x, z, work.title, fx, fz, ry);
  }
  pressTurned(st) { this.ui.sound?.pageTurn?.(); st.reading = true; }
  pressBook(bk, load, B, pw, ph) {   // a bound book: a leaf bends over the spine; turned by hand
    const blank = this.blankPage || (this.blankPage = (() => { const t = new THREE.DataTexture(new Uint8Array([236, 232, 224, 255]), 1, 1); t.needsUpdate = true; return t; })());
    const texs = {}, tex = k => (k < 0 || k >= B.n) ? null : (texs[k] || (texs[k] = load(`p${String(k).padStart(2, '0')}.jpg`)));
    const mat = (gut, leaf) => new THREE.ShaderMaterial({
      side: leaf ? THREE.DoubleSide : THREE.FrontSide, polygonOffset: leaf, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
      uniforms: { uF: { value: blank }, uB: { value: blank }, uA: { value: 0 }, uBend: { value: .55 }, uW: { value: pw }, uLeaf: { value: leaf ? 1 : 0 }, uGut: { value: gut } },
      vertexShader: `uniform float uA,uBend,uW,uLeaf; varying vec2 vUv; varying float vS;
        void main(){ vUv=uv; vec3 p=position; vS=1.;
          if(uLeaf>.5){ float r=p.x, a=uA-uBend*sin(uA)*pow(r/uW,1.4); p=vec3(cos(a)*r,p.y,sin(a)*r+.0008); vS=.74+.26*abs(cos(a)); }
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: `uniform sampler2D uF,uB; uniform float uGut; varying vec2 vUv; varying float vS;
        void main(){
          vec3 c = gl_FrontFacing ? texture2D(uF,vUv).rgb : texture2D(uB,vec2(1.-vUv.x,vUv.y)).rgb;
          float d = uGut<0. ? 1.-vUv.x : vUv.x;
          float pool = 1.-smoothstep(.45,1.,length(vUv-.5)*1.4)*.12;
          c *= vS*mix(.6,1.,smoothstep(0.,.08,d))*pool;
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const rightG = new THREE.PlaneGeometry(pw, ph); rightG.translate(pw / 2, 0, 0);
    const leftG = new THREE.PlaneGeometry(pw, ph); leftG.translate(-pw / 2, 0, 0);
    const leafG = new THREE.PlaneGeometry(pw, ph, 36, 1); leafG.translate(pw / 2, 0, 0);
    const R = new THREE.Mesh(rightG, mat(1, false)), Lp = new THREE.Mesh(leftG, mat(-1, false)), leaf = new THREE.Mesh(leafG, mat(1, true));
    bk.add(R, Lp, leaf); leaf.visible = false;
    // the fold of the spine: a soft dark crease laid over the seam, so the page underneath never shows through as a light line
    const crease = new THREE.Mesh(new THREE.PlaneGeometry(.022, ph), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: textTexture((c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(20,16,12,0)'); gr.addColorStop(.5, 'rgba(20,16,12,.55)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, 64, 4) }));
    crease.position.z = .0004; crease.renderOrder = 2; bk.add(crease);
    const edge = new THREE.MeshBasicMaterial({ color: '#cfc8ba' }), cov = new THREE.MeshBasicMaterial({ color: new THREE.Color(B.cover).multiplyScalar(.85) });
    const block = s2 => { const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, B.thick), [edge, edge, edge, edge, cov, cov]); m.position.set(s2 * pw / 2, 0, -B.thick / 2 - .0008); bk.add(m); return m; };
    block(1); const blockL = block(-1);
    const st = { k: 0, K: Math.floor(B.n / 2), anim: null };
    const show = (m, t) => { m.visible = !!t; if (t) m.material.uniforms.uF.value = t; };
    st.set = () => { const k = st.k; show(Lp, k >= 1 ? tex(2 * k - 1) : null); blockL.visible = k >= 1; crease.visible = k >= 1; show(R, tex(2 * k)); for (let j = 2 * k; j < 2 * k + 4; j++) tex(j); };
    st.turn = d => {
      if (st.anim) return true;
      if ((d > 0 && st.k >= st.K) || (d < 0 && st.k <= 0)) return false;
      const k = st.k, u = leaf.material.uniforms;
      if (d > 0) { u.uF.value = tex(2 * k) || blank; u.uB.value = tex(2 * k + 1) || blank; show(R, tex(2 * k + 2)); blockL.visible = true; }
      else { u.uF.value = tex(2 * k - 2) || blank; u.uB.value = tex(2 * k - 1) || blank; show(Lp, k - 1 >= 1 ? tex(2 * k - 3) : null); }
      u.uA.value = d > 0 ? 0 : Math.PI; crease.visible = true;
      leaf.visible = true; st.anim = { t0: performance.now(), d }; this.pressTurned(st); return true;
    };
    st.update = () => {
      const a = st.anim; if (!a) return;
      const s = clamp((performance.now() - a.t0) / 950, 0, 1), e = ease(s);
      leaf.material.uniforms.uA.value = Math.PI * (a.d > 0 ? e : 1 - e);
      if (s >= 1) { st.k += a.d; st.anim = null; leaf.visible = false; st.set(); st.done?.(); }
    };
    st.set(); return st;
  }
  pressCovers(bk, load, B, pw, ph) {   // INKED: two variations of the cover, side by side; no pages to turn
    const cov = new THREE.MeshBasicMaterial({ color: new THREE.Color(B.cover).multiplyScalar(.85) }), edge = new THREE.MeshBasicMaterial({ color: '#d8d2c6' });
    [-1, 1].forEach((sx, j) => {
      const m = new THREE.Group(); m.position.set(sx * (pw / 2 + .012), 0, 0); m.rotation.z = sx * -.018; bk.add(m);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: load(`p0${j}.jpg`), color: new THREE.Color(.93, .93, .93) }));
      face.position.z = .0004; m.add(face);
      const body = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, B.thick), [edge, edge, edge, edge, cov, cov]); body.position.z = -B.thick / 2; m.add(body);
    });
    return { k: 0, K: 0, anim: null, turn: () => false, update() {} };
  }
  pressFold(bk, load, FS) {   // Donut Protocol: the fold-out opens on the lectern the way it opens in the hand:
    // the Welcome flap lifts to the Donuts header, the pink "Don't open" tab drops, then the doors swing out, right, then left
    const P = (px, py) => new THREE.Vector3((px - 1600) * FS, (1626 - py) * FS, 0);
    const card = (f, w, h, alpha, flip, dx, dy) => {
      const ge = new THREE.PlaneGeometry(w, h); if (flip === 'x') ge.rotateX(Math.PI); if (flip === 'y') ge.rotateY(Math.PI); ge.translate(dx, dy, flip ? -.0005 : 0);
      return new THREE.Mesh(ge, new THREE.MeshBasicMaterial({ map: load('fold/' + f), color: new THREE.Color(.92, .92, .92), transparent: false, alphaTest: alpha ? .5 : 0 }));
    };
    const W = 1488 * FS, H = 886 * FS, DW = 744 * FS, PH = 711 * FS;
    const base = card('base.jpg', W, H, false, null, 0, 0); base.position.copy(P(1600, 1713)); bk.add(base);
    const pivot = (px, py, z, ...m) => { const o = new THREE.Group(); o.position.copy(P(px, py)).setZ(z); o.add(...m); bk.add(o); return o; };
    const dl = pivot(856, 1713, .0015, card('door_l.jpg', DW, H, false, null, DW / 2, 0), card('door_l_in.jpg', DW, H, false, 'y', DW / 2, 0));
    const dr = pivot(2344, 1713, .0015, card('door_r.jpg', DW, H, false, null, -DW / 2, 0), card('door_r_in.jpg', DW, H, false, 'y', -DW / 2, 0));
    const pk = pivot(1600, 2156, .003, card('pink.png', W, PH, true, null, 0, PH / 2), card('pink_in.png', W, PH, true, 'x', 0, PH / 2));
    const tp = pivot(1600, 1270, .0045, card('top_in.png', W, H, true, null, 0, H / 2), card('top_out.png', W, H, true, 'x', 0, H / 2));
    const at = k => [k >= 1 ? 0 : Math.PI, k >= 2 ? Math.PI : 0, k >= 3 ? Math.PI : 0, k >= 4 ? -Math.PI : 0];   // top, pink, right door, left door
    const apply = v => { tp.rotation.x = v[0]; pk.rotation.x = v[1]; dr.rotation.y = v[2]; dl.rotation.y = v[3]; };
    const st = { k: 0, K: 4, anim: null };
    st.turn = d => {
      if (st.anim) return true;
      const nk = st.k + d; if (nk < 0 || nk > st.K) return false;
      st.anim = { t0: performance.now(), a: at(st.k), b: at(nk), nk }; this.pressTurned(st); return true;
    };
    st.update = () => {
      const a = st.anim; if (!a) return;
      const s = clamp((performance.now() - a.t0) / 1100, 0, 1), e = ease(s);
      apply(a.a.map((v, j) => v + (a.b[j] - v) * e));
      if (s >= 1) { st.k = a.nk; st.anim = null; st.done?.(); }
    };
    apply(at(0)); return st;
  }
  benchKit() {   // shared textures and a cheap "lit" look for the print-shop benches (the hall has no real lights to spare)
    if (this._bk) return this._bk;
    const L = new THREE.Vector3(-.35, 1, .55).normalize();
    // bake soft light into vertex colours: smooth on rounded edges, darker underneath, no lights needed
    const lit = (geo, col, amb = .5) => {
      const n = geo.attributes.normal, p = geo.attributes.position, c = new Float32Array(n.count * 3), b = new THREE.Color(col);
      geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y;
      for (let i = 0; i < n.count; i++) {
        const d = Math.max(0, n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z), up = Math.max(0, n.getY(i));
        const ao = .86 + .14 * ((p.getY(i) - y0) / Math.max(1e-4, y1 - y0));
        const k = (amb + (1 - amb) * d + .08 * up) * ao;
        c[i * 3] = b.r * k; c[i * 3 + 1] = b.g * k; c[i * 3 + 2] = b.b * k;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
    };
    const tex = (draw, w, h, rep) => { const t = textTexture(draw, w, h); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 8; return t; };
    const wood = tex((c, w, h) => {   // oak: long grain, a little figure, never flat
      c.fillStyle = '#d6b087'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 260; k++) {
        const y = Math.random() * h, a = .04 + Math.random() * .12, lw = .6 + Math.random() * 2.2;
        c.strokeStyle = `rgba(${110 + Math.random() * 40},${70 + Math.random() * 25},${35 + Math.random() * 20},${a})`; c.lineWidth = lw; c.beginPath(); c.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x / (90 + k % 7 * 20) + k) * (2 + (k % 5)));
        c.stroke();
      }
      for (let k = 0; k < 3; k++) { const x = Math.random() * w, y = Math.random() * h; const g = c.createRadialGradient(x, y, 1, x, y, 26); g.addColorStop(0, 'rgba(90,55,25,.35)'); g.addColorStop(1, 'rgba(90,55,25,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 40, 12, 0, 0, 6.29); c.fill(); }
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,220,.08)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,35,15,.08)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 1024, 512, true);
    const mat = tex((c, w, h) => {   // oatmeal linen book cloth: a fine weave, slubs, soft light across it
      c.fillStyle = '#d9cdb6'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(${150 + Math.random() * 40},${130 + Math.random() * 35},${100 + Math.random() * 30},${.1 + Math.random() * .12})`; c.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 2) { c.fillStyle = `rgba(${250},${244},${230},${.05 + Math.random() * .09})`; c.fillRect(x, 0, 1, h); }
      for (let k = 0; k < 160; k++) { const y = Math.random() * h; c.fillStyle = `rgba(120,100,75,${.08 + Math.random() * .1})`; c.fillRect(Math.random() * w, y, 20 + Math.random() * 90, 1.4); }   // slubs in the thread
      const g = c.createRadialGradient(w * .45, h * .4, 10, w * .5, h * .5, w * .75); g.addColorStop(0, 'rgba(255,250,240,.12)'); g.addColorStop(1, 'rgba(90,70,45,.12)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 1024, 768);
    const peg = tex((c, w, h) => {   // masonite pegboard: warm brown, soft fibre, a grid of holes with a dark inside and a light lip
      c.fillStyle = '#b9926a'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 2500; k++) { c.fillStyle = `rgba(${80 + Math.random() * 60},${55 + Math.random() * 40},${30 + Math.random() * 20},.05)`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 18, 1); }
      const s = w / 30;
      for (let y = s / 2; y < h; y += s) for (let x = s / 2; x < w; x += s) {
        c.fillStyle = 'rgba(255,236,210,.35)'; c.beginPath(); c.arc(x + 1, y + 1.5, s * .15, 0, 6.29); c.fill();
        c.fillStyle = '#3a2716'; c.beginPath(); c.arc(x, y, s * .14, 0, 6.29); c.fill();
      }
    }, 1536, 900);
    const kraft = tex((c, w, h) => {   // a ream wrapped in kraft paper with its label
      c.fillStyle = '#b8936a'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 600; k++) { c.fillStyle = `rgba(90,60,30,${Math.random() * .08})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 30, 1); }
      c.fillStyle = '#efe8d8'; c.fillRect(w * .32, h * .25, w * .36, h * .5); c.fillStyle = '#3a2a1c'; c.font = `600 ${h * .12}px ${SANS}`; c.textAlign = 'center'; c.fillText('ART PAPER', w / 2, h * .46); c.font = `400 ${h * .09}px ${SANS}`; c.fillText('170 gsm · 500', w / 2, h * .62);
    }, 512, 256);
    const sheets = tex((c, w, h) => {   // the side of a stack of paper: fine layered lines
      c.fillStyle = '#f2ede3'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2 + Math.random() * 2) { c.fillStyle = `rgba(120,110,95,${.08 + Math.random() * .12})`; c.fillRect(0, y, w, 1); }
    }, 256, 128);
    const rule = tex((c, w, h) => {   // steel rule with engraved marks
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e2e5e8'); g.addColorStop(.5, '#b9bdc2'); g.addColorStop(1, '#d4d7da'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2a2c2e'; for (let i = 0, n = 0; i < w; i += w / 300, n++) c.fillRect(i, 0, 1.2, n % 10 === 0 ? h * .5 : n % 5 === 0 ? h * .35 : h * .2);
      c.font = `600 ${h * .28}px ${SANS}`; for (let n = 1; n < 30; n++) c.fillText(String(n), n * w / 30 - 6, h * .85);
    }, 2048, 64);
    const M = (map, extra = {}) => new THREE.MeshBasicMaterial({ vertexColors: true, map: map || null, ...extra });
    this._bk = { lit, wood, mat, peg, kraft, sheets, rule, M,
      woodM: M(wood), steelM: M(null), paperM: M(null), matM: M(mat), pegM: M(peg), kraftM: M(kraft), sheetsM: M(sheets), ruleM: M(rule) };
    return this._bk;
  }
  deskMats(K) {   // leather, brass and black-steel finishes shared by the desks, lamps and ceiling fittings
    if (!K.leatherM) {
      K.leatherM = K.M(textTexture((c, w, h) => {   // a green leather inlay with a tooled gold border
        c.fillStyle = '#2c4636'; c.fillRect(0, 0, w, h);
        for (let k = 0; k < 1800; k++) { const r = 4 + Math.random() * 30; c.fillStyle = `rgba(${Math.random() < .5 ? '10,25,18' : '80,110,90'},${Math.random() * .06})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, r, 0, 6.29); c.fill(); }
        c.strokeStyle = 'rgba(206,170,96,.85)'; c.lineWidth = 3; c.strokeRect(18, 18, w - 36, h - 36); c.lineWidth = 1.2; c.strokeRect(30, 30, w - 60, h - 60);
      }, 1024, 512));
      K.brass = '#d2ab62';
      const matcap = (stops, rim) => { const t = textTexture((c, w, h) => {
        c.fillStyle = stops[stops.length - 1][1]; c.fillRect(0, 0, w, h);
        const g = c.createRadialGradient(w * .36, h * .3, 2, w * .5, h * .5, w * .5); stops.forEach(([o, col]) => g.addColorStop(o, col));
        c.fillStyle = g; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 6.29); c.fill();
        const r = c.createRadialGradient(w * .7, h * .78, 2, w * .7, h * .78, w * .3); r.addColorStop(0, rim); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 6.29); c.fill();
        c.fillStyle = 'rgba(255,255,250,.9)'; c.beginPath(); c.ellipse(w * .33, h * .27, w * .07, h * .045, -.6, 0, 6.29); c.fill();
      }, 256, 256); t.colorSpace = THREE.SRGBColorSpace; return t; };
      K.brassM = new THREE.MeshMatcapMaterial({ matcap: matcap([[0, '#fff1c4'], [.25, '#e8c374'], [.6, '#a87a32'], [.9, '#4d3412'], [1, '#2a1b08']], 'rgba(255,220,150,.55)') });
      K.blackM = new THREE.MeshMatcapMaterial({ matcap: matcap([[0, '#9a9a9a'], [.3, '#3a3a3a'], [.8, '#121212'], [1, '#050505']], 'rgba(160,150,140,.35)') });
    }
  }
  lectern(g, x, z, pw, ph, TOP, opt = {}) {   // a library pedestal desk in walnut: leather top, panelled cupboard doors, brass; the project on linen, an anglepoise over it, its prints on the pegboard behind
    const K = this.benchKit(), { lit } = K;
    this.deskMats(K);
    const TH = .95, TD = 1.0, CW = opt.pw || .24, TW = Math.max(2.0, pw * 2 + .12 + 2 * Math.max(.62, .16 + CW)), tilt = .2;
    const lec = new THREE.Group(); lec.position.set(x, 0, z); lec.rotation.y = opt.ry ?? Math.PI; g.add(lec);
    const rb = (w, h, d, r, col, m, px, py, pz, parent = lec) => { const ge = lit(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * .999), col); const o = new THREE.Mesh(ge, m); o.position.set(px, py, pz); parent.add(o); return o; };
    const cyl = (r0, r1, h, col, m, px, py, pz, seg = 16, parent = lec) => { const o = new THREE.Mesh(lit(new THREE.CylinderGeometry(r0, r1, h, seg), col), m); o.position.set(px, py, pz); parent.add(o); return o; };
    const rod = (a, b, r, col, parent = lec) => {   // a cylinder from a to b
      const d = b.clone().sub(a), o = new THREE.Mesh(lit(new THREE.CylinderGeometry(r, r, d.length(), 12), col), col === K.brass ? K.brassM : K.steelM);
      o.position.copy(a).add(b).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(o); return o; };
    const WAL = '#8a6446', WAL_D = '#6a4a33', FZ = TD / 2;   // walnut; the front faces you
    // --- the desk: a moulded top with a leather inlay, two pedestals with panelled doors, a drawer across the kneehole, a plinth
    rb(TW + .05, .05, TD + .05, .012, WAL, K.woodM, 0, TH - .025, 0);
    rb(TW + .01, .025, TD + .01, .008, WAL_D, K.woodM, 0, TH - .062, 0);   // the moulding under the top edge
    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(TW - .14, TD - .14), K.leatherM); inlay.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12).fill(1), 3)); inlay.rotation.x = -Math.PI / 2; inlay.position.y = TH + .0012; lec.add(inlay);
    const PDW = .56, PH = TH - .075 - .07;
    for (const s of [-1, 1]) {
      const px = s * (TW / 2 - PDW / 2 - .02);
      rb(PDW, PH, TD - .06, .008, WAL, K.woodM, px, .07 + PH / 2, 0);   // the pedestal carcass
      rb(PDW - .03, .07, TD - .09, .01, WAL_D, K.woodM, px, .035, 0);   // plinth
      // a drawer on top, a panelled cupboard door below, brass hardware
      const dz = FZ - .03 + .008, dH = .12, doorH = PH - dH - .05;
      rb(PDW - .05, dH, .016, .006, WAL, K.woodM, px, .07 + PH - dH / 2 - .02, dz);
      const pull = rb(.1, .016, .016, .006, K.brass, K.brassM, px, .07 + PH - dH / 2 - .02, dz + .016);
      rb(PDW - .05, doorH, .016, .006, WAL, K.woodM, px, .07 + doorH / 2 + .02, dz);
      rb(PDW - .15, doorH - .12, .012, .02, WAL_D, K.woodM, px, .07 + doorH / 2 + .02, dz + .01);   // the raised panel
      rb(PDW - .19, doorH - .16, .01, .015, WAL, K.woodM, px, .07 + doorH / 2 + .02, dz + .014);
      const kb = new THREE.Mesh(new THREE.SphereGeometry(.017, 14, 10), K.brassM); kb.position.set(px - s * (PDW / 2 - .065), .07 + doorH * .62, dz + .024); lec.add(kb);
      const esc = rb(.012, .024, .004, .002, '#2a2016', K.steelM, px - s * (PDW / 2 - .065), .07 + doorH * .62 - .045, dz + .01);   // keyhole
    }
    const KW = TW - 2 * PDW - .1;
    rb(KW, .085, .016, .006, WAL, K.woodM, 0, TH - .075 - .045, FZ - .02);   // the centre drawer over the kneehole
    rb(.12, .016, .016, .006, K.brass, K.brassM, 0, TH - .075 - .045, FZ - .004);
    rb(KW + .04, PH - .1, .02, .006, WAL_D, K.woodM, 0, .12 + (PH - .1) / 2, -FZ + .06);   // the modesty panel at the back
    const sh = this.shadowMesh('rect', TW + .5, TD + .5, .45); sh.rotation.x = -Math.PI / 2; sh.position.y = .005; lec.add(sh);
    // --- the project on linen, on a low walnut book-rest tipped toward you
    const bh = ph + .1, bw2 = pw * 2 + .12, top = new THREE.Group();
    top.position.set(0, TH + .03 + Math.sin(tilt) * bh / 2, .03); top.rotation.x = -(Math.PI / 2 - tilt); lec.add(top); top.visible = !opt.blank;
    rb(bw2 + .04, bh + .04, .022, .006, WAL, K.woodM, 0, 0, -.022, top);
    const linen = new THREE.Mesh(lit(new RoundedBoxGeometry(bw2, bh, .006, 2, .0029), '#ffffff'), K.matM); linen.position.z = -.007; top.add(linen);
    rb(bw2 + .04, .02, .03, .005, WAL_D, K.woodM, 0, -bh / 2 - .02, .004, top);
    if (!opt.blank) rb(bw2 * .7, Math.sin(tilt) * bh, .05, .006, WAL_D, K.woodM, 0, TH + Math.sin(tilt) * bh / 2 - .01, .03 - Math.cos(tilt) * bh / 2 + .06);
    // --- beside it, a stack of printed copies with the cover on top
    const sx0 = bw2 / 2 + .17;
    if (opt.cover) {
      const cw = opt.pw || .24, chh = opt.ph || .24, cx = bw2 / 2 + .1 + cw / 2;
      for (let k = 0; k < 3; k++) {
        const st = new THREE.Mesh(lit(new THREE.BoxGeometry(cw, .016, chh), '#ffffff'), [K.sheetsM, K.sheetsM, K.paperM, K.paperM, K.sheetsM, K.sheetsM]);
        st.position.set(cx + (k - 1) * .004, TH + .008 + k * .0165, .02 + (k % 2) * .006); st.rotation.y = (k - 1) * .035; lec.add(st);
        if (k === 2) { const f = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh), new THREE.MeshBasicMaterial({ map: opt.cover, color: new THREE.Color(.92, .9, .86) })); f.rotation.x = -Math.PI / 2; f.position.y = .0085; st.add(f); }
      }
    }
    // --- a big brass anglepoise at the back corner: weighted stepped base, twin arms with coil springs, bolted knuckles, a rolled-rim shade, a switch and a cloth cable
    { const ax = -(bw2 / 2 + .42), az = -.3, S_ = 1.5, V = (a, b, c) => new THREE.Vector3(a, b, c), B = K.brassM, BLK = K.blackM;
      const LG = new THREE.Group(); LG.position.set(ax, TH, az); LG.scale.setScalar(S_); lec.add(LG);
      const mesh = (geo, m, p) => { const o = new THREE.Mesh(geo, m); if (p) o.position.copy(p); LG.add(o); return o; };
      const along = (o, a, b) => { const d = b.clone().sub(a); o.position.copy(a).add(b).multiplyScalar(.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return o; };
      const across = (o, axis) => { o.quaternion.setFromUnitVectors(V(0, 1, 0), axis.clone().normalize()); return o; };
      // base: a heavy stepped disc with a bevel, a felt shadow, the pivot housing on top
      mesh(new THREE.CylinderGeometry(.088, .094, .016, 40), B, V(0, .008, 0)); mesh(new THREE.TorusGeometry(.088, .004, 8, 40), B, V(0, .016, 0)).rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(.05, .066, .016, 32), B, V(0, .024, 0));
      mesh(new THREE.BoxGeometry(.03, .028, .04), B, V(0, .045, 0));
      const p0 = V(0, .055, 0), p1 = V(.03, .44, -.06), p2 = V(.28, .42, .16);
      const side = V().crossVectors(p1.clone().sub(p0), p2.clone().sub(p1)).normalize(), off = side.clone().multiplyScalar(.011);
      // twin arms
      for (const [a, b] of [[p0, p1], [p1, p2]]) for (const s of [-1, 1]) {
        const a2 = a.clone().addScaledVector(off, s), b2 = b.clone().addScaledVector(off, s);
        along(mesh(new THREE.CylinderGeometry(.0042, .0042, a2.distanceTo(b2), 12), B), a2, b2);
      }
      // coil springs beside the lower and upper arm
      const spring = (a, b) => { const d = b.clone().sub(a), L_ = d.length(), u = d.clone().normalize(), n1 = V().crossVectors(u, side).normalize(), pts = [];
        for (let i = 0; i <= 260; i++) { const t = i / 260, ang = t * 2 * Math.PI * 34; pts.push(a.clone().addScaledVector(u, t * L_).addScaledVector(n1, Math.cos(ang) * .0055).addScaledVector(side, Math.sin(ang) * .0055)); }
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 520, .0011, 5), BLK); };
      const sp = side.clone().multiplyScalar(.0), up1 = p1.clone().sub(p0).normalize();
      spring(p0.clone().add(V(.018, .03, 0)), p0.clone().add(V(.018, .03, 0)).addScaledVector(up1, .2));
      spring(p1.clone().add(V(.0, -.02, .02)), p1.clone().add(V(0, -.02, .02)).addScaledVector(p2.clone().sub(p1).normalize(), .14));
      // knuckles: twin discs with bolt caps across each joint
      for (const p of [p0, p1, p2]) {
        for (const s of [-1, 1]) across(mesh(new THREE.CylinderGeometry(.017, .017, .006, 24), B, p.clone().addScaledVector(side, s * .017)), side);
        across(mesh(new THREE.CylinderGeometry(.006, .006, .05, 12), B, p.clone()), side);
        for (const s of [-1, 1]) across(mesh(new THREE.CylinderGeometry(.008, .008, .006, 6), BLK, p.clone().addScaledVector(side, s * .026)), side);   // wing nuts
      }
      // the head: a short neck, a rolled-rim bell shade, a cream reflector, the bulb, a push switch on top
      const tgt = V((.02 - ax) / S_, 0, (.06 - az) / S_), aim = tgt.clone().sub(p2).normalize();
      const head = new THREE.Group(); head.position.copy(p2); head.quaternion.setFromUnitVectors(V(0, -1, 0), aim); LG.add(head);
      const hm = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; head.add(o); return o; };
      hm(new THREE.CylinderGeometry(.011, .013, .04, 16), B, .095);
      const prof = [[.001, .078], [.016, .077], [.022, .066], [.024, .05], [.032, .04], [.048, .03], [.062, .014], [.072, -.01], [.078, -.034], [.081, -.05], [.086, -.054], [.088, -.058], [.084, -.061]].map(([r, y]) => new THREE.Vector2(r, y));
      head.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), B));
      head.add(new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0, 10).map(v => new THREE.Vector2(v.x * .96, v.y - .002)), 48), new THREE.MeshBasicMaterial({ color: '#f3e3c2', side: THREE.BackSide })));
      hm(new THREE.TorusGeometry(.033, .0025, 8, 32), B, .04).rotation.x = Math.PI / 2;   // the seam ring
      hm(new THREE.CylinderGeometry(.006, .006, .016, 12), BLK, .084).position.x = .014;   // switch
      const bulb = hm(new THREE.SphereGeometry(.03, 18, 12), new THREE.MeshBasicMaterial({ color: '#fff7e2' }), -.02); bulb.scale.y = 1.15;
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.softTex(), color: '#ffd59a', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(.26, .26, 1); gl.position.y = -.08; head.add(gl);
      // the cable: out of the head, looping down along the arm and off the back of the desk
      const hw = p2.clone().add(aim.clone().multiplyScalar(-.1));
      const cable = new THREE.CatmullRomCurve3([hw, p2.clone().add(V(-.04, .03, -.02)), p1.clone().add(V(-.02, -.05, -.02)), V(-.03, .2, -.04), V(-.05, .03, -.07), V(-.1, .004, -.12), V(-.18, .004, -.2)]);
      mesh(new THREE.TubeGeometry(cable, 80, .0028, 6), BLK);
      const felt = this.shadowMesh('round', .26, .26, .45); felt.rotation.x = -Math.PI / 2; felt.position.y = .002; LG.add(felt);
    }
    // --- a library chair pulled up to the desk: walnut frame, green leather seat and back, arms
    { const cz = TD / 2 + .4, LEA = '#355542', C = new THREE.Group(); C.position.set(0, 0, cz); lec.add(C);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(.022, .016, .5, WAL_D, K.woodM, sx * .22, .25, sz * .2, 10, C);
      rb(.56, .05, .5, .01, WAL, K.woodM, 0, .525, 0, C);
      rb(.5, .055, .45, .028, LEA, K.steelM, 0, .575, -.01, C);
      for (const sx of [-1, 1]) rb(.045, .56, .045, .008, WAL, K.woodM, sx * .235, .82, .225, C);
      rb(.56, .075, .055, .018, WAL, K.woodM, 0, 1.09, .228, C);
      rb(.42, .32, .045, .022, LEA, K.steelM, 0, .86, .215, C);
      for (const sx of [-1, 1]) { rb(.055, .035, .48, .012, WAL, K.woodM, sx * .28, .79, .02, C); cyl(.016, .016, .22, WAL, K.woodM, sx * .28, .67, -.19, 10, C); }
      const csh = this.shadowMesh('round', .9, .9, .4); csh.rotation.x = -Math.PI / 2; csh.position.y = .006; C.add(csh);
    }
    // --- the prints, framed in walnut and hung on the wall in front of you, under a brass picture light
    const mk = opt.mk || [];
    if (mk.length) {
      const V = (a, b, c) => new THREE.Vector3(a, b, c), wz = -(TD / 2 + .055);
      const sz = mk.map(([, a]) => a >= 1 ? [.84, .84 / a] : [.46, .46 / a]), gap = .16, tot = sz.reduce((q, [w]) => q + w, 0) + gap * (mk.length - 1), maxH = Math.max(...sz.map(([, h]) => h));
      let cx = -tot / 2; const yc = TH + .82;
      mk.forEach(([tex], k) => {
        const [w, h] = sz[k], f = new THREE.Group(); f.position.set(cx + w / 2, yc, wz); lec.add(f); cx += w + gap;
        const fs = new THREE.Mesh(new THREE.PlaneGeometry(w + .3, h + .3), new THREE.MeshBasicMaterial({ map: this.softTex(), color: '#2a1a0e', transparent: true, opacity: .45, depthWrite: false })); fs.position.set(.03, -.05, .002); f.add(fs);
        rb(w + .1, h + .1, .035, .006, WAL_D, K.woodM, 0, 0, .02, f);
                const img = new THREE.Mesh(new THREE.PlaneGeometry(w + .04, h + .04), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); img.position.z = .0385; f.add(img);
      });
      const ly = yc + maxH / 2 + .16;
      rod(V(-tot / 2 + .1, ly, wz + .16), V(tot / 2 - .1, ly, wz + .16), .02, K.brass);
      for (const s of [-1, 1]) rod(V(s * tot / 4, ly, wz + .16), V(s * tot / 4, ly - .06, wz + .005), .007, K.brass);
      const wash = new THREE.Mesh(new THREE.PlaneGeometry(tot + .6, maxH + .7), new THREE.MeshBasicMaterial({ map: textTexture((c, w, h) => { const gr = c.createRadialGradient(w / 2, 0, 4, w / 2, h * .1, w * .6); gr.addColorStop(0, 'rgba(255,214,150,.55)'); gr.addColorStop(1, 'rgba(255,214,150,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, 512, 256), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      wash.position.set(0, yc + .05, wz + .003); lec.add(wash);
    }
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), poolMaterial('#ffcf8a', .22)); pool.rotation.x = -Math.PI / 2; pool.position.set(x, .012, z); g.add(pool);
    if (this.Q.hallLights) { const l = new THREE.SpotLight('#ffd9a8', 8, 5, .7, .7, 1.4); l.position.set(x, 2.4, z); l.target.position.set(x, .9, z); g.add(l, l.target); }
    return { lec, top };
  }
  chapter(g, x, z, title, fx = 0, fz = -1, ry = Math.PI) {   // the chapter mark on the floor behind each chair, in printer's ink
    const t = textTexture((c, w, h) => { c.fillStyle = 'rgba(38,32,26,.9)'; c.font = `italic 400 ${h * .5}px ${SERIF}`; c.textAlign = 'center'; c.fillText(title, w / 2, h * .68); }, 1400, 220);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .345), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .5, depthWrite: false }));
    const grp = new THREE.Group(); grp.position.set(x + fx * 1.6, .015, z + fz * 1.6); grp.rotation.y = ry - Math.PI; g.add(grp);
    m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(-1, -1, 1); grp.add(m);
  }
  dropBaked(o, h, [x0, x1, za, zb], top = .85) {   // cut a baked piece of furniture out of a hall's shell (every triangle wholly inside the box)
    if (!o || !h || o.userData.dropped) return; o.updateMatrixWorld(); h.group.updateMatrixWorld();
    const geo = o.geometry, pos = geo.attributes.position, idx = geo.index, v = new THREE.Vector3(), inBox = [];
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); h.group.worldToLocal(v); inBox.push(v.x > x0 && v.x < x1 && v.y < top && v.z > za && v.z < zb); }
    const keep = []; for (let t = 0; t < idx.count; t += 3) { const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (!(inBox[a] && inBox[b] && inBox[c])) keep.push(a, b, c); }
    geo.setIndex(keep); o.userData.dropped = true;
  }
  clearBench() {   // inside the press the walk zig-zags between lecterns: the hall's centre bench goes
    const o = this.edShell, h = this.halls?.editorial; if (!o || !h || o.userData.benchGone || !artIn('editorial')) return;
    o.updateMatrixWorld(); h.group.updateMatrixWorld();
    const geo = o.geometry, pos = geo.attributes.position, idx = geo.index, v = new THREE.Vector3(), inBox = [];
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); h.group.worldToLocal(v); inBox.push(Math.abs(v.x) < 1 && v.y < .85 && v.z > -3.4 && v.z < -.6); }
    const keep = []; for (let t = 0; t < idx.count; t += 3) { const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (!(inBox[a] && inBox[b] && inBox[c])) keep.push(a, b, c); }
    geo.setIndex(keep); o.userData.benchGone = true;
  }
  pressProps(hall) {
    const { group: g, L, W } = hall, rnd = (a, b) => a + Math.random() * (b - a), S = this.pressStations(hall);
    setTimeout(() => this.clearBench(), 0);
    // ---- a reading-room ceiling: a walnut coffer grid glowing warm from inside, and milky schoolhouse globes on brass rods ----
    { const K = this.benchKit(); this.deskMats(K); const [r0, r1] = this.pressRoom(hall), RL = r1 - r0, rc = (r0 + r1) / 2, nx = 4, nz = Math.round(RL / 2.2), cy = HALL_H - .02;
      const glow = textTexture((c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * .62); gr.addColorStop(0, '#fff0cf'); gr.addColorStop(.55, '#f2c98c'); gr.addColorStop(1, '#8a5a32'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, 256, 256);
      glow.wrapS = glow.wrapT = THREE.RepeatWrapping; glow.repeat.set(nx, nz);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, RL), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(.95, .9, .85) })); pl.rotation.x = Math.PI / 2; pl.position.set(0, cy, rc); g.add(pl);
      const beam = (w, d, px, pz) => { const o = new THREE.Mesh(K.lit(new RoundedBoxGeometry(w, .26, d, 2, .02), '#5a3d28', .6), K.woodM); o.position.set(px, cy - .13, pz); g.add(o); };
      for (let i = 0; i <= nx; i++) beam(.14, RL, -W / 2 + i * W / nx, rc);
      for (let j = 0; j <= nz; j++) beam(W, .14, 0, r0 + j * RL / nz);
      const brass = '#d2ab62', globeM = new THREE.MeshBasicMaterial({ color: '#fff2da' }), haloM = new THREE.SpriteMaterial({ map: this.softTex(), color: '#ffd8a0', transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending });
      const zs = [r0 + 1.8, r0 + 1.8 + (RL - 5.4) / 3, r0 + 1.8 + (RL - 5.4) * 2 / 3, r1 - 3.6];   // clear of the star chart
      const globeG = new THREE.SphereGeometry(.17, 28, 18), shine = textTexture((c, w, h) => {   // milk glass: a bright core, a soft rim
        const gr = c.createRadialGradient(w * .42, h * .4, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(.6, '#fbeed6'); gr.addColorStop(1, '#e9d5b4'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, 64, 64);
      const globeMM = new THREE.MeshMatcapMaterial({ matcap: shine });
      const rows = [-W / 2 + 2.25, W / 2 - 2.25], n = 4;
      rows.forEach((xx, ri) => { for (let k = 0; k < n; k++) {   // two staggered rows down the ceiling, clear of the centre line and of the star wall
        const zz = r0 + 2.2 + (k + (ri ? .5 : 0)) * (RL - 5.6) / n, y = 3.9;
        const r = new THREE.Mesh(K.lit(new THREE.CylinderGeometry(.008, .008, cy - .26 - y, 8), brass), K.brassM); r.position.set(xx, (cy - .26 + y) / 2, zz); g.add(r);
        const fit = new THREE.Mesh(K.lit(new THREE.CylinderGeometry(.04, .055, .08, 20), brass), K.brassM); fit.position.set(xx, y - .04, zz); g.add(fit);
        const gb = new THREE.Mesh(globeG, globeMM); gb.position.set(xx, y - .22, zz); g.add(gb);
        const ha = new THREE.Sprite(haloM); ha.scale.set(.75, .75, 1); ha.position.copy(gb.position); g.add(ha);
        const can = new THREE.Mesh(K.lit(new THREE.CylinderGeometry(.07, .07, .015, 24), brass), K.brassM); can.position.set(xx, cy - .27, zz); g.add(can);
      } });
    }
    // ---- the end wall belongs to Down to Earth: an antique celestial chart in gold on deep navy, over its desk ----
    { const [, r1] = this.pressRoom(hall), WH = HALL_H - .5;
      const chart = textTexture((c, w, h) => {   // deep space: a dark gradient, drifting nebulae, a dense band of the galaxy, a few bright stars with glints
        let sd = 11; const R = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
        const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#02030a'); bg.addColorStop(.5, '#070b1c'); bg.addColorStop(1, '#030409'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'lighter';
        const cloud = (x, y, r, col, a) => { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 6.29); c.fill(); };
        for (let k = 0; k < 90; k++) { const t = R(), x = w * (.05 + t * .9), y = h * (.82 - t * .62) + (R() - .5) * h * .22; cloud(x, y, w * (.04 + R() * .1), ['70,90,170', '120,70,160', '40,120,150', '170,90,80'][k % 4], .05 + R() * .07); }   // the galaxy's band, across the wall
        for (let k = 0; k < 7; k++) cloud(w * R(), h * R(), w * (.12 + R() * .1), ['60,40,120', '20,70,110', '110,50,80'][k % 3], .07);
        for (let k = 0; k < 9000; k++) { const t = R(), band = R() < .55, x = band ? w * (.05 + t * .9) + (R() - .5) * 120 : R() * w, y = band ? h * (.82 - t * .62) + (R() - .5) * h * .2 * R() : R() * h, r = R() < .985 ? R() * 1.1 + .25 : R() * 1.8 + 1.2;
          c.fillStyle = `rgba(${220 + R() * 35},${225 + R() * 30},255,${.3 + R() * .7})`; c.beginPath(); c.arc(x, y, r, 0, 6.29); c.fill(); }
        for (let k = 0; k < 26; k++) { const x = R() * w, y = R() * h, r = 2 + R() * 3.5; cloud(x, y, r * 7, '200,215,255', .35);
          c.strokeStyle = 'rgba(230,238,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - r * 9, y); c.lineTo(x + r * 9, y); c.moveTo(x, y - r * 9); c.lineTo(x, y + r * 9); c.stroke();
          c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, r * .6, 0, 6.29); c.fill(); }
        c.globalCompositeOperation = 'source-over';
        const vg = c.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, w * .7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
      }, 2048, 1600);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(W - .1, WH), new THREE.MeshBasicMaterial({ map: chart, toneMapped: false }));
      wall.rotation.y = Math.PI; wall.position.set(0, WH / 2 + .02, r1 - .045); g.add(wall);
    }
    // ---- plants, for an earthy room: figs by the Down to Earth desk, between the desks, at the door ----
    { const [r0, r1] = this.pressRoom(hall), zA = S[0].z, zB = S[1].z, wx = W / 2 - .42;
      this.pressPlants(hall, [
        { kind: 'fig', x: -1.75, z: r1 - .45, h: 1.75 }, { kind: 'fig', x: 1.75, z: r1 - .45, h: 1.55 },
        { kind: 'fig', x: -wx, z: (zA + zB) / 2, h: 1.6 }, { kind: 'snake', x: wx, z: (zA + zB) / 2, h: 1.1, s: 1.15 },
        { kind: 'snake', x: -wx, z: r0 + .9, h: .95, glaze: '#e9e1d2' }, { kind: 'snake', x: wx, z: r0 + .9, h: .95, glaze: '#e9e1d2' },
        { kind: 'snake', x: -wx, z: zA - 1.7, h: .75, r: .13 }, { kind: 'fig', x: wx, z: zA - 1.7, h: 1.3 },
        { kind: 'snake', x: -wx + .05, z: zB + 1.6, h: .8, r: .13, glaze: '#7a4a2e' }, { kind: 'snake', x: wx - .05, z: zB + 1.6, h: .8, r: .13, glaze: '#7a4a2e' },
      ]); }
    // ---- the middle desk, kept clear for Down to Earth; a library carpet under it ----
    (hall.def.slots || []).forEach((sid, k) => { const q = S[hall.def.works.length + k]; this.lectern(g, q.x, q.z, .36, .5, .95, { ry: q.ry, blank: true }); });
    const rug = textTexture((c, w, h) => {
      c.fillStyle = '#1e2a3a'; c.fillRect(0, 0, w, h);
      const band = (m, col) => { c.fillStyle = col; c.fillRect(m, m, w - 2 * m, h - 2 * m); };
      band(w * .035, '#c9a66b'); band(w * .045, '#1e2a3a'); band(w * .1, '#c9a66b'); band(w * .108, '#6b2420');
      c.save(); c.beginPath(); c.rect(w * .108, w * .108, w - w * .216, h - w * .216); c.clip();
      for (let y = 0; y < h; y += w / 12) for (let x = ((y / (w / 12)) % 2) * w / 24; x < w; x += w / 12) { c.fillStyle = 'rgba(201,166,107,.28)'; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 12, y); c.lineTo(x, y + 14); c.lineTo(x - 12, y); c.fill(); }
      c.restore();
      for (const [rx, ry, col] of [[.26, .2, '#c9a66b'], [.245, .188, '#1e2a3a'], [.2, .15, '#6b2420'], [.12, .09, '#c9a66b'], [.105, .078, '#1e2a3a'], [.04, .03, '#c9a66b']]) { c.fillStyle = col; c.beginPath(); c.ellipse(w / 2, h / 2, w * rx, h * ry, 0, 0, 6.29); c.fill(); }   // a plain oval medallion
      for (let k = 0; k < 9000; k++) { c.fillStyle = `rgba(0,0,0,${Math.random() * .06})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }   // the pile
    }, 1024, 1600);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 6.7), new THREE.MeshBasicMaterial({ map: rug, color: new THREE.Color(.9, .86, .82) })); const mid = this.pressRoom(hall).reduce((a, b) => a + b) / 2 - .4; carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, .011, mid); g.add(carpet);
    const cs = this.shadowMesh('rect', 5.2, 7.6, .25); cs.rotation.x = -Math.PI / 2; cs.position.set(0, .009, mid); g.add(cs);
  }

  addPlinth(hall, id, work, i) {
    const { group: g, L } = hall;
    const side = i % 2 ? 1 : -1, idx = Math.floor(i / 2);
    const x = side * 2.4, z = -L / 2 + 6.2 + idx * 6.4;
    const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
    // velvet on the wall behind each plinth
    const vh = HALL_H - 1.0, panel = new THREE.Mesh(curtainGeometry(2.6, vh, 6, .03), this.velvetMat || (this.velvetMat = velvet('#350506')));
    panel.position.set(side * (hall.W / 2 - .04) - x, .35 + vh / 2, 0); panel.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; if (!BAKED) p.add(panel);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 1), this.plinthMat || (this.plinthMat = new THREE.MeshStandardMaterial({ color: '#e9cfa8', roughness: .8, metalness: 0, emissive: '#d9b88c', emissiveIntensity: .22 }))   /* kraft board plinths */);
    base.position.y = .55; p.add(base);
    const ps = this.shadowMesh('rect', 1.75, 1.75, .42); ps.rotation.x = -Math.PI / 2; ps.position.y = .006; p.add(ps);   // contact shadow
    const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1.1, 1)), new THREE.LineBasicMaterial({ color: '#b08a5a', transparent: true, opacity: .0 }));
    rim.position.y = .55;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(.96, 1, .96), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .06, roughness: .05, metalness: .9, depthWrite: false }));
    glass.position.y = 1.62; p.add(glass);
    const gEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.96, 1, .96)), new THREE.LineBasicMaterial({ color: '#fff4e8', transparent: true, opacity: .09 }));
    gEdge.position.y = 1.62; p.add(gEdge);
    // the design itself, as a print standing at the back of the vitrine
    const tex = this.artTexture(id, work);
    const [pw, ph] = this.fit(work.aspect || 1, .82, .82);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), weaveMaterial(tex, this.shared));
    // angled toward visitors walking in, like a label card in a vitrine
    print.position.set(side * .2, 1.62, .26); print.rotation.y = Math.atan2(-side, -1.35); if (!NO_ART) p.add(print);   // (Hall 01 shows the 3D package instead)
    // the object, wrapped in its design
    const def = DESK_ITEMS.find(d => d.id === id) || { shape: 'box', size: [.3, .3, .3] };
    let geo;
    if (def.shape === 'bottle') { const [r, hh] = def.size; geo = new THREE.LatheGeometry([[0, -hh / 2], [r, -hh / 2], [r, hh * .18], [r * .45, hh * .34], [r * .4, hh / 2], [0, hh / 2]].map(([a, b]) => new THREE.Vector2(a, b)), 40); }
    else if (def.shape === 'hex') { const [r, hh] = def.size; geo = new THREE.CylinderGeometry(r, r, hh, 6); }
    else { const [w, hh, d] = def.size; geo = new THREE.BoxGeometry(w, hh, d); }
    const objMat = def.shape === 'bottle'
      ? new THREE.MeshStandardMaterial({ color: '#141010', roughness: .18, metalness: .35, map: tex, emissive: work.color, emissiveIntensity: .06 })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: .55, metalness: .05, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .18 });
    const art = artIn(hall.def.id), real = art && CASE_MODEL[id];
    let obj = new THREE.Mesh(geo, objMat);
    obj.scale.setScalar(1.1); obj.position.set(-side * .16, 1.5, -.16);
    if (real) {
      // the real package, set on the plinth top inside the glass and fitted to the vitrine (never blown up past 3.2x)
      obj = new THREE.Group(); obj.position.set(0, 1.12, 0); p.add(obj);
      this.caseQueue = this.caseQueue || []; this.caseQueue.push({ holder: obj, model: CASE_MODEL[id], side });
    } else if (art) p.add(obj);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.1, .75, 3.6, 32, 1, true), coneMaterial()); cone.position.y = 3.4;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), poolMaterial('#ffe9d6', .22)); pool.rotation.x = -Math.PI / 2; pool.position.y = .01;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.86, .28), letterMat(letterLabel(work, 'center')));   // painted straight onto the plinth, centred
    label.position.set(-side * .501, .78, 0); label.rotation.y = -side * Math.PI / 2; if (artIn(hall.def.id)) p.add(label);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.3, 1.15), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.15; p.add(hit);
    hit.userData = { type: 'work', id, hallId: hall.def.id, plinth: p, obj, size: [1, 1], mat: print.material, z };
    this.interactive.push(hit); hall.exhibits.push(hit);
    this.spinners = this.spinners || []; if (artIn(hall.def.id)) this.spinners.push(obj);
  }
  /* Hall 01's packages: built after the museum is up, one at a time, so the first load stays light */
  /* draw every stop of the walk once, small and off screen: first-draw costs (shader variants, uploads, buffers) are paid before they are seen.
     part 'entry': the way in (the ceiling-cut descent, a variant of every material) and the Rotunda — all the visitor needs to enter.
     part 'rest': every other stop, the showreel; it runs on after the visitor is in, gently, while the halls finish loading behind them. */
  async preWalk(part = 'all') {
    for (let i = 0; i < 40 && !this.journey; i++) await new Promise(r => setTimeout(r, 250));
    const J = this.journey; if (!J) return;
    const stops = J.nodes.filter((n, i) => n.hold || i % 2 === 0);
    // (entry: only the way in; the Rotunda's own stops draw first thing in 'rest', in still moments: drawing them up front cost ~6 s of uploads)
    const mine = part === 'entry' ? [] : stops;
    this.prepAdd(mine.length); this.mark(part === 'rest' ? 'rehearse rest' : 'rehearse');
    const r = this.renderer, rt = new THREE.WebGLRenderTarget(320, 180, { type: THREE.HalfFloatType }), cam = this.camera.clone();
    const ceil = this.ceilings.map(c => c.visible);
    const draw = () => { const prev = r.getRenderTarget(); r.shadowMap.needsUpdate = true; r.setRenderTarget(rt); r.render(this.scene, cam); r.setRenderTarget(prev); };   // shadows too (the Blender hall's spots)
    if (part !== 'rest' && !DEVICE.mobile) {
      // the way in: coming down through the ceiling the museum is drawn with a level cut, a variant of every material of its own;
      // prepare that variant for EVERYTHING (not just what a camera happens to see), then draw the descent once
      this.prepAdd(4);
      // compiled IN PARALLEL (compileAsync): three.js compiles with the clipping state of the last draw, so one empty draw with the cut switches it on.
      // (drawing everything with the cut compiled them one by one: ~7 s on a laptop, far more on a phone)
      try {
        const shown = []; this.scene.traverse(o => { if ((o.isMesh || o.isPoints || o.isLine) && !o.visible) { shown.push(o); o.visible = true; } });
        const prev = r.getRenderTarget(); let job = null;
        r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 7.7)]; r.setRenderTarget(rt);
        r.render(this._emptyScene || (this._emptyScene = new THREE.Scene()), cam);   // (sets the cut as the clipping state)
        cam.position.set(0, 16, .01); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
        try { job = r.compileAsync ? r.compileAsync(this.scene, cam) : null; } catch (e) {}
        r.setRenderTarget(prev); r.clippingPlanes = []; shown.forEach(o => (o.visible = false));
        if (job) await Promise.race([job, new Promise(res => setTimeout(res, 20000))]).catch(() => {});
      } catch (e) { r.clippingPlanes = []; }
      this.prepTick();
      for (const y of [16, 11, 6]) {
        try { r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 7.7)]; cam.position.set(0, y, .01); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); draw(); } catch (e) {} finally { r.clippingPlanes = []; }
        this.prepTick(); await new Promise(res => setTimeout(res, 40));
      }
      this.mark('descent');
    }
    if (part === 'rest') {
      // no drawing now the visitor may be inside: a draw makes the driver finish every compile and upload on the spot (3-5 s freezes, measured).
      // Each room's shaders are compiled IN PARALLEL and awaited (nothing blocks), in walking order; its pictures go to the GPU in idle moments (idleUpload).
      const rooms = [...Object.values(this.halls || {}).sort((a, b) => a.def.k - b.def.k).map(h => h.group), this.backroom?.group, this.desk?.group, this.castle].filter(Boolean);
      this.prepAdd(rooms.length - mine.length);
      for (let k = 0; k < 200 && this.nearCut; k++) await new Promise(res => setTimeout(res, 100));   // (not during the descent: that is the cut variant)
      for (const g of rooms) { await this.compileQuiet(g); this.prepTick(); await new Promise(res => setTimeout(res, 60)); }
    } else for (const n of mine) {
      try { cam.position.copy(n.pos); cam.lookAt(n.look); cam.updateMatrixWorld(); draw(); } catch (e) {}
      this.prepTick(); await new Promise(res => setTimeout(res, 40));
    }
    this.mark(part === 'entry' ? 'rotunda' : 'stops');
    if (part !== 'entry') {
      // (inside: wait for a still moment, standing at a work, where a short pause goes unseen)
      if (this.entered) for (let k = 0; k < 600 && !(this.state === 'exhibit' && this.journey?.seek == null && performance.now() - (this._still || 0) > 900); k++) await new Promise(res => setTimeout(res, 200));
      // the showreel in the Blender hall: its little studio is built, compiled and drawn once now
      this.prepAdd(1); this._reelForce = true;
      for (let i = 0; i < 60 && !(this.reel && this.reel.ok); i++) { try { this.updateReel(performance.now() / 1000); } catch (e) {} await new Promise(res => setTimeout(res, 100)); }
      try { this.updateReel(performance.now() / 1000); } catch (e) {}
      // and every piece drawn into the screen once, each on its own backdrop: compiling alone missed some variants, and the room froze ~0.4 s the first time you walked in
      try { const R = this.reel, r = this.renderer; if (R && R.items && R.ok) { const prev = r.getRenderTarget(), sh = r.shadowMap.autoUpdate, clip = r.clippingPlanes; r.shadowMap.autoUpdate = false; r.clippingPlanes = [];
        for (const it of R.items) { R.items.forEach(x => (x.g.visible = x === it)); if (it.bg) R.sc.background = it.bg; r.setRenderTarget(R.rt); r.render(R.sc, R.cam); }
        r.setRenderTarget(prev); r.shadowMap.autoUpdate = sh; r.clippingPlanes = clip; R.items.forEach(x => (x.g.visible = false)); R.idx = -1; } } catch (e) {}
      this._reelForce = false; this.prepTick(); this.mark('reel');
    }
    this.ceilings.forEach((c, i) => (c.visible = ceil[i])); rt.dispose();
  }
  /* the visitor may come in now: the Rotunda, its light and the way in are ready; the halls keep arriving in walking order */
  markEntry() { if (this.entryReady) return; this.entryReady = true; this.mark('entry'); this.ui.progress && this.ui.progress(1); }
  async makeCaseEnv() { this.makeCaseEnvNow(); }
  makeCaseEnvNow() {   // a soft studio light that only the packages see (the hall itself stays baked), like a lit vitrine
    if (this.caseEnv) return;
    const pm = new THREE.PMREMGenerator(this.renderer); this.caseEnv = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  }
  /* fewer shaders, same picture: a plain-colour material and a pictured one are two different programs to compile (each ~50-100 ms on
     Windows and iPhones). A plain one gets a 1x1 white picture (white x its colour = its colour), so both share one program. */
  pinLights() {   // every light hangs from the scene itself (same place in the world), so hiding a room never hides a light: the count never changes
    this.scene.updateMatrixWorld(true); const ls = [];
    this.scene.traverse(o => { if (o.isLight && o.parent && o.parent !== this.scene && !o.userData.keepParent && !this._lightKeep?.has(o)) ls.push(o); });
    ls.forEach(l => { const t = l.target; this.scene.attach(l); if (t && t.parent && t.parent !== this.scene) this.scene.attach(t); });
  }
  normalizeMaterials(root) {
    if (!root) return; const W = this._white || (this._white = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; })());
    root.traverse(o => { if (!o.isMesh && !o.isSprite) return; for (const m of [].concat(o.material || [])) {
      if (!m || m.userData.noWhite) continue;
      // standard (lit) materials all carry the vitrines' studio light, at zero strength where they had none: same look, and the packages
      // (which arrive after you're in) then reuse these shaders instead of compiling their own in front of you
      if (m.isMeshStandardMaterial && !m.envMap && this.caseEnv && !m.isMeshPhysicalMaterial) { m.envMap = this.caseEnv; m.envMapIntensity = 0; m.needsUpdate = true; }
      if (m.map || !(m.isMeshBasicMaterial || m.isMeshStandardMaterial || m.isSpriteMaterial || m.isMeshLambertMaterial)) continue;
      m.map = W; m.needsUpdate = true; } });
  }
  async compileQuiet(root) {   // one room's shaders, compiled in parallel without showing anything (a hidden room is shown only for the instant the list is made)
    const r = this.renderer; if (!r.compileAsync || !root) return; this.normalizeMaterials(root);
    const shown = []; for (let p = root; p; p = p.parent) if (!p.visible) { shown.push(p); p.visible = true; }
    const prev = r.getRenderTarget(); let job = null;
    try { r.setRenderTarget(this.composer.renderTarget1); job = r.compileAsync(root, this.camera, this.scene); } catch (e) {} finally { r.setRenderTarget(prev); shown.forEach(p => (p.visible = false)); }
    if (job) await Promise.race([job, new Promise(res => setTimeout(res, 15000))]).catch(() => {});
  }
  async compileOnly(objs) {
    for (const o of objs) this.normalizeMaterials(o);
    if (this.entered) { for (const o of objs) await this.compileQuiet(o); return; }   // the visitor is inside: never switch the culling off
    this.zonesShowAll(6000);   // prepare these objects' shaders off the main thread, lit as the museum lights them
    const r = this.renderer; if (!r.compileAsync) return;
    for (const o of objs) { try { const prev = r.getRenderTarget(); r.setRenderTarget(this.composer.renderTarget1); const job = r.compileAsync(o, this.camera, this.scene); r.setRenderTarget(prev); await job; } catch (e) {} await new Promise(res => setTimeout(res, 30)); }   // (for the effect buffer the museum is really drawn into, as warmUp does)
  }
  async fillCases() {
    if (this.casesFilling || !this.caseQueue?.length) return; this.casesFilling = true;
    const [{ buildProduct }, { RoomEnvironment }] = await Promise.all([loadProducts(), import('three/addons/environments/RoomEnvironment.js')]);
    // a soft studio light that only the packages see (the hall itself stays baked), like a lit vitrine
    this.makeCaseEnvNow();
    for (const { holder, model, side, fixed, bright } of this.caseQueue) {
      try {
        const m = await buildProduct(model, this.renderer, 'trials/');
        if (fixed) {   // not in a vitrine: shown at a set size (Hall 01's hanger box on the clothes rail)
          m.scale.setScalar(fixed); m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; [].concat(o.material).forEach(mt => { if ('envMap' in mt) { mt.envMap = this.caseEnv; mt.envMapIntensity = bright || 1.25; mt.needsUpdate = true; } }); } });
          holder.add(m); await new Promise(r => setTimeout(r, 30)); continue;
        }
        // fit each package to the vitrine (small ones are shown larger than life: up to 4.5x, the pocket matchbox 7x)
        const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3());
        const k = Math.min((model === 'cheese_open' ? .86 : .7) / Math.max(s.x, s.z), .78 / s.y, model === 'matches' ? 7 : 4.5);
        m.scale.setScalar(k); m.rotation.y = side * .5;
        if (model === 'matches') { m.rotation.set(-1.0, 0, 0); m.position.set(0, .15, .05); }   // the flat pocket box leans up like it sits on a stand, label to the visitor
        // where the package really is (for the camera and the focus): its middle, and whether it is a flat one to look down on
        const hgt = model === 'matches' ? .3 : s.y * k;
        holder.userData.mid = new THREE.Vector3(0, hgt / 2 + (model === 'matches' ? .05 : 0), 0); holder.userData.flat = hgt < .3;
        m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false;
          [].concat(o.material).forEach(mt => { if ('envMap' in mt) { mt.envMap = this.caseEnv; mt.envMapIntensity = 1.25; mt.needsUpdate = true; } }); } });
        holder.add(m);
      } catch (e) { console.warn('case model', model, e); }
      await new Promise(r => setTimeout(r, 30));   // a breath between packages: no long freeze
    }
  }

  buildBackroom() {
    const L = 16, W = 16;
    const g = this.hallGroup(BACKROOM.k, L, W);
    this.shell(g, L, W, 6.5);
    this.buildVein(BACKROOM.k, R0 + L / 2 - 2.2);
    g.updateMatrixWorld(true);
    this.backroom = { group: g, L, W, a: angleOf(BACKROOM.k) };
    // back room sits straight ahead on +z, so the desk can use world axes
    const origin = new THREE.Vector3(-3.0, 0, R0 + L / 2);   // the desk on the right; the castle stands on the left
    this.desk = new Desk(this.scene, origin);
    { // the castle's lights exist from the start (the castle itself arrives later): a key with shadows, a warm fill, a cool rim
      const at = this.castleAt = new THREE.Vector3(3.3, 0, origin.z + 4.0), tgt = new THREE.Object3D(); tgt.position.copy(at).setY(2.2); this.scene.add(tgt);
      const key = new THREE.SpotLight('#ffe2c0', 34, 16, .45, .55, 1.2); key.position.set(at.x - 3.2, 6.3, at.z - 3.4); key.target = tgt;
      key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0008; this.scene.add(key);
      const fill = new THREE.SpotLight('#ffcf9a', 14, 16, .5, .8, 1.2); fill.position.set(at.x + 3.4, 6.3, at.z - 2.4); fill.target = tgt; this.scene.add(fill);
      const rim = new THREE.SpotLight('#9fb6ff', 8, 12, .6, .8, 1.2); rim.position.set(at.x, 6.3, at.z + 2.6); rim.target = tgt; this.scene.add(rim);
    }
    // a red neon sign on the far wall, handwritten-ish, that flickers on as you come in
    {
      const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const x = c.getContext('2d');
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `italic 400 250px ${ITALIC}`;
      x.shadowColor = '#ff2a1a'; x.shadowBlur = 60; x.fillStyle = '#ff3b28'; x.fillText('thanks for looking', 1024, 250);
      x.shadowBlur = 18; x.fillText('thanks for looking', 1024, 250);
      x.shadowBlur = 0; x.fillStyle = '#ffd9cf'; x.font = `italic 400 244px ${ITALIC}`; x.fillText('thanks for looking', 1024, 250);   // the bright core of the tube
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const neon = this.neon = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(0, 0, 0) }));
      neon.scale.setScalar(.48); neon.position.set(origin.x, 6.0, R0 + L - .3); neon.rotation.y = Math.PI; this.scene.add(neon);
      const glow = this.neonGlow = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), poolMaterial('#ff2a1a', 0)); glow.scale.setScalar(.48); glow.position.set(origin.x, 6.0, R0 + L - .32); glow.rotation.y = Math.PI; this.scene.add(glow);
      this.neonOn = 0;
    }
    this.desk.spot.shadow.mapSize.set(this.Q.shadowMap, this.Q.shadowMap);
    this.buildReel(origin, R0 + L);
  }

  /* dust drifting through the light, like a real museum at night */
  buildDust() {
    const n = this.Q.dust, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    const rooms = [...HALLS.map(h => this.halls[h.id]), this.backroom];
    for (let i = 0; i < n; i++) {
      const room = i < n * .45 ? null : rooms[i % rooms.length];
      let p;
      if (!room) { const a = Math.random() * Math.PI * 2, rr = CH_R + 1 + Math.random() * (R - CH_R - 2); p = dir(a).multiplyScalar(rr).setY(.3 + Math.random() * 8.5); }
      else p = this.hallPoint(room, (Math.random() - .5) * (room.W - 1), .3 + Math.random() * 5.5, (Math.random() - .5) * (room.L - 1));
      pos.set([p.x, p.y, p.z], i * 3); seed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.shared.uTime, uPx: { value: this.pr } },
      vertexShader: `attribute float seed; uniform float uTime, uPx; varying float vA;
        void main(){ vec3 p=position; float t=uTime*.12+seed;
          p+=vec3(sin(t*1.3)*.35, sin(t*.7)*.25, cos(t*1.1)*.35);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          vA=(.35+.65*pow(.5+.5*sin(uTime*1.4+seed*3.),3.))*smoothstep(26.,4.,-mv.z);
          gl_PointSize=uPx*(14./-mv.z)*(1.+fract(seed)*1.5); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(1.,.55,.4)*.5,smoothstep(.5,0.,d)*vA*.55); }`,
    }));
    pts.frustumCulled = false; this.dust = pts;   // (floating dust: not in the scene, invisible on white)
  }

  /* a brass & crystal chandelier: column, two tiers of arms, candles with flames, crystal drops */
  /* a soft round light texture (white centre fading out), shared by glows and light pools */
  softTex() {
    if (this._soft) return this._soft;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); return (this._soft = new THREE.CanvasTexture(c));
  }
  /* soft contact shadows (drawn once, reused): a blurred rectangle and a round blob */
  shadowTex(kind) {
    this._shadow = this._shadow || {};
    if (this._shadow[kind]) return this._shadow[kind];
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    if (kind === 'rect') { x.filter = 'blur(22px)'; x.fillStyle = '#000'; x.fillRect(48, 48, 160, 160); }
    else { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
    const t = new THREE.CanvasTexture(c); return (this._shadow[kind] = t);
  }
  shadowMesh(kind, w, h, opacity) {
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.shadowTex(kind), color: '#2a2018', transparent: true, opacity, depthWrite: false }));
  }

  /* gallery wall lettering: the name, the category in italic, one line about it (black vinyl on the wall) */
  wallText(work, hall, n, width = 1.25) {
    const H = width * .9;
    const tex = textTexture((x, w, hh) => {
      const pad = w * .02; x.textAlign = 'left';
      x.fillStyle = '#c8261b'; x.font = `italic 400 ${hh * .085}px ${ITALIC}`;
      x.fillText(`hall ${hall.num} · ${String(n).padStart(2, '0')}`, pad, hh * .1);
      x.fillStyle = '#111'; let fs = hh * .17; x.font = `800 ${fs}px ${SANS}`; x.letterSpacing = `${-fs * .045}px`;
      const title = work.title.toLowerCase().split(':')[0];
      while (x.measureText(title).width > w - pad * 2 && fs > hh * .07) { fs *= .92; x.font = `800 ${fs}px ${SANS}`; x.letterSpacing = `${-fs * .045}px`; }
      x.fillText(title, pad, hh * .1 + fs * 1.05);
      x.letterSpacing = '0px';
      x.fillStyle = '#c8261b'; x.font = `italic 400 ${hh * .07}px ${ITALIC}`; x.fillText(work.cat.toLowerCase(), pad, hh * .1 + fs * 1.05 + hh * .1);
      x.fillStyle = '#222'; x.font = `400 ${hh * .052}px ${SANS}`;
      const words = (work.desc || '').split(' '); let line = '', y = hh * .1 + fs * 1.05 + hh * .21;
      for (const wd of words) {
        const t = line ? line + ' ' + wd : wd;
        if (x.measureText(t).width > w - pad * 2) { x.fillText(line, pad, y); line = wd; y += hh * .075; if (y > hh * .95) break; } else line = t;
      }
      if (y <= hh * .95) x.fillText(line, pad, y);
    }, 1024, Math.round(1024 * .9));
    return new THREE.Mesh(new THREE.PlaneGeometry(width, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  }
  /* a small engraved brass plaque: hall · place (the work's own label arrives with the art) */
  plaque(hallNum, n) {
    const key = `${hallNum}-${n}`;
    const tex = textTexture((x, w, hh) => {
      x.fillStyle = '#fbfaf8'; x.fillRect(0, 0, w, hh);
      x.fillStyle = '#c8261b'; x.textAlign = 'left';
      x.font = `600 40px ${SANS}`; x.fillText(`hall ${hallNum}`, 34, 70);
      x.fillStyle = '#111'; x.font = `800 120px ${SANS}`; x.fillText(String(n).padStart(2, '0'), 30, 205);
      x.fillRect(0, hh - 6, w, 6);
    }, 512, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.36, .18), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(.95, .9, .82) }));
    m.userData.plaque = key; return m;
  }
  /* each hall gets a velvet rope before its niche and soft beams of dusty light from the coffers */
  hallProps(g, h, L, W) {
    // ---- the red end wall: the hall's name, huge, in white ----
    const endTex = textTexture((x, w, hh) => {
      // clean: a huge thin red number, the name heavy in black right under it (nothing else)
      const name = h.title.toLowerCase().split(' ')[0];
      x.textAlign = 'left'; x.fillStyle = '#c8261b';
      x.font = `200 ${hh * .42}px ${SANS}`; x.letterSpacing = `${-hh * .02}px`; x.fillText(h.num, w * .055, hh * .5);
      let fsz = hh * .2; x.font = `800 ${fsz}px ${SANS}`; x.letterSpacing = `${-fsz * .05}px`;
      while (x.measureText(name).width > w * .89) { fsz *= .93; x.font = `800 ${fsz}px ${SANS}`; x.letterSpacing = `${-fsz * .05}px`; }
      x.fillStyle = '#111'; x.fillText(name, w * .06, hh * .5 + fsz * 1.02);
    }, 1400, 1100);
    const endWall = new THREE.Mesh(new THREE.PlaneGeometry(W - .02, HALL_H - .02), new THREE.MeshBasicMaterial({ map: endTex, transparent: true, depthWrite: false }));
    endWall.position.set(0, HALL_H / 2, L / 2 - .14); endWall.rotation.y = Math.PI;   // (the names now stand over the arches in the rotunda: the end walls stay clear)   // (a runway hall has its backdrop there)   // the hall's name, on the flat end wall
    // ---- a running strip along both walls, high up: the hall's name on repeat ----
    {
      const c = document.createElement('canvas'), x = c.getContext('2d'), word = h.title.toLowerCase().split(' ')[0] + ' ';
      const f = `800 300px ${SANS}`; x.font = f; x.letterSpacing = '-14px';
      const ww = Math.ceil(x.measureText(word).width); c.width = ww; c.height = 380;
      x.fillStyle = '#b4231b'; x.fillRect(0, 0, ww, 380); x.fillStyle = '#0d0d0d'; x.font = f; x.letterSpacing = '-14px'; x.fillText(word, 0, 300);
      const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const SH = .62, len = L - .4;
      for (const sx of [-1, 1]) {
        const t = tex.clone(); t.needsUpdate = true; t.repeat.x = len / (SH * ww / 380);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, SH), new THREE.MeshBasicMaterial({ map: t }));
        m.position.set(sx * (W / 2 - .015), HALL_H - .9, 0); m.rotation.y = -sx * Math.PI / 2; g.add(m);
        (this.hallStrips = this.hallStrips || []).push({ t, dir: sx });
      }
    }
    // ---- a bold black line where the floor meets the walls ----
    const ink = this.inkMat || (this.inkMat = new THREE.MeshBasicMaterial({ color: '#161616' }));
    for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(L - .3, .16), ink); b.position.set(sx * (W / 2 - .012), .08, 0); b.rotation.y = -sx * Math.PI / 2; g.add(b); }
    const brass = this.inkMat || (this.inkMat = new THREE.MeshBasicMaterial({ color: '#161616' }));
    const ropeM = this.ropeMat || (this.ropeMat = new THREE.MeshBasicMaterial({ color: '#c8261b' }));
    const zr = L / 2 - 1.05, posts = (h.stage === 'runway' || h.id === 'redesign' || h.id === 'packaging' || h.id === 'identity') && artIn(h.id) ? [] : [-1.7, 0, 1.7];   // (Hall 05's end wall is its vault door)
    for (const x of posts) {
      const post = new THREE.Group(); post.position.set(x, 0, zr); g.add(post);
      const sh = this.shadowMesh('blob', .7, .7, .35); sh.rotation.x = -Math.PI / 2; sh.position.y = .006; post.add(sh);
      post.add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .19, .05, 32), brass));                       // base
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .9, 16), brass); col.position.y = .47; post.add(col);
      const top = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), brass); top.position.y = .95; post.add(top);
    }
    for (let i = 0; i < posts.length - 1; i++) {                                                          // the rope sags between posts
      const a = new THREE.Vector3(posts[i], .9, zr), b = new THREE.Vector3(posts[i + 1], .9, zr), m = a.clone().lerp(b, .5).setY(.62);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 32, .012, 8), ropeM));
    }
    // dusty light falling from the glowing coffers, between the chandeliers
    for (const [x, z] of [[-W / 4, -L / 8], [W / 4, L / 8], [-W / 5, L * .36], [W / 5, -L * .36]]) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, 1.0, HALL_H - .2, 32, 1, true), coneMaterial());
      beam.material.uniforms.uI.value = .0; beam.material.uniforms.uColor.value.set('#fff1dc');
      beam.position.set(x, (HALL_H - .2) / 2, z); beam.rotation.z = x > 0 ? -.06 : .06;
    }
  }
  makeChandelier(arms = 8, size = 1) {
    const g = new THREE.Group();
    const M = this.chMats || (this.chMats = {
      brass: new THREE.MeshStandardMaterial({ color: '#c49a5c', roughness: .25, metalness: 1, emissive: '#3a2410', emissiveIntensity: .35 }),
      candle: new THREE.MeshStandardMaterial({ color: '#efe6d4', roughness: .6, emissive: '#ffe0b0', emissiveIntensity: .25 }),
      flame: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc884').multiplyScalar(3.2) }),
      crystal: new THREE.MeshStandardMaterial({ color: '#fff6ee', roughness: .02, metalness: .9, transparent: true, opacity: .85, emissive: '#ffd9b0', emissiveIntensity: .15 }),
    });
    // a halo pendant: one slim cable, a wide ring of light in a thin black rim, a frosted disc glowing inside, a soft halo around it
    const ink = this.inkMat || (this.inkMat = new THREE.MeshBasicMaterial({ color: '#161616' }));
    const lit = this.ringLit || (this.ringLit = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e6').multiplyScalar(2.2) }));
    const R1 = .78 * size, y = .1 * size;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R1, .03 * size, 10, 128), ink); rim.rotation.x = Math.PI / 2; rim.position.y = y + .02; g.add(rim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R1 - .012, R1 - .012, .035 * size, 128, 1, true), lit); band.position.y = y - .012; g.add(band);   // the light, facing inward and down
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R1 - .03, 64), new THREE.MeshBasicMaterial({ map: this.softTex(), color: new THREE.Color('#fff6ec').multiplyScalar(1.5), transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = Math.PI / 2; disc.position.y = y - .005; g.add(disc);                                           // a frosted diffuser
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.softTex(), color: new THREE.Color('#ffe2c2'), transparent: true, opacity: .38, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(R1 * 4.2, R1 * 2.4, 1); halo.position.y = y - .05; g.add(halo);                                    // the glow around it
    for (let i = 0; i < 3; i++) {                                                                                      // three fine wires to the cable
      const a = i / 3 * Math.PI * 2, w = new THREE.Vector3(Math.cos(a) * R1, y + .03, Math.sin(a) * R1), top = new THREE.Vector3(0, 1.3 * size, 0);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, w.distanceTo(top), 4), ink);
      wire.position.copy(w).lerp(top, .5); wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(w).normalize()); g.add(wire);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .08, 16), ink); hub.position.y = 1.3 * size; g.add(hub);
    g.userData.sway = Math.random() * 6; (this.chandeliers = this.chandeliers || []).push(g);
    return g;
  }

  /* warm-up: compile every shader and render a few frames while the intro is still on screen,
     so stepping through the eye never pays for it mid-flight */
  warmUp(again) {
    // prepare every shader in PARALLEL (KHR_parallel_shader_compile via compileAsync): nothing blocks the page.
    // The old synchronous compile froze the intro for ~5 s on built-in graphics.
    if (this._warm && !again) return; this._warm = true; this.makeCaseEnvNow(); this.normalizeMaterials(this.scene);
    this.pinLights();   /* (before anything is compiled: a light inside a room that is hidden for a moment changes the light count, and every lit shader recompiles) */
    this.zonesShowAll(8000); if (this.halls && this.backroom) { this.portalCards(); this.archLinings(); this.archLiningColours(); this.keyColours(); }
    const r = this.renderer, cam = this.camera;
    const shown = [];
    this.scene.traverse(o => { if ((o.isMesh || o.isPoints || o.isLine) && !o.visible) { shown.push(o); o.visible = true; } });   // hidden things too
    const post = new THREE.Scene(), quad = new THREE.PlaneGeometry(1, 1);
    for (const pass of this.composer.passes) {
      const mats = [pass.material, pass.fsQuad && pass.fsQuad.material, pass.copyMaterial, pass.blendMaterial, pass.materialHighPassFilter, pass.compositeMaterial, ...(pass.separableBlurMaterials || [])].filter(Boolean);
      for (const m of mats) post.add(new THREE.Mesh(quad, m));
    }
    const finish = () => {

      shown.forEach(o => (o.visible = false));
      // then send every texture to the GPU, a few per idle moment
      const texs = new Set();
      this.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k of ['map', 'emissiveMap']) if (m[k] && m[k].image) texs.add(m[k]); for (const m of ms) if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture && u.value.image) texs.add(u.value); });
      const list = [...texs], idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 800 }) : setTimeout(f, 60));
      const views = [[new THREE.Vector3(0, 19, .01), new THREE.Vector3(0, 0, 0)], [this.ringPose(angleOf(1), 0).pos, this.ringPose(angleOf(1), 0).look]];
      const firstFrames = () => {                            // the first full draws (buffers, texture checks) and the weave's colour reading:
        try {                                                 // done now, behind the loading hairline, one view per quiet moment (together they froze the opening ~2.5 s)
          if (this.weave && this.weave.phase === 'wait') this.weave.start();
          const p = cam.position.clone(), q = cam.quaternion.clone(), [pos, look] = views.shift();
          cam.position.copy(pos); cam.lookAt(look); cam.updateMatrixWorld(); this.composer.render();
          cam.position.copy(p); cam.quaternion.copy(q); cam.updateMatrixWorld();
        } catch (e) { console.warn('[NavGod] warm-up', e); }
        if (views.length) return idle(firstFrames);
        this.ready = true; this._readyResolve && this._readyResolve(); this.prepReport && this.prepReport();
      };
      const step = () => { idle(firstFrames); list.forEach(t => this.idleUpload && this.idleUpload(t)); };   // ready as soon as the first frames are drawn; the pictures follow in quiet moments
      idle(step);
    };
    // compile the exact variants used at run time: the scene is drawn into the effect buffers (no tone mapping, linear),
    // the effects into buffers and the last one to the screen
    const rt = this.composer.renderTarget1, prev = r.getRenderTarget(), jobs = [];
    if (r.compileAsync) {
      r.setRenderTarget(rt); jobs.push(r.compileAsync(this.scene, cam), r.compileAsync(post, cam));
      r.setRenderTarget(null); jobs.push(r.compileAsync(post, cam), r.compileAsync(this.scene, cam));
      r.setRenderTarget(prev);
    } else { r.setRenderTarget(rt); r.compile(this.scene, cam); r.setRenderTarget(prev); }
    Promise.all(jobs).then(finish, finish);
  }

  /* the rooms, built and lit in Blender: each mesh wears its own baked light */
  async loadBaked() {
    this._pre = ['rot_shell', 'rot_floor', 'cp_shell'].map(n => { const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async'; i.src = mob(`assets/museum/bake_${n}.jpg`); return i; });   // (phones/tablets: the lighter copy)   // the Rotunda's own light starts downloading now, alongside the building
    const gltf = await new GLTFLoader().loadAsync('assets/museum/museum-glb.wasm')   /* .glb is not a servable type on the preview host: same file, served as .wasm */;
    this.mark('building'); await this.hallsBuilt; this.mark('halls built');   // the baked shells are handed to halls that must exist
    const gain = new THREE.Color(1.02, 1.0, .98);   // the greige edition: let the baked tones show, not blow out
    const jobs = [], later = [], preJobs = []; let rotLeft = 0;
    // the Rotunda's light loads first (it is what you see); the halls follow quietly in the background
    const hallLoader = window.createImageBitmap ? new THREE.ImageBitmapLoader(new THREE.LoadingManager()).setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none' }) : new THREE.ImageLoader(new THREE.LoadingManager());   // decoded off the main thread
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const isRot = o.name.startsWith('rot_') || o.name.startsWith('cp_');
      if (isRot) rotLeft = (rotLeft || 0) + 1;
      const pre = isRot && this._pre?.find(i => i.src.includes(`/bake_${o.name}.`));   // the Rotunda's light was already downloading: use that copy (asking again fetched every byte twice)
      let tex;
      if (pre) { tex = new THREE.Texture(); preJobs.push(new Promise(res => { const done = () => { tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();   // (set before the upload: an already-loaded image arrives at once, before the lines below run)
          tex.image = pre; tex.needsUpdate = true; try { this.renderer.initTexture(tex); } catch (e) {} res(); };
        (pre.decode ? pre.decode() : Promise.resolve()).then(done, () => (pre.complete && pre.naturalWidth ? done() : res())); })); rotLeft--; }   // (decoded off the main thread first: uploading an undecoded picture decodes it on the spot)
      else tex = isRot ? this.loader.load(`assets/museum/bake_${o.name}.jpg`, t => { try { this.renderer.initTexture(t); } catch (e) {} if (--rotLeft <= 0) this.openGate(); }, undefined, () => this.openGate()) : new THREE.Texture();
      if (!isRot) this.prepAdd();
      if (!isRot) later.push(() => new Promise(r => hallLoader.load(`assets/museum/bake_${o.name}.jpg`, img => { this.prepTick();
        tex.image = img; tex.needsUpdate = true; o.material.userData.loaded = true;
        this.idleUpload(tex);   // to the GPU in a quiet moment, not mid-animation
        r();
      }, undefined, () => { this.prepTick(); r(); })));
      tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const floor = o.name.endsWith('_floor');
      if (o.name === 'rot_shell') {   // the stone sills under the arches sit a hair above the halls' floors and showed through as white dashes: sink them under
        const q = o.geometry.attributes.position, wv = new THREE.Vector3(); o.updateMatrixWorld();
        for (let i = 0; i < q.count; i++) { wv.fromBufferAttribute(q, i).applyMatrix4(o.matrixWorld); if (wv.y > -.06 && wv.y < .035 && Math.hypot(wv.x, wv.z) > 14.6) q.setY(i, q.getY(i) - .08 / Math.max(1e-6, o.matrixWorld.elements[5])); }
        q.needsUpdate = true; o.geometry.computeBoundingSphere();
        // the skirting's top ring runs on straight across every doorway and red niche: seen edge-on it broke into white dashes. Drop it.
        const idx = o.geometry.index, keep = [], A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
        for (let t = 0; t < idx.count; t += 3) {
          A.fromBufferAttribute(q, idx.getX(t)).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(q, idx.getX(t + 1)).applyMatrix4(o.matrixWorld); Cc.fromBufferAttribute(q, idx.getX(t + 2)).applyMatrix4(o.matrixWorld);
          const ring = [A, B, Cc].every(v => Math.abs(v.y - .4) < .012 && Math.hypot(v.x, v.z) > 14.9 && Math.hypot(v.x, v.z) < 15.02);
          if (!ring) keep.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
        }
        o.geometry.setIndex(keep);
      }
      o.material = new THREE.MeshBasicMaterial({ map: tex, color: gain.clone() });
      if (isRot) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -1; o.material.polygonOffsetUnits = -4; }   // shared doorway faces: no flicker
      if (!o.name.startsWith('rot_')) o.material.color.multiplyScalar(.92);
      if (o.name.startsWith('campaigns_') && artIn('campaigns')) o.material.color.multiply(floor ? new THREE.Color(.46, .52, .44) : new THREE.Color(.5, .6, .52));   // the runway hall: green-grey, like a clearing under trees
      if (o.name.startsWith('packaging_') && artIn('packaging') && !floor) o.material.color.multiply(new THREE.Color(.7, .5, .32));   // kraft board walls (deep enough for white dielines to read)
      if (o.name.startsWith('redesign_') && artIn('redesign') && !floor) o.material.color.multiply(new THREE.Color(1.05, 1.0, .9));   // a cream marble hall
      if (o.name.startsWith('editorial_') && artIn('editorial')) o.material.color.multiply(floor ? new THREE.Color(.95, .74, .52) : new THREE.Color(.9, .78, .62));   // a reading room after hours: warm walls, a honey floor
      if (floor && !o.name.startsWith('rot_')) o.material.color.multiplyScalar(.68);   // grey concrete should read grey, not white
      if (o.name.includes('lanterns')) o.material.color.multiply(new THREE.Color(1.22, 1.08, .9));   // paper lanterns: a warm glow
      else if (!floor) o.material.color.multiply(new THREE.Color(.93, .89, .84));   // walls: warm greige, never paper-white
      o.material.userData.gain = o.material.color.clone();
      if (o.name === 'editorial_shell') { this.edShell = o; this.clearBench(); }
      if (o.name === 'identity_shell' && artIn('identity')) this.dropBaked(o, this.halls.identity, [-.5, .5, -.8, 1.6]);   // Hall 02's floor is split down the middle: no bench across the line
      if (o.name === 'redesign_shell' && artIn('redesign')) this.dropBaked(o, this.halls.redesign, [-.5, .5, -.8, 1.6]);   // Hall 05 brings its own bank bench
      const room = isRot ? 'rot' : o.name.split('_')[0];
      (this.bakedMats = this.bakedMats || {})[room] = [...(this.bakedMats?.[room] || []), o.material];
      if (floor && this.Q.reflect) { o.material.transparent = true; o.material.opacity = .9; o.material.depthWrite = false; this.floorOverlays.push(o); o.renderOrder = 1; }   // ~10% reflection: a soft sheen, not a mirror
      o.material.userData.fade = isRot ? 1 : 0; o.material.userData.loaded = isRot;
    });
    this.scene.add(gltf.scene); this.bakedScene = gltf.scene;
    { const shells = {}; gltf.scene.traverse(o => { if (o.isMesh && o.name.endsWith('_shell')) shells[o.name.slice(0, -6)] = o; });
      for (const h of Object.values(this.halls)) if (shells[h.def.id]) try { this.hallShade(h, shells[h.def.id]); } catch (e) { console.warn('[NavGod] shade', e); } }
    buildLanterns(this.scene, 'assets/museum/lanterns.json', this.halls, TIME).then(m => (this.lanternMeshes = m));   // live paper lanterns, where the baked light comes from
    const cp = gltf.scene.getObjectByName('cp_shell'); if (cp && this.redRoom) { this.redRoom.add(cp); cp.position.set(0, 0, 0); cp.rotation.set(0, 0, 0); cp.scale.set(1, 1, 1); }   // the drum turns with its doorway, in the room's own frame (so the two openings always line up)
    // once the Rotunda is in, fetch the halls two at a time
    THREE.DefaultLoadingManager.onLoad = () => { 
      if (this._rotIn) return; this._rotIn = true;
      this.ui.progress && this.ui.progress(.25); this.prepReport();   // the rotunda is in: a quarter of the way
      this.warmUp();
      startHalls();
      // the way in and the Rotunda are prepared first: then the visitor may enter (~5-7 s), and everything else keeps coming in behind them
      this._entryP = (async () => { await new Promise(r => setTimeout(r, 60)); await this.preWalk('entry');
        await this.makeCaseEnv();   // (the vitrines' studio light: 1.3 s of drawing, made now rather than after you're in)
        // every room's shaders, compiled in parallel and awaited BEFORE entry: compiling after entry froze the walk 3-5 s (measured)
        for (const g of [...Object.values(this.halls || {}).sort((a, b) => a.def.k - b.def.k).map(h => h.group), this.backroom?.group].filter(Boolean)) await this.compileQuiet(g);
        this.mark('compiled'); })();   // (entry waits for everything: whatever is left until after entry freezes the walk, measured. The Enter button lights at allReady)
    };
    if (preJobs.length) Promise.all(preJobs).then(() => { if (rotLeft <= 0) this.openGate(); if (!THREE.DefaultLoadingManager.itemsLoading) THREE.DefaultLoadingManager.onLoad(); else setTimeout(() => THREE.DefaultLoadingManager.onLoad(), 0); });   // the preloaded Rotunda light is in: carry on (it never went through the loading manager, so its 'all loaded' would not come)
    const startHalls = () => {
      if (this._hallsQueued) return; this._hallsQueued = true;
      (async () => { while (later.length) await Promise.all(later.splice(0, 2).map(f => f())); this.prepPart(); })();   // (no second full warm-up: the bakes add no new shaders, and idleUpload already sends them to the GPU)
      // the packages in Hall 01's vitrines come first, straight after loading and alongside the hall textures (they must be there before anyone walks in)
      (async () => {
        this.prepAdd(4);
        await this.readyP; await new Promise(r => setTimeout(r, 200));
        await this.fillCases(); this.prepTick(); await this.compileOnly((this.caseQueue || []).map(q => q.holder)); this.prepTick();   // just the new packages' shaders, in parallel
        await this.fillDesk(); this.prepTick();
        this.mergeExtras();   // the Rotunda's halo, the castle and the back room's still props: one mesh per finish (~200 fewer draws), before anything is compiled or rehearsed
        { const its = this.desk?.items || []; its.forEach(it => { it.mesh.visible = true; if (it.ghost) it.ghost.visible = true; });   // the desk's things show as ghosts until you've seen their hall: prepare the solid ones too (they froze the room ~1.5 s on arrival)
          await this.compileOnly([this.desk?.group, this.castle].filter(Boolean)); this.desk?.setVisited(this.visited); }
        this.prepTick();   // the Blender hall too
        await this._entryP;   // (the way in first)
        await this.preWalk('rest');   // then a quiet rehearsal of the rest of the walk (after the visitor is in: one still moment at a time)
        // CenterPiece (its page parse blocks ~0.6 s) loads now too, behind the loading screen (laptops; phones load it on the flight in)
        if (!this.entered && LOOM && this.ui.centerpiece && !DEVICE.mobile && !this._cpLoading) { this._cpLoading = true;
          try { await Promise.race([this.ui.centerpiece.preload(), new Promise(res => setTimeout(res, 15000))]); } catch (e) {}
          await new Promise(res => setTimeout(res, 800)); this.ui.centerpiece.sleep?.(this.state !== 'centerpiece'); this.mark('centerpiece'); }
        this.prepPart(); this.cpWhenStill(); })();
    };
    setTimeout(startHalls, 6000);   // in case everything was already cached
    this.ui.loaded && this.ui.loaded();
  }

  /* =========================================================
     THE JOURNEY: one continuous path you scroll along
     Rotunda -> each hall (past every work) -> out -> next hall ... -> Back Room -> the red room.
     Scroll = walk (with momentum); the path settles gently at each stop.
     ========================================================= */
  buildJourney() {
    const nodes = [], add = (pos, look, kind, place, extra = {}) => nodes.push({ pos: pos.clone(), look: look.clone(), kind, place, ...extra });
    const order = [...HALLS].sort((a, b) => a.k - b.k);
    const ringAt = a => this.ringPose(a, 0);
    const inner = (a, lookAt) => add(dir(a).multiplyScalar(8.2).setY(EYE), lookAt, 'move', 'rotunda');
    order.forEach((hd, idx) => {
      const hall = this.halls[hd.id], a = hall.a, r = ringAt(a);
      add(r.pos, r.look, 'rotunda', 'rotunda', { hold: true, facing: hd.id });
      add(this.hallPoint(hall, 0, EYE, -hall.L / 2 + 1.3), this.hallPoint(hall, 0, EYE, hall.L / 2), 'hall', hd.id);
      const ex = [...hall.exhibits].sort((p, q) => p.userData.z - q.userData.z);
      for (const o of ex) { const pose = this.exhibitPose(o); add(pose.pos, pose.look, 'exhibit', hd.id, { hold: !o.userData.pass, work: o.userData.id, obj: o, focus: pose.focus, zoom: pose.zoom }); }   // (a pass point only shapes the walk)
      // leaving: from the last work, turn toward the door while stepping into the middle of the hall, then walk straight out
      // (a separate "step back, look down the hall" view showed the end wall a second time)
      { const g = hall.group; g.updateMatrixWorld(); const lastW = nodes[nodes.length - 1].pos, lz = g.worldToLocal(lastW.clone()).z;
        const tz = clamp(lz - 1.6, -hall.L / 2 + 4.5, hall.L / 2 - 2.5);
        add(this.hallPoint(hall, 0, EYE, tz), this.hallPoint(hall, 0, EYE, tz - 9), 'hall', hd.id); }   // turned round, the door ahead
      add(this.hallPoint(hall, 0, EYE, -hall.L / 2 + 2.2), this.hallPoint(hall, 0, EYE, -hall.L / 2 - 6), 'hall', hd.id);
      const next = order[idx + 1] ? this.halls[order[idx + 1].id].a : this.backroom.a;
      inner(a, ringAt(next).look);
    });
    // the back room: the recap desk
    { const r = ringAt(this.backroom.a); add(r.pos, r.look, 'rotunda', 'rotunda', { hold: true, facing: 'backroom' });
      const deskC = this.desk.origin.clone().setY(1.05), cam = this.desk.origin.clone().add(new THREE.Vector3(0, 3.5, -4.4));
      const z0 = this.desk.origin.z, cz = this.castleAt ? this.castleAt.z : z0 + 4, dx = this.desk.origin.x;
      add(new THREE.Vector3(0, EYE, z0 - 6.6), new THREE.Vector3(0, 2.4, z0 + 4), 'backroom', 'backroom');                                   // through the door
      add(new THREE.Vector3(-.4, 2.3, z0 - 2.6), new THREE.Vector3(3.3, 2.9, cz), 'backroom', 'backroom', { hold: true, zoom: 50 });        // turn left: the castle
      add(new THREE.Vector3(dx + .5, 2.45, z0 - 2.7), new THREE.Vector3(dx, 1.0, z0 + .25), 'backroom', 'backroom', { hold: true, zoom: 52 });   // turn right: the packages and books on the desk
      add(new THREE.Vector3(dx, 3.0, z0 + 1.6), new THREE.Vector3(dx, 3.45, z0 + 8), 'backroom', 'backroom', { hold: true, zoom: 44 });               // the showreel on the end wall
      add(new THREE.Vector3(0, EYE, z0 - 2.8), new THREE.Vector3(0, EYE, z0 - 12), 'backroom', 'backroom');                                        // turn round, back toward the door at eye height
      add(new THREE.Vector3(0, EYE, z0 - 6.4), new THREE.Vector3(0, EYE * .95, z0 - 14), 'move', 'rotunda');                                        // out through the door (never through the ceiling)
      inner(this.backroom.a, new THREE.Vector3(0, 2.6, 0)); }
    // the finale: the red room, door turning to face you
    { const a = this.backroom.a + STEP * .5;
      add(dir(a).multiplyScalar(9.5).setY(EYE + .2), new THREE.Vector3(0, 3.4, 0), 'heart', 'rotunda', { hold: true });
      add(dir(a).multiplyScalar(4.6).setY(EYE), new THREE.Vector3(0, 2.4, 0), 'heart', 'rotunda', { hold: true, end: true }); }
    // each stop's gaze as a direction (compass + tilt) and a distance, for turning by angle
    for (const n of nodes) { const v = n.look.clone().sub(n.pos); n.ldist = Math.max(.5, v.length()); n.yaw = Math.atan2(v.x, v.z); n.pitch = Math.atan2(v.y, Math.hypot(v.x, v.z)); }
    // distances along the path; a turn counts as walking (1.6 m per radian), so a turn-around gets its share of the scroll
    let d = 0; nodes.forEach((n, i) => { if (i) { const p = nodes[i - 1]; d += n.pos.distanceTo(p.pos) + Math.abs(Math.atan2(Math.sin(n.yaw - p.yaw), Math.cos(n.yaw - p.yaw))) * 1.6; } n.d = d; });
    this.journey = { nodes, total: d, s: 0, v: 0, seek: null, lastKey: null };
    if (this.state === 'rotunda') { this.journey.on = true; this.journey.s = this.journeyStartS ?? 0; }   // already standing in the rotunda: start walking
  }
  exhibitPose(o) {
    const u = o.userData, hall = this.halls[u.hallId];
    if (u.endPose) { const g = hall.group; g.updateMatrixWorld(); const look = g.localToWorld(new THREE.Vector3(0, 3.0, hall.L / 2 - .2));   // the hills: from mid-runway, the last models walking toward you
      return { pos: g.localToWorld(new THREE.Vector3(-.5, EYE + .05, .7)), look, focus: look.clone(), zoom: null }; }
    if (u.pose) { const g = hall.group; g.updateMatrixWorld(); const P = u.pose, look = g.localToWorld(new THREE.Vector3(P[3], P[4], P[5]));   // a set point on the runway walk (or a reading stop)
      return { pos: g.localToWorld(new THREE.Vector3(P[0], P[1], P[2])), look, focus: look.clone(), zoom: u.zoom || null }; }
    if (u.runway) { const g = hall.group; g.updateMatrixWorld(); const look = g.localToWorld(new THREE.Vector3(0, 2.05, hall.L / 2 - .4));
      return { pos: g.localToWorld(new THREE.Vector3(.95, EYE + .2, -hall.L / 2 + 2.0)), look, focus: look.clone(), zoom: null }; }
    const center = new THREE.Vector3(), normal = new THREE.Vector3();
    if (u.frame) { u.frame.localToWorld(center.set(0, 0, 0)); normal.set(0, 0, 1).applyQuaternion(u.frame.getWorldQuaternion(new THREE.Quaternion())); }
    else { u.plinth.localToWorld(center.set(0, CASE_MODEL[u.id] && artIn(u.hallId) ? (TALL_CASE.has(u.id) ? 1.52 : 1.36) : 1.6, 0)); normal.copy(this.hallPoint(hall, 0, 1.6, u.plinth.position.z)).sub(center).setY(0).normalize(); }   // real packages sit low in the glass: look at them
    // a stroll, not a stop-and-turn: stand a few steps back on the far side of the aisle and look across at the work,
    // so the path weaves left, right, left down the hall and the gaze sweeps from one wall to the other
    const g = hall.group; g.updateMatrixWorld();
    const lc = g.worldToLocal(center.clone());
    const sideX = Math.abs(lc.x) > .3 ? Math.sign(lc.x) : (lc.z > 0 ? 1 : -1);
    const real = !u.frame && CASE_MODEL[u.id] && artIn(u.hallId);   // a real package: keep the weave, but zoom the lens in on it
    const back = u.frame ? 2.6 + Math.max(u.size[0], u.size[1]) * .35 : 2.2;
    const lp = new THREE.Vector3(-sideX * (u.frame ? .9 : .7), EYE, clamp(lc.z - back, -hall.L / 2 + 1.2, hall.L / 2 - 1.2));
    const pos = g.localToWorld(lp);
    // a real package: aim between its name card on the plinth (~0.75 m) and its top, so both stay in the frame
    const top = TALL_CASE.has(u.id) ? 2.0 : 1.8, bottom = .3;   // (bottom leaves room for the on-screen bar under the card)
    const look = real ? u.plinth.localToWorld(new THREE.Vector3(0, (top + bottom) / 2, 0)) : center.clone().add(new THREE.Vector3(0, u.salon ? .5 : u.frame ? 0 : -.15, 0));
    // the lens closes in from the far side of the aisle (55 degrees walking) just enough to hold package + name card
    const zoom = real ? THREE.MathUtils.radToDeg(2 * Math.atan(((top - bottom) / 2 + .12) / pos.distanceTo(look))) : null;
    return { pos, look, focus: center.clone(), zoom };
  }
  journeyAt(s) {
    const J = this.journey, N_ = J.nodes;
    s = clamp(s, 0, J.total);
    let i = 0; while (i < N_.length - 2 && N_[i + 1].d < s) i++;
    const a = N_[i], b = N_[i + 1], t = (s - a.d) / Math.max(1e-4, b.d - a.d);
    const p0 = (N_[i - 1] || a).pos, p3 = (N_[i + 2] || b).pos;
    // centripetal-ish Catmull-Rom between a and b
    const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t;
      return new THREE.Vector3().addScaledVector(p0, -.5 * t3 + t2 - .5 * t).addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(p2, -1.5 * t3 + 2 * t2 + .5 * t).addScaledVector(p3, .5 * t3 - .5 * t2); };
    const pos = cr(p0, a.pos, b.pos, p3, t);
    // the gaze turns by ANGLE (compass direction and tilt), smoothly through every waypoint. Blending look-at points made the
    // point sweep past the camera on a turn-around (leaving a hall it spun ~1000° per metre).
    const n0 = N_[i - 1] || a, n3 = N_[i + 2] || b, wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
    const ya = a.yaw, yb = ya + wrap(b.yaw - ya), y0 = ya - wrap(ya - n0.yaw), y3 = yb + wrap(n3.yaw - yb);
    const crs = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return p0 * (-.5 * t3 + t2 - .5 * t) + p1 * (1.5 * t3 - 2.5 * t2 + 1) + p2 * (-1.5 * t3 + 2 * t2 + .5 * t) + p3 * (.5 * t3 - .5 * t2); };
    let yaw = crs(y0, ya, yb, y3, t), pitch = crs(n0.pitch, a.pitch, b.pitch, n3.pitch, t);
    pitch = clamp(pitch, Math.min(a.pitch, b.pitch), Math.max(a.pitch, b.pitch));   // never overshoots below (or above) both stops
    const dist = lerp(a.ldist, b.ldist, smooth(t));
    if (a !== b) {
      // on the move: standing eye height, the gaze nearly level; in a room it also swings toward the room's length, so you see the hall.
      // At the stops (t = 0 or 1) nothing changes.
      const w = Math.pow(Math.sin(Math.PI * t), 2);
      pos.y = lerp(pos.y, EYE, w); pitch = lerp(pitch, 0, w * .85);
      const inRoom = k => k === 'exhibit' || k === 'hall' || k === 'backroom';
      if (inRoom(a.kind) && inRoom(b.kind)) {
        const room = a.place !== 'rotunda' ? a.place : b.place, g = room === 'backroom' ? this.backroom?.group : this.halls[room]?.group;
        const turning = Math.abs(yb - ya);   // a turn-around is its own move: no nudge (choosing which end of the room to face would flip mid-turn)
        if (g && turning < 1) { const mid = ya + (yb - ya) / 2; let ax = g.rotation.y; if (Math.abs(wrap(ax - mid)) > Math.PI / 2) ax += Math.PI;   // the end of the room on the side this move faces
          yaw += wrap(ax - yaw) * w * .6 * (1 - turning); }
      }
    }
    const cp = Math.cos(pitch), look = pos.clone().add(new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(dist));
    const near = t < .5 ? a : b;
    return { pos, look, i, t, near, a, b };
  }
  holdIndex(s, dirn) {
    const J = this.journey;
    const holds = J.nodes.filter(n => n.hold);
    if (dirn > 0) return holds.find(n => n.d > s + .3) || holds[holds.length - 1];
    if (dirn < 0) return [...holds].reverse().find(n => n.d < s - .3) || holds[0];
    return holds.reduce((b, n) => Math.abs(n.d - s) < Math.abs(b.d - s) ? n : b, holds[0]);
  }
  seekTo(node) {   // and how briskly: a glide that turns a lot goes slower, so the turn stays near ~120° a second at most (a person turning round)
    if (!node) return; const J = this.journey; J.seek = node.d; J.nearT = 0; this.ui.walked?.(); this.navLabels(node.d);
    let turn = 0, prev = null; for (let k = 0; k <= 24; k++) { const at = this.journeyAt(J.s + (node.d - J.s) * k / 24), v = at.look.clone().sub(at.pos), y = Math.atan2(v.x, v.z);
      if (prev != null) turn += Math.abs(Math.atan2(Math.sin(y - prev), Math.cos(y - prev))); prev = y; }
    J.seekW = clamp(217 / Math.max(1, THREE.MathUtils.radToDeg(turn)), 1.1, 2.7);   // the spring's peak turn rate ~ 1.5 · turn · w / e: about 120° a second at most
  }
  journeyStep(dirn, queue) {   // to the next (or previous) stop. Scroll and swipe go from where the camera IS; buttons and keys may queue one stop ahead
    const J = this.journey, moving = J.seek != null, back = moving && Math.sign(J.seek - J.s) !== dirn;
    if (moving && back) return this.seekTo(this.holdIndex(J.s - dirn * .3, dirn));   // reversing mid-glide: the stop just behind the camera
    const near = moving && Math.abs(J.seek - J.s) < .25;   // the last few cm of an arrival count as arrived
    let from = near ? J.seek : J.s;
    if (moving && !near) { if (!queue || this.holdIndex(J.s, dirn).d !== J.seek) return; from = J.seek; }   // (one queued stop at most)
    if (dirn > 0 && from >= J.total - .05) return this.endHint();   // the heart never opens from a scroll: only a click, the button or Enter
    this.seekTo(this.holdIndex(from, dirn));
  }
  navLabels(s) {   // where the Back and Next arrows lead from stop s (written under them)
    const J = this.journey; if (!J || !this.ui.navLabels) return;
    const nx = this.holdIndex(s, 1), pv = this.holdIndex(s, -1);
    this.ui.navLabels(pv && pv.d < s - .3 ? pv : null, nx && nx.d > s + .3 ? nx : null, s >= J.total - .05);
  }
  endHint() {   // at the last stop: say how to go in (once every few seconds), instead of going in
    const now = performance.now(); if (now - (this._endHintT || 0) < 4000) return; this._endHintT = now;
    if (!this.heartOpen) return this.journeyEnd();
    this.ui.toast && this.ui.toast(DEVICE.mobile ? 'Tap the heart, or Go in, to enter CenterPiece' : 'Click the heart, Go in, or press Enter to enter CenterPiece');
  }
  journeyGo(dir) {   // scroll / swipe: one stop, and only once the camera has arrived and rested a moment (reversing is always allowed)
    const J = this.journey;
    const rest = performance.now() - (J.seek != null ? (J.nearT || Infinity) : (J.arrived || 0));   // ms since it (nearly) arrived
    if (J.seek != null && Math.sign(J.seek - J.s) !== dir) return this.journeyStep(dir);   // reversing: always
    if (!(rest >= 350)) return;
    this.journeyStep(dir);
  }
  journeyWheel(dy, ts = performance.now(), mom) {   // one scroll gesture = one stop. A trackpad flick sends 40+ events over 2-3 s; its fading tail never adds a step
    const J = this.journey, g = J.gest || (J.gest = { t: -1e9, dir: 0, acc: 0, used: true, la: 0, hi: 0, lo: 0 });
    const dir = Math.sign(dy), a = Math.abs(dy); if (!dir) return;
    const gap = ts - g.t;
    // a new gesture: a change of direction, a long pause, a wheel notch after a short pause, or a rise after the fade (momentum only fades;
    // fingers moving again push harder). Chrome's own momentum flag, where it exists, overrules all of this.
    const fresh = mom !== true && (dir !== g.dir || gap > 600 || (gap > 250 && a >= 20 && a >= g.la) || (g.lo < g.hi * .5 && a > g.lo * 2 + 12));
    g.t = ts; g.la = a;
    if (fresh) { g.dir = dir; g.acc = 0; g.used = false; g.hi = a; g.lo = a; }
    else if (a >= g.hi) { g.hi = a; g.lo = a; } else g.lo = Math.min(g.lo, a);
    if (g.used) return;
    g.acc += a; if (g.acc < 24) return;
    g.used = true;   // the rest of this gesture is spent, whatever happens
    this.journeyGo(dir);
  }
  navStep(d) {   // the on-screen arrows and the arrow keys: one step forward (+1) or back (-1), whatever you are doing
    if (this.paused) return;
    if (this.journey?.on && !this.journey.off) { if (d > 0 && this.journey.seek == null && this.journey.s >= this.journey.total - .05) this.journeyEnd(); else this.journeyStep(d, true); return; }
    if (this.state === 'rotunda') this.turn(d);
    else if (this.state === 'hall') d > 0 ? this.nextInHall() : this.goRotunda();
    else if (this.state === 'exhibit') this.stepWork(d);
  }
  updateJourney(dt) {
    const J = this.journey;
    if (J.seek != null) {                                    // a key or a click: glide to the chosen stop
      J.v = 0; const w = J.seekW || 2.7, n = Math.ceil(Math.min(dt, .1) / .008), h = Math.min(dt, .1) / n;   // a critically damped spring: eases in, eases out, no jolt when re-aimed
      // a speed limit where the path turns: the gaze never swings faster than ~120° a second, and the walk never goes faster than a brisk 7 m/s
      const yawAt = x => { const at = this.journeyAt(x), v = at.look.clone().sub(at.pos); return Math.atan2(v.x, v.z); }, sg = Math.sign(J.seek - J.s) || 1, y1 = yawAt(J.s);
      let degPerM = 0, yp = y1; for (let k = 1; k <= 8; k++) { const y2 = yawAt(J.s + k * .1 * sg); degPerM = Math.max(degPerM, Math.abs(Math.atan2(Math.sin(y2 - yp), Math.cos(y2 - yp))) * 57.3 / .1); yp = y2; }   // the sharpest turn in the next 80 cm, 10 cm at a time
      const cap = Math.min(7, Math.max(.6, 120 / Math.max(1e-3, degPerM)));
      for (let k = 0; k < n; k++) { const d = J.seek - J.s; J.gv = clamp((J.gv || 0) + (w * w * d - 2 * w * (J.gv || 0)) * h, -cap, cap); J.s += J.gv * h; }
      if (!J.nearT && Math.abs(J.seek - J.s) < .25) J.nearT = performance.now();
      if (Math.abs(J.seek - J.s) < .004 && Math.abs(J.gv) < .03) { J.s = J.seek; J.seek = null; J.gv = 0; J.arrived = J.nearT || performance.now();
        if (this.state === 'backroom') this.openHeart(); this.navLabels(J.s); this.ui.arrived?.(); }   // the heart opens when you STOP in the back room, not when a glide passes through
    } else {
      J.gv = 0; J.s += J.v * dt; J.v *= Math.exp(-dt * 2.2);          // momentum, then it settles (a longer, softer glide)
      if (Math.abs(J.v) < .7) {                             // a soft magnet towards the nearest stop
        const h = this.holdIndex(J.s, 0); if (h && Math.abs(h.d - J.s) < 3.2) J.s += (h.d - J.s) * (1 - Math.exp(-dt * 1.5));
      }
    }
    if (J.s <= 0 && J.v < 0) J.v = 0;
    if (J.s >= J.total) { J.s = J.total; J.v = 0; }   // (the heart is entered only on purpose: journeyEnd from a click, the button or Enter)
    J.s = clamp(J.s, 0, J.total);
    const at = this.journeyAt(J.s);
    this.goalPos.copy(at.pos);
    const sway = (this.camera.fov / 55) ** 2;   // zoomed in, the mouse moves the gaze much less
    this.goalLook.copy(at.look).add(new THREE.Vector3(-this.lookOff.x * 3 * sway, this.lookOff.y * 2 * sway, 0));
    { const rb_ = this.atBook; if (rb_?.reading && rb_.readL && J.seek == null) { rb_.hallG.updateMatrixWorld(); this.goalPos.copy(rb_.hallG.localToWorld(new THREE.Vector3(...rb_.readL[0]))); this.goalLook.copy(rb_.hallG.localToWorld(new THREE.Vector3(...rb_.readL[1]))); } }
    // what place are we in?
    const n = at.near, close = n.pos.distanceTo(at.pos) < .7;
    let state = 'rotunda', place = 'rotunda';
    if (n.kind === 'exhibit' && close) { state = 'exhibit'; place = n.place; }
    else if (at.a.kind === 'hall' || at.a.kind === 'exhibit' || at.b.kind === 'exhibit') { state = 'hall'; place = at.a.place !== 'rotunda' ? at.a.place : at.b.place; }
    else if (n.kind === 'backroom' && close) { state = 'backroom'; place = 'backroom'; }
    const key = state + ':' + place + ':' + (state === 'exhibit' ? n.work : '');
    { const bk = (state === 'exhibit' && n.obj?.userData.book) || null; if (bk !== this.atBook) { if (this.atBook) this.atBook.reading = false; this.atBook = bk; this.ui.pages?.(bk); } }
    { const rp = !!(state === 'exhibit' && n.obj?.userData.player); if (rp !== !!this.atPlayer) { this.atPlayer = rp; this.ui.records?.(rp); } }   // Hall 05: the record picker at the turntable
    if (key !== J.lastKey) {
      J.lastKey = key;
      this.desk.active = state === 'backroom' || (at.b.kind === 'backroom');
      // walking into a hall weaves its artworks in (the red-ink reveal), once per hall
      { const hh = (state === 'hall' || state === 'exhibit') && this.halls[place]; if (hh && !hh.revealed) { hh.revealed = true; this.revealHall(hh); } }
      if (state === 'exhibit') {
        this.exhibitObj = n.obj; this.focusPoint = n.focus; this.visited.add(n.work); this.sharpen(n.obj); this._still = performance.now();
        try { sessionStorage.setItem('ng-visited', JSON.stringify([...this.visited])); } catch (e) {}
        const hall = this.halls[place];
        this.setPlace('exhibit', place, `${hall.def.num} · ${hall.def.title}`, '');
        this.ui.exhibit(n.work);
      } else {
        this.focusPoint = null; this.ui.exhibit(null); this.sharpen(null);
        if (state === 'hall') { const hall = this.halls[place]; this.hallZ = -hall.L / 2; this.setPlace('hall', place, `${hall.def.num} · ${hall.def.title}`, ''); }
        else if (state === 'backroom') { this.desk.setVisited(this.visited); this.deskCam = n.pos.clone(); this.deskLook = n.look.clone(); this.setPlace('backroom', 'backroom', '06 · Blender & 3D', ''); }
        else this.setPlace('rotunda', 'rotunda', 'The Rotunda', '');
      }
    }
    // the lens: zoom in as you arrive at a real package, back out as you walk on
    { let fov = 55;
      for (const zn of [at.a, at.b]) if (zn.zoom) { const k = clamp(1 - zn.pos.distanceTo(at.pos) / 1.6, 0, 1); fov = Math.min(fov, lerp(55, zn.zoom, smooth(k))); }
      this.fovGoal = fov; }
    this.travelTo = at.b.kind === 'hall' || at.b.kind === 'exhibit' ? at.b.place : null;
    this.ui.journey && this.ui.journey(J.s / J.total);
  }
  journeyEnd() {
    if (this.heartOpen) { this.journey.off = true; this.state = 'rotunda'; this.enterHeart(); }
    else this.ui.toast && this.ui.toast(`The heart opens once you have walked the halls (${this.hallsSeen.size} of ${HALLS.length}).`);
  }

  /* =========================================================
     MOOD: three darkness levels
     ========================================================= */
  setMood(i) {
    this.mood = i;
    const M = [
      { exp: .9, amb: .5, hemi: .6, fog: .01, bloom: .3, heart: 18 },
      { exp: 1.0, amb: .7, hemi: .8, fog: .008, bloom: .3, heart: 22 },
      { exp: 1.1, amb: .9, hemi: 1, fog: .006, bloom: .25, heart: 24 },
    ][i];
    this.renderer.toneMappingExposure = M.exp; this.ambient.intensity = M.amb; this.hemi.intensity = M.hemi;
    this.baseFog = M.fog; this.bloom.strength = M.bloom; this.heartBase = M.heart;
    if (this.state !== 'map') this.fog.density = M.fog;
  }

  /* =========================================================
     INPUT: drag to turn, scroll / arrows to glide, click to enter
     ========================================================= */
  bindInput() {
    const c = this.canvas;
    let down = null;
    c.addEventListener('pointermove', e => {
      this.mouse.set(e.clientX, e.clientY);
      this.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.look.x = this.ndc.x; this.look.y = this.ndc.y;
      if (down) {
        const dx = e.clientX - down.lx;
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
        if (this.desk.held) { this.ray.setFromCamera(this.ndc, this.camera); this.desk.drag(this.ray); }
        else if (this.state === 'rotunda' && down.moved && !this.journey?.on) {
          // dragging turns you around the heart, towards the halls
          this.ring.hT = 0; this.ring.dragging = true;
          const da = dx * .0042; this.ring.a += da; this.ring.vel = da; this.ring.snap = null;
        }
        down.lx = e.clientX; down.ly = e.clientY;
      }
      this.lastMove = performance.now();
    });
    c.addEventListener('pointerdown', e => {
      this.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, t0: performance.now() };
      c.setPointerCapture(e.pointerId);
      if (this.state === 'backroom') {
        this.ray.setFromCamera(this.ndc, this.camera);
        if (this.desk.pick(this.ray)) { down.grab = true; this.ui.grab(true); }
      }
    });
    c.addEventListener('pointerup', e => {
      if (!down) return;
      if (this.journey?.on && !this.journey.off && down.moved && !down.grab && e.pointerType !== 'mouse') {   // a swipe: one stop, on its main direction only
        const dx = e.clientX - down.x, dy = down.y - e.clientY, dt = Math.max(1, performance.now() - down.t0);
        if (Math.abs(dy) >= Math.abs(dx)) { if (Math.abs(dy) > 40 || Math.abs(dy) / dt > .3) this.journeyGo(Math.sign(dy)); }
        else if (Math.abs(dx) > 70) this.journeyGo(dx < 0 ? 1 : -1);
        this.ring.dragging = false; down = null; return;
      }
      if (down.grab) { this.desk.release(); this.ui.grab(false); }
      else if (!down.moved) this.click();
      else if (this.state === 'exhibit' && Math.abs(e.clientX - down.x) > 70) this.stepWork(e.clientX < down.x ? 1 : -1); // swipe
      this.ring.dragging = false;
      down = null;
    });
    let acc = 0, coolUntil = 0;
    addEventListener('wheel', e => { if (this.journey?.on && !this.journey.off && !this.paused) this.journeyWheel(e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY, e.timeStamp, e.momentum); }, { passive: true });
    c.addEventListener('wheel', e => {
      if (this.journey?.on) return;
      const now = performance.now();
      if (now < coolUntil) return;
      acc += e.deltaY;
      if (Math.abs(acc) < 60) return;
      const d = Math.sign(acc); acc = 0; coolUntil = now + 520;
      if (this.state === 'rotunda') this.turn(d);
      else if (this.state === 'hall') d > 0 ? this.nextInHall() : this.goRotunda();
      else if (this.state === 'exhibit') this.stepWork(d);
    }, { passive: true });
    addEventListener('keydown', e => {
      const k = e.key;
      if (this.journey?.on && !this.journey.off && !this.paused) {
        if (['ArrowUp', 'ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); this.navStep(1); }   // up / right: forward
        if (['ArrowDown', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); this.navStep(-1); }       // down / left: back
        if (k === 'Enter' && this.journey.seek == null && this.journey.s >= this.journey.total - .05) this.journeyEnd();   // at the heart: Enter goes in
        return;
      }
      if (k === 'Escape') { if (this.state === 'exhibit') this.closeExhibit(); else if (this.state === 'hall' || this.state === 'backroom') this.goRotunda(); }
      if (this.state === 'rotunda') {
        if (k === 'ArrowLeft') this.turn(-1);
        if (k === 'ArrowRight') this.turn(1);
        if (k === 'ArrowUp' || k === 'Enter') this.enterFocus();
        if (k === 'ArrowDown' || k === 'h' || k === 'H') this.toggleHeart();
      } else if (this.state === 'hall') {
        if (k === 'ArrowRight' || k === 'ArrowUp' || k === 'Enter') this.nextInHall();
        if (k === 'ArrowLeft' || k === 'ArrowDown') this.goRotunda();
      } else if (this.state === 'exhibit') {
        if (k === 'ArrowRight') this.stepWork(1);
        if (k === 'ArrowLeft') this.stepWork(-1);
      }
    });
  }

  hoverTest() {
    const atBk = this.state === 'exhibit' && (this.exhibitObj?.userData.book || this.atPlayer);   // at a book in Hall 04 the pages stay clickable (and Hall 05's record sleeves at the turntable)
    if ((!['rotunda', 'hall', 'backroom'].includes(this.state) && !atBk) || this.ring.dragging) { this.setHover(null); return; }
    { const e = this.camera.matrixWorld.elements, k = this._hk || (this._hk = new Float32Array(19));   // nothing moved (pointer, camera, state): the last answer still stands
      let same = k[16] === this.ndc.x && k[17] === this.ndc.y && k[18] === (this.state.length + (this.place || '').length * 31) && !this.desk?.held && !this.desk?.active;
      for (let i = 0; i < 16 && same; i++) if (k[i] !== e[i]) same = false;
      if (same && !atBk && !this.perfOff) return;
      for (let i = 0; i < 16; i++) k[i] = e[i]; k[16] = this.ndc.x; k[17] = this.ndc.y; k[18] = this.state.length + (this.place || '').length * 31; }
    this.ray.setFromCamera(this.ndc, this.camera);
    if (this.state === 'backroom') {
      const it = this.desk.held || this.desk.hoverItem(this.ray);
      this.ui.hover(it ? (WORKS[it.id]?.title || '') : null, !!it);
      return;
    }
    const pool = this.state === 'hall' ? [...this.halls[this.place].exhibits, ...(this.halls[this.place].extras || [])] : this.interactive.filter(o => o.userData.type !== 'work');
    if (this.state === 'exhibit' && this.exhibitObj?.userData.book) pool.push(this.exhibitObj);   // the open book stays in reach
    const hit = this.ray.intersectObjects(pool, false)[0];
    this.hoverPoint = hit ? hit.point.clone() : null;
    this.setHover(hit ? hit.object : null);
    const ho = this.hovered, st = ho?.userData.book;
    if (st && this.state === 'exhibit' && this.exhibitObj === ho) {   // say what a click will do
      const d = st.mode === 'covers' ? 1 : this.bookSide(ho), last = st.k >= st.K, first = st.k <= 0;
      this.ui.hover(d > 0 ? (last || st.mode === 'covers' ? 'Read the case study →' : st.mode === 'fold' ? 'Open the next flap →' : 'Turn the page →') : (first ? '' : '← Back a page'), true);
    }
  }
  setHover(o) {
    if (this.hovered === o) return;
    const prev = this.hovered; this.hovered = o;
    if (prev?.userData.type === 'arch') prev.userData.mat.color.set('#ff2a1a').multiplyScalar(.7);
    if (prev?.userData.mat?.uniforms) prev.userData.mat.uniforms.uHover.value = 0;
    if (!o) { this.ui.hover(null, false); if (this.state === 'hall') this.butterfly.forget(); return; }
    const u = o.userData;
    if (u.type === 'arch') { u.mat.color.set('#ff2a1a').multiplyScalar(2.6); this.ui.hover(u.hall === BACKROOM ? 'Enter · 06 Blender & 3D' : `Enter · ${u.hall.num} ${u.hall.title}`, true); }
    if (u.type === 'heart') this.ui.hover(this.heartOpen ? 'Enter CenterPiece · the heart' : 'CenterPiece · sealed until the halls are seen', true);
    if (u.type === 'record') { this.ui.hover(this.recordPlayer?.k === u.k ? `${u.title} · playing` : `Play ${u.title}`, true); return; }
    if (u.type === 'work' && u.book && this.exhibitObj === o && this.state === 'exhibit') return;   // the open book: its label is set by the hover
    if (u.type === 'work') {
      const w = WORKS[u.id]; this.ui.hover(`${w.title} · look closer`, true);
      if (u.mat?.uniforms) u.mat.uniforms.uHover.value = 1;
      this.butterfly.learn(w.color);
      const { p, n } = this.exhibitPerch(o); this.butterfly.land(p, n);
    }
  }
  /* where the butterfly rests on an exhibit: on its face, wings towards you */
  exhibitPerch(o) {
    const u = o.userData, p = new THREE.Vector3(), n = new THREE.Vector3();
    if (u.frame) {
      u.frame.localToWorld(p.set(u.size[0] * .36, u.size[1] * .28, .06));
      n.set(0, 0, 1).applyQuaternion(u.frame.getWorldQuaternion(new THREE.Quaternion()));
    } else {
      const hall = this.halls[u.hallId], c = u.plinth.localToWorld(new THREE.Vector3(0, 1.62, 0));
      n.copy(this.hallPoint(hall, 0, 1.62, u.plinth.position.z)).sub(c).setY(0).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n);
      p.copy(c).addScaledVector(n, .5).addScaledVector(side, .22).add(new THREE.Vector3(0, .26, 0));
    }
    return { p, n };
  }
  bookSide(o) { if (!this.hoverPoint) return 1; return o.worldToLocal(this.hoverPoint.clone()).x < 0 ? -1 : 1; }
  bookClick(o) {
    const st = o.userData.book, d = st.mode === 'covers' ? 1 : this.bookSide(o);
    if (!st.turn(d) && d > 0) dispatchEvent(new CustomEvent('navgod-open-work', { detail: o.userData.id }));
  }
  click() {
    if (this.busy) return;
    const o = this.hovered; if (!o) return;
    const u = o.userData;
    if (u.type === 'record') { this.recordPlayer?.play(u.k); this.hovered = null; return this.setHover(o); }   // Hall 05: put this record on
    if (this.journey?.on && !this.journey.off) {
      if (u.book && this.atBook === u.book) return this.bookClick(o);   // the open book: turn a page by hand; past the last, read the case
      if (u.type === 'work') return this.seekTo(this.journey.nodes.find(n => n.work === u.id));
      if (u.type === 'arch') return this.seekTo(this.journey.nodes.find(n => n.facing === (u.hall === BACKROOM ? 'backroom' : u.hall.id)));
      if (u.type === 'heart') return this.heartOpen ? this.enterHeart() : this.seekTo(this.journey.nodes[this.journey.nodes.length - 1]);
    }
    if (u.type === 'arch') u.hall === BACKROOM ? this.goBackroom() : this.goHall(u.hall.id);
    if (u.type === 'heart') this.enterHeart();
    if (u.book && this.state === 'exhibit' && this.exhibitObj === o) return this.bookClick(o);
    if (u.type === 'work') this.openExhibit(o);
  }

  /* =========================================================
     THE ROTUNDA: turn around the heart, settle on each arch
     ========================================================= */
  ringPose(a, h) {
    const hs = smooth(clamp(h, 0, 1));
    const r = lerp(ARCH_CAM_R, ORBIT_R, hs);
    const pos = dir(a).multiplyScalar(r).setY(lerp(EYE, EYE + .15, hs));
    const pitchArch = Math.atan2(4.1 - EYE, R - ARCH_CAM_R), pitchHeart = Math.atan2(CENTER.y - EYE - .15, ORBIT_R);
    const yaw = a + Math.PI * hs - this.lookOff.x, pitch = lerp(pitchArch, pitchHeart, hs) + this.lookOff.y;
    const look = pos.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(6));
    return { pos, look };
  }
  roomAt(a) { const k = ((Math.round(a / STEP) % N) + N) % N; return k === 0 ? BACKROOM : HALLS.find(h => h.k === k); }
  turn(d) {
    if (this.state !== 'rotunda' || this.busy) return;
    this.ring.hT = 0;
    const base = this.ring.snap ?? Math.round(this.ring.a / STEP) * STEP;
    this.ring.snap = base + d * STEP; this.ring.vel = 0;
  }
  toggleHeart() { if (this.state === 'rotunda') { this.ring.hT = this.ring.hT > .5 ? 0 : 1; if (this.ring.hT === 0) this.ring.snap = Math.round(this.ring.a / STEP) * STEP; } }
  enterFocus() {
    if (this.state !== 'rotunda' || this.busy) return;
    if (this.ring.h > .5) return this.enterHeart();
    const room = this.roomAt(this.ring.a);
    room === BACKROOM ? this.goBackroom() : this.goHall(room.id);
  }
  updateRing(dt) {
    const g = this.ring;
    g.h += (g.hT - g.h) * (1 - Math.exp(-dt * 2.4));
    if (!g.dragging) {
      if (g.snap === null) {
        g.a += g.vel; g.vel *= Math.exp(-dt * 6);
        if (Math.abs(g.vel) < .002 && g.hT < .5) g.snap = Math.round(g.a / STEP) * STEP;
      }
      if (g.snap !== null) g.a += (g.snap - g.a) * (1 - Math.exp(-dt * 3.3));
    }
    // tell the UI what you are facing, once you have settled on it
    const settledHall = g.hT < .5 && g.h < .06 && g.snap !== null && Math.abs(g.snap - g.a) < .02 && !g.dragging;
    const want = g.hT > .5 && g.h > .9 ? 'heart' : settledHall ? this.roomAt(g.a) : null;
    if (want !== g.focus) { g.focus = want; this.ui.focus(want === 'heart' ? null : want, want === 'heart'); }
  }

  /* =========================================================
     CAMERA JOURNEYS
     ========================================================= */
  travel(dur, fn) {
    this.busy = true;
    if (dur > 900) this.ui.sound?.whoosh(dur / 1000);
    return new Promise(res => {
      const t0 = performance.now();
      this.travelFn = now => {
        const s = clamp((now - t0) / dur, 0, 1);
        fn(s);
        if (s >= 1) { this.travelFn = null; this.busy = false; res(); }
      };
    });
  }
  setCam(pos, look, snap = false) {
    this.goalPos.copy(pos); this.goalLook.copy(look); this.camLook = look.clone();
    if (snap || this.snapNext) { this.snapNext = false; this.camera.position.copy(pos); this.lookCur.copy(look); this.velPos.set(0, 0, 0); this.velLook.set(0, 0, 0); this.camera.lookAt(look); }
  }
  /* critically damped spring: smooth, never overshoots, never snaps */
  springCam(dt) {
    const step = (cur, vel, goal, w) => {
      const k = w * w, c = 2 * w, tmp = new THREE.Vector3();
      for (let i = 0; i < 2; i++) { tmp.subVectors(goal, cur).multiplyScalar(k).addScaledVector(vel, -c); vel.addScaledVector(tmp, dt / 2); cur.addScaledVector(vel, dt / 2); }
    };
    step(this.camera.position, this.velPos, this.goalPos, this.travelFn ? 13 : 7);
    step(this.lookCur, this.velLook, this.goalLook, this.travelFn ? 12 : 6);
    this.camera.lookAt(this.lookCur);
  }
  camLookPoint() { return this.lookCur.clone(); }
  orbitPos(phi, r = ORBIT_R) { return dir(phi).multiplyScalar(r).setY(EYE + .15); }
  hallPoint(hall, x, y, z) { return dir(hall.a).multiplyScalar(R0 + hall.L / 2 + z).addScaledVector(rightOf(hall.a), x).setY(y); }
  boostVein(k) { const m = this.veins[k]; if (m) { m.uniforms.uBoost.value = 1; m.uniforms.uBoostT.value = this.shared.uTime.value; } }
  bezier(a, b, c, t) { const u = 1 - t; return a.clone().multiplyScalar(u * u).addScaledVector(b, 2 * u * t).addScaledVector(c, t * t); }

  openHeart() {
    if (this.heartOpen) return;
    this.heartOpen = true; try { sessionStorage.setItem('ng-heart', 'open'); } catch (e) {}
    this.ui.film?.preload(['in', 'hatch', 'spin', 'emerge']);   // the metamorphosis film starts downloading quietly now, long before it is needed
    this.heartBoost = 1.5; for (const k in this.veins) this.boostVein(+k);
    // the moment: the eye in the ceiling wakes and looks down, light pours down the shaft, the crown turns once
    this.ceilEye.awaken(TIME.value); this.shaftPulse = 1; this.crownSpin = 1;
    this.ui.sound?.swell?.();
    if (this.state === 'rotunda' && this.ring.focus === 'heart') this.ui.focus(null, true);   // the card now says Enter CenterPiece
    this.ui.toast && this.ui.toast('The heart is open. CenterPiece awaits you in the Rotunda.');
  }
  /* CenterPiece is a heavy page (all its pictures inline). It loads while you are in the Blender hall, the last room before the heart,
     so going into it later never waits; then it sleeps (its loop paused) until you go in */
  // laptops: CenterPiece (its parse blocks the page ~0.6 s, twice) loads while the visitor stands still at a work, where a pause can't be seen
  cpWhenStill() {
    if (this._cpLoading || !LOOM || !this.ui.centerpiece || DEVICE.mobile) return;
    const chk = () => { if (this._cpLoading) return; if (this.state === 'exhibit' && this.journey?.seek == null && performance.now() - (this._still || 0) > 1200) this.loadCenterPiece(true); else setTimeout(chk, 400); };
    chk();
  }
  loadCenterPiece(now) {
    if (this._cpLoading || !LOOM || !this.ui.centerpiece || DEVICE.mobile) return; this._cpLoading = true;
    setTimeout(async () => {
      try { await Promise.race([this.ui.centerpiece.preload(), new Promise(res => setTimeout(res, 15000))]); } catch (e) {}
      setTimeout(() => this.ui.centerpiece.sleep?.(this.state !== 'centerpiece'), 2800);   // (its pictures decode just after it loads)
    }, now ? 0 : 1200);
  }
  setPlace(state, place, name, hint) {
    if (state === 'hall' && place) {
      this.hallsSeen.add(place); try { sessionStorage.setItem('ng-halls', JSON.stringify([...this.hallsSeen])); } catch (e) {}
      if (this.hallsSeen.size >= HALLS.length) this.openHeart();
    }
    if (state === 'backroom') { if (this.journey?.seek == null) this.openHeart(); this.loadCenterPiece(); }   // (gliding through: it opens on arrival, in updateJourney)
    this.state = state; this.place = place;
    this.ui.sound?.setPlace(place);
    this.ui.place(state, place, name, hint);
  }

  /* intro: from the bleeding logo, look down on the veins, then dive in */
  async introFromMap(ringPx) {
    // the intro's eye lands exactly on the red room's eye (seen from above); hold so the floor names read; then spiral down
    this.setPlace('map', null, 'NavGod', '');
    this.ceilings.forEach(c => (c.visible = false)); if (this.lightShaft) this.lightShaft.visible = false;
    this.nearCut = true;                                             // see into the Rotunda from above: nothing nearer than the ceiling is drawn
    this.fog.density = .006;
    const fovT = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const h0 = ringPx ? (LOOM ? DAIS_Y + .004 : 7.51) + (LOOM ? DAIS_R : CH_R + .35) / ((ringPx / (innerHeight / 2)) * fovT) : 52;   // the eye seen from above: the loom's dais (or the old drum's top)
    const a = this.ring.a = angleOf(1); this.ring.h = this.ring.hT = 0; this.ring.snap = a;
    if (this.roomEye) this.roomEye.nextBlink = TIME.value + 9;   // no blink during the handover
    this.setCam(new THREE.Vector3(0, h0, .001), new THREE.Vector3(0, 0, 0), true);
    await new Promise(r => setTimeout(r, ringPx ? 3800 : 900));
    const end = this.ringPose(a, 0);
    await this.travel(6800, s => {
      const e = ease(s);
      const ang = a + (1 - e) * 2.2, rr = ARCH_CAM_R * smooth(e);
      const pos = dir(ang).multiplyScalar(rr).setY(lerp(h0, end.pos.y, e));
      const look = new THREE.Vector3(0, 0, 0).lerp(end.look, smooth(e));
      if (pos.y < WALL_H - .3) { this.ceilings.forEach(c => (c.visible = true)); this.nearCut = false; if (this.lightShaft) this.lightShaft.visible = true; }
      this.fog.density = lerp(.006, this.baseFog, e);
      this.setCam(pos, look);
    });
    this.ceilings.forEach(c => (c.visible = true)); if (this.lightShaft) this.lightShaft.visible = true; this.nearCut = false;
    this.enterRotunda();
  }
  enterRotunda() { this.entered = true;
    if (this.heartOpen) this.ui.film?.preload(['in', 'hatch', 'spin', 'emerge']);
    this.setPlace('rotunda', 'rotunda', 'The Rotunda', 'drag, scroll or ← → to turn to a hall · ↑ to enter');
    if (this.journey && !this.journey.on) { this.journey.on = true; this.journey.off = false; this.journey.s = this.journeyStartS ?? 0; this.journey.v = 0;
      this.journey.seek = null; this.journey.gv = 0; this.journey.gest = null; this.journey.arrived = performance.now(); }
    if (this.journey) this.navLabels(this.journey.s); this.ui.entered?.();   // (back from the heart: no old target or half-used scroll left over)
    this.ring.focus = undefined; this.ring.focusHeart = undefined;
  }

  /* turn (if needed) to face an arch, then glide through it */
  async turnTo(a, ms) {
    const g = this.ring, a0 = g.a, da = wrapAngle(a - a0), h0 = g.h;
    if (Math.abs(da) < .01 && h0 < .02) { g.a = a0 + da; return; }
    const dur = ms ?? Math.min(2100, 900 + Math.abs(da) * 520 + h0 * 700);
    await this.travel(dur, s => {
      const t = ease(s); g.a = a0 + da * t; g.h = h0 * (1 - t); g.hT = 0;
      const p = this.ringPose(g.a, g.h); this.setCam(p.pos, p.look);
    });
    g.snap = g.a; g.vel = 0;
  }

  async goHall(id, auto = true) {
    if (this.journey?.on && !this.journey.off) return this.seekTo(this.journey.nodes.find(n => n.facing === id));
    if (this.busy) return;
    const hall = this.halls[id]; if (!hall) return;
    if (this.state !== 'rotunda') await this.goRotunda(true);
    this.setHover(null); this.ui.focus(null);
    this.state = 'travel'; this.travelTo = id; this.ui.place('travel', id, hall.def.title, '');
    this.boostVein(hall.def.k);
    await this.turnTo(hall.a);
    const z0 = -hall.L / 2 + 1.4, start = this.ringPose(hall.a, 0);
    const end = this.hallPoint(hall, 0, EYE, z0), far = this.hallPoint(hall, 0, EYE, hall.L / 2);
    this.revealHall(hall);
    await this.travel(2700, s => {
      const t = ease(s);
      this.setCam(start.pos.clone().lerp(end, t), start.look.clone().lerp(far, smooth(t)));
    });
    this.hallZ = z0;
    this.setPlace('hall', id, `${hall.def.num} · ${hall.def.title}`, 'scroll or → to glide to the works · click any work');
    // after a breath, glide to the first work
    if (auto) { clearTimeout(this.autoT); this.autoT = setTimeout(() => { if (this.state === 'hall' && this.place === id && !this.busy) this.openExhibit(hall.exhibits[0]); }, 1100); }
  }
  nextInHall() {
    if (this.busy) return;
    const hall = this.halls[this.place]; if (!hall) return;
    const next = hall.exhibits.find(o => o.userData.z > this.hallZ + .5) || hall.exhibits[0];
    this.openExhibit(next);
  }
  revealHall(hall) {
    [...hall.exhibits, ...(hall.extras || [])].forEach((o, i) => {
      const m = o.userData.mat; if (!m?.uniforms || m.uniforms.uReveal.value >= 1) return;
      const t0 = performance.now() + 500 + i * (hall.extras ? 160 : 380);
      const tick = now => { const s = clamp((now - t0) / 2400, 0, 1); m.uniforms.uReveal.value = s; if (s < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }

  /* step back out into the rotunda, facing the arch you came from */
  async goRotunda(quiet) {
    if (this.busy) return;
    clearTimeout(this.autoT);
    const from = this.place === 'backroom' ? this.backroom : this.halls[this.place];
    if (!from) return;
    this.ui.exhibit(null);
    this.state = 'travel'; this.ui.place('travel', 'rotunda', 'The Rotunda', '');
    const a = from.a, p0 = this.camera.position.clone(), l0 = this.camLookPoint();
    this.ring.a = wrapAngle(a); this.ring.h = this.ring.hT = 0; this.ring.snap = this.ring.a; this.ring.vel = 0;
    const end = this.ringPose(this.ring.a, 0), mid = dir(a).multiplyScalar(R + 2).setY(EYE);
    await this.travel(quiet ? 1500 : 2000, s => {
      const t = ease(s);
      this.setCam(this.bezier(p0, mid, end.pos, t), l0.clone().lerp(end.look, smooth(t)));
    });
    this.desk.active = false;
    this.enterRotunda();
  }

  async goBackroom() {
    if (this.journey?.on && !this.journey.off) return this.seekTo(this.journey.nodes.find(n => n.kind === 'backroom'));
    if (this.busy) return;
    if (this.state !== 'rotunda') await this.goRotunda(true);
    this.setHover(null); this.ui.focus(null);
    this.state = 'travel'; this.travelTo = 'backroom'; this.ui.place('travel', 'backroom', '06 · Blender & 3D', '');
    this.boostVein(BACKROOM.k);
    this.desk.setVisited(this.visited); this.desk.active = true;
    await this.turnTo(this.backroom.a);
    const start = this.ringPose(this.ring.a, 0);
    const deskC = this.desk.origin.clone().setY(1.05);
    const end = this.desk.origin.clone().add(new THREE.Vector3(0, 3.5, -4.4));
    await this.travel(2600, s => {
      const t = ease(s);
      this.setCam(start.pos.clone().lerp(end, t), start.look.clone().lerp(deskC, smooth(t)));
    });
    this.deskCam = end.clone(); this.deskLook = deskC.clone();
    this.setPlace('backroom', 'backroom', '06 · Blender & 3D', 'the castle, and every package and book built in 3D');
  }

  /* ---------- exhibit view: glide to the work on a gentle curve ---------- */
  async openExhibit(o) {
    if (!o) return;
    clearTimeout(this.autoT);
    const u = o.userData, w = WORKS[u.id];
    const hall = this.halls[u.hallId];
    this.visited.add(u.id); try { sessionStorage.setItem('ng-visited', JSON.stringify([...this.visited])); } catch (e) {}
    this.state = 'travel';
    const center = new THREE.Vector3(), normal = new THREE.Vector3();
    if (u.frame) { u.frame.localToWorld(center.set(0, 0, 0)); normal.set(0, 0, 1).applyQuaternion(u.frame.getWorldQuaternion(new THREE.Quaternion())); }
    else { u.plinth.localToWorld(center.set(0, 1.6, 0)); normal.copy(this.hallPoint(hall, 0, 1.6, u.plinth.position.z)).sub(center).setY(0).normalize(); }
    const pk = !u.frame && u.obj?.userData.mid;   // a real package in the vitrine: frame the package, not the glass
    if (pk) u.obj.localToWorld(center.copy(u.obj.userData.mid));
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
    // frame the work AND its wall lettering together: aim at the middle of the pair
    const shift = 0;
    const dist = u.salon ? Math.min(Math.max(u.size[0] * .76, (u.size[1] + 2.4) * 1.08), hall.W - 1.4) : u.frame ? Math.min(Math.max(u.size[0] + shift * 1.4, u.size[1]) * 1.25 + .6, hall.W - 1.4) : pk ? (u.obj.userData.flat ? 1.05 : 1.4) : 1.7;   // close enough to read the package through the glass
    const aim = center.clone().addScaledVector(side, shift).add(new THREE.Vector3(0, u.salon ? .5 : 0, 0)).addScaledVector(side, u.salon ? .6 : 0);   // a salon wall: take in the logo above it too, and keep clear of the counter on the right
    // flat packages (the cheese wheel) are seen from above so their lettering reads; tall ones nearly level
    const target = aim.clone().addScaledVector(normal, dist).add(new THREE.Vector3(0, u.frame ? 0 : pk ? (u.obj.userData.flat ? .9 : .3) : .35, 0));
    const lookAt = aim.clone();
    if (u.runway || u.endPose || u.pose) { const pz = this.exhibitPose(o); target.copy(pz.pos); lookAt.copy(pz.look); aim.copy(pz.look); }   // the runway: stand at its start and look down it
    const p0 = this.camera.position.clone(), l0 = this.camLookPoint();
    // swing back through the aisle so the move feels like walking, not teleporting
    const mid = this.hallPoint(hall, 0, EYE + .1, (u.z + clamp(this.hallZFrom(p0, hall), -hall.L / 2, hall.L / 2)) / 2);
    const rz = clamp(u.z - 3.2, -hall.L / 2 + .6, hall.L / 2 - 3.6);
    this.exhibitReturn = { pos: this.hallPoint(hall, 0, EYE, rz), look: this.hallPoint(hall, 0, EYE, rz + 5), z: rz };
    this.ui.hover(null, false); this.ui.exhibit(null);
    const m = u.mat?.uniforms?.uReveal; if (m && m.value < 1) { const t0 = performance.now(), v0 = m.value; const tick = now => { const s = clamp((now - t0) / 1400, 0, 1); m.value = lerp(v0, 1, s); if (s < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    this.butterfly.learn(w.color); const pp = this.exhibitPerch(o); this.butterfly.land(pp.p, pp.n);
    const far = p0.distanceTo(target);
    await this.travel(clamp(900 + far * 160, 1100, 2100), s => {
      const t = ease(s);
      this.setCam(this.bezier(p0, mid, target, t), l0.clone().lerp(lookAt, smooth(t)));
    });
    this.exhibitObj = o; this.focusPoint = aim.clone(); this.sharpen(o);
    this.setPlace('exhibit', u.hallId, `${hall.def.num} · ${hall.def.title}`, '← → or swipe to glide · esc to step back');
    this.ui.exhibit(u.id);
  }
  hallZFrom(p, hall) { return p.clone().sub(dir(hall.a).multiplyScalar(R0 + hall.L / 2)).dot(dir(hall.a)); }
  async closeExhibit() {
    if (this.state !== 'exhibit') return;
    this.ui.exhibit(null);
    const p0 = this.camera.position.clone(), l0 = this.camLookPoint(), r = this.exhibitReturn;
    this.state = 'travel';
    await this.travel(1100, s => { const t = ease(s); this.setCam(p0.clone().lerp(r.pos, t), l0.clone().lerp(r.look, t)); });
    const hall = this.halls[this.place];
    this.hallZ = r.z;
    this.setPlace('hall', this.place, `${hall.def.num} · ${hall.def.title}`, 'scroll or → to glide to the next work');
    this.butterfly.forget();
  }
  stepWork(d) {
    if (this.busy) return;
    const i = ORDER.indexOf(this.currentWork), id = ORDER[i + d];
    if (id) this.goExhibit(id); else d > 0 ? this.goBackroom() : this.goRotunda();
  }

  /* ---------- jump to any work: used by the tour, the index and next/prev ---------- */
  async goExhibit(id) {
    if (this.journey?.on && !this.journey.off) return this.seekTo(this.journey.nodes.find(n => n.work === id));
    if (this.busy) return;
    const hd = hallOf(id); if (!hd) return;
    const hall = this.halls[hd.id], o = hall.exhibits.find(e => e.userData.id === id);
    if (this.place !== hd.id || !['hall', 'exhibit'].includes(this.state)) await this.goHall(hd.id, false);
    await this.openExhibit(o);
  }
  get currentWork() { return this.state === 'exhibit' ? this.exhibitObj?.userData.id : null; }
  stepWork(d) { if (this.journey?.on && !this.journey.off) return this.journeyStep(d); return this._stepWork && this._stepWork(d); }

  /* ---------- into the heart: butterfly → chrysalis → worm ---------- */
  async enterHeart(force) {
    if (this.busy) return;
    if (!this.heartOpen && !force) {
      this.heartBoost = .6;
      this.ui.toast && this.ui.toast(`The heart is sealed. It opens after you have walked the halls (${this.hallsSeen.size} of ${HALLS.length} seen).`);
      return;
    }
    if (LOOM) return this.enterLoom();
    if (PAVILION) return this.enterPavilion();
    if (this.state !== 'rotunda') await this.goRotunda(true);
    this.setHover(null); this.ui.focus(null);
    this.state = 'travel'; this.ui.place('travel', 'centerpiece', 'CenterPiece', '');
    const g = this.ring, h0 = g.h;
    if (h0 < .98) await this.travel(1200 * (1 - h0) + 200, s => { g.h = lerp(h0, 1, ease(s)); g.hT = 1; const p = this.ringPose(g.a, g.h); this.setCam(p.pos, p.look); });
    this.flockMode = 'heart';
    const toCam = dir(g.a);
    const spot = toCam.clone().multiplyScalar(CH_R + .35).setY(3.9);
    const p0 = this.camera.position.clone(), l0 = this.camLookPoint(), close = toCam.clone().multiplyScalar(CH_R + 3.4).setY(3.4);
    this.butterfly.goTo(spot, 3);
    this.heartBoost = 1;
    await this.travel(2200, s => { const t = ease(s); this.setCam(p0.clone().lerp(close, t), l0.clone().lerp(spot, t)); });
    this.butterfly.land(spot, toCam);
    await new Promise(r => setTimeout(r, 900));
    this.butterfly.fold();
    await new Promise(r => setTimeout(r, 700));
    const ch = this.chrysalis, cm = ch.userData.mat.uniforms;
    ch.position.copy(spot).addScaledVector(toCam, .12); ch.visible = true; ch.scale.setScalar(.01); ch.rotation.set(0, 0, 0);
    await this.travel(1300, s => { ch.scale.setScalar(lerp(.01, .75, ease(s))); if (s > .5) this.butterfly.hide(true); cm.uGlow.value = s; });
    await this.travel(1500, s => { cm.uGlow.value = 1 + s * 1.5; cm.uCrack.value = s * s; this.setCam(close.clone().lerp(spot, s * .35), spot); });
    this.ui.flash();
    await new Promise(r => setTimeout(r, 650));
    this.ui.leaveTo('centerpiece/index.html');
  }

  /* into the iris pavilion: your cursor butterfly leaves your hand and leads you up over the eye; the lens opens,
     it dives into the pupil, you follow it down into the dark, and CenterPiece (already loaded) fades up out of that dark */
  async enterPavilion() {
    if (this.state !== 'rotunda') await this.goRotunda(true);
    this.setHover(null); this.ui.focus(null);
    this.state = 'travel'; this.ui.place('travel', 'centerpiece', 'CenterPiece', '');
    this.ui.centerpiece?.preload(); this.inPav = true;
    if (this.journey) this.journey.off = true;   // the scroll-walk lets go of the camera for the whole trip
    const TOP = 7.5, top = new THREE.Vector3(0, TOP, 0), down = new THREE.Vector3(0, 0, 0);
    const above = new THREE.Vector3(0, TOP + 8.5, .01), deep = new THREE.Vector3(0, 2.2, .01);
    const proj = () => { const v = top.clone().project(this.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
    this.ui.cursorLead?.(proj);
    const p0 = this.camera.position.clone(), l0 = this.camLookPoint(), mid = p0.clone().multiplyScalar(.7).setY(TOP + 5.5);
    this.irisV = this.heartReveal * .16;
    await this.travel(2600, s => { const t = ease(s); this.setCam(this.bezier(p0, mid, above, t), l0.clone().lerp(top, smooth(t))); });
    const v0 = this.irisV;                       // the lens opens
    await this.travel(1300, s => { this.irisV = lerp(v0, 1, ease(s)); });
    // over the open pupil the butterfly turns back into what it was: pencil lines, a cocoon...
    const meta = this.ui.metaIn ? this.ui.metaIn(innerWidth / 2, innerHeight / 2) : null;   // the camera is straight over the pupil: it is the screen's centre
    if (meta) await meta.cocooned; else this.ui.cursorDive?.(1000);
    let shown = null;                            // ...and you sink with it into the pupil, where CenterPiece fades up out of the red
    await this.travel(1700, s => {
      const t = s * s * (1.6 - .6 * s); this.setCam(above.clone().lerp(deep, t), down);
      if (s > .76 && !shown) shown = this.ui.centerpiece?.show() || Promise.resolve();
    });
    await shown;
    if (meta) await meta.hatch();                // the cocoon splits; a pencil worm crawls out onto CenterPiece's worm
    this.state = 'centerpiece'; this.paused = true;
    try { if (location.hash !== '#centerpiece') history.pushState({ cp: 1 }, '', '#centerpiece'); } catch (e) {}
  }
  async enterLoom() {
    if (this.state !== 'rotunda') await this.goRotunda(true);
    this.setHover(null); this.ui.focus(null);
    this.state = 'travel'; this.ui.place('travel', 'centerpiece', 'CenterPiece', '');
    this.ui.centerpiece?.preload(); this.inPav = true;
    if (this.journey) this.journey.off = true;
    const c = new THREE.Vector3(0, LOOM_Y, 0), p0 = this.camera.position.clone(), l0 = this.camLookPoint();
    const d = new THREE.Vector3(p0.x, 0, p0.z).normalize(), front = d.clone().multiplyScalar(6.2).setY(LOOM_Y), near = d.clone().multiplyScalar(1.15).setY(LOOM_Y);
    const proj = () => { const v = c.clone().project(this.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
    this.ui.cursorLead?.(proj);
    // while you walk up, the ring's weaving worm stops and leaves: it crawls down the disc and slips away under the bottom rim,
    // so the ring is empty when your butterfly arrives (the worm that goes into CenterPiece is the one that hatches)
    const wv = this.creatureOK !== false && this.ui.creature ? this.loomWeave : null, wm = wv?.worm, B = wm?.body, h0 = B ? { x: B[0].x, y: B[0].y } : null;
    if (wv) wv.paused = true;
    await this.travel(2400, s => { const t = ease(s); this.setCam(p0.clone().lerp(front, t), l0.clone().lerp(c, smooth(t)));
      if (B) { const e = Math.min(1, s / .85), k = ease(e), tx = wv.W * .5, ty = wv.H * 1.12;
        B[0].x = h0.x + (tx - h0.x) * k + Math.sin(e * 9) * 14 * (1 - k); B[0].y = h0.y + (ty - h0.y) * k;   // a little wriggle as it goes
        for (let i = 1; i < B.length; i++) { const p = B[i - 1], q = B[i], d = Math.hypot(p.x - q.x, p.y - q.y) || 1, L = 7; if (d > L) { q.x = p.x + (q.x - p.x) / d * L; q.y = p.y + (q.y - p.y) / d * L; } }
        wm.x = B[0].x; wm.y = B[0].y; this.loomWormFade = 1 - smooth(Math.max(0, (e - .62) / .38)); } });   // under the rim: gone
    // live: YOUR butterfly flies into the circle, lands, folds, and is spun into a cocoon; the cocoon cracks and a worm comes out;
    // the circle turns to water and the same worm goes through it into CenterPiece, where it becomes CenterPiece's worm
    const cr = this.ui.creature;
    if (cr && this.loomMat && this.loomFace) {
      const U = this.loomMat.uniforms, close = d.clone().multiplyScalar(4.9).setY(LOOM_Y);
      U.uVid.value = this.loomDark; U.uRip.value = 0; U.uSuck.value = 0;
      cr.ringFn = () => this.ringScreen(c);
      cr.onFocus = (p, dt) => { const k = 1 - Math.exp(-dt * 4); U.uFocusC.value.x += (.5 + p[0] * .5 - U.uFocusC.value.x) * k; U.uFocusC.value.y += (.5 + p[1] * .5 - U.uFocusC.value.y) * k; };
      if (this.loomWeave) this.loomWeave.paused = true;                     // the art-making stops (its worm has already gone), the circle dims
      this.ui.cpWormHide?.(true);   // CenterPiece's own worm stays out of sight: the only worm that goes in is the one about to hatch
      const story = cr.enterStory(this.ui.cursorCapture?.()), run = story.run();
      await this.travel(5600, s => { if (!B) this.loomWormFade = 1 - smooth(Math.min(1, s * 6)); else this.loomWormFade = 0;
        U.uFocus.value = smooth(Math.min(1, s * 3)); this.setCam(front.clone().lerp(close, ease(s)), c); });
      await run;
      const [hx, hy] = story.headRing(); U.uRipC.value.set(.5 + hx * .5, .5 + hy * .5);
      // it crawls straight to its sleeping spot in CenterPiece, at its own size there, so nothing jumps or shrinks when CenterPiece takes over
      const rmW = Math.min(innerWidth, innerHeight * 16 / 9), rmH = rmW * 9 / 16, now0 = performance.now() + 1450;
      const sx = (innerWidth - rmW) / 2 + (.5 + Math.cos(now0 / 1500) * .035) * rmW, sy = (innerHeight - rmH) / 2 + (.335 + Math.sin(now0 / 1500) * .018) * rmW;
      const port = story.portal(1450, sx, sy, .009 * rmW, .0056 * rmW);
      let shown = null;
      await this.travel(2400, s => {
        U.uRip.value = smooth(Math.min(1, s * 2.2)); U.uRipT.value = s * 7; U.uSuck.value = smooth(Math.max(0, (s - .4) / .6)) * .75; U.uFocus.value = 1 - smooth(Math.min(1, s * 1.5));
        const t = s * s * (1.6 - .6 * s); this.setCam(close.clone().lerp(near, t), c);
        this.loomRings?.forEach((r, i) => { r.scale.setScalar(1 + t * (.55 + i * .2)); r.rotation.z = t * (i ? -1.2 : .8); });
        if (s > .66 && !shown) shown = (async () => { await port; await this.ui.centerpiece?.show({ before: () => this.ui.cpArrive?.(story.wormScreen(), 1) }); })();
      });
      await shown; cr.ringFn = null; cr.onFocus = null; cr.focusAt = null; U.uFocus.value = 0;
      story.follow(() => this.ui.cpWormGet?.(), 700);                       // it lies exactly on CenterPiece's own worm, until the water settles
      this.paused = true; this.state = 'centerpiece';
      try { if (location.hash !== '#centerpiece') history.pushState({ cp: 1 }, '', '#centerpiece'); } catch (e) {}
      return;
    }
    const film = this.ui.film;
    if (film && this.loomMat && await film.can(['in', 'hatch'])) {
      const U = this.loomMat.uniforms, vIn = film.el('in'), vHatch = film.el('hatch'), close = d.clone().multiplyScalar(4.9).setY(LOOM_Y);
      // 1. the art-making stops: the weave holds still and the worm on the ring slips away
      if (this.loomWeave) this.loomWeave.paused = true;
      await this.travel(650, s => { this.loomWormFade = 1 - smooth(s); });
      // 2. your butterfly flies into the circle, just as the film's butterfly flies in
      U.uVid.value = this.vidTex(vIn); vIn.currentTime = 0; await vIn.play().catch(() => {});
      { const e = new THREE.Vector3(LOOM_RL, 0, 0).applyMatrix4(this.loomFace.matrixWorld).project(this.camera), m = c.clone().project(this.camera);
        const discPx = Math.hypot((e.x - m.x) * innerWidth / 2, (e.y - m.y) * innerHeight / 2) * 2;
        this.ui.cursorInto ? this.ui.cursorInto(discPx * .42, 750) : this.ui.cursorDive?.(900); }   // your butterfly grows into the film's, in the middle of the ring
      const dolly = this.travel(vIn.duration * 1000 || 5500, s => { U.uMix.value = smooth(Math.min(1, s * 6)); this.setCam(front.clone().lerp(close, ease(s)), c); });
      // 3. it turns back into a cocoon on the ring; the cocoon cracks and the worm drops into the dark
      await this.vidEnd(vIn, .04); await dolly;
      U.uVid.value = this.vidTex(vHatch); vHatch.currentTime = 0; await vHatch.play().catch(() => {});
      await this.vidEnd(vHatch, 1.45); vHatch.pause();                  // the worm is out, looking round
      // 4. the display turns to liquid around it; you pass through the surface, into CenterPiece,
      //    where the worm comes in from where you came through and crawls off to its spot to sleep
      U.uRipC.value.set(.5, .445); let shown = null;
      await this.travel(2400, s => {
        U.uRip.value = smooth(Math.min(1, s * 2.2)); U.uRipT.value = s * 7; U.uSuck.value = smooth(Math.max(0, (s - .4) / .6)) * .75;
        const t = s * s * (1.6 - .6 * s); this.setCam(close.clone().lerp(near, t), c);
        this.loomRings?.forEach((r, i) => { r.scale.setScalar(1 + t * (.55 + i * .2)); r.rotation.z = t * (i ? -1.2 : .8); });
        if (s > .66 && !shown) shown = this.ui.centerpiece?.show({ ripple: true, before: () => this.ui.cpArrive?.() }) || Promise.resolve();
      });
      await shown;
      this.paused = true; this.state = 'centerpiece';
      try { if (location.hash !== '#centerpiece') history.pushState({ cp: 1 }, '', '#centerpiece'); } catch (e) {}
      vHatch.pause();
      return;
    }
    const meta = this.ui.metaIn ? this.ui.metaIn(innerWidth / 2, innerHeight / 2) : null;   // (no film: the pencil version)
    if (meta) await meta.cocooned; else this.ui.cursorDive?.(1000);
    let shown = null;                                                    // you push in, into the weave itself
    await this.travel(1900, s => {
      const t = s * s * (1.6 - .6 * s); this.setCam(front.clone().lerp(near, t), c);
      if (s > .7 && !shown) shown = this.ui.centerpiece?.show() || Promise.resolve();
    });
    await shown;
    if (meta) await meta.hatch();
    this.state = 'centerpiece'; this.paused = true;
    try { if (location.hash !== '#centerpiece') history.pushState({ cp: 1 }, '', '#centerpiece'); } catch (e) {}
  }
  async leavePavilion() {
    if (LOOM) return this.leaveLoom();
    if (this.state !== 'centerpiece') return;
    const TOP = 7.5, top = new THREE.Vector3(0, TOP, 0), down = new THREE.Vector3(0, 0, 0);
    const above = new THREE.Vector3(0, TOP + 8.5, .01), deep = new THREE.Vector3(0, 2.2, .01);
    this.state = 'travel';
    const meta = this.ui.metaOut ? this.ui.metaOut() : null;   // CenterPiece's worm spins itself a pencil cocoon...
    if (meta) await meta.cocooned;
    this.paused = false;
    this.setCam(deep, down, true);
    await this.ui.centerpiece?.hide();           // ...CenterPiece fades back into the red inside the pavilion
    await this.travel(1500, s => { const t = 1 - Math.pow(1 - s, 2.2); this.setCam(deep.clone().lerp(above, t), down); });
    if (meta) await meta.burst();                // the cocoon unwinds into a crisp butterfly, which flies off as your cursor
    else this.ui.cursorRelease?.(innerWidth / 2, innerHeight / 2);
    await this.travel(1100, s => { this.irisV = lerp(1, this.heartReveal * .16, ease(s)); });
    this.irisV = null;
    const end = this.ringPose(this.ring.a, 1), mid = end.pos.clone().multiplyScalar(.7).setY(TOP + 5.5);
    await this.travel(2400, s => { const t = ease(s); this.setCam(this.bezier(above, mid, end.pos, t), top.clone().lerp(end.look, smooth(t))); if (s > .6) this.inPav = false; });
    if (this.journey) { this.journeyStartS = this.journey.nodes[this.journey.nodes.length - 2].d; this.journey.on = false; }   // pick the walk up again just before the heart
    this.inPav = false; this.enterRotunda();
  }

  // where the ring is on screen: its centre and its radius in pixels (the creature layer rides on it)
  ringScreen(c) {
    if (!this.loomFace) return null;
    const m = c.clone().project(this.camera), e = new THREE.Vector3(LOOM_RL - .06, 0, 0).applyMatrix4(this.loomFace.matrixWorld).project(this.camera);
    return [(m.x + 1) / 2 * innerWidth, (1 - m.y) / 2 * innerHeight, Math.hypot((e.x - m.x) * innerWidth / 2, (e.y - m.y) * innerHeight / 2)];
  }
  ringPxAt(dist) { return (LOOM_RL - .06) / (dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) * innerHeight / 2; }
  vidTex(v) {
    if (!v._tex) {
      // the video must be on the page and visible (if only as a speck) or Chrome stops handing its frames to the texture
      let host = document.getElementById('ring-film'); if (!host) { host = document.createElement('div'); host.id = 'ring-film'; host.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;overflow:hidden;opacity:.01;pointer-events:none;z-index:1'; document.body.append(host); }
      host.append(v); v.style.cssText = 'width:2px;height:2px;opacity:1';
      v._tex = new THREE.VideoTexture(v); v._tex.colorSpace = THREE.SRGBColorSpace;
    }
    return v._tex;
  }
  vidEnd(v, before = .05) { return new Promise(r => { const chk = () => (v.ended || (v.duration && v.currentTime >= v.duration - before)) ? r() : requestAnimationFrame(chk); chk(); }); }
  async leaveLoom() {
    if (this.state !== 'centerpiece') return;
    this.state = 'travel';
    const cr = this.ui.creature;
    if (cr && this.loomMat && this.loomFace) {
      const U = this.loomMat.uniforms, c = new THREE.Vector3(0, LOOM_Y, 0), cp0 = this.camera.position.clone(), d = new THREE.Vector3(cp0.x, 0, cp0.z).normalize();
      const close = d.clone().multiplyScalar(4.9).setY(LOOM_Y), near = d.clone().multiplyScalar(1.15).setY(LOOM_Y);
      // behind CenterPiece you are right at the ring again
      this.paused = false; this.setCam(near, c, true); if (this.loom) this.loom.rotation.y = Math.atan2(near.x, near.z);
      this.loomRings?.forEach((r, i) => { r.scale.setScalar(1.55 + i * .2); r.rotation.z = i ? -1.2 : .8; });
      U.uVid.value = this.loomDark; U.uMix.value = 0; U.uFocus.value = 1; U.uFocusC.value.set(.5, .5 + (.5 - .58 * .45) * .5); this.loomWormFade = 0; if (this.loomWeave) this.loomWeave.paused = true;
      this.ui.cpLeave?.(); await new Promise(r => setTimeout(r, 1500));     // CenterPiece's worm wakes and crawls toward you, growing
      const story = cr.leaveStory({ Rc: this.ringPxAt(4.9) });
      story.takeFrom(this.ui.cpWormGet?.()); this.ui.cpWormHide?.(true);    // the same worm, now on the museum's layer
      await story.climb(1400);                                              // it climbs a line of silk let down from above...
      await story.spin(2400);                                               // ...and is spun into its cocoon, there over CenterPiece
      U.uRipC.value.set(.5, .6); U.uRip.value = 1; U.uSuck.value = .75;
      this.ui.centerpiece?.hide({ ripple: true });                          // CenterPiece turns to water; you come back out through the ring
      const hold = story.hold(2800, () => this.ringScreen(c));
      await this.travel(2800, s => { const t = ease(s); this.setCam(near.clone().lerp(close, t), c); U.uRip.value = 1 - smooth(s); U.uRipT.value = 7 + s * 7; U.uSuck.value = .75 * (1 - smooth(Math.min(1, s * 1.6)));
        this.loomRings?.forEach((r, i) => { r.scale.setScalar(1 + (1 - t) * (.55 + i * .2)); r.rotation.z = (1 - t) * (i ? -1.2 : .8); }); });
      U.uRip.value = 0; U.uSuck.value = 0; await hold;
      cr.ringFn = () => this.ringScreen(c); cr.onFocus = (p, dt) => { const k = 1 - Math.exp(-dt * 4); U.uFocusC.value.x += (.5 + p[0] * .5 - U.uFocusC.value.x) * k; U.uFocusC.value.y += (.5 + p[1] * .5 - U.uFocusC.value.y) * k; };
      story.toRing();                 // the cocoon now hangs in the ring
      await story.hatch();                                                  // it cracks; your butterfly climbs out and opens its wings
      this.ui.cursorAdopt?.(await story.flyOff(() => this.ui.cursorPos?.()));   // and flies to your hand: your cursor again
      cr.ringFn = null; cr.onFocus = null; cr.focusAt = null; this.ui.cpWormHide?.(false);
      await this.travel(1100, s => { U.uFocus.value = 1 - smooth(s); this.loomWormFade = smooth(s); });   // the ring goes back to making art
      if (this.loomWeave) this.loomWeave.paused = false;
      const end = this.ringPose(this.ring.a, 1), from = this.camera.position.clone(), back = d.clone().multiplyScalar(10.5).setY(LOOM_Y + .6);
      await this.travel(2600, s => { const t = ease(s); this.setCam(this.bezier(from, back, end.pos, t), c.clone().lerp(end.look, smooth(t))); if (s > .5) this.inPav = false; });
      if (this.journey) { this.journeyStartS = this.journey.nodes[this.journey.nodes.length - 2].d; this.journey.on = false; }
      this.inPav = false; this.enterRotunda(); return;
    }
    const film = this.ui.film;
    if (film && this.loomMat && await film.can(['spin', 'emerge'])) {
      const U = this.loomMat.uniforms, vSpin = film.el('spin'), vEm = film.el('emerge');
      const c = new THREE.Vector3(0, LOOM_Y, 0), cp0 = this.camera.position.clone(), d = new THREE.Vector3(cp0.x, 0, cp0.z).normalize();
      const front = d.clone().multiplyScalar(6.2).setY(LOOM_Y), close = d.clone().multiplyScalar(4.9).setY(LOOM_Y), near = d.clone().multiplyScalar(1.15).setY(LOOM_Y);
      // behind CenterPiece, you are right at the ring, already showing the film: the worm climbs up and spins its cocoon
      this.paused = false; this.setCam(near, c, true); if (this.loom) this.loom.rotation.y = Math.atan2(near.x, near.z);
      this.loomRings?.forEach((r, i) => { r.scale.setScalar(1.55 + i * .2); r.rotation.z = i ? -1.2 : .8; });
      this.ui.cpLeave?.(); await new Promise(r => setTimeout(r, 1500));   // CenterPiece's worm wakes and crawls toward you, growing
      U.uVid.value = this.vidTex(vSpin); vSpin.currentTime = 0; await vSpin.play().catch(() => {}); U.uMix.value = 1; this.loomWormFade = 0;
      if (this.loomWeave) this.loomWeave.paused = true;
      U.uRipC.value.set(.5, .39); U.uRip.value = 1; U.uSuck.value = .75;
      this.ui.centerpiece?.hide({ ripple: true });                        // you pass back out through the surface...
      // ...and come out of the ring as the ripples settle and the worm climbs up to spin its cocoon
      await this.travel(2800, s => { const t = ease(s); this.setCam(near.clone().lerp(close, t), c); U.uRip.value = 1 - smooth(s); U.uRipT.value = 7 + s * 7; U.uSuck.value = .75 * (1 - smooth(Math.min(1, s * 1.6)));
        this.loomRings?.forEach((r, i) => { r.scale.setScalar(1 + (1 - t) * (.55 + i * .2)); r.rotation.z = (1 - t) * (i ? -1.2 : .8); }); });
      U.uRip.value = 0; U.uSuck.value = 0;
      await this.vidEnd(vSpin, .04);
      U.uVid.value = this.vidTex(vEm); vEm.currentTime = 0; await vEm.play().catch(() => {});   // the cocoon cracks; the butterfly climbs out and opens its wings
      await this.vidEnd(vEm, .9);
      const v = c.clone().project(this.camera);                           // it flies out of the ring and becomes your cursor
      this.ui.cursorArrive?.((v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight);
      await this.travel(900, s => { U.uMix.value = 1 - smooth(s); this.loomWormFade = smooth(s); });   // and the ring goes back to making art
      if (this.loomWeave) this.loomWeave.paused = false; vEm.pause();
      const end = this.ringPose(this.ring.a, 1), from = this.camera.position.clone(), back = d.clone().multiplyScalar(10.5).setY(LOOM_Y + .6);   // back away from the ring first, then round to where you were
      await this.travel(2600, s => { const t = ease(s); this.setCam(this.bezier(from, back, end.pos, t), c.clone().lerp(end.look, smooth(t))); if (s > .5) this.inPav = false; });
      if (this.journey) { this.journeyStartS = this.journey.nodes[this.journey.nodes.length - 2].d; this.journey.on = false; }
      this.inPav = false; this.enterRotunda(); return;
    }
    const meta = this.ui.metaOut ? this.ui.metaOut() : null;   // the worm spins itself a cocoon...
    if (meta) await meta.cocooned;
    this.paused = false;
    const c = new THREE.Vector3(0, LOOM_Y, 0), cp = this.camera.position.clone();
    const d = new THREE.Vector3(cp.x, 0, cp.z).normalize(), front = d.clone().multiplyScalar(6.2).setY(LOOM_Y), near = d.clone().multiplyScalar(1.15).setY(LOOM_Y);
    this.setCam(near, c, true);
    await this.ui.centerpiece?.hide();                           // ...CenterPiece melts back into the weave
    await this.travel(1600, s => { const t = 1 - Math.pow(1 - s, 2.2); this.setCam(near.clone().lerp(front, t), c); });
    if (meta) await meta.burst(); else this.ui.cursorRelease?.(innerWidth / 2, innerHeight / 2);
    const end = this.ringPose(this.ring.a, 1);
    await this.travel(2200, s => { const t = ease(s); this.setCam(front.clone().lerp(end.pos, t), c.clone().lerp(end.look, smooth(t))); if (s > .5) this.inPav = false; });
    if (this.journey) { this.journeyStartS = this.journey.nodes[this.journey.nodes.length - 2].d; this.journey.on = false; }
    this.inPav = false; this.enterRotunda();
  }

  /* coming back: the worm spins a chrysalis, the butterfly bursts out */
  async returnFromHeart() {
    this.ceilings.forEach(c => (c.visible = true));
    this.fog.density = this.baseFog;
    const g = this.ring; g.h = g.hT = 1;
    const toCam = dir(g.a);
    const spot = toCam.clone().multiplyScalar(CH_R + .35).setY(3.9);
    const close = toCam.clone().multiplyScalar(CH_R + 3.4).setY(3.4);
    this.setCam(close, spot, true);
    this.state = 'travel'; this.flockMode = 'heart';
    const ch = this.chrysalis, cm = ch.userData.mat.uniforms;
    ch.position.copy(spot).addScaledVector(toCam, .12); ch.visible = true; ch.scale.setScalar(.75); ch.rotation.set(0, 0, 0);
    this.butterfly.hide(true); this.butterfly.teleport(spot); this.butterfly.fold();
    await this.travel(1600, s => { cm.uGlow.value = 1 + s * 1.6; cm.uCrack.value = s * s; });
    this.ui.flash();
    ch.visible = false; cm.uCrack.value = 0; cm.uGlow.value = 0;
    this.butterfly.hide(true);   // stays hidden (the cursor is the butterfly)
    this.butterfly.goTo(this.camera.position.clone().lerp(spot, .4).add(new THREE.Vector3(1.2, .8, 0)), 4);
    this.flockMode = null;
    const end = this.ringPose(g.a, 1);
    await this.travel(2400, s => { const t = ease(s); this.setCam(close.clone().lerp(end.pos, t), spot.clone().lerp(end.look, t)); });
    if (this.journey) { this.journeyStartS = this.journey.nodes[this.journey.nodes.length - 2].d; this.journey.on = false; }
    this.enterRotunda();
  }

  /* phones and tablets hold every picture small (memory); the work you stand at streams its full-size picture in, like a game streaming
     textures, and drops it again when you walk on: sharp where you look, light everywhere else */
  sharpen(obj) {
    if (!DEVICE.mobile || obj === this._sharpObj) return;
    for (const t of this._sharpTex || []) { const u = t.userData; if (u.lowImg) { const big = t.image; t.image = u.lowImg; u.lowImg = null; t.needsUpdate = true; try { big && big.close && big.close(); } catch (e) {} } u.want = false; }
    this._sharpObj = obj; this._sharpTex = [];
    if (!obj) return;
    const seen = new Set();
    const u0 = obj.userData || {}, roots = [obj, u0.plinth, u0.frame, u0.obj, u0.book].filter(r => r && r.isObject3D);   // (the click target is a stand-in: the picture lives on its frame / plinth)
    for (const r of roots) r.traverse(o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap']) { const t = m && m[k]; if (t && t.userData && t.userData.fullSrc && !seen.has(t) && t.image) seen.add(t); } });
    for (const t of seen) {
      this._sharpTex.push(t); const u = t.userData; u.want = true;
      const bitmap = typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap;
      const L = bitmap ? (this._fullBmp || (this._fullBmp = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: t.flipY ? 'none' : 'flipY', premultiplyAlpha: 'none' }))) : (this._fullImg || (this._fullImg = new THREE.ImageLoader()));
      loadFull(L, u.fullSrc, img => { if (!u.want || u.lowImg) { try { img.close && img.close(); } catch (e) {} return; } u.lowImg = t.image; t.image = img; t.needsUpdate = true; }, () => {});
    }
  }
  /* ?stats: a small panel with the loading stages and the live numbers (to read off a phone in a screenshot) */
  mark(name) { (this._marks || (this._marks = [])).push([name, performance.now() / 1000]); }
  statsTick() {
    const S = this._stats, now = performance.now(); if (now - (S.t || 0) < 500) return; S.t = now;
    const r = this.renderer, i = r.info, M = this._marks || [];
    S.el.textContent = `${this.gpu.device} · ${this.gpu.tier} · ${(this.gpu.gpu || '').slice(0, 38)}
`
      + `fps ${(this.fps || 0).toFixed(0)}  res ${this.pr.toFixed(2)}x  ${innerWidth}x${innerHeight}@${devicePixelRatio}
`
      + `draws ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k  shaders ${i.programs.length}  tex ${i.memory.textures}
`
      + `${this.state}${this.ease ? ' · eased' : ''}
` + M.map(([n, t]) => `${n} ${t.toFixed(1)}s`).join('  ');
  }
  fovFor(v) {   // a tall screen (phone or tablet held upright) sees only a slot sideways: open the view up (at most 90° tall)
    const a = this.camera.aspect; if (a >= 1) return v;
    // keep what a laptop (16:10) sees across: a framed work zoomed to 30° stays whole on a phone, not cropped at both sides
    const t = Math.tan(THREE.MathUtils.degToRad(v / 2)) * 1.6 / a;
    return Math.min(90, Math.max(v, 2 * Math.atan(t) * 180 / Math.PI));
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight);
    const rp = this.pr * (this.Q.reflect || 1);
    this.reflectors.forEach(m => m.getRenderTarget().setSize(innerWidth * rp, innerHeight * rp));
    if (this.dust) this.dust.material.uniforms.uPx.value = this.pr;
  }

  /* jump straight into the Rotunda (used after changing quality) */
  startAtRotunda() {
    this.ring.h = this.ring.hT = 1;
    const p = this.ringPose(this.ring.a, 1); this.setCam(p.pos, p.look, true);
    this.butterfly.teleport(new THREE.Vector3(2, 4, 6));
    this.enterRotunda();
  }

  /* =========================================================
     LOOP
     ========================================================= */
  loop(now) {
    requestAnimationFrame(this.loop);
    if (!this.journey && this.halls && this.backroom && this.desk) this.buildJourney();
    if (this.paused) { this.clock.getDelta(); return; }
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const t = (TIME.value += dt);
    if (this.film) this.film.uniforms.uTime.value = t;
    // mirrors: only the two nearest floors reflect, once a frame each (every mirror re-draws the whole museum)
    if (this.reflectors?.length) {
      this._mirrorFrame = (this._mirrorFrame || 0) + 1;
      const cp = this.camera.position, W = this._mirrorPos ||= new Map();
      const near = this.reflectors.map(r => { let p = W.get(r); if (!p) { r.updateWorldMatrix(true, false); const b = new THREE.Box3().setFromObject(r); p = { b }; W.set(r, p); } return [r, p.b.distanceToPoint(cp)]; }).sort((x, y) => x[1] - y[1]);
      this._mirrorOK = new Set(near.slice(0, 2).map(x => x[0]));
    }
    // heartbeat: lub-dub
    const p = t % 1.15;
    const beat = Math.exp(-Math.pow(p / .07, 2)) + .6 * Math.exp(-Math.pow((p - .24) / .08, 2));
    if (p < (this.lastBeatP ?? 1)) {     // a new heartbeat: louder the closer you are to the heart
      this.ui.sound?.heartbeat();
    }
    this.lastBeatP = p;
    this.shared.uBeat.value = beat;
    this.heartBoost = (this.heartBoost || 0) * Math.exp(-dt * .5);
    this.heartLight.intensity = this.heartBase * (.55 + beat * .9 + this.heartBoost);
    for (const f of this.floaters) {
      const u = f.piv.userData; u.ang += u.sp * dt;
      f.piv.position.set(Math.sin(u.ang) * u.r, u.y + Math.sin(t * .35 + u.bob) * .04, Math.cos(u.ang) * u.r);
      f.piv.rotation.y = u.ang;                     // each work faces outward as it orbits
      // sealed: the works are soft dark-red shadows cast on the lantern's paper; open: themselves again
      f.m.material.opacity = .22 + .78 * this.heartReveal; f.m.visible = true;
    }
    this.heartReveal += ((this.heartOpen ? 1 : 0) - this.heartReveal) * (1 - Math.exp(-dt * .8));
    this.glassMat.opacity = lerp(.5, .1, this.heartReveal); this.glassMat.color.set('#ffffff');
    this.coreMat.color.set('#ff2a1a').multiplyScalar((.9 + beat * 1.8 + this.heartBoost * 2) * (.35 + .65 * this.heartReveal));
    this.coreHaze.material.uniforms.uI.value = .16 + beat * .22;
    this.heartGlow.material.color.set('#ff2a1a').multiplyScalar(1 + beat * 1.6);
    for (const k in this.veins) { const u = this.veins[k].uniforms; u.uBoost.value *= Math.exp(-dt * .8); }
    // gentle mouse look everywhere (smoothed)
    this.lookOff.x += (this.look.x * .14 - this.lookOff.x) * (1 - Math.exp(-dt * 3));
    this.lookOff.y += (this.look.y * .07 - this.lookOff.y) * (1 - Math.exp(-dt * 3));

    if (this.travelFn) this.travelFn(now);
    else if (this.journey && this.journey.on && !this.journey.off) this.updateJourney(dt);
    else if (this.state === 'rotunda') {
      this.updateRing(dt);
      const pose = this.ringPose(this.ring.a, this.ring.h);
      this.goalPos.copy(pose.pos); this.goalLook.copy(pose.look);
    } else if (this.state === 'hall') {
      const hall = this.halls[this.place];
      const pos = this.hallPoint(hall, 0, EYE, this.hallZ);
      const look = this.hallPoint(hall, -this.lookOff.x * 18, EYE + this.lookOff.y * 14, this.hallZ + 6);
      this.goalPos.copy(pos); this.goalLook.copy(look);
    } else if (this.state === 'backroom') {
      this.goalPos.copy(this.deskCam).add(new THREE.Vector3(-this.look.x * .5, this.look.y * .25, 0)); this.goalLook.copy(this.deskLook);
    }

    if (this.state !== 'map' || (this.journey && this.journey.on)) this.springCam(dt);
    else { this.camera.position.copy(this.goalPos); this.lookCur.copy(this.goalLook); this.camera.lookAt(this.goalLook); }
    { const fg = this.fovFor(this.journey?.on && !this.journey.off && this.fovGoal ? this.fovGoal : 55);   // the vitrine zoom (see updateJourney); taller on a portrait screen
      if (Math.abs(this.camera.fov - fg) > .02) { this.camera.fov += (fg - this.camera.fov) * (1 - Math.exp(-dt * 3.5)); this.camera.updateProjectionMatrix(); } }
    { const want = .1;           // 10 cm: twice the depth precision of 5 cm (less z-fighting far off); nothing is ever nearer than that. (the view from above is cut by a level clipping plane in the render pass, not by the near plane)
      if (Math.abs(this.camera.near - want) > .001) { this.camera.near = want; this.camera.updateProjectionMatrix(); } }
    if (this.spinners) for (const o of this.spinners) o.rotation[o.userData.spinAxis || 'y'] += dt * (o.userData.spin || .18);
    if (this.tickers) for (const f of this.tickers) f(TIME.value, dt);   // small looping animations (Hall 01's folding carton)   // slow turntables (and Hall 05's records)
    if (this.chandeliers) for (const c of this.chandeliers) { c.rotation.z = Math.sin(t * .6 + c.userData.sway) * .012; c.rotation.x = Math.cos(t * .5 + c.userData.sway) * .01; }
    if (this.halo) this.halo.rotation.y += dt * .015;
    this.updateReel(t);
    if (this.neon) {                                         // the neon flickers on when you reach the back room, hums after
      const want = this.state === 'backroom' || this.travelTo === 'backroom' || this.desk.active ? 1 : 0;
      if (want && !this.neonOn) this.neonT = t;
      this.neonOn = want;
      const k = want ? Math.min(1, (t - (this.neonT || 0)) / 1.6) : 0;
      const flick = k < 1 ? (Math.sin(t * 61) > .2 || Math.sin(t * 23) > .7 ? 1 : .15) * k : .94 + .06 * Math.sin(t * 50) * Math.sin(t * 7.3);
      this.neon.material.color.setScalar(want ? 1.6 * flick : .06); this.neonGlow.material.uniforms.uI.value = want ? .28 * flick : 0;
    }
    if (this.strip) this.strip.material.uniforms.uOff.value += dt * .22 * (1 + Math.min(4, Math.abs(this.ring.vel || 0) * 6))   /* it speeds up while you turn */;      // the strip keeps running, like a beat
    if (this.tape) this.tape.material.uniforms.uOff.value += dt * .16;
    if (this.roomTape) this.roomTape.material.uniforms.uOff.value += dt * .12;   // the words climb the spiral
    if (this.lanternPool) this.lanternPool.visible = false;
    if (this.weave && this.place !== 'backroom' && this.zoneVis('rot') && this.zones?.heartSeen !== false) { const wv = this.weave; wv.partial = !this.perfOff; wv.step(dt);
      if (!wv.users) { wv.users = []; this.scene.traverse(o => { const u = o.material?.uniforms?.uWeave; if (u && u.value === wv.texture && !wv.users.includes(u)) wv.users.push(u); }); }   // the shaders that show it (for the double-buffer swap)
      wv.upload?.(this.renderer, wv.users); }   // the worm never stops weaving (CenterPiece is seen from the hall doorways too)
    if (this.hallStrips) for (const s of this.hallStrips) s.t.offset.x += dt * .18 * s.dir;
    if (this.runwayModels && this.zoneVis('campaigns')) this.updateRunway();
    if (this.books && this.zoneVis('editorial')) for (const b of this.books) b.update();
    if (this.webMat) { this.webBoost = (this.webBoost || 0) * Math.exp(-dt * 2.2); const sp = .09 + this.webBoost * .9; this.webMat.uniforms.uOff.value += dt * sp; for (const r of this.rollers) r.rotation.x += dt * sp * 3.1 / .32; }   // the paper runs, the rollers turn; a page turn sends a surge through the press
    this.ceilEye.update(dt, t, this.camera, beat);
    if (this.roomEye) this.roomEye.update(dt, t, this.camera, beat);
    if (this.heartTitle) this.heartTitle.material.opacity = this.inPav ? 0 : 1 - smooth(clamp((this.camera.position.y - 9.5) / 3, 0, 1));   // seen from above, the title steps aside for the eye
    if (this.loomWorm && this.loomWeave) {
      const wv = this.loomWeave, rD = LOOM_RL - .06;
      const toDisc = (bx, by) => { let x = (bx / wv.W - .5) * 2 * rD, y = (.5 - by / wv.H) * 2 * rD; const r = Math.hypot(x, y), mx = rD * .86; if (r > mx) { x *= mx / r; y *= mx / r; } return [x, y]; };
      const B = wv.worm.body, P = this._lwp || (this._lwp = B.map(() => [0, 0]));
      B.forEach((b, i) => { const q = toDisc(b.x, b.y); P[i][0] = q[0]; P[i][1] = q[1]; });
      this.loomWorm.update(P, { rad: .15, fade: this.loomWormFade ?? 1, hue: TEAL, glow: .9, shadow: .35, lift: 1 });
    }
    if (this.loom) {   // the loom turns, unhurried, to face you
      const cp = this.camera.position, want = Math.atan2(cp.x, cp.z) + (this.loomYawOff || 0);
      let d = want - this.loom.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.loom.rotation.y += d * (1 - Math.exp(-dt * (this.inPav ? 6 : .9)));
    }
    if (this.blades) this.setIris(this.irisV != null ? this.irisV : this.heartReveal * (.16 + .03 * Math.sin(t * 1.1)));   // sealed: shut; open: ajar, breathing
    if (this.redRoom) {
      this.roomMat.uniforms.uSeal.value = 1 - this.heartReveal;
      const c = this.camera.position, want = Math.atan2(c.x, c.z);               // the doorway turns to face you
      let d = want - this.redRoom.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.redRoom.rotation.y += d * (1 - Math.exp(-dt * 3.5));
    }
    if (this.flames) {                                   // candles breathe: each flame flickers on its own
      for (const f of this.flames) { const p = f.userData.ph + t; const k = .82 + .12 * Math.sin(p * 9.1) + .08 * Math.sin(p * 23.7) + .05 * Math.sin(p * 3.3);
        f.scale.set(1 / Math.sqrt(k), 1.8 * k, 1 / Math.sqrt(k)); }
      this.chMats.flame.color.setRGB(1, .784, .518).multiplyScalar(3.2 * (.92 + .06 * Math.sin(t * 7.3) + .04 * Math.sin(t * 17.9)));
      this.chMats.crystal.emissiveIntensity = .12 + .5 * Math.pow(Math.max(0, Math.sin(t * 1.7)), 14) + .3 * Math.pow(Math.max(0, Math.sin(t * 2.9 + 1)), 18);
    }
    if (this.shaftPulse > .001 && this.lightShaft) { this.shaftPulse *= Math.exp(-dt * .7); const m = this.lightShaft.material.uniforms; m.uI.value = .09 + this.shaftPulse * .5; m.uColor.value.set('#fff4e6').lerp(new THREE.Color('#ff5a3a'), this.shaftPulse); }
    if (this.crownSpin > .001 && this.crownRing) { this.crownSpin *= Math.exp(-dt * .9); this.crownRing.rotation.z += dt * this.crownSpin * 2.4; }
    this.updateRoomLight(dt);
    this.updateHallLights(dt);
    this.updateFocus(dt);
    { const on = !!this.desk?.active, d = this.desk;   // shadows: redrawn only while something on the desk moves (and for a moment after arriving)
      if (on && !this._deskWas) this._shadowFor = 45; this._deskWas = on;
      this.renderer.shadowMap.needsUpdate = on && (this.perfOff || d.awake || d.held || (this._shadowFor = (this._shadowFor || 0) - 1) > 0); }
    this.adapt(); if (this._stats) this.statsTick();
    this.hoverTest();
    this.butterflyBrain(dt, t);
    this.butterfly.update(dt);
    if (this.butterfly.mode === 'fly' && this.butterfly.pos.distanceTo(this.camera.position) < 2.2 && t > (this.flutterAt || 0)) { this.flutterAt = t + 1.6; this.ui.sound?.flutter(); }
    this.flockBrain(dt, t);
    if (this.zoneVis('backroom') || this.desk?.active) this.desk?.update(dt);
    // a slow, natural sway, as if you are standing in the room
    const sw = this.state === 'backroom' ? 0 : 1;
    this.sway.set((Math.sin(t * .53) * .016 + Math.sin(t * 1.31) * .006) * sw, (Math.sin(t * .71 + 1) * .011) * sw, (Math.cos(t * .43) * .012) * sw);
    this.camera.position.add(this.sway);
    if (this._devCam) { this._devCam(); this.sway.set(0, 0, 0); if (this._devHeart != null) this.heartReveal = this._devHeart; }   // DEV ONLY
    this.ui.sound?.listen(this.camera);
    this.updateZones();
    this.composer.render();
    this.camera.position.sub(this.sway);
  }

  updateFocus(dt) {
    const sharp = this.state === 'exhibit' && this.exhibitObj?.userData.salon;   // a whole wall of photographs: everything in focus
    const u = this.focus.uniforms, on = this.state === 'exhibit' && this.focusPoint && !sharp;
    if (on) { const s = this.focusPoint.clone().project(this.camera); u.uC.value.set(s.x * .5 + .5, s.y * .5 + .5); }
    u.uAmt.value += ((on ? 1 : 0) - u.uAmt.value) * (1 - Math.exp(-dt * 2.5));
    u.uAsp.value = innerWidth / innerHeight;
    this.focus.enabled = !this.ease && (this.perfOff || u.uAmt.value > .006);   // nothing to blur (or a struggling GPU): skip the whole full-screen pass
    // at a work, keep a wider area sharp and drop the lens fringing, so lettering on a package stays crisp
    u.uR.value = on ? .44 : .34;
    if (this.film) { const f = this.film.uniforms, k = 1 - Math.exp(-dt * 3);
      f.uCA.value += ((sharp ? 0 : on ? .0006 : .003) - f.uCA.value) * k; f.uGrain.value += ((sharp ? .006 : .022) - f.uGrain.value) * k; }
    this.focus.enabled = !this.ease && u.uAmt.value > .01;   // no blur pass at all unless you are at a work (or the GPU is struggling)
    if (this.nanPass) this.nanPass.enabled = this.bloom.enabled;   // the NaN clean-up only matters for the glow
  }

  /* halls wait in the half-dark; the one you face warms up; the one you enter lights up */
  updateHallLights(dt) {
    if (!this.bakedMats) return;
    for (const [id, mats] of Object.entries(this.bakedMats)) {
      let target = 1;
      if (id !== 'rot') {
        const cp = this.camera.position, inside = this.zones ? this.zoneOf(cp.x, cp.y, cp.z) === id : this.place === id && ['hall', 'exhibit', 'backroom', 'travel'].includes(this.state) && this.state !== 'rotunda';   // (by where the camera stands: leaving a room it dimmed while you were still inside)
        const facing = this.state === 'rotunda' && this.ring.focus && this.ring.focus.id === id;
        target = inside ? 1 : facing ? .9 : .78;
        if (this.state === 'travel' && this.travelTo === id) target = 1;
      }
      for (const m of mats) { m.userData.k = (m.userData.k ?? target) + (target - (m.userData.k ?? target)) * (1 - Math.exp(-dt * 1.4)); if (m.userData.loaded && m.userData.fade < 1) m.userData.fade = Math.min(1, m.userData.fade + dt * 1.5);
        m.color.copy(m.userData.gain).multiplyScalar(m.userData.k * (m.userData.fade ?? 1)); }
    }
  }

  updateRoomLight(dt) {
    let t = this.roomLightTarget.set(0, 9, 0);
    const place = this.place && (this.halls[this.place] || (this.place === 'backroom' ? this.backroom : null));
    if (place && this.state !== 'rotunda') t = dir(place.a).multiplyScalar(R0 + place.L / 2).setY(HALL_H - 1.2);
    this.roomLight.position.lerp(t, 1 - Math.exp(-dt * 1.5));
    const warm = this.place === 'backroom' && this.state !== 'rotunda';
    this.roomLight.intensity += ((warm ? 5 : 16) - this.roomLight.intensity) * (1 - Math.exp(-dt * 2));
  }

  /* keep it smooth on any laptop: trade resolution for frame rate */
  adapt() {
    // like a game's dynamic resolution: watch the real frame time and move the render size to hold ~60 fps on whatever this is
    // (a weak laptop, a strong one, a phone), and only spend spare time on sharpness. Nothing here recompiles a shader.
    const now = performance.now(), a = this.perf || (this.perf = { acc: 0, n: 0, cool: 9000, last: now, slow: 0, ema: 16.7, ease: 0 });   // no changes during the entrance (resizing mid-flight hitches)
    const gap = now - a.last; a.last = now;
    if (gap > 200 || document.hidden) return;     // throttled / background tab: don't judge the GPU on that
    a.ema += (gap - a.ema) * .1; a.acc += gap; a.n++; a.cool -= gap;
    if (a.acc < 500) return;                      // judged every half second (was every second: too slow to catch a heavy room)
    const fps = a.n * 1000 / a.acc; a.acc = 0; a.n = 0; this.fps = fps;
    if (a.cool > 0) return;
    let pr = this.pr;
    // a still view (at a work, a salon wall) may be rendered sharper, but only with time to spare: on a weak GPU smoothness wins
    const spare = fps > 56 && a.ema < 18;
    const salon = this.state === 'exhibit' && this.exhibitObj?.userData.salon && !this.exhibitObj.userData.runway;
    const top = salon && spare ? Math.max(this.prMax, Math.min(2, Math.max(1.5, devicePixelRatio))) : this.prMax;
    const floor = this.Q.prMin;
    if (fps < 45 && pr > floor) pr = Math.max(floor, pr - (fps < 25 ? .25 : .1));
    else if (spare && pr < top) pr = Math.min(top, pr + .1);
    else if (pr > top) pr = top;
    // still slow at the lowest size for ~3 s: drop the glow and the depth-of-field too (they cost a full-screen pass each); back on when it recovers
    a.slow = fps < 30 && pr <= floor + .01 ? a.slow + 1 : Math.max(0, a.slow - 1);
    if (a.slow >= 6) this.ease = true; else if (a.slow === 0 && fps > 50) this.ease = false;
    this.bloom.enabled = this.gpu.tier !== 'low' && !this.ease;
    if (pr !== this.pr) { this.pr = pr; this.renderer.setPixelRatio(pr); this.composer.setPixelRatio(pr); this.resize(); a.cool = 1200; }
  }

  butterflyBrain(dt, t) {
    const b = this.butterfly;
    if (b.mode === 'fold' || !b.group.visible) return;
    const idle = performance.now() - (this.lastMove || 0) > 3500;
    if (this.state === 'rotunda') {
      if (b.perch && !this.hovered) { b.perch = null; b.mode = 'fly'; b.forget(); }
      if (idle) b.goTo(new THREE.Vector3(Math.sin(t * .35) * 5.2, 4 + Math.sin(t * .8) * .8, Math.cos(t * .35) * 5.2), 2.2);
      else { this.ray.setFromCamera(this.ndc, this.camera); b.goTo(this.ray.ray.at(5.5, new THREE.Vector3()), 3.4); }
    } else if (this.state === 'hall') {
      if (!this.hovered?.userData?.type) {
        if (b.perch) { b.perch = null; b.mode = 'fly'; }
        this.ray.setFromCamera(this.ndc, this.camera); b.goTo(this.ray.ray.at(4.5, new THREE.Vector3()), 3);
      }
    } else if (this.state === 'travel' && !b.perch) {
      // lead the way, a little ahead of you
      const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
      b.goTo(this.camera.position.clone().addScaledVector(f, 3.2).add(new THREE.Vector3(0, .5, 0)), 5);
    } else if (this.state === 'backroom') {
      // circles the lamp like a moth, and dodges whatever you throw
      const lp = this.desk.lampPos;
      const tgt = lp.clone().add(new THREE.Vector3(Math.cos(t * 1.1) * 1.1, -.35 + Math.sin(t * 2.3) * .2, Math.sin(t * 1.1) * 1.1));
      if (this.desk.held) {
        const hp = this.desk.held.mesh.getWorldPosition(new THREE.Vector3());
        const away = b.pos.clone().sub(hp); if (away.length() < 1.2) tgt.addScaledVector(away.normalize(), 1.4);
      }
      b.goTo(tgt, 3.2);
    }
  }

  /* the swarm: circles the heart, follows the guide, crowds the lamp */
  flockBrain(dt, t) {
    if (!this.flock) return;
    const lead = this.butterfly.pos, tmp = new THREE.Vector3();
    this.flock.forEach((b, i) => {
      const ph = i * 2.399, sp = .18 + (i % 5) * .035;
      if (this.flockMode === 'heart' || this.state === 'map' || this.state === 'rotunda' || i % 2 === 1 || (this.state === 'travel' && (this.place === 'rotunda' || !this.place))) {   // half the swarm never leaves the heart
        const rad = (this.flockMode === 'heart' ? 1.4 : CH_R + 1.4 + (i % 4) * .9);
        const y = this.flockMode === 'heart' ? 8 + Math.sin(t + ph) * .5 : 2.8 + (i % 3) * 1.4 + Math.sin(t * .6 + ph) * .7;
        tmp.set(Math.sin(t * sp + ph) * rad, y, Math.cos(t * sp + ph) * rad);
        b.goTo(tmp, 2.2 + (i % 5) * .3);
      } else if (this.state === 'backroom' || this.place === 'backroom') {
        const lp = this.desk.lampPos;
        tmp.set(Math.cos(t * (.5 + sp) + ph) * (1.8 + (i % 3) * .5), -.6 + Math.sin(t * 1.3 + ph) * .5, Math.sin(t * (.5 + sp) + ph) * (1.8 + (i % 3) * .5)).add(lp);
        b.goTo(tmp, 2.6);
      } else {
        // follow the guide in a loose cloud, giving the artwork room
        // a loose cloud high above and ahead, never crowding the view or the artwork
        const far = this.state === 'exhibit' ? 3.2 : 2.4;
        tmp.set(Math.sin(t * .5 + ph) * far, 2.2 + Math.sin(t * .7 + ph * 1.3) * .5, Math.cos(t * .45 + ph) * far).add(lead);
        tmp.y = Math.min(tmp.y, HALL_H - .6);
        b.goTo(tmp, 3.2 + (i % 4) * .4);
      }
      b.update(dt);
    });
  }
}
