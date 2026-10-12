/**
 * Сервис картинок: очередь заданий, готовность ComfyUI, окна GPU (brain/llm/gpuArbiter.ts), кэш готовых картинок,
 * журнал. Транспорт (SSE / JSON) — brain/image/http.ts. Конфиг читается на каждый вызов (владелец и selftest
 * меняют его на ходу).
 *
 * Когда открывается окно: есть задание И (после прошлого окна прошло cooldownMs, если в окно приходил текст,
 * ИЛИ старейшее задание ждёт дольше maxStarvationMs). Сам дренаж текста — внутри окна (арбитр).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import type { BrainConfig } from '../config.ts'
import { ulid } from '../kb/storage.ts'
import { GpuArbiter } from '../llm/gpuArbiter.ts'
import type { LlmClient } from '../llm/ollama.ts'
import { OllamaControl } from '../llm/ollamaControl.ts'
import type { LlmQueue } from '../llm/queue.ts'
import { detectLang } from '../pipeline/normalize.ts'
import { ImageCache } from './cache.ts'
import { ComfyClient } from './comfyClient.ts'
import { imagesJournalPath, journalImage, type ImageJournalRow } from './journal.ts'
import { checkFreeText, presetPrompt } from './prompt.ts'
import { StudentQuota, type Permit } from './roles.ts'
import { emptyTimings, IMAGE_MESSAGES, type ImageDone, type ImageErrorCode, type ImageJob, type ImageLang, type ImageRequest, type ImageRole, type JobOutcome } from './types.ts'
import { normalizeVariant, SAFETY_CLASS } from './workflows.ts'

export type ImageServiceDeps = {
  getConfig: () => BrainConfig
  queue: LlmQueue
  llm: LlmClient | null
  log?: (s: string) => void
  /** не писать журнал (eval / второй экземпляр) */
  noJournal?: () => boolean
}

/** Куда идут события задания (SSE или сборщик ответа JSON). */
export type ImageSink = { send: (event: 'accepted' | 'queue' | 'progress' | 'done' | 'error', data: Record<string, unknown>) => void }

export type RunContext = {
  req: ImageRequest
  role: ImageRole
  permit: Extract<Permit, { ok: true }>
  lang: ImageLang
  clientKey: string
  local: boolean
  signal?: AbortSignal
  release: () => void
}

type Recent = { id: string; at: string; role: ImageRole; presetId?: string; outcome: string; reason?: string; ms: number; timings: ImageDone['timings']; safety?: { nsfw: number; normal: number } }

const MIN = 60_000

export class ImageService {
  readonly arbiter: GpuArbiter
  readonly cache: ImageCache
  /** Лимиты картинок ученика в час / сутки (roles.ts StudentQuota; проверяет http.ts). */
  readonly studentQuota = new StudentQuota()
  ready = false
  readyError = ''
  checkedAt = 0
  lastMs: number | null = null
  private deps: ImageServiceDeps
  private pending: ImageJob[] = []
  private windowJobs = 0
  private windowRunning = false
  private nextAllowedAt = 0
  private schedTimer: NodeJS.Timeout | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private starts: number[] = []
  private perClient = new Map<string, number>()
  private recent: Recent[] = []
  private comfyCached: { url: string; client: ComfyClient } | null = null
  private ollamaCached: { url: string; client: OllamaControl } | null = null
  private refreshing: Promise<boolean> | null = null

  constructor(deps: ImageServiceDeps) {
    this.deps = deps
    const cfg = () => deps.getConfig().image
    this.cache = new ImageCache(
      () => cfg().result.cacheTtlMs,
      () => cfg().result.cacheMaxBytes,
    )
    this.arbiter = new GpuArbiter({
      getConfig: deps.getConfig,
      queue: deps.queue,
      comfy: () => this.comfy(),
      ollama: () => this.ollama(),
      models: () => {
        const st = deps.llm?.status()
        return [st?.chatModel, st?.fastModel].filter((m): m is string => !!m)
      },
      ensureReady: () => this.ensureReady(true),
      log: (s) => this.log(s),
    })
  }

  private log(s: string): void {
    ;(this.deps.log ?? console.log)(s)
  }

  get config() {
    return this.deps.getConfig().image
  }

  comfyUrl(): string {
    return (process.env.BRAIN_COMFY_URL || this.config.comfyUrl || 'http://127.0.0.1:8188').replace(/\/+$/, '')
  }

  comfy(): ComfyClient {
    const url = this.comfyUrl()
    if (this.comfyCached?.url !== url) this.comfyCached = { url, client: new ComfyClient(url) }
    return this.comfyCached.client
  }

  ollama(): OllamaControl {
    const url = this.deps.getConfig().ollamaUrl
    if (this.ollamaCached?.url !== url) this.ollamaCached = { url, client: new OllamaControl(url) }
    return this.ollamaCached.client
  }

  /** Опрос готовности ComfyUI раз в comfyPollMs (только когда картинки включены). */
  start(): void {
    if (this.config.enabled) void this.refreshReady()
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      if (this.config.enabled) void this.refreshReady()
    }, Math.max(1000, this.config.comfyPollMs))
    this.pollTimer.unref?.()
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    if (this.schedTimer) clearTimeout(this.schedTimer)
    this.schedTimer = null
  }

  /** Готовность: /system_stats отвечает И наш узел ATOMLABSafetyCheck загружен (без него картинки не отдаются). */
  refreshReady(): Promise<boolean> {
    if (this.refreshing) return this.refreshing
    this.refreshing = (async () => {
      try {
        const c = this.comfy()
        const st = await c.systemStats()
        this.arbiter.lastDevice = st.devices[0] ?? null
        const info = await c.objectInfo(SAFETY_CLASS)
        const ok = !!info && Object.keys(info).length > 0
        this.ready = ok
        this.readyError = ok ? '' : 'safety_node_missing'
      } catch (err) {
        this.ready = false
        this.readyError = (err as Error).message.slice(0, 120)
      } finally {
        this.checkedAt = Date.now()
        this.refreshing = null
      }
      return this.ready
    })()
    return this.refreshing
  }

  /** Готов? Не готов и проверяли давно (или fresh) — проверить сейчас. */
  async ensureReady(fresh = false): Promise<boolean> {
    if (this.ready && !fresh) return true
    if (!fresh && Date.now() - this.checkedAt < 5000) return this.ready
    return this.refreshReady()
  }

  health() {
    const ic = this.config
    return {
      enabled: !!ic.enabled,
      ready: !!ic.enabled && this.ready,
      engine: ic.engine,
      students: !!ic.enabled && !!ic.students.enabled,
      // свой текст без ключа (students.freeText) — сайт показывает поле «Опишите, что нарисовать» всем
      studentFreeText: !!ic.enabled && !!ic.students.enabled && !!ic.students.freeText,
      queue: { running: this.windowRunning ? Math.max(1, this.windowJobs) : 0, waiting: this.pending.length, paused: this.deps.queue.paused },
      lastMs: this.lastMs,
    }
  }

  status() {
    const ic = this.config
    const dev = this.arbiter.lastDevice
    return {
      ok: true,
      enabled: ic.enabled,
      ready: this.ready,
      readyError: this.readyError || undefined,
      checkedAt: this.checkedAt ? new Date(this.checkedAt).toISOString() : null,
      engine: ic.engine,
      variant: normalizeVariant(ic.engine, ic.variant),
      students: ic.students,
      state: this.arbiter.state,
      windowRunning: this.windowRunning,
      pending: this.pending.length,
      llmQueue: this.deps.queue.stats(),
      counters: this.arbiter.counters,
      avg: this.arbiter.avg,
      device: dev ? { name: dev.name, vram_total: dev.vram_total, vram_free: dev.vram_free } : null,
      cache: { items: this.cache.size, bytes: this.cache.bytes },
      recent: this.recent.slice(-20),
    }
  }

  /**
   * Статус для админа + что сейчас в памяти Ollama (/api/ps: вернулась ли Gemma в видеопамять после окна)
   * и сколько строк в журнале картинок (live-приёмка сверяет с числом заданий).
   */
  async statusFull() {
    const ps = await this.ollama().loaded()
    let journalLines: number | null
    try {
      const f = imagesJournalPath()
      journalLines = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0
    } catch {
      journalLines = null
    }
    return { ...this.status(), ollama: ps ? ps.map((m) => ({ name: m.name, size: m.size, size_vram: m.size_vram })) : null, journalLines }
  }

  /**
   * Проверки до открытия потока: очередь не переполнена, лимит стартов в минуту (общий), один ученик — не больше
   * perClientQueued заданий. Успех — release() (вызвать по завершении задания).
   */
  reserve(clientKey: string, limited: boolean): { ok: true; release: () => void } | { ok: false; code: ImageErrorCode; rule?: string; retryAfterSec: number } {
    const ic = this.config
    const now = Date.now()
    if (this.pending.length >= Math.max(1, ic.rate.queueCap)) return { ok: false, code: 'busy', retryAfterSec: 30 }
    if (limited) {
      const n = this.perClient.get(clientKey) ?? 0
      if (ic.rate.perClientQueued > 0 && n >= ic.rate.perClientQueued) return { ok: false, code: 'rate', rule: 'image_streams', retryAfterSec: 10 }
      this.starts = this.starts.filter((t) => now - t < MIN)
      if (ic.rate.globalPerMin > 0 && this.starts.length >= ic.rate.globalPerMin) {
        return { ok: false, code: 'rate', rule: 'image_global', retryAfterSec: Math.max(1, Math.ceil((this.starts[0]! + MIN - now) / 1000)) }
      }
      this.starts.push(now)
    }
    this.perClient.set(clientKey, (this.perClient.get(clientKey) ?? 0) + 1)
    let released = false
    return {
      ok: true,
      release: () => {
        if (released) return
        released = true
        const m = (this.perClient.get(clientKey) ?? 1) - 1
        if (m <= 0) this.perClient.delete(clientKey)
        else this.perClient.set(clientKey, m)
      },
    }
  }

  /** Язык ответа: явный или по тексту запроса (по умолчанию ru). */
  static langOf(req: ImageRequest): ImageLang {
    if (req.lang === 'ru' || req.lang === 'uz' || req.lang === 'en') return req.lang
    return req.prompt ? detectLang(req.prompt) : 'ru'
  }

  private etaSec(position: number): number {
    const a = this.arbiter.avg
    const per = a.genMs || 6000
    const sw = this.windowRunning ? 0 : (a.drainMs || 0) + (a.unloadMs || 2000) + (a.loadMs || 4000)
    return Math.max(1, Math.round((sw + position * per) / 1000))
  }

  private notifyPositions(): void {
    this.pending.forEach((j, i) => j.emit('queue', { position: i + 1, waiting: this.pending.length, etaSec: this.etaSec(i + 1) }))
  }

  private take = (): ImageJob | null => {
    while (this.pending.length) {
      const j = this.pending.shift()!
      if (j.aborted || j.finished) {
        if (!j.finished) j.finish({ ok: false, code: 'internal', reason: 'aborted' })
        continue
      }
      this.windowJobs++
      this.notifyPositions()
      return j
    }
    return null
  }

  private schedule(): void {
    if (this.windowRunning || !this.pending.length) return
    if (this.schedTimer) {
      clearTimeout(this.schedTimer)
      this.schedTimer = null
    }
    const w = this.config.window
    const now = Date.now()
    const oldest = Math.min(...this.pending.map((j) => j.queuedAt))
    const starving = now - oldest >= w.maxStarvationMs
    if (now >= this.nextAllowedAt || starving) {
      void this.openWindow()
      return
    }
    const at = Math.min(this.nextAllowedAt, oldest + w.maxStarvationMs)
    this.schedTimer = setTimeout(() => {
      this.schedTimer = null
      this.schedule()
    }, Math.max(50, at - now))
    this.schedTimer.unref?.()
  }

  private async openWindow(): Promise<void> {
    this.windowRunning = true
    this.windowJobs = 0
    try {
      const r = await this.arbiter.runWindow(this.take)
      // текст приходил во время окна — следующее окно не раньше cooldownMs (картинки не вытесняют учеников)
      this.nextAllowedAt = r.textArrived ? Date.now() + this.config.window.cooldownMs : Date.now()
    } catch (err) {
      this.log(`[image] окно упало: ${(err as Error).message}`)
      this.nextAllowedAt = Date.now() + this.config.window.cooldownMs
    } finally {
      this.windowRunning = false
      this.windowJobs = 0
      this.notifyPositions()
      this.schedule()
    }
  }

  /** Выполнить запрос целиком: accepted → проверка текста → очередь → окно GPU → done | error; журнал. */
  async run(ctx: RunContext, sink: ImageSink): Promise<void> {
    const cfg = this.deps.getConfig()
    const ic = cfg.image
    const { req, role, lang } = ctx
    const id = ulid()
    const createdAt = Date.now()
    const [width, height] = ic.sizes[req.size] ?? ic.sizes.square
    const seed = typeof req.seed === 'number' ? req.seed : crypto.randomInt(0, 2 ** 47) * 2 + crypto.randomInt(0, 2)
    const variant = normalizeVariant(ic.engine, ic.variant)
    const preset = ctx.permit.preset
    const style = req.style ?? preset?.style ?? 'illustration'
    const timings = emptyTimings()
    let final = ''
    let translated = false
    const journal = (outcome: ImageJournalRow['outcome'], extra: { reason?: string; safety?: { nsfw: number; normal: number } } = {}) => {
      const ms = Date.now() - createdAt
      const row = {
        id,
        at: new Date(createdAt).toISOString(),
        role,
        ...(req.studentId ? { studentId: req.studentId.slice(0, 64) } : {}),
        sessionId: req.sessionId.slice(0, 64),
        ...(preset ? { presetId: preset.id } : {}),
        promptHash: '',
        promptText: preset ? preset.id : (req.prompt ?? ''),
        ...(role !== 'student' && req.prompt ? { prompt: req.prompt } : {}),
        engine: ic.engine,
        variant,
        size: req.size,
        seed,
        ms,
        timings,
        ...(extra.safety ? { safety: extra.safety } : {}),
        outcome,
        ...(extra.reason ? { reason: extra.reason } : {}),
      }
      journalImage(row, { dialogLog: cfg.server.dialogLog, local: ctx.local, noJournal: this.deps.noJournal?.() })
      this.recent.push({ id, at: row.at, role, ...(preset ? { presetId: preset.id } : {}), outcome, ...(extra.reason ? { reason: extra.reason } : {}), ms, timings: { ...timings }, ...(extra.safety ? { safety: extra.safety } : {}) })
      if (this.recent.length > 40) this.recent.splice(0, this.recent.length - 20)
    }
    const fail = (code: ImageErrorCode, o: { message?: string; reason?: string; retryAfterSec?: number; safety?: { nsfw: number; normal: number } } = {}) => {
      sink.send('error', { code, message: o.message ?? IMAGE_MESSAGES[code][lang], ...(o.retryAfterSec ? { retryAfterSec: o.retryAfterSec } : {}) })
      const outcome: ImageJournalRow['outcome'] = code === 'unsafe_prompt' || code === 'unsafe_image' || code === 'busy' ? code : 'error'
      journal(outcome, { reason: o.reason ?? code, safety: o.safety })
    }
    try {
      sink.send('accepted', { jobId: id, role, engine: ic.engine, variant, width, height, ...(preset ? { presetId: preset.id } : {}), etaSec: this.etaSec(this.pending.length + 1) })
      sink.send('progress', { phase: 'checking', pct: 5, ms: Date.now() - createdAt })
      if (preset && !ctx.permit.freeText) {
        final = presetPrompt(preset, req.style)
      } else {
        const r = await checkFreeText({ text: req.prompt ?? '', lang, style, llm: this.deps.llm, queue: this.deps.queue, llmCheck: ic.llmCheck || role === 'student', strict: role === 'student', signal: ctx.signal })
        if (!r.ok) {
          if (r.code === 'unsafe_prompt') this.arbiter.counters.unsafePrompt++
          return fail(r.code, { message: r.message, reason: r.category ? `filter:${r.category}` : r.code })
        }
        final = r.final
        translated = r.translated
      }
      if (ctx.signal?.aborted) return journal('error', { reason: 'client_abort' })
      // в очередь картинок; итог — через finish (ровно один раз)
      const outcome = await new Promise<JobOutcome>((resolve) => {
        const job: ImageJob = {
          id,
          role,
          createdAt,
          queuedAt: Date.now(),
          promptFinal: final,
          width,
          height,
          seed,
          nsfwThreshold: ctx.permit.nsfwThreshold,
          timings,
          aborted: false,
          finished: false,
          emit: (event, data) => sink.send(event, data),
          finish: (r) => {
            if (job.finished) return
            job.finished = true
            resolve(r)
          },
        }
        ctx.signal?.addEventListener(
          'abort',
          () => {
            job.aborted = true
            const i = this.pending.indexOf(job)
            if (i >= 0) {
              this.pending.splice(i, 1)
              job.finish({ ok: false, code: 'internal', reason: 'client_abort' })
              this.notifyPositions()
            }
          },
          { once: true },
        )
        this.pending.push(job)
        job.emit('queue', { position: this.pending.length, waiting: this.pending.length, etaSec: this.etaSec(this.pending.length) })
        this.schedule()
      })
      if (!outcome.ok) return fail(outcome.code, { reason: outcome.reason, retryAfterSec: outcome.retryAfterSec, safety: outcome.safety })
      const ms = Date.now() - createdAt
      this.lastMs = ms
      this.cache.put(id, outcome.bytes)
      const done: ImageDone = {
        jobId: id,
        dataUrl: `data:image/webp;base64,${outcome.bytes.toString('base64')}`,
        mime: 'image/webp',
        width,
        height,
        seed,
        engine: ic.engine,
        variant,
        ms,
        timings: { ...timings },
        prompt: { final, translated, ...(preset ? { presetId: preset.id } : {}) },
        safety: outcome.safety,
        ...(req.overlay ? { overlay: req.overlay } : {}),
        url: `/image/${id}`,
      }
      sink.send('done', done as unknown as Record<string, unknown>)
      journal('ok', { safety: outcome.safety })
    } catch (err) {
      this.log(`[image] задание ${id}: ${(err as Error).message}`)
      fail('internal', { reason: 'exception' })
    } finally {
      ctx.release()
    }
  }
}

export function createImageService(deps: ImageServiceDeps): ImageService {
  return new ImageService(deps)
}
