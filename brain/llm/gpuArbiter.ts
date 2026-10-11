/**
 * Арбитр одной видеокарты (RTX 5080, 16 ГБ): Gemma (Ollama) и модель картинок (ComfyUI) вместе не помещаются,
 * поэтому картинки рисуются «окнами»:
 *   a) ComfyUI не готов → задания окна получают not_ready;
 *   b) очередь текста на паузу (ученики видят «в очереди», «занят» не получает никто) → дренаж: ждём, пока идущие
 *      ответы допишутся (текст НИКОГДА не прерывается; задание, которое ждёт дольше jobTimeoutMs, получает busy);
 *   c) выгрузить Gemma (keep_alive 0) → /api/ps пусто → проверить свободную видеопамять ComfyUI;
 *   d) рисовать по одному: /prompt → опрос /history 250 мс → atomlab_safety (нет — картинку не отдаём) → /view WebP;
 *      в окно добираются следующие задания, пока их < window.maxJobs и прошло < window.maxMs;
 *   e) /free в ComfyUI → загрузить Gemma с тем же num_ctx → снять паузу;
 *   f) finally: при любой ошибке — free + load + resume (идемпотентно).
 * Когда открывать следующее окно (cooldown, голодание) — решает сервис картинок (brain/image/service.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { BrainConfig } from '../config.ts'
import type { ComfyClient } from '../image/comfyClient.ts'
import type { ImageJob, JobOutcome } from '../image/types.ts'
import { buildGraph, modelKey, normalizeVariant } from '../image/workflows.ts'
import type { OllamaControl } from './ollamaControl.ts'
import type { LlmQueue } from './queue.ts'

export type ArbiterState = 'llm' | 'draining' | 'image' | 'restoring'

export type ArbiterDeps = {
  getConfig: () => BrainConfig
  queue: LlmQueue
  comfy: () => ComfyClient
  ollama: () => OllamaControl
  /** чат- и быстрая модель (что выгружать и грузить обратно; чат — первой) */
  models: () => string[]
  /** готов ли ComfyUI прямо сейчас (свежая проверка, если давно не смотрели) */
  ensureReady: () => Promise<boolean>
  log: (s: string) => void
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const GB = 2 ** 30

/** Скользящее среднее (первый замер — как есть). */
function ema(prev: number, v: number): number {
  return prev ? Math.round(prev * 0.7 + v * 0.3) : Math.round(v)
}

export class GpuArbiter {
  state: ArbiterState = 'llm'
  readonly counters = { windows: 0, jobsServed: 0, unsafePrompt: 0, unsafeImage: 0, busy: 0, timeouts: 0, comfyErrors: 0 }
  readonly avg = { drainMs: 0, unloadMs: 0, loadMs: 0, genMs: 0, reloadMs: 0 }
  /** последнее устройство ComfyUI (vram_total / vram_free, байты) — для /admin/image/status */
  lastDevice: { name?: string; vram_total: number; vram_free: number } | null = null
  private deps: ArbiterDeps

  constructor(deps: ArbiterDeps) {
    this.deps = deps
  }

  /**
   * Одно окно GPU. take() отдаёт следующее задание из очереди сервиса (null — пусто).
   * Возвращает, приходили ли за время окна текстовые вопросы (для паузы между окнами).
   */
  async runWindow(take: () => ImageJob | null): Promise<{ served: number; textArrived: boolean }> {
    const first = take()
    if (!first) return { served: 0, textArrived: false }
    const { queue, log } = this.deps
    const cfg = this.deps.getConfig()
    const ic = cfg.image
    const w = ic.window
    const jobs: ImageJob[] = [first]
    const live = () => jobs.filter((j) => !j.finished && !j.aborted)
    const emitAll = (phase: string, pct: number) => {
      for (const j of live()) j.emit('progress', { phase, pct, ms: Date.now() - j.createdAt })
    }
    this.counters.windows++
    const queuedBefore = queue.counters.queued
    const windowStart = Date.now()
    first.timings.queueMs = windowStart - first.queuedAt

    // a) ComfyUI не готов — окно не открываем вовсе (Gemma не трогаем)
    if (!(await this.deps.ensureReady())) {
      for (const j of jobs) this.finish(j, { ok: false, code: 'not_ready', reason: 'comfy_not_ready' })
      return { served: 0, textArrived: false }
    }

    let paused = false
    let unloaded = false
    let restored = false
    const models = this.deps.models()
    const restore = async () => {
      if (restored) return
      restored = true
      this.state = 'restoring'
      const tr = Date.now()
      if (unloaded) {
        try {
          await this.deps.comfy().free()
        } catch (err) {
          log(`[image] ComfyUI /free: ${(err as Error).message}`)
        }
        // чат-модель первой: ученики ждут именно её; не дождались за reloadWaitMs — Ollama догрузит сама
        for (const m of models) {
          const okLoad = await this.deps.ollama().load(m, cfg.keepAlive, cfg.numCtx, w.reloadWaitMs)
          if (!okLoad) log(`[image] Gemma ${m}: загрузка не подтвердилась за ${w.reloadWaitMs} мс — догрузится при первом вопросе`)
        }
        this.avg.reloadMs = ema(this.avg.reloadMs, Date.now() - tr)
      }
      if (paused) queue.resume()
      this.state = 'llm'
    }

    let served = 0
    try {
      // b) пауза очереди текста и дренаж: идущие ответы дописываются, новые ждут (их сроки продлены паузой)
      queue.pause('image', w.maxMs + w.reloadWaitMs)
      paused = true
      this.state = 'draining'
      emitAll('waiting_gpu', 10)
      const td = Date.now()
      let warned = false
      while (queue.running > 0) {
        for (const j of live()) {
          if (Date.now() - j.createdAt > ic.jobTimeoutMs) {
            this.counters.busy++
            this.finish(j, { ok: false, code: 'busy', reason: 'drain_timeout', retryAfterSec: 30 })
          }
        }
        if (!live().length) break
        if (!warned && Date.now() - td > w.drainMaxMs) {
          warned = true
          log(`[image] дренаж дольше ${w.drainMaxMs} мс (идёт ${queue.running} ответ.) — текст не прерываем, ждём`)
        }
        await sleep(200)
      }
      const drainMs = Date.now() - td
      // дренаж затянулся — ждущим текст столько же времени сверху (никто не получает «занят» из-за картинки)
      if (drainMs > 1000) queue.extendPause(drainMs)
      this.avg.drainMs = ema(this.avg.drainMs, drainMs)
      first.timings.drainMs = drainMs
      if (!live().length) return { served: 0, textArrived: queue.counters.queued > queuedBefore || queue.stats().waiting > 0 }

      // c) выгрузить Gemma и проверить видеопамять
      this.state = 'image'
      emitAll('switching', 20)
      const tu = Date.now()
      unloaded = true
      await this.deps.ollama().unload(models)
      if (!(await this.deps.ollama().waitUnloaded(models, w.unloadWaitMs))) log(`[image] Ollama не выгрузила ${models.join(', ')} за ${w.unloadWaitMs} мс — продолжаем`)
      const engine = ic.engine
      const variant = normalizeVariant(engine, ic.variant)
      const needGB = Number(ic.vramNeedGB[modelKey(engine, variant)]) || 0
      for (let i = 0; i < 6; i++) {
        try {
          const st = await this.deps.comfy().systemStats()
          this.lastDevice = st.devices[0] ?? null
          if (!needGB || !this.lastDevice || this.lastDevice.vram_free >= needGB * GB) break
          if (i === 5) log(`[image] свободно ${(this.lastDevice.vram_free / GB).toFixed(1)} ГБ < ${needGB} ГБ — рисуем всё равно`)
          else await sleep(2000)
        } catch {
          break
        }
      }
      const unloadMs = Date.now() - tu
      this.avg.unloadMs = ema(this.avg.unloadMs, unloadMs)
      first.timings.unloadMs = unloadMs

      // d) задания по одному; добираем, пока есть место и время
      let job: ImageJob | null = first
      while (job) {
        if (!job.finished && !job.aborted) {
          await this.runJob(job, served === 0, cfg)
          served++
        } else if (!job.finished) this.finish(job, { ok: false, code: 'internal', reason: 'aborted' })
        if (served >= Math.max(1, w.maxJobs) || Date.now() - windowStart >= w.maxMs) break
        job = take()
        if (job) {
          jobs.push(job)
          // вторая картинка окна уже не ждёт ни дренажа, ни выгрузки (пауза уже рассчитана на window.maxMs)
          job.timings.queueMs = Date.now() - job.queuedAt
        }
      }
    } catch (err) {
      this.counters.comfyErrors++
      log(`[image] окно: ${(err as Error).message}`)
      for (const j of live()) this.finish(j, { ok: false, code: 'internal', reason: `window:${(err as Error).message.slice(0, 120)}` })
    } finally {
      // e/f) всегда вернуть Gemma и снять паузу
      await restore()
    }
    return { served, textArrived: queue.counters.queued > queuedBefore || queue.stats().waiting > 0 }
  }

  private finish(job: ImageJob, r: JobOutcome): void {
    if (job.finished) return
    if (r.ok) this.counters.jobsServed++
    job.finish(r)
  }

  /** Одно задание в ComfyUI (окно уже открыто). */
  private async runJob(job: ImageJob, firstInWindow: boolean, cfg: BrainConfig): Promise<void> {
    const ic = cfg.image
    const comfy = this.deps.comfy()
    const variant = normalizeVariant(ic.engine, ic.variant)
    const g = buildGraph({ engine: ic.engine, variant, prompt: job.promptFinal, width: job.width, height: job.height, seed: job.seed, steps: ic.steps, jobId: job.id })
    job.emit('progress', { phase: firstInWindow ? 'loading' : 'sampling', pct: 30, ms: Date.now() - job.createdAt })
    const tg = Date.now()
    let promptId = ''
    try {
      promptId = (await comfy.queuePrompt(g.graph, `atomlab-${job.id}`)).prompt_id
    } catch (err) {
      this.counters.comfyErrors++
      return this.finish(job, { ok: false, code: 'internal', reason: `comfy:${(err as Error).message.slice(0, 160)}` })
    }
    // срок рисования — jobTimeoutMs от постановки в ComfyUI (ожидание окна проверяется отдельно, при дренаже)
    const deadline = tg + ic.jobTimeoutMs
    // ожидаемое время: среднее рисование (+ загрузка моделей для первого задания окна)
    const expect = Math.max(1500, (this.avg.genMs || 5000) + (firstInWindow ? this.avg.loadMs || 4000 : 0))
    let lastPct = 30
    let hist: Awaited<ReturnType<ComfyClient['history']>> = null
    for (;;) {
      await sleep(250)
      if (Date.now() > deadline) {
        this.counters.timeouts++
        await comfy.interrupt(promptId).catch(() => {})
        return this.finish(job, { ok: false, code: 'timeout', reason: 'comfy_timeout' })
      }
      try {
        hist = await comfy.history(promptId)
      } catch {
        hist = null
      }
      if (hist?.status?.status_str === 'error') {
        this.counters.comfyErrors++
        return this.finish(job, { ok: false, code: 'internal', reason: `comfy:${firstMessage(hist.status.messages)}` })
      }
      if (hist?.status?.completed) break
      // синтетический прогресс 30 → 85 по среднему времени (не выше 85 до конца)
      const pct = Math.min(85, 30 + Math.round((55 * (Date.now() - tg)) / expect))
      if (pct >= lastPct + 5) {
        lastPct = pct
        job.emit('progress', { phase: 'sampling', pct, ms: Date.now() - job.createdAt })
      }
    }
    const wall = Date.now() - tg
    const outs = hist.outputs ?? {}
    const imgRef = outs[g.saveNodeId]?.images?.[0]
    const s = outs[g.safetyNodeId]?.atomlab_safety?.[0]
    const safetyMs = Math.max(0, Math.round(Number(s?.ms) || 0))
    // загрузка моделей — только у первого задания окна: сверх среднего «тёплого» рисования
    const warm = this.avg.genMs
    const loadMs = firstInWindow ? (warm ? Math.max(0, wall - safetyMs - warm) : 0) : 0
    const genMs = Math.max(0, wall - safetyMs - loadMs)
    if (firstInWindow) this.avg.loadMs = ema(this.avg.loadMs, loadMs)
    if (!firstInWindow || !warm) this.avg.genMs = ema(this.avg.genMs, genMs)
    job.timings.loadMs = loadMs
    job.timings.genMs = genMs
    job.timings.safetyMs = safetyMs
    job.timings.reloadMs = this.avg.reloadMs // Gemma возвращается ПОСЛЕ выдачи картинки — здесь последний замер
    job.emit('progress', { phase: 'decoding', pct: 90, ms: Date.now() - job.createdAt })
    job.emit('progress', { phase: 'safety', pct: 95, ms: Date.now() - job.createdAt })
    const ownerNoSafety = !ic.safety.required && job.role === 'owner'
    if (!s || typeof s.nsfw !== 'number' || !Number.isFinite(s.nsfw)) {
      this.removeOutput(imgRef, ic.comfyOutputDir)
      if (!ownerNoSafety) return this.finish(job, { ok: false, code: 'internal', reason: 'safety_unavailable' })
    }
    const safety = { nsfw: round3(Number(s?.nsfw) || 0), normal: round3(Number(s?.normal) || 0) }
    if (s && safety.nsfw >= job.nsfwThreshold) {
      this.counters.unsafeImage++
      this.removeOutput(imgRef, ic.comfyOutputDir)
      return this.finish(job, { ok: false, code: 'unsafe_image', reason: `nsfw:${safety.nsfw}`, safety })
    }
    if (!imgRef) return this.finish(job, { ok: false, code: 'internal', reason: 'no_image' })
    job.emit('progress', { phase: 'encoding', pct: 98, ms: Date.now() - job.createdAt })
    let bytes: Buffer
    try {
      bytes = await comfy.view(imgRef, ic.result.quality)
    } catch (err) {
      this.counters.comfyErrors++
      this.removeOutput(imgRef, ic.comfyOutputDir)
      return this.finish(job, { ok: false, code: 'internal', reason: `comfy:${(err as Error).message.slice(0, 120)}` })
    }
    this.removeOutput(imgRef, ic.comfyOutputDir)
    this.finish(job, { ok: true, bytes, safety })
  }

  /** Удалить PNG задания из папки вывода ComfyUI (только внутри comfyOutputDir; галерея не ведётся). */
  private removeOutput(ref: { filename: string; subfolder: string } | undefined, dir: string): void {
    if (!ref || !dir) return
    try {
      const root = path.resolve(dir)
      const p = path.resolve(root, ref.subfolder || '', ref.filename)
      if (!p.startsWith(root + path.sep)) return
      fs.rmSync(p, { force: true })
    } catch {
      /* не страшно: при старте чистятся файлы старше часа */
    }
  }
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}

/** Первое сообщение об ошибке из history.status.messages ([["execution_error", {exception_message}], …]). */
function firstMessage(messages: unknown[] | undefined): string {
  for (const m of messages ?? []) {
    if (!Array.isArray(m)) continue
    const [kind, data] = m as [unknown, Record<string, unknown> | undefined]
    if (kind === 'execution_error' || kind === 'execution_interrupted') {
      const msg = String(data?.exception_message ?? data?.exception_type ?? kind)
      return msg.replace(/\s+/g, ' ').slice(0, 160)
    }
  }
  return 'error'
}
