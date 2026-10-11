/**
 * «Мозг» ИИ-учителя ATOMLAB — HTTP-сервер (контракт v1, см. brain/README.md).
 *   GET  /health        — состояние: LLM (Ollama), база, очередь (публично, без путей и секретов);
 *   POST /chat          — ответ потоком SSE (queue / meta / delta / done / error);
 *   POST /kb/append     — дописать запись в журнал базы (только append) — ТОЛЬКО админ;
 *   GET  /kb/stats      — статистика журнала (с путём папки данных) — ТОЛЬКО админ;
 *   GET  /admin/status  — очередь, лимиты, профиль — ТОЛЬКО админ.
 * Запуск: npx tsx brain/server.ts (или npm run brain:start). Без Ollama работает запасным путём.
 *
 * Публичный режим (туннель Tailscale Funnel → http://127.0.0.1:8787): адрес ученика — из заголовков прокси
 * (brain/http/clientIp.ts, только солёный хеш), лимиты частоты и размера (brain/http/rateLimit.ts, guard.ts),
 * очередь к модели (brain/llm/queue.ts), админ — по ключу X-Brain-Admin (config.adminToken).
 */
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { applyProfile, CONTRACT, DATA_DIR, DEFAULT_CONFIG, loadConfig, PORT, SERVICE, VERSION, type BrainConfig } from './config.ts'
import { clientInfo } from './http/clientIp.ts'
import { BodyError, checkChatLimits, checkOriginWith, corsHeaders, isAdmin, json, jsonError, readJson, readJsonWithSize } from './http/guard.ts'
import { checkChatImages, fillPhotoText, photoLimits, photoRules } from './http/photo.ts'
import { RateLimiter, StreamCounter, type RateRule } from './http/rateLimit.ts'
import { EmbedStore } from './kb/embedStore.ts'
import { Journal, validateAppend } from './kb/journal.ts'
import { Knowledge } from './kb/shards.ts'
import { OllamaClient, type LlmClient } from './llm/ollama.ts'
import { LlmQueue, QueueTicket } from './llm/queue.ts'
import { runChat, validateChatRequest, type BrainDeps } from './pipeline/chat.ts'
import { setElementWords } from './pipeline/normalize.ts'
import { sseComment, sseHeaders, sseSend } from './sse.ts'
import { StudentStore } from './student/events.ts'

/** null — запроса без Origin (curl, скрипты): CORS не нужен; false — чужой сайт (403). Списки — config.server. */
export function checkOrigin(origin: string | undefined, cfg: Pick<BrainConfig['server'], 'corsOrigins' | 'corsLocalhost'> = DEFAULT_CONFIG.server): string | null | false {
  return checkOriginWith(origin, cfg)
}

export type Brain = {
  deps: BrainDeps
  startedAt: number
  ollama: OllamaClient | null
  /** Пока знания грузятся (быстрый старт сервера) — промис; /chat ждёт его, /health отвечает сразу. */
  ready?: Promise<void>
  loading?: boolean
  /** очередь к модели (создаёт createServer по config.llm) */
  queue?: LlmQueue
}

/** Собрать зависимости: конфиг, знания, журнал, векторы, ученики, клиент Ollama (llm: null — без LLM). */
export function createBrain(opts: { llm?: LlmClient | null; config?: BrainConfig } = {}): Brain {
  const config = applyProfile(opts.config ?? loadConfig())
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
  const config = applyProfile(opts.config ?? loadConfig())
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

/** /health — публично: ни путей, ни ключей, ни адресов. */
export function healthBody(brain: Brain) {
  const st = brain.deps.llm?.status()
  const q = brain.queue?.stats()
  return {
    ok: true,
    service: SERVICE,
    version: VERSION,
    contract: CONTRACT,
    // vision (сверх контракта v1): чат-модель понимает фото задачи (/api/show capabilities ∋ 'vision')
    llm: { available: !!st?.available, chatModel: st?.chatModel ?? null, fastModel: st?.fastModel ?? null, embedModel: st?.embedModel ?? null, vision: st?.vision === true },
    kb: { docs: brain.deps.kb.docCount + brain.deps.journal.searchableCount(), journalLines: brain.deps.journal.lines, embedded: brain.deps.embeds?.size ?? 0 },
    // нагрузка (сверх контракта v1): сайт может честно сказать «много вопросов, отвечу чуть позже»
    ...(q ? { queue: { parallel: q.parallel, running: q.running, waiting: q.waiting } } : {}),
    uptimeMs: Date.now() - brain.startedAt,
    ...(brain.loading ? { loading: true } : {}),
  }
}

const MIN = 60_000
const DAY = 24 * 60 * MIN

/** Группа лимитов по пути запроса. */
function rateRules(method: string, path: string, r: BrainConfig['server']['rate']): { group: string; rules: RateRule[] } {
  if (method === 'POST' && path === '/chat')
    return {
      group: 'chat',
      rules: [
        { name: 'chat_minute', windowMs: MIN, max: r.chatPerMin },
        { name: 'chat_day', windowMs: DAY, max: r.chatPerDay },
      ],
    }
  if (method === 'GET' && path === '/health') return { group: 'health', rules: [{ name: 'health_minute', windowMs: MIN, max: r.healthPerMin }] }
  return { group: 'other', rules: [{ name: 'other_minute', windowMs: MIN, max: r.otherPerMin }] }
}

/** Пути, которые пишут или показывают внутренности: только админ. */
const ADMIN_PATHS = new Set(['/kb/append', '/kb/stats', '/admin/status'])

export function createServer(brain: Brain): http.Server {
  const { deps } = brain
  const queue = (brain.queue ??= new LlmQueue(deps.config.llm))
  const limiter = new RateLimiter()
  const streams = new StreamCounter()

  const server = http.createServer(async (req, res) => {
    // конфиг читаем на каждый запрос (selftest меняет лимиты на ходу)
    const cfg = deps.config
    const sc = cfg.server
    const client = clientInfo(req, sc.trustProxy)
    const origin = checkOriginWith(req.headers.origin, sc)
    if (origin === false) return jsonError(res, 403, 'forbidden_origin', 'Origin не разрешён')
    const cors = corsHeaders(origin, req)
    let url: URL
    try {
      url = new URL(req.url ?? '/', 'http://127.0.0.1')
    } catch {
      return jsonError(res, 400, 'bad_request', 'неверный адрес', cors)
    }
    const method = req.method ?? 'GET'
    const path = url.pathname
    const admin = isAdmin(req, client, cfg.adminToken)
    // владелец с этого ПК (и админ по ключу) не ограничен ни по частоте, ни по фото
    const limited = !((sc.rate.exemptLocal && client.local) || (admin && cfg.adminToken))
    try {
      // лимит частоты — до чтения тела
      if (limited) {
        const rr = rateRules(method, path, sc.rate)
        const v = limiter.hit(rr.group, client.key, rr.rules)
        if (!v.ok) {
          req.resume()
          return json(
            res,
            429,
            { ok: false, error: 'rate', code: 'rate', rule: v.rule, retryAfterSec: v.retryAfterSec, message: 'Слишком много вопросов подряд — подождите немного.' },
            { ...cors, 'Retry-After': String(v.retryAfterSec) },
          )
        }
      }
      if (method === 'OPTIONS') {
        res.writeHead(204, cors)
        return res.end()
      }
      if (method === 'GET' && path === '/health') return json(res, 200, healthBody(brain), cors)
      if (ADMIN_PATHS.has(path) && !admin) {
        req.resume()
        return jsonError(res, 403, 'forbidden', 'только для администратора мозга', cors)
      }
      if (method === 'GET' && path === '/kb/stats') {
        const s = deps.journal.stats()
        return json(res, 200, { ...s, embedded: deps.embeds?.size ?? 0, dataDir: DATA_DIR }, cors)
      }
      if (method === 'GET' && path === '/admin/status') {
        return json(
          res,
          200,
          {
            ok: true,
            profile: cfg.profile,
            queue: queue.stats(),
            rate: { clients: limiter.size, openStreams: streams.total, limits: sc.rate },
            dialogLog: deps.noJournal ? 'off' : sc.dialogLog,
            adminToken: cfg.adminToken ? 'set' : 'empty',
            keepAlive: cfg.keepAlive,
            numCtx: cfg.numCtx,
            uptimeMs: Date.now() - brain.startedAt,
          },
          cors,
        )
      }
      if (method === 'POST' && path === '/kb/append') {
        const body = await readJson(req, 512 * 1024)
        const v = validateAppend(body)
        if (typeof v === 'string') return jsonError(res, 400, 'bad_request', v, cors)
        // дописываем только после загрузки журнала: иначе счётчик строк и проверка дубликатов были бы неполными
        if (brain.ready) await brain.ready
        const { record, line } = deps.journal.append(v)
        return json(res, 200, { ok: true, id: record.id, line, ...(record.kind === 'dup' ? { dup: true, ref: record.meta.ref } : {}) }, cors)
      }
      if (method === 'POST' && path === '/chat') {
        // фото задачи (brain/http/photo.ts): тело с фото может быть больше обычного; без фото — прежний лимит (413)
        const ph = photoLimits(sc)
        const { body, bytes } = await readJsonWithSize(req, Math.max(sc.bodyLimitBytes, ph.bodyLimitBytes))
        const photo = checkChatImages(body, ph)
        if (!photo.ok) return jsonError(res, photo.status, photo.code, photo.message, cors)
        if (!photo.images.length && bytes > sc.bodyLimitBytes) return jsonError(res, 413, 'too_large', `тело больше ${sc.bodyLimitBytes} байт`, cors)
        const lim = checkChatLimits(body, sc)
        if (lim) return jsonError(res, 400, 'bad_request', lim, cors)
        if (photo.images.length) fillPhotoText(body)
        const chat = validateChatRequest(body)
        if (typeof chat === 'string') return jsonError(res, 400, 'bad_request', chat, cors)
        if (photo.images.length) {
          // отдельный лимит фото на ученика (модель со зрением дороже текста); 429 с rule photo_* — сайт не считает мозг занятым
          if (limited) {
            const v = limiter.hit('photo', client.key, photoRules(ph))
            if (!v.ok) {
              return json(
                res,
                429,
                { ok: false, error: 'rate', code: 'rate', rule: v.rule, retryAfterSec: v.retryAfterSec, message: 'Слишком много фото подряд — подождите немного или напишите условие текстом.' },
                { ...cors, 'Retry-After': String(v.retryAfterSec) },
              )
            }
          }
          // в конвейер — только в памяти запроса; журнал получает лишь флаг hasImage (brain/pipeline/photo.ts)
          chat.images = photo.images
          chat.hasImage = true
        }
        if (!streams.tryOpen(client.key, sc.chatStreamsPerClient)) {
          return json(res, 429, { ok: false, error: 'rate', code: 'rate', rule: 'streams', retryAfterSec: 5, message: 'Дождитесь ответа на предыдущий вопрос.' }, { ...cors, 'Retry-After': '5' })
        }
        const ac = new AbortController()
        res.on('close', () => {
          if (!res.writableEnded) ac.abort()
        })
        // заголовки и «сердцебиение» — сразу (до загрузки знаний и очереди): сайт ждёт первый байт 6 с
        sseHeaders(res, cors)
        sseComment(res, 'thinking')
        const hb = setInterval(() => sseComment(res, 'hb'), 5000)
        const ticket = deps.llm ? new QueueTicket(deps.llm, queue, { signal: ac.signal, onPosition: (p) => sseSend(res, 'queue', p) }) : null
        // журнал диалогов: адрес не пишется никогда; 'local' — только владелец с этого ПК, 'off' — никто
        const noJournal = !!deps.noJournal || sc.dialogLog === 'off' || (sc.dialogLog === 'local' && !client.local)
        const reqDeps: BrainDeps = { ...deps, llm: ticket ?? deps.llm, noJournal }
        // модель занята (очередь полна / по оценке не дождаться / ждали слишком долго) — запасной путь, reason 'busy'
        const mark = <T extends { reason?: string }>(e: T): T => (ticket?.busy && ticket.busy !== 'abort' ? { ...e, reason: 'busy' } : e)
        try {
          if (brain.ready) await brain.ready
          // фото: умеет ли чат-модель картинки, узнаём до ответа (/api/show; старт сервера мог ещё не успеть)
          if (chat.images?.length) await brain.ollama?.ensureCapabilities()
          await runChat(
            chat,
            reqDeps,
            {
              meta: (m) => sseSend(res, 'meta', mark(m)),
              delta: (t) => sseSend(res, 'delta', { text: t }),
              done: (d) => sseSend(res, 'done', mark(d)),
              error: (e) => sseSend(res, 'error', e),
            },
            ac.signal,
          )
        } catch (err) {
          console.error('[brain] /chat:', err)
          sseSend(res, 'error', { code: 'internal', message: 'внутренняя ошибка мозга' })
        } finally {
          clearInterval(hb)
          ticket?.release()
          streams.close(client.key)
        }
        return res.end()
      }
      return jsonError(res, 404, 'not_found', `${method} ${path.slice(0, 80)}`, cors)
    } catch (err) {
      if (err instanceof BodyError) {
        return jsonError(res, err.status, err.code, err.message, err.status === 413 ? { ...cors, Connection: 'close' } : cors)
      }
      console.error('[brain]', err)
      // наружу — без текста исключения (пути, стеки)
      if (!res.headersSent) return jsonError(res, 500, 'internal', 'внутренняя ошибка мозга', cors)
      res.end()
    }
  })
  // медленные клиенты не держат сокеты: заголовки — 15 с, всё тело запроса — 30 с (поток ответа SSE не ограничен)
  server.headersTimeout = 15_000
  server.requestTimeout = 30_000
  return server
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
  const cfg = brain.deps.config
  console.log(`[brain] ${SERVICE} ${VERSION} слушает http://127.0.0.1:${PORT} за ${Math.round(performance.now() - t0)} мс · данные: ${DATA_DIR} · Ollama: ${cfg.ollamaUrl} (опрос каждые ${Math.round(cfg.pollMs / 1000)} с)`)
  console.log(
    `[brain] профиль ${cfg.profile}: очередь ${cfg.llm.parallel} одновременно, ждут до ${cfg.llm.queueCap} (≤ ${Math.round(cfg.llm.queueWaitMs / 1000)} с), keep_alive ${cfg.keepAlive}, окно ${cfg.numCtx} · лимит /chat ${cfg.server.rate.chatPerMin}/мин и ${cfg.server.rate.chatPerDay}/сутки · журнал диалогов: ${brain.deps.noJournal ? 'off' : cfg.server.dialogLog} · ключ админа: ${cfg.adminToken ? 'задан' : 'пуст (админ только с этого ПК)'}`,
  )
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
