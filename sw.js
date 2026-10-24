/* ATOMLAB — service worker основного сайта.
 * GitHub Pages разрешает браузеру хранить файлы только 10 минут (max-age=600), и на медленном интернете
 * каждый заход заново ждёт мегабайты кода. Файлы из assets/ имеют хеш в имени и никогда не меняются —
 * храним их у себя навсегда: второй и следующие заходы открываются сразу, даже без интернета.
 * Страница (index.html) — сначала из сети (чтобы новая версия сайта приходила сразу), при обрыве — из кэша. */
const ASSETS = 'atomlab-assets-v1'
const PAGES = 'atomlab-pages-v1'
const MAX_ASSETS = 600 // старые версии файлов после обновлений сайта вытесняются

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('atomlab-') && k !== ASSETS && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const scopePath = new URL(self.registration.scope).pathname

async function trim() {
  const c = await caches.open(ASSETS)
  const keys = await c.keys()
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await c.delete(keys[i])
}

async function assetFirst(req) {
  const c = await caches.open(ASSETS)
  const hit = await c.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok && res.status === 200) {
    c.put(req, res.clone()).then(trim).catch(() => {})
  }
  return res
}

async function pageNetworkFirst(req) {
  const c = await caches.open(PAGES)
  const key = scopePath // одна оболочка сайта (HashRouter) — все переходы внутри идут через #
  const net = fetch(req).then((res) => {
    if (res.ok) c.put(key, res.clone()).catch(() => {})
    return res
  })
  const hit = await c.match(key)
  if (!hit) return net // первый заход — просто ждём сеть
  // сеть отвечает долго или её нет — открываем сохранённую оболочку (новая придёт к следующему заходу)
  return Promise.race([net, new Promise((r) => setTimeout(() => r(hit), 3500))]).catch(() => hit)
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)
  if (url.origin !== location.origin || !url.pathname.startsWith(scopePath)) return
  const rel = url.pathname.slice(scopePath.length)
  if (rel.startsWith('innoweek/')) return // у визитки свой service worker
  if (rel.startsWith('assets/')) {
    e.respondWith(assetFirst(req))
    return
  }
  if (req.mode === 'navigate' && (rel === '' || rel === 'index.html')) {
    e.respondWith(pageNetworkFirst(req))
  }
})
