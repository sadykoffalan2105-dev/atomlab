/**
 * «Мозг» ИИ-учителя ATOMLAB — локальный HTTP-сервер (контракт v1, см. brain/README.md).
 *   GET  /health     — состояние: LLM (Ollama), база;
 *   POST /chat       — ответ потоком SSE (meta / delta / done / error);
 *   POST /kb/append  — дописать запись в журнал базы (только append);
 *   GET  /kb/stats   — статистика журнала.
 * Запуск: npx tsx brain/server.ts (или npm run brain:start). Без Ollama работает запасным путём.
 */
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { CONTRACT, DATA_DIR, loadConfig, PORT, SERVICE, VERSION, type BrainConfig } from './config.ts'
import { EmbedStore } from './kb/embedStore.ts'
import { Journal, validateAppend } from './kb/journal.ts'
import { Knowledge } from './kb/shards.ts'
import { OllamaClient, type LlmClient } from './llm/ollama.ts'
import { runChat, validateChatRequest, type BrainDeps } from './pipeline/chat.ts'
import { setElementWords } from './pipeline/normalize.ts'
import { sseComment, sseHeaders, sseSend } from './sse.ts'
import { StudentStore } from './student/events.ts'

const ALLOWED_ORIGIN = 'https://sadykoffalan2105-dev.github.io'

/** null — запроса без Origin (curl, скрипты): CORS не нужен; false — чужой сайт (403). */
export function checkOrigin(origin: string | undefined): string | null | false {
  if (!origin) return null
  if (origin === ALLOWED_ORIGIN) return origin
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin)) return origin
  return false
}

export type Brain = {
  deps: BrainDeps
  startedAt: number
  ollama: OllamaClient | null
  /** Пока знания грузятся (быстрый старт сервера) — промис; /chat ждёт его, /health отвечает сразу. */
  ready?: Promise<void>
  loading?: boolean
}

/** Собрать зависимости: конфиг, знания, журнал, векторы, ученики, клиент Ollama (llm: null — без LLM). */
export function createBrain(opts: { llm?: LlmClient | null; config?: BrainConfig } = {}): Brain {
  const config = opts.config ?? loadConfig()
  const kb = new Knowledge().load()
  setElementWords(kb.qa.elements.flatMap((e) => [e.s, e.ru, e.en, e.uz]))
  const journal = new Journal().load()
  const embeds = new EmbedStore(config.embedModel).load()
  const ollama = opts.llm === undefined ? new OllamaClient(config) : null
  const llm = opts.llm === undefined ? ollama : opts.llm
  const deps: BrainDeps = { kb, journal, embeds, llm, students: new StudentStore(), config }
  return { deps, startedAt: Date.now(), ollama }
}

/**
 * Быстрый старт: пустые хранилища сразу (сервер слушает порт за секунды), знания и журнал догружаются
 * порциями в фоне; brain.ready завершается, когда загружены шарды, журнал, векторы и индекс BM25 журнала.
 */
export function createBrainLazy(opts: { llm?: LlmClient | null; config?: BrainConfig; log?: (s: string) => void } = {}): Brain {
  const config = opts.config ?? loadConfig()
  const log = opts.log ?? (() => {})
  const kb = new Knowledge()
  const journal = new Journal()
  const embeds = new EmbedStore(config.embedModel)
  const ollama = opts.llm === undefined ? new OllamaClient(config) : null
  const llm = opts.llm === undefined ? ollama : opts.llm
  // BRAIN_NO_DIALOG_LOG=1 — замеры/eval на втором экземпляре: не дописывать диалоги и события учеников в журнал владельца
  const deps: BrainDeps = { kb, journal, embeds, llm, students: new StudentStore(), config, noJournal: process.env.BRAIN_NO_DIALOG_LOG === '1' }
  const brain: Brain = { deps, startedAt: Date.now(), ollama, loading: true }
  brain.ready = (async () => {
    const t0 = performance.now()
    await kb.loadAsync()
    setElementWords(kb.qa.elements.flatMap((e) => [e.s, e.ru, e.en, e.uz]))
    await journal.loadAsync()
    embeds.load()
    const idx = await journal.buildIndex({ yieldEvery: 1000 })
    brain.loading = false
    log(
      `[brain] знания загружены за ${Math.round(performance.now() - t0)} мс: шарды ${kb.docCount} · журнал ${journal.lines} строк (индекс: из кеша ${idx.cached}, добавлено ${idx.added}) · векторы ${embeds.size}`,
    )
  })()
  return brain
}

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), ...headers })
  res.end(data)
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new Error('too_large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function healthBody(brain: Brain) {
  const st = brain.deps.llm?.status()
  return {
    ok: true,
    service: SERVICE,
    version: VERSION,
    contract: CONTRACT,
    llm: { available: !!st?.available, chatModel: st?.chatModel ?? null, fastModel: st?.fastModel ?? null, embedModel: st?.embedModel ?? null },
    kb: { docs: brain.deps.kb.docCount + brain.deps.journal.searchableCount(), journalLines: brain.deps.journal.lines, embedded: brain.deps.embeds?.size ?? 0 },
    uptimeMs: Date.now() - brain.startedAt,
    ...(brain.loading ? { loading: true } : {}),
  }
}

export function createServer(brain: Brain): http.Server {
  const { deps } = brain
  return http.createServer(async (req, res) => {
    const origin = checkOrigin(req.headers.origin)
    if (origin === false) return json(res, 403, { ok: false, error: { code: 'forbidden_origin', message: 'Origin не разрешён' } })
    const cors: Record<string, string> = origin
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
          ...(req.headers['access-control-request-private-network'] ? { 'Access-Control-Allow-Private-Network': 'true' } : {}),
        }
      : {}
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors)
        return res.end()
      }
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, healthBody(brain), cors)
      if (req.method === 'GET' && url.pathname === '/kb/stats') {
        const s = deps.journal.stats()
        return json(res, 200, { ...s, embedded: deps.embeds?.size ?? 0, dataDir: DATA_DIR }, cors)
      }
      if (req.method === 'POST' && url.pathname === '/kb/append') {
        let body: unknown
        try {
          body = JSON.parse(await readBody(req, 512 * 1024))
        } catch {
          return json(res, 400, { ok: false, error: { code: 'bad_request', message: 'нужен JSON' } }, cors)
        }
        const v = validateAppend(body)
        if (typeof v === 'string') return json(res, 400, { ok: false, error: { code: 'bad_request', message: v } }, cors)
        // дописываем только после загрузки журнала: иначе счётчик строк и проверка дубликатов были бы неполными
        if (brain.ready) await brain.ready
        const { record, line } = deps.journal.append(v)
        return json(res, 200, { ok: true, id: record.id, line, ...(record.kind === 'dup' ? { dup: true, ref: record.meta.ref } : {}) }, cors)
      }
      if (req.method === 'POST' && url.pathname === '/chat') {
        let body: unknown
        try {
          body = JSON.parse(await readBody(req, 256 * 1024))
        } catch {
          return json(res, 400, { ok: false, error: { code: 'bad_request', message: 'нужен JSON' } }, cors)
        }
        const chat = validateChatRequest(body)
        if (typeof chat === 'string') return json(res, 400, { ok: false, error: { code: 'bad_request', message: chat } }, cors)
        if (brain.ready) await brain.ready
        const ac = new AbortController()
        res.on('close', () => {
          if (!res.writableEnded) ac.abort()
        })
        sseHeaders(res, cors)
        // «сердцебиение»: SSE-комментарий сразу и каждые 5 с, пока модель читает подсказку (до 45 с) —
        // соединение живое, клиент показывает «Думаю…» и не уходит в запасной путь раньше времени
        sseComment(res, 'thinking')
        const hb = setInterval(() => sseComment(res, 'hb'), 5000)
        try {
          await runChat(
            chat,
            deps,
            {
              meta: (m) => sseSend(res, 'meta', m),
              delta: (t) => sseSend(res, 'delta', { text: t }),
              done: (d) => sseSend(res, 'done', d),
              error: (e) => sseSend(res, 'error', e),
            },
            ac.signal,
          )
        } catch (err) {
          console.error('[brain] /chat:', err)
          sseSend(res, 'error', { code: 'internal', message: (err as Error).message })
        } finally {
          clearInterval(hb)
        }
        return res.end()
      }
      return json(res, 404, { ok: false, error: { code: 'not_found', message: `${req.method} ${url.pathname}` } }, cors)
    } catch (err) {
      console.error('[brain]', err)
      if (!res.headersSent) return json(res, 500, { ok: false, error: { code: 'internal', message: (err as Error).message } }, cors)
      res.end()
    }
  })
}

export async function main(): Promise<void> {
  const t0 = performance.now()
  const brain = createBrainLazy({ log: (s) => console.log(s) })
  const server = createServer(brain)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, '127.0.0.1', () => resolve())
  })
  brain.ollama?.start() // первый опрос /api/tags сразу прогревает чат- и быструю модели (персона в кеше)
  console.log(`[brain] ${SERVICE} ${VERSION} слушает http://127.0.0.1:${PORT} за ${Math.round(performance.now() - t0)} мс · данные: ${DATA_DIR} · Ollama: ${brain.deps.config.ollamaUrl} (опрос каждые ${Math.round(brain.deps.config.pollMs / 1000)} с)`)
  await brain.ready
  const st = await (brain.ollama?.refresh() ?? Promise.resolve(null))
  console.log(
    st?.available
      ? `[brain] atomlab-brain http://127.0.0.1:${PORT}, llm: ${st.chatModel}${st.fastModel && st.fastModel !== st.chatModel ? ` (fast: ${st.fastModel})` : ''}, embed: ${st.embedModel ?? '—'}, kb: ${healthBody(brain).kb.docs} docs`
      : `[brain] atomlab-brain http://127.0.0.1:${PORT}, llm: нет (запасной путь: поиск + расчёты + шаблоны), kb: ${healthBody(brain).kb.docs} docs`,
  )
  const stop = () => {
    brain.ollama?.stop()
    server.close()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[brain] не стартовал:', err)
    process.exit(1)
  })
}
