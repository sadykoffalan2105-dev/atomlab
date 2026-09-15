import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { matchFaqEntry } from './learnChemistryFaq'
import { pickFaqText } from './learnAssistantLocale'
import { buildAssistantSystemPrompt } from './learnAssistantPrompt'
import { filterAssistantReply } from './learnAssistantGuard'
import { buildTeacherChatPayload, isSmartAiConnected, requestPuterChat } from './learnPuterChat'
import { citationForDisplay, retrieveForTeacher, type TeacherKnowledgeResult } from './teacherKnowledge'
import { isSubstantiveQuestion, resolveTurn } from './brain/dualMode/followUps'
import { composeLocalAnswer } from './brain/dualMode/localAnswerComposer'

export type TeacherReplySource = 'faq' | 'local' | 'ollama' | 'api' | 'puter'

export type TeacherRouterOptions = {
  preferOllama?: boolean
  ollamaUrl?: string
  ollamaModel?: string
  /** Отключить облачный «умный ИИ» (Puter). По умолчанию — только если ученик его подключил. */
  disablePuter?: boolean
  signal?: AbortSignal
  /** Потоковая выдача текста «умного ИИ» (для обновления сообщения в ленте). */
  onDelta?: (fullText: string) => void
  /** Уже найденные знания (иначе ищем через teacherKnowledge). */
  knowledge?: TeacherKnowledgeResult
}

export type TeacherRouterResult = { text: string; source: TeacherReplySource; citations: string[] }

function puterEnabled(opts?: TeacherRouterOptions): boolean {
  if (opts?.disablePuter) return false
  const flag = import.meta.env.VITE_PUTER_ENABLED
  if (flag === '0' || flag === 'false') return false
  return true
}

const DEFAULT_OLLAMA = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'llama3.2'
const OLLAMA_TIMEOUT_MS = 20_000

function ollamaEnabled(opts?: TeacherRouterOptions): boolean {
  if (opts?.preferOllama === false) return false
  const flag = import.meta.env.VITE_OLLAMA_ENABLED
  if (flag === '0' || flag === 'false') return false
  return opts?.preferOllama === true || flag === '1' || flag === 'true'
}

function lastUserText(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.content.trim()
  }
  return ''
}

function isAbort(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted)
}

async function tryOllamaReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  knowledge: TeacherKnowledgeResult,
  opts?: TeacherRouterOptions,
): Promise<string | null> {
  if (!ollamaEnabled(opts) || isAbort(opts?.signal)) return null
  const base = (opts?.ollamaUrl ?? import.meta.env.VITE_OLLAMA_URL ?? DEFAULT_OLLAMA).replace(/\/$/, '')
  const model = opts?.ollamaModel ?? import.meta.env.VITE_OLLAMA_MODEL ?? DEFAULT_MODEL
  const { payload } = await buildTeacherChatPayload(messages, ctx, { knowledge, signal: opts?.signal })
  const system = payload[0]?.content ?? buildAssistantSystemPrompt({ ...ctx, knowledgeBlock: '', chemistryKnowledgeBlock: knowledge.text })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  opts?.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          ...messages.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        ],
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string } }
    const text = data.message?.content?.trim()
    const filtered = text ? filterAssistantReply(text, ctx.locale) : ''
    return filtered.length > 2 ? filtered : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    opts?.signal?.removeEventListener('abort', onAbort)
  }
}

/** Короткий фактический вопрос, на который есть готовая карточка FAQ. */
function isShortFactualFaqQuery(query: string): boolean {
  const q = query.trim()
  if (q.length > 70) return false
  return !/расскаж|объясни|подроб|почему|зачем|как\s|чем отлич|сравн|реши|сколько|explain|tell me|why|how |compare|solve|tushuntir|nima uchun|qanday/i.test(
    q,
  )
}

/**
 * Локальный ответ без LLM: знания из базы → живой ответ (без выдумок).
 * Follow-up «проще», «пример», «почему» берут тему прошлого вопроса ученика.
 */
export async function composeLocalTeacherReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts: { signal?: AbortSignal; knowledge?: TeacherKnowledgeResult; detail?: 'brief' | 'more' } = {},
): Promise<TeacherRouterResult & { confident: boolean }> {
  const text = lastUserText(messages)
  const previous = messages
    .slice(0, -1)
    .filter((m) => m.role === 'user' && isSubstantiveQuestion(m.content))
    .map((m) => m.content)
  const resolved = resolveTurn(text, previous, ctx.locale, ctx.sectionTitle)
  const knowledge =
    // Результат по таймауту пуст — база ещё грузится; ждём тот же (кешированный) поиск ещё раз.
    opts.knowledge && resolved.query === text && !opts.knowledge.timedOut
      ? opts.knowledge
      : await retrieveForTeacher(resolved.query, {
          locale: ctx.locale,
          gradeId: ctx.gradeId,
          chapterId: ctx.chapterId,
          sectionId: ctx.sectionId,
          sectionTitle: ctx.sectionTitle,
          limit: 8,
          maxChars: 6_000,
          timeoutMs: 2_500,
          signal: opts.signal,
        })
  const composed = composeLocalAnswer({
    query: resolved.query,
    hits: knowledge.hits,
    lang: ctx.locale,
    // Чат: коротко и по делу (прямой ответ + до 2 поясняющих фраз, ≈80 слов); длинно — только по «подробнее».
    style: {
      ...resolved.style,
      detail: opts.detail ?? resolved.style.detail ?? 'brief',
      maxWords: (opts.detail ?? resolved.style.detail) === 'more' ? 140 : resolved.style.simpler ? 50 : 80,
      channel: 'chat',
      helper: ctx.mode === 'helper',
    },
    topicHint: ctx.sectionTitle,
    seed: messages.length,
    suggestSmartAi: !isSmartAiConnected(),
  })
  const used = new Set(composed.usedTitles)
  const citations = [
    ...new Set(knowledge.hits.filter((h) => used.has(h.title) && h.citation).map((h) => citationForDisplay(h.citation!, ctx.locale))),
  ].slice(0, 3)
  const body = composed.confident && citations.length ? `${composed.text}\n\n${citations.join(' ')}` : composed.text
  return { text: body, source: 'local', citations, confident: composed.confident }
}

/**
 * Бесплатный маршрут ответа учителя (без платежей и ключей):
 * база знаний (teacherKnowledge) → Ollama на этом ПК (если включена) → «умный ИИ»
 * Puter (только если ученик подключил, со стримингом) → локальный ответ из базы →
 * карточка FAQ. Все сетевые шаги отменяемы (signal) и с таймаутами.
 */
export async function routeTeacherReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts?: TeacherRouterOptions,
): Promise<TeacherRouterResult> {
  const signal = opts?.signal
  const q = lastUserText(messages)
  const knowledge =
    opts?.knowledge ??
    (await retrieveForTeacher(q, {
      locale: ctx.locale,
      gradeId: ctx.gradeId,
      chapterId: ctx.chapterId,
      sectionId: ctx.sectionId,
      sectionTitle: ctx.sectionTitle,
      limit: 8,
      maxChars: 12_000,
      timeoutMs: 2_500,
      signal,
    }))
  if (isAbort(signal)) return { text: '', source: 'local', citations: [] }

  // 1) Локальная Ollama — если пользователь её поднял (максимальная приватность).
  if (ollamaEnabled(opts)) {
    const ollama = await tryOllamaReply(messages, ctx, knowledge, opts)
    if (ollama) return { text: ollama, source: 'ollama', citations: knowledge.citations.slice(0, 3) }
    if (isAbort(signal)) return { text: '', source: 'local', citations: [] }
  }

  // 2) «Умный ИИ» Puter — только с согласия ученика; окно входа здесь не открывается.
  if (puterEnabled(opts) && isSmartAiConnected()) {
    const puter = await requestPuterChat(messages, ctx, {
      signal,
      knowledge,
      onDelta: opts?.onDelta ? (_d, full) => opts.onDelta?.(full) : undefined,
    }).catch(() => null)
    if (puter) return { text: puter, source: 'puter', citations: knowledge.citations.slice(0, 3) }
    if (isAbort(signal)) return { text: '', source: 'local', citations: [] }
  }

  // 3) Локальный ответ из базы знаний.
  const local = await composeLocalTeacherReply(messages, ctx, { signal, knowledge })
  if (local.confident) return local

  // 4) Готовая карточка FAQ для короткого фактического вопроса.
  const faq = isShortFactualFaqQuery(q) ? matchFaqEntry(q.toLowerCase()) : null
  if (faq) return { text: pickFaqText(faq, ctx.locale), source: 'faq', citations: [] }

  return local
}
