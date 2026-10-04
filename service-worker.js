/* 宝贝学习乐园 · Service Worker
   策略：首页网络优先（保证内容更新），其余资源缓存优先 + 后台更新。
   首次联网访问后即可离线玩；更新代码/语音后发布新版本号 CACHE（v3 起，
   语音分片 audio-*.js 走缓存优先，不升版本号老用户会一直听旧语音）。 */
const CACHE = 'baby-learning-v3';
const SHELL = [
  './',
  './index.html',
  './audio-core.js',
  './manifest.webmanifest',
  './favicon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 首页：网络优先，失败时回退缓存（离线也能打开）
  if (url.pathname.endsWith('/index.html') || url.pathname === self.location.pathname || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // 其余资源（语音分片/图片/脚本）：缓存优先
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
