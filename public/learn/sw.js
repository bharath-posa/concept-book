/* ConceptBook Learn service worker: works offline after the first visit.
   Pages and lessons: network first (fresh when online), cached copy when offline.
   Built files with hashed names: cache first. */
const CACHE = 'cb-learn-v1'
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.json', './manifest.webmanifest'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  const hashed = /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(new URL(req.url).pathname)
  if (hashed) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { put(req, res.clone()); return res })))
    return
  }
  e.respondWith(fetch(req).then(res => { put(req, res.clone()); return res })
    .catch(() => caches.match(req).then(hit => hit || caches.match('./'))))
})
function put(req, res) { if (res.ok) caches.open(CACHE).then(c => c.put(req, res)) }
