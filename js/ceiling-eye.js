/* =========================================================
   THE EYE IN THE CEILING
   The NavGod eye lives in the Rotunda's oculus. It watches you as you turn,
   blinks, and is half-lidded while the heart is sealed. When the heart opens
   it looks down at it, wide awake.
   ========================================================= */
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FS = `precision highp float;
varying vec2 vUv;
uniform float uT, uDil, uBlink, uLid, uBeat, uWide;
uniform vec2 uLook;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
void main(){
  vec2 e = (vUv-.5)*2.;                      // -1..1 across the oculus
  float de = length(e), a = atan(e.y,e.x);
  if (de > 1.) discard;
  vec3 col = vec3(.006,.002,.002);
  vec2 q = e - uLook*.16; float d = length(q); float ia = atan(q.y,q.x); vec2 u = vec2(cos(ia),sin(ia));
  float IR = .74;
  float pr = mix(.18,.36,uDil)*(1.+.025*sin(uT*.8)+.012*sin(uT*2.3)); pr = mix(pr,.5,uWide);
  float prA = pr*(1.+.012*sin(ia*7.+uT*.6));
  if (d < IR) {
    float t = clamp((d-prA)/(IR-prA),0.,1.);
    float fib = vn(u*46.+vec2(t*2.6,-t*1.4)), fib2 = vn(u*110.+vec2(t*5.,-t*3.5));
    float crypt = smoothstep(.6,.78,fbm(u*7.+vec2(t*3.2)+3.))*smoothstep(.1,.25,t)*(1.-smoothstep(.7,.88,t));
    vec3 deep = vec3(.13,.012,.01), mid = vec3(.6,.045,.028), hot = vec3(1.,.3,.13);
    vec3 ir = mix(mid,deep,smoothstep(.3,1.,t));
    ir = mix(ir,hot,(1.-smoothstep(0.,.3,t))*.6);
    ir *= .5+.75*fib*fib+.3*fib2;
    float fl = smoothstep(.74,.84, vn(u*34.+vec2(t*7.,t*5.))*vn(u*13.-vec2(t*3.))*1.55)*smoothstep(.1,.28,t)*(1.-smoothstep(.62,.82,t));
    ir = mix(ir, vec3(1.,.72,.3)*(.7+.5*fib2), fl*.75);
    ir *= 1.-crypt*.65;
    ir += hot*.4*exp(-pow((t-.3)*13.,2.))*(.5+.5*fib2);
    ir *= 1.-smoothstep(.8,1.,t)*.88;
    ir *= (.75+.45*uBeat)*(1.+.6*uWide);
    col = ir;
  }
  col = mix(col, vec3(.003,0.,0.), 1.-smoothstep(prA-.01,prA+.004,d));
  // cornea: a dome with a soft window of light
  vec2 cq = e-vec2(-.25,.29); cq = mat2(.8,-.6,.6,.8)*cq;
  col = col*(1.-smoothstep(.35,.9,de)*.5) + (exp(-dot(cq*vec2(7.,11.),cq*vec2(7.,11.)))*.4)*vec3(1.,.95,.9)*(1.-uBlink);
  // lids of dark velvet (half closed while the heart is sealed)
  float open = .9*uLid*(1.-uBlink);
  float edge = open*sqrt(max(0.,1.-e.x*e.x/.8));
  float ay = abs(e.y);
  float lidm = smoothstep(edge-.008,edge+.008,ay);
  vec3 lidc = vec3(.93,.92,.9)*(.96+.06*fbm(e*6.));
  lidc = mix(lidc, vec3(.05), exp(-pow((ay-edge)*50.,2.)));
  col = mix(col, lidc, lidm);
  // a black rim to meet the well
  float ring = smoothstep(.9,.915,de);
  float bevel = sin(clamp((de-.9)/.1,0.,1.)*3.1416);
  float ticks = step(.55, fract(a/6.2832*72.))*smoothstep(.935,.945,de)*(1.-smoothstep(.97,.98,de));
  vec3 ringc = mix(vec3(.05)+vec3(.12)*bevel, vec3(.93), ticks*.8);
  col = mix(col, ringc, ring);
  gl_FragColor = vec4(col, 1.);
}`;

export class CeilingEye {
  constructor(scene, { y = 11.55, r = 3.6, up = false } = {}) {
    this.u = { uT: { value: 0 }, uDil: { value: .3 }, uBlink: { value: 0 }, uLid: { value: .5 }, uBeat: { value: 0 }, uWide: { value: 0 }, uLook: { value: new THREE.Vector2() } };
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS }));
    this.mesh.rotation.x = up ? -Math.PI / 2 : Math.PI / 2; this.mesh.position.y = y;   // faces down into the Rotunda (or up, as the red room's lid)
    scene.add(this.mesh);
    this.look = new THREE.Vector2(); this.lookT = new THREE.Vector2();
    this.lid = .5; this.wide = 0; this.nextBlink = 2; this.blinkT = -9; this.nextSacc = 0; this.awake = false; this.awakeT = -9;
    this.onBlink = null;
  }
  /* the heart has opened: look down at it, wide awake */
  awaken(t) { this.awake = true; this.awakeT = t; }
  setOpen(open) { this.awake = open; }
  update(dt, t, camera, beat) {
    const u = this.u; u.uT.value = t; u.uBeat.value = beat;
    // gaze: toward the visitor (projected into the oculus), or down at the heart for a while after it opens
    const c = camera.position, sinceAwake = t - this.awakeT;
    if (sinceAwake < 4.5) this.lookT.set(0, 0);
    else {
      const L = Math.hypot(c.x, c.z);
      this.lookT.set(c.x, c.z).multiplyScalar(L > .01 ? Math.min(1, L / 9) / L : 0);
      if (t > this.nextSacc) { this.saccade = new THREE.Vector2((Math.random() - .5) * .25, (Math.random() - .5) * .25); this.nextSacc = t + 1.2 + Math.random() * 2.5; }
      if (this.saccade) this.lookT.add(this.saccade);
    }
    this.look.lerp(this.lookT, 1 - Math.exp(-dt * 7));
    u.uLook.value.copy(this.look);
    this.lid += ((this.awake ? 1 : .5) - this.lid) * (1 - Math.exp(-dt * 2));
    this.wide += ((sinceAwake < 4.5 ? 1 : 0) - this.wide) * (1 - Math.exp(-dt * 3));
    u.uLid.value = this.lid; u.uWide.value = this.wide;
    u.uDil.value = .3 + .1 * Math.sin(t * .3);
    // blinks
    if (t > this.nextBlink) { this.blinkT = t; this.nextBlink = t + 4 + Math.random() * 5; this.onBlink && this.onBlink(); }
    const bt = t - this.blinkT;
    u.uBlink.value = bt < .25 ? Math.sin(bt / .25 * Math.PI) : 0;
  }
}
