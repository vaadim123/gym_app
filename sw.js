// Workout app service worker: offline shell + rest-timer notifications.
// Data (data.json / GitHub API) is never cached — always fresh from network.
const CACHE = 'workout-v8.7';
const SHELL = ['/gym_app/', '/gym_app/index.html', '/gym_app/manifest.json', '/gym_app/icon-192.png', '/gym_app/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com' || url.pathname.endsWith('/data.json')) return;

  // Same-origin pages: network first (so updates show up), cache fallback offline
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/gym_app/index.html')))
    );
    return;
  }

  // CDN libs (React, Babel): cache first — versions are pinned
  if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'TIMER_DONE') {
    self.registration.showNotification('💪 Час відпочинку вийшов!', {
      body: 'Починай наступний підхід',
      tag: 'timer',
      icon: '/gym_app/icon-192.png',
      vibrate: [300, 100, 300, 100, 500]
    });
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return self.clients.openWindow('/gym_app/');
  }));
});
