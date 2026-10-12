#!/usr/bin/env node
/**
 * Заглушка мозга для проверки режима «🎨 Картинка» в чате без сервера друга и без видеокарты:
 *   GET  /health          — мозг на связи + image {enabled, ready, students, engine};
 *   GET  /image/presets   — 48 тем из brain/image/presets.ts (как настоящий сервер: класс ±1, заголовок на языке);
 *   POST /image           — SSE по контракту image v1: accepted → progress checking → queue 2 → queue 1 →
 *                           waiting_gpu → switching → loading → sampling… → decoding → safety → encoding → done
 *                           (PNG рисуется здесь же, ~7 с); ученик со своим текстом → error bad_request (как roles.ts);
 *   POST /chat            — короткий ответ учителя (meta → delta → done), чтобы проверить «Спросить учителя».
 *
 *   npx tsx scripts/brain/image-mock-server.mts [--port=8797] [--vite=4837] [--students=0] [--fast]
 * --vite=PORT — заодно запустить сайт (vite) на этом порту с VITE_BRAIN_URL на заглушку (.claude/launch.json).
 */
import http from 'node:http'
import zlib from 'node:zlib'
import { spawn } from 'node:child_process'
import { PRESETS, presetFitsGrade, GRADES } from '../../brain/image/presets.ts'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : '1']
  }),
)
const PORT = Number(args.port ?? 8797)
const STUDENTS = args.students !== '0'
const STEP_MS = args.fast ? 60 : 550
/** --image=off | notready — проверить выключенный «🎨 Картинка»; на лету: GET /__mock/image?state=on|off|notready */
let imageState: 'on' | 'off' | 'notready' = args.image === 'off' || args.image === 'notready' ? args.image : 'on'

/* ------------------------------------------------------------------ PNG без зависимостей */

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

/** Картинка-заглушка: фон-градиент по seed и колба (круг + горлышко) — видно, что пришла «новая» картинка. */
function mockPng(w: number, h: number, seed: number): string {
  const hue = (seed % 360) / 360
  const rgb = (hh: number, l: number): [number, number, number] => {
    const f = (n: number) => {
      const k = (n + hh * 12) % 12
      const a = 0.55 * Math.min(l, 1 - l)
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
    }
    return [f(0), f(8), f(4)]
  }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  const cx = w / 2
  const cy = h * 0.6
  const r = Math.min(w, h) * 0.26
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      let [R, G, B] = rgb(hue, 0.82 - (0.25 * y) / h)
      const inBulb = (x - cx) ** 2 + (y - cy) ** 2 < r * r
      const inNeck = Math.abs(x - cx) < r * 0.28 && y > cy - r * 2 && y < cy
      if (inBulb || inNeck) {
        ;[R, G, B] = rgb((hue + 0.5) % 1, inBulb && y > cy - r * 0.2 ? 0.55 : 0.92)
      }
      const o = y * (w * 3 + 1) + 1 + x * 3
      raw[o] = R
      raw[o + 1] = G
      raw[o + 2] = B
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2 // RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}

/* ------------------------------------------------------------------ HTTP */

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Brain-Session, X-Brain-Admin, Accept',
  'Access-Control-Max-Age': '600',
}
const SIZES = { square: [1024, 1024], wide: [1216, 832], tall: [832, 1216] } as const
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let jobs = 0

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS })
  res.end(JSON.stringify(body))
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const parts: Buffer[] = []
  for await (const c of req) parts.push(c as Buffer)
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'atomlab-brain',
      version: 'image-mock',
      contract: 1,
      llm: { available: true, chatModel: 'mock', fastModel: null, embedModel: null, vision: false },
      kb: { docs: 0, journalLines: 0, embedded: 0 },
      uptimeMs: Math.round(process.uptime() * 1000),
      image: { enabled: imageState !== 'off', ready: imageState === 'on', engine: 'z-image-turbo', students: STUDENTS, queue: { running: 0, waiting: 0, paused: false }, lastMs: 7000 },
    })
  }
  if (req.method === 'GET' && url.pathname === '/__mock/image') {
    const st = url.searchParams.get('state')
    if (st === 'on' || st === 'off' || st === 'notready') imageState = st
    return json(res, 200, { ok: true, image: imageState })
  }
  if (req.method === 'GET' && url.pathname === '/image/presets') {
    const grade = url.searchParams.get('grade') ?? ''
    const lang = url.searchParams.get('lang')
    const L = lang === 'ru' || lang === 'uz' || lang === 'en' ? lang : null
    const presets = PRESETS.filter((p) => !grade || !GRADES.includes(grade as never) || presetFitsGrade(p, grade, 1)).map((p) => ({
      id: p.id,
      ...(L ? { title: p.titles[L] } : { titles: p.titles }),
      grades: p.grades,
      topic: p.topic,
      style: p.style,
      size: p.size,
    }))
    return json(res, 200, { ok: true, students: { enabled: STUDENTS }, presets })
  }
  if (req.method === 'POST' && url.pathname === '/image') {
    const b = await readBody(req)
    const owner = !!req.headers['x-brain-admin']
    const teacher = typeof b.teacherKey === 'string' && b.teacherKey.length >= 16
    const role = owner ? 'owner' : teacher ? 'teacher' : 'student'
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', ...CORS })
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const preset = PRESETS.find((p) => p.id === b.presetId)
    if (imageState !== 'on') {
      send('error', { code: imageState === 'off' ? 'disabled' : 'not_ready', message: 'Рисование сейчас недоступно.' })
      return res.end()
    }
    if (role === 'student' && (b.prompt || !preset || !STUDENTS)) {
      send('error', { code: STUDENTS ? 'bad_request' : 'forbidden', message: 'Выберите тему из списка — ученикам доступны готовые темы своего класса.' })
      return res.end()
    }
    const size = (preset?.size ?? (b.size as keyof typeof SIZES) ?? 'square') as keyof typeof SIZES
    const [w, h] = SIZES[size] ?? SIZES.square
    const jobId = `01MOCK${String(++jobs).padStart(20, '0')}`
    const seed = typeof b.seed === 'number' ? b.seed : Math.floor(Math.random() * 1e9)
    const t0 = Date.now()
    send('accepted', { jobId, role, engine: 'z-image-turbo', variant: 'int8', width: w, height: h, ...(preset ? { presetId: preset.id } : {}), etaSec: 8 })
    const steps: Array<[string, unknown]> = [
      ['progress', { phase: 'checking', pct: 5 }],
      ['queue', { position: 2, waiting: 2, etaSec: 12 }],
      ['queue', { position: 1, waiting: 1, etaSec: 7 }],
      ['progress', { phase: 'waiting_gpu', pct: 10 }],
      ['progress', { phase: 'switching', pct: 20 }],
      ['progress', { phase: 'loading', pct: 30 }],
      ['progress', { phase: 'sampling', pct: 45 }],
      ['progress', { phase: 'sampling', pct: 65 }],
      ['progress', { phase: 'sampling', pct: 85 }],
      ['progress', { phase: 'decoding', pct: 90 }],
      ['progress', { phase: 'safety', pct: 95 }],
      ['progress', { phase: 'encoding', pct: 98 }],
    ]
    let closed = false
    req.on('close', () => (closed = true))
    for (const [ev, data] of steps) {
      if (closed) return
      send(ev, { ...(data as object), ms: Date.now() - t0 })
      await sleep(STEP_MS)
    }
    // маленькая картинка (быстро) — сайт показывает её в пропорциях width × height
    const dataUrl = mockPng(Math.round(w / 4), Math.round(h / 4), seed)
    send('done', {
      jobId,
      dataUrl,
      mime: 'image/png',
      width: w,
      height: h,
      seed,
      engine: 'z-image-turbo',
      variant: 'int8',
      ms: Date.now() - t0,
      timings: { queueMs: 1100, drainMs: 500, unloadMs: 500, loadMs: 600, genMs: 1600, safetyMs: 500, reloadMs: 0 },
      prompt: { final: preset?.prompt_en ?? 'mock', translated: !preset, ...(preset ? { presetId: preset.id } : {}) },
      safety: { nsfw: 0.01, normal: 0.99 },
      url: `/image/${jobId}`,
    })
    return res.end()
  }
  if (req.method === 'POST' && url.pathname === '/chat') {
    await readBody(req)
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', ...CORS })
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const text = 'На картинке — химический опыт из учебника. (Ответ заглушки мозга: живой учитель объяснит его по §.)'
    send('meta', { turnId: 'mock-1', intent: 'explain', route: 'mock', moderated: false, lang: 'ru' })
    send('delta', { text })
    send('done', { text, turnId: 'mock-1' })
    return res.end()
  }
  json(res, 404, { ok: false, error: 'not_found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[image-mock] мозг-заглушка: http://127.0.0.1:${PORT} (ученикам темы: ${STUDENTS ? 'да' : 'нет'})`)
  if (args.vite) {
    const vitePort = String(args.vite === '1' ? 4837 : args.vite)
    const child = spawn('npx', ['vite', '--port', vitePort, '--strictPort', '--host', '127.0.0.1'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, VITE_BRAIN_URL: `http://127.0.0.1:${PORT}` },
    })
    const stop = () => {
      child.kill()
      server.close()
      process.exit(0)
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    child.on('exit', (code) => {
      server.close()
      process.exit(code ?? 0)
    })
  }
})
