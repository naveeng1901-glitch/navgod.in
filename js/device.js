/* Phones and tablets (any brand: iPhone, Android, iPad, Android tablets): what kind of device this is, and lighter images for them.
   Imported first by main.js, so every image the museum asks for afterwards goes through it.
   Test on the laptop with ?device=phone or ?device=tablet. */
import * as THREE from 'three';
import { MOBILE_IMAGES } from './mobile-list.js';
import * as WL from './webp-list.js';
const WEBP = WL.WEBP, WEBP_M = WL.WEBP_M, STREAM = WL.STREAM || new Set();

function detect() {
  let forced = null; try { forced = new URLSearchParams(location.search).get('device'); } catch (e) {}
  if (forced === 'desktop') return 'desktop';
  if (forced === 'phone' || forced === 'tablet') return forced;
  const coarse = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  const iPadOS = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;   // iPads say they are Macs
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(navigator.userAgent);
  if (!(coarse || iPadOS || (mobileUA && navigator.maxTouchPoints > 0))) return 'desktop';
  const short = Math.min(screen.width, screen.height);
  return short < 600 ? 'phone' : 'tablet';
}

export const DEVICE = { kind: detect() };
DEVICE.mobile = DEVICE.kind !== 'desktop';
document.documentElement.dataset.device = DEVICE.kind;   // CSS: html[data-device=phone] ...

// the best file to fetch for an image: phones/tablets the lighter copy (m/), and every device a high-quality WebP when there is one
// (w/ full size, mw/ the phone copies: ~half the bytes, no visible difference; made by tools/make_webp.py)
const norm = u => { try { const a = new URL(u, location.href); return a.origin === location.origin ? a.pathname.replace(/^\//, '') : null; } catch (e) { return null; } };
const webp = p => p.replace(/\.(jpe?g|png)$/i, '.webp');
export function mob(url) {
  if (typeof url !== 'string') return url;
  const p = norm(url); if (!p) return url;
  if (DEVICE.mobile && MOBILE_IMAGES.has(p)) return WEBP_M.has(p) ? 'mw/' + webp(p) : 'm/' + p;
  return WEBP.has(p) ? 'w/' + webp(p) : url;
}
const full = url => { const p = norm(url); return !p ? url : STREAM.has(p) ? 's/' + webp(p) : WEBP.has(p) ? 'w/' + webp(p) : url; };   // what a phone streams in at a work: 1024 px (s/), else the full one
{
  for (const C of [THREE.ImageLoader, THREE.ImageBitmapLoader, THREE.TextureLoader]) {
    const load = C.prototype.load;
    C.prototype.load = function (url, ...rest) {
      const u = DEVICE.raw ? url : mob(url), r = load.call(this, u, ...rest);
      if (r && r.isTexture && DEVICE.mobile && u !== url && !DEVICE.raw) r.userData.fullSrc = full(url);   // remembered: the work you stand at streams its full-size picture back in (world.sharpen)
      return r;
    };
  }
}
// every device: a picture is handed over only once it is DECODED (off the main thread, img.decode()); a texture whose picture is still
// encoded gets decoded inside the upload, on the main thread (measured: a single packaging PNG froze the walk ~3 s)
{ const load = THREE.ImageLoader.prototype.load;
  THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    return load.call(this, url, onLoad && (img => { const go = () => onLoad(img); img.decode ? img.decode().then(go, go) : go(); }), onProgress, onError);
  };
}
// load the real, full-size file (no lighter copy): used to stream in the picture of the work you are looking at
export function loadFull(loader, url, onLoad, onErr) { url = full(url); DEVICE.raw = true; try { return loader.load(url, onLoad, undefined, onErr); } finally { DEVICE.raw = false; } }
