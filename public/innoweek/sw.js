/* ATOMLAB · InnoWeek — офлайн-режим. Файл собирает scripts/innoweek-build.mjs — не править руками. */
const VERSION = "innoweek-aa5fb25fddf9";
const ASSETS = ["./","spider/","css/deck.css","css/spider.css","img/ai/classroom.webp","img/ai/flask.webp","img/ai/registan.webp","img/ai/vr.webp","img/el/Ag.webp","img/el/As.webp","img/el/B.webp","img/el/Bk.webp","img/el/C.webp","img/el/Ce.webp","img/el/Cf.webp","img/el/Cl.webp","img/el/Cu.webp","img/el/Es.webp","img/el/F.webp","img/el/Fm.webp","img/el/H.webp","img/el/He.webp","img/el/K.webp","img/el/Li.webp","img/el/N.webp","img/el/Nd.webp","img/el/O.webp","img/el/P.webp","img/el/Pm.webp","img/el/Ra.webp","img/el/S.webp","img/el/Sb.webp","img/el/Sn.webp","img/el/Tc.webp","img/el/Xe.webp","img/el/Yb.webp","img/icon-192.png","img/icon-512.png","img/icon.svg","img/shots/book.webp","img/shots/formation.webp","img/shots/home.webp","img/shots/lab3d.webp","img/shots/labtask.webp","img/shots/organic.webp","img/shots/periodic-table.webp","img/shots/periodic.webp","img/shots/reactor.webp","img/shots/teacher.webp","index.html","js/deck.js","js/elements.js","js/i18n.js","js/molecules.js","js/scenes.js","js/spider-app.js","js/spider-i18n.js","js/spider.js","manifest.webmanifest","spider/index.html"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('innoweek-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      if (req.mode === 'navigate') {
        // две отдельные страницы: слайды (./) и «паук» (spider/)
        const spider = new URL(req.url).pathname.includes('/spider');
        const page =
          (await cache.match(req, { ignoreSearch: true })) ||
          (await cache.match(spider ? 'spider/' : './', { ignoreSearch: true })) ||
          (await cache.match(spider ? 'spider/index.html' : 'index.html', { ignoreSearch: true }));
        if (page) return page;
      }
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
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
