const CACHE = 'chemowell-app-v48-2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // v48 (found investigating why Aaron kept seeing stale content even after a CACHE-version-bumped
  // push): the app's own index.html/'./' were cache-first, same as the rarely-changing shell assets
  // below. Confirmed live, directly against the real deployed site, a real failure mode this can
  // hit: GitHub Pages' CDN can briefly serve an inconsistent snapshot across files right after a
  // push (sw.js already updated at one edge node, index.html not yet updated at another) --  if a
  // new service worker's install-time `cache.addAll(SHELL)` fetch lands in that exact window, it
  // permanently bakes the STALE index.html into the otherwise-correctly-versioned new cache, where
  // cache-first then keeps serving it to every user until the NEXT deploy bumps CACHE again -- no
  // error, no warning, indistinguishable from "the push just didn't work." This is very likely the
  // real explanation behind more than one "why hasn't my fix reached the device" report this
  // project has seen, not just a plain stale-service-worker-registration issue.
  // Fix: the document itself (navigations, and any direct request for index.html/'./') now goes
  // network-first -- always try the real network for the one file that changes on every release,
  // and fall back to the cached copy only if the network genuinely fails (actually offline). This
  // makes the cached shell purely an offline fallback instead of the primary source of truth, which
  // closes this whole bug class rather than just this one instance of it. Also opportunistically
  // refreshes the cache with whatever the network just returned, so the offline fallback itself
  // stays reasonably current too. Static, rarely-changing shell assets (manifest, icons) keep the
  // original cache-first behavior below -- no reason to hit the network for those every time.
  const isDocRequest = e.request.mode === 'navigate' || e.request.url.endsWith('/index.html') || e.request.url === self.registration.scope;
  if (isDocRequest) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for the remaining app shell; everything else straight to network
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      if (cls.length > 0) {
        cls[0].focus();
      } else {
        clients.openWindow('./');
      }
    })
  );
});
