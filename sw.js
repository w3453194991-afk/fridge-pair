/* 冰箱对对碰 · 离线缓存（网络优先，保证代码永远是最新的） */
const CACHE = 'ddm-v28';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.json',
  './js/photos.js', './js/data.js', './js/engine.js', './js/store.js', './js/ui.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

/* 立即接管，不等旧标签页关闭 */
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 网络优先：在线永远拿最新；离线才回落到缓存 */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // 外链直接放行

  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
