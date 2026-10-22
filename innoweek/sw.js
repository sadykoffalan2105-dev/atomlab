/* ATOMLAB · InnoWeek — офлайн-режим. Файл собирает scripts/innoweek-build.mjs — не править руками. */
const VERSION = "innoweek-61f7663c86cd";
const ASSETS = ["./","spider/","css/deck.css","css/spider.css","img/ai/classroom.webp","img/ai/flask.webp","img/ai/registan.webp","img/ai/vr.webp","img/clips/formation-poster.jpg","img/clips/formation.webm","img/el/Ag.webp","img/el/As.webp","img/el/B.webp","img/el/Bk.webp","img/el/C.webp","img/el/Ce.webp","img/el/Cf.webp","img/el/Cl.webp","img/el/Cu.webp","img/el/Es.webp","img/el/F.webp","img/el/Fm.webp","img/el/H.webp","img/el/He.webp","img/el/K.webp","img/el/Li.webp","img/el/N.webp","img/el/Nd.webp","img/el/O.webp","img/el/P.webp","img/el/Pm.webp","img/el/Ra.webp","img/el/S.webp","img/el/Sb.webp","img/el/Sn.webp","img/el/Tc.webp","img/el/Xe.webp","img/el/Yb.webp","img/icon-192.png","img/icon-512.png","img/icon.svg","img/shots/book.webp","img/shots/formation.webp","img/shots/home.webp","img/shots/lab3d.webp","img/shots/labtask.webp","img/shots/organic.webp","img/shots/periodic-table.webp","img/shots/periodic.webp","img/shots/reactor.webp","img/shots/teacher.webp","index.html","js/deck.js","js/elements.js","js/i18n.js","js/molecules.js","js/scenes.js","js/spider-app.js","js/spider-i18n.js","js/spider.js","manifest.webmanifest","spider/index.html"];

// при установке — только лёгкое ядро (страницы, стили, скрипты, иконки ≈ 150 КБ): новая версия встаёт за секунды
// даже на медленном интернете; картинки и видео докачиваются в фоне после переключения
const CORE = ASSETS.filter((u) => u === './' || u === 'spider/' || /[.](?:html|css|js|json|webmanifest|svg)$/.test(u));
const LATER = ASSETS.filter((u) => !CORE.includes(u));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const old = keys.filter((k) => k.startsWith('innoweek-') && k !== VERSION);
      await Promise.all(old.map((k) => caches.delete(k)));
      await self.clients.claim();
      // была старая версия — открытые вкладки (Edge, Chrome, любые) сами перезагружаются на новую
      if (old.length) {
        const wins = await self.clients.matchAll({ type: 'window' });
        for (const w of wins) { try { w.navigate(w.url).catch(() => {}); } catch (e) { /* вкладка закрылась */ } }
      }
    })(),
  );
});

let laterStarted = false;
function cacheLater() {
  if (laterStarted) return Promise.resolve();
  laterStarted = true;
  return caches.open(VERSION).then((cache) =>
    Promise.all(LATER.map((u) => cache.match(u).then((hit) => hit || cache.add(new Request(u, { cache: 'reload' })).catch(() => null)))),
  );
}

// Страница, стили и скрипты — сначала из сети (всегда свежая и согласованная версия, пока есть интернет),
// без сети или если сеть молчит дольше 4 с — из сохранённой копии. Картинки и видео — из сохранённой копии.
const FRESH = /[.](?:html|css|js|json|webmanifest)$/;
function fromNetwork(req, cache, key) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('slow')), 4000);
    fetch(req, { cache: 'no-cache' }).then((res) => {
      clearTimeout(timer);
      if (res && res.status === 200 && res.type === 'basic') cache.put(key || req, res.clone()).catch(() => {});
      resolve(res);
    }, (e) => { clearTimeout(timer); reject(e); });
  });
}
async function fromCache(cache, req, spider) {
  if (req.mode === 'navigate') {
    return (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match(spider ? 'spider/' : './', { ignoreSearch: true })) ||
      (await cache.match(spider ? 'spider/index.html' : 'index.html', { ignoreSearch: true }));
  }
  return cache.match(req, { ignoreSearch: true });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const spider = url.pathname.includes('/spider');
  if (!laterStarted) event.waitUntil(cacheLater());
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      if (req.mode === 'navigate' || FRESH.test(url.pathname)) {
        // ключ кэша без ?v=… — чтобы копия нашлась и без интернета
        const key = req.mode === 'navigate' ? undefined : url.origin + url.pathname;
        try {
          return await fromNetwork(req, cache, key);
        } catch (e) {
          const hit = await fromCache(cache, req, spider);
          return hit || new Response('', { status: 504, statusText: 'offline' });
        }
      }
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (e) {
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  const port = event.ports && event.ports[0];
  if (!port || !event.data || event.data.type !== 'status') return;
  caches.open(VERSION).then((cache) => cache.keys()).then((keys) => {
    port.postMessage({ ready: keys.length >= ASSETS.length, cached: keys.length, total: ASSETS.length, version: VERSION });
  });
});
