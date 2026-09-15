/**
 * Бесплатный «умный ИИ» учителя через Puter.js (puter.ai.chat).
 *
 * Puter работает по модели «User Pays»: запросы оплачивает бесплатный аккаунт
 * самого ученика — у приложения нет ни ключей, ни сервера. Правила:
 *  • подключение — только явным согласием ученика (кнопка «Подключить умный ИИ»
 *    → connectSmartAi() из обработчика клика); фоновые запросы НИКОГДА не
 *    открывают окно входа и не ждут его (раньше — до 45 с посреди урока);
 *  • короткие таймауты и AbortSignal везде; при сбое вызывающий сразу отвечает
 *    локально (база знаний + локальный составитель ответа);
 *  • стриминг (stream: true): текст приходит кусками — живой диалог начинает
 *    говорить первую фразу, не дожидаясь конца ответа.
 *
 * Gateway-ready: streamTeacherChat / requestPuterChat — единственные точки, которые
 * нужно заменить на свой шлюз, если он появится.
 */
import {
  checkPuterSignedIn,
  ensurePuterSignedIn,
  isPuterLoaded,
  isPuterSignedInSync,
  isSmartAiOptedIn,
  loadPuterScript,
  SMART_AI_STORAGE_KEY,
} from './learnPuterTts'
import { buildAssistantSystemPrompt, buildLiveAssistantSystemPrompt } from './learnAssistantPrompt'
import { filterAssistantReply } from './learnAssistantGuard'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { buildAssistantKnowledgeBlock } from './learnAssistantKnowledge'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import { retrieveForTeacher, type TeacherKnowledgeResult } from './teacherKnowledge'

export type ChatMessage = { role: string; content: string }

type PuterChatOptionsRaw = { model?: string; stream?: boolean; temperature?: number; max_tokens?: number }
type PuterChatFn = (messages: ChatMessage[], options?: PuterChatOptionsRaw) => Promise<unknown>
type PuterWithChat = { ai?: { chat?: PuterChatFn } }

/** Порядок предпочтения моделей — все бесплатны в Puter. */
const PREFERRED_MODELS = ['gpt-4o-mini', 'gpt-4.1-mini'] as const
const FAST_MODELS = ['gpt-4o-mini'] as const

const CHAT_TIMEOUT_MS = 20_000
const FAST_CHAT_TIMEOUT_MS = 6_500
const LIVE_CHAT_TIMEOUT_MS = 4_200

/* ------------------------------------------------------------- smart AI state */

export type SmartAiState = 'off' | 'connecting' | 'on' | 'error'

const smartListeners = new Set<(state: SmartAiState) => void>()
let connecting = false
let lastError = false

function writeOptIn(on: boolean): void {
  try {
    localStorage.setItem(SMART_AI_STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* private mode */
  }
}

export function getSmartAiState(): SmartAiState {
  if (connecting) return 'connecting'
  if (isSmartAiOptedIn()) return 'on'
  return lastError ? 'error' : 'off'
}

function emitSmart(): void {
  const s = getSmartAiState()
  smartListeners.forEach((l) => l(s))
}

export function subscribeSmartAi(listener: (state: SmartAiState) => void): () => void {
  smartListeners.add(listener)
  return () => {
    smartListeners.delete(listener)
  }
}

/**
 * «Умный ИИ» готов отвечать прямо сейчас: ученик дал согласие, Puter загружен и
 * вход выполнен. Синхронно и без сетевых запросов — можно звать на каждом ходе.
 */
export function isSmartAiConnected(): boolean {
  return isSmartAiOptedIn() && isPuterLoaded() && isPuterSignedInSync()
}

/** Согласие дано, но Puter ещё не загружен в этой вкладке — грузим тихо (без окна). */
export function warmSmartAi(): void {
  if (isSmartAiOptedIn() && !isPuterLoaded()) void loadPuterScript()
}

/**
 * Подключить «умный ИИ». ВЫЗЫВАТЬ ИЗ ОБРАБОТЧИКА КЛИКА — только тогда браузер
 * разрешит Puter открыть окно входа. Возвращает true при успехе.
 */
export async function connectSmartAi(): Promise<boolean> {
  if (connecting) return false
  connecting = true
  lastError = false
  emitSmart()
  try {
    const ok = await ensurePuterSignedIn()
    writeOptIn(ok)
    lastError = !ok
    return ok
  } catch {
    writeOptIn(false)
    lastError = true
    return false
  } finally {
    connecting = false
    emitSmart()
  }
}

export function disconnectSmartAi(): void {
  writeOptIn(false)
  lastError = false
  emitSmart()
}

/* -------------------------------------------------------------------- helpers */

function puterChatFn(): PuterChatFn | null {
  if (typeof window === 'undefined') return null
  const puter = (window as unknown as { puter?: PuterWithChat }).puter
  return puter?.ai?.chat ?? null
}

export function isPuterChatLoaded(): boolean {
  return puterChatFn() !== null
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (v) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

/** Достаёт текст из ответа/куска Puter — форматы GPT/Claude отличаются. */
export function extractPuterText(resp: unknown): string {
  if (resp == null) return ''
  if (typeof resp === 'string') return resp
  const r = resp as Record<string, unknown>

  const message = r.message as Record<string, unknown> | undefined
  if (message) {
    const c = message.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) {
      return c
        .map((part) => (typeof part === 'string' ? part : (((part as Record<string, unknown>)?.text as string) ?? '')))
        .join('')
    }
  }
  if (typeof r.text === 'string') return r.text
  if (typeof r.content === 'string') return r.content
  const delta = r.delta as Record<string, unknown> | undefined
  if (delta && typeof delta.content === 'string') return delta.content
  if (delta && typeof delta.text === 'string') return delta.text
  const choices = r.choices as Array<Record<string, unknown>> | undefined
  if (Array.isArray(choices) && choices[0]) {
    const cm = choices[0].message as Record<string, unknown> | undefined
    if (cm && typeof cm.content === 'string') return cm.content
    const cd = choices[0].delta as Record<string, unknown> | undefined
    if (cd && typeof cd.content === 'string') return cd.content
  }
  return ''
}

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.content.trim()
  }
  return ''
}

function isAsyncIterable(v: unknown): v is AsyncIterable<unknown> {
  return v != null && typeof (v as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
}

/* ------------------------------------------------------------------ streaming */

export interface StreamTeacherChatOptions {
  signal?: AbortSignal
  /** Каждый новый кусок текста (delta) и весь текст на данный момент. */
  onDelta?: (delta: string, fullText: string) => void
  /** Нет первого куска за это время — сдаёмся (мс). */
  firstTokenTimeoutMs?: number
  /** Максимум на весь ответ (мс). */
  totalTimeoutMs?: number
  model?: string
  temperature?: number
  maxTokens?: number
}

export type StreamTeacherChatResult = {
  text: string
  model: string
  /** мс до первого куска текста */
  firstTokenMs: number | null
  totalMs: number
}

/**
 * Потоковый ответ Puter. Не открывает окно входа: если «умный ИИ» не подключён —
 * бросает Error('smart_ai_not_connected'). Отмена — через signal (прерываем чтение
 * потока; Puter не поддерживает AbortSignal, но ответ больше не используется).
 */
export async function streamTeacherChat(payload: ChatMessage[], opts: StreamTeacherChatOptions = {}): Promise<StreamTeacherChatResult> {
  const t0 = performance.now()
  const signal = opts.signal
  if (signal?.aborted) throw abortError()
  if (!isSmartAiConnected()) throw new Error('smart_ai_not_connected')
  const chat = puterChatFn()
  if (!chat) throw new Error('smart_ai_not_connected')

  const model = opts.model ?? FAST_MODELS[0]
  const firstTokenTimeoutMs = opts.firstTokenTimeoutMs ?? 4_000
  const totalTimeoutMs = opts.totalTimeoutMs ?? 25_000

  const response = await withTimeout(
    chat(payload, { model, stream: true, temperature: opts.temperature ?? 0.35, max_tokens: opts.maxTokens ?? 500 }),
    firstTokenTimeoutMs,
    signal,
  )

  let text = ''
  let firstTokenMs: number | null = null
  if (!isAsyncIterable(response)) {
    // Некоторые модели отдают ответ целиком даже при stream: true.
    text = extractPuterText(response)
    if (text) {
      firstTokenMs = performance.now() - t0
      opts.onDelta?.(text, text)
    }
    return { text, model, firstTokenMs, totalMs: performance.now() - t0 }
  }

  const iterator = response[Symbol.asyncIterator]()
  const deadline = t0 + totalTimeoutMs
  for (;;) {
    if (signal?.aborted) {
      void iterator.return?.()
      throw abortError()
    }
    const budget = firstTokenMs === null ? Math.max(200, t0 + firstTokenTimeoutMs * 1.6 - performance.now()) : deadline - performance.now()
    if (budget <= 0) {
      void iterator.return?.()
      if (text) break
      throw new Error('timeout')
    }
    let step: IteratorResult<unknown>
    try {
      step = await withTimeout(iterator.next(), budget, signal)
    } catch (e) {
      void iterator.return?.()
      if (text && (e as Error)?.message === 'timeout') break
      throw e
    }
    if (step.done) break
    const piece = extractPuterText(step.value)
    if (!piece) continue
    if (firstTokenMs === null) firstTokenMs = performance.now() - t0
    text += piece
    opts.onDelta?.(piece, text)
  }
  return { text, model, firstTokenMs, totalMs: performance.now() - t0 }
}

/* -------------------------------------------------------------- full request */

export type PuterChatOptions = {
  /** Жёсткий таймаут на одну модель (мс). Для голосового диалога — короче. */
  timeoutMs?: number
  /** Только быстрая модель. */
  fast?: boolean
  /** Live-голос: короткий промпт + компактная база знаний. */
  live?: boolean
  signal?: AbortSignal
  /** Уже найденные знания (иначе — retrieveForTeacher). */
  knowledge?: TeacherKnowledgeResult
  /** Потоковая выдача текста (ответ всё равно возвращается целиком). */
  onDelta?: (delta: string, fullText: string) => void
}

/** Системный промпт + история для Puter (общий для чата урока). */
export async function buildTeacherChatPayload(
  messages: ChatMessage[],
  ctx: LearnLocalAssistantContext,
  opts: { live?: boolean; knowledge?: TeacherKnowledgeResult; signal?: AbortSignal } = {},
): Promise<{ payload: ChatMessage[]; knowledge: TeacherKnowledgeResult }> {
  const live = Boolean(opts.live)
  const q = lastUserText(messages)
  const knowledge =
    opts.knowledge ??
    (await retrieveForTeacher(q, {
      locale: ctx.locale,
      gradeId: ctx.gradeId,
      chapterId: ctx.chapterId,
      sectionId: ctx.sectionId,
      sectionTitle: ctx.sectionTitle,
      limit: live ? 5 : 8,
      maxChars: live ? 3_600 : 12_000,
      timeoutMs: 2_500,
      signal: opts.signal,
    }))
  const catalog = buildAssistantKnowledgeBlock(q, ctx)
  const promptInput = {
    ...ctx,
    knowledgeBlock: live && catalog.block.length > 1_200 ? `${catalog.block.slice(0, 1_200)}…` : catalog.block,
    chemistryKnowledgeBlock: knowledge.text,
    sectionOutlineBlock: buildSectionOutlineBlock(ctx, live ? 600 : 1_200),
    topicSceneId: catalog.topicSceneId,
  }
  const system = live ? buildLiveAssistantSystemPrompt(promptInput) : buildAssistantSystemPrompt(promptInput)
  const payload: ChatMessage[] = [
    { role: 'system', content: system },
    ...messages.slice(live ? -8 : -8).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ]
  return { payload, knowledge }
}

/**
 * Ответ облачного LLM (Puter) с промптом учителя и базой знаний урока.
 * Возвращает готовый ответ или null (тогда вызывающий отвечает локально).
 * Окно входа не открывает: без подключённого «умного ИИ» сразу null.
 */
export async function requestPuterChat(
  messages: ChatMessage[],
  ctx: LearnLocalAssistantContext,
  signalOrOpts?: AbortSignal | PuterChatOptions,
): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const opts: PuterChatOptions =
    signalOrOpts instanceof AbortSignal || signalOrOpts === undefined ? { signal: signalOrOpts } : signalOrOpts
  const signal = opts.signal
  if (signal?.aborted) return null
  if (!isSmartAiOptedIn()) return null
  if (!isSmartAiConnected()) {
    // Согласие есть, но скрипт ещё не загружен — тихо проверяем вход (без окна).
    const ok = await checkPuterSignedIn(signal).catch(() => false)
    if (!ok || !isSmartAiConnected()) return null
  }

  const live = Boolean(opts.live)
  const timeoutMs =
    opts.timeoutMs ?? (opts.live ? LIVE_CHAT_TIMEOUT_MS : opts.fast ? FAST_CHAT_TIMEOUT_MS : CHAT_TIMEOUT_MS)
  const models = opts.live || opts.fast ? FAST_MODELS : PREFERRED_MODELS
  const { payload } = await buildTeacherChatPayload(messages, ctx, { live, knowledge: opts.knowledge, signal })

  for (const model of models) {
    if (signal?.aborted) return null
    try {
      const result = await streamTeacherChat(payload, {
        signal,
        model,
        onDelta: opts.onDelta,
        firstTokenTimeoutMs: timeoutMs,
        totalTimeoutMs: Math.max(timeoutMs * 3, 15_000),
        temperature: live ? 0.32 : opts.fast ? 0.4 : 0.5,
        maxTokens: live ? 480 : opts.fast ? 800 : 1_400,
      })
      const text = result.text.trim()
      if (text.length > 2) {
        const filtered = filterAssistantReply(text, ctx.locale)
        if (filtered.trim().length > 2) return filtered.trim()
      }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return null
      /* пробуем следующую модель */
    }
  }
  return null
}
