const CACHE = 'chemowell-app-v67-1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  // v48 continued: plain `cache.addAll(SHELL)` fetches with the default cache mode, which lets the
  // BROWSER's own ordinary HTTP cache (not this Cache Storage API -- a separate, earlier layer)
  // silently hand back a response it already had on disk for that URL, without a real network round
  // trip at all, if GitHub Pages' cache-control headers say it's still "fresh enough." Caught live:
  // even several minutes after a push, with the CDN itself confirmed fully serving the new
  // index.html (verified with a direct no-store fetch), this install step kept baking the OLD
  // index.html into a brand-new, correctly-versioned cache -- traced to exactly this, the browser's
  // HTTP cache, not a CDN propagation delay as first suspected. `{cache:'reload'}` forces each of
  // these requests to actually hit the network and revalidate, the standard fix for "my service
  // worker's install step keeps caching stale content" for exactly this reason.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
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
    // Same browser-HTTP-cache trap as the install step above -- force a real revalidated network
    // fetch here too (`fetch(input, init)` with an existing Request as `input` builds a new request
    // using init's fields, including `cache`, so this genuinely overrides e.request's own mode).
    e.respondWith(
      fetch(e.request, { cache: 'reload' }).then(r => {
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
