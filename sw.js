// sw.js — the service worker that lets PhuzzBox run as an installed app. Every file a page loads
// is fetched from the server first, so a change shows at once, and a copy is kept; when the server
// isn't there (the app opened with `npm run serve` stopped, or no network), the copy is used.
// It lives at the site's root so that its scope covers every page.

const CACHE = 'phuzzbox-9';
const PAGES = ['./', './index.html', './buffer/', './phuzz/', './wah/', './preamp/', './opto/', './cabinet/', './envelope/', './octave/', './spring/', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PAGES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
