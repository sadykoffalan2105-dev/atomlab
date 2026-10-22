#!/usr/bin/env node
/**
 * Презентация ATOMLAB для InnoWeek (public/innoweek): слайды (index.html) и «паук» (spider/index.html).
 * Пересобирает офлайн-часть, общую для обеих страниц.
 *   • sw.js — service worker со списком ВСЕХ файлов презентации и версией по хешу содержимого
 *     (после первого открытия с интернетом презентация работает без сети; новая версия скачивается
 *     целиком в фоне и показывается при следующем открытии — открытая страница не перезагружается);
 *   • img/icon-192.png, img/icon-512.png — из img/icon.svg (для установки как приложения);
 *   • manifest.webmanifest.
 * Запуск после любой правки файлов презентации:  node scripts/innoweek-build.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const ROOT = path.resolve('public/innoweek')
const SKIP = new Set(['sw.js', 'README.md'])

for (const s of [192, 512]) {
  await sharp(path.join(ROOT, 'img/icon.svg'), { density: 384 }).resize(s, s).png().toFile(path.join(ROOT, `img/icon-${s}.png`))
}

const manifest = {
  name: 'ATOMLAB — презентация InnoWeek',
  short_name: 'ATOMLAB',
  description: 'Виртуальная химическая лаборатория и ИИ-учитель для школ Узбекистана',
  start_url: './',
  scope: './',
  display: 'fullscreen',
  background_color: '#060a18',
  theme_color: '#060a18',
  icons: [
    { src: 'img/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'img/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'img/icon.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
}
fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n')

// версия css/js — в ссылках страниц (?v=…), чтобы после обновления браузер не брал старые копии из своего кэша
function assetHash() {
  const h = crypto.createHash('sha256')
  for (const d of ['css', 'js']) {
    for (const f of fs.readdirSync(path.join(ROOT, d)).sort()) h.update(f).update(fs.readFileSync(path.join(ROOT, d, f)))
  }
  return h.digest('hex').slice(0, 10)
}
const av = assetHash()
for (const page of ['index.html', 'spider/index.html']) {
  const p = path.join(ROOT, page)
  const html = fs.readFileSync(p, 'utf8').replace(/((?:\.\.\/)?(?:css|js)\/[\w.-]+\.(?:css|js))(\?v=[\w]+)?"/g, `$1?v=${av}"`)
  fs.writeFileSync(p, html)
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? walk(p) : [p]
  })
}
const files = walk(ROOT)
  .map((p) => path.relative(ROOT, p).split(path.sep).join('/'))
  .filter((p) => !SKIP.has(p) && !p.startsWith('.'))
  .sort()
const hash = crypto.createHash('sha256')
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)))
const version = 'innoweek-' + hash.digest('hex').slice(0, 12)
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0)

const sw = `/* ATOMLAB · InnoWeek — офлайн-режим. Файл собирает scripts/innoweek-build.mjs — не править руками. */
const VERSION = ${JSON.stringify(version)};
const ASSETS = ${JSON.stringify(['./', 'spider/', ...files], null, 0)};

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
`
fs.writeFileSync(path.join(ROOT, 'sw.js'), sw)
console.log(`innoweek: ${files.length} файлов, ${(bytes / 1024 / 1024).toFixed(2)} МБ, версия ${version}`)
